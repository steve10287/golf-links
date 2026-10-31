import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as C from './course.js';
import * as P from './physics.js';
import { buildWorld } from './world.js';
import { DIFF, gradeSwing, dispersionYards, pathError, transitionRush } from './swing.js';
import { createGolfer } from './golfer.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const YD = 1.0936133, FT = 3.2808;
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
const params = new URLSearchParams(location.search);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') || params.has('pose') });
let pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.75 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.62;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 12000);

const W = buildWorld(renderer, scene, { mobile: isMobile });
const course = W.course;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.32, 0.6, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
let useBloom = true;

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = 46;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  fx.width = innerWidth * devicePixelRatio; fx.height = innerHeight * devicePixelRatio;
}
const fx = $('fx'), fxc = fx.getContext('2d');
addEventListener('resize', onResize); onResize();

const ball = new THREE.Mesh(new THREE.SphereGeometry(P.BALL_R, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2 }));
ball.castShadow = false; scene.add(ball);
const blobTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
scene.add(blob);

const golfer = createGolfer();
scene.add(golfer.mesh);
const audio = createAudio();

const MAXT = 3000;
const trPos = new Float32Array(MAXT * 2 * 3), trCol = new Float32Array(MAXT * 2 * 3);
const trGeo = new THREE.BufferGeometry();
trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3));
{ const ii = []; for (let i = 0; i < MAXT - 1; i++) { const a = i * 2; ii.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trGeo.setIndex(ii); }
const tracer = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
tracer.frustumCulled = false; scene.add(tracer);
let tracerPts = [];

const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 3.2, 3.6), transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
const haloMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.4, 1.6), transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
const targetRing = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 64).rotateX(-Math.PI / 2), ringMat);
const targetHalo = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.55, 64).rotateX(-Math.PI / 2), haloMat);
const targetDot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24).rotateX(-Math.PI / 2), ringMat);
targetRing.add(targetDot); targetRing.add(targetHalo); scene.add(targetRing);
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 6, 8), new THREE.MeshBasicMaterial({ color: 0x9fffff, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false }));
scene.add(beacon);

const windMat = new THREE.MeshBasicMaterial({ color: 0x3ff3ff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
const windMesh = new THREE.Group();
const windShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 10, 8), windMat);
windShaft.rotation.x = Math.PI / 2; windShaft.position.z = 5;
const windHead = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.2, 10), windMat);
windHead.rotation.x = Math.PI / 2; windHead.position.z = 11.2;
windMesh.add(windShaft, windHead); scene.add(windMesh);

const aimDotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.4, 3.5), transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
const aimDots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.07, 10).rotateX(-Math.PI / 2), aimDotMat, 48);
aimDots.frustumCulled = false; scene.add(aimDots);
const arcMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.35), transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false });
const arcDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 8, 6), arcMat, 32);
arcDots.frustumCulled = false; scene.add(arcDots);

const chevGeo = new THREE.BufferGeometry();
chevGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.16, 0, 0.1, 0, 0, -0.12, 0.16, 0, 0.1, 0.16, 0, 0.18, 0, 0, -0.04, -0.16, 0, 0.18], 3));
chevGeo.setIndex([0, 1, 4, 0, 4, 5, 1, 2, 3, 1, 3, 4]);
const chevPts = [];
for (let x = C.PIN.x - 20; x <= C.PIN.x + 20; x += 1.7) for (let z = C.PIN.z - 22; z <= C.PIN.z + 22; z += 1.7) {
  if (C.sdGreen(x, z) < -0.4) {
    const n = course.normalAt(x, z); const s = Math.hypot(n.x, n.z);
    chevPts.push({ x, z, dx: n.x / (s || 1), dz: n.z / (s || 1), slope: s / n.y });
  }
}
const chev = new THREE.InstancedMesh(chevGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), chevPts.length);
chev.frustumCulled = false; chev.visible = false; scene.add(chev);
chevPts.forEach((c, i) => { const k = Math.min(1, c.slope / 0.035); chev.setColorAt(i, new THREE.Color().setHSL(0.55 - 0.55 * k, 1, 0.62).multiplyScalar(1.15)); });

const splashN = 140;
const splashGeo = new THREE.BufferGeometry(); splashGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(splashN * 3), 3));
const splash = new THREE.Points(splashGeo, new THREE.PointsMaterial({ color: 0xe8f6ff, size: 0.18, transparent: true, opacity: 0.9, depthWrite: false }));
splash.visible = false; scene.add(splash);
let splashVel = [], splashT = 0;
function doSplash(x, z) {
  const a = splashGeo.attributes.position; splashVel = [];
  for (let i = 0; i < splashN; i++) { a.setXYZ(i, x, C.WATER_LEVEL, z); const ang = Math.random() * 6.28, r = Math.random() * 2.2; splashVel.push([Math.cos(ang) * r, 3 + Math.random() * 5, Math.sin(ang) * r]); }
  a.needsUpdate = true; splash.visible = true; splashT = 0;
}

const S = {
  phase: 'intro', strokes: 0, clubIdx: 3, aimYaw: 0, ball: { x: 0, y: 0, z: 0 }, lie: C.SURF.TEE,
  wind: { x: 0, z: 0, mph: 0, ang: 0 }, shot: null, playT: 0, prev: null, stopT: 0,
  difficulty: 'pro', holed: false, target: null, targetPower: 1, strike: null, streak: 0, goldTracer: false,
  vis: { s: 0, power: 0, path: 0, releasing: false, releaseRate: 1.6, holding: false, holdT: 0 },
  hitStop: 0, shake: 0,
};
const clubs = P.CLUBS;
let dragTarget = null;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();
const camUp = new THREE.Vector3(0, 1, 0);
const camUpT = new THREE.Vector3(0, 1, 0);

function rollWind() {
  const mph = 1 + Math.random() * 7; const ang = Math.random() * Math.PI * 2;
  const ms = mph * 0.44704;
  S.wind = { x: Math.sin(ang) * ms, z: -Math.cos(ang) * ms, mph, ang };
  $('windVal').textContent = mph.toFixed(0) + ' mph';
}

const flatCourse = { heightAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }), surfaceAt: () => C.SURF.FAIRWAY };
const nominal = clubs.map((c) => {
  if (c.putter) return 0;
  const r = P.simulate(flatCourse, { x: 0, y: P.BALL_R, z: 0 }, P.launchFromSwing(c, 1, 0, 0, C.SURF.TEE), { x: 0, z: 0 });
  return Math.hypot(r.carry.x, r.carry.z);
});

function distToPin(p = S.ball) { return Math.hypot(C.PIN.x - p.x, C.PIN.z - p.z); }
function yawToPin(p = S.ball) { return Math.atan2(C.PIN.x - p.x, -(C.PIN.z - p.z)); }
function isPutting() { return clubs[S.clubIdx].putter; }
function fmtDist(m) { return m < 20 ? (m * FT).toFixed(0) + ' ft' : (m * YD).toFixed(0) + ' yds'; }
function puttScale() { return Math.max(4, Math.min(30, distToPin() * 1.5)); }
function puttDistNeeded() { return distToPin(); }
const PUTT_FR = 0.058 * 9.81;

function placeBall(x, z) {
  S.ball = { x, y: course.heightAt(x, z) + P.BALL_R, z };
  S.lie = course.surfaceAt(x, z);
  if (S.lie === C.SURF.WATER) S.lie = C.SURF.ROUGH;
}

