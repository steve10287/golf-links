import { makeStrike } from './strike.js';

export const meta = { id: 13, name: 'Clock', blurb: 'Pick a backswing on the clock, 7 to 11, then one timing tap.' };
export const samples = {
  perfect: { hour: 11, tap: 0 },
  bad: { input: { hour: 11, tap: 0.1 }, face: '>', side: 1 },
};
const POWER = { 7: 0.55, 8: 0.72, 9: 0.86, 10: 0.96, 11: 1 };

export function mapInput({ hour, tap }) {
  const h = Math.round(hour);
  const t = tap || 0;
  return makeStrike({
    clubSpeed: POWER[h] ?? 1,
    faceToTarget: t * 40,
    path: t * 15,
    contact: 1 - Math.min(1, Math.abs(t) * 2),
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Choose 7 to 11, then tap the beat.</p><div class="sw-clock"></div><b class="sw-read">Tap when it flashes</b></div>`;
  const clock = root.querySelector('.sw-clock');
  const read = root.querySelector('.sw-read');
  let hour = 9;
  for (const h of [7, 8, 9, 10, 11]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(h);
    b.className = h === 9 ? 'on' : '';
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      hour = h;
      clock.querySelectorAll('button').forEach((n) => n.classList.toggle('on', n === b));
    });
    clock.append(b);
  }
  let t = 0;
  let dead = false;
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const err = Math.sin(t * 2.2);
    emit(mapInput({ hour, tap: err * 0.16 }));
    read.textContent = 'Tap when it flashes';
  });
  return {
    destroy() { dead = true; root.innerHTML = ''; },
    tick(dt) {
      if (dead) return;
      t += dt;
      read.style.opacity = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.2));
    },
  };
}
