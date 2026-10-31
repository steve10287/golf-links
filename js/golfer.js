// Original procedural golfer: one skinned mesh, smooth limbs, golf clothes.
// Not a real person and not a third-party character. See README.
import * as THREE from 'three';

const SKIN = [0.86, 0.66, 0.50];
const SKIN_SHADOW = [0.72, 0.52, 0.40];
const POLO = [0.93, 0.95, 0.97];
const POLO_TRIM = [0.10, 0.22, 0.42];
const PINK = [0.95, 0.28, 0.58];
const TROUSER = [0.78, 0.70, 0.56];
const BELT = [0.12, 0.10, 0.11];
const SHOE = [0.95, 0.95, 0.96];
const SOLE = [0.18, 0.16, 0.15];
const CAP = [0.96, 0.96, 0.98];
const HAIR = [0.16, 0.11, 0.09];
const GLOVE = [0.96, 0.96, 0.97];
const EYE = [0.12, 0.13, 0.16];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const _hand = new THREE.Vector3();
const _handQ = new THREE.Quaternion();
const _dir = new THREE.Vector3();
const _down = new THREE.Vector3(0, -1, 0);
const _desired = new THREE.Quaternion();
const _roll = new THREE.Quaternion();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();

function makeBones() {
  const b = {};
  const add = (name, parent, x, y, z) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(x, y, z);
    parent.add(bone);
    b[name] = bone;
    return bone;
  };
  const hips = new THREE.Bone();
  hips.name = 'hips';
  hips.position.set(0, 0.98, 0);
  b.hips = hips;
  add('spine', hips, 0, 0.12, 0);
  add('chest', b.spine, 0, 0.16, 0.012);
  add('neck', b.chest, 0, 0.20, 0.01);
  add('head', b.neck, 0, 0.10, 0.015);
  add('shoulderL', b.chest, 0.17, 0.13, 0.01);
  add('armL', b.shoulderL, 0.10, -0.03, 0);
  add('foreL', b.armL, 0.01, -0.28, 0);
  add('handL', b.foreL, 0, -0.25, 0);
  add('shoulderR', b.chest, -0.17, 0.13, 0.01);
  add('armR', b.shoulderR, -0.10, -0.03, 0);
  add('foreR', b.armR, -0.01, -0.28, 0);
  add('handR', b.foreR, 0, -0.25, 0);
  add('upLegL', hips, 0.10, -0.07, 0);
  add('legL', b.upLegL, 0, -0.43, 0);
  add('footL', b.legL, 0, -0.41, 0.02);
  add('upLegR', hips, -0.10, -0.07, 0);
  add('legR', b.upLegR, 0, -0.43, 0);
  add('footR', b.legR, 0, -0.41, 0.02);
  const list = [];
  hips.traverse((o) => { if (o.isBone) list.push(o); });
  b.list = list;
  b.index = Object.fromEntries(list.map((bone, i) => [bone.name, i]));
  return b;
}

