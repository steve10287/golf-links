// Swing-stick grading. Pure functions, no DOM or three.js.
// Power is backswing length. Tempo is backswing time vs downswing time.
// Path is how far the downswing drifts off a straight line. Transition rush
// is penalised when the downswing is already fast at the change of direction.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const DIFF = {
  amateur: {
    id: 'amateur',
    badge: 'AMATEUR',
    menu: 'Amateur — wide windows, swing assist',
    // [perfect, great, good] error ceilings
    tempo: [0.55, 0.95, 1.4],
    path: [0.09, 0.16, 0.28],
    power: [0.08, 0.15, 0.24],
    rush: [1.35, 1.7, 2.15],
    facePerPath: 16,
    pushPerPath: 7,
    assist: 0.42,
    tempoDist: 0.08,
    rushDist: 0.05,
    overswingFace: 7,
    dispersionYds: 11,
    perfectBonus: false,
  },
  tour: {
    id: 'tour',
    badge: 'TOUR',
    menu: 'Tour — tighter windows',
    tempo: [0.28, 0.52, 0.85],
    path: [0.05, 0.095, 0.16],
    power: [0.045, 0.085, 0.14],
    rush: [1.05, 1.35, 1.7],
    facePerPath: 28,
    pushPerPath: 12,
    assist: 1,
    tempoDist: 0.15,
    rushDist: 0.1,
    overswingFace: 16,
    dispersionYds: 5.5,
    perfectBonus: false,
  },
  pro: {
    id: 'pro',
    badge: 'PRO SWING',
    menu: 'Pro Swing — tight windows, no assist',
    tempo: [0.13, 0.28, 0.48],
    path: [0.03, 0.06, 0.1],
    power: [0.028, 0.06, 0.1],
    rush: [0.82, 1.05, 1.35],
    facePerPath: 46,
    pushPerPath: 20,
    assist: 1,
    tempoDist: 0.22,
    rushDist: 0.14,
    overswingFace: 28,
    dispersionYds: 2.5,
    perfectBonus: true,
  },
};

function rate(err, bands) {
  if (err <= bands[0]) return 'Perfect';
  if (err <= bands[1]) return 'Great';
  if (err <= bands[2]) return 'Good';
  return 'Poor';
}

function unitPenalty(err, perfect, poor) {
  if (err <= perfect) return 0;
  return clamp((err - perfect) / Math.max(0.001, poor - perfect), 0, 1.35);
}

/** Ideal downswing is about three times faster than the backswing. */
export function tempoError(tBack, tDown, putting) {
  const idealDown = putting ? 0.42 : 0.30;
  const ratio = tBack / Math.max(0.06, tDown);
  const ratioErr = Math.abs(Math.log(ratio / 3));
  const downErr = Math.abs(tDown - idealDown) / idealDown;
  const tooFast = tDown < idealDown * 0.42 ? (0.42 - tDown / idealDown) * 0.55 : 0;
  const tooSlow = tDown > idealDown * 2.3 ? (tDown / idealDown - 2.3) * 0.35 : 0;
  return ratioErr + 0.22 * downErr + tooFast + tooSlow;
}

/**
 * Rush ratio: speed in the first part of the downswing divided by the
 * downswing average. Below 1 means the stick accelerated through, which is
 * a smooth transition. Above 1 means it was already ripping at the change
 * of direction.
 */
export function transitionRush(pts, transIdx) {
  if (!pts || pts.length < 4 || transIdx < 0 || transIdx >= pts.length - 1) return 1.5;
  const t0 = pts[transIdx].t;
  const dur = Math.max(1, pts[pts.length - 1].t - t0);
  let earlyD = 0, earlyT = 0, allD = 0, allT = 0;
  for (let i = transIdx + 1; i < pts.length; i++) {
    const dt = Math.max(0, pts[i].t - pts[i - 1].t);
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    allD += d; allT += dt;
    if (pts[i].t - t0 <= dur * 0.3) { earlyD += d; earlyT += dt; }
  }
  if (allT < 12 || allD < 2) return 1.5;
  const early = earlyD / Math.max(10, earlyT);
  const all = allD / allT;
  if (all < 1e-4) return 1.5;
  return early / all;
}