function autoClub() {
  const d = distToPin();
  if (S.lie === C.SURF.GREEN || (S.lie === C.SURF.FRINGE && d < 14)) { S.clubIdx = clubs.length - 1; return; }
  let best = clubs.length - 2;
  for (let i = clubs.length - 2; i >= 0; i--) { if (nominal[i] >= d * 0.97) { best = i; break; } if (i === 0) best = 0; }
  S.clubIdx = best;
}

function clubForDistance(dist) {
  let best = clubs.length - 2, bestPen = 1e9;
  for (let i = 0; i < clubs.length - 1; i++) {
    const carry = nominal[i];
    if (carry < 1) continue;
    const p = dist / carry;
    const pen = p > 1.001 ? 10 + (p - 1) * 10 : (p < 0.5 ? (0.5 - p) * 3 : Math.abs(0.9 - p));
    if (pen < bestPen) { bestPen = pen; best = i; }
  }
  const carry = nominal[best] || 1;
  const power = clamp(dist / carry, 0.32, 1);
  return { idx: best, power, dist: power * carry };
}

function setTargetPoint(x, z) {
  let dx = x - S.ball.x, dz = z - S.ball.z;
  let dist = Math.hypot(dx, dz);
  if (dist < 0.4) return;
  dist = Math.min(dist, nominal[0]);
  const sug = clubForDistance(dist);
  S.clubIdx = sug.idx;
  dist = clamp(sug.dist, nominal[S.clubIdx] * 0.32, nominal[S.clubIdx]);
  const yaw = Math.atan2(dx, -dz);
  S.aimYaw = yaw;
  S.target = { x: S.ball.x + Math.sin(yaw) * dist, z: S.ball.z - Math.cos(yaw) * dist };
  S.targetPower = dist / nominal[S.clubIdx];
  S.strike = null;
}

function reclampTargetToClub() {
  if (!S.target || isPutting()) return;
  const dx = S.target.x - S.ball.x, dz = S.target.z - S.ball.z;
  let dist = Math.hypot(dx, dz);
  const yaw = Math.atan2(dx, -dz);
  dist = clamp(dist, nominal[S.clubIdx] * 0.32, nominal[S.clubIdx]);
  S.aimYaw = yaw;
  S.target = { x: S.ball.x + Math.sin(yaw) * dist, z: S.ball.z - Math.cos(yaw) * dist };
  S.targetPower = dist / nominal[S.clubIdx];
  S.strike = null;
}

function placeInitialTarget() {
  const dPin = distToPin();
  const reach = nominal[0];
  let dist = Math.min(dPin, reach);
  const sug = clubForDistance(dist);
  S.clubIdx = sug.idx;
  dist = clamp(Math.min(dPin, nominal[S.clubIdx]), nominal[S.clubIdx] * 0.32, nominal[S.clubIdx]);
  const yaw = yawToPin();
  S.aimYaw = yaw;
  S.target = { x: S.ball.x + Math.sin(yaw) * dist, z: S.ball.z - Math.cos(yaw) * dist };
  S.targetPower = dist / nominal[S.clubIdx];
  S.strike = null;
}

function newShotSetup() {
  autoClub();
  S.strike = null;
  S.vis.releasing = false;
  S.vis.holding = false;
  S.vis.s = 0;
  S.vis.power = 0;
  S.vis.path = 0;
  if (isPutting()) {
    S.aimYaw = yawToPin();
    S.target = null;
    S.targetPower = clamp(puttDistNeeded() / puttScale(), 0.08, 1);
    S.phase = 'aim';
  } else {
    placeInitialTarget();
    S.phase = 'aim';
  }
  updateHUD();
  updateAimVisuals();
  cutToAddress();
}

function retryShot() {
  if (!S.prev || S.phase === 'intro' || S.phase === 'flight') return;
  placeBall(S.prev.x, S.prev.z);
  S.lie = S.prev.lie;
  S.ball.y = S.prev.y;
  if (S.strokes > 0) S.strokes--;
  S.shot = null;
  S.vis.s = 0; S.vis.power = 0; S.vis.path = 0; S.vis.holding = false; S.vis.releasing = false;
  $('shotInfo').classList.add('hidden');
  $('gradeCard').classList.add('hidden');
  $('perfectFlash').classList.add('hidden');
  $('bigMsg').classList.add('hidden');
  tracerPts = [];
  updateTracer();
  newShotSetup();
}

function resetHole() {
  S.strokes = 0; S.holed = false; tracerPts = []; updateTracer();
  placeBall(0, -4.5); S.lie = C.SURF.TEE; S.ball.y += 0.02;
  rollWind();
  $('bigMsg').classList.add('hidden');
  $('shotInfo').classList.add('hidden');
  $('gradeCard').classList.add('hidden');
  $('perfectFlash').classList.add('hidden');
  newShotSetup();
}

function setDifficulty(id) {
  S.difficulty = DIFF[id] ? id : 'pro';
  $('diffBadge').textContent = DIFF[S.difficulty].badge;
  $('diffSel').value = S.difficulty;
  S.strike = null;
  try { localStorage.setItem('vl_diff', S.difficulty); } catch (_) {}
  updateAimVisuals();
}

function arcPoint(t) {
  const path = $('arcTrack');
  if (!path.getTotalLength) return;
  const len = path.getTotalLength();
  const p = path.getPointAtLength(len * clamp(t, 0, 1));
  $('arcTick').setAttribute('cx', p.x);
  $('arcTick').setAttribute('cy', p.y);
}

function showArc(power, label) {
  const p = clamp(power, 0, 1.2);
  $('arcFill').setAttribute('stroke-dashoffset', String(100 * (1 - Math.min(1, p))));
  $('arcOver').setAttribute('opacity', p > 1 ? String(0.45 + (p - 1) * 2.2) : '0.18');
  $('arcLbl').textContent = label ?? (Math.round(p * 100) + '%');
  $('arcLbl').classList.toggle('over', p > 1.001);
}

function updateHUD() {
  const club = clubs[S.clubIdx];
  const putting = isPutting();
  $('clubId').textContent = club.id;
  $('clubCarry').textContent = club.putter ? 'putter' : (nominal[S.clubIdx] * YD).toFixed(0) + ' yds';
  $('strokeLbl').textContent = 'STROKE ' + (S.strokes + 1);
  $('lieLbl').textContent = 'Lie: ' + C.SURF_NAME[S.lie];
  const d = distToPin();
  $('toPin').textContent = (putting || d < 20) ? (d * FT).toFixed(0) + ' ft' : (d * YD).toFixed(0) + ' yds';
  $('holeYds').textContent = (Math.hypot(C.PIN.x, C.PIN.z + 4.5) * YD).toFixed(0) + ' YDS';
  const rel = S.wind.ang - S.aimYaw;
  $('windArrow').style.transform = `rotate(${(rel * 180 / Math.PI) - 90}deg)`;
  $('padHint').innerHTML = putting ? 'DRAG BACK<br/>THEN THROUGH' : (S.vis.s > 0.2 ? 'NOW STRAIGHT UP' : 'DRAG DOWN<br/>THEN STRAIGHT UP');
  $('swingArea').classList.toggle('hidden', S.phase !== 'aim');
  $('aimBox').classList.toggle('hidden', S.phase === 'overhead');
  $('confirmBtn').classList.toggle('hidden', S.phase !== 'overhead');
  $('eyeBtn').classList.toggle('hidden', S.phase !== 'aim' || putting);
  const showTargetCard = !!S.target && !putting && (S.phase === 'overhead' || S.phase === 'aim');
  $('targetCard').classList.toggle('hidden', !showTargetCard);
  $('targetHint').style.display = S.phase === 'overhead' ? '' : 'none';
  if (S.target) {
    const toT = Math.hypot(S.target.x - S.ball.x, S.target.z - S.ball.z);
    const toP = Math.hypot(C.PIN.x - S.target.x, C.PIN.z - S.target.z);
    $('toTarget').textContent = fmtDist(toT);
    $('targetPin').textContent = fmtDist(toP);
  }
  const tick = putting ? S.targetPower : (S.targetPower || 0);
  arcPoint(tick);
  $('streakVal').textContent = String(S.streak);
  $('streakCard').classList.toggle('hot', S.streak > 0);
  $('retryBtn').hidden = !(S.prev && S.phase !== 'flight' && S.phase !== 'intro' && S.phase !== 'holed');
  document.body.classList.toggle('overhead', S.phase === 'overhead');
}