function buildGeometry(bones) {
  bones.hips.updateMatrixWorld(true);
  const wp = (name) => new THREE.Vector3().setFromMatrixPosition(bones[name].matrixWorld);
  const pos = [], nrm = [], col = [], skinI = [], skinW = [], ind = [];

  function pushVert(p, n, c, i0, i1, w0) {
    pos.push(p.x, p.y, p.z);
    nrm.push(n.x, n.y, n.z);
    col.push(c[0], c[1], c[2]);
    skinI.push(i0, i1, 0, 0);
    const w = clamp(w0, 0, 1);
    skinW.push(w, 1 - w, 0, 0);
    return (pos.length / 3) - 1;
  }

  function addSegment(aName, bName, r0, r1, c0, c1, opts = {}) {
    const p0 = wp(aName), p1 = wp(bName);
    const i0 = bones.index[aName], i1 = bones.index[bName];
    const dir = p1.clone().sub(p0);
    const len = dir.length() || 1;
    dir.multiplyScalar(1 / len);
    const helper = Math.abs(dir.y) > 0.85 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const side = new THREE.Vector3().crossVectors(helper, dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, side).normalize();
    const sides = opts.sides || 16;
    const stacks = opts.stacks || 8;
    const base = pos.length / 3;
    for (let s = 0; s <= stacks; s++) {
      const t = s / stacks;
      const center = p0.clone().lerp(p1, t);
      const radius = lerp(r0, r1, t) * (opts.bulge ? 1 + opts.bulge * Math.sin(t * Math.PI) : 1);
      const color = [
        lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t),
      ];
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const n = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a)).normalize();
        pushVert(center.clone().addScaledVector(n, radius), n, color, i0, i1, 1 - t);
      }
    }
    const row = sides + 1;
    for (let s = 0; s < stacks; s++) {
      for (let k = 0; k < sides; k++) {
        const a = base + s * row + k;
        ind.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
      }
    }
  }

  function addSphere(name, center, rx, ry, rz, color, bias = 0) {
    const i0 = bones.index[name];
    const stacks = 12, sides = 16;
    const base = pos.length / 3;
    for (let s = 0; s <= stacks; s++) {
      const v = s / stacks;
      const phi = v * Math.PI;
      const sy = Math.cos(phi), rr = Math.sin(phi);
      for (let k = 0; k <= sides; k++) {
        const u = (k / sides) * Math.PI * 2;
        const n = new THREE.Vector3(Math.cos(u) * rr, sy, Math.sin(u) * rr).normalize();
        const p = new THREE.Vector3(center.x + n.x * rx, center.y + n.y * ry, center.z + n.z * rz);
        pushVert(p, n, color, i0, i0, 1);
      }
    }
    const row = sides + 1;
    for (let s = 0; s < stacks; s++) {
      for (let k = 0; k < sides; k++) {
        const a = base + s * row + k;
        ind.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
      }
    }
    if (bias) void bias;
  }

  // Torso: pelvis, shirt, chest. Overlapping segments read as one smooth body.
  addSegment('hips', 'spine', 0.145, 0.132, TROUSER, POLO, { stacks: 6, bulge: 0.06 });
  addSegment('spine', 'chest', 0.145, 0.175, POLO, POLO, { stacks: 6, bulge: 0.08 });
  addSegment('chest', 'neck', 0.16, 0.075, POLO, POLO_TRIM, { stacks: 5 });
  addSegment('neck', 'head', 0.055, 0.07, SKIN_SHADOW, SKIN, { stacks: 4, sides: 12 });

  // Collar ring
  {
    const c = wp('neck');
    addSphere('neck', c.clone().add(new THREE.Vector3(0, -0.01, 0.01)), 0.085, 0.035, 0.085, POLO_TRIM);
  }

  // Head
  const headP = wp('head');
  addSphere('head', headP.clone().add(new THREE.Vector3(0, 0.04, 0.01)), 0.105, 0.125, 0.112, SKIN);
  // Ears
  addSphere('head', headP.clone().add(new THREE.Vector3(0.10, 0.02, 0)), 0.022, 0.034, 0.016, SKIN_SHADOW);
  addSphere('head', headP.clone().add(new THREE.Vector3(-0.10, 0.02, 0)), 0.022, 0.034, 0.016, SKIN_SHADOW);
  // Nose and eyes — generic, not a portrait
  addSphere('head', headP.clone().add(new THREE.Vector3(0, 0.015, 0.10)), 0.018, 0.022, 0.028, SKIN_SHADOW);
  addSphere('head', headP.clone().add(new THREE.Vector3(0.038, 0.035, 0.09)), 0.014, 0.012, 0.01, EYE);
  addSphere('head', headP.clone().add(new THREE.Vector3(-0.038, 0.035, 0.09)), 0.014, 0.012, 0.01, EYE);
  // Hair at the sides and nape, under the cap
  addSphere('head', headP.clone().add(new THREE.Vector3(0, 0.02, -0.04)), 0.108, 0.09, 0.09, HAIR);
  // Cap crown
  addSphere('head', headP.clone().add(new THREE.Vector3(0, 0.09, -0.005)), 0.118, 0.09, 0.12, CAP);
  // Brim
  addSphere('head', headP.clone().add(new THREE.Vector3(0, 0.045, 0.12)), 0.09, 0.012, 0.07, CAP);

  // Pink side stripe on the shirt, thin
  addSphere('chest', wp('chest').clone().add(new THREE.Vector3(0.12, -0.02, 0.06)), 0.02, 0.10, 0.02, PINK);

  // Arms. Shirt sleeve on the upper third, skin below, glove on the lead hand.
  addSegment('shoulderL', 'armL', 0.07, 0.055, POLO, POLO, { stacks: 4, sides: 12 });
  addSegment('armL', 'foreL', 0.062, 0.05, POLO, SKIN, { stacks: 8, bulge: 0.05 });
  addSegment('foreL', 'handL', 0.048, 0.038, SKIN, SKIN, { stacks: 7 });
  addSphere('foreL', wp('foreL'), 0.052, 0.052, 0.052, SKIN);
  addSegment('shoulderR', 'armR', 0.07, 0.055, POLO, POLO, { stacks: 4, sides: 12 });
  addSegment('armR', 'foreR', 0.062, 0.05, POLO, SKIN, { stacks: 8, bulge: 0.05 });
  addSegment('foreR', 'handR', 0.048, 0.038, SKIN, SKIN, { stacks: 7 });
  addSphere('foreR', wp('foreR'), 0.052, 0.052, 0.052, SKIN);
  // Hands
  addSphere('handL', wp('handL').clone().add(new THREE.Vector3(0, -0.04, 0.01)), 0.04, 0.055, 0.028, GLOVE);
  addSphere('handR', wp('handR').clone().add(new THREE.Vector3(0, -0.04, 0.01)), 0.038, 0.05, 0.026, SKIN);

  // Legs, belt, shoes
  addSphere('hips', wp('hips').clone().add(new THREE.Vector3(0, 0.02, 0)), 0.155, 0.06, 0.12, BELT);
  addSegment('upLegL', 'legL', 0.09, 0.07, TROUSER, TROUSER, { stacks: 8, bulge: 0.08 });
  addSegment('legL', 'footL', 0.062, 0.048, TROUSER, TROUSER, { stacks: 7 });
  addSphere('legL', wp('legL'), 0.07, 0.065, 0.07, TROUSER);
  addSegment('upLegR', 'legR', 0.09, 0.07, TROUSER, TROUSER, { stacks: 8, bulge: 0.08 });
  addSegment('legR', 'footR', 0.062, 0.048, TROUSER, TROUSER, { stacks: 7 });
  addSphere('legR', wp('legR'), 0.07, 0.065, 0.07, TROUSER);
  // Shoes: sole + upper, point forward (+Z)
  for (const foot of ['footL', 'footR']) {
    const f = wp(foot);
    addSphere(foot, f.clone().add(new THREE.Vector3(0, -0.02, 0.06)), 0.055, 0.04, 0.11, SHOE);
    addSphere(foot, f.clone().add(new THREE.Vector3(0, -0.045, 0.06)), 0.058, 0.02, 0.115, SOLE);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinI, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinW, 4));
  geo.setIndex(ind);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.0, 0), 2.6);
  return geo;
}

