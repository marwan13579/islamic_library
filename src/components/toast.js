/**
 * نظام التنبيهات الموحّد (Toast).
 * @module components/toast
 */

/**
 * يعرض تنبيهًا أسفل الشاشة.
 * @param {string} message
 * @param {boolean} [celebrate] نمط احتفالي
 * @param {number} [duration] بالمللي ثانية
 */
export function showToast(message, celebrate = false, duration = 3200) {
  const holder = document.getElementById("toastMsg");
  if (!holder) return;
  holder.textContent = message;
  holder.classList.toggle("celebrate", celebrate);
  holder.classList.add("show");
  clearTimeout(holder.dataset.timer);
  /** @type {any} */ (holder.dataset).timer = setTimeout(() => {
    holder.classList.remove("show");
  }, duration);
}

/** اهتزاز خفيف إن كان الجهاز يدعمه. */
export function buzz(pattern = 200) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* غير مدعوم */
  }
}