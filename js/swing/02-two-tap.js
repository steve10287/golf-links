import { makeStrike } from './strike.js';

export const meta = { id: 2, name: 'Two-tap', blurb: 'Stop the bar for power, then stop it for accuracy.' };
export const samples = {
  perfect: { power: 0.75, accuracy: 0 },
  bad: { input: { power: 0.75, accuracy: -0.4 }, path: '<', side: 1 },
};

export function mapInput({ power, accuracy }) {
  const acc = accuracy || 0;
  return makeStrike({
    clubSpeed: (power || 0) / 0.75,
    faceToTarget: acc * 3,
    path: acc * 12,
    contact: 1 - Math.min(1, Math.abs(acc) * 0.9),
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Tap the mark, then tap the middle.</p><div class="sw-hbar"><i class="sw-mark"></i><i class="sw-hneedle"></i></div><b class="sw-read">Tap for power</b></div>`;
  const needle = root.querySelector('.sw-hneedle');
  const read = root.querySelector('.sw-read');
  let phase = 'power';
  let t = 0;
  let power = 0.75;
  let dead = false;
  function u() { return (Math.sin(t * 2.1) + 1) / 2; }
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    if (phase === 'power') { power = u(); phase = 'acc'; read.textContent = 'Tap the middle'; return; }
    emit(mapInput({ power, accuracy: (u() - 0.5) * 2 }));
    phase = 'power';
    read.textContent = 'Tap for power';
  });
  return {
    destroy() { dead = true; root.innerHTML = ''; },
    tick(dt) { if (dead) return; t += dt; needle.style.left = (6 + u() * 88) + '%'; },
  };
}
