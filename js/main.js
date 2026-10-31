// Minimal hole: swing, physics, one par 3, a camera behind the ball.
import * as THREE from 'three';
import * as C from './course.js';
import {
  BALL_R, CUP_R, CLUBS, SURF, launchFromSwing, launchPutt, simulate, stimpDecel,
} from './engine.js';
import { createCamera } from './camera.js';
import { createHud } from './hud.js';
import { bindAim } from './aim.js';
import { createSwingApp } from './swing/index.js';
import { launchFromStrike, makeStrike } from './swing/strike.js';

const $ = (id) => document.getElementById(id);
const YD = 1 / 0.9144;
const FT = 3.28084;

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas: $('c') });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ecff0);
scene.fog = new THREE.Fog(0xb7dff2, 260, 980);

const cam = createCamera(THREE);
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3d6a32, 0.85));
const sun = new THREE.DirectionalLight(0xfff1d6, 1.35);
sun.position.set(-40, 80, 30);
scene.add(sun);

const grid = C.buildGrid(320, 380);
const course = C.makeCourse(grid);
buildGround(grid);
buildFlag();
const aimLine = buildAim();

const ball = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_R, 24, 16),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.02 }),
);
const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.14, 18),
  new THREE.MeshBasicMaterial({ color: 0x102010, transparent: true, opacity: 0.32, depthWrite: false }),
);
shadow.rotation.x = -Math.PI / 2;
scene.add(ball, shadow);

const hud = createHud($('hud'));
const state = {
  ball: { x: 0, y: 0, z: -4.5 },
  lie: SURF.TEE,
  aim: 0,
  club: 2,
  stroke: 1,
  wind: rollWind(),
  phase: 'address',
  shot: null,
  play: 0,
  prev: null,
  holed: false,
};

function rollWind() {
  const mph = 2 + Math.random() * 5;
  const ang = Math.random() * Math.PI * 2;
  const ms = mph * 0.44704;
  return { x: Math.sin(ang) * ms, z: -Math.cos(ang) * ms, mph, ang };
}

function pinDist(p = state.ball) {
  return Math.hypot(C.PIN.x - p.x, C.PIN.z - p.z);
}
function yawToPin() {
  return Math.atan2(C.PIN.x - state.ball.x, -(C.PIN.z - state.ball.z));
}

function place(x, z) {
  const y = course.heightAt(x, z);
  state.ball = { x, y: y + BALL_R, z };
  state.lie = course.surfaceAt(x, z);
  ball.position.set(x, state.ball.y, z);
}

function putting() {
  return state.lie === SURF.GREEN && pinDist() < 28;
}

function syncClub() {
  if (putting()) state.club = CLUBS.length - 1;
  else if (CLUBS[state.club].putter) state.club = clubFor(pinDist());
}

function clubFor(metres) {
  const want = metres * YD;
  let best = 0, err = 1e9;
  CLUBS.forEach((c, i) => {
    if (c.putter) return;
    const d = Math.abs(c.launch && TRACK_CARRY[c.id] ? TRACK_CARRY[c.id] - want : 1e9);
    if (d < err) { err = d; best = i; }
  });
  return best;
}

// Model carries at a centred strike, metres, filled once.
const TRACK_CARRY = {};
function fillCarries() {
  for (const c of CLUBS) {
    if (c.putter) continue;
    const launch = launchFromSwing(c, 1, 0, 0, SURF.TEE);
    const res = simulate(flat(), { x: 0, y: BALL_R, z: 0 }, launch, calmAir());
    TRACK_CARRY[c.id] = res.monitor.carryYd;
  }
}
function calmAir() {
  return {
    tempC: 20, humidity: 0.4, altitudeM: 0, stimp: 11, firmness: 0.55, rain: false,
    wind: { speed: 0, dirX: 0, dirZ: -1, refHeight: 2 },
  };
}
function shotEnv(putt) {
  const env = calmAir();
  if (putt) return env;
  const sp = Math.hypot(state.wind.x, state.wind.z);
  if (sp > 1e-6) {
    env.wind.speed = sp;
    env.wind.dirX = state.wind.x / sp;
    env.wind.dirZ = state.wind.z / sp;
  }
  return env;
}
function flat() {
  return { heightAt: () => 0, normalAt: () => ({ x: 0, y: 1, z: 0 }), surfaceAt: () => SURF.FAIRWAY, waterLevel: -5, cup: null, bounds: null };
}

function paint() {
  const d = pinDist();
  hud.els.toPin.textContent = d < 20 ? (d * FT).toFixed(0) + ' ft' : (d * YD).toFixed(0) + ' yds';
  hud.els.stroke.textContent = state.holed ? 'Holed' : 'Stroke ' + state.stroke;
  const club = CLUBS[state.club];
  hud.els.clubId.textContent = club.id;
  hud.els.clubCarry.textContent = club.putter ? 'putt' : (TRACK_CARRY[club.id] ? TRACK_CARRY[club.id].toFixed(0) + ' yds' : '');
  const locked = putting();
  hud.els.prev.disabled = locked;
  hud.els.next.disabled = locked;
  hud.els.prev.style.visibility = locked ? 'hidden' : 'visible';
  hud.els.next.style.visibility = locked ? 'hidden' : 'visible';
  hud.els.windVal.textContent = state.wind.mph.toFixed(0) + ' mph';
  const rel = state.wind.ang - state.aim;
  hud.els.windArrow.style.transform = `rotate(${(rel * 180 / Math.PI) - 90}deg)`;
  aimLine.visible = state.phase === 'address' && !state.holed;
  if (aimLine.visible) layoutAim();
}

