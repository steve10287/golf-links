import { makeStrike } from './strike.js';

export const meta = { id: 18, name: 'Fader', blurb: 'Drag the fader down for power. A straight release is pure contact.' };
export const samples = {
  perfect: { level: 1, vx: 0, vy: -800 },
  bad: { input: { level: 1, vx: 80, vy: -400 }, face: '>', side: 1 },
};

export function mapInput({ level, vx, vy }) {
  const straight = Math.abs(vx || 0) / (Math.abs(vy || 0) + 1);
  return makeStrike({
    clubSpeed: level,
    faceToTarget: (vx || 0) * 0.04,
    path: (vx || 0) * 0.015,
    contact: 1 - Math.min(1, straight * 2),
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Drag down, let go straight.</p><div class="sw-fader"><i></i></div></div>`;
  const fader = root.querySelector('.sw-fader');
  const knob = root.querySelector('.sw-fader i');
  let y0 = 0;
  let last = [];
  let level = 0;
  fader.addEventListener('pointerdown', (e) => {
    y0 = e.clientY;
    last = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    fader.setPointerCapture(e.pointerId);
  });
  fader.addEventListener('pointermove', (e) => {
    if (!fader.hasPointerCapture(e.pointerId)) return;
    level = Math.max(0, Math.min(1.1, (e.clientY - y0) / 140));
    knob.style.top = (12 + level * 70) + '%';
    last.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (last.length > 5) last.shift();
  });
  fader.addEventListener('pointerup', () => {
    const a = last[0];
    const b = last[last.length - 1];
    const dt = Math.max(16, b.t - a.t);
    const vx = (b.x - a.x) / dt * 1000;
    const vy = (b.y - a.y) / dt * 1000;
    if (level > 0.08) emit(mapInput({ level, vx, vy: vy || -1 }));
    knob.style.top = '12%';
    level = 0;
  });
  return { destroy() { root.innerHTML = ''; } };
}
