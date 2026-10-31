import { makeStrike } from './strike.js';

export const meta = { id: 20, name: 'One-tap', blurb: 'One tap on the pulse. Timing only widens the miss a little.' };
export const samples = {
  perfect: { error: 0 },
  bad: { input: { error: 0.2 }, face: '>', side: 1 },
};

export function mapInput({ error }) {
  const e = error || 0;
  return makeStrike({
    clubSpeed: 1 - Math.min(0.15, Math.abs(e) * 0.2),
    faceToTarget: e * 10,
    path: e * 4,
    contact: 1 - Math.min(1, Math.abs(e) * 0.8),
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Tap as the circle peaks.</p><button class="sw-pulse" type="button"></button></div>`;
  const btn = root.querySelector('.sw-pulse');
  let t = 0;
  let dead = false;
  btn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    emit(mapInput({ error: Math.cos(t * 2.4) * 0.2 }));
  });
  return {
    destroy() { dead = true; root.innerHTML = ''; },
    tick(dt) {
      if (dead) return;
      t += dt;
      const s = 0.75 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.4));
      btn.style.transform = `scale(${s})`;
    },
  };
}