const ringColor = new THREE.Color();
function updateAimVisuals() {
  const m = new THREE.Matrix4();
  const putting = isPutting();
  const showTarget = !putting && S.target && (S.phase === 'overhead' || S.phase === 'aim' || S.phase === 'flight' || S.phase === 'settle' || S.phase === 'holed');
  targetRing.visible = !!showTarget;
  beacon.visible = !!showTarget;
  windMesh.visible = S.phase === 'overhead';
  chev.visible = putting && S.phase === 'aim';
  aimDots.visible = S.phase === 'aim' || S.phase === 'overhead';
  arcDots.visible = S.phase === 'overhead' && !!S.target;
  const dx = Math.sin(S.aimYaw), dz = -Math.cos(S.aimYaw);
  const full = S.phase === 'overhead' && S.target ? Math.hypot(S.target.x - S.ball.x, S.target.z - S.ball.z) : (putting ? Math.min(distToPin(), 6) : 8);
  const dotScale = S.phase === 'overhead' ? 7 : 1;
  const qid = new THREE.Quaternion();
  const sv = new THREE.Vector3(dotScale, dotScale, dotScale);
  for (let i = 0; i < 48; i++) {
    const t = (i + 0.5) / 48;
    const x = S.ball.x + dx * full * t, z = S.ball.z + dz * full * t;
    m.compose(new THREE.Vector3(x, course.heightAt(x, z) + 0.08, z), qid, sv);
    aimDots.setMatrixAt(i, m);
  }
  aimDots.instanceMatrix.needsUpdate = true;
  if (arcDots.visible) {
    const apex = Math.max(12, full * 0.38);
    const as = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 32; i++) {
      const t = (i + 0.5) / 32;
      const x = S.ball.x + dx * full * t, z = S.ball.z + dz * full * t;
      const y = course.heightAt(x, z) + Math.sin(t * Math.PI) * apex;
      m.compose(new THREE.Vector3(x, y, z), qid, as);
      arcDots.setMatrixAt(i, m);
    }
    arcDots.instanceMatrix.needsUpdate = true;
  }
  if (showTarget) {
    const c = S.target;
    const y = course.heightAt(c.x, c.z);
    targetRing.position.set(c.x, y + 0.12, c.z);
    const n = course.normalAt(c.x, c.z);
    _v.set(n.x, n.y, n.z);
    targetRing.quaternion.setFromUnitVectors(upVec, _v);
    const yards = dispersionYards(S.difficulty, S.clubIdx);
    const radius = Math.max(S.phase === 'overhead' ? 6.5 : 1.6, yards / YD);
    targetRing.scale.setScalar(radius);
    beacon.position.set(c.x, y + 3.1, c.z);
    beacon.scale.set(1, Math.max(0.6, radius * 0.35), 1);
    const surf = course.surfaceAt(c.x, c.z);
    const hex = surf === C.SURF.GREEN || surf === C.SURF.FRINGE ? 0x39ffb0 : surf === C.SURF.BUNKER ? 0xffb05a : surf === C.SURF.WATER ? 0x3ec2ff : surf === C.SURF.ROUGH ? 0xd6ff6a : 0xb7fff8;
    ringColor.setHex(hex);
    ringMat.color.copy(ringColor);
    beacon.material.color.copy(ringColor);
  }
  if (S.phase === 'overhead') {
    const mx = (S.ball.x + C.PIN.x) * 0.5 - 28;
    const mz = (S.ball.z + C.PIN.z) * 0.45;
    windMesh.position.set(mx, course.heightAt(mx, mz) + 1.2, mz);
    windMesh.rotation.y = Math.atan2(S.wind.x, S.wind.z);
    windMesh.scale.setScalar(1.6);
  }
}

function ensureStrike() {
  if (isPutting() || !S.target) { S.strike = null; return; }
  const d = DIFF[S.difficulty];
  const mods = d.perfectBonus ? { speedMul: 1.03, spinMul: 1.22 } : { speedMul: 1, spinMul: 1 };
  let yaw = S.aimYaw;
  let power = clamp(S.targetPower, 0.2, 1.05);
  const club = clubs[S.clubIdx];
  const tx = S.target.x - S.ball.x, tz = S.target.z - S.ball.z;
  const want = Math.hypot(tx, tz) || 0.01;
  for (let i = 0; i < 5; i++) {
    const launch = P.launchFromSwing(club, power, 0, yaw, S.lie, mods);
    const res = P.simulate(course, { ...S.ball }, launch, S.wind);
    const c = res.carry || res.final;
    const dx = c.x - S.ball.x, dz = c.z - S.ball.z;
    const got = Math.hypot(dx, dz) || 0.01;
    const cross = tx * dz - tz * dx;
    const latM = cross / want;
    power = clamp(power * (want / got), 0.18, 1.06);
    yaw += Math.atan2(latM, got) * 0.85;
    if (Math.abs(got - want) < 0.45 && Math.abs(latM) < 0.45) break;
  }
  S.strike = { yaw, power, mods, club: S.clubIdx };
}

function takeShot(raw) {
  if (S.phase !== 'aim') return;
  const grade = gradeSwing(raw, S.difficulty);
  const club = clubs[S.clubIdx];
  const putting = !!raw.putting;
  let launch, putt = false;
  if (putting) {
    putt = true;
    const D = Math.max(0.25, raw.power) * puttScale() * grade.speedMul;
    const yaw = S.aimYaw + grade.pushDeg * Math.PI / 180;
    launch = P.launchPutt(Math.sqrt(2 * PUTT_FR * D), yaw + grade.faceDeg * 0.35 * Math.PI / 180);
  } else {
    ensureStrike();
    const strike = S.strike;
    let power = raw.power;
    let yaw = (strike ? strike.yaw : S.aimYaw) + grade.pushDeg * Math.PI / 180;
    let face = grade.faceDeg;
    let mods = { speedMul: grade.speedMul, spinMul: 1 };
    if (grade.snapToTarget && strike) {
      power = strike.power;
      yaw = strike.yaw + grade.pushDeg * 0.08 * Math.PI / 180;
      face *= 0.08;
      mods = { speedMul: strike.mods.speedMul, spinMul: strike.mods.spinMul };
    }
    launch = P.launchFromSwing(club, power, face, yaw, S.lie, mods);
  }
  if (grade.allPerfect) S.streak++; else S.streak = 0;
  S.goldTracer = !!grade.perfectBonus;
  S.vis.path = clamp((grade.pathSign || 0) * (grade.pathMag || 0) / 0.1, -1, 1);
  S.vis.power = raw.power;
  if (grade.perfectBonus) showPerfect();
  audio.strike(!!grade.allPerfect);
  S.hitStop = grade.allPerfect ? 0.07 : 0.045;
  S.shake = grade.allPerfect ? 0.28 : 0.12;
  try { if (navigator.vibrate) navigator.vibrate(grade.allPerfect ? [12, 24, 28] : [10, 20, 14]); } catch (_) {}
  S.prev = { ...S.ball, lie: S.lie };
  S.strokes++;
  const res = P.simulate(course, { ...S.ball }, launch, putt ? { x: 0, z: 0 } : S.wind, { putt });
  S.shot = { res, launch, club, putt, power: raw.power, grade, raw, start: { ...S.ball }, target: S.target ? { ...S.target } : null, aimYaw: S.aimYaw };
  S.playT = 0; S.stopT = 0; S.camMode = 'chase'; S.cutDone = false;
  tracerPts = [];
  S.phase = 'flight';
  updateAimVisuals();
  updateHUD();
  $('shotInfo').classList.add('hidden');
  showGrade(raw, grade, '');
}

