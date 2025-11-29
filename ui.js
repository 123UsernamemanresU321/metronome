// UI helpers for focus management and inline errors.

export function setErrorText(el, msg) {
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
}

export function trapFocus(container, enabled) {
  if (!container) return () => {};
  const focusable = () =>
    Array.from(
      container.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((n) => !n.hasAttribute('hidden'));

  function handler(e) {
    if (!enabled) return;
    if (e.key !== 'Tab') return;
    const nodes = focusable();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  container.addEventListener('keydown', handler);
  return () => container.removeEventListener('keydown', handler);
}
