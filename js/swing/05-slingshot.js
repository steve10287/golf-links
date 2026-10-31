import { makeStrike } from './strike.js';

export const meta = { id: 5, name: 'Slingshot', blurb: 'Pull back from the ball. Distance is power, angle is the start line.' };
export const samples = {
  perfect: { pull: 1, angleDeg: 0 },
  bad: { input: { pull: 1, angleDeg: 8 }, face: '>', path: '>', side: 1 },
};

export function mapInput({ pull, angleDeg }) {
  const a = angleDeg || 0;
  return makeStrike({
    clubSpeed: pull,
    faceToTarget: a * 0.75,
    path: a * 0.35,
    contact: 1 - Math.min(1, Math.abs(a) / 40) * 0.4,
    tempo: 3,
  });
}

export function mount({ root, emit }) {
  root.innerHTML = `<div class="sw"><p class="sw-hint">Pull back from the ball.</p><div class="sw-pad"><i class="sw-ball"></i><i class="sw-line"></i></div></div>`;
  const pad = root.querySelector('.sw-pad');
  const ball = root.querySelector('.sw-ball');
  const line = root.querySelector('.sw-line');
  let x0 = 0;
  let y0 = 0;
  pad.addEventListener('pointerdown', (e) => {
    const r = pad.getBoundingClientRect();
    x0 = r.left + r.width / 2;
    y0 = r.top + 28;
    pad.setPointerCapture(e.pointerId);
  });
  pad.addEventListener('pointermove', (e) => {
    if (!pad.hasPointerCapture(e.pointerId)) return;
    line.style.width = Math.hypot(e.clientX - x0, e.clientY - y0) + 'px';
    line.style.transform = `rotate(${Math.atan2(e.clientX - x0, e.clientY - y0)}rad)`;
    ball.style.transform = `translate(${e.clientX - x0}px, ${e.clientY - y0}px)`;
  });
  pad.addEventListener('pointerup', (e) => {
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    const pull = Math.min(1.2, Math.hypot(dx, dy) / 140);
    if (pull > 0.12) {
      const angleDeg = Math.atan2(dx, dy) * 180 / Math.PI;
      emit(mapInput({ pull, angleDeg }));
    }
    ball.style.transform = '';
    line.style.width = '0px';
  });
  return { destroy() { root.innerHTML = ''; } };
}
