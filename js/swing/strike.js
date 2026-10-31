// One strike shape for every input method.
// Face and path use the TrackMan right-hand signs already in the engine:
// positive face is open, positive path is in-to-out.
// Contact 1 is a centred strike. It becomes the existing impact-height miss,
// which is what changes smash in launchFromDelivery.
import { launchFromSwing } from '../engine.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function gradeOf(s) {
  const powerErr = Math.abs(s.clubSpeed - 1);
  const face = Math.abs(s.faceToTarget);
  const path = Math.abs(s.path);
  const tempoErr = Math.abs(Math.log((s.tempo || 3) / 3));
  if (powerErr < 0.04 && face < 1.2 && path < 1.2 && s.contact > 0.92 && tempoErr < 0.12) return 'perfect';
  if (powerErr < 0.1 && face < 3 && path < 3 && s.contact > 0.75 && tempoErr < 0.35) return 'good';
  if (powerErr < 0.22 && face < 8 && path < 8 && s.contact > 0.45) return 'ok';
  return 'poor';
}

export function makeStrike(partial = {}) {
  const clubSpeed = clamp(Number.isFinite(partial.clubSpeed) ? partial.clubSpeed : 1, 0.05, 1.05);
  const faceToTarget = clamp(Number.isFinite(partial.faceToTarget) ? partial.faceToTarget : 0, -32, 32);
  const path = clamp(Number.isFinite(partial.path) ? partial.path : 0, -32, 32);
  const contact = clamp(Number.isFinite(partial.contact) ? partial.contact : 1, 0, 1);
  const tempo = clamp(Number.isFinite(partial.tempo) ? partial.tempo : 3, 0.2, 12);
  const strike = { clubSpeed, faceToTarget, path, contact, tempo, grade: 'ok' };
  strike.grade = gradeOf(strike);
  return strike;
}

export function launchFromStrike(club, strike, aimYaw, lie) {
  const s = makeStrike(strike);
  const miss = 1 - s.contact;
  return launchFromSwing(club, s.clubSpeed, s.faceToTarget, aimYaw, lie, {
    pathDeg: s.path,
    impactY: miss,
    impactX: 0,
  });
}
