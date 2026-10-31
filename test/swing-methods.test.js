import test from 'node:test';
import assert from 'node:assert/strict';
import { METHODS } from '../js/swing/index.js';
import { launchFromStrike, makeStrike } from '../js/swing/strike.js';
import { createStats } from '../js/swing/stats.js';
import { CLUBS, SURF, launchFromSwing, simulate, flatCourse, BALL_R } from '../js/engine.js';

const air = { tempC: 20, altitudeM: 0, humidity: 0.4, rain: false, firmness: 0.55, stimp: 11, wind: { speed: 0, dirX: 0, dirZ: -1 } };
const tee = { x: 0, y: BALL_R, z: 0 };
const flat = flatCourse(SURF.FAIRWAY);
const club = CLUBS.find((c) => c.id === '7i');

function signOf(spec, value, name) {
  if (spec === '>') assert.ok(value > 1.5, name + ' ' + value);
  if (spec === '<') assert.ok(value < -1.5, name + ' ' + value);
}

test('twenty distinct swing methods', () => {
  assert.equal(METHODS.length, 20);
  const ids = METHODS.map((m) => m.meta.id);
  assert.deepEqual(ids, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  const names = new Set(METHODS.map((m) => m.meta.name));
  assert.equal(names.size, 20);
});

test('perfect input is a straight stock strike', () => {
  const stock = simulate(flat, tee, launchFromSwing(club, 1, 0, 0, SURF.TEE), air).monitor;
  for (const m of METHODS) {
    const s = m.mapInput(m.samples.perfect);
    assert.equal(s.grade, 'perfect', m.meta.name + ' ' + JSON.stringify(s));
    const mon = simulate(flat, tee, launchFromStrike(club, s, 0, SURF.TEE), air).monitor;
    const carryErr = Math.abs(mon.carryYd - stock.carryYd) / stock.carryYd;
    assert.ok(carryErr < 0.03, `${m.meta.name} carry ${mon.carryYd.toFixed(1)} vs ${stock.carryYd.toFixed(1)}`);
    assert.ok(Math.abs(mon.offlineYd) < 1.5, `${m.meta.name} offline ${mon.offlineYd.toFixed(2)}`);
  }
});

test('bad input misses the way the strike says', () => {
  for (const m of METHODS) {
    const spec = m.samples.bad;
    const s = m.mapInput(spec.input);
    assert.notEqual(s.grade, 'perfect', m.meta.name);
    signOf(spec.face, s.faceToTarget, m.meta.name + ' face');
    signOf(spec.path, s.path, m.meta.name + ' path');
    const res = simulate(flat, tee, launchFromStrike(club, s, 0, SURF.TEE), air);
    assert.equal(Math.sign(res.final.x), spec.side, `${m.meta.name} finish x ${res.final.x.toFixed(2)}`);
  }
});

test('centred strike matches the club delivery and a push starts right', () => {
  const perfect = makeStrike({ clubSpeed: 1, faceToTarget: 0, path: 0, contact: 1, tempo: 3 });
  const stock = simulate(flat, tee, launchFromSwing(club, 1, 0, 0, SURF.TEE), air).monitor;
  const got = simulate(flat, tee, launchFromStrike(club, perfect, 0, SURF.TEE), air).monitor;
  assert.ok(Math.abs(got.carryYd - stock.carryYd) < 0.2);
  const push = simulate(flat, tee, launchFromStrike(club, makeStrike({ clubSpeed: 1, faceToTarget: 6, path: 6, contact: 1, tempo: 3 }), 0, SURF.TEE), air);
  assert.ok(push.final.x > 8, push.final.x);
  const draw = simulate(flat, tee, launchFromStrike(club, makeStrike({ clubSpeed: 1, faceToTarget: -2, path: 6, contact: 1, tempo: 3 }), 0, SURF.TEE), air);
  assert.ok(draw.final.x < -1, draw.final.x);
  const thin = launchFromStrike(club, makeStrike({ clubSpeed: 1, faceToTarget: 0, path: 0, contact: 0, tempo: 3 }), 0, SURF.TEE);
  const pure = launchFromStrike(club, perfect, 0, SURF.TEE);
  assert.ok(thin.ballSpeedMph < pure.ballSpeedMph);
});

test('stats average full swings and keep putts out of the carry', () => {
  const mem = {};
  const stats = createStats({
    getItem: (k) => mem[k] ?? null,
    setItem: (k, v) => { mem[k] = v; },
  });
  stats.record(1, { carryYd: 160, stockYd: 150, offlineYd: -4, grade: 'good', ms: 2000, putt: false });
  stats.record(1, { carryYd: 140, stockYd: 150, offlineYd: 6, grade: 'poor', ms: 1000, putt: false });
  stats.record(1, { carryYd: 3, stockYd: 150, offlineYd: 20, grade: 'good', ms: 500, putt: true });
  const s = stats.summary(1);
  assert.equal(s.shots, 3);
  assert.ok(Math.abs(s.avgCarryErrorYd - 10) < 1e-9);
  assert.ok(Math.abs(s.avgLateralYd - 5) < 1e-9);
  assert.ok(Math.abs(s.goodPct - (200 / 3)) < 1e-9);
  assert.ok(Math.abs(s.avgTimeSec - (3500 / 3) / 1000) < 1e-9);
  assert.equal(stats.summary(4), null);
});