let perfectT = 0;
function showPerfect() {
  const el = $('perfectFlash');
  el.textContent = S.streak > 1 ? `PERFECT!  ×${S.streak}` : 'PERFECT!';
  el.classList.remove('hidden');
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  clearTimeout(perfectT);
  perfectT = setTimeout(() => el.classList.add('hidden'), 1300);
  try { if (navigator.vibrate) navigator.vibrate([40, 30, 80]); } catch (_) {}
}

function missPhrase(land, target, aimYaw, putt) {
  const vx = land.x - target.x, vz = land.z - target.z;
  const dx = Math.sin(aimYaw), dz = -Math.cos(aimYaw);
  const forward = vx * dx + vz * dz;
  const right = vx * (-dz) + vz * dx;
  const unit = putt ? FT : YD;
  const word = putt ? 'ft' : 'yds';
  const side = right * unit, long = forward * unit;
  const bits = [];
  const lim = putt ? 0.6 : 0.8;
  if (Math.abs(side) >= lim) bits.push(`${Math.abs(side).toFixed(0)} ${word} ${side > 0 ? 'right' : 'left'} of ${putt ? 'the hole' : 'target'}`);
  if (Math.abs(long) >= lim) bits.push(`${Math.abs(long).toFixed(0)} ${word} ${long > 0 ? (putt ? 'past the hole' : 'past target') : (putt ? 'short of the hole' : 'short of target')}`);
  if (!bits.length) return putt ? 'On the hole' : 'On the target';
  return bits.join(' · ');
}

function showGrade(raw, grade, miss) {
  const set = (id, val) => { const el = $(id); el.textContent = val; el.className = 'g-' + val; };
  set('gTempo', grade.tempo); set('gPath', grade.path); set('gPower', grade.power);
  $('gradeTitle').textContent = raw.putting ? 'PUTT' : 'SWING';
  $('gradeNote').textContent = grade.note || '';
  $('gradeMiss').textContent = miss || '';
  const pts = raw.pts || [];
  if (pts.length) {
    const x0 = raw.transX ?? pts[0].x;
    let minY = Infinity, maxY = -Infinity;
    for (const p of pts) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
    const h = Math.max(8, maxY - minY);
    $('gradeLine').setAttribute('points', pts.map((p) => {
      const x = clamp(32 + (p.x - x0) * 0.42, 3, 61);
      const y = 90 - ((p.y - minY) / h) * 82;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' '));
  }
  $('gradeCard').classList.remove('hidden');
}

function finishShot() {
  const { res, launch, club, putt, start, grade, raw, target, aimYaw } = S.shot;
  const f = res.final;
  const carry = res.carry ? Math.hypot(res.carry.x - start.x, res.carry.z - start.z) : 0;
  const total = Math.hypot(f.x - start.x, f.z - start.z);
  let info = '';
  if (res.result === 'water') {
    S.strokes++;
    if (course.isPondWater(f.x, f.z)) { placeBall(C.DROP_ZONE.x, C.DROP_ZONE.z); toast('WATER HAZARD · +1<br/><small>Drop zone</small>'); }
    else { placeBall(S.prev.x, S.prev.z); S.lie = S.prev.lie; S.ball.y = S.prev.y; toast('IN THE OCEAN · +1<br/><small>Replay from previous spot</small>'); }
  } else if (res.result === 'holed') {
    S.ball = { x: C.PIN.x, y: course.heightAt(C.PIN.x, C.PIN.z) - 0.05, z: C.PIN.z };
  } else {
    placeBall(f.x, f.z);
  }
  const yd = (m) => (m * YD).toFixed(0);
  const land = res.carry || f;
  const miss = putt
    ? missPhrase(f, { x: C.PIN.x, z: C.PIN.z }, aimYaw, true)
    : (target ? missPhrase(land, target, aimYaw, false) : '');
  if (grade) showGrade(raw, grade, miss);
  if (putt) {
    info = `<div class="title">PUTT</div><div><div class="v">${(total * FT).toFixed(1)}</div><div class="k">FT ROLLED</div></div><div><div class="v">${(distToPin() * FT).toFixed(1)}</div><div class="k">FT LEFT</div></div><div><div class="v">${launch.speed.toFixed(1)}</div><div class="k">M/S</div></div><div><div class="v">${C.SURF_NAME[S.lie]}</div><div class="k">LIE</div></div>`;
  } else {
    const side = (f.x - start.x) * Math.cos(S.aimYaw) + (f.z - start.z) * Math.sin(S.aimYaw);
    info = `<div class="title">${club.name.toUpperCase()} · ${(S.shot.power * 100).toFixed(0)}%</div>
      <div><div class="v">${yd(carry)}</div><div class="k">CARRY YDS</div></div>
      <div><div class="v">${yd(total)}</div><div class="k">TOTAL YDS</div></div>
      <div><div class="v">${res.result === 'holed' ? '0' : (distToPin() < 20 ? (distToPin() * FT).toFixed(0) + 'ft' : yd(distToPin()))}</div><div class="k">TO PIN</div></div>
      <div><div class="v">${Math.abs(side * YD).toFixed(0)}${side > 0.5 ? 'R' : side < -0.5 ? 'L' : ''}</div><div class="k">OFFLINE</div></div>
      <div><div class="v">${(launch.speed / 0.44704).toFixed(0)}</div><div class="k">BALL MPH</div></div>
      <div><div class="v">${launch.launchDeg.toFixed(1)}°</div><div class="k">LAUNCH</div></div>
      <div><div class="v">${launch.spinRpm.toFixed(0)}</div><div class="k">SPIN RPM</div></div>
      <div><div class="v">${(res.apex * FT).toFixed(0)}</div><div class="k">APEX FT</div></div>`;
  }
  $('shotInfo').innerHTML = info; $('shotInfo').classList.remove('hidden');
  if (res.result === 'holed') return holed();
  if (res.result !== 'water') {
    if (S.lie === C.SURF.BUNKER) toast('IN THE BUNKER');
    else if (S.lie === C.SURF.GREEN && !putt) toast('ON THE GREEN');
  }
  setTimeout(() => { if (S.phase === 'settle') newShotSetup(); }, res.result === 'water' ? 1500 : 700);
  S.phase = 'settle';
  if (grade && (grade.allPerfect || res.result === 'holed' || S.lie === C.SURF.GREEN)) audio.applause(grade.allPerfect || res.result === 'holed');
  $('retryBtn').hidden = false;
}

function holed() {
  S.phase = 'holed'; S.holed = true;
  const diff = S.strokes - C.PAR;
  const names = { '-2': 'Eagle!', '-1': 'Birdie!', '0': 'Par', '1': 'Bogey', '2': 'Double Bogey' };
  const title = S.strokes === 1 ? 'Hole in One!' : (names[diff] || (diff > 0 ? `+${diff}` : 'Albatross!'));
  $('bigTitle').textContent = title;
  const best = Math.min(+(localStorage.getItem('vl_best') || 99), S.strokes); localStorage.setItem('vl_best', best);
  $('bigSub').innerHTML = `${S.strokes} STROKE${S.strokes > 1 ? 'S' : ''} · ${diff === 0 ? 'E' : (diff > 0 ? '+' : '') + diff}<br/><small style="opacity:.7">BEST: ${best}</small>`;
  setTimeout(() => { $('bigMsg').classList.remove('hidden'); if (diff <= 0) confetti(S.strokes === 1 ? 600 : diff < 0 ? 320 : 120); }, 900);
}

let toastTimer;
function toast(html) { const t = $('toast'); t.innerHTML = html; t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2200); }

