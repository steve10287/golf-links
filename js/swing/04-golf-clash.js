import { makeStrike } from './strike.js';

export const meta = { id: 4, name: 'Pull and needle', blurb: 'Pull down for power, release, then tap the needle in the slot.' };
export const samples = {
  perfect: { power: 1, needle: 0 },
  bad: { input: { power: 1, needle: 0.4 }, face: '>', path: '>', side: 1 },
};

export function mapInput({ power, needle }) {
  const n = needle || 0;
  return makeStrike({
    clubSpeed: power,
    faceToTarget: n * 11,
    path: n * 6,
    contact: 1 - Math.min(1, Math.abs(n) * 1.1),
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Pull down, release, tap the slot.</p><div class="sw-pull"></div><div class="sw-hbar hidden"><i class="sw-slot"></i><i class="sw-hneedle"></i></div></div>`;
  const pull = root.querySelector('.sw-pull');
  const bar = root.querySelector('.sw-hbar');
  const needle = root.querySelector('.sw-hneedle');
  let y0 = 0;
  let power = 0;
  let phase = 'pull';
  let t = 0;
  let dead = false;
  pull.addEventListener('pointerdown', (e) => { y0 = e.clientY; pull.setPointerCapture(e.pointerId); });
  pull.addEventListener('pointermove', (e) => {
    if (phase !== 'pull' || !pull.hasPointerCapture(e.pointerId)) return;
    const p = Math.max(0, Math.min(1.15, (e.clientY - y0) / 150));
    pull.style.transform = `scaleY(${1 + p})`;
    power = p;
  });
  pull.addEventListener('pointerup', () => {
    if (phase !== 'pull' || power < 0.15) return;
    phase = 'needle';
    pull.classList.add('hidden');
    bar.classList.remove('hidden');
  });
  bar.addEventListener('pointerdown', () => {
    if (phase !== 'needle') return;
    const n = Math.sin(t * 3.1);
    emit(mapInput({ power, needle: n }));
    phase = 'pull';
    power = 0;
    pull.style.transform = '';
    pull.classList.remove('hidden');
    bar.classList.add('hidden');
  });
  return {
    destroy() { dead = true; root.innerHTML = ''; },
    tick(dt) {
      if (dead || phase !== 'needle') return;
      t += dt;
      needle.style.left = (50 + Math.sin(t * 3.1) * 42) + '%';
    },
  };
}
