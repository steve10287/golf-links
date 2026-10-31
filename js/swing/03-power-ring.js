import { makeStrike } from './strike.js';

export const meta = { id: 3, name: 'Power ring', blurb: 'Hold, and release as the ring meets the mark.' };
export const samples = {
  perfect: { fill: 1 },
  bad: { input: { fill: 1.25 }, face: '>', side: 1 },
};

export function mapInput({ fill }) {
  const f = fill || 0;
  return makeStrike({
    clubSpeed: f,
    faceToTarget: (f - 1) * 10,
    path: 0,
    contact: 1 - Math.min(1, Math.abs(f - 1) * 2),
    tempo: 3,
  });
}

export function mount({ root, feel, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Hold, release on the ring.</p><div class="sw-ring"><i></i><b>hold</b></div></div>`;
  const arc = root.querySelector('.sw-ring i');
  let fill = 0;
  let held = false;
  let dead = false;
  const ring = root.querySelector('.sw-ring');
  ring.addEventListener('pointerdown', (e) => { held = true; fill = 0; ring.setPointerCapture(e.pointerId); feel.tick(0.3); });
  ring.addEventListener('pointerup', () => {
    if (!held) return;
    held = false;
    emit(mapInput({ fill }));
    fill = 0;
    arc.style.background = 'conic-gradient(#fff 0deg, transparent 0deg)';
  });
  return {
    destroy() { dead = true; root.innerHTML = ''; },
    tick(dt) {
      if (dead || !held) return;
      fill = Math.min(1.35, fill + dt * 0.55);
      const deg = Math.min(360, fill * 360);
      arc.style.background = `conic-gradient(#f4f1ea ${deg}deg, transparent ${deg}deg)`;
      if (fill > 0.92 && fill < 1.08) feel.tick(0.7);
    },
  };
}
