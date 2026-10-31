// Swing stick on the lower screen, and a horizontal drag that only rotates aim.
// Haptics: Android vibration, or an iOS 18+ switch tick. Rate-limited.
import { gradeSwing, pathError, transitionRush } from './swing.js';

function haptics() {
  let on = true;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = 'iosHapticSwitch';
  try { input.setAttribute('switch', ''); } catch (_) {}
  const label = document.createElement('label');
  label.htmlFor = input.id;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-80px;width:1px;height:1px;overflow:hidden';
  wrap.append(input, label);
  document.body.append(wrap);
  const vibrate = typeof navigator.vibrate === 'function';
  let last = 0;
  function allow(gap) {
    const now = performance.now();
    if (now - last < gap) return false;
    last = now;
    return true;
  }
  return {
    tick(strength) {
      if (!on || !allow(strength > 0.5 ? 34 : 58)) return;
      if (vibrate) { try { navigator.vibrate(strength > 0.65 ? [8, 14, 10] : 8); } catch (_) {} }
      else { try { label.click(); } catch (_) {} }
    },
    pulse(pattern) {
      if (!on) return;
      last = performance.now();
      if (vibrate) { try { navigator.vibrate(pattern); } catch (_) {} }
      else { try { label.click(); } catch (_) {} }
    },
  };
}

export function bindInput({ swingEl, aimEl, dot, meter, onAim, onStrike }) {
  const feel = haptics();
  let aim = null;
  let sw = null;

  function down(e, zone) {
    if (e.target.closest && e.target.closest('button')) return;
    const rec = { id: e.pointerId, x: e.clientX, y: e.clientY, zone, mode: null };
    if (zone === 'swing') aim = rec;
    else aim = { ...rec, mode: 'aim' };
    e.preventDefault();
  }

  function startSwing(e, rec) {
    const r = swingEl.getBoundingClientRect();
    const x0 = rec.x - r.left, y0 = rec.y - r.top;
    const p = { x: x0, y: y0, t: performance.now() };
    sw = { id: e.pointerId, r, x0, y0, max: 0, phase: 'back', pts: [p], trans: 0, fired: false };
    aim = null;
    swingEl.classList.add('live');
    if (meter) meter.style.height = '0px';
    moveDot(x0, y0);
  }

  function moveDot(x, y) {
    dot.style.left = x + 'px';
    dot.style.top = y + 'px';
  }

  function move(e) {
    if (aim && e.pointerId === aim.id && !sw) {
      const dx = e.clientX - aim.x, dy = e.clientY - aim.y;
      if (!aim.mode) {
        if (Math.hypot(dx, dy) < 8) return;
        aim.mode = Math.abs(dx) > Math.abs(dy) ? 'aim' : 'swing';
        if (aim.mode === 'swing') startSwing(e, aim);
      }
      if (aim && aim.mode === 'aim') {
        onAim(e.clientX - aim.x);
        aim.x = e.clientX;
      }
      return;
    }
    if (!sw || e.pointerId !== sw.id) return;
    const p = { x: e.clientX - sw.r.left, y: e.clientY - sw.r.top, t: performance.now() };
    sw.pts.push(p);
    moveDot(p.x, p.y);
    const pull = (p.y - sw.y0) / (sw.r.height * 0.5);
    const dev = Math.abs(p.x - sw.x0) / Math.max(1, sw.r.width);
    swingEl.style.setProperty('--trail', dev < 0.045 ? '#f4f1ea' : dev < 0.1 ? '#e0a04a' : '#d64545');
    if (meter) meter.style.height = Math.max(0, Math.min(sw.r.height * 0.5, (sw.max) * sw.r.height * 0.5)) + 'px';
    feel.tick(dev < 0.045 ? 0.15 : Math.min(1, dev * 5));
    if (sw.phase === 'back') {
      sw.max = Math.max(sw.max, Math.min(1.15, pull));
      if (sw.max > 0.12 && pull < sw.max - 0.07) {
        sw.phase = 'fwd';
        sw.trans = sw.pts.length - 1;
        const tBack = (p.t - sw.pts[0].t) / 1000;
        feel.pulse(tBack > 0.55 && tBack < 1.2 ? [14, 22, 16] : 12);
      }
    } else maybeFire(p);
  }

  function maybeFire(p) {
    if (!sw || sw.fired || sw.phase !== 'fwd' || sw.max <= 0.12) return;
    const pull = (p.y - sw.y0) / (sw.r.height * 0.5);
    if (pull > 0.12) return;
    sw.fired = true;
    feel.pulse([8, 16, 22]);
    const trans = sw.trans;
    const path = pathError(sw.pts, trans, sw.r.width);
    let tMove = sw.pts[0].t;
    for (const q of sw.pts) { if (q.y > sw.y0 + sw.r.height * 0.04) { tMove = q.t; break; } }
    const raw = {
      tBack: Math.max(0.05, (sw.pts[trans].t - tMove) / 1000),
      tDown: Math.max(0.04, (p.t - sw.pts[trans].t) / 1000),
      pathMean: path.mean, pathRms: path.rms, pathMag: path.mag, pathSign: path.sign,
      rush: transitionRush(sw.pts, trans),
      power: Math.max(0.08, Math.min(1.15, sw.max)),
      targetPower: 1,
      putting: false,
      pts: sw.pts, transX: sw.pts[trans].x,
    };
    onStrike(raw, gradeSwing(raw, 'tour'));
  }

  function up(e) {
    if (sw && e.pointerId === sw.id) {
      if (!sw.fired && sw.phase === 'fwd') maybeFire(sw.pts[sw.pts.length - 1]);
      sw = null;
      swingEl.classList.remove('live');
      if (meter) meter.style.height = '0px';
    }
    if (aim && e.pointerId === aim.id) aim = null;
  }

  swingEl.addEventListener('pointerdown', (e) => down(e, 'swing'));
  aimEl.addEventListener('pointerdown', (e) => down(e, 'aim'));
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}
