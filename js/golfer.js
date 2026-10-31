// Realistic golfer: MakeHuman CC0 body, skin, suit, shoes and fedora,
// skinned with the MakeHuman game skeleton. The swing is procedural and
// driven live by the stick (see README credits).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _q3 = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _grip = new THREE.Vector3();
const _headT = new THREE.Vector3();
const _axis = new THREE.Vector3(0, 1, 0);

function makeClub() {
  const g = new THREE.Group();
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.85, roughness: 0.32 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd5d8df, metalness: 0.92, roughness: 0.22 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.92, 12), shaftMat);
  shaft.position.y = -0.46;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.26, 12), gripMat);
  grip.position.y = -0.1;
  const ironShape = new THREE.Shape();
  ironShape.moveTo(0, 0);
  ironShape.lineTo(0.02, -0.012);
  ironShape.lineTo(0.062, -0.01);
  ironShape.lineTo(0.078, 0.012);
  ironShape.lineTo(0.048, 0.058);
  ironShape.lineTo(0.012, 0.05);
  ironShape.closePath();
  const ironGeo = new THREE.ExtrudeGeometry(ironShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 });
  ironGeo.translate(-0.01, -0.02, -0.006);
  const iron = new THREE.Mesh(ironGeo, steel);
  iron.position.set(0.012, -0.94, 0);
  const wedge = iron.clone();
  wedge.scale.set(1.12, 0.9, 1.4);
  const putter = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.026, 0.032), steel);
  putter.position.set(0.02, -0.9, 0);
  g.add(shaft, grip, iron, wedge, putter);
  g.userData.parts = { shaft, iron, wedge, putter };
  return g;
}

