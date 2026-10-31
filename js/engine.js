/**
 * Golf ball engine. SI units. Fixed step 1/240 s. Deterministic.
 * Sources and the values that are estimates are listed in PHYSICS.md.
 */
export const DT = 1 / 240;
export const G = 9.80665;
export const BALL_R = 0.021335; // 42.67 mm diameter, USGA/R&A
export const BALL_M = 0.04593;
export const BALL_I = 0.4 * BALL_M * BALL_R * BALL_R;
export const CUP_R = 0.054; // 108 mm diameter
export const M_PER_YD = 0.9144;
export const FT_PER_M = 3.280839895;
const AREA = Math.PI * BALL_R * BALL_R;
const MPH = 0.44704;
const RPM = Math.PI / 30;

/**
 * Drag and lift.
 * Smits & Smith 1994: C_L = 0.54 S^0.4, spin part of drag 0.18 S, S = r ω / V.
 * Bearman & Harvey 1976: dimpled-ball drag falls from about 0.48 below the
 * crisis to about 0.25 once Re is above ~9e4, and lift saturates near 0.28.
 * The log blend between those two measured drag levels is only the join
 * between the regimes, not a fit to tour carries.
 */
export const AERO = {
  clCoef: 0.54, clExp: 0.4, clMax: 0.28,
  cdSub: 0.48, cdSuper: 0.25, reSub: 5e4, reSuper: 9e4,
  cdS: 0.18, spinDecay: -0.00002,
};

export const SURF = { WATER: 0, GREEN: 1, FRINGE: 2, FAIRWAY: 3, ROUGH: 4, BUNKER: 5, TEE: 6, SAND: 7 };

/** Lie effect on the next strike. Speed/spin factors for rough and sand are estimates. */
export const LIE = {
  [SURF.TEE]: { speed: 1, spin: 1, launch: 1 },
  [SURF.FAIRWAY]: { speed: 1, spin: 1, launch: 1 },
  [SURF.GREEN]: { speed: 1, spin: 1, launch: 1 },
  [SURF.FRINGE]: { speed: 0.99, spin: 0.92, launch: 1 },
  [SURF.ROUGH]: { speed: 0.94, spin: 0.58, launch: 1.03 },
  [SURF.BUNKER]: { speed: 0.7, spin: 0.62, launch: 1.15 },
  [SURF.SAND]: { speed: 0.75, spin: 0.65, launch: 1.1 },
};

/**
 * Tour delivery. clubSpeed, attack, smash, launch and spin are the 2023
 * TrackMan PGA Tour averages. dynamicLoft is inverted from the launch
 * formula below so a centred strike reproduces that launch. SW is not in
 * the published table; its row is estimated.
 */
export const CLUBS = [
  { id: '5i', name: '5 Iron', clubSpeed: 96, smash: 1.41, attack: -3.4, launch: 11.9, spin: 5280, dynamicLoft: 14.6 },
  { id: '6i', name: '6 Iron', clubSpeed: 94, smash: 1.39, attack: -3.7, launch: 14.0, spin: 6204, dynamicLoft: 17.1 },
  { id: '7i', name: '7 Iron', clubSpeed: 92, smash: 1.34, attack: -3.9, launch: 16.1, spin: 7124, dynamicLoft: 19.6 },
  { id: '8i', name: '8 Iron', clubSpeed: 89, smash: 1.33, attack: -4.2, launch: 17.8, spin: 8078, dynamicLoft: 21.7 },
  { id: '9i', name: '9 Iron', clubSpeed: 87, smash: 1.29, attack: -4.3, launch: 20.0, spin: 8793, dynamicLoft: 24.3 },
  { id: 'PW', name: 'Pitching Wedge', clubSpeed: 84, smash: 1.24, attack: -4.7, launch: 23.7, spin: 9316, dynamicLoft: 28.8 },
  { id: 'SW', name: 'Sand Wedge', clubSpeed: 80, smash: 1.16, attack: -5.5, launch: 28, spin: 10200, dynamicLoft: 34.1, estimated: true },
  { id: 'PT', name: 'Putter', putter: true, clubSpeed: 0, smash: 1, attack: 0, launch: 0, spin: 0, dynamicLoft: 0 },
];