let confettiP = [];
function confetti(n) {
  const cols = ['#ff3fa4', '#3ff3ff', '#ffb05a', '#ffffff', '#b46bff', '#ffe14a'];
  for (let i = 0; i < n; i++) confettiP.push({ x: fx.width * (0.2 + Math.random() * 0.6), y: fx.height * 0.45, vx: (Math.random() - 0.5) * 22, vy: -8 - Math.random() * 22, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, s: (4 + Math.random() * 6) * devicePixelRatio, c: cols[i % cols.length], life: 0 });
}
function drawConfetti(dt) {
  fxc.clearRect(0, 0, fx.width, fx.height);
  if (!confettiP.length) return;
  for (const p of confettiP) {
    p.vy += 30 * dt; p.vx *= 0.99; p.x += p.vx * dt * 30; p.y += p.vy * dt * 30; p.r += p.vr; p.life += dt;
    fxc.save(); fxc.translate(p.x, p.y); fxc.rotate(p.r); fxc.fillStyle = p.c; fxc.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * Math.abs(Math.cos(p.life * 6))); fxc.restore();
  }
  confettiP = confettiP.filter((p) => p.y < fx.height + 40 && p.life < 8);
}

function updateTracer() {
  const n = tracerPts.length;
  const cp = camera.position;
  const gold = S.goldTracer;
  for (let i = 0; i < n; i++) {
    const p = tracerPts[i], q = tracerPts[Math.min(n - 1, i + 1)], o = tracerPts[Math.max(0, i - 1)];
    const tx = q.x - o.x, ty = q.y - o.y, tz = q.z - o.z;
    const vx = p.x - cp.x, vy = p.y - cp.y, vz = p.z - cp.z;
    let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
    const sl = Math.hypot(sx, sy, sz) || 1;
    const dist = Math.hypot(vx, vy, vz);
    const w = Math.max(0.03, dist * 0.0035) * (0.4 + 0.6 * Math.min(1, i / 6));
    sx *= w / sl; sy *= w / sl; sz *= w / sl;
    trPos.set([p.x + sx, p.y + sy, p.z + sz, p.x - sx, p.y - sy, p.z - sz], i * 6);
    const k = i / Math.max(1, n - 1);
    const r = gold ? 2.5 : 2.2, g = gold ? 1.9 : 0.5 + 1.2 * k, b = gold ? 0.4 : 1.6 - 1.0 * k;
    const fade = 0.45 + 0.55 * k;
    trCol.set([r * fade, g * fade, b * fade, r * fade, g * fade, b * fade], i * 6);
  }
  trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true;
  trGeo.setDrawRange(0, Math.max(0, (n - 1) * 6));
}

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const camPosT = new THREE.Vector3(), camLookT = new THREE.Vector3();
const upVec = new THREE.Vector3(0, 1, 0);

function setCamAddress() {
  // Camera, ball and target are collinear. Same offset in portrait and landscape.
  const dx = Math.sin(S.aimYaw), dz = -Math.cos(S.aimYaw);
  const b = S.ball;
  const ground = b.y - P.BALL_R;
  const back = 3.6;
  camPosT.set(b.x - dx * back, ground + 1.7, b.z - dz * back);
  camLookT.set(b.x + dx * 0.55, ground + 1.2, b.z + dz * 0.55);
  const h = course.heightAt(camPosT.x, camPosT.z) + 0.3;
  if (camPosT.y < h) camPosT.y = h;
}

function cutToAddress() {
  setCamAddress();
  camPos.copy(camPosT);
  camLook.copy(camLookT);
  const veil = $('veil');
  if (!veil) return;
  veil.classList.add('on');
  requestAnimationFrame(() => requestAnimationFrame(() => veil.classList.remove('on')));
}

function setCamOverhead() {
  const b = S.ball, p = C.PIN;
  const mx = (b.x + p.x) / 2, mz = (b.z + p.z) / 2;
  const yaw = yawToPin();
  const dx = Math.sin(yaw), dz = -Math.cos(yaw);
  const span = Math.hypot(p.x - b.x, p.z - b.z);
  const aspect = Math.max(0.38, camera.aspect);
  const vFov = (camera.aspect < 1 ? 62 : 50) * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
  const halfLen = span * 0.78 + 42;
  const halfWid = Math.max(64, span * 0.46);
  const dist = Math.max(halfLen / Math.tan(vFov / 2), halfWid / Math.tan(hFov / 2), 78);
  const gy = course.heightAt(mx, mz);
  const lookX = b.x + (p.x - b.x) * 0.40;
  const lookZ = b.z + (p.z - b.z) * 0.40;
  const back = dist * 0.62;
  camPosT.set(lookX - dx * back, gy + dist * 0.52, lookZ - dz * back);
  camLookT.set(lookX, course.heightAt(lookX, lookZ), lookZ);
  camUpT.set(dx, 0.08, dz).normalize();
}

function sampleShot(t) {
  const fr = S.shot.res.frames;
  const f = Math.min(fr.length - 1, t * 60);
  const i = Math.floor(f), k = f - i, a = fr[i], b = fr[Math.min(fr.length - 1, i + 1)];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, air: a.air, idx: i };
}

