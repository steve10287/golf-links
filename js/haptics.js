// Path ticks. Android uses navigator.vibrate. iOS Safari does not.
// iOS 18+ plays a system tick when a switch-style checkbox is toggled, so a
// hidden label click is the fallback. Ticks are rate-limited. If neither
// path exists, calls do nothing.
export function createHaptics() {
  let enabled = true;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = 'iosHapticSwitch';
  try { input.setAttribute('switch', ''); } catch (_) {}
  const label = document.createElement('label');
  label.htmlFor = 'iosHapticSwitch';
  label.textContent = 'haptic';
  const wrap = document.createElement('div');
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.cssText = 'position:fixed;left:-100px;top:0;width:1px;height:1px;overflow:hidden;';
  wrap.append(input, label);
  document.body.append(wrap);
  const hasVibrate = typeof navigator.vibrate === 'function';
  let last = 0;

  function iosTick() {
    try { label.click(); } catch (_) {}
  }
  function tick(strength) {
    if (!enabled) return;
    const now = performance.now();
    const gap = strength > 0.55 ? 32 : 55;
    if (now - last < gap) return;
    last = now;
    const s = Math.max(0, Math.min(1, strength));
    if (hasVibrate) {
      try { navigator.vibrate(s > 0.7 ? [10, 16, 12] : s > 0.35 ? 12 : 6); } catch (_) {}
    } else iosTick();
  }
  function pulse(pattern) {
    if (!enabled) return;
    last = performance.now();
    if (hasVibrate) {
      try { navigator.vibrate(pattern); } catch (_) {}
    } else iosTick();
  }
  return {
    tick, pulse,
    setEnabled(v) { enabled = !!v; },
    get enabled() { return enabled; },
    hasVibrate,
  };
}
