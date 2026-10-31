import { makeStrike } from './strike.js';

export const meta = { id: 1, name: '3-click', blurb: 'Tap to start, tap to set power, tap the centre band.' };
export const samples = {
  perfect: { power: 1, accuracy: 0 },
  bad: { input: { power: 1, accuracy: 0.4 }, face: '>', path: '>', side: 1 },
};

export function mapInput({ power, accuracy }) {
  const acc = accuracy || 0;
  return makeStrike({
    clubSpeed: power,
    faceToTarget: acc * 14,
    path: acc * 5,
    contact: 1 - Math.min(1, Math.abs(acc) * 0.85),
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Tap start, then power, then the centre band.</p><div class="sw-meter"><i class="sw-zone top"></i><i class="sw-zone mid"></i><i class="sw-needle"></i></div><b class="sw-read">Tap to start</b></div>`;
  const needle = root.querySelector('.sw-needle');
  const read = root.querySelector('.sw-read');
  const zoneTop = root.querySelector('.top');
  const zoneMid = root.querySelector('.mid');
  let phase = 'idle';
  let t = 0;
  let power = 0;
  let dead = false;
  function u() { return (Math.sin(t * 2.4) + 1) / 2; }
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    if (phase === 'idle') { phase = 'power'; read.textContent = 'Tap at the top'; zoneTop.classList.add('on'); return; }
    if (phase === 'power') { power = 0.15 + u() * 0.9; phase = 'acc'; read.textContent = 'Tap the centre'; zoneTop.classList.remove('on'); zoneMid.classList.add('on'); return; }
    if (phase === 'acc') { emit(mapInput({ power, accuracy: (u() - 0.5) * 2 })); phase = 'idle'; read.textContent = 'Tap to start'; zoneMid.classList.remove('on'); }
  });
  return {
    destroy() { dead = true; root.innerHTML = ''; },
    tick(dt) { if (!dead && phase !== 'idle') { t += dt; needle.style.bottom = (8 + u() * 78) + '%'; } },
  };
}
