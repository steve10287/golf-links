import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BALL_M, BALL_R, CUP_R, airDensity, aeroCoeffs, AERO, stimpDecel, pennerRestitution,
  launchFromDelivery, launchFromMonitor, launchPutt, simulate, flatCourse, SURF, CLUBS, TRACKMAN_2023,
  shapeLabel, windAt, LIE,
} from '../js/engine.js';

const air = { tempC: 20, altitudeM: 0, humidity: 0.4, rain: false, firmness: 0.55, stimp: 11, wind: { speed: 0, dirX: 0, dirZ: -1 } };
const tee = { x: 0, y: BALL_R, z: 0 };

test('USGA ball and cup', () => {
  assert.equal(BALL_M, 0.04593);
  assert.ok(Math.abs(BALL_R * 2000 - 42.67) < 0.01);
  assert.ok(Math.abs(CUP_R * 2000 - 108) < 0.2);
});

test('ISA density at 15 C sea level', () => {
  const rho = airDensity(15, 0, 0);
  assert.ok(Math.abs(rho - 1.225) < 0.008, rho);
});

test('Smits and Smith coefficients', () => {
  const { cd, cl, S } = aeroCoeffs(50, 300);
  const expectS = BALL_R * 300 / 50;
  assert.ok(Math.abs(S - expectS) < 1e-9);
  assert.ok(Math.abs(cl - AERO.clCoef * Math.pow(S, AERO.clExp)) < 1e-9);
  assert.ok(Math.abs(cd - (AERO.cd0 + AERO.cdS * S)) < 1e-9);
});

test('log wind is stronger aloft', () => {
  const w = { speed: 5, dirX: 1, dirZ: 0, refHeight: 2 };
  assert.ok(windAt(w, 30).x > windAt(w, 2).x * 1.4);
});

test('centred strike reproduces TrackMan launch', () => {
  for (const [id, ref] of Object.entries(TRACKMAN_2023)) {
    const c = CLUBS.find((x) => x.id === id);
    const L = launchFromDelivery({
      clubSpeedMph: c.clubSpeed, smash: c.smash, dynamicLoft: c.dynamicLoft,
      attackDeg: c.attack, faceDeg: 0, pathDeg: 0, aimYaw: 0, lie: SURF.TEE,
    });
    assert.ok(Math.abs(L.ballSpeedMph - ref.ball) < 1.5, id + ' ball ' + L.ballSpeedMph);
    assert.ok(Math.abs(L.launchDeg - ref.launch) < 0.4, id + ' launch ' + L.launchDeg);
    assert.ok(Math.abs(L.spinRpm - ref.spin) / ref.spin < 0.12, id + ' spin ' + L.spinRpm);
  }
});

test('flight from TrackMan launch conditions', () => {
  // Smits & Smith was fit on driver speeds. Iron carry comes out high.
  // Tolerances are the measured bias, not a retuned coefficient.
  const course = flatCourse(SURF.FAIRWAY);
  for (const [id, ref] of Object.entries(TRACKMAN_2023)) {
    const L = launchFromMonitor({ ballSpeedMph: ref.ball, launchDeg: ref.launch, spinRpm: ref.spin, aimYaw: 0 });
    const m = simulate(course, tee, L, air).monitor;
    const carryErr = Math.abs(m.carryYd - ref.carry) / ref.carry;
    const apexErr = Math.abs(m.apexFt - ref.heightYd * 3) / (ref.heightYd * 3);
    assert.ok(carryErr < 0.14, `${id} carry ${m.carryYd.toFixed(0)} vs ${ref.carry}`);
    assert.ok(apexErr < 0.30, `${id} apex ${m.apexFt.toFixed(0)} vs ${ref.heightYd * 3}`);
    assert.ok(Math.abs(m.descentDeg - ref.land) < 9, `${id} land ${m.descentDeg.toFixed(0)} vs ${ref.land}`);
  }
});