let introT = 0;
function updateCamera(dt) {
  const overhead = S.phase === 'overhead';
  if (params.get('pose') === 'close' && golfer.mesh) {
    const p = golfer.mesh.position;
    camPosT.set(p.x + 0.55, p.y + 1.62, p.z + 0.72);
    camLookT.set(p.x, p.y + 1.55, p.z);
    camUpT.set(0, 1, 0);
  } else if (S.phase === 'intro') {
    introT += dt * 0.06;
    const a = introT + 3.3, r = 70;
    camPosT.set(C.PIN.x + Math.sin(a) * r, 22 + Math.sin(introT * 0.7) * 4, C.PIN.z + Math.cos(a) * r);
    camLookT.set(C.PIN.x, 0.5, C.PIN.z + 10);
    camUpT.set(0, 1, 0);
  } else if (overhead) {
    setCamOverhead();
  } else if (S.phase === 'aim' || S.phase === 'settle') {
    if (S.phase === 'aim') setCamAddress();
    camUpT.copy(upVec);
  } else if (S.phase === 'flight' || S.phase === 'holed') {
    camUpT.copy(upVec);
    const shot = S.shot; const res = shot.res;
    const bp = ball.position;
    const dx = Math.sin(S.aimYaw), dz = -Math.cos(S.aimYaw);
    if (shot.putt) {
      camPosT.set(bp.x - dx * 3.4 + (-dz) * 0.8, bp.y + 1.45, bp.z - dz * 3.4 + dx * 0.8);
      camLookT.copy(bp);
    } else {
      const flightT = res.frames.filter((f) => f.air).length / 60;
      const carryLen = res.carry ? Math.hypot(res.carry.x - shot.start.x, res.carry.z - shot.start.z) : 0;
      if (!S.cutDone && carryLen > 40 && S.playT > flightT * 0.5) {
        S.cutDone = true; S.camMode = 'landing';
        const L = res.carry;
        const side = (Math.random() < 0.5 ? -1 : 1);
        const px = L.x - dx * 10 + dz * -side * 13, pz = L.z - dz * 10 + dx * side * 13;
        camPos.set(px, Math.max(course.heightAt(px, pz), C.WATER_LEVEL) + 3.2, pz);
        camLook.set(bp.x, bp.y, bp.z);
      }
      if (S.camMode === 'chase') {
        camPosT.set(bp.x - dx * 9, bp.y + 2.2, bp.z - dz * 9);
        const gh = Math.max(course.heightAt(camPosT.x, camPosT.z), C.WATER_LEVEL) + 1; if (camPosT.y < gh) camPosT.y = gh;
        camLookT.set(bp.x + dx * 6, bp.y, bp.z + dz * 6);
      } else {
        camLookT.copy(bp);
      }
    }
  }
  const k = overhead ? 2.2 : 3.4;
  camPos.lerp(camPosT, 1 - Math.exp(-dt * (S.phase === 'flight' && S.camMode === 'chase' ? 3 : k)));
  camLook.lerp(camLookT, 1 - Math.exp(-dt * (overhead ? 2.4 : 5)));
  camUp.lerp(camUpT, 1 - Math.exp(-dt * 2.6)).normalize();
  camera.up.copy(camUp);
  if (params.get('pose')) { camPos.copy(camPosT); camLook.copy(camLookT); }
  camera.position.copy(camPos);
  if (S.shake > 0) {
    const k = S.shake;
    camera.position.x += Math.sin(elapsed * 68) * k * 0.12;
    camera.position.y += Math.cos(elapsed * 53) * k * 0.06;
    const base = camera.aspect < 1 ? 64 : 48;
    camera.fov = base * (1 - Math.min(0.08, k * 0.2));
    camera.updateProjectionMatrix();
  } else if (S.phase !== 'overhead') {
    const base = camera.aspect < 1 ? 64 : 48;
    if (Math.abs(camera.fov - base) > 0.15) { camera.fov = base; camera.updateProjectionMatrix(); }
  }
  camera.lookAt(camLook);
}

let aimHold = 0;
function bindHold(el, dir) {
  const on = (e) => { e.preventDefault(); aimHold = dir; }, off = () => { aimHold = 0; };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
}
bindHold($('aimL'), -1); bindHold($('aimR'), 1);
function shiftClub(dir) {
  if (S.phase !== 'aim' && S.phase !== 'overhead') return;
  S.clubIdx = (S.clubIdx + dir + clubs.length) % clubs.length;
  if (isPutting()) {
    S.target = null;
    S.phase = 'aim';
    S.aimYaw = yawToPin();
    S.targetPower = clamp(puttDistNeeded() / puttScale(), 0.08, 1);
  } else if (S.phase === 'overhead' || S.target) {
    if (!S.target) placeInitialTarget();
    else reclampTargetToClub();
  }
  updateHUD(); updateAimVisuals();
}
$('clubPrev').onclick = () => shiftClub(-1);
$('clubNext').onclick = () => shiftClub(1);
$('resetBtn').onclick = () => { if (S.phase !== 'intro') resetHole(); };
$('againBtn').onclick = () => resetHole();
$('settingsBtn').onclick = () => $('settings').classList.remove('hidden');
$('diffBadge').onclick = () => $('settings').classList.remove('hidden');
$('closeSettings').onclick = () => {
  $('settings').classList.add('hidden');
  setDifficulty($('diffSel').value);
  applyQuality($('qualSel').value);
  audio.setMuted($('muteChk').checked);
};
$('muteChk').onchange = () => { audio.unlock(); audio.setMuted($('muteChk').checked); };
$('retryBtn').onclick = () => retryShot();
$('confirmBtn').onclick = () => {
  if (S.phase !== 'overhead') return;
  S.phase = 'aim';
  S.strike = null;
  updateHUD(); updateAimVisuals();
};
$('eyeBtn').onclick = () => {
  if (S.phase !== 'aim' || isPutting()) return;
  if (!S.target) placeInitialTarget();
  S.phase = 'overhead';
  updateHUD(); updateAimVisuals();
};

