import { makeStrike } from './strike.js';

export const meta = { id: 11, name: 'Dial', blurb: 'Turn clockwise for the backswing, then reverse quickly.' };
export const samples = {
  perfect: { turns: 1, downRate: 1 },
  bad: { input: { turns: 1, downRate: 1.5 }, face: '>', side: 1 },
};

export function mapInput({ turns, downRate }) {
  const rate = downRate || 0;
  return makeStrike({
    clubSpeed: (turns || 0) * rate,
    faceToTarget: (rate - 1) * 6,
    path: ((turns || 0) - 1) * 5,
    contact: 1 - Math.min(1, Math.abs(rate - 1) * 0.8),
    tempo: 3 * rate,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Clockwise, then back fast.</p><div class="sw-dial"><i></i></div></div>`;
  const dial = root.querySelector('.sw-dial');
  const hand = root.querySelector('.sw-dial i');
  let last = null;
  let back = 0;
  let down = 0;
  let downT = 0;
  let phase = 'back';
  function ang(e) {
    const r = dial.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  }
  dial.addEventListener('pointerdown', (e) => { last = ang(e); back = 0; down = 0; downT = 0; phase = 'back'; dial.setPointerCapture(e.pointerId); });
  dial.addEventListener('pointermove', (e) => {
    if (!dial.hasPointerCapture(e.pointerId) || last == null) return;
    let d = ang(e) - last;
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    last = ang(e);
    if (phase === 'back' && d < -0.4) { phase = 'down'; downT = performance.now(); }
    if (phase === 'back') back += Math.max(0, d);
    else down += Math.max(0, -d);
    hand.style.transform = `rotate(${(back - down) * 180 / Math.PI}deg)`;
  });
  dial.addEventListener('pointerup', () => {
    const turns = back / Math.PI;
    const dt = Math.max(0.05, downT ? (performance.now() - downT) / 1000 : 0.4);
    const downRate = (down / Math.PI) / (dt / 0.28);
    if (turns > 0.15) emit(mapInput({ turns, downRate }));
    hand.style.transform = '';
    last = null;
  });
  return { destroy() { root.innerHTML = ''; } };
}