test('D-plane signs', () => {
  const base = { clubSpeedMph: 92, smash: 1.34, dynamicLoft: 19.6, attackDeg: -3.9, aimYaw: 0, lie: SURF.TEE };
  assert.equal(shapeLabel(0, 0), 'straight');
  assert.equal(shapeLabel(1, 4), 'draw');
  assert.equal(shapeLabel(-1, -4), 'fade');
  assert.equal(shapeLabel(-2, 6), 'hook');
  assert.equal(shapeLabel(2, -6), 'slice');
  assert.equal(shapeLabel(4, 4), 'push');
  assert.equal(shapeLabel(-4, -4), 'pull');
  const course = flatCourse(SURF.FAIRWAY);
  const draw = simulate(course, tee, launchFromDelivery({ ...base, faceDeg: 1, pathDeg: 4 }), air).monitor;
  const fade = simulate(course, tee, launchFromDelivery({ ...base, faceDeg: -1, pathDeg: -4 }), air).monitor;
  assert.ok(draw.offlineYd < -1, draw.offlineYd);
  assert.ok(fade.offlineYd > 1, fade.offlineYd);
});

test('headwind shortens carry and raises the apex versus a tailwind', () => {
  const course = flatCourse(SURF.FAIRWAY);
  const L = launchFromMonitor({ ballSpeedMph: 123, launchDeg: 16.1, spinRpm: 7124, aimYaw: 0 });
  const head = simulate(course, tee, L, { ...air, wind: { speed: 8, dirX: 0, dirZ: 1 } }).monitor;
  const tail = simulate(course, tee, L, { ...air, wind: { speed: 8, dirX: 0, dirZ: -1 } }).monitor;
  assert.ok(head.carryYd < tail.carryYd - 15);
  assert.ok(head.apexFt > tail.apexFt);
});

test('altitude and heat add carry; rain removes some', () => {
  const course = flatCourse(SURF.FAIRWAY);
  const L = launchFromMonitor({ ballSpeedMph: 123, launchDeg: 16.1, spinRpm: 7124, aimYaw: 0 });
  const sea = simulate(course, tee, L, air).monitor.carryYd;
  const high = simulate(course, tee, L, { ...air, altitudeM: 1500 }).monitor.carryYd;
  const hot = simulate(course, tee, L, { ...air, tempC: 35 }).monitor.carryYd;
  const wet = simulate(course, tee, L, { ...air, rain: true }).monitor.carryYd;
  assert.ok(high > sea + 5);
  assert.ok(hot > sea);
  assert.ok(wet < sea);
});

test('stimp distance and cup capture', () => {
  const v0 = 1.83;
  const decel = stimpDecel(11);
  const distFt = (v0 * v0) / (2 * decel) / 0.3048;
  assert.ok(Math.abs(distFt - 11) < 0.2, distFt);
  const green = flatCourse(SURF.GREEN, { cup: { x: 0, z: -1.3, r: CUP_R } });
  const slow = simulate(green, tee, launchPutt(1.7, 0), { ...air, stimp: 11 }, { putt: true });
  const fast = simulate(green, tee, launchPutt(3.2, 0), { ...air, stimp: 13 }, { putt: true });
  assert.equal(slow.result, 'holed');
  assert.notEqual(fast.result, 'holed');
  assert.ok(fast.events.some((e) => e.type === 'lip'));
});

test('rough cuts spin and sand cuts ball speed', () => {
  assert.ok(LIE[SURF.ROUGH].spin < 0.7);
  assert.ok(LIE[SURF.SAND].speed < 0.85);
});

test('Penner restitution falls as impact speed rises', () => {
  assert.ok(pennerRestitution(5) > pennerRestitution(18));
  assert.equal(pennerRestitution(25), 0.12);
});

test('same inputs, same shot', () => {
  const course = flatCourse(SURF.FAIRWAY);
  const L = launchFromMonitor({ ballSpeedMph: 120, launchDeg: 16, spinRpm: 7000, aimYaw: 0.2 });
  const a = simulate(course, tee, L, air).monitor;
  const b = simulate(course, tee, L, air).monitor;
  assert.deepEqual(a, b);
});
