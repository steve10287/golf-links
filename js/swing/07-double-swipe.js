import { makeStrike } from './strike.js';

export const meta = { id: 7, name: 'Down-up', blurb: 'Swipe down, then up. Match the two strokes.' };
export const samples = {
  perfect: { down: 1, up: 1, downDeg: 0, upDeg: 0 },
  bad: { input: { down: 1, up: 1, downDeg: 0, upDeg: 8 }, face: '>', side: 1 },
};

export function mapInput({ down, up, downDeg, upDeg }) {
  const dd = downDeg || 0;
  const ud = upDeg || 0;
  const d = down || 0;
  const u = up || 0;
  return makeStrike({
    clubSpeed: (d + u) / 2,
    faceToTarget: (ud - dd) * 0.5,
    path: ((dd + ud) / 2) * 0.4,
    contact: 1 - Math.min(1, Math.abs(d - u) * 1.2 + Math.abs(ud - dd) / 30),
    tempo: d > 0.05 ? 3 * (d / Math.max(0.05, u)) : 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Swipe down, then back up.</p><div class="sw-pad tall"><b class="sw-read">Down</b></div></div>`;
  const pad = root.querySelector('.sw-pad');
  const read = root.querySelector('.sw-read');
  let pts = [];
  let first = null;
  function take(p) {
    const a = p[0];
    const b = p[p.length - 1];
    const dt = Math.max(16, b.t - a.t);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    return { speed: Math.min(1.3, (dist / dt) / 1.15), deg: Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI, dy: b.y - a.y };
  }
  pad.addEventListener('pointerdown', (e) => { pts = [{ x: e.clientX, y: e.clientY, t: performance.now() }]; pad.setPointerCapture(e.pointerId); });
  pad.addEventListener('pointermove', (e) => { if (pad.hasPointerCapture(e.pointerId)) pts.push({ x: e.clientX, y: e.clientY, t: performance.now() }); });
  pad.addEventListener('pointerup', () => {
    if (pts.length < 2) return;
    const stroke = take(pts);
    if (!first) {
      if (stroke.dy < 20) return;
      first = stroke;
      read.textContent = 'Up';
      return;
    }
    if (stroke.dy > -20) return;
    emit(mapInput({ down: first.speed, up: stroke.speed, downDeg: first.deg, upDeg: stroke.deg }));
    first = null;
    read.textContent = 'Down';
  });
  return { destroy() { root.innerHTML = ''; } };
}