function layoutAim() {
  const dx = Math.sin(state.aim), dz = -Math.cos(state.aim);
  const n = aimLine.geometry.attributes.position.count;
  const reach = putting() ? Math.max(0.4, pinDist() - 0.35) : Math.min(14, pinDist() - 0.4);
  for (let i = 0; i < n; i++) {
    const t = reach * (i + 1) / n;
    const x = state.ball.x + dx * t, z = state.ball.z + dz * t;
    aimLine.geometry.attributes.position.setXYZ(i, x, course.heightAt(x, z) + 0.045, z);
  }
  aimLine.geometry.attributes.position.needsUpdate = true;
}

function address() {
  syncClub();
  state.phase = 'address';
  state.shot = null;
  cam.setAddress(state.ball, state.aim, (x, z) => course.heightAt(x, z));
  cam.snap();
  paint();
}

function holeCourse() {
  return {
    heightAt: (x, z) => course.heightAt(x, z),
    normalAt: (x, z) => course.normalAt(x, z),
    surfaceAt: (x, z) => course.surfaceAt(x, z),
    waterLevel: C.WATER_LEVEL,
    cup: { x: C.PIN.x, z: C.PIN.z, r: CUP_R },
    bounds: C.BOUNDS,
  };
}

function strike(s, ms = 0) {
  if (state.phase !== 'address' || state.holed) return;
  const strikeIn = makeStrike(s);
  const club = CLUBS[state.club];
  const putt = !!club.putter;
  let launch;
  if (putt) {
    const dist = Math.max(0.35, strikeIn.clubSpeed * strikeIn.clubSpeed * 24);
    const speed = Math.sqrt(2 * stimpDecel(11) * dist);
    launch = launchPutt(speed, state.aim + strikeIn.faceToTarget * Math.PI / 180 * 0.25);
  } else {
    launch = launchFromStrike(club, strikeIn, state.aim, state.lie);
  }
  const res = simulate(holeCourse(), { ...state.ball }, launch, shotEnv(putt), { putt });
  swings.stats.record(swings.id, {
    carryYd: res.monitor.carryYd,
    stockYd: TRACK_CARRY[club.id] || res.monitor.carryYd,
    offlineYd: res.monitor.offlineYd,
    grade: strikeIn.grade,
    ms,
    putt,
  });
  swings.refresh();
  state.prev = { ...state.ball, lie: state.lie };
  state.shot = { res, putt, aim: state.aim };
  state.play = 0;
  state.phase = 'flight';
  hud.hideNote();
  paint();
}

function sample(t) {
  const fr = state.shot.res.frames;
  const f = Math.min(fr.length - 1, t * 60);
  const i = Math.floor(f), k = f - i;
  const a = fr[i], b = fr[Math.min(fr.length - 1, i + 1)];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, i };
}

function finish() {
  const { res } = state.shot;
  const f = res.final;
  if (res.result === 'water') {
    hud.note('Water. Stroke and distance.');
    state.stroke += 2;
    place(state.prev.x, state.prev.z);
    state.lie = state.prev.lie;
  } else if (res.result === 'holed') {
    state.holed = true;
    state.ball = { x: C.PIN.x, y: course.heightAt(C.PIN.x, C.PIN.z) + 0.02, z: C.PIN.z };
    ball.position.set(state.ball.x, state.ball.y, state.ball.z);
    hud.note('In the hole.');
    state.phase = 'address';
    cam.setAddress(state.ball, state.aim, (x, z) => course.heightAt(x, z));
    cam.snap();
    paint();
    return;
  } else {
    place(f.x, f.z);
    state.stroke += 1;
    if (res.result === 'plugged') hud.note('Plugged.');
  }
  state.aim = yawToPin();
  address();
}

function restart() {
  state.stroke = 1;
  state.holed = false;
  state.wind = rollWind();
  place(0, -4.5);
  state.aim = yawToPin();
  state.club = clubFor(pinDist());
  hud.hideNote();
  swings.reroll();
  address();
}

hud.els.restart.onclick = restart;
hud.els.prev.onclick = () => { if (!putting()) { state.club = (state.club + CLUBS.length - 1) % (CLUBS.length - 1); paint(); } };
hud.els.next.onclick = () => { if (!putting()) { state.club = (state.club + 1) % (CLUBS.length - 1); paint(); } };