function makeClub() {
  const g = new THREE.Group();
  g.name = 'club';
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.85, roughness: 0.32 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.9, metalness: 0 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd5d8df, metalness: 0.92, roughness: 0.22 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0075, 0.92, 10), shaftMat);
  shaft.position.y = -0.50;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.27, 10), gripMat);
  grip.position.y = -0.12;
  const hosel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.07, 8), steel);
  hosel.position.y = -0.96;
  hosel.name = 'hosel';
  // Iron blade: a thin swept head, not a cube
  const ironShape = new THREE.Shape();
  ironShape.moveTo(0, 0);
  ironShape.lineTo(0.018, -0.01);
  ironShape.lineTo(0.055, -0.012);
  ironShape.lineTo(0.07, 0.01);
  ironShape.lineTo(0.045, 0.055);
  ironShape.lineTo(0.01, 0.05);
  ironShape.lineTo(0, 0.02);
  const ironGeo = new THREE.ExtrudeGeometry(ironShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, steps: 1 });
  ironGeo.translate(-0.01, -0.02, -0.006);
  const iron = new THREE.Mesh(ironGeo, steel);
  iron.position.set(0.01, -0.98, 0);
  iron.name = 'ironHead';
  const wedge = iron.clone();
  wedge.scale.set(1.15, 0.92, 1.35);
  wedge.name = 'wedgeHead';
  const putterGeo = new THREE.BoxGeometry(0.11, 0.028, 0.03);
  const putter = new THREE.Mesh(putterGeo, steel);
  putter.position.set(0.02, -0.90, 0);
  putter.name = 'putterHead';
  g.add(shaft, grip, hosel, iron, wedge, putter);
  g.userData.parts = { shaft, iron, wedge, putter, hosel };
  return g;
}

