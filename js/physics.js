// Golf ball physics: drag, Magnus lift, spin decay, wind, bounce/roll per surface, green slope, cup.
import { SURF, WATER_LEVEL, PIN } from './course.js';

export const BALL_R = 0.02135, BALL_M = 0.04593, RHO = 1.225, G = 9.81;
const AREA = Math.PI * BALL_R * BALL_R;
export const CUP_R = 0.054;
const MPH = 0.44704, RPM = Math.PI / 30;

// Tour-like launch numbers at 100% power (ball speed mph, launch deg, spin rpm)
export const CLUBS = [
  { id: '5i', name: '5 Iron', speed: 132, launch: 12.1, spin: 5360 },
  { id: '6i', name: '6 Iron', speed: 127, launch: 14.1, spin: 6230 },
  { id: '7i', name: '7 Iron', speed: 120, launch: 16.3, spin: 7100 },
  { id: '8i', name: '8 Iron', speed: 115, launch: 18.1, spin: 8000 },
  { id: '9i', name: '9 Iron', speed: 109, launch: 20.4, spin: 8650 },
  { id: 'PW', name: 'Pitching Wedge', speed: 102, launch: 24.2, spin: 9300 },
  { id: 'SW', name: 'Sand Wedge', speed: 86, launch: 30, spin: 10200 },
  { id: 'PT', name: 'Putter', putter: true },
];

// restitution (normal), impact friction (tangential), spin bite, rolling resistance coefficient
const GROUND = {
  [SURF.GREEN]:   { e: 0.30, f: 0.20, bite: 0.55, roll: 0.058 },
  [SURF.FRINGE]:  { e: 0.30, f: 0.28, bite: 0.40, roll: 0.11 },
  [SURF.FAIRWAY]: { e: 0.36, f: 0.24, bite: 0.30, roll: 0.10 },
  [SURF.TEE]:     { e: 0.36, f: 0.24, bite: 0.30, roll: 0.10 },
  [SURF.ROUGH]:   { e: 0.20, f: 0.50, bite: 0.10, roll: 0.32 },
  [SURF.BUNKER]:  { e: 0.04, f: 0.85, bite: 0.05, roll: 1.4 },
  [SURF.SAND]:    { e: 0.06, f: 0.80, bite: 0.05, roll: 1.2 },
};
// Lie penalties for the next shot: speed multiplier, spin multiplier
export const LIE = {
  [SURF.TEE]: { speed: 1, spin: 1 }, [SURF.FAIRWAY]: { speed: 1, spin: 1 },
  [SURF.FRINGE]: { speed: 0.98, spin: 0.9 }, [SURF.GREEN]: { speed: 1, spin: 1 },
  [SURF.ROUGH]: { speed: 0.9, spin: 0.55 }, [SURF.BUNKER]: { speed: 0.72, spin: 0.7 },
  [SURF.SAND]: { speed: 0.78, spin: 0.7 },
};

const len = (v) => Math.hypot(v.x, v.y, v.z);

/**
 * Build launch conditions.
 * aimYaw: radians, 0 = toward -Z; positive = to the right (+X)
 * face: degrees, + = open (right) for a right-handed player
 */
export function launchFromSwing(club, power, face, aimYaw, lie, mods = {}) {
  const lieM = LIE[lie] || LIE[SURF.FAIRWAY];
  const p = Math.max(0.05, power);
  const speedMul = mods.speedMul ?? 1;
  const spinMul = mods.spinMul ?? 1;
  const speed = club.speed * MPH * Math.min(p, 1.08) * lieM.speed * speedMul;
  // partial swings launch slightly lower with less spin
  const launch = club.launch * (0.85 + 0.15 * Math.min(p, 1)) * (lie === SURF.BUNKER ? 1.15 : 1);
  const spinRpm = club.spin * (0.6 + 0.4 * Math.min(p, 1)) * lieM.spin * spinMul;
  const startDir = aimYaw + (face * 0.75) * Math.PI / 180;       // start line mostly from face
  const tilt = Math.max(-35, Math.min(35, face * 1.8)) * Math.PI / 180; // spin-axis tilt -> curve
  const la = launch * Math.PI / 180;
  const dirX = Math.sin(startDir), dirZ = -Math.cos(startDir);
  const v = { x: speed * Math.cos(la) * dirX, y: speed * Math.sin(la), z: speed * Math.cos(la) * dirZ };
  // backspin axis = horizontal, perpendicular to travel, pointing to golfer's left (so w x v gives lift)
  // right vector of travel = (-dirZ, 0, dirX); backspin axis = -right... compute: lift = w x v must be +Y.
  const right = { x: -dirZ, y: 0, z: dirX };
  // w = -right gives (-right) x forward = up. Tilt rotates axis around travel dir.
  const ax = { x: right.x * Math.cos(tilt), y: -Math.sin(tilt), z: right.z * Math.cos(tilt) };
  const w = spinRpm * RPM;
  const spin = { x: ax.x * w, y: ax.y * w, z: ax.z * w };
  return { v, spin, speed, launchDeg: launch, spinRpm };
}

