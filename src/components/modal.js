/**
 * نافذة محتوى مشتركة: تركيز محبوس، إغلاق بـ Escape، ومنع تمرير الخلفية.
 * @module components/modal
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/** @type {{ open: boolean, lastFocus: Element | null, onClose: (() => void) | null }} */
const state = { open: false, lastFocus: null, onClose: null };

/**
 * يفتح النافذة.
 * @param {Object} options
 * @param {string} options.title
 * @param {string} [options.badge]
 * @param {string} options.html محتوى موثوق (يجب أن يمرّ بـ escapeHtml قبل بنائه)
 * @param {string} [options.footerHtml]
 * @param {string} [options.progress]
 * @param {boolean} [options.read]
 * @param {() => void} [options.onClose]
 */
export function openModal({ title, badge = "", html, footerHtml = "", progress = "", read = false, onClose }) {
  const modal = document.getElementById("modal");
  if (!modal) return;
  state.lastFocus = document.activeElement;
  state.onClose = onClose ?? null;

  setText("modalTitle", title);
  setText("modalBadge", badge);
  setHtml("modalBody", html);
  const footer = document.getElementById("modalFooter");
  if (footer) footer.innerHTML = footerHtml;
  setText("modalProgress", progress);
  toggleHidden("modalReadMark", !read);

  modal.hidden = false;
  modal.classList.add("open");
  document.body.classList.add("no-scroll");
  state.open = true;

  const panel = modal.querySelector(".modal-panel");
  const first = panel?.querySelector(FOCUSABLE);
  /** @type {HTMLElement | null} */ (first)?.focus();
}

export function closeModal() {
  const modal = document.getElementById("modal");
  if (!modal || !state.open) return;
  modal.classList.remove("open");
  modal.hidden = true;
  document.body.classList.remove("no-scroll");
  state.open = false;
  state.onClose?.();
  state.onClose = null;
  /** @type {HTMLElement | null} */ (state.lastFocus)?.focus();
}

export function isModalOpen() {
  return state.open;
}

/** يحبس التركيز داخل النافذة أثناء التنقل بلوحة المفاتيح. */
export function trapFocus(event) {
  if (!state.open || event.key !== "Tab") return;
  const modal = document.getElementById("modal");
  const items = /** @type {HTMLElement[]} */ (
    Array.from(modal?.querySelectorAll(FOCUSABLE) ?? []).filter((item) => item.offsetParent !== null)
  );
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setHtml(id, value) {
  const element = document.getElementById(id);
  if (element) element.innerHTML = value;
}

function toggleHidden(id, hidden) {
  const element = document.getElementById(id);
  if (element) element.hidden = hidden;
}