function wrap(gltf) {
  const meshes = [];
  gltf.scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  if (!meshes.length) throw new Error('golfer mesh missing');
  const mesh = meshes[0];
  const root = new THREE.Group();
  root.name = 'golfer';
  const displays = [];
  meshes.forEach((src, i) => {
    src.castShadow = true;
    src.frustumCulled = false;
    const srcPos = src.geometry.attributes.position.array;
    const dstPos = new Float32Array(srcPos.length);
    const dispGeo = src.geometry.clone();
    dispGeo.setAttribute('position', new THREE.BufferAttribute(dstPos, 3));
    dispGeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
    const dispMat = Array.isArray(src.material) ? src.material.map((m) => m.clone()) : src.material.clone();
    const disp = new THREE.Mesh(dispGeo, dispMat);
    disp.castShadow = true;
    disp.receiveShadow = true;
    disp.frustumCulled = false;
    disp.name = 'golferPart' + i;
    root.add(src);
    root.add(disp);
    const hide = (m) => { m.colorWrite = false; m.depthWrite = false; };
    if (Array.isArray(src.material)) src.material.forEach(hide);
    else if (src.material) hide(src.material);
    displays.push({ src, srcPos, dstPos, dispGeo, disp });
  });
  // Keep the skeleton root inside the skinned mesh (GLTFLoader already parents bones).

  const byName = {};
  mesh.skeleton.bones.forEach((b) => { byName[b.name] = b; });
  const bind = new Map();
  mesh.skeleton.bones.forEach((b) => bind.set(b, b.quaternion.clone()));

  const club = makeClub();
  const B = (n) => byName[n] || byName[n.replace(/\./g, '')];
  const hand = B('wrist.L') || B('lowerarm02.L');
  if (!hand) throw new Error('no hand bone: ' + Object.keys(byName).slice(0, 50).join(' | '));
  hand.add(club);
  mesh.updateMatrixWorld(true);
  const armLen = B('upperarm01.L').getWorldPosition(_v1).distanceTo(B('lowerarm01.L').getWorldPosition(_v2));
  const foreLen = B('lowerarm01.L').getWorldPosition(_v1).distanceTo(B('wrist.L').getWorldPosition(_v2));

  function restore() {
    mesh.skeleton.bones.forEach((b) => b.quaternion.copy(bind.get(b)));
  }

  function addLocal(bone, x, y, z) {
    if (!bone || (x === 0 && y === 0 && z === 0)) return;
    _q3.setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
    bone.quaternion.multiply(_q3);
  }

  function alignBone(bone, worldDir) {
    bone.quaternion.copy(bind.get(bone));
    bone.updateMatrixWorld(true);
    bone.getWorldQuaternion(_q1);
    _v1.set(0, 1, 0).applyQuaternion(_q1).normalize();
    _q2.setFromUnitVectors(_v1, _v3.copy(worldDir).normalize());
    // Don't let a bad target flip the limb inside out.
    const ang = 2 * Math.acos(clamp(Math.abs(_q2.w), 0, 1));
    if (ang > 0.55) _q2.slerp(new THREE.Quaternion(), 1 - 0.55 / ang);
    _q2.multiply(_q1);
    bone.parent.getWorldQuaternion(_q1);
    bone.quaternion.copy(_q1.invert()).multiply(_q2);
    bone.updateMatrixWorld(true);
  }

  function ikArm(arm, fore, target, pole, aLen, bLen) {
    arm.parent.updateMatrixWorld(true);
    const S = arm.getWorldPosition(_v1).clone();
    const axis = target.clone().sub(S);
    let dist = axis.length();
    if (dist < 1e-4) return;
    const maxD = aLen + bLen - 0.01;
    const minD = Math.abs(aLen - bLen) + 0.01;
    dist = clamp(dist, minD, maxD);
    axis.normalize();
    const cosS = clamp((aLen * aLen + dist * dist - bLen * bLen) / (2 * aLen * dist), -1, 1);
    const shoulderAng = Math.acos(cosS);
    const toPole = pole.clone().sub(S);
    const n = new THREE.Vector3().crossVectors(axis, toPole);
    if (n.lengthSq() < 1e-8) n.set(1, 0, 0);
    n.normalize();
    const bend = new THREE.Vector3().crossVectors(n, axis).normalize();
    const elbow = S.clone().addScaledVector(axis, Math.cos(shoulderAng) * aLen).addScaledVector(bend, Math.sin(shoulderAng) * aLen);
    alignBone(arm, elbow.clone().sub(S));
    alignBone(fore, target.clone().sub(elbow));
  }

  function setClub(id) {
    const p = club.userData.parts;
    const putter = id === 'PT';
    const wedge = id === 'PW' || id === 'SW';
    p.iron.visible = !putter && !wedge;
    p.wedge.visible = wedge;
    p.putter.visible = putter;
  }

  function poseBody(s, power, path, putt) {
    restore();
    void s; void power; void path; void putt;
    return;
    const over = 0;
    let shoulder, hip, bend, knee;
    if (s <= 1.05) {
      const t = smooth(clamp(s, 0, 1));
      shoulder = (putt ? -0.2 : -0.7) * t - (putt ? 0 : 0.08 * over);
      hip = shoulder * (putt ? 0.08 : 0.4);
      bend = lerp(putt ? 0.15 : 0.4, putt ? 0.12 : 0.28, t);
      knee = lerp(0.15, putt ? 0.12 : 0.22, t);
    } else if (s <= 2) {
      const t = clamp((s - 1.05) / 0.95, 0, 1);
      const e = smooth(t);
      const shT = smooth(clamp((t - 0.05) / 0.95, 0, 1));
      shoulder = lerp(putt ? -0.2 : -0.7, putt ? 0.04 : 0.15, shT);
      hip = lerp((putt ? -0.2 : -0.7) * 0.4, putt ? 0.02 : 0.3, smooth(clamp(t / 0.7, 0, 1)));
      bend = lerp(putt ? 0.12 : 0.28, putt ? 0.14 : 0.35, e);
      knee = lerp(0.22, 0.12, e);
    } else {
      const t = smooth(clamp((s - 2) / 1, 0, 1));
      shoulder = lerp(putt ? 0.04 : 0.15, putt ? 0.15 : 0.6, t);
      hip = lerp(putt ? 0.02 : 0.3, putt ? 0.04 : 0.4, t);
      bend = lerp(putt ? 0.14 : 0.35, putt ? 0.1 : 0.15, t);
      knee = lerp(0.22, 0.1, t);
      shoulder += clamp(path, -1, 1) * 0.28 * t;
    }
    // Local +X pitches the spine (child is +Y). Positive X was tested against the bind quaternions.
    addLocal(B('spine05'), bend * 0.45, hip * 0.55, 0);
    addLocal(B('spine04'), bend * 0.35, shoulder * 0.25, 0);
    addLocal(B('spine03'), bend * 0.2, shoulder * 0.35, 0);
    addLocal(B('spine02'), 0, shoulder * 0.45, 0);
    addLocal(B('spine01'), -bend * 0.05, shoulder * 0.2, 0);
    addLocal(B('upperleg01.L'), -knee, 0, 0.08);
    addLocal(B('upperleg01.R'), -knee * 0.9, 0, -0.08);
    addLocal(B('lowerleg01.L'), knee * 1.15, 0, 0);
    addLocal(B('lowerleg01.R'), knee, 0, 0);
    if (putt) {
      addLocal(B('spine05'), 0, -hip * 0.7, 0);
    }
    // Soft grip so the fingers close around the handle.
    for (const side of ['L', 'R']) {
      for (let f = 1; f <= 5; f++) {
        addLocal(B(`finger${f}-1.${side}`), 0.5, 0, 0);
        addLocal(B(`finger${f}-2.${side}`), 0.7, 0, 0);
        addLocal(B(`finger${f}-3.${side}`), 0.4, 0, 0);
      }
    }
  }

  function targets(s, power, path, putt, ball, aimYaw, forward, right) {
    const by = ball.y;
    const up = _up;
    const addressG = ball.clone().addScaledVector(right, 0.22).addScaledVector(up, 0.72);
    const addressH = ball.clone().addScaledVector(right, 0.04).addScaledVector(up, 0.02);
    const topG = ball.clone().addScaledVector(forward, -0.05).addScaledVector(right, 0.16).addScaledVector(up, 1.52);
    const topH = topG.clone().addScaledVector(forward, 0.95);
    topH.y = topG.y;
    const overH = topH.clone().addScaledVector(forward, 0.2);
    overH.y -= 0.38;
    const impactG = ball.clone().addScaledVector(forward, 0.08).addScaledVector(right, 0.12).addScaledVector(up, 0.7);
    const finishG = ball.clone().addScaledVector(forward, 0.12).addScaledVector(right, -0.05).addScaledVector(up, 1.62);
    const finishH = finishG.clone().addScaledVector(forward, 0.15).addScaledVector(right, -0.25 - path * 0.2).addScaledVector(up, 0.35);
    let g0, g1, h0, h1, u;
    if (putt) {
      const back = Math.sin(clamp(s, 0, 1) * Math.PI) * 0.18;
      _grip.copy(addressG).addScaledVector(forward, -back);
      _headT.copy(addressH).addScaledVector(forward, -back * 1.4);
      _grip.y = by + 0.62;
      _headT.y = by + 0.03;
      return;
    }
    if (s <= 1) { g0 = addressG; g1 = topG; h0 = addressH; h1 = topH; u = smooth(s); }
    else if (s <= 1.25) { g0 = topG; g1 = topG; h0 = topH; h1 = power > 1.02 ? overH : topH; u = (s - 1) / 0.25; }
    else if (s <= 2) { g0 = topG; g1 = impactG; h0 = power > 1.02 ? overH : topH; h1 = addressH; u = smooth((s - 1.25) / 0.75); u *= u; }
    else { g0 = impactG; g1 = finishG; h0 = addressH; h1 = finishH; u = smooth(clamp((s - 2) / 1, 0, 1)); }
    _grip.copy(g0).lerp(g1, clamp(u, 0, 1));
    _headT.copy(h0).lerp(h1, clamp(u, 0, 1));
  }

  function poseArms(s, power, path, putt, ball, aimYaw) {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(root.quaternion);
    const right = new THREE.Vector3().crossVectors(forward, _up).normalize();
    targets(s, power, path, putt, new THREE.Vector3(ball.x, ball.y, ball.z), aimYaw, forward, right);
    mesh.updateMatrixWorld(true);
    const poleL = _grip.clone().addScaledVector(forward, 0.15).addScaledVector(_up, -0.45);
    const poleR = _grip.clone().addScaledVector(forward, -0.2).addScaledVector(right, 0.12).addScaledVector(_up, -0.5);
    const gripR = _grip.clone().addScaledVector(right, 0.025);
    ikArm(B('upperarm01.L'), B('lowerarm01.L'), _grip, poleL, armLen + 0.07, foreLen + 0.12);
    ikArm(B('upperarm01.R'), B('lowerarm01.R'), gripR, poleR, armLen + 0.07, foreLen + 0.12);
    // Straighten the lead arm at the top by pushing the grip out if it is too close.
    if (!putt && s > 0.75 && s < 1.3) {
      const lead = B('upperarm01.L').getWorldPosition(new THREE.Vector3());
      const d = lead.distanceTo(_grip);
      const want = armLen + foreLen + 0.12;
      if (d < want - 0.04) {
        _grip.add(_grip.clone().sub(lead).normalize().multiplyScalar(want - d));
        ikArm(B('upperarm01.L'), B('lowerarm01.L'), _grip, poleL, armLen + 0.07, foreLen + 0.12);
        ikArm(B('upperarm01.R'), B('lowerarm01.R'), _grip.clone().addScaledVector(right, 0.02), poleR, armLen + 0.07, foreLen + 0.12);
      }
    }
    // Aim the shaft from the wrist to the clubhead target. Local +Y is down the hand.
    const wrist = B('wrist.L');
    wrist.updateMatrixWorld(true);
    const origin = wrist.getWorldPosition(new THREE.Vector3());
    const dir = _headT.clone().sub(origin);
    const reach = Math.max(0.4, dir.length());
    dir.normalize();
    const len = clamp(reach - 0.02, putt ? 0.55 : 0.7, putt ? 0.9 : 1.15);
    const parts = club.userData.parts;
    parts.shaft.scale.y = len / 0.92;
    parts.shaft.position.y = -len * 0.5;
    parts.iron.position.y = -len + 0.02;
    parts.wedge.position.y = -len + 0.02;
    parts.putter.position.y = -len + 0.03;
    const worldQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    wrist.getWorldQuaternion(_q1);
    club.quaternion.copy(_q1).invert().multiply(worldQ);
    const face = path * clamp((s - 1.2) / 1.3, 0, 1);
    club.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, -1, 0), face * 0.7));
  }

  let clubId = '';
  const pose = { opacity: 0 };
  function cpuSkin() {
    mesh.skeleton.update();
    const bm = mesh.skeleton.boneMatrices;
    for (const part of displays) {
      const siAttr = part.src.geometry.attributes.skinIndex;
      const swAttr = part.src.geometry.attributes.skinWeight;
      const srcPos = part.srcPos;
      const dstPos = part.dstPos;
      const n = srcPos.length / 3;
      for (let i = 0; i < n; i++) {
        const x = srcPos[i * 3], y = srcPos[i * 3 + 1], z = srcPos[i * 3 + 2];
        const js = [siAttr.getX(i), siAttr.getY(i), siAttr.getZ(i), siAttr.getW(i)];
        const ws = [swAttr.getX(i), swAttr.getY(i), swAttr.getZ(i), swAttr.getW(i)];
        let ox = 0, oy = 0, oz = 0;
        for (let k = 0; k < 4; k++) {
          const w = ws[k];
          if (w === 0) continue;
          const o = js[k] * 16;
          ox += (bm[o] * x + bm[o + 4] * y + bm[o + 8] * z + bm[o + 12]) * w;
          oy += (bm[o + 1] * x + bm[o + 5] * y + bm[o + 9] * z + bm[o + 13]) * w;
          oz += (bm[o + 2] * x + bm[o + 6] * y + bm[o + 10] * z + bm[o + 14]) * w;
        }
        dstPos[i * 3] = ox;
        dstPos[i * 3 + 1] = oy;
        dstPos[i * 3 + 2] = oz;
      }
      part.dispGeo.attributes.position.needsUpdate = true;
    }
  }

  const matList = displays.flatMap((d) => Array.isArray(d.disp.material) ? d.disp.material : [d.disp.material]);

  function update(dt, inp) {
    if (root.userData.freeze) return;
    const ball = inp.ball;
    const aimYaw = inp.aimYaw || 0;
    const putt = !!inp.putt;
    const phase = inp.phase;
    const dx = Math.sin(aimYaw), dz = -Math.cos(aimYaw);
    const rx = -dz, rz = dx;
    const side = putt ? 0.34 : 0.46;
    const st = {
      x: ball.x + rx * side - dx * 0.02,
      z: ball.z + rz * side - dz * 0.02,
    };
    // Model faces +Z. Chest should point at the ball, which is -right from the stance.
    const chestX = dz, chestZ = -dx;
    const yaw = Math.atan2(chestX, chestZ);
    const overhead = phase === 'overhead' || phase === 'intro';
    let dist = Math.hypot(st.x - root.position.x, st.z - root.position.z);
    if (!root.userData.placed) {
      root.position.set(st.x, inp.heightAt(st.x, st.z), st.z);
      root.userData.placed = true;
      dist = 0;
      pose.opacity = phase === 'intro' ? 0 : 1;
    }
    if (dist > 20 || (overhead && dist > 0.4)) {
      pose.opacity = Math.max(0, pose.opacity - dt * 4);
      if (pose.opacity <= 0.02) {
        root.position.set(st.x, inp.heightAt(st.x, st.z), st.z);
      }
    } else if (dist > 0.12 && !overhead) {
      pose.opacity = Math.min(1, pose.opacity + dt * 3);
      const step = Math.min(dist, dt * Math.max(1.6, dist * 1.8));
      root.position.x += (st.x - root.position.x) / dist * step;
      root.position.z += (st.z - root.position.z) / dist * step;
      root.position.y = inp.heightAt(root.position.x, root.position.z);
      restore();
      const w = performance.now() * 0.007;
      addLocal(B('upperleg01.L'), Math.sin(w) * 0.45, 0, 0);
      addLocal(B('upperleg01.R'), Math.sin(w + Math.PI) * 0.45, 0, 0);
      addLocal(B('lowerleg01.L'), Math.max(0, Math.sin(w)) * 0.4, 0, 0);
      addLocal(B('lowerleg01.R'), Math.max(0, Math.sin(w + Math.PI)) * 0.4, 0, 0);
    } else {
      if (!overhead) pose.opacity = Math.min(1, pose.opacity + dt * 3);
      root.position.set(st.x, inp.heightAt(st.x, st.z), st.z);
    }
    if (overhead) pose.opacity = Math.max(0, pose.opacity - dt * 3.2);
    root.rotation.y = yaw;
    root.visible = pose.opacity > 0.03;
    matList.forEach((m) => {
      if (Array.isArray(m)) return;
      m.transparent = pose.opacity < 0.98;
      m.opacity = pose.opacity;
      m.depthWrite = pose.opacity > 0.85;
    });

    const id = inp.clubId || '8i';
    if (id !== clubId) { clubId = id; setClub(id); }
    const s = inp.s || 0;
    const walking = dist > 0.12 && !overhead && pose.opacity > 0.2;
    if (!walking) {
      poseBody(s, inp.power || 0, inp.path || 0, putt);
      root.updateMatrixWorld(true);
      poseArms(s, inp.power || 0, inp.path || 0, putt, ball, aimYaw);
      if (s < 0.04) {
        const wag = Math.sin((inp.time || 0) * 2.1) * 0.03;
        addLocal(B('spine01'), Math.sin((inp.time || 0) * 1.5) * 0.01, wag, 0);
      }
    }
    root.updateMatrixWorld(true);
    cpuSkin();
  }

  return { mesh: root, update, pose };
}

export function loadGolfer(url = './assets/golfer.glb') {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => {
      try { resolve(wrap(gltf)); }
      catch (err) { reject(err); }
    }, undefined, reject);
  });
}
