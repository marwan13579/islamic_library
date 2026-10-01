/**
 * نظام الثيم وحجم الخط وحفظهما في التخزين المحلي.
 * @module components/theme
 */

import { read, write, KEYS } from "../lib/storage.js";

const FONT_SIZES = { small: 0.9, normal: 1, large: 1.1 };
const THEMES = ["light", "dark"];

/** @returns {string} الثيم الحالي */
function currentTheme() {
  const saved = read(KEYS.theme, null);
  if (THEMES.includes(saved)) return /** @type {string} */ (saved);
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * يطبّق الثيم على `<html>` ويحفظه.
 * @param {"light" | "dark"} theme
 */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  write(KEYS.theme, theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0c1714" : "#12664a");
}

/** @returns {"light" | "dark"} */
export function toggleTheme() {
  const next = currentTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

/** @returns {number} معامل حجم الخط الحالي */
function currentFontScale() {
  const saved = read(KEYS.fontSize, FONT_SIZES.normal);
  return typeof saved === "number" ? saved : FONT_SIZES.normal;
}

/**
 * @param {number} scale
 */
function applyFontScale(scale) {
  document.documentElement.style.setProperty("--fs", String(scale));
  write(KEYS.fontSize, scale);
}

/** @param {1 | -1} direction */
export function stepFontScale(direction) {
  const order = [FONT_SIZES.small, FONT_SIZES.normal, FONT_SIZES.large];
  const index = order.indexOf(currentFontScale());
  const next = order[Math.min(order.length - 1, Math.max(0, index + direction))];
  applyFontScale(next);
  return next;
}

/** يهيّئ الثيم وحجم الخط قبل الرسم لتفادي الوميض. */
export function initTheme() {
  applyTheme(currentTheme());
  applyFontScale(currentFontScale());
}