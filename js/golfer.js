// Mannequin driven directly by CMU motion capture. No walk cycle and no
// retarget onto a clothed mesh. Takes: 64_06 full swing, 64_13 putt.
// Frame 0 of each file is a T-pose added by the BVH conversion, not the swing.
// See assets/mocap/CREDIT.txt.
import * as THREE from 'three';
import { parseBVH, jointQuaternion, rootPosition } from './bvh.js';

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
const STATURE = 1.8;
const GRIP = 0.09;

const PHASE = {
  swing: { address: 102, top: 192, impact: 253, finish: 355 },
  putt: { address: 80, top: 183, impact: 252, finish: 340 },
};

const qA = new THREE.Quaternion();
const qB = new THREE.Quaternion();
const qT = new THREE.Quaternion();
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const v4 = new THREE.Vector3();
const s1 = new THREE.Vector3();
const s2 = new THREE.Vector3();
const s3 = new THREE.Vector3();

function loadText(file) {
  return fetch(new URL('../assets/mocap/' + file, import.meta.url)).then((r) => {
    if (!r.ok) throw new Error(file + ' ' + r.status);
    return r.text();
  });
}

function quatAngle(a, b) {
  const d = Math.abs(a.dot(b));
  return 2 * Math.acos(Math.min(1, d));
}

