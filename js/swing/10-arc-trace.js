import { makeStrike } from './strike.js';

export const meta = { id: 10, name: 'Arc trace', blurb: 'Trace the swing-plane arc back and through.' };
export const samples = {
  perfect: { deviation: 0, coverage: 1 },
  bad: { input: { deviation: 0.4, coverage: 1 }, face: '>', path: '<', side: 1 },
};

export function mapInput({ deviation, coverage }) {
  const d = deviation || 0;
  const c = coverage || 0;
  return makeStrike({
    clubSpeed: 0.55 + 0.45 * c,
    faceToTarget: d * 12,
    path: -d * 8,
    contact: c * (1 - Math.min(1, Math.abs(d))),
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Trace the arc from the right, back through.</p><svg class="sw-arc" viewBox="0 0 200 120"><path d="M20 100 Q100 10 180 100" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="3"/><path class="draw" d="" fill="none" stroke="#e0a04a" stroke-width="4"/></svg></div>`;
  const svg = root.querySelector('svg');
  const draw = root.querySelector('.draw');
  let pts = [];
  function local(e) {
    const r = svg.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 200, y: ((e.clientY - r.top) / r.height) * 120 };
  }
  svg.addEventListener('pointerdown', (e) => { pts = [local(e)]; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener('pointermove', (e) => {
    if (!svg.hasPointerCapture(e.pointerId)) return;
    pts.push(local(e));
    draw.setAttribute('d', pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' '));
  });
  svg.addEventListener('pointerup', () => {
    if (pts.length < 4) return;
    let dev = 0;
    for (const p of pts) {
      const t = Math.max(0, Math.min(1, (p.x - 20) / 160));
      const y = 100 + (10 - 100) * 4 * t * (1 - t);
      dev += (p.y - y) / 80;
    }
    dev = Math.max(-1, Math.min(1, dev / pts.length));
    const minX = Math.min(...pts.map((p) => p.x));
    const maxX = Math.max(...pts.map((p) => p.x));
    const coverage = Math.max(0, Math.min(1, (maxX - minX) / 150));
    emit(mapInput({ deviation: dev, coverage }));
    draw.setAttribute('d', '');
  });
  return { destroy() { root.innerHTML = ''; } };
}
