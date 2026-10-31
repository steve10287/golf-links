// Horizontal drag on the view rotates the target line.
export function bindAim(el, onAim) {
  let rec = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest && e.target.closest('button, #sheet, #swing, #club')) return;
    rec = { id: e.pointerId, x: e.clientX, y: e.clientY, ok: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (!rec || e.pointerId !== rec.id) return;
    const dx = e.clientX - rec.x;
    const dy = e.clientY - rec.y;
    if (!rec.ok) {
      if (Math.hypot(dx, dy) < 6) return;
      if (Math.abs(dx) <= Math.abs(dy)) { rec = null; return; }
      rec.ok = true;
    }
    onAim(e.clientX - rec.x);
    rec.x = e.clientX;
  });
  const up = (e) => { if (rec && e.pointerId === rec.id) rec = null; };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}
