import { makeStrike } from './strike.js';

export const meta = { id: 6, name: 'Flick', blurb: 'Swipe up. Speed is power, the line sets face and path.' };
export const samples = {
  perfect: { speed: 1, angleDeg: 0, wobble: 0 },
  bad: { input: { speed: 1, angleDeg: -6, wobble: 0 }, face: '<', side: -1 },
};

export function mapInput({ speed, angleDeg, wobble }) {
  const a = angleDeg || 0;
  const w = wobble || 0;
  return makeStrike({
    clubSpeed: speed,
    faceToTarget: a * 0.8,
    path: a * 0.45 + w * 8,
    contact: 1 - Math.min(1, Math.abs(w)),
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Flick straight up.</p><div class="sw-pad tall"><i class="sw-arrow">↑</i></div></div>`;
  const pad = root.querySelector('.sw-pad');
  let pts = [];
  pad.addEventListener('pointerdown', (e) => { pts = [{ x: e.clientX, y: e.clientY, t: performance.now() }]; pad.setPointerCapture(e.pointerId); });
  pad.addEventListener('pointermove', (e) => { if (pad.hasPointerCapture(e.pointerId)) pts.push({ x: e.clientX, y: e.clientY, t: performance.now() }); });
  pad.addEventListener('pointerup', () => {
    if (pts.length < 2) return;
    const a = pts[0];
    const b = pts[pts.length - 1];
    const dt = Math.max(16, b.t - a.t);
    const dy = a.y - b.y;
    if (dy < 24) return;
    const speed = Math.min(1.2, (dy / dt) / 1.1);
    const angleDeg = Math.atan2(b.x - a.x, dy) * 180 / Math.PI;
    let wob = 0;
    const n = pts.length;
    for (const p of pts) wob += (p.x - a.x);
    wob = Math.abs(wob / n) / 40;
    emit(mapInput({ speed, angleDeg, wobble: Math.min(1, wob) }));
  });
  return { destroy() { root.innerHTML = ''; } };
}