export function createGolfer() {
  const bones = makeBones();
  const geo = buildGeometry(bones);
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0.02,
    transparent: true,
    opacity: 1,
  });
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.name = 'golfer';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.add(bones.hips);
  const skeleton = new THREE.Skeleton(bones.list);
  mesh.updateMatrixWorld(true);
  mesh.bind(skeleton);

  const club = makeClub();
  bones.handL.add(club);

  const pose = {
    s: 0, power: 0, path: 0, putt: false, club: '8i',
    walking: false, walkPhase: 0, opacity: 0,
  };

  function setClub(id) {
    if (pose.club === id) return;
    pose.club = id;
    const parts = club.userData.parts;
    const putter = id === 'PT';
    const wedge = id === 'PW' || id === 'SW';
    parts.iron.visible = !putter && !wedge;
    parts.wedge.visible = wedge;
    parts.putter.visible = putter;
    const len = putter ? 0.84 : wedge ? 0.90 : 0.97;
    parts.shaft.scale.y = len / 0.92;
    parts.shaft.position.y = -0.08 - (len / 2);
    parts.hosel.position.y = -0.08 - len;
    parts.iron.position.y = -0.06 - len;
    parts.wedge.position.y = -0.06 - len;
    parts.putter.position.y = -0.05 - len * 0.96;
  }

  function applySwing(s, power, path, putt, time) {
    const over = clamp((Math.min(power, s) - 1) / 0.22, 0, 1);
    const B = bones;
    // Neutralise then pose. Rotations are offsets from the bind pose.
    for (const bone of bones.list) bone.rotation.set(0, 0, 0);

    let shoulderY, hipY, spineX, wrist, knee, elbow, sideBend, finishStand;
    if (s <= 1.25) {
      const t = smooth(clamp(s / 1, 0, 1));
      const turn = putt ? 0.42 : 1.62;
      shoulderY = -turn * t - (putt ? 0 : 0.28 * over);
      hipY = shoulderY * (putt ? 0.06 : 0.40);
      spineX = lerp(putt ? 0.28 : 0.58, putt ? 0.22 : 0.42, t);
      // Wrist cock arrives in the second half of the takeaway. One-piece early.
      const cockT = smooth(clamp((s - 0.28) / 0.72, 0, 1));
      wrist = (putt ? 0.18 : 1.05) * cockT + (putt ? 0 : 0.4 * over);
      knee = lerp(0.28, putt ? 0.22 : 0.34, t);
      elbow = (putt ? 0.05 : 0.85) * cockT + 0.25 * over;
      sideBend = lerp(putt ? -0.04 : -0.10, putt ? -0.02 : -0.16, t);
      finishStand = 0;
    } else if (s <= 2) {
      const t = clamp((s - 1.25) / 0.75, 0, 1);
      const e = smooth(t);
      // Hips lead, shoulders follow, wrists stay cocked until late (lag).
      const hipT = smooth(clamp(t / 0.72, 0, 1));
      const shT = smooth(clamp((t - 0.08) / 0.92, 0, 1));
      const release = smooth(clamp((t - 0.62) / 0.38, 0, 1));
      const topSh = putt ? -0.42 : -1.62;
      const topHip = topSh * (putt ? 0.06 : 0.40);
      shoulderY = lerp(topSh, putt ? 0.05 : 0.25, shT);
      hipY = lerp(topHip, putt ? 0.02 : 0.55, hipT);
      spineX = lerp(putt ? 0.22 : 0.42, putt ? 0.26 : 0.55, e);
      wrist = lerp(putt ? 0.18 : 1.05, putt ? 0.02 : 0.08, release);
      knee = lerp(putt ? 0.22 : 0.34, 0.18, e);
      elbow = lerp(putt ? 0.05 : 0.85, 0.12, release);
      sideBend = lerp(-0.14, 0.02, e);
      finishStand = 0;
    } else {
      const t = smooth(clamp((s - 2) / 1, 0, 1));
      shoulderY = lerp(putt ? 0.05 : 0.25, putt ? 0.28 : 1.45, t);
      hipY = lerp(putt ? 0.02 : 0.55, putt ? 0.08 : 0.85, t);
      finishStand = t;
      spineX = lerp(putt ? 0.26 : 0.55, putt ? 0.20 : 0.28, t);
      wrist = lerp(putt ? 0.02 : 0.08, putt ? 0.0 : -0.35, t);
      knee = lerp(0.18, putt ? 0.16 : 0.08, t);
      elbow = lerp(0.12, putt ? 0.02 : 0.15, t);
      sideBend = lerp(0.02, 0.08, t);
    }

    // Open (positive path) holds the face open and shortens the wrap.
    // Closed (negative) finishes more around the body.
    const wrap = clamp(path, -1, 1);
    if (s > 1.4) {
      const k = clamp((s - 1.4) / 1.2, 0, 1);
      shoulderY += wrap * 0.38 * k;
      wrist += wrap * 0.55 * k;
      hipY += wrap * 0.12 * k;
    }

    B.hips.rotation.y = hipY;
    B.hips.rotation.x = -knee * 0.15;
    B.upLegL.rotation.x = -knee;
    B.upLegR.rotation.x = -knee * 0.85;
    B.legL.rotation.x = knee * 1.15;
    B.legR.rotation.x = knee;
    // Weight to the trail side on the way back, onto the lead side through impact.
    const weight = s < 1.25 ? clamp(s, 0, 1) : clamp(1 - (s - 1.25) * 0.8, -0.4, 1);
    B.hips.position.x = 0.02 * weight;
    B.spine.rotation.x = spineX;
    B.spine.rotation.y = shoulderY * 0.25;
    B.spine.rotation.z = sideBend;
    B.chest.rotation.y = shoulderY * 0.75;
    B.chest.rotation.z = sideBend * 0.4;
    B.chest.rotation.x = -finishStand * (putt ? 0.02 : 0.12);
    // Arms are placed by IK onto the grip. A little wrist set keeps the glove on the handle.
    B.handL.rotation.z = 0.1 + wrap * 0.2 * clamp((s - 1.5) / 1.2, 0, 1);
    B.handR.rotation.z = -0.15;
    void wrist; void elbow;

    // Quiet lower body on a putt: undo hip turn and knee sway.
    if (putt) {
      B.hips.rotation.y *= 0.25;
      B.hips.position.x *= 0.2;
      B.upLegL.rotation.x = -0.16;
      B.upLegR.rotation.x = -0.16;
      B.legL.rotation.x = 0.2;
      B.legR.rotation.x = 0.2;
    }

    // Idle breathing and a small waggle only at address.
    if (s < 0.04 && !pose.walking) {
      const breathe = Math.sin(time * 1.5) * 0.012;
      B.chest.rotation.x += breathe;
      B.spine.rotation.x += breathe * 0.6;
      const wag = Math.sin(time * 2.1) * 0.035;
      B.handL.rotation.z += wag;
      B.handR.rotation.z += wag * 0.8;
      B.chest.rotation.y += wag * 0.15;
    }

    // Shaft is aimed after the skeleton is posed. See aimClub().
    club.userData.swing = { s, power, path, putt };
  }

  const _grip = new THREE.Vector3();
  const _headT = new THREE.Vector3();
  const _ikS = new THREE.Vector3();
  const _ikAxis = new THREE.Vector3();
  const _ikPole = new THREE.Vector3();
  const _ikN = new THREE.Vector3();
  const _ikBend = new THREE.Vector3();
  const _ikElbow = new THREE.Vector3();
  const _ikDir = new THREE.Vector3();
  const _localDown = new THREE.Vector3(0, -1, 0);

  function swingPoints(info, ball, aimYaw) {
    const s = info.s, power = info.power, path = info.path, putt = info.putt;
    const dx = Math.sin(aimYaw), dz = -Math.cos(aimYaw);
    const rx = -dz, rz = dx;
    const by = ball.y;
    const scale = putt ? 0.22 : 1;
    // back (along -aim), side (trail +), up. Clubhead keys, then grip keys.
    const keys = putt
      ? [
        { g: [0.02, 0.28, 0.62], h: [0.04, 0.06, 0.02] },
        { g: [-0.16, 0.30, 0.66], h: [-0.28, 0.10, 0.04] },
        { g: [0.06, 0.22, 0.60], h: [0.10, 0.04, 0.0] },
      ]
      : [
        { g: [0.04, 0.20, 0.68], h: [-0.02, 0.04, 0.02] },         // address, clubhead at the ball
        { g: [0.42, 0.38, 1.52], h: [1.45, 0.18, 1.46] },         // top, shaft parallel and pointing back
        { g: [0.55, 0.22, 1.46], h: [1.75, 0.05, 1.02] },         // overswing, longer and dropped past parallel
        { g: [-0.06, 0.12, 0.66], h: [-0.02, 0.03, 0.02] },       // impact
        { g: [-0.12, -0.06, 1.64], h: [-0.18, -0.28 - path * 0.4, 2.08] }, // high-hands finish
      ];
    const at = (k, which) => {
      const v = which === 'g' ? k.g : k.h;
      const back = v[0] * (which === 'h' ? 1 : scale);
      const side = v[1];
      const up = which === 'g' ? v[2] : v[2];
      return {
        x: ball.x - dx * back + rx * side,
        y: by + (which === 'h' && putt ? 0.04 : up * (putt && which === 'g' ? 1 : 1)),
        z: ball.z - dz * back + rz * side,
      };
    };
    // Map s onto the key index.
    let i0 = 0, i1 = 1, u = 0;
    if (putt) {
      if (s <= 1) { i0 = 0; i1 = 1; u = smooth(s); }
      else { i0 = 1; i1 = 2; u = smooth(clamp((s - 1) / 1.2, 0, 1)); }
    } else if (s <= 1) { i0 = 0; i1 = 1; u = smooth(s); }
    else if (s <= 1.28) { i0 = 1; i1 = power > 1.02 ? 2 : 1; u = (s - 1) / 0.28; }
    else if (s <= 2) { i0 = power > 1.02 ? 2 : 1; i1 = 3; u = smooth((s - 1.28) / 0.72); u = u * u; }
    else { i0 = 3; i1 = 4; u = smooth(clamp((s - 2) / 1, 0, 1)); }
    const A = at(keys[i0], 'g'), B = at(keys[i1], 'g');
    const C = at(keys[i0], 'h'), D = at(keys[i1], 'h');
    _grip.set(lerp(A.x, B.x, u), lerp(A.y, B.y, u), lerp(A.z, B.z, u));
    _headT.set(lerp(C.x, D.x, u), lerp(C.y, D.y, u), lerp(C.z, D.z, u));
    if (!putt && s > 2) {
      _headT.x += rx * path * 0.3 * u;
      _headT.z += rz * path * 0.3 * u;
    }
  }

  function alignBone(bone, worldDir) {
    bone.parent.updateMatrixWorld(true);
    bone.parent.getWorldQuaternion(_handQ);
    _desired.setFromUnitVectors(_localDown, worldDir);
    bone.quaternion.copy(_handQ).invert().multiply(_desired);
  }

  function ikArm(arm, fore, target, pole, aLen, bLen) {
    arm.parent.updateMatrixWorld(true);
    _ikS.setFromMatrixPosition(arm.matrixWorld);
    _ikAxis.subVectors(target, _ikS);
    let dist = _ikAxis.length();
    if (dist < 1e-4) return;
    const maxD = aLen + bLen - 0.015;
    const minD = Math.abs(aLen - bLen) + 0.015;
    dist = clamp(dist, minD, maxD);
    _ikAxis.subVectors(target, _ikS).normalize();
    const cosS = clamp((aLen * aLen + dist * dist - bLen * bLen) / (2 * aLen * dist), -1, 1);
    const shoulderAng = Math.acos(cosS);
    _ikPole.subVectors(pole, _ikS);
    _ikN.crossVectors(_ikAxis, _ikPole);
    if (_ikN.lengthSq() < 1e-8) _ikN.set(0, 1, 0);
    _ikN.normalize();
    _ikBend.crossVectors(_ikN, _ikAxis).normalize();
    _ikElbow.copy(_ikS).addScaledVector(_ikAxis, Math.cos(shoulderAng) * aLen).addScaledVector(_ikBend, Math.sin(shoulderAng) * aLen);
    _ikDir.subVectors(_ikElbow, _ikS).normalize();
    alignBone(arm, _ikDir);
    arm.updateMatrixWorld(true);
    _ikDir.subVectors(target, _ikElbow).normalize();
    alignBone(fore, _ikDir);
    fore.updateMatrixWorld(true);
  }

  function poseArms(ball, aimYaw) {
    mesh.updateMatrixWorld(true);
    const info = club.userData.swing || { s: 0, power: 0, path: 0, putt: false };
    swingPoints(info, ball, aimYaw);
    const dx = Math.sin(aimYaw), dz = -Math.cos(aimYaw);
    const rx = -dz, rz = dx;
    // Elbows fold down. Trail elbow a little behind, lead elbow a little toward the target.
    const poleR = _a.set(_grip.x - dx * 0.25 + rx * 0.15, _grip.y - 0.55, _grip.z - dz * 0.25 + rz * 0.15);
    const poleL = _b.set(_grip.x + dx * 0.1 - rx * 0.2, _grip.y - 0.45, _grip.z + dz * 0.1 - rz * 0.2);
    const gripR = _c.set(_grip.x + rx * 0.03, _grip.y, _grip.z + rz * 0.03);
    ikArm(bones.armL, bones.foreL, _grip, poleL, 0.28, 0.25);
    ikArm(bones.armR, bones.foreR, gripR, poleR, 0.28, 0.25);
    bones.handL.updateMatrixWorld(true);
  }

  function aimClub(ball, aimYaw) {
    const info = club.userData.swing || { s: 0, power: 0, path: 0, putt: false };
    poseArms(ball, aimYaw);
    const putt = info.putt;
    const path = info.path;
    const s = info.s;
    const dest = _headT;
    bones.handL.getWorldPosition(_hand);
    const reach = Math.max(0.35, _hand.distanceTo(dest));
    const len = clamp(reach - 0.04, putt ? 0.55 : 0.62, putt ? 0.92 : 1.18);
    const parts = club.userData.parts;
    parts.shaft.scale.y = len / 0.92;
    parts.shaft.position.y = -len * 0.5;
    parts.hosel.position.y = -len + 0.03;
    parts.iron.position.y = -len + 0.015;
    parts.wedge.position.y = -len + 0.015;
    parts.putter.position.y = -len + 0.02;
    _dir.copy(dest).sub(_hand);
    if (_dir.lengthSq() < 1e-6) return;
    _dir.normalize();
    _desired.setFromUnitVectors(_down, _dir);
    bones.handL.getWorldQuaternion(_handQ);
    club.quaternion.copy(_handQ).invert().multiply(_desired);
    const face = path * clamp((s - 1.15) / 1.4, 0, 1);
    _roll.setFromAxisAngle(_down, face * 0.9);
    club.quaternion.multiply(_roll);
  }

  function applyWalk(dt) {
    pose.walkPhase += dt * 7.5;
    const w = pose.walkPhase;
    const B = bones;
    for (const bone of bones.list) bone.rotation.set(0, 0, 0);
    B.upLegL.rotation.x = Math.sin(w) * 0.65;
    B.upLegR.rotation.x = Math.sin(w + Math.PI) * 0.65;
    B.legL.rotation.x = Math.max(0, Math.sin(w + 0.5)) * 0.7;
    B.legR.rotation.x = Math.max(0, Math.sin(w + Math.PI + 0.5)) * 0.7;
    B.armL.rotation.x = Math.sin(w + Math.PI) * 0.45;
    B.armR.rotation.x = Math.sin(w) * 0.45;
    B.spine.rotation.y = Math.sin(w) * 0.06;
    B.chest.rotation.x = 0.08;
    B.hips.position.x = 0;
    club.rotation.set(0.9, 0, 0.2);
  }

  function stanceOf(ball, aimYaw, putt) {
    const dx = Math.sin(aimYaw), dz = -Math.cos(aimYaw);
    const rx = -dz, rz = dx;
    const side = putt ? 0.36 : 0.52;
    const back = putt ? 0.02 : 0.04;
    const chestX = dz, chestZ = -dx; // face the ball (opposite the trail-side offset)
    return {
      x: ball.x + rx * side - dx * back,
      z: ball.z + rz * side - dz * back,
      yaw: Math.atan2(chestX, chestZ),
    };
  }

  function update(dt, inp) {
    const ball = inp.ball;
    const aimYaw = inp.aimYaw || 0;
    const putt = !!inp.putt;
    const phase = inp.phase;
    const st = stanceOf(ball, aimYaw, putt);
    const overhead = phase === 'overhead' || phase === 'intro';
    const gx = mesh.position.x, gz = mesh.position.z;
    let dist = Math.hypot(st.x - gx, st.z - gz);
    if (!Number.isFinite(gx)) dist = 99;

    let hide = overhead;
    if (!mesh.userData.placed) {
      mesh.position.set(st.x, 0, st.z);
      mesh.userData.placed = true;
      dist = 0;
      pose.opacity = phase === 'intro' ? 0 : 1;
    }

    if (dist > 22 || (hide && dist > 0.4)) {
      pose.opacity = Math.max(0, pose.opacity - dt * 4);
      if (pose.opacity <= 0.02) {
        mesh.position.set(st.x, inp.heightAt(st.x, st.z), st.z);
        pose.walking = false;
      }
    } else if (dist > 0.12 && !hide) {
      pose.walking = true;
      pose.opacity = Math.min(1, pose.opacity + dt * 3);
      const step = Math.min(dist, dt * Math.max(1.6, dist * 1.8));
      const vx = (st.x - mesh.position.x) / dist;
      const vz = (st.z - mesh.position.z) / dist;
      mesh.position.x += vx * step;
      mesh.position.z += vz * step;
      mesh.position.y = inp.heightAt(mesh.position.x, mesh.position.z);
    } else {
      pose.walking = false;
      if (!hide) pose.opacity = Math.min(1, pose.opacity + dt * 3);
      mesh.position.x = st.x;
      mesh.position.z = st.z;
      mesh.position.y = inp.heightAt(st.x, st.z);
    }
    if (hide) pose.opacity = Math.max(0, pose.opacity - dt * 3.2);

    mesh.rotation.y = st.yaw;
    mesh.visible = pose.opacity > 0.03;
    mat.opacity = pose.opacity;
    mat.depthWrite = pose.opacity > 0.85;

    setClub(inp.clubId || '8i');
    if (pose.walking && pose.opacity > 0.2 && !hide) applyWalk(dt);
    else applySwing(inp.s || 0, inp.power || 0, inp.path || 0, putt, inp.time || 0);
    if (!(pose.walking && pose.opacity > 0.2 && !hide)) aimClub(ball, aimYaw);

    pose.s = inp.s || 0;
    pose.putt = putt;
  }

  return { mesh, club, bones, update, pose };
}
