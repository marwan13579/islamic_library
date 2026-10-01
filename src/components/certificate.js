/**
 * الشهادة — تُرسم مباشرة على Canvas بمقاس 1200×848 بلا html2canvas.
 * @module components/certificate
 */

import { toArNum } from "../lib/text.js";
import { hijriLong, gregorianLong } from "../lib/dates.js";
import { read, write, KEYS } from "../lib/storage.js";

const CERT_WIDTH = 1200;
const CERT_HEIGHT = 848;
export const CERT_MIN_PERCENT = 80;

const COLORS = {
  cream: "#fbf8f1",
  gold: "#c9a227",
  goldLight: "#e5c96a",
  green: "#0f4d38",
  greenDeep: "#0b3d2c",
  ink: "#16241f",
  muted: "#5d7268",
};

/**
 * يرسم الشهادة على canvas ويعيدها.
 * @param {import("../types.js").Certificate} cert
 * @returns {HTMLCanvasElement}
 */
export function drawCertificate(cert) {
  const canvas = document.createElement("canvas");
  canvas.width = CERT_WIDTH;
  canvas.height = CERT_HEIGHT;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  if (!ctx) return canvas;

  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, CERT_WIDTH, CERT_HEIGHT);

  drawFrame(ctx);
  drawCentered(ctx, "🏅", 92);
  drawCentered(ctx, "شَهَادَةُ إِتْمَامٍ", 62, "serif", COLORS.greenDeep, 190);
  drawCentered(ctx, "نور الهدى — على منهج سلف الأمة", 34, "sans-serif", COLORS.gold, 260);
  rule(ctx, 320);

  drawCentered(ctx, cert.name || "المتعلم", 56, "sans-serif", COLORS.green, 400);
  drawCentered(ctx, `أتمّ بنجاح ${cert.title}`, 34, "sans-serif", COLORS.ink, 470);

  const percent = toArNum(cert.percent);
  drawCentered(
    ctx,
    `النتيجة: ${percent}٪  ·  ${toArNum(cert.score)} من ${toArNum(cert.total)}`,
    40,
    "serif",
    COLORS.green,
    540,
  );
  drawCentered(ctx, `التاريخ: ${hijriLong()} — ${gregorianLong()}`, 26, "sans-serif", COLORS.muted, 620);
  drawCentered(ctx, `رقم الشهادة: ${cert.id}`, 24, "sans-serif", COLORS.muted, 668);
  rule(ctx, 720);
  drawCentered(ctx, "تقبّل الله منّا ومنكم — جعله في ميزان حسناتكم", 26, "serif", COLORS.gold, 770);

  return canvas;
}

function drawFrame(ctx) {
  const margin = 40;
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 8;
  ctx.strokeRect(margin, margin, CERT_WIDTH - margin * 2, CERT_HEIGHT - margin * 2);

  ctx.strokeStyle = COLORS.goldLight;
  ctx.lineWidth = 2;
  ctx.strokeRect(margin + 16, margin + 16, CERT_WIDTH - (margin + 16) * 2, CERT_HEIGHT - (margin + 16) * 2);

  ctx.fillStyle = COLORS.greenDeep;
  for (const [x, y] of cornerPoints()) {
    ctx.beginPath();
    ctx.moveTo(x, y - 18);
    ctx.lineTo(x + 18, y);
    ctx.lineTo(x, y + 18);
    ctx.lineTo(x - 18, y);
    ctx.closePath();
    ctx.fill();
  }
}

function cornerPoints() {
  const inset = 40;
  return [
    [inset, inset],
    [CERT_WIDTH - inset, inset],
    [inset, CERT_HEIGHT - inset],
    [CERT_WIDTH - inset, CERT_HEIGHT - inset],
  ];
}

function rule(ctx, y) {
  const gradient = ctx.createLinearGradient(200, 0, CERT_WIDTH - 200, 0);
  gradient.addColorStop(0, "transparent");
  gradient.addColorStop(0.5, COLORS.gold);
  gradient.addColorStop(1, "transparent");
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(220, y);
  ctx.lineTo(CERT_WIDTH - 220, y);
  ctx.stroke();
}

function drawCentered(ctx, text, size, family = "sans-serif", color = COLORS.ink, y = 0) {
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px ${family === "serif" ? '"Amiri", "Scheherazade New", serif' : '"Cairo", system-ui, sans-serif'}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.fillText(text, CERT_WIDTH / 2, y);
}

/**
 * ينشئ رقم شهادة فريدًا ويحفظها.
 * @param {{ name: string, title: string, score: number, total: number, percent: number }} input
 * @returns {import("../types.js").Certificate}
 */
export function issueCertificate(input) {
  const ts = Date.now();
  /** @type {import("../types.js").Certificate} */
  const cert = {
    id: `NAH-${ts}`,
    name: input.name,
    title: input.title,
    score: input.score,
    total: input.total,
    percent: input.percent,
    ts: new Date(ts).toISOString(),
  };
  const list = read(KEYS.certificates, []);
  list.unshift(cert);
  write(KEYS.certificates, list.slice(0, 30));
  return cert;
}

/** @returns {import("../types.js").Certificate[]} */
export function listCertificates() {
  return read(KEYS.certificates, []);
}