export function launchPutt(speed, aimYaw) {
  return { v: { x: speed * Math.sin(aimYaw), y: 0, z: -speed * Math.cos(aimYaw) }, spin: { x: 0, y: 0, z: 0 }, speed, launchDeg: 0, spinRpm: 0 };
}

/**
 * Simulate a whole shot ahead of time. Returns playback frames (60 Hz) and events.
 */
export function simulate(course, start, launch, wind, opts = {}) {
  const dt = 1 / 240;
  const frameEvery = 4;
  const p = { ...start };
  const v = { ...launch.v };
  const s = { ...launch.spin };
  let mode = opts.putt ? 'roll' : 'air';
  if (mode === 'roll') p.y = course.heightAt(p.x, p.z) + BALL_R;
  const frames = [];
  const events = [];
  let t = 0, step = 0, carry = null, apex = p.y, landed = false, result = 'stopped';
  let rest = 0, bounces = 0;
  const maxT = 40;
  while (t < maxT) {
    if (step % frameEvery === 0) frames.push({ x: p.x, y: p.y, z: p.z, t, air: mode === 'air' });
    step++; t += dt;
    if (mode === 'air') {
      const vr = { x: v.x - wind.x, y: v.y, z: v.z - wind.z };
      const sp = len(vr) || 1e-6;
      const w = len(s);
      const S = BALL_R * w / sp;
      const Cd = 0.25 + 0.18 * S;
      const Cl = Math.min(0.32, 1.05 * S);
      const k = 0.5 * RHO * AREA / BALL_M;
      // drag
      let ax = -k * Cd * sp * vr.x, ay = -k * Cd * sp * vr.y - G, az = -k * Cd * sp * vr.z;
      if (w > 1) {
        // Magnus: direction of (w x v)
        const cx = s.y * vr.z - s.z * vr.y, cy = s.z * vr.x - s.x * vr.z, cz = s.x * vr.y - s.y * vr.x;
        const cl = Math.hypot(cx, cy, cz) || 1;
        const f = k * Cl * sp * sp / cl;
        ax += f * cx; ay += f * cy; az += f * cz;
      }
      v.x += ax * dt; v.y += ay * dt; v.z += az * dt;
      p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
      const decay = Math.exp(-dt / 22);
      s.x *= decay; s.y *= decay; s.z *= decay;
      apex = Math.max(apex, p.y);
      const h = course.heightAt(p.x, p.z);
      if (p.y < WATER_LEVEL && h < WATER_LEVEL) {
        if (carry === null) carry = { x: p.x, z: p.z };
        result = 'water'; events.push({ type: 'water', x: p.x, y: WATER_LEVEL, z: p.z, t });
        break;
      }
      if (p.y - BALL_R <= h) {
        const surf = course.surfaceAt(p.x, p.z);
        if (surf === 0) { result = 'water'; if (carry === null) carry = { x: p.x, z: p.z }; events.push({ type: 'water', x: p.x, y: WATER_LEVEL, z: p.z, t }); break; }
        if (carry === null) carry = { x: p.x, z: p.z, surf };
        // slam-dunk into the cup
        const dc = Math.hypot(p.x - PIN.x, p.z - PIN.z);
        if (dc < CUP_R * 1.1 && Math.hypot(v.x, v.z) < 6) { p.y = h - 0.03; result = 'holed'; frames.push({ ...p, t, air: false }); break; }
        p.y = h + BALL_R;
        const n = course.normalAt(p.x, p.z);
        const g = GROUND[surf];
        const vn = v.x * n.x + v.y * n.y + v.z * n.z;
        const vt = { x: v.x - vn * n.x, y: v.y - vn * n.y, z: v.z - vn * n.z };
        const vtl = len(vt) || 1e-6;
        const tdir = { x: vt.x / vtl, y: vt.y / vtl, z: vt.z / vtl };
        // backspin component (about axis perpendicular to tangential travel)
        const backspinRpm = Math.max(0, (s.x * (-tdir.z) + s.z * tdir.x)) / RPM;
        let newT = vtl * (1 - g.f) - Math.abs(vn) * g.bite * (backspinRpm / 7000);
        // strong spin on firm surfaces can make it check / spin back
        newT = Math.max(newT, -vtl * 0.35);
        const newN = -vn * g.e;
        v.x = tdir.x * newT + n.x * newN; v.y = tdir.y * newT + n.y * newN; v.z = tdir.z * newT + n.z * newN;
        s.x *= 0.45; s.y *= 0.45; s.z *= 0.45;
        bounces++;
        events.push({ type: 'bounce', x: p.x, y: p.y, z: p.z, t, surf, speed: Math.abs(vn) });
        if (newN < 0.9 || bounces > 12) { mode = 'roll'; }
      }
    } else {
      // rolling on the surface
      const h = course.heightAt(p.x, p.z);
      const surf = course.surfaceAt(p.x, p.z);
      if (surf === 0) { result = 'water'; events.push({ type: 'water', x: p.x, y: WATER_LEVEL, z: p.z, t }); break; }
      const n = course.normalAt(p.x, p.z);
      const g = GROUND[surf];
      // project velocity onto tangent plane
      const vn = v.x * n.x + v.y * n.y + v.z * n.z;
      v.x -= vn * n.x; v.y -= vn * n.y; v.z -= vn * n.z;
      // gravity along slope (rolling sphere: 5/7)
      const gt = { x: -G * n.y * n.x, y: -G + G * n.y * n.y, z: -G * n.y * n.z };
      let ax = gt.x * 5 / 7, ay = gt.y * 5 / 7, az = gt.z * 5 / 7;
      const sp = len(v);
      const slopeAcc = Math.hypot(ax, ay, az);
      const fr = g.roll * G * n.y;
      if (sp < 0.025 && slopeAcc < fr * 1.15) {
        rest += dt; v.x = v.y = v.z = 0;
        if (rest > 0.15) { result = 'stopped'; break; }
      } else {
        rest = 0;
        if (sp > 1e-4) { ax -= fr * v.x / sp; ay -= fr * v.y / sp; az -= fr * v.z / sp; }
        const nvx = v.x + ax * dt, nvy = v.y + ay * dt, nvz = v.z + az * dt;
        // friction must not reverse direction by itself
        if (sp > 1e-4 && (nvx * v.x + nvy * v.y + nvz * v.z) < 0 && slopeAcc < fr) { v.x = v.y = v.z = 0; }
        else { v.x = nvx; v.y = nvy; v.z = nvz; }
      }
      p.x += v.x * dt; p.z += v.z * dt;
      p.y = course.heightAt(p.x, p.z) + BALL_R;
      // cup
      const dc = Math.hypot(p.x - PIN.x, p.z - PIN.z);
      const spd = Math.hypot(v.x, v.z);
      if (dc < CUP_R && spd < 1.45) {
        result = 'holed'; frames.push({ x: PIN.x, y: course.heightAt(PIN.x, PIN.z) - 0.04, z: PIN.z, t, air: false }); break;
      }
      if (dc < CUP_R * 0.95 && spd >= 1.45) {
        // lip-out: deflect & slow
        v.x *= 0.6; v.z *= 0.6; events.push({ type: 'lip', t });
      }
      if (p.x < -168 || p.x > 168 || p.z < -328 || p.z > 68) { result = 'water'; break; }
    }
  }
  if (frames.length === 0 || frames[frames.length - 1].t < t) frames.push({ x: p.x, y: p.y, z: p.z, t, air: false });
  const final = { x: p.x, y: p.y, z: p.z };
  return { frames, events, carry, final, result, apex: apex - start.y, duration: t };
}
