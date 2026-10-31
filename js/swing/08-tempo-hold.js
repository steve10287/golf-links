import { makeStrike } from './strike.js';

export const meta = { id: 8, name: 'Tempo hold', blurb: 'Hold the backswing, then flick. Tour tempo is 3 to 1.' };
export const samples = {
  perfect: { hold: 0.9, flick: 0.3 },
  bad: { input: { hold: 0.45, flick: 0.3 }, face: '<', side: -1 },
};

export function mapInput({ hold, flick }) {
  const h = Math.max(0.05, hold || 0);
  const f = Math.max(0.05, flick || 0);
  const err = Math.log((h / f) / 3);
  return makeStrike({
    clubSpeed: 0.3 / f,
    faceToTarget: err * 8,
    path: err * 3,
    contact: 1 - Math.min(1, Math.abs(err) * 0.5),
    tempo: h / f,
  });
}

export function mount({ root, feel, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Hold, then flick up. Three times longer than the flick.</p><div class="sw-hold"><i></i></div><b class="sw-read">Hold</b></div>`;
  const bar = root.querySelector('.sw-hold i');
  const read = root.querySelector('.sw-read');
  const pad = root.querySelector('.sw-hold');
  let t0 = 0;
  let held = false;
  let flickPts = null;
  pad.addEventListener('pointerdown', (e) => {
    held = true;
    t0 = performance.now();
    flickPts = [{ y: e.clientY, t: t0 }];
    pad.setPointerCapture(e.pointerId);
    feel.tick(0.25);
  });
  pad.addEventListener('pointermove', (e) => { if (held) flickPts.push({ y: e.clientY, t: performance.now() }); });
  pad.addEventListener('pointerup', (e) => {
    if (!held) return;
    held = false;
    const hold = (performance.now() - t0) / 1000;
    const pts = flickPts || [];
    let flick = 0.3;
    for (let i = pts.length - 1; i >= 0; i--) {
      if (pts[0].y - pts[i].y > 30) { flick = Math.max(0.05, (pts[i].t - pts[0].t) / 1000); break; }
    }
    if (e.clientY < pts[0].y - 20) {
      const up = pts.filter((p) => p.y < pts[0].y - 10);
      if (up.length) flick = Math.max(0.05, (up[up.length - 1].t - up[0].t) / 1000);
    }
    emit(mapInput({ hold, flick }));
    bar.style.height = '0%';
    read.textContent = 'Hold';
  });
  return {
    destroy() { root.innerHTML = ''; },
    tick() {
      if (!held) return;
      const h = (performance.now() - t0) / 900;
      bar.style.height = Math.min(100, h * 100) + '%';
      read.textContent = h < 1 ? 'Hold' : 'Flick';
    },
  };
}