export function pathError(pts, transIdx, padW) {
  const w = Math.max(1, padW);
  const x0 = pts[transIdx].x;
  let sum = 0, sum2 = 0, n = 0, extreme = 0;
  for (let i = transIdx; i < pts.length; i++) {
    const dev = (pts[i].x - x0) / w;
    sum += dev; sum2 += dev * dev; n++;
    if (Math.abs(dev) > Math.abs(extreme)) extreme = dev;
  }
  if (!n) return { mean: 0, rms: 0, mag: 0, sign: 0 };
  const mean = sum / n;
  const rms = Math.sqrt(sum2 / n);
  const sign = Math.abs(mean) > 0.004 ? Math.sign(mean) : (Math.abs(extreme) > 0.004 ? Math.sign(extreme) : 0);
  const mag = Math.max(Math.abs(mean), rms * 0.85);
  return { mean, rms, mag, sign };
}

/**
 * Grade one swing.
 * pathMean/pathRms are fractions of pad width, + = right (slice / push).
 * rush is the transitionRush ratio. power and targetPower are 0–1.2.
 */
export function gradeSwing(input, difficultyId) {
  const d = DIFF[difficultyId] || DIFF.pro;
  const putting = !!input.putting;
  const widen = putting ? 1.45 : 1;
  const tempoBands = d.tempo.map((v) => v * widen);
  const pathBands = d.path.map((v) => v * widen);
  const powerBands = d.power.map((v) => v * widen);
  const rushBands = d.rush.map((v) => v * (putting ? 1.25 : 1));

  const tempoErr = tempoError(input.tBack, input.tDown, putting);
  const pathMag = input.pathMag != null ? input.pathMag : Math.max(Math.abs(input.pathMean || 0), (input.pathRms || 0) * 0.85);
  const pathSign = input.pathSign != null ? input.pathSign : (Math.abs(input.pathMean || 0) > 0.004 ? Math.sign(input.pathMean) : 0);
  const over = Math.max(0, (input.power || 0) - 1);
  let powerErr = Math.abs((input.power || 0) - (input.targetPower || 0));
  powerErr += over * 2.4;
  const rush = input.rush ?? 1;

  const tempo = rate(tempoErr, tempoBands);
  const path = rate(pathMag, pathBands);
  const power = rate(powerErr, powerBands);
  const rushPen = unitPenalty(rush, rushBands[0], rushBands[2]);
  const smooth = rush <= rushBands[0];
  const allPerfect = tempo === 'Perfect' && path === 'Perfect' && power === 'Perfect' && smooth;

  const assist = d.assist;
  let face = pathSign * pathMag * d.facePerPath * assist;
  let push = pathSign * pathMag * d.pushPerPath * assist;
  if (over > 0) {
    const odir = pathSign || 1;
    face += odir * over * d.overswingFace * assist;
    push += odir * over * d.overswingFace * 0.4 * assist;
  }
  if (rushPen > 0) {
    const rdir = pathSign || 1;
    face += rdir * rushPen * (putting ? 2.2 : 5.5) * assist;
    push += rdir * rushPen * (putting ? 1.2 : 2.6) * assist;
  }
  face = clamp(face, -32, 32);
  push = clamp(push, -20, 20);

  const tempoPen = unitPenalty(tempoErr, tempoBands[0], tempoBands[2]);
  let speedMul = 1 - tempoPen * d.tempoDist - rushPen * d.rushDist;
  speedMul = clamp(speedMul, 0.62, 1);

  const notes = [];
  if (over > 0.02) notes.push('Overswing');
  if (!smooth && rush > rushBands[1]) notes.push('Rushed transition');
  else if (!smooth) notes.push('Quick transition');

  return {
    tempo, path, power, allPerfect, smooth,
    tempoErr, pathMag, pathSign, powerErr, rush, rushPen, over,
    faceDeg: face,
    pushDeg: push,
    speedMul,
    spinMul: 1,
    snapToTarget: allPerfect && d.perfectBonus && !putting,
    perfectBonus: allPerfect && d.perfectBonus && !putting,
    note: notes.join(' · '),
  };
}

/** Yards of perfect-swing dispersion for the target ring. Longer clubs miss wider. */
export function dispersionYards(difficultyId, clubFromLong) {
  const d = DIFF[difficultyId] || DIFF.pro;
  const k = 1.2 - Math.max(0, clubFromLong) * 0.055;
  return d.dispersionYds * k;
}
