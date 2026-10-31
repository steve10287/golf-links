import { makeStrike } from './strike.js';

export const meta = { id: 17, name: 'Pinch', blurb: 'Spread two fingers to load, then snap them closed.' };
export const samples = {
  perfect: { spread: 1, snapMs: 80 },
  bad: { input: { spread: 1, snapMs: 300 }, face: '>', side: 1 },
};

export function mapInput({ spread, snapMs }) {
  const snap = Math.max(0, Math.min(1, 1 - ((snapMs || 80) - 80) / 400));
  return makeStrike({
    clubSpeed: spread,
    faceToTarget: (1 - snap) * 8,
    path: ((spread || 0) - 1) * 6,
    contact: snap,
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Spread to load, snap closed.</p><div class="sw-pinch"><i></i><i></i></div></div>`;
  const dots = [...root.querySelectorAll('.sw-pinch i')];
  const fingers = new Map();
  let peak = 0;
  let peakAt = 0;
  function dist() {
    const pts = [...fingers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }
  function place() {
    const pts = [...fingers.values()];
    pts.forEach((p, i) => { if (!dots[i]) return; dots[i].style.left = '50%'; dots[i].style.transform = `translate(${(p.x - pts[0].x) * (i ? 1 : 0)}px, 0)`; });
  }
  root.addEventListener('pointerdown', (e) => { fingers.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
  root.addEventListener('pointermove', (e) => {
    if (!fingers.has(e.pointerId)) return;
    fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = dist();
    if (d > peak) { peak = d; peakAt = performance.now(); }
    const spread = Math.min(1.2, peak / 160);
    dots[0].style.transform = `translateX(${-20 - spread * 40}px)`;
    dots[1].style.transform = `translateX(${20 + spread * 40}px)`;
  });
  function end(e) {
    fingers.delete(e.pointerId);
    if (fingers.size > 0) return;
    const spread = Math.min(1.2, peak / 160);
    const snapMs = Math.max(40, performance.now() - peakAt);
    if (spread > 0.2) emit(mapInput({ spread, snapMs }));
    peak = 0;
    dots.forEach((d) => { d.style.transform = ''; });
  }
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  return { destroy() { root.innerHTML = ''; } };
}