function groundPoint(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(W.terrain, false);
  if (hits.length) return hits[0].point;
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -course.heightAt(S.ball.x, S.ball.z));
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
}
canvas.addEventListener('pointerdown', (e) => {
  if (S.phase !== 'overhead') return;
  const p = groundPoint(e);
  if (!p) return;
  dragTarget = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  setTargetPoint(p.x, p.z);
  updateHUD(); updateAimVisuals();
});
canvas.addEventListener('pointermove', (e) => {
  if (dragTarget !== e.pointerId || S.phase !== 'overhead') return;
  const p = groundPoint(e);
  if (!p) return;
  setTargetPoint(p.x, p.z);
  updateHUD(); updateAimVisuals();
});
const endDrag = (e) => { if (e.pointerId === dragTarget) dragTarget = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

const pad = $('swingPad'), dot = $('padDot'), line = $('padLine');
let sw = null;
function resetPad() {
  dot.style.left = '50%'; dot.style.top = '28%';
  line.setAttribute('points', '');
  $('padHint').style.opacity = '0.8';
  if (!sw) showArc(0, isPutting() ? '0 ft' : '0%');
}
pad.addEventListener('pointerdown', (e) => {
  if (S.phase !== 'aim' || S.vis.holding) return;
  e.preventDefault();
  pad.setPointerCapture(e.pointerId);
  const r = pad.getBoundingClientRect();
  const p = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  sw = { id: e.pointerId, r, x0: p.x, y0: p.y, max: 0, phase: 'back', pts: [p], trans: 0, fired: false, tDown: 0.3 };
  S.vis.releasing = false; S.vis.holding = false;
  $('padHint').style.opacity = '0';
});
function visFromPull(pullNow) {
  const top = clamp(sw.max, 0.08, 1.25);
  if (sw.phase === 'back') {
    S.vis.s = clamp(pullNow, 0, 1.25);
    S.vis.power = S.vis.s;
    S.vis.path = 0;
    return;
  }
  if (pullNow >= 0) {
    const t = 1 - pullNow / top;
    S.vis.s = top + clamp(t, 0, 1) * (2 - top);
  } else {
    S.vis.s = 2 + clamp(-pullNow / 0.5, 0, 1);
  }
  S.vis.power = top;
  const path = pathError(sw.pts, sw.trans, sw.r.width);
  S.vis.path = clamp(path.sign * path.mag / 0.1, -1, 1);
}
function addMove(e) {
  const p = { x: e.clientX - sw.r.left, y: e.clientY - sw.r.top, t: performance.now() };
  sw.pts.push(p);
  if (sw.pts.length > 140) { sw.pts.shift(); if (sw.trans > 0) sw.trans--; }
  const span = sw.r.height * 0.62;
  const pull = (p.y - sw.y0) / span;
  line.setAttribute('points', sw.pts.map((q) => `${(q.x / sw.r.width) * 100},${(q.y / sw.r.height) * 100}`).join(' '));
  dot.style.left = p.x + 'px'; dot.style.top = p.y + 'px';
  if (sw.phase === 'back') {
    sw.max = Math.max(sw.max, Math.min(1.2, pull));
    const label = isPutting() ? ((Math.max(0, sw.max) * puttScale()) * FT).toFixed(0) + ' ft' : undefined;
    showArc(Math.max(0, sw.max), label);
    if (sw.max > 0.1 && pull < sw.max - 0.075) {
      sw.phase = 'fwd';
      sw.trans = sw.pts.length - 1;
      $('padHint').textContent = 'THROUGH';
      try { if (navigator.vibrate) navigator.vibrate(12); } catch (_) {}
    }
    const tBack = Math.max(0.05, (p.t - sw.pts[0].t) / 1000);
    $('tempoRead').textContent = tBack < 0.4 ? 'QUICK' : tBack > 1.35 ? 'SLOW' : 'SET';
    $('tempoRead').style.color = '#3ff3ff';
  } else if (!sw.fired && pull <= 0.02 && sw.max > 0.08) {
    sw.fired = true;
    sw.tDown = Math.max(0.05, (p.t - sw.pts[sw.trans].t) / 1000);
    fireSwing();
  }
  if (sw && sw.phase === 'fwd') {
    const tBack = Math.max(0.05, (sw.pts[sw.trans].t - sw.pts[0].t) / 1000);
    const tDown = Math.max(0.04, (p.t - sw.pts[sw.trans].t) / 1000);
    const err = Math.abs(tBack / tDown - 3);
    $('tempoRead').textContent = err < 0.55 ? 'SMOOTH' : tBack / tDown < 3 ? 'FAST' : 'LONG';
    $('tempoRead').style.color = err < 0.55 ? '#ffe14a' : '#ff8ad4';
  }
  visFromPull(pull);
}
pad.addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  const list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of list) addMove(ev);
});
function fireSwing() {
  const trans = Math.min(sw.trans, sw.pts.length - 1);
  const pts = sw.pts.slice();
  const path = pathError(pts, trans, sw.r.width);
  let tMove = pts[0].t;
  for (const p of pts) { if (p.y > sw.y0 + sw.r.height * 0.04) { tMove = p.t; break; } }
  const tTrans = pts[trans].t;
  const tEnd = pts[pts.length - 1].t;
  const putting = isPutting();
  const raw = {
    tBack: Math.max(0.05, (tTrans - tMove) / 1000),
    tDown: Math.max(0.04, (tEnd - tTrans) / 1000),
    pathMean: path.mean, pathRms: path.rms, pathMag: path.mag, pathSign: path.sign,
    rush: transitionRush(pts, trans),
    power: clamp(sw.max, 0.05, 1.2),
    targetPower: putting ? clamp(puttDistNeeded() / puttScale(), 0.08, 1) : (S.targetPower || 1),
    putting, pts, transX: pts[trans].x,
  };
  takeShot(raw);
}
pad.addEventListener('pointerup', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  if (sw.fired) {
    const remain = Math.max(0, 3 - S.vis.s);
    S.vis.releasing = remain > 0.05;
    S.vis.releaseRate = remain / Math.max(0.16, sw.tDown * 0.55);
    S.vis.holding = !S.vis.releasing;
    S.vis.holdT = 0;
  } else {
    S.vis.s = 0; S.vis.power = 0; S.vis.path = 0;
    showArc(0, isPutting() ? '0 ft' : '0%');
  }
  sw = null; resetPad();
});
pad.addEventListener('pointercancel', () => { sw = null; S.vis.s = 0; resetPad(); });

addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') aimHold = -1;
  if (e.key === 'ArrowRight') aimHold = 1;
  if (e.key === 'ArrowUp') shiftClub(-1);
  if (e.key === 'ArrowDown') shiftClub(1);
  if (e.key === 'Enter' && S.phase === 'overhead') $('confirmBtn').click();
  if ((e.key === 'b' || e.key === 'B') && S.phase === 'aim') $('eyeBtn').click();
});
addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') aimHold = 0; });