export function createGolfer() {
  const anchor = new THREE.Group();
  anchor.name = 'golfer';
  const rig = new THREE.Group();
  anchor.add(rig);

  const boneMat = new THREE.MeshStandardMaterial({ color: 0xe4ded4, roughness: 0.62, metalness: 0.02 });
  const jointMat = new THREE.MeshStandardMaterial({ color: 0xb08d57, roughness: 0.38, metalness: 0.42 });
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x2c3136, roughness: 0.32, metalness: 0.72 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xd5dbe2, roughness: 0.28, metalness: 0.6 });

  const segments = [];
  const spheres = [];
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.007, 1, 12), shaftMat);
  shaft.geometry.translate(0, -0.5, 0);
  shaft.frustumCulled = false;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.014), headMat);
  const putterHead = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.03), headMat);
  blade.frustumCulled = false;
  putterHead.frustumCulled = false;
  anchor.add(shaft, blade, putterHead);

  const pose = { s: 0, walking: false, putt: false, ready: false, take: '64_06', metrics: null };
  let swing = null;
  let putt = null;
  let active = null;

  function sample(clip, f) {
    const frames = clip.bvh.frames;
    const i0 = Math.max(0, Math.min(frames.length - 1, Math.floor(f)));
    const i1 = Math.min(frames.length - 1, i0 + 1);
    const u = f - i0;
    rootPosition(clip.bvh.root, frames[i0], v1);
    rootPosition(clip.bvh.root, frames[i1], v2);
    v1.lerp(v2, u).multiplyScalar(clip.scale);
    clip.root.set(clip.pin.x, v1.y - clip.ground, clip.pin.z);
    for (const joint of clip.bvh.joints) {
      jointQuaternion(joint, frames[i0], qA, qT, AX);
      jointQuaternion(joint, frames[i1], qB, qT, AX);
      clip.quats[joint.name].copy(qA).slerp(qB, u);
    }
  }

  function apply(clip) {
    clip.bones.Hips.position.copy(clip.root);
    for (const joint of clip.bvh.joints) clip.bones[joint.name].quaternion.copy(clip.quats[joint.name]);
    rig.updateMatrixWorld(true);
  }

  function frameFor(phases, s) {
    const { address, top, impact, finish } = phases;
    if (s <= 1) return address + (top - address) * Math.max(0, s);
    if (s <= 2) return top + (impact - top) * (s - 1);
    return impact + (finish - impact) * Math.min(1, s - 2);
  }

  function wp(name, out) {
    return swing.bones[name].getWorldPosition(out);
  }

  function solveArm(shoulder, target, pole, aLen, bLen, out) {
    s1.subVectors(target, shoulder);
    let dist = s1.length();
    if (dist < 1e-5) return out.copy(shoulder);
    const max = aLen + bLen - 0.002;
    const min = Math.abs(aLen - bLen) + 0.002;
    const clamped = Math.max(min, Math.min(max, dist));
    s1.multiplyScalar(1 / dist);
    const cos = Math.max(-1, Math.min(1, (aLen * aLen + clamped * clamped - bLen * bLen) / (2 * aLen * clamped)));
    const along = cos;
    const away = Math.sqrt(Math.max(0, 1 - cos * cos));
    s2.subVectors(pole, shoulder);
    s3.crossVectors(s1, s2);
    if (s3.lengthSq() < 1e-8) s3.set(0, 1, 0);
    s3.normalize();
    s2.crossVectors(s3, s1).normalize();
    return out.copy(shoulder).addScaledVector(s1, along * aLen).addScaledVector(s2, away * aLen);
  }

  function alignAxis(bone, worldPoint, axisSign) {
    bone.updateWorldMatrix(true, false);
    bone.getWorldPosition(v1);
    v2.subVectors(worldPoint, v1);
    if (v2.lengthSq() < 1e-8) return;
    v2.normalize();
    v3.set(axisSign, 0, 0);
    qA.setFromUnitVectors(v3, v2);
    bone.parent.updateWorldMatrix(true, false);
    bone.parent.getWorldQuaternion(qB);
    bone.quaternion.copy(qB.invert()).multiply(qA);
  }

  function poseAt(clip, s, ballWorld) {
    sample(clip, frameFor(clip.phases, s));
    apply(clip);
    const off = clip.gripOff || { x: GRIP, y: 0, z: 0 };
    const lead = wp('LeftHand', v1).clone();
    swing.bones.LeftHand.getWorldQuaternion(qA);
    v2.set(off.x, off.y, off.z).applyQuaternion(qA);
    const grip = lead.add(v2).clone();
    const frozen = v3.copy(clip.shaftLocal).applyQuaternion(qA).normalize();
    // Shaft from both hands: trail hand sits closer to the clubhead, so
    // lead → trail is the handle. Wrist hinge (forearm × handle) keeps the
    // shaft in that plane instead of a single frozen wrist axis.
    const trail = swing.bones.RightHand.getWorldPosition(new THREE.Vector3());
    const leadElbow = swing.bones.LeftForeArm.getWorldPosition(new THREE.Vector3());
    const handle = trail.clone().sub(grip);
    const forearm = grip.clone().sub(leadElbow);
    let shaftDir = frozen.clone();
    if (handle.length() > 0.04 && forearm.length() > 0.04) {
      handle.normalize();
      forearm.normalize();
      if (handle.dot(frozen) < 0) handle.negate();
      const hinge = new THREE.Vector3().crossVectors(forearm, handle);
      if (hinge.lengthSq() > 1e-6) {
        hinge.normalize();
        const plane = new THREE.Vector3().crossVectors(hinge, forearm).normalize();
        if (plane.dot(frozen) < 0) plane.negate();
        // Hands dominate once the backswing is moving; address stays on the
        // calibrated shaft so the head starts on the ball.
        const handK = s <= 0 ? 0 : s < 0.45 ? s / 0.45 : (s < 1.65 ? 1 : Math.max(0, 1 - (s - 1.65) / 0.25));
        shaftDir.copy(frozen).lerp(plane, handK).normalize();
      }
    }
    // Full-iron top: pull the hand-derived shaft toward parallel with the ground
    // (a few degrees downhill). Only around the top, so address and impact stay put.
    if (s > 0.72 && s < 1.28) {
      const k = 1 - Math.abs(s - 1) / 0.28;
      const h = Math.hypot(shaftDir.x, shaftDir.z) || 1e-4;
      const flat = new THREE.Vector3(shaftDir.x / h * 0.99, -0.14, shaftDir.z / h * 0.99);
      shaftDir.lerp(flat, Math.max(0, k) * 0.85).normalize();
    }
    let len = clip.clubLength;
    // Small correction only near impact, so the head meets the ball.
    if (ballWorld && s > 1.65 && s < 2.35) {
      const k = s <= 2 ? (s - 1.65) / 0.35 : Math.max(0, 1 - (s - 2) / 0.35);
      const to = new THREE.Vector3(ballWorld.x, ballWorld.y, ballWorld.z).sub(grip);
      const dist = to.length();
      if (dist > 0.05 && k > 0) {
        to.multiplyScalar(1 / dist);
        shaftDir.lerp(to, k).normalize();
        len = clip.clubLength + (dist - clip.clubLength) * k;
      }
    }
    const head = grip.clone().addScaledVector(shaftDir, len);
    const target = grip.clone().addScaledVector(shaftDir, 0.07);
    const shoulder = wp('RightArm', v1).clone();
    const pole = wp('RightForeArm', v2).clone();
    const aLen = Math.abs(swing.bones.RightForeArm.position.x);
    const bLen = Math.abs(swing.bones.RightHand.position.x);
    const elbow = solveArm(shoulder, target, pole, aLen, bLen, new THREE.Vector3());
    alignAxis(swing.bones.RightArm, elbow, swing.bones.RightArm.userData.axis || -1);
    rig.updateMatrixWorld(true);
    alignAxis(swing.bones.RightForeArm, target, swing.bones.RightForeArm.userData.axis || -1);
    rig.updateMatrixWorld(true);
    return { grip, head };
  }

  function layout(hit, clubId) {
    anchor.updateMatrixWorld(true);
    const inv = anchor.matrixWorld.clone().invert();
    const toLocal = (src, out) => out.copy(src).applyMatrix4(inv);
    for (const seg of segments) {
      seg.a.getWorldPosition(v1);
      seg.b.getWorldPosition(v2);
      toLocal(v1, v1);
      toLocal(v2, v2);
      const len = v1.distanceTo(v2);
      seg.mesh.visible = len > 0.02;
      if (!seg.mesh.visible) continue;
      seg.mesh.position.copy(v1).lerp(v2, 0.5);
      v4.subVectors(v2, v1).multiplyScalar(1 / len);
      seg.mesh.quaternion.setFromUnitVectors(UP, v4);
      seg.mesh.scale.set(1, len, 1);
    }
    for (const sp of spheres) {
      sp.bone.getWorldPosition(v1);
      toLocal(v1, sp.mesh.position);
    }
    toLocal(hit.grip, v1);
    toLocal(hit.head, v2);
    const len = Math.max(0.25, v1.distanceTo(v2));
    v4.subVectors(v2, v1).multiplyScalar(1 / len);
    shaft.position.copy(v1);
    shaft.quaternion.setFromUnitVectors(DOWN, v4);
    shaft.scale.set(1, len, 1);
    const putter = clubId === 'PT';
    blade.visible = !putter;
    putterHead.visible = putter;
    const hm = putter ? putterHead : blade;
    hm.position.copy(v2);
    hm.quaternion.copy(shaft.quaternion);
  }

  function place(ball, aimYaw, heightAt) {
    // Down-the-line: the mocap chest already faces across the target line,
    // so a camera on that line sees a right-hander from behind his trail side.
    const yaw = -aimYaw;
    const key = yaw.toFixed(4) + '|' + ball.x.toFixed(2) + '|' + ball.z.toFixed(2) + '|' + active.name;
    anchor.rotation.y = yaw;
    anchor.scale.set(1, 1, 1);
    if (active.placeKey === key) {
      anchor.position.copy(active.placePos);
      return;
    }
    anchor.position.set(ball.x, heightAt(ball.x, ball.z), ball.z);
    anchor.updateMatrixWorld(true);
    const hit = poseAt(active, 0, null);
    anchor.position.x += ball.x - hit.head.x;
    anchor.position.z += ball.z - hit.head.z;
    anchor.position.y = heightAt(anchor.position.x, anchor.position.z);
    active.placeKey = key;
    active.placePos = anchor.position.clone();
  }

  function update(_dt, inp) {
    if (!pose.ready) return;
    const clip = inp.putt ? putt : swing;
    active = clip;
    const hide = inp.phase === 'intro' || inp.phase === 'overhead';
    anchor.visible = !hide;
    if (hide) return;
    pose.s = inp.s || 0;
    pose.putt = !!inp.putt;
    pose.walking = false;
    pose.take = clip.name;
    place(inp.ball, inp.aimYaw || 0, inp.heightAt);
    const hit = poseAt(clip, pose.s, inp.ball);
    layout(hit, inp.clubId || '7i');
    const face = (inp.path || 0) * 0.35;
    if (face) {
      v1.set(0, 1, 0).applyQuaternion(shaft.quaternion);
      qT.setFromAxisAngle(v1, face);
      shaft.quaternion.premultiply(qT);
      blade.quaternion.premultiply(qT);
      putterHead.quaternion.premultiply(qT);
    }
  }

  function buildBones(bvh) {
    const bones = {};
    const quats = {};
    function add(node, parent) {
      if (node.end) return;
      const bone = new THREE.Bone();
      bone.name = node.name;
      bone.position.set(node.offset[0], node.offset[1], node.offset[2]);
      parent.add(bone);
      bones[node.name] = bone;
      quats[node.name] = new THREE.Quaternion();
      const child = node.children[0];
      if (child) bone.userData.axis = child.offset[0] < -1e-4 ? -1 : 1;
      if (node.endOffset) bone.userData.end = node.endOffset;
      for (const c of node.children) add(c, bone);
    }
    const holder = new THREE.Group();
    add(bvh.root, holder);
    return { bones, quats, holder };
  }

  function prepare(bvh, phases, name, bones, quats, scale) {
    const clip = {
      name, bvh, phases, bones, quats, scale,
      root: new THREE.Vector3(), pin: new THREE.Vector3(), ground: 0,
      shaftLocal: new THREE.Vector3(), clubLength: 0.9, addressHead: new THREE.Vector3(),
    };
    const addr = bvh.frames[phases.address];
    rootPosition(bvh.root, addr, clip.pin).multiplyScalar(scale);
    sample(clip, phases.address);
    apply(clip);
    const footY = Math.min(bones.LeftToeBase.getWorldPosition(v1).y, bones.RightToeBase.getWorldPosition(v2).y);
    clip.ground = footY;
    sample(clip, phases.address);
    apply(clip);
    return clip;
  }

  function handGrip(bones, offset, quatOut, posOut) {
    bones.LeftHand.getWorldQuaternion(quatOut);
    bones.LeftHand.getWorldPosition(posOut);
    posOut.add(s1.set(offset.x, offset.y, offset.z).applyQuaternion(quatOut));
    return posOut;
  }

  function calibrate(clip) {
    const bones = clip.bones;
    // First guess: a point on the ground in front of the stance. The grip offset is then
    // chosen so a rigid shaft in the lead hand meets that point at address and, as nearly
    // as the captured wrists allow, again at impact.
    sample(clip, clip.phases.address);
    apply(clip);
    const grip0 = handGrip(bones, { x: GRIP, y: 0, z: 0 }, qA, v1).clone();
    const hips = bones.Hips.getWorldPosition(v2);
    const chest = s2.set(grip0.x - hips.x, 0, grip0.z - hips.z);
    if (chest.lengthSq() < 1e-6) chest.set(1, 0, 0);
    chest.normalize();
    const lSh = bones.LeftArm.getWorldPosition(v3).clone();
    const rSh = bones.RightArm.getWorldPosition(v4).clone();
    const downLine = s3.set(lSh.x - rSh.x, 0, lSh.z - rSh.z).normalize();
    const dir0 = chest.multiplyScalar(0.38).add(downLine.multiplyScalar(0.1));
    dir0.y = -1;
    dir0.normalize();
    const reach = Math.max(0.05, grip0.y - 0.021);
    const ball = grip0.clone().addScaledVector(dir0, reach / Math.max(0.25, -dir0.y));
    let best = null;
    for (let x = -0.02; x <= 0.16; x += 0.03) {
      for (let y = -0.1; y <= 0.1; y += 0.04) {
        for (let z = -0.1; z <= 0.1; z += 0.04) {
          const off = { x, y, z };
          sample(clip, clip.phases.address);
          apply(clip);
          const gA = handGrip(bones, off, qA, v1).clone();
          const to = s2.subVectors(ball, gA);
          const len = to.length();
          if (len < 0.55 || len > 1.25) continue;
          const local = to.multiplyScalar(1 / len).applyQuaternion(qA.clone().invert());
          sample(clip, clip.phases.impact);
          apply(clip);
          const gI = handGrip(bones, off, qB, v2).clone();
          const head = gI.add(s3.copy(local).applyQuaternion(qB).multiplyScalar(len));
          const miss = head.distanceTo(ball);
          if (!best || miss < best.miss) best = { miss, off, len, local: local.clone() };
        }
      }
    }
    clip.gripOff = best ? best.off : { x: GRIP, y: 0, z: 0 };
    clip.clubLength = best ? best.len : reach;
    clip.shaftLocal.copy(best ? best.local : dir0);
    if (!best) {
      bones.LeftHand.getWorldQuaternion(qA);
      clip.shaftLocal.copy(dir0).applyQuaternion(qA.clone().invert());
    }
    sample(clip, clip.phases.address);
    apply(clip);
    const g = handGrip(bones, clip.gripOff, qA, v1);
    const sd = s2.copy(clip.shaftLocal).applyQuaternion(qA).normalize();
    clip.addressHead.copy(g).addScaledVector(sd, clip.clubLength);
    clip.impactMissM = best ? best.miss : null;
  }

  function measure(clip) {
    const P = clip.phases;
    poseAt(clip, 1);
    const lArm = wp('LeftArm', v1).clone();
    const rArm = wp('RightArm', v2).clone();
    const lHip = wp('LeftUpLeg', v3).clone();
    const rHip = wp('RightUpLeg', v4).clone();
    let xf = Math.abs(Math.atan2(lArm.x - rArm.x, lArm.z - rArm.z) - Math.atan2(lHip.x - rHip.x, lHip.z - rHip.z)) * 180 / Math.PI;
    if (xf > 180) xf = 360 - xf;
    const elbow = wp('LeftForeArm', v1).clone();
    const hand = wp('LeftHand', v2).clone();
    const straight = lArm.distanceTo(hand) / Math.max(1e-4, lArm.distanceTo(elbow) + elbow.distanceTo(hand));
    swing.bones.LeftHand.getWorldQuaternion(qA);
    const shaftDir = v3.copy(clip.shaftLocal).applyQuaternion(qA).normalize();
    const elev = Math.atan2(shaftDir.y, Math.hypot(shaftDir.x, shaftDir.z)) * 180 / Math.PI;
    const names = ['Hips', 'Spine1', 'LeftArm'];
    const prev = {};
    sample(clip, P.top - 8);
    apply(clip);
    for (const n of names) prev[n] = clip.quats[n].clone();
    let prevClub = shaftDir.clone();
    const peak = { Hips: [-1, 0], Spine1: [-1, 0], LeftArm: [-1, 0], club: [-1, 0] };
    for (let f = P.top - 7; f <= P.impact + 10; f++) {
      sample(clip, f);
      apply(clip);
      for (const n of names) {
        const w = quatAngle(prev[n], clip.quats[n]) / clip.bvh.frameTime;
        if (w > peak[n][0]) peak[n] = [w, f];
        prev[n].copy(clip.quats[n]);
      }
      swing.bones.LeftHand.getWorldQuaternion(qA);
      const cd = v4.copy(clip.shaftLocal).applyQuaternion(qA).normalize();
      const dang = Math.acos(Math.max(-1, Math.min(1, prevClub.dot(cd)))) / clip.bvh.frameTime;
      if (dang > peak.club[0]) peak.club = [dang, f];
      prevClub.copy(cd);
    }
    return {
      take: clip.name,
      xFactorDeg: +xf.toFixed(1),
      leadArmStraight: +straight.toFixed(3),
      shaftElevationAtTopDeg: +elev.toFixed(1),
      clubLengthM: +clip.clubLength.toFixed(3),
      impactMissM: clip.impactMissM == null ? null : +clip.impactMissM.toFixed(3),
      capturedBackswingS: +((P.top - P.address) * clip.bvh.frameTime).toFixed(3),
      capturedDownswingS: +((P.impact - P.top) * clip.bvh.frameTime).toFixed(3),
      sequence: Object.entries(peak).sort((a, b) => a[1][1] - b[1][1]).map(([joint, v]) => ({ joint, frame: v[1] })),
    };
  }

  const ready = Promise.all([loadText('64_06.bvh'), loadText('64_13.bvh')]).then(([a, b]) => {
    const bvhS = parseBVH(a);
    const bvhP = parseBVH(b);
    const built = buildBones(bvhS);
    rig.add(built.holder);
    // Scale the raw skeleton so the address crown is 1.80 m.
    sampleStub(built, bvhS, PHASE.swing.address, 1);
    built.holder.updateMatrixWorld(true);
    const head = built.bones.Head.getWorldPosition(v1).clone();
    const end = built.bones.Head.userData.end;
    if (end) {
      built.bones.Head.getWorldQuaternion(qA);
      head.add(v2.set(end[0], end[1], end[2]).applyQuaternion(qA));
    }
    const toe = Math.min(
      built.bones.LeftToeBase.getWorldPosition(v2).y,
      built.bones.RightToeBase.getWorldPosition(v3).y,
    );
    const scale = STATURE / Math.max(0.5, head.y - toe);
    built.holder.traverse((o) => { if (o.isBone) o.position.multiplyScalar(scale); });

    swing = prepare(bvhS, PHASE.swing, '64_06', built.bones, built.quats, scale);
    // Putt frames drive the same bones and quaternion slots are separate.
    const puttQuats = {};
    for (const j of bvhP.joints) puttQuats[j.name] = new THREE.Quaternion();
    putt = prepare(bvhP, PHASE.putt, '64_13', built.bones, puttQuats, scale);

    const radius = {
      Hips: 0.078, Spine: 0.07, Spine1: 0.082, Neck1: 0.046,
      LeftUpLeg: 0.058, RightUpLeg: 0.058, LeftLeg: 0.044, RightLeg: 0.044,
      LeftFoot: 0.032, RightFoot: 0.032, LeftArm: 0.042, RightArm: 0.042,
      LeftForeArm: 0.034, RightForeArm: 0.034,
    };
    for (const joint of bvhS.joints) {
      const bone = built.bones[joint.name];
      const child = joint.children[0];
      if (!child) continue;
      const seg = built.bones[child.name].position.length();
      if (seg < 0.03) continue;
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius[joint.name] || 0.03, (radius[joint.name] || 0.03) * 0.92, 1, 10), boneMat);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      rig.add(mesh);
      segments.push({ mesh, a: bone, b: built.bones[child.name] });
      const sph = new THREE.Mesh(new THREE.SphereGeometry((radius[joint.name] || 0.03) * 1.2, 12, 10), jointMat);
      sph.frustumCulled = false;
      sph.castShadow = true;
      rig.add(sph);
      spheres.push({ mesh: sph, bone });
    }
    const headR = Math.max(0.095, (built.bones.Head.userData.end ? Math.hypot(...built.bones.Head.userData.end) * scale : 0.12) * 0.5);
    const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headR, 18, 14), boneMat);
    headMesh.castShadow = true;
    rig.add(headMesh);
    spheres.push({ mesh: headMesh, bone: built.bones.Head });

    calibrate(swing);
    calibrate(putt);
    pose.metrics = { swing: measure(swing), putt: measure(putt) };
    pose.ready = true;
    anchor.visible = true;
  }).catch((err) => console.error(err));

  // Used only while the bones are still in file units, before prepare().
  function sampleStub(built, bvh, frame, scale) {
    const frames = bvh.frames[frame];
    rootPosition(bvh.root, frames, built.bones.Hips.position).multiplyScalar(scale);
    for (const joint of bvh.joints) {
      jointQuaternion(joint, frames, built.quats[joint.name], qT, AX);
      built.bones[joint.name].quaternion.copy(built.quats[joint.name]);
    }
  }

  return { mesh: anchor, update, pose, ready, club: shaft };
}
