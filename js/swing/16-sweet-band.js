import { makeStrike } from './strike.js';

export const meta = { id: 16, name: 'Sweet band', blurb: 'Hold, and release while the band covers your marker.' };
export const samples = {
  perfect: { release: 0.5, center: 0.5, half: 0.1 },
  bad: { input: { release: 0.7, center: 0.5, half: 0.1 }, face: '>', side: 1 },
};

export function mapInput({ release, center, half }) {
  const off = (release - center) / Math.max(0.04, half);
  const inside = Math.abs(off) <= 1;
  return makeStrike({
    clubSpeed: 0.9 + 0.1 * (1 - Math.min(1, Math.abs(off))),
    faceToTarget: off * 9,
    path: off * 3,
    contact: inside ? 1 - Math.abs(off) * 0.35 : Math.max(0, 1 - Math.abs(off) * 0.7),
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Hold, release inside the band.</p><div class="sw-hbar"><i class="sw-band"></i><i class="sw-pin"></i></div></div>`;
  const band = root.querySelector('.sw-band');
  const pin = root.querySelector('.sw-pin');
  let held = false;
  let t = 0;
  let dead = false;
  const center = 0.62;
  const half = 0.1;
  root.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) held = true; });
  root.addEventListener('pointerup', () => {
    if (!held) return;
    held = false;
    const release = (Math.sin(t * 1.8) + 1) / 2;
    emit(mapInput({ release, center, half }));
  });
  return {
    destroy() { dead = true; root.innerHTML = ''; },
    tick(dt) {
      if (dead) return;
      t += dt;
      const x = (Math.sin(t * 1.8) + 1) / 2;
      band.style.left = ((center - half) * 100) + '%';
      band.style.width = (half * 2 * 100) + '%';
      pin.style.left = (x * 100) + '%';
    },
  };
}