$('playBtn').onclick = () => startGame();
function startGame() {
  audio.unlock();
  $('intro').classList.add('hidden'); $('hud').classList.remove('hidden');
  resetHole();
  try { if (isMobile && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (_) {}
}
$('loadMsg').textContent = '';
try { const saved = localStorage.getItem('vl_diff'); if (saved && DIFF[saved]) setDifficulty(saved); } catch (_) {}

let qualityMode = 'auto';
function applyQuality(q) {
  qualityMode = q;
  if (q === 'low') { useBloom = false; pixelRatio = Math.min(devicePixelRatio, 1.25); }
  else if (q === 'high') { useBloom = true; pixelRatio = Math.min(devicePixelRatio, 2); }
  renderer.setPixelRatio(pixelRatio); onResize();
}
let fpsAcc = 0, fpsN = 0, fpsChecks = 0;
function autoPerf(dt) {
  if (qualityMode !== 'auto' || fpsChecks > 3) return;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 3) {
    const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; fpsChecks++;
    if (fps < 42) {
      if (useBloom) useBloom = false;
      else if (pixelRatio > 1.25) { pixelRatio = Math.max(1, pixelRatio - 0.4); renderer.setPixelRatio(pixelRatio); onResize(); }
    }
  }
}

const pm = $('pinMarker'), pmd = $('pinMarkerDist');
const pinTop = new THREE.Vector3(C.PIN.x, course.heightAt(C.PIN.x, C.PIN.z) + 2.5, C.PIN.z);
function projectTag(el, world, show) {
  if (!show) { el.classList.add('hidden'); return; }
  const v = world.clone().project(camera);
  if (v.z > 1) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.style.left = ((v.x + 1) / 2 * innerWidth) + 'px';
  el.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
}
const targetWorld = new THREE.Vector3();
function updatePinMarker() {
  const show = S.phase === 'aim' && distToPin() > 12;
  if (!show) pm.style.display = 'none';
  else {
    const v = pinTop.clone().project(camera);
    if (v.z > 1) pm.style.display = 'none';
    else {
      pm.style.display = 'block';
      pm.style.left = ((v.x + 1) / 2 * innerWidth) + 'px';
      pm.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
      pmd.textContent = (distToPin() * YD).toFixed(0) + 'y';
    }
  }
  const tag = $('targetTag');
  if (S.target && (S.phase === 'overhead' || S.phase === 'aim') && !isPutting()) {
    const yds = Math.hypot(S.target.x - S.ball.x, S.target.z - S.ball.z) * YD;
    $('targetTagDist').textContent = yds.toFixed(0) + ' yds';
    targetWorld.set(S.target.x, course.heightAt(S.target.x, S.target.z) + 1.2, S.target.z);
    projectTag(tag, targetWorld, true);
  } else tag.classList.add('hidden');
}

const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  W.timeU.value = elapsed;
  W.water.material.uniforms.time.value += dt * 0.35; W.skyTime.value = elapsed;
  W.updateFlag(elapsed, (S.wind.ang - Math.PI / 2) * -1);

  if ((S.phase === 'aim' || S.phase === 'overhead') && aimHold && !isPutting() && S.target) {
    S.aimYaw += aimHold * dt * 0.28;
    const dist = Math.hypot(S.target.x - S.ball.x, S.target.z - S.ball.z);
    S.target = { x: S.ball.x + Math.sin(S.aimYaw) * dist, z: S.ball.z - Math.cos(S.aimYaw) * dist };
    S.strike = null;
    updateAimVisuals(); updateHUD();
  } else if (S.phase === 'aim' && aimHold && isPutting()) {
    S.aimYaw += aimHold * dt * 0.12;
    updateAimVisuals(); updateHUD();
  }

  if (S.vis.releasing) {
    S.vis.s = Math.min(3, S.vis.s + dt * S.vis.releaseRate);
    if (S.vis.s >= 3) { S.vis.releasing = false; S.vis.holding = true; S.vis.holdT = 0; }
  } else if (S.vis.holding) {
    S.vis.holdT += dt;
    if (S.vis.holdT > 1.15 && S.phase !== 'flight' && S.phase !== 'holed') S.vis.holding = false;
  } else if (!sw && S.phase === 'aim') {
    S.vis.s += (0 - S.vis.s) * Math.min(1, dt * 4);
  }

  const poseName = params.get('pose');
  let swingS = S.vis.s, swingPower = S.vis.power || S.vis.s, swingPath = S.vis.path;
  if (poseName === 'address' || poseName === 'close') { swingS = 0; swingPower = 0; swingPath = 0; }
  else if (poseName === 'top') { swingS = 1; swingPower = 1; swingPath = 0; }
  else if (poseName === 'impact') { swingS = 2; swingPower = 1; swingPath = 0; }
  else if (poseName === 'finish') { swingS = 3; swingPower = 1; swingPath = params.get('path') === 'open' ? 0.8 : 0; }
  else if (poseName === 'over') { swingS = 1.22; swingPower = 1.22; swingPath = 0; }

  if (S.hitStop > 0) S.hitStop = Math.max(0, S.hitStop - dt);
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 1.4);
  if (S.phase === 'flight' || (S.phase === 'holed' && S.shot)) {
    if (S.hitStop <= 0) S.playT += dt;
    const p = sampleShot(S.playT);
    ball.position.set(p.x, p.y, p.z);
    const fr = S.shot.res.frames;
    if (!S.shot.putt) {
      tracerPts = fr.slice(0, p.idx + 1).filter((f, i) => f.air || i < 2);
      if (tracerPts.length) tracerPts.push({ x: p.x, y: p.y, z: p.z });
      if (!p.air) tracerPts = fr.filter((f) => f.air);
    }
    for (const ev of S.shot.res.events) {
      if (ev.type === 'water' && !ev.done && S.playT >= ev.t) { ev.done = true; doSplash(ev.x, ev.z); ball.visible = false; audio.land('water'); }
      if (ev.type === 'bounce' && !ev.heard && S.playT >= ev.t) { ev.heard = true; audio.land((C.SURF_NAME[ev.surf] || 'fairway').toLowerCase()); }
    }
    const end = fr[fr.length - 1].t;
    if (S.phase === 'flight' && S.playT >= end) {
      S.stopT += dt;
      if (S.stopT > 0.9) { ball.visible = true; finishShot(); }
    }
  } else {
    ball.position.set(S.ball.x, S.ball.y, S.ball.z);
    ball.visible = true;
  }

  golfer.update(dt, {
    phase: S.phase, ball: S.ball, aimYaw: S.aimYaw, putt: isPutting() && S.phase !== 'overhead',
    clubId: clubs[S.clubIdx].id, s: swingS, power: swingPower, path: swingPath,
    time: elapsed, heightAt: (x, z) => course.heightAt(x, z),
  });

  updateCamera(dt);
  const cd = camera.position.distanceTo(ball.position);
  ball.scale.setScalar(Math.max(1, cd * 0.0022 / P.BALL_R * 0.5));
  const gh = course.heightAt(ball.position.x, ball.position.z);
  blob.position.set(ball.position.x, Math.max(gh, C.WATER_LEVEL) + 0.01, ball.position.z);
  const hAbove = ball.position.y - gh;
  blob.scale.setScalar(P.BALL_R * 3.2 * ball.scale.x * (1 + hAbove * 0.05));
  blob.material.opacity = Math.max(0, 1 - hAbove / 25);
  blob.visible = ball.visible && gh > C.WATER_LEVEL;
  updateTracer();
  if (ringMat && targetRing.visible) {
    const pulse = 0.72 + 0.28 * Math.sin(elapsed * 4);
    ringMat.opacity = pulse;
    haloMat.opacity = 0.28 + 0.2 * Math.sin(elapsed * 4);
  }
  const over = S.phase === 'overhead' ? 1 : 0;
  renderer.toneMappingExposure = 0.62 + over * 0.7;
  if (scene.fog) scene.fog.density = 0.001 - over * 0.00086;
  if (W.hemi) W.hemi.intensity = 0.75 + over * 1.55;
  if (W.sun) {
    W.sun.intensity = 3.2 + over * 1.5;
    if (W.sun.shadow) W.sun.shadow.radius = over ? 8 : 3;
    if (W.sun.shadow && W.sun.shadow.intensity !== undefined) W.sun.shadow.intensity = over ? 0.35 : 1;
  }
  if (chev.visible) {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(0.65, 0.65, 0.65);
    chevPts.forEach((c, i) => {
      const ph = ((elapsed * 0.6 + (c.x + c.z) * 0.13) % 1) * 0.6;
      const x = c.x + c.dx * ph, z = c.z + c.dz * ph;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-c.dx, -c.dz));
      m.compose(new THREE.Vector3(x, course.heightAt(x, z) + 0.015, z), q, sv); chev.setMatrixAt(i, m);
    });
    chev.instanceMatrix.needsUpdate = true;
  }
  if (splash.visible) {
    splashT += dt; const a = splashGeo.attributes.position;
    for (let i = 0; i < splashN; i++) { const v = splashVel[i]; v[1] -= 9.8 * dt; a.setXYZ(i, a.getX(i) + v[0] * dt, Math.max(C.WATER_LEVEL, a.getY(i) + v[1] * dt), a.getZ(i) + v[2] * dt); }
    a.needsUpdate = true; splash.material.opacity = Math.max(0, 0.9 - splashT * 0.6); if (splashT > 1.6) splash.visible = false;
  }
  W.setShadowCenter((camera.position.x + ball.position.x) / 2, (camera.position.z + ball.position.z) / 2 - 30);
  updatePinMarker();
  drawConfetti(dt);
  autoPerf(dt);
  if (useBloom) composer.render(dt); else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__golf = { S, startGame, takeShot, camera, renderer, scene, resetHole, newShotSetup, placeBall, nominal, golfer, gradeSwing, DIFF, audio };
if (params.has('clean')) document.body.classList.add('clean');
if (params.has('play')) {
  startGame();
  const pose = params.get('pose');
  if (pose && pose !== 'overhead') $('confirmBtn').click();
}