const swings = createSwingApp({
  root: hud.swingEl,
  pickBtn: hud.els.swingPick,
  sheet: hud.els.sheet,
  ready: () => state.phase === 'address' && !state.holed,
  onStrike: strike,
});
bindAim(renderer.domElement, (dx) => {
  if (state.phase !== 'address' || state.holed) return;
  state.aim += dx * 0.004;
  paint();
  cam.setAddress(state.ball, state.aim, (x, z) => course.heightAt(x, z));
});

function buildGround(g) {
  const { nx, nz, w, d, heights } = g;
  const pos = [], col = [], idx = [];
  const tint = (s) => s === C.SURF.GREEN ? [0.18, 0.62, 0.30]
    : s === C.SURF.TEE ? [0.34, 0.66, 0.32]
    : s === C.SURF.FAIRWAY ? [0.42, 0.62, 0.22]
    : s === C.SURF.FRINGE ? [0.34, 0.50, 0.18]
    : s === C.SURF.BUNKER || s === C.SURF.SAND ? [0.82, 0.74, 0.50]
    : s === C.SURF.WATER ? [0.20, 0.48, 0.62]
    : [0.28, 0.40, 0.16];
  for (let j = 0; j <= nz; j++) {
    const z = C.BOUNDS.minZ + (j / nz) * d;
    for (let i = 0; i <= nx; i++) {
      const x = C.BOUNDS.minX + (i / nx) * w;
      const y = heights[j * (nx + 1) + i];
      pos.push(x, y, z);
      const c = tint(course.surfaceAt(x, z));
      col.push(c[0], c[1], c[2]);
    }
  }
  const row = nx + 1;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * row + i;
    idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildFlag() {
  const y = course.heightAt(C.PIN.x, C.PIN.z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.13, 8), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }));
  pole.position.set(C.PIN.x, y + 1.065, C.PIN.z);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.02), new THREE.MeshStandardMaterial({ color: 0xd64545 }));
  flag.position.set(C.PIN.x + 0.24, y + 1.95, C.PIN.z);
  const cup = new THREE.Mesh(new THREE.CircleGeometry(CUP_R, 24), new THREE.MeshBasicMaterial({ color: 0x141414 }));
  cup.rotation.x = -Math.PI / 2;
  cup.position.set(C.PIN.x, y + 0.015, C.PIN.z);
  const lip = new THREE.Mesh(
    new THREE.RingGeometry(CUP_R * 0.98, CUP_R * 1.35, 24),
    new THREE.MeshBasicMaterial({ color: 0xf7f7f7, side: THREE.DoubleSide }),
  );
  lip.rotation.x = -Math.PI / 2;
  lip.position.set(C.PIN.x, y + 0.03, C.PIN.z);
  scene.add(pole, flag, cup, lip);
}

function buildAim() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(18 * 3), 3));
  const line = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfff6e8, size: 0.11, sizeAttenuation: true }));
  scene.add(line);
  return line;
}

function layout() {
  cam.resize(innerWidth, innerHeight);
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener('resize', layout);
if (window.visualViewport) visualViewport.addEventListener('resize', layout);
layout();

fillCarries();
restart();

const clock = new THREE.Clock();
function seatShadow() {
  const x = ball.position.x, z = ball.position.z;
  const g = course.heightAt(x, z);
  const h = Math.max(0, ball.position.y - BALL_R - g);
  shadow.position.set(x, g + 0.03, z);
  const s = 1 + Math.min(3, h * 0.18);
  shadow.scale.setScalar(s);
  shadow.material.opacity = 0.34 / (1 + h * 0.22);
}

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  let flying = false;
  if (state.phase === 'flight' && state.shot) {
    state.play += dt;
    const end = state.shot.res.frames[state.shot.res.frames.length - 1].t;
    const p = sample(Math.min(state.play, end));
    ball.position.set(p.x, p.y, p.z);
    cam.setFollow(ball.position, state.shot.aim, (x, z) => course.heightAt(x, z), state.shot.putt);
    const left = pinDist(ball.position);
    hud.els.toPin.textContent = left < 20 ? (left * FT).toFixed(0) + ' ft' : (left * YD).toFixed(0) + ' yds';
    if (state.play >= end + 0.45) finish();
    flying = state.phase === 'flight';
  }
  if (state.phase === 'address') {
    cam.setAddress(state.ball, state.aim, (x, z) => course.heightAt(x, z));
    cam.snap();
    ball.position.set(state.ball.x, state.ball.y, state.ball.z);
  } else if (flying) {
    cam.update(dt, true);
  }
  if (state.phase === 'address') swings.tick(dt);
  seatShadow();
  renderer.render(scene, cam.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function hit(opts = {}) {
  if (opts.club != null) state.club = opts.club;
  if (opts.aim != null) state.aim = opts.aim;
  syncClub();
  paint();
  strike(makeStrike({
    clubSpeed: opts.power ?? 1,
    faceToTarget: opts.face ?? 0,
    path: opts.path ?? 0,
    contact: opts.contact ?? 1,
    tempo: 3,
  }), opts.ms ?? 400);
}

window.__core = { state, strike, restart, hit, place, CLUBS, SURF, cam, course, C, swings };