/** 2023 TrackMan PGA Tour averages used as the flight-test reference. Height is yards. */
export const TRACKMAN_2023 = {
  '5i': { ball: 135, launch: 11.9, spin: 5280, carry: 199, heightYd: 33, land: 50 },
  '6i': { ball: 130, launch: 14.0, spin: 6204, carry: 188, heightYd: 32, land: 50 },
  '7i': { ball: 123, launch: 16.1, spin: 7124, carry: 176, heightYd: 34, land: 51 },
  '8i': { ball: 118, launch: 17.8, spin: 8078, carry: 164, heightYd: 33, land: 51 },
  '9i': { ball: 112, launch: 20.0, spin: 8793, carry: 152, heightYd: 32, land: 52 },
  PW: { ball: 104, launch: 23.7, spin: 9316, carry: 142, heightYd: 32, land: 52 },
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const len3 = (v) => Math.hypot(v.x, v.y, v.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

/** ISA-style moist air density. 15 °C, sea level, dry → 1.225 kg/m³. */
export function airDensity(tempC = 15, altitudeM = 0, humidity = 0) {
  const T = tempC + 273.15;
  const P = 101325 * Math.exp(-altitudeM / 8434.5);
  const Psat = 610.94 * Math.exp((17.625 * tempC) / (tempC + 243.04));
  const Pv = clamp(humidity, 0, 1) * Psat;
  const Pd = Math.max(0, P - Pv);
  return Pd / (287.058 * T) + Pv / (461.495 * T);
}

export function aeroCoeffs(speed, spinRad) {
  const v = Math.max(0.5, speed);
  const Re = v * (2 * BALL_R) / 1.51e-5;
  const S = BALL_R * spinRad / v;
  const cl = Math.min(AERO.clMax, AERO.clCoef * Math.pow(Math.max(0, S), AERO.clExp));
  let base = AERO.cdSuper;
  if (Re <= AERO.reSub) base = AERO.cdSub;
  else if (Re < AERO.reSuper) {
    const t = (Math.log(Re) - Math.log(AERO.reSub)) / (Math.log(AERO.reSuper) - Math.log(AERO.reSub));
    base = AERO.cdSub + (AERO.cdSuper - AERO.cdSub) * t;
  }
  const cd = base + AERO.cdS * S;
  return { cd, cl, S, Re };
}

/** Log-law wind. speed is m/s at refHeight (default 2 m). z0 = 0.03 m, short grass. */
export function windAt(wind, height) {
  if (!wind || !wind.speed) return { x: 0, y: 0, z: 0 };
  const z0 = 0.03;
  const zRef = wind.refHeight || 2;
  const z = Math.max(z0 * 2, height);
  const profile = Math.log(z / z0) / Math.log(zRef / z0);
  const gust = wind.gustAmp ? wind.gustAmp * Math.sin((wind.gustFreq || 0.7) * (wind.t || 0) + (wind.gustPhase || 0)) : 0;
  const spd = wind.speed * profile * (1 + gust);
  const n = Math.hypot(wind.dirX || 0, wind.dirZ || 0) || 1;
  return { x: (wind.dirX || 0) / n * spd, y: 0, z: (wind.dirZ || 0) / n * spd };
}

export function shapeLabel(faceDeg, pathDeg) {
  const ftp = faceDeg - pathDeg;
  const start = faceDeg * 0.82 + pathDeg * 0.18;
  if (Math.abs(ftp) < 1.6 && Math.abs(start) < 1.3) return 'straight';
  if (Math.abs(ftp) < 1.8) {
    if (start > 1.2) return 'push';
    if (start < -1.2) return 'pull';
    return 'straight';
  }
  if (ftp <= -5) return 'hook';
  if (ftp >= 5) return 'slice';
  return ftp < 0 ? 'draw' : 'fade';
}

/**
 * Centred-strike launch approximation.
 * launchDeg = 0.85 * dynamicLoft + 0.15 * attack. Dynamic loft on each
 * club is the value that reproduces the TrackMan launch. Spin rate uses
 * spinRpm = 3.29 * clubSpeedMph * spinLoft, flagged in PHYSICS.md as a fit
 * to the 7-iron, not a first-principles impact solution.
 */
export function launchFromDelivery(d) {
  const lie = LIE[d.lie] || LIE[SURF.FAIRWAY];
  const ix = clamp(d.impactX || 0, -1, 1);
  const iy = clamp(d.impactY || 0, -1, 1);
  const miss = ix * ix * 0.05 + iy * iy * 0.08;
  const smash = (d.smash ?? 1.33) * (1 - miss);
  const clubSpeed = Math.max(0, d.clubSpeedMph) * lie.speed * (d.speedMul ?? 1);
  const ballSpeed = clubSpeed * smash;
  const attack = d.attackDeg ?? -4;
  const dyn = (d.dynamicLoft ?? 20) * lie.launch + iy * 1.5;
  const spinLoft = Math.max(4, dyn - attack);
  const launchDeg = clamp(0.85 * dyn + 0.15 * attack, 0.3, 55);
  let spinRpm = 3.29 * clubSpeed * spinLoft * (1 - 0.18 * iy) * (d.spinMul ?? 1) * lie.spin;
  if (Number.isFinite(d.spinOverrideRpm)) spinRpm = d.spinOverrideRpm;
  const face = d.faceDeg || 0;
  const path = d.pathDeg || 0;
  const ftp = face - path;
  const spinAxisDeg = clamp(ftp * 2.5 - ix * 4, -50, 50);
  const startDeg = face * 0.82 + path * 0.18;
  return finishLaunch(ballSpeed, launchDeg, spinRpm, spinAxisDeg, (d.aimYaw || 0) + startDeg * Math.PI / 180, {
    face, path, smash, shape: shapeLabel(face, path),
  });
}

/** Launch from measured monitor numbers. This is what the flight tests use. */
export function launchFromMonitor(m) {
  return finishLaunch(m.ballSpeedMph, m.launchDeg, m.spinRpm, m.spinAxisDeg || 0, m.aimYaw || 0, {
    face: 0, path: 0, smash: null, shape: 'straight',
  });
}

function finishLaunch(ballMph, launchDeg, spinRpm, spinAxisDeg, aim, extra) {
  const dirX = Math.sin(aim), dirZ = -Math.cos(aim);
  const right = { x: -dirZ, y: 0, z: dirX };
  const phi = spinAxisDeg * Math.PI / 180;
  const la = launchDeg * Math.PI / 180;
  const vMag = ballMph * MPH;
  const wMag = spinRpm * RPM;
  const c = Math.cos(phi);
  return {
    v: { x: vMag * Math.cos(la) * dirX, y: vMag * Math.sin(la), z: vMag * Math.cos(la) * dirZ },
    spin: { x: right.x * c * wMag, y: -Math.sin(phi) * wMag, z: right.z * c * wMag },
    speed: vMag, launchDeg, spinRpm, spinAxisDeg, ballSpeedMph: ballMph, aimYaw: aim, ...extra,
  };
}

export function launchFromSwing(club, power, faceDeg, aimYaw, lie, mods = {}) {
  const p = Math.max(0.05, power);
  return launchFromDelivery({
    clubSpeedMph: club.clubSpeed * Math.min(p, 1.08),
    smash: club.smash, dynamicLoft: club.dynamicLoft, attackDeg: club.attack,
    faceDeg: faceDeg || 0, pathDeg: mods.pathDeg || 0,
    impactX: mods.impactX || 0, impactY: mods.impactY || 0,
    spinMul: mods.spinMul ?? 1, speedMul: mods.speedMul ?? 1,
    spinOverrideRpm: mods.spinOverrideRpm, aimYaw, lie,
  });
}

export function launchPutt(speed, aimYaw) {
  return {
    v: { x: speed * Math.sin(aimYaw), y: 0, z: -speed * Math.cos(aimYaw) },
    spin: { x: 0, y: 0, z: 0 }, speed, launchDeg: 0, spinRpm: 0, spinAxisDeg: 0,
    ballSpeedMph: speed / MPH, aimYaw, shape: 'straight', faceDeg: 0, pathDeg: 0,
  };
}

/** Penner 2002 turf fit. |vy| in m/s. */
export function pennerRestitution(vy) {
  const s = Math.abs(vy);
  if (s > 20) return 0.12;
  return Math.max(0.05, 0.51 - 0.0375 * s + 0.000903 * s * s);
}

/** Stimpmeter release is 1.83 m/s. Distance in feet is the stimp reading. */
export function stimpDecel(stimpFt) {
  const dist = Math.max(4, stimpFt) * 0.3048;
  return (1.83 * 1.83) / (2 * dist);
}

export function normalizeEnv(windOrEnv) {
  const env = {
    tempC: 15, altitudeM: 0, humidity: 0, rain: false, firmness: 0.55, stimp: 11,
    wind: { speed: 0, dirX: 0, dirZ: -1, refHeight: 2, gustAmp: 0, t: 0 },
  };
  if (!windOrEnv) return env;
  if (typeof windOrEnv.x === 'number' && windOrEnv.tempC == null && windOrEnv.wind == null) {
    const sp = Math.hypot(windOrEnv.x, windOrEnv.z || 0);
    env.wind.speed = sp;
    if (sp > 1e-8) { env.wind.dirX = windOrEnv.x / sp; env.wind.dirZ = (windOrEnv.z || 0) / sp; }
    return env;
  }
  env.tempC = windOrEnv.tempC ?? 15;
  env.altitudeM = windOrEnv.altitudeM ?? 0;
  env.humidity = windOrEnv.humidity ?? 0;
  env.rain = !!windOrEnv.rain;
  env.firmness = windOrEnv.firmness ?? 0.55;
  env.stimp = windOrEnv.stimp ?? 11;
  if (windOrEnv.wind) Object.assign(env.wind, windOrEnv.wind);
  return env;
}

function outOfBounds(course, p) {
  const b = course.bounds;
  if (!b) return false;
  return p.x < b.minX || p.x > b.maxX || p.z < b.minZ || p.z > b.maxZ;
}

function hash01(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function simulate(course, start, launch, windOrEnv, opts = {}) {
  const env = normalizeEnv(windOrEnv);
  let rho = airDensity(env.tempC, env.altitudeM, env.humidity);
  if (env.rain) rho *= 1.02;
  const rainCd = env.rain ? 1.06 : 1;
  const waterY = course.waterLevel != null ? course.waterLevel : -1e9;
  const p = { x: start.x, y: start.y, z: start.z };
  const v = { ...launch.v };
  const w = { ...launch.spin };
  let mode = opts.putt ? 'roll' : 'air';
  if (mode === 'roll') p.y = course.heightAt(p.x, p.z) + BALL_R;
  const frames = [];
  const events = [];
  let t = 0, step = 0, carry = null, apex = p.y, result = 'stopped', rest = 0, bounces = 0;
  let landingV = null, lip = 0;
  const kAir = 0.5 * rho * AREA / BALL_M;
  const maxT = opts.maxT || 25;
  while (t < maxT) {
    if (step % 4 === 0) frames.push({ x: p.x, y: p.y, z: p.z, t, air: mode === 'air' });
    step++; t += DT;
    env.wind.t = t;
    if (mode === 'air') {
      const wind = windAt(env.wind, p.y);
      const vr = { x: v.x - wind.x, y: v.y, z: v.z - wind.z };
      const sp = len3(vr) || 1e-6;
      const wmag = len3(w);
      const { cd, cl } = aeroCoeffs(sp, wmag);
      let ax = -kAir * cd * rainCd * sp * vr.x;
      let ay = -kAir * cd * rainCd * sp * vr.y - G;
      let az = -kAir * cd * rainCd * sp * vr.z;
      if (wmag > 0.2) {
        const cx = w.y * vr.z - w.z * vr.y, cy = w.z * vr.x - w.x * vr.z, cz = w.x * vr.y - w.y * vr.x;
        const clen = Math.hypot(cx, cy, cz) || 1;
        const f = kAir * Math.min(cl, 0.45) * sp * sp / clen;
        ax += f * cx; ay += f * cy; az += f * cz;
      }
      v.x += ax * DT; v.y += ay * DT; v.z += az * DT;
      p.x += v.x * DT; p.y += v.y * DT; p.z += v.z * DT;
      const decay = Math.exp(AERO.spinDecay * sp / BALL_R * DT);
      w.x *= decay; w.y *= decay; w.z *= decay;
      if (p.y > apex) apex = p.y;
      if (outOfBounds(course, p)) { result = 'water'; events.push({ type: 'water', t, x: p.x, z: p.z, oob: true }); break; }
      const h = course.heightAt(p.x, p.z);
      if (p.y < waterY && h < waterY + 0.02) {
        carry = carry || { x: p.x, z: p.z };
        result = 'water'; events.push({ type: 'water', t, x: p.x, z: p.z }); break;
      }
      if (p.y - BALL_R <= h) {
        const surf = course.surfaceAt(p.x, p.z);
        if (surf === SURF.WATER) { result = 'water'; events.push({ type: 'water', t, x: p.x, z: p.z }); break; }
        if (!carry) { carry = { x: p.x, z: p.z, surf }; landingV = { x: v.x, y: v.y, z: v.z }; }
        p.y = h + BALL_R;
        const n = course.normalAt(p.x, p.z);
        const vn = dot(v, n);
        if ((surf === SURF.BUNKER || surf === SURF.SAND) && -vn > 12 && hash01(p.x, p.z) < (1 - env.firmness) * 0.8) {
          result = 'plugged'; events.push({ type: 'plug', t }); break;
        }
        const e = pennerRestitution(vn) * (surf === SURF.GREEN ? 0.85 : surf === SURF.ROUGH ? 0.55 : 1) * (env.rain ? 0.85 : 1);
        const vt = { x: v.x - vn * n.x, y: v.y - vn * n.y, z: v.z - vn * n.z };
        const mu = (surf === SURF.GREEN ? 0.4 : surf === SURF.ROUGH ? 0.75 : surf === SURF.BUNKER ? 0.9 : 0.35) * (env.rain ? 1.15 : 1);
        const spT = len3(vt) || 1e-6;
        const Jn = BALL_M * -(1 + e) * vn;
        const jt = Math.min(mu * Math.abs(Jn), spT * BALL_M * 0.85);
        v.x = vt.x * (1 - jt / (BALL_M * spT)) + n.x * (-e * vn);
        v.y = vt.y * (1 - jt / (BALL_M * spT)) + n.y * (-e * vn);
        v.z = vt.z * (1 - jt / (BALL_M * spT)) + n.z * (-e * vn);
        // Backspin check on short grass: extra speed loss from spin, capped.
        const back = Math.max(0, wmag);
        if (surf === SURF.GREEN || surf === SURF.FAIRWAY || surf === SURF.TEE) {
          const bite = (surf === SURF.GREEN ? 0.55 : 0.22) * (env.rain ? 1.2 : 1);
          const drop = Math.min(len3(v), BALL_R * back * bite * 0.15);
          const vh = Math.hypot(v.x, v.z) || 1;
          v.x -= v.x / vh * drop; v.z -= v.z / vh * drop;
        }
        w.x *= 0.5; w.y *= 0.5; w.z *= 0.5;
        bounces++;
        events.push({ type: 'bounce', t, x: p.x, z: p.z, surf, speed: Math.abs(vn) });
        if (Math.abs(dot(v, n)) < 1.1 || bounces > 6) mode = 'roll';
      }
    } else {
      const h = course.heightAt(p.x, p.z);
      const surf = course.surfaceAt(p.x, p.z);
      if (surf === SURF.WATER || h < waterY) { result = 'water'; events.push({ type: 'water', t, x: p.x, z: p.z }); break; }
      const n = course.normalAt(p.x, p.z);
      const vn = dot(v, n);
      v.x -= vn * n.x; v.y -= vn * n.y; v.z -= vn * n.z;
      const gt = { x: G * n.y * n.x, y: -G + G * n.y * n.y, z: G * n.y * n.z };
      let ax = gt.x * 5 / 7, ay = gt.y * 5 / 7, az = gt.z * 5 / 7;
      const sp = len3(v);
      let decel = surf === SURF.GREEN ? stimpDecel(env.stimp) * (env.rain ? 1.15 : 1)
        : (surf === SURF.ROUGH ? 0.65 : surf === SURF.BUNKER || surf === SURF.SAND ? 2.2 : 0.12) * G;
      if (sp < 0.03 && Math.hypot(ax, ay, az) < decel) {
        rest += DT; v.x = v.y = v.z = 0;
        if (rest > 0.12) break;
      } else {
        rest = 0;
        if (sp > 1e-4) { ax -= decel * v.x / sp; ay -= decel * v.y / sp; az -= decel * v.z / sp; }
        v.x += ax * DT; v.y += ay * DT; v.z += az * DT;
      }
      p.x += v.x * DT; p.z += v.z * DT;
      p.y = course.heightAt(p.x, p.z) + BALL_R;
      const cup = course.cup;
      if (cup && lip <= 0) {
        const R = cup.r || CUP_R;
        const dc = Math.hypot(p.x - cup.x, p.z - cup.z);
        const spd = Math.hypot(v.x, v.z);
        if (dc < R * 0.65 && spd < 1.63) {
          result = 'holed'; events.push({ type: 'hole', t });
          frames.push({ x: cup.x, y: course.heightAt(cup.x, cup.z) - 0.04, z: cup.z, t, air: false });
          p.x = cup.x; p.z = cup.z; break;
        }
        if (dc < R && spd >= 1.63 && spd < 3.2) {
          v.x *= -0.45; v.z *= -0.45; events.push({ type: 'lip', t }); lip = 0.3;
        }
      } else if (lip > 0) lip -= DT;
    }
  }
  if (!frames.length || frames[frames.length - 1].t < t - 1e-4) frames.push({ x: p.x, y: p.y, z: p.z, t, air: false });
  const final = { x: p.x, y: p.y, z: p.z };
  const ground = course.heightAt(start.x, start.z);
  const cdx = (carry ? carry.x : final.x) - start.x;
  const cdz = (carry ? carry.z : final.z) - start.z;
  const ax = Math.sin(launch.aimYaw || 0), az = -Math.cos(launch.aimYaw || 0);
  const offline = cdx * (-az) + cdz * ax;
  let descent = 0;
  if (landingV) descent = Math.atan2(-landingV.y, Math.max(0.05, Math.hypot(landingV.x, landingV.z))) * 180 / Math.PI;
  const monitor = {
    ballSpeedMph: launch.ballSpeedMph,
    launchDeg: launch.launchDeg,
    spinRpm: launch.spinRpm,
    spinAxisDeg: launch.spinAxisDeg || 0,
    apexFt: (apex - ground) * FT_PER_M,
    descentDeg: descent,
    carryYd: Math.hypot(cdx, cdz) / M_PER_YD,
    totalYd: Math.hypot(final.x - start.x, final.z - start.z) / M_PER_YD,
    offlineYd: offline / M_PER_YD,
    shape: launch.shape || 'straight',
  };
  return { frames, events, carry, final, result, apex: apex - start.y, duration: t, landingV, monitor };
}

export function flatCourse(surface, extra = {}) {
  return {
    heightAt: () => 0,
    normalAt: () => ({ x: 0, y: 1, z: 0 }),
    surfaceAt: () => surface,
    waterLevel: -5,
    cup: null,
    ...extra,
  };
}
