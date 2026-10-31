import { makeStrike } from './strike.js';

export const meta = { id: 15, name: 'Shrink ring', blurb: 'Tap when the shrinking ring covers the ball.' };
export const samples = {
  perfect: { scale: 1 },
  bad: { input: { scale: 1.3 }, face: '>', side: 1 },
};

export function mapInput({ scale }) {
  const s = scale ?? 1;
  return makeStrike({
    clubSpeed: 1 - Math.abs(s - 1) * 0.25,
    faceToTarget: (s - 1) * 16,
    path: (s - 1) * 4,
    contact: 1 - Math.min(1, Math.abs(s - 1) * 1.4),
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Tap when the ring fits the ball.</p><div class="sw-target"><i class="core"></i><i class="ring"></i></div></div>`;
  const ring = root.querySelector('.ring');
  let t = 0;
  let dead = false;
  function scale() { return 1.85 - (t % 1.5) / 1.5 * 1.35; }
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    emit(mapInput({ scale: scale() }));
  });
  return {
    destroy() { dead = true; root.innerHTML = ''; },
    tick(dt) {
      if (dead) return;
      t += dt;
      const s = scale();
      ring.style.transform = `scale(${s})`;
    },
  };
}
