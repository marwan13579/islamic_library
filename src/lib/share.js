/**
 * المشاركة: واتساب، تليجرام، تويتر، نسخ، و Web Share API.
 * @module lib/share
 */

import { toArNum } from "./text.js";

/**
 * يبني روابط المشاركة.
 * @param {string} text
 * @param {string} url
 * @returns {{ whatsapp: string, telegram: string, twitter: string }}
 */
export function shareLinks(text, url) {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
  };
}

/**
 * ينسخ النص إلى الحافظة مع بديل للمتصفحات القديمة.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* نجرّب البديل */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * مشاركة عبر النظام مع رابط احتياطي.
 * @param {{ title: string, text: string, url?: string, file?: File }} payload
 * @returns {Promise<"shared" | "copied" | "cancelled">}
 */
export async function shareOrCopy(payload) {
  const url = payload.url ?? location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
    }
  }
  return (await copyText(`${payload.text}\n${url}`)) ? "copied" : "cancelled";
}

/**
 * يبني رسالة مشاركة لعنصر (درس، عالم، آية…).
 * @param {string} title
 * @param {string} [extra]
 * @returns {{ title: string, text: string, url: string }}
 */
export function sharePayload(title, extra) {
  return {
    title: `نور الهدى — ${title}`,
    text: extra ? `${title}\n\n${extra}` : title,
    url: location.href,
  };
}

/**
 * يبني رسالة مشاركة بنتيجة اختبار.
 * @param {{ title: string, score: number, total: number }} result
 */
export function resultText(result) {
  const percent = Math.round((result.score / result.total) * 100);
  return `نتيجتي في «${result.title}»: ${toArNum(result.score)} من ${toArNum(result.total)} (${toArNum(percent)}٪) — نور الهدى`;
}