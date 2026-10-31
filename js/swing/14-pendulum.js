import { makeStrike } from './strike.js';

export const meta = { id: 14, name: 'Pendulum', blurb: 'Tap as the pendulum passes the bottom.' };
export const samples = {
  perfect: { offset: 0 },
  bad: { input: { offset: -0.3 }, face: '<', side: -1 },
};

export function mapInput({ offset }) {
  const o = offset || 0;
  return makeStrike({
    clubSpeed: 1 - Math.abs(o) * 0.2,
    faceToTarget: o * 14,
    path: o * 4,
    contact: 1 - Math.min(1, Math.abs(o) * 1.05),
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Tap at the bottom.</p><div class="sw-pend"><i><b></b></i></div></div>`;
  const arm = root.querySelector('.sw-pend i');
  let t = 0;
  let dead = false;
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    emit(mapInput({ offset: Math.sin(t * 1.7) }));
  });
  return {
    destroy() { dead = true; root.innerHTML = ''; },
    tick(dt) {
      if (dead) return;
      t += dt;
      arm.style.transform = `rotate(${Math.sin(t * 1.7) * 34}deg)`;
    },
  };
}
