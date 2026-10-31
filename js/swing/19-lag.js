import { makeStrike } from './strike.js';

export const meta = { id: 19, name: 'Lag', blurb: 'Press to take it away, add a finger to hinge, lift the first to release.' };
export const samples = {
  perfect: { takeaway: 1, gap: 0.12 },
  bad: { input: { takeaway: 1, gap: 0.02 }, face: '>', side: 1 },
};

export function mapInput({ takeaway, gap }) {
  const err = (gap ?? 0.12) - 0.12;
  return makeStrike({
    clubSpeed: takeaway,
    faceToTarget: -err * 25,
    path: -err * 10,
    contact: 1 - Math.min(1, Math.abs(err) * 4),
    tempo: 0.36 / Math.max(0.08, gap ?? 0.12),
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Hold, add a finger, then lift the first.</p><div class="sw-lag"><b>1</b><b>2</b></div></div>`;
  const keys = [...root.querySelectorAll('.sw-lag b')];
  const down = new Map();
  let firstId = null;
  let hingeAt = 0;
  let travel = 0;
  let y0 = 0;
  root.addEventListener('pointerdown', (e) => {
    down.set(e.pointerId, e.clientY);
    if (firstId == null) { firstId = e.pointerId; y0 = e.clientY; keys[0].classList.add('on'); }
    else if (!hingeAt) { hingeAt = performance.now(); keys[1].classList.add('on'); }
  });
  root.addEventListener('pointermove', (e) => {
    if (e.pointerId === firstId) travel = Math.max(travel, (e.clientY - y0) / 110);
  });
  root.addEventListener('pointerup', (e) => {
    down.delete(e.pointerId);
    if (e.pointerId !== firstId) return;
    const gap = hingeAt ? (performance.now() - hingeAt) / 1000 : 0.02;
    if (travel > 0.15 && hingeAt) emit(mapInput({ takeaway: Math.min(1.15, travel), gap }));
    firstId = null;
    hingeAt = 0;
    travel = 0;
    keys.forEach((k) => k.classList.remove('on'));
  });
  return { destroy() { root.innerHTML = ''; } };
}
