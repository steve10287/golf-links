import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as C from './course.js';
import * as P from './physics.js';
import { buildWorld } from './world.js';

const $ = (id) => document.getElementById(id);
const YD = 1.0936133, FT = 3.2808;
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
const params = new URLSearchParams(location.search);

// ---------- renderer ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('shot') });
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
  camera.fov = camera.aspect < 1 ? 64 : 48;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(pixelRatio); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  fx.width = innerWidth * devicePixelRatio; fx.height = innerHeight * devicePixelRatio;
}
const fx = $('fx'), fxc = fx.getContext('2d');
addEventListener('resize', onResize); onResize();

// ---------- ball, shadow blob, tracer, target ring ----------
const ball = new THREE.Mesh(new THREE.SphereGeometry(P.BALL_R, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.2 }));
ball.castShadow = false; scene.add(ball);
const blobTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
const blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false }));
scene.add(blob);

const MAXT = 3000;
const trPos = new Float32Array(MAXT * 2 * 3), trCol = new Float32Array(MAXT * 2 * 3);
const trGeo = new THREE.BufferGeometry();
trGeo.setAttribute('position', new THREE.BufferAttribute(trPos, 3));
trGeo.setAttribute('color', new THREE.BufferAttribute(trCol, 3));
{ const ii = []; for (let i = 0; i < MAXT - 1; i++) { const a = i * 2; ii.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } trGeo.setIndex(ii); }
const tracer = new THREE.Mesh(trGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
tracer.frustumCulled = false; scene.add(tracer);
let tracerPts = [];

const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.4, 2.8), transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
const targetRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.1, 48).rotateX(-Math.PI / 2), ringMat);
const targetDot = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2), ringMat);
targetRing.add(targetDot); scene.add(targetRing);

// aim line (dashes)
const aimDots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.05, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.5, 2.5), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }), 40);
aimDots.frustumCulled = false; scene.add(aimDots);

// slope chevrons on the green (putting view)
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

// splash particles
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

// ---------- game state ----------
const S = {
  phase: 'intro', strokes: 0, clubIdx: 3, aimYaw: 0, ball: { x: 0, y: 0, z: 0 }, lie: C.SURF.TEE,
  wind: { x: 0, z: 0, mph: 0, ang: 0 }, shot: null, playT: 0, prev: null, stopT: 0, motion: false,
  sens: 850, assist: true, holed: false,
};
const clubs = P.CLUBS;

function rollWind() {
  const mph = 1 + Math.random() * 7; const ang = Math.random() * Math.PI * 2;
  const ms = mph * 0.44704;
  S.wind = { x: Math.sin(ang) * ms, z: -Math.cos(ang) * ms, mph, ang };
  $('windVal').textContent = mph.toFixed(0) + ' mph';
}

// Nominal straight-carry for each club (flat ground, no wind)
const flatCourse = { heightAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }), surfaceAt: () => C.SURF.FAIRWAY };
const nominal = clubs.map((c) => {
  if (c.putter) return 0;
  const r = P.simulate(flatCourse, { x: 0, y: P.BALL_R, z: 0 }, P.launchFromSwing(c, 1, 0, 0, C.SURF.TEE), { x: 0, z: 0 });
  return Math.hypot(r.carry.x, r.carry.z);
});

function distToPin(p = S.ball) { return Math.hypot(C.PIN.x - p.x, C.PIN.z - p.z); }
function yawToPin(p = S.ball) { return Math.atan2(C.PIN.x - p.x, -(C.PIN.z - p.z)); }
function isPutting() { return clubs[S.clubIdx].putter; }

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

function newShotSetup() {
  S.aimYaw = yawToPin();
  autoClub();
  S.phase = 'aim';
  updateHUD();
  updateAimVisuals();
  setCamAddress(true);
}

function resetHole() {
  S.strokes = 0; S.holed = false; tracerPts = []; updateTracer();
  placeBall(0, -4.5); S.lie = C.SURF.TEE; S.ball.y += 0.02; // teed up
  rollWind();
  $('bigMsg').classList.add('hidden'); $('shotInfo').classList.add('hidden');
  newShotSetup();
}

