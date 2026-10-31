// Android vibration, or an iOS 18+ switch tick. Rate-limited.
export function createHaptics() {
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
    tick(strength = 0.2) {
      if (!allow(strength > 0.5 ? 34 : 58)) return;
      if (vibrate) { try { navigator.vibrate(strength > 0.65 ? [8, 14, 10] : 8); } catch (_) {} }
      else { try { label.click(); } catch (_) {} }
    },
    pulse(pattern = 12) {
      last = performance.now();
      if (vibrate) { try { navigator.vibrate(pattern); } catch (_) {} }
      else { try { label.click(); } catch (_) {} }
    },
  };
}
