import { makeStrike } from './strike.js';

export const meta = { id: 12, name: 'Two-thumb', blurb: 'Left thumb sets the backswing, right thumb starts the downswing.' };
export const samples = {
  perfect: { back: 1, down: 1, gap: 0.1 },
  bad: { input: { back: 1, down: 1, gap: 0.3 }, face: '>', side: 1 },
};

export function mapInput({ back, down, gap }) {
  const g = gap ?? 0.1;
  return makeStrike({
    clubSpeed: (back || 0) * (0.7 + 0.3 * (down || 0)),
    faceToTarget: (g - 0.1) * 20,
    path: ((down || 0) - (back || 0)) * 6,
    contact: 1 - Math.min(1, Math.abs(g - 0.1) * 3),
    tempo: 3 * (0.1 / Math.max(0.04, g)),
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Left holds the backswing. Right swipes through.</p><div class="sw-split"><div class="L">L</div><div class="R">R</div></div></div>`;
  const L = root.querySelector('.L');
  const R = root.querySelector('.R');
  let back = 0;
  let y0 = 0;
  let leftUp = 0;
  L.addEventListener('pointerdown', (e) => { y0 = e.clientY; back = 0; L.setPointerCapture(e.pointerId); });
  L.addEventListener('pointermove', (e) => { if (L.hasPointerCapture(e.pointerId)) back = Math.max(0, Math.min(1.15, (e.clientY - y0) / 120)); });
  L.addEventListener('pointerup', () => { leftUp = performance.now(); });
  let ry = 0;
  let rt = 0;
  R.addEventListener('pointerdown', (e) => { ry = e.clientY; rt = performance.now(); R.setPointerCapture(e.pointerId); });
  R.addEventListener('pointerup', (e) => {
    const down = Math.min(1.3, Math.max(0, (ry - e.clientY) / 90));
    const gap = Math.max(0.02, (rt - (leftUp || rt)) / 1000);
    if (back > 0.1 && down > 0.1) emit(mapInput({ back, down, gap }));
  });
  return { destroy() { root.innerHTML = ''; } };
}