function updateHUD() {
  const club = clubs[S.clubIdx];
  $('clubId').textContent = club.id;
  $('clubCarry').textContent = club.putter ? 'putter' : (nominal[S.clubIdx] * YD).toFixed(0) + ' yds';
  $('strokeLbl').textContent = 'STROKE ' + (S.strokes + 1);
  $('lieLbl').textContent = 'Lie: ' + C.SURF_NAME[S.lie];
  const d = distToPin();
  $('toPin').textContent = (isPutting() || d < 20) ? (d * FT).toFixed(0) + ' ft' : (d * YD).toFixed(0) + ' yds';
  $('holeYds').textContent = (Math.hypot(C.PIN.x, C.PIN.z + 4.5) * YD).toFixed(0) + ' YDS';
  // wind arrow relative to aim direction (screen up = aim)
  const rel = S.wind.ang - S.aimYaw;
  $('windArrow').style.transform = `rotate(${(rel * 180 / Math.PI) - 90}deg)`;
  $('padHint').innerHTML = isPutting() ? 'PULL BACK<br/>then PUSH UP' : 'PULL DOWN<br/>then FLICK UP';
  $('meterTarget').style.display = isPutting() ? 'block' : 'none';
  if (isPutting()) $('meterTarget').style.bottom = (Math.min(1, puttDistNeeded() / puttScale()) / 1.1 * 100) + '%';
}

// putting scale: full meter = this many metres on flat green
function puttScale() { return Math.max(4, Math.min(30, distToPin() * 1.5)); }
function puttDistNeeded() { return distToPin(); }
const PUTT_FR = 0.058 * 9.81;

function updateAimVisuals() {
  const m = new THREE.Matrix4();
  const putting = isPutting();
  targetRing.visible = !putting && S.phase === 'aim';
  chev.visible = putting && S.phase === 'aim';
  aimDots.visible = S.phase === 'aim';
  const dx = Math.sin(S.aimYaw), dz = -Math.cos(S.aimYaw);
  const L = putting ? Math.min(distToPin(), 6) : 12;
  for (let i = 0; i < 40; i++) {
    const t = 0.4 + i / 39 * L;
    const x = S.ball.x + dx * t, z = S.ball.z + dz * t;
    m.makeTranslation(x, course.heightAt(x, z) + 0.02, z); aimDots.setMatrixAt(i, m);
  }
  aimDots.instanceMatrix.needsUpdate = true;
  if (!putting) {
    const club = clubs[S.clubIdx];
    const r = P.simulate(course, { ...S.ball }, P.launchFromSwing(club, 1, 0, S.aimYaw, S.lie), S.wind);
    const c = r.carry || r.final;
    targetRing.position.set(c.x, course.heightAt(c.x, c.z) + 0.08, c.z);
    const n = course.normalAt(c.x, c.z); targetRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n.x, n.y, n.z));
    const s = Math.max(0.6, Math.hypot(c.x - S.ball.x, c.z - S.ball.z) / 120); targetRing.scale.setScalar(s);
  }
}

// ---------- shooting ----------
function takeShot(power, face) {
  if (S.phase !== 'aim') return;
  const club = clubs[S.clubIdx];
  let launch, putt = false;
  if (club.putter) {
    putt = true;
    const D = Math.max(0.2, power) * puttScale();
    const v = Math.sqrt(2 * PUTT_FR * D);
    launch = P.launchPutt(v, S.aimYaw + face * 0.25 * Math.PI / 180);
  } else {
    if (power > 1.0) face += (Math.random() - 0.5) * (power - 1) * 60;
    if (S.assist) face *= 0.6;
    launch = P.launchFromSwing(club, power, face, S.aimYaw, S.lie);
  }
  S.prev = { ...S.ball, lie: S.lie };
  S.strokes++;
  const res = P.simulate(course, { ...S.ball }, launch, putt ? { x: 0, z: 0 } : S.wind, { putt });
  S.shot = { res, launch, club, putt, power, face, start: { ...S.ball } };
  S.playT = 0; S.stopT = 0; S.camMode = 'chase'; S.cutDone = false;
  tracerPts = [];
  S.phase = 'flight';
  updateAimVisuals();
  $('shotInfo').classList.add('hidden');
  hideMeter();
}

