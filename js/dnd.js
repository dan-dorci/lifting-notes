// Long-press drag-to-reorder for touch lists.
// Hold ~350ms to lift a row (quick swipes scroll as normal), drag to reorder,
// release to commit. While dragging, the scroll container is locked and
// touchmove is prevented; near-edge auto-scroll runs on a rAF loop.
import { useState, useRef, useEffect } from './ui.js';

export function useLongPressReorder({ getIds, onCommit, scrollEl, holdMs = 350 }) {
  const [drag, setDrag] = useState(null); // { id, order } during drag, else null
  const refs = useRef(new Map());
  const st = useRef(null);               // transient gesture state
  const suppressClick = useRef(false);

  const rowRef = (id) => (el) => {
    if (el) refs.current.set(id, el);
    else refs.current.delete(id);
  };

  const cleanup = () => {
    const s = st.current;
    if (!s) return;
    clearTimeout(s.timer);
    cancelAnimationFrame(s.raf);
    document.removeEventListener('pointermove', s.onMove);
    document.removeEventListener('pointerup', s.onUp);
    document.removeEventListener('pointercancel', s.onCancel);
    document.removeEventListener('touchmove', s.onTouchMove);
    if (s.lockedEl) s.lockedEl.style.overflowY = '';
    st.current = null;
  };

  useEffect(() => cleanup, []);

  // New index = how many other rows' midpoints sit above the pointer.
  const reorderToPointer = () => {
    const s = st.current;
    if (!s || !s.active) return;
    const others = s.order.filter((x) => x !== s.id);
    let idx = 0;
    for (const oid of others) {
      const el = refs.current.get(oid);
      if (el) {
        const r = el.getBoundingClientRect();
        if (s.y > r.top + r.height / 2) idx++;
      }
    }
    const next = [...others.slice(0, idx), s.id, ...others.slice(idx)];
    if (next.join('\n') !== s.order.join('\n')) {
      s.order = next;
      setDrag({ id: s.id, order: next });
    }
  };

  const tick = () => {
    const s = st.current;
    if (!s || !s.active) return;
    const sc = s.lockedEl;
    if (sc) {
      const r = sc.getBoundingClientRect();
      const M = 70;
      if (s.y < r.top + M) sc.scrollTop -= Math.min(14, (r.top + M - s.y) / 4);
      else if (s.y > r.bottom - M) sc.scrollTop += Math.min(14, (s.y - (r.bottom - M)) / 4);
      reorderToPointer();
    }
    s.raf = requestAnimationFrame(tick);
  };

  const onPointerDown = (id) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    cleanup();
    const s = {
      id, startY: e.clientY, y: e.clientY,
      active: false, lockedEl: null, timer: 0, raf: 0,
    };
    st.current = s;

    s.onTouchMove = (te) => { if (s.active) te.preventDefault(); };
    s.onMove = (me) => {
      s.y = me.clientY;
      if (!s.active) {
        // Finger moved before the hold elapsed — it's a scroll, not a drag.
        if (Math.abs(s.y - s.startY) > 8) cleanup();
        return;
      }
      reorderToPointer();
    };
    s.onUp = () => {
      if (s.active) {
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 150);
        onCommit(s.order);
      }
      cleanup();
      setDrag(null);
    };
    s.onCancel = () => { cleanup(); setDrag(null); };

    document.addEventListener('pointermove', s.onMove);
    document.addEventListener('pointerup', s.onUp);
    document.addEventListener('pointercancel', s.onCancel);

    s.timer = setTimeout(() => {
      s.active = true;
      s.order = [...getIds()];
      s.lockedEl = scrollEl ? scrollEl() : null;
      if (s.lockedEl) s.lockedEl.style.overflowY = 'hidden';
      document.addEventListener('touchmove', s.onTouchMove, { passive: false });
      setDrag({ id: s.id, order: s.order });
      s.raf = requestAnimationFrame(tick);
    }, holdMs);
  };

  // Swallow the click that follows a completed drag so links don't navigate.
  const onClickGuard = (e) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return {
    rowRef,
    onPointerDown,
    onClickGuard,
    dragId: drag ? drag.id : null,
    order: drag ? drag.order : null,
  };
}
