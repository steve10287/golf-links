import { makeStrike } from './strike.js';

export const meta = { id: 9, name: 'Rhythm taps', blurb: 'Three taps: takeaway, top, impact, in a 3 to 1 rhythm.' };
export const samples = {
  perfect: { gaps: [0.75, 0.25] },
  bad: { input: { gaps: [0.3, 0.3] }, face: '<', side: -1 },
};

export function mapInput({ gaps }) {
  const g1 = gaps[0];
  const g2 = Math.max(0.05, gaps[1]);
  const err = Math.log((g1 / g2) / 3);
  return makeStrike({
    clubSpeed: 0.25 / g2,
    faceToTarget: err * 8,
    path: err * 3,
    contact: 1 - Math.min(1, Math.abs(err) * 0.45 + Math.abs(g2 - 0.25) * 0.8),
    tempo: g1 / g2,
  });
}

export function mount({ root, feel, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Tap takeaway, top, impact.</p><div class="sw-dots"><i></i><i></i><i></i></div><b class="sw-read">Takeaway</b></div>`;
  const dots = [...root.querySelectorAll('.sw-dots i')];
  const read = root.querySelector('.sw-read');
  const names = ['Takeaway', 'Top', 'Impact'];
  let times = [];
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    times.push(performance.now());
    dots[times.length - 1].classList.add('on');
    feel.tick(0.4);
    if (times.length < 3) { read.textContent = names[times.length]; return; }
    emit(mapInput({ gaps: [(times[1] - times[0]) / 1000, (times[2] - times[1]) / 1000] }));
    times = [];
    dots.forEach((d) => d.classList.remove('on'));
    read.textContent = 'Takeaway';
  });
  return { destroy() { root.innerHTML = ''; } };
}