function finishShot() {
  const { res, launch, club, putt, start } = S.shot;
  const f = res.final;
  const carry = res.carry ? Math.hypot(res.carry.x - start.x, res.carry.z - start.z) : 0;
  const total = Math.hypot(f.x - start.x, f.z - start.z);
  let info = '';
  if (res.result === 'water') {
    S.strokes++; // penalty
    if (course.isPondWater(f.x, f.z)) { placeBall(C.DROP_ZONE.x, C.DROP_ZONE.z); toast('WATER HAZARD · +1<br/><small>Drop zone</small>'); }
    else { placeBall(S.prev.x, S.prev.z); S.lie = S.prev.lie; S.ball.y = S.prev.y; toast('IN THE OCEAN · +1<br/><small>Replay from previous spot</small>'); }
  } else if (res.result === 'holed') {
    S.ball = { x: C.PIN.x, y: course.heightAt(C.PIN.x, C.PIN.z) - 0.05, z: C.PIN.z };
  } else {
    placeBall(f.x, f.z);
  }
  const yd = (m) => (m * YD).toFixed(0);
  if (putt) {
    info = `<div class="title">PUTT</div><div><div class="v">${(total * FT).toFixed(1)}</div><div class="k">FT ROLLED</div></div><div><div class="v">${(distToPin() * FT).toFixed(1)}</div><div class="k">FT LEFT</div></div><div><div class="v">${launch.speed.toFixed(1)}</div><div class="k">M/S</div></div><div><div class="v">${C.SURF_NAME[S.lie]}</div><div class="k">LIE</div></div>`;
  } else {
    const side = (f.x - start.x) * Math.cos(S.aimYaw) + (f.z - start.z) * Math.sin(S.aimYaw);
    info = `<div class="title">${club.name.toUpperCase()} · ${(S.shot.power * 100).toFixed(0)}% POWER</div>
      <div><div class="v">${yd(carry)}</div><div class="k">CARRY YDS</div></div>
      <div><div class="v">${yd(total)}</div><div class="k">TOTAL YDS</div></div>
      <div><div class="v">${res.result === 'holed' ? '0' : (distToPin() < 20 ? (distToPin() * FT).toFixed(0) + 'ft' : yd(distToPin()))}</div><div class="k">TO PIN${distToPin() < 20 ? '' : ' YDS'}</div></div>
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
  setTimeout(() => { if (S.phase === 'settle') newShotSetup(); }, res.result === 'water' ? 1500 : 600);
  S.phase = 'settle';
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

// confetti
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

// ---------- tracer ----------
function updateTracer() {
  const n = tracerPts.length;
  const cp = camera.position;
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
    const r = 2.2, g = 0.5 + 1.2 * k, b = 1.6 - 1.0 * k;
    const fade = 0.35 + 0.65 * k;
    trCol.set([r * fade, g * fade, b * fade, r * fade, g * fade, b * fade], i * 6);
  }
  trGeo.attributes.position.needsUpdate = true; trGeo.attributes.color.needsUpdate = true;
  trGeo.setDrawRange(0, Math.max(0, (n - 1) * 6));
}

// ---------- camera ----------
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
const camPosT = new THREE.Vector3(), camLookT = new THREE.Vector3();
function setCamAddress(snap) {
  const dx = Math.sin(S.aimYaw), dz = -Math.cos(S.aimYaw);
  const b = S.ball;
  if (isPutting()) {
    const d = distToPin();
    const back = 2.4 + Math.min(d, 10) * 0.15;
    camPosT.set(b.x - dx * back, b.y + 1.0 + Math.min(d, 10) * 0.06, b.z - dz * back);
    const ahead = Math.min(d, 8) * 0.55;
    camLookT.set(b.x + dx * ahead, b.y - 0.2, b.z + dz * ahead);
  } else {
    camPosT.set(b.x - dx * 4.6, b.y + 2.4, b.z - dz * 4.6);
    const ahead = Math.min(distToPin(), 150) * 0.8;
    const lx = b.x + dx * ahead, lz = b.z + dz * ahead;
    camLookT.set(lx, course.heightAt(lx, lz) - ahead * 0.035, lz);
  }
  const h = course.heightAt(camPosT.x, camPosT.z) + 0.6; if (camPosT.y < h) camPosT.y = h;
  if (snap) { camPos.copy(camPosT); camLook.copy(camLookT); }
}

function sampleShot(t) {
  const fr = S.shot.res.frames;
  const f = Math.min(fr.length - 1, t * 60);
  const i = Math.floor(f), k = f - i, a = fr[i], b = fr[Math.min(fr.length - 1, i + 1)];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, air: a.air, idx: i };
}

let introT = 0;
function updateCamera(dt) {
  if (S.phase === 'intro') {
    introT += dt * 0.06;
    const a = introT + 3.3, r = 70;
    camPos.set(C.PIN.x + Math.sin(a) * r, 22 + Math.sin(introT * 0.7) * 4, C.PIN.z + Math.cos(a) * r);
    camLook.set(C.PIN.x, 0.5, C.PIN.z + 10);
  } else if (S.phase === 'aim' || S.phase === 'settle') {
    if (S.phase === 'aim') setCamAddress(false);
    camPos.lerp(camPosT, 1 - Math.exp(-dt * 4)); camLook.lerp(camLookT, 1 - Math.exp(-dt * 5));
  } else if (S.phase === 'flight' || S.phase === 'holed') {
    const shot = S.shot; const res = shot.res;
    const bp = ball.position;
    const dx = Math.sin(S.aimYaw), dz = -Math.cos(S.aimYaw);
    if (shot.putt) {
      camPosT.set(bp.x - dx * 2.6, bp.y + 1.1, bp.z - dz * 2.6);
      camLookT.copy(bp);
      camPos.lerp(camPosT, 1 - Math.exp(-dt * 2.2)); camLook.lerp(camLookT, 1 - Math.exp(-dt * 6));
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
        camPos.lerp(camPosT, 1 - Math.exp(-dt * 3.0));
        camLookT.set(bp.x + dx * 6, bp.y, bp.z + dz * 6);
        camLook.lerp(camLookT, 1 - Math.exp(-dt * 6));
      } else {
        camLook.lerp(bp, 1 - Math.exp(-dt * 7));
      }
    }
  }
  camera.position.copy(camPos); camera.lookAt(camLook);
}

// ---------- input: aim + clubs ----------
let aimHold = 0;
function bindHold(el, dir) {
  const on = (e) => { e.preventDefault(); aimHold = dir; }, off = () => { aimHold = 0; };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
}
bindHold($('aimL'), -1); bindHold($('aimR'), 1);
$('clubPrev').onclick = () => { if (S.phase !== 'aim') return; S.clubIdx = (S.clubIdx + clubs.length - 1) % clubs.length; updateHUD(); updateAimVisuals(); };
$('clubNext').onclick = () => { if (S.phase !== 'aim') return; S.clubIdx = (S.clubIdx + 1) % clubs.length; updateHUD(); updateAimVisuals(); };
$('resetBtn').onclick = () => { if (S.phase !== 'intro') resetHole(); };
$('againBtn').onclick = () => resetHole();
$('settingsBtn').onclick = () => $('settings').classList.remove('hidden');
$('closeSettings').onclick = () => { $('settings').classList.add('hidden'); S.sens = +$('sensSel').value; S.assist = $('assistChk').checked; applyQuality($('qualSel').value); };
$('useTouch').onclick = () => setMotionMode(false);
$('useMotion').onclick = () => enableMotion();

// ---------- power meter ----------
function showMeter(p, label) {
  $('meterFill').style.height = Math.min(100, p / 1.1 * 100) + '%';
  $('meterLbl').textContent = label ?? (Math.round(p * 100) + '%');
}
function hideMeter() { setTimeout(() => showMeter(0, ''), 900); }

// ---------- input: touch swing pad (2K-style swing stick) ----------
const pad = $('swingPad'), dot = $('padDot'), line = $('padLine');
let sw = null;
pad.addEventListener('pointerdown', (e) => {
  if (S.phase !== 'aim') return;
  e.preventDefault(); pad.setPointerCapture(e.pointerId);
  const r = pad.getBoundingClientRect();
  sw = { id: e.pointerId, x0: e.clientX, y0: e.clientY, r, max: 0, phase: 'back', pts: [], tf: 0, yf: 0, xf: 0 };
  $('padHint').style.opacity = 0;
});
pad.addEventListener('pointermove', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  const span = sw.r.height * 0.55;
  const pull = (e.clientY - sw.y0) / span;
  const now = performance.now();
  sw.pts.push([(e.clientX - sw.r.left) / sw.r.width * 100, (e.clientY - sw.r.top) / sw.r.height * 100]);
  if (sw.pts.length > 60) sw.pts.shift();
  line.setAttribute('points', sw.pts.map((p) => p.join(',')).join(' '));
  dot.style.left = (e.clientX - sw.r.left) + 'px'; dot.style.top = (e.clientY - sw.r.top) + 'px';
  if (sw.phase === 'back') {
    sw.max = Math.max(sw.max, Math.min(1.1, pull));
    showMeter(Math.max(0, sw.max), isPutting() ? ((sw.max * puttScale()) * FT).toFixed(0) + ' ft' : undefined);
    if (sw.max > 0.06 && pull < sw.max - 0.07) { sw.phase = 'fwd'; sw.tf = now; sw.yf = e.clientY; sw.xf = e.clientX; }
  } else if (sw.phase === 'fwd') {
    if (e.clientY < sw.y0 - span * 0.22) release(e.clientX, e.clientY, now);
  }
});
function release(x, y, now) {
  const span = sw.r.height * 0.55;
  const dist = (sw.yf - y) / span;
  const el = Math.max(16, now - sw.tf) / 1000;
  const speedN = dist / el;
  const ang = Math.atan2(x - sw.xf, sw.yf - y) * 180 / Math.PI;
  let power = sw.max;
  if (!isPutting()) power *= 0.72 + 0.28 * THREE.MathUtils.smoothstep(speedN, 1.0, 4.5);
  const face = THREE.MathUtils.clamp(ang * (isPutting() ? 0.5 : 0.4), -14, 14);
  showMeter(power);
  sw = null; resetPad();
  takeShot(power, face);
}
function resetPad() { dot.style.left = '50%'; dot.style.top = '30%'; line.setAttribute('points', ''); $('padHint').style.opacity = 0.8; }
pad.addEventListener('pointerup', (e) => {
  if (!sw || e.pointerId !== sw.id) return;
  if (sw.phase === 'fwd' && (sw.yf - e.clientY) / (sw.r.height * 0.55) > sw.max * 0.4) return release(e.clientX, e.clientY, performance.now());
  sw = null; resetPad(); showMeter(0, '');
});
pad.addEventListener('pointercancel', () => { sw = null; resetPad(); });

// keyboard (desktop): arrows aim, space hold/release
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') aimHold = -1; if (e.key === 'ArrowRight') aimHold = 1;
  if (e.key === 'ArrowUp') $('clubPrev').click(); if (e.key === 'ArrowDown') $('clubNext').click();
});
addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') aimHold = 0; });

// ---------- input: motion swing ----------
const mo = { armed: false, phase: 'idle', axis: [0, 0, 0], back: 0, down: 0, peak: 0, twist: 0, last: 0, t0: 0, accPeak: 0, hasGyro: false };
const mbtn = $('motionBtn');
function setMotionMode(on) {
  S.motion = on;
  mbtn.classList.toggle('hidden', !on); pad.classList.toggle('hidden', on);
}
async function enableMotion() {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      const r = await DeviceMotionEvent.requestPermission();
      if (r !== 'granted') throw new Error('denied');
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) { try { await DeviceOrientationEvent.requestPermission(); } catch (_) {} }
    }
    if (!window.isSecureContext) throw new Error('insecure');
    let got = false;
    const probe = (e) => { got = true; };
    addEventListener('devicemotion', probe);
    await new Promise((r) => setTimeout(r, 600));
    removeEventListener('devicemotion', probe);
    if (!got) throw new Error('nosensor');
    addEventListener('devicemotion', onMotion);
    setMotionMode(true);
    toast('MOTION SWING ON');
    return true;
  } catch (err) {
    setMotionMode(false);
    toast(err.message === 'nosensor' ? 'NO MOTION SENSOR<br/><small>using touch swing</small>' : 'MOTION NOT ALLOWED<br/><small>using touch swing</small>');
    return false;
  }
}
mbtn.addEventListener('pointerdown', (e) => {
  e.preventDefault(); if (S.phase !== 'aim') return;
  mbtn.setPointerCapture(e.pointerId);
  Object.assign(mo, { armed: true, phase: 'ready', axis: [0, 0, 0], back: 0, down: 0, peak: 0, twist: 0, last: performance.now(), t0: performance.now(), accPeak: 0 });
  mbtn.classList.add('armed'); $('motionBtnTxt').textContent = 'SWING!'; $('motionSub').textContent = 'take it back…';
});
const disarm = () => { mo.armed = false; mo.phase = 'idle'; mbtn.classList.remove('armed'); $('motionBtnTxt').textContent = 'HOLD & SWING'; $('motionSub').textContent = 'hold phone like a club'; };
mbtn.addEventListener('pointerup', () => { if (mo.armed && mo.phase !== 'down') { disarm(); showMeter(0, ''); } });
mbtn.addEventListener('pointercancel', disarm);

function onMotion(e) {
  if (!mo.armed) return;
  const now = performance.now();
  const dt = Math.min(0.05, Math.max(0.001, (now - mo.last) / 1000)); mo.last = now;
  const rr = e.rotationRate;
  const a = e.acceleration && e.acceleration.x !== null ? e.acceleration : null;
  const accMag = a ? Math.hypot(a.x, a.y, a.z) : 0;
  const putting = isPutting();
  const full = putting ? 240 : S.sens;
  if (!rr || rr.alpha === null) {
    // accelerometer-only fallback: peak linear acceleration sets power
    mo.accPeak = Math.max(mo.accPeak, accMag);
    if (mo.phase === 'ready' && accMag > 4) mo.phase = 'down';
    if (mo.phase === 'down') { showMeter(mo.accPeak / (putting ? 6 : 28)); if (accMag < mo.accPeak * 0.35 && mo.accPeak > 5) { const p = Math.min(1.1, mo.accPeak / (putting ? 6 : 28)); disarm(); takeShot(p, 0); } }
    return;
  }
  const w = [rr.beta || 0, rr.gamma || 0, rr.alpha || 0]; // device x, y, z (deg/s)
  const mag = Math.hypot(w[0], w[1], w[2]);
  if (mo.phase === 'ready') {
    if (mag > (putting ? 25 : 60)) mo.phase = 'back';
    if (now - mo.t0 > 8000) disarm();
  }
  if (mo.phase === 'back') {
    for (let i = 0; i < 3; i++) mo.axis[i] += w[i] * dt;
    const al = Math.hypot(...mo.axis) || 1; const ax = mo.axis.map((v) => v / al);
    const proj = w[0] * ax[0] + w[1] * ax[1] + w[2] * ax[2];
    mo.back = al;
    showMeter(Math.min(1.1, mo.back / (putting ? 40 : 160)), Math.round(mo.back) + '°');
    $('motionSub').textContent = 'now swing through!';
    if (proj < -(putting ? 30 : 90)) { mo.phase = 'down'; mo.ax = ax; mo.down = 0; mo.peak = 0; mo.twist = 0; }
    if (now - mo.t0 > 6000) disarm();
  } else if (mo.phase === 'down') {
    const ax = mo.ax;
    const proj = -(w[0] * ax[0] + w[1] * ax[1] + w[2] * ax[2]);
    mo.down += Math.max(0, proj) * dt;
    mo.peak = Math.max(mo.peak, proj);
    // rotation about the phone's long axis (the "shaft") that isn't part of the swing arc = face rotation
    const orthoY = w[1] - (w[0] * ax[0] + w[1] * ax[1] + w[2] * ax[2]) * ax[1];
    mo.twist += orthoY * dt;
    showMeter(Math.min(1.1, mo.peak / full));
    const throughImpact = mo.down >= mo.back * 0.9;
    const fading = mo.peak > (putting ? 40 : 200) && proj < mo.peak * 0.4;
    if (throughImpact || fading) {
      const power = Math.min(1.1, mo.peak / full);
      const face = THREE.MathUtils.clamp(mo.twist * 0.12, -14, 14);
      disarm();
      takeShot(power, face);
    }
  }
}

// ---------- intro ----------
$('motionStart').onclick = async () => { await enableMotion(); startGame(); };
$('touchStart').onclick = () => { setMotionMode(false); startGame(); };
function startGame() {
  $('intro').classList.add('hidden'); $('hud').classList.remove('hidden');
  resetHole();
  try { if (isMobile && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {}); } catch (_) {}
}
$('loadMsg').textContent = '';

// ---------- quality / perf ----------
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

// ---------- pin marker ----------
const pm = $('pinMarker'), pmd = $('pinMarkerDist');
const pinTop = new THREE.Vector3(C.PIN.x, course.heightAt(C.PIN.x, C.PIN.z) + 2.5, C.PIN.z);
function updatePinMarker() {
  const show = S.phase === 'aim' && distToPin() > 12;
  if (!show) { pm.style.display = 'none'; return; }
  const v = pinTop.clone().project(camera);
  if (v.z > 1) { pm.style.display = 'none'; return; }
  pm.style.display = 'block';
  pm.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; pm.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
  pmd.textContent = (distToPin() * YD).toFixed(0) + 'y';
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let elapsed = 0;
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  W.timeU.value = elapsed;
  W.water.material.uniforms.time.value += dt * 0.35; W.skyTime.value = elapsed;
  W.updateFlag(elapsed, Math.atan2(S.wind.x, -S.wind.z) * 0 + (S.wind.ang - Math.PI / 2) * -1);

  if (S.phase === 'aim' && aimHold) {
    S.aimYaw += aimHold * dt * (isPutting() ? 0.12 : 0.22);
    updateAimVisuals(); updateHUD();
  }
  if (S.phase === 'flight' || (S.phase === 'holed' && S.shot)) {
    S.playT += dt;
    const p = sampleShot(S.playT);
    ball.position.set(p.x, p.y, p.z);
    const fr = S.shot.res.frames;
    if (!S.shot.putt) {
      tracerPts = fr.slice(0, p.idx + 1).filter((f, i) => f.air || i < 2);
      if (tracerPts.length) tracerPts.push({ x: p.x, y: p.y, z: p.z });
      if (!p.air) tracerPts = fr.filter((f) => f.air);
    }
    for (const ev of S.shot.res.events) if (ev.type === 'water' && !ev.done && S.playT >= ev.t) { ev.done = true; doSplash(ev.x, ev.z); ball.visible = false; }
    const end = fr[fr.length - 1].t;
    if (S.phase === 'flight' && S.playT >= end) {
      S.stopT += dt;
      if (S.stopT > 0.9) { ball.visible = true; finishShot(); }
    }
  } else {
    ball.position.set(S.ball.x, S.ball.y, S.ball.z);
  }
  updateCamera(dt);
  // keep ball visible at distance
  const cd = camera.position.distanceTo(ball.position);
  ball.scale.setScalar(Math.max(1, cd * 0.0022 / P.BALL_R * 0.5));
  const gh = course.heightAt(ball.position.x, ball.position.z);
  blob.position.set(ball.position.x, Math.max(gh, C.WATER_LEVEL) + 0.01, ball.position.z);
  const hAbove = ball.position.y - gh;
  blob.scale.setScalar(P.BALL_R * 3.2 * ball.scale.x * (1 + hAbove * 0.05));
  blob.material.opacity = Math.max(0, 1 - hAbove / 25);
  blob.visible = ball.visible && gh > C.WATER_LEVEL;
  updateTracer();
  // chevrons flow downhill
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

// test hooks for automated screenshots
window.__golf = { S, startGame, takeShot, setMotionMode, camera, resetHole, newShotSetup, placeBall, nominal };
if (params.has('clean')) document.body.classList.add('clean');
if (params.has('play')) { $('touchStart').click(); }
