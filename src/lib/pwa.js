/**
 * دعم تثبيت التطبيق (PWA): تسجيل عامل الخدمة، زر التثبيت، تحديث النسخة،
 * وإرسال الإشعارات عبر عامل الخدمة.
 * @module lib/pwa
 */

import { showToast } from "../components/toast.js";

/** @type {BeforeInstallPromptEvent | null} */
let installPrompt = null;

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** @returns {boolean} هل التطبيق يعمل الآن في وضع مثبَّت؟ */
export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

/** @returns {boolean} هل يستطيع المتصفح عرض زر التثبيت؟ */
export function canInstall() {
  return installPrompt !== null;
}

/**
 * يسجّل عامل الخدمة ويحدّث النسخة عند توفّر نسخة جديدة.
 * @param {{ onUpdate?: () => void }} [options]
 * @returns {Promise<ServiceWorkerRegistration | null>}
 */
export async function registerServiceWorker(options = {}) {
  if (!("serviceWorker" in navigator)) return null;
  if (!("isSecureContext" in window) || !window.isSecureContext) return null;
  try {
    // الوحدة في src/lib، فالجذر على مستويين أعلى — والنطاق هو جذر المشروع
    // حتى تُخزَّن صفحات الفهرس والصفحات القديمة (٣٤ صفحة) كذلك.
    const scope = new URL("../../", import.meta.url).href;
    const registration = await navigator.serviceWorker.register("../../sw.js", { scope });
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state !== "installed") return;
        if (navigator.serviceWorker.controller) options.onUpdate?.();
        else notifyInstalled();
      });
    });
    return registration;
  } catch {
    return null;
  }
}

function notifyInstalled() {
  showToast("التطبيق جاهز للعمل بدون إنترنت ✅", true, 4200);
}

/**
 * يفعّل زر التثبيت، ويعرض تعليمات الآيفون حين لا يوفّرها المتصفّح.
 * @param {HTMLElement} button زر «تثبيت التطبيق»
 */
export function setupInstallButton(button) {
  if (!button) return;
  if (isStandalone()) {
    button.hidden = true;
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    button.hidden = false;
  });

  button.addEventListener("click", async () => {
    if (!installPrompt) {
      showIosInstructions();
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") showToast("تم تثبيت التطبيق 🎉", true);
    installPrompt = null;
    button.hidden = true;
  });

  if (isIos()) {
    button.hidden = false;
    button.textContent = "📲 تثبيت على الآيفون";
  } else {
    button.hidden = !canInstall();
  }
}

function showIosInstructions() {
  showToast("على الآيفون: اضغط «مشاركة» ثم «إضافة إلى الشاشة الرئيسية» — المتصفّح لا يعرض زر تثبيت.", false, 6000);
}

/**
 * يعرض إشعارًا عبر عامل الخدمة (يعمل حتى لو كانت الصفحة في الخلفية).
 * @param {{ title: string, body: string, tag?: string }} payload
 * @returns {boolean} هل أُرسل الطلب؟
 */
export function notify(payload) {
  const controller = navigator.serviceWorker?.controller;
  if (!controller) return false;
  controller.postMessage({ type: "notify", ...payload });
  return true;
}

/**
 * يمرّر رسالة إلى عامل الخدمة وينتظر نشطه.
 * المتصفّح لا يمنح الصفحة متحكّمًا في أول زيارة، فننتظر العامل
 * النشط بدل أن نفقد الإشعار الوحيد في تلك الزيارة.
 * @param {object} message
 * @param {{ timeout?: number }} [options]
 * @returns {Promise<boolean>} هل وصلت الرسالة؟
 */
export async function postToWorker(message, options = {}) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return false;
  const timeout = options.timeout ?? 3000;
  try {
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      controller.postMessage(message);
      return true;
    }
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), timeout)),
    ]);
    const worker = registration?.active ?? registration?.waiting;
    if (!worker) return false;
    worker.postMessage(message);
    return true;
  } catch {
    return false;
  }
}

/** يفعّل زر «تحديث» لتطبيق النسخة الجديدة فورًا. */
export function setupUpdatePrompt(button) {
  if (!button) return;
  registerServiceWorker({
    onUpdate: () => {
      button.hidden = false;
      button.addEventListener(
        "click",
        () => {
          navigator.serviceWorker.getRegistration().then((registration) => {
            registration?.waiting?.postMessage("skip-waiting");
          });
          window.location.reload();
        },
        { once: true },
      );
    },
  });
}