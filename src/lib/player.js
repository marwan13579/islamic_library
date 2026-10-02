/**
 * مشغّل صوت واحد ثابت أسفل الشاشة.
 *
 * كان كل مشغّل في صفحته، فيتوقف الصوت بانتقال المستخدم. هذا يعبر
 * الصفحات بالاسم في `sessionStorage`، فيتابع ما كان يُسمع.
 * @module lib/player
 */

const STATE_KEY = "lib-player-state";

/** @typedef {{src: string, title: string, subtitle: string, page: string}} Track */

/** @type {HTMLAudioElement | null} */
let audio = null;
/** @type {HTMLElement | null} */
let root = null;
/** @type {Track | null} */
let current = null;

/**
 * يبني المشغّل ويلحقه بالصفحة. لا يفعل شيئًا إن كان موجودًا.
 * @returns {HTMLElement}
 */
export function mountPlayer() {
  if (root) return root;
  audio = document.createElement("audio");
  audio.preload = "none";

  root = document.createElement("div");
  root.className = "lib-player";
  root.hidden = true;
  root.innerHTML = `
    <button type="button" class="pl-btn" data-act="play" aria-label="تشغيل أو إيقاف">⏸</button>
    <div class="pl-info">
      <span class="pl-title"></span>
      <span class="pl-sub"></span>
    </div>
    <input class="pl-seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="موضع التشغيل">
    <span class="pl-time">٠:٠٠</span>
    <button type="button" class="pl-btn" data-act="close" aria-label="إغلاق المشغّل">✕</button>`;
  root.appendChild(audio);
  document.body.appendChild(root);

  wire();

  const saved = readState();
  if (saved && saved.src) restore(saved);
  return root;
}

/** أزرار المشغّل وتقدّمه. */
function wire() {
  if (!root || !audio) return;

  root.querySelector('[data-act="play"]').addEventListener("click", () => toggle());
  root.querySelector('[data-act="close"]').addEventListener("click", () => stop(true));

  root.querySelector(".pl-seek").addEventListener("input", (event) => {
    if (!audio.duration) return;
    audio.currentTime = (audio.duration * Number(event.target.value)) / 100;
  });

  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    const seek = root.querySelector(".pl-seek");
    if (document.activeElement !== seek) seek.value = String(pct);
    root.querySelector(".pl-time").textContent = stamp(audio.currentTime);
  });
  audio.addEventListener("play", () => {
    root.querySelector('[data-act="play"]').textContent = "⏸";
  });
  audio.addEventListener("pause", () => {
    root.querySelector('[data-act="play"]').textContent = "▶";
  });
  audio.addEventListener("ended", () => {
    root.querySelector('[data-act="play"]').textContent = "▶";
  });
  audio.addEventListener("error", () => {
    root.querySelector(".pl-sub").textContent = "تعذّر تحميل الصوت";
  });
}

/**
 * يشغّل مقطعًا، ويوقف ما كان يعمل.
 * @param {Track} track
 */
export function play(track) {
  mountPlayer();
  if (!root || !audio) return;
  current = track;
  audio.src = track.src;
  audio.play().catch(() => {
    root.querySelector(".pl-sub").textContent = "اضغط للتشغيل";
  });
  root.hidden = false;
  root.querySelector(".pl-title").textContent = track.title;
  root.querySelector(".pl-sub").textContent = track.subtitle || "";
  root.querySelector(".pl-time").textContent = stamp(0);
  root.querySelector(".pl-seek").value = "0";
  saveState();
  document.documentElement.classList.add("has-player");
}

/** @param {boolean} [clear] إخفاء المشغّل كليًا */
export function stop(clear = false) {
  if (!audio || !root) return;
  audio.pause();
  if (clear) {
    audio.removeAttribute("src");
    audio.load();
    root.hidden = true;
    current = null;
    sessionStorage?.removeItem?.(STATE_KEY);
    document.documentElement.classList.remove("has-player");
  }
}

/** @returns {boolean} هل يعمل الآن؟ */
export function isPlaying() {
  return Boolean(audio && !audio.paused);
}

/** يبدّل بين التشغيل والإيقاف. */
export function toggle() {
  if (!audio || !root) return;
  if (!audio.getAttribute("src")) {
    const saved = readState();
    if (saved && saved.src) restore(saved);
    return;
  }
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

/* ------------------------------------------------------------- الاستمرار */

/** @returns {Track|null} */
function readState() {
  try {
    return JSON.parse(sessionStorage.getItem(STATE_KEY) || "null");
  } catch {
    return null;
  }
}

function saveState() {
  if (!current) return;
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(current));
  } catch {
    /* تبويب خاص: بلا حفظ */
  }
}

/**
 * يستأنف المقطع الذي كان يعمل، إن كان من صفحة أخرى.
 * لا يستأنف التشغيل تلقائيًا: المتصفح يمنع ذلك، ويبقى الزر في انتظار ضغطة.
 * @param {Track} track
 */
function restore(track) {
  if (!root || !audio) return;
  current = track;
  audio.src = track.src;
  root.hidden = false;
  root.querySelector(".pl-title").textContent = track.title;
  root.querySelector(".pl-sub").textContent = "اضغط ⏵ للمتابعة";
  root.querySelector('[data-act="play"]').textContent = "▶";
  document.documentElement.classList.add("has-player");
}

/** @param {number} seconds @returns {string} */
function stamp(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const ar = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);
  return `${ar(m)}:${ar(String(s).padStart(2, "0"))}`;
}