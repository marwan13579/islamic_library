/**
 * نظام الاختبار المتقدّم: بنك أسئلة بثلاثة أنواع، مؤقّت، مراجعة، وشهادة.
 * مصدر الأنظمة: النسخة الأولى (deepseek_html_20260929_7a7dd5.html).
 * @module components/quiz
 */

import { QUESTION_BANK, QUESTION_GROUPS } from "../data/question-bank.js";
import { escapeHtml, normalizeAr, toArNum } from "../lib/text.js";
import { weekKey, daysLeftInWeek } from "../lib/dates.js";
import { read, write, KEYS } from "../lib/storage.js";
import { openModal, closeModal, isModalOpen } from "./modal.js";
import { showToast, buzz } from "./toast.js";
import { CERT_MIN_PERCENT, drawCertificate, issueCertificate } from "./certificate.js";

const DIFFICULTY_LABEL = { easy: "سهل", medium: "متوسط", hard: "صعب" };
const COUNT_OPTIONS = [5, 10, 20, 0];
const TIME_OPTIONS = [0, 5, 10, 20];

/**
 * @typedef {Object} QuizState
 * @property {string | null} key
 * @property {string[]} qs
 * @property {number} idx
 * @property {number} score
 * @property {boolean} selected
 * @property {number | string | boolean | null} chosen
 * @property {number} count
 * @property {string} diff
 * @property {number} timeLeft
 * @property {number} elapsed
 * @property {number | null} timerInterval
 * @property {(number | string | boolean | null)[]} answers
 * @property {number} startTime
 * @property {string} title
 */

/** @type {QuizState} */
const state = {
  key: null,
  qs: [],
  idx: 0,
  score: 0,
  selected: false,
  chosen: null,
  count: 20,
  diff: "all",
  timeLeft: 0,
  elapsed: 0,
  timerInterval: null,
  answers: [],
  startTime: 0,
  title: "",
};


/** يستبدل محتوى جسم النافذة. */
function replaceBody(html) {
  const body = document.getElementById("modalBody");
  if (body) body.innerHTML = html;
}

/** يسجّل مستمعًا واحدًا فقط على جسم النافذة. */
function onBodyClick(handler) {
  const body = document.getElementById("modalBody");
  if (!body) return;
  if (!questionHandlerBound) {
    body.addEventListener("click", (event) => {
      const active = activeHandler;
      if (active) active(event);
    });
    questionHandlerBound = true;
  }
  activeHandler = handler;
}

/** @type {((event: Event) => void) | null} */
let activeHandler = null;

/* ------------------------------------------------------------------ */
/* الإعداد                                                             */
/* ------------------------------------------------------------------ */

/**
 * شاشة إعدادات الاختبار قبل البدء.
 * @param {{ group?: string, weekly?: boolean }} [options]
 */
export function openQuizSetup(options = {}) {
  const group = options.group ?? "salaf";
  const body = document.getElementById("modalBody");
  if (!body) return;

  openModal({
    title: options.weekly ? "تحدّي الأسبوع" : "إعداد الاختبار",
    badge: "اختبار",
    html: setupHtml(group),
    onClose: stopTimer,
  });

  const choice = { group, diff: "all", count: 20, time: 0 };
  onBodyClick((event) => {
    const chip = /** @type {HTMLElement} */ (event.target).closest(".chip");
    if (!chip || !body.contains(chip)) return;
    const holder = chip.closest(".chips");
    if (!holder) return;
    holder.querySelectorAll(".chip").forEach((item) => item.setAttribute("aria-pressed", "false"));
    chip.setAttribute("aria-pressed", "true");
    choice[holder.dataset.role] = holder.dataset.role === "count" || holder.dataset.role === "time"
      ? Number(chip.dataset.value)
      : chip.dataset.value;
  });
  body.querySelector('[data-role="start"]')?.addEventListener("click", () => {
    startQuiz({
      ...choice,
      shuffle: /** @type {HTMLInputElement} */ (body.querySelector("#quizShuffle"))?.checked ?? true,
    });
  });
}

/** @param {string} group */
function setupHtml(group) {
  return `
    <div class="quiz-setup">
      <p class="quiz-hint">اختر الفئة والمستوى وعدد الأسئلة والمؤقّت، ثم ابدأ.</p>
      <fieldset class="quiz-field">
        <legend>📂 الفئة</legend>
        <div class="chips" data-role="group">
          ${QUESTION_GROUPS.map(
            (item) => `<button type="button" class="chip" data-value="${item.key}"
              aria-pressed="${item.key === group}">${escapeHtml(item.title)}</button>`,
          ).join("")}
        </div>
      </fieldset>
      <fieldset class="quiz-field">
        <legend>📊 المستوى</legend>
        <div class="chips" data-role="diff">
          ${["all", "easy", "medium", "hard"]
            .map(
              (key) => `<button type="button" class="chip" data-value="${key}"
                aria-pressed="${key === "all"}">${key === "all" ? "الكل" : DIFFICULTY_LABEL[key]}</button>`,
            )
            .join("")}
        </div>
      </fieldset>
      <fieldset class="quiz-field">
        <legend>🔢 عدد الأسئلة</legend>
        <div class="chips" data-role="count">
          ${COUNT_OPTIONS.map(
            (value) => `<button type="button" class="chip" data-value="${value}"
              aria-pressed="${value === 20}">${value === 0 ? "الكل" : toArNum(value)}</button>`,
          ).join("")}
        </div>
      </fieldset>
      <fieldset class="quiz-field">
        <legend>⏱️ المؤقّت</legend>
        <div class="chips" data-role="time">
          ${TIME_OPTIONS.map(
            (value) => `<button type="button" class="chip" data-value="${value}"
              aria-pressed="${value === 0}">${value === 0 ? "بدون" : `${toArNum(value)} د`}</button>`,
          ).join("")}
        </div>
      </fieldset>
      <label class="quiz-toggle">
        <input type="checkbox" id="quizShuffle" checked> 🔀 خلط الأسئلة
      </label>
      <button type="button" class="btn primary" data-role="start">ابدأ الاختبار</button>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* التشغيل                                                             */
/* ------------------------------------------------------------------ */

/**
 * @param {{ group: string, diff: string, count: number, time: number, shuffle: boolean, weekly?: boolean }} config
 */
function startQuiz(config) {
  const pool = poolFor(config.group, config.diff);
  if (pool.length === 0) {
    showToast("لا توجد أسئلة مطابقة لهذا الاختيار.");
    return;
  }
  const questions = config.shuffle ? shuffle(pool, config.weekly ? 20260101 : Date.now()) : pool.slice();
  const chosen = config.count > 0 ? questions.slice(0, Math.min(config.count, questions.length)) : questions;

  Object.assign(state, {
    key: config.weekly ? "weekly" : config.group,
    qs: /** @type {any} */ (chosen),
    idx: 0,
    score: 0,
    selected: false,
    chosen: null,
    count: chosen.length,
    diff: config.diff,
    timeLeft: config.time * 60,
    elapsed: 0,
    answers: [],
    startTime: Date.now(),
    title: config.weekly ? "تحدّي الأسبوع" : QUESTION_GROUPS.find((item) => item.key === config.group)?.title ?? "اختبار",
  });

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = state.title;
  startTimer();
  renderQuestion();
}

/**
 * يبدأ اختبارًا بقائمة أسئلة جاهزة (أسئلة الدرس مثلًا) بنفس واجهة الاختبار المتقدّم.
 * @param {import("../types.js").Question[]} questions
 * @param {string} title
 */
export function startCustomQuiz(questions, title) {
  if (!Array.isArray(questions) || questions.length === 0) {
    showToast("لا توجد أسئلة لهذا الدرس.");
    return;
  }
  openModal({ title: `اختبار: ${title}`, badge: "اختبار الدرس", html: "" });
  Object.assign(state, {
    key: null,
    qs: questions,
    idx: 0,
    score: 0,
    selected: false,
    chosen: null,
    count: questions.length,
    diff: "all",
    timeLeft: 0,
    elapsed: 0,
    answers: [],
    startTime: Date.now(),
    title,
  });
  const heading = document.getElementById("modalTitle");
  if (heading) heading.textContent = `اختبار: ${title}`;
  renderQuestion();
}

/** @param {string} group @param {string} diff */
function poolFor(group, diff) {
  const keys = QUESTION_GROUPS.find((item) => item.key === group)?.categories ?? [];
  const pool = keys.flatMap((key) => QUESTION_BANK[key]?.questions ?? []);
  return diff === "all" ? pool : pool.filter((question) => question.d === diff);
}

function shuffle(items, seed) {
  const output = items.slice();
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

/* ------------------------------------------------------------------ */
/* المؤقّت                                                             */
/* ------------------------------------------------------------------ */

function startTimer() {
  stopTimer();
  if (state.timeLeft <= 0) return;
  state.timerInterval = window.setInterval(() => {
    if (!isModalOpen()) return;
    state.timeLeft -= 1;
    state.elapsed += 1;
    renderTimer();
    if (state.timeLeft <= 0) {
      stopTimer();
      buzz([200, 100, 200]);
      showToast("انتهى الوقت — تُحتسب الإجابات المُعطاة كما هي.");
      finishQuiz("time");
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval !== null) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function renderTimer() {
  const host = document.getElementById("quizTimer");
  if (!host) return;
  const minutes = Math.floor(Math.max(0, state.timeLeft) / 60);
  const seconds = Math.max(0, state.timeLeft) % 60;
  const warn = state.timeLeft <= 60 && state.timeLeft > 0;
  host.hidden = state.timeLeft <= 0 && state.elapsed === 0;
  host.classList.toggle("warn", warn);
  host.innerHTML = `<span class="quiz-timer-label">⏱ ${toArNum(`${minutes}:${String(seconds).padStart(2, "0")}`)}</span>
    <span class="quiz-timer-bar"><span style="width:${timerPercent()}%"></span></span>`;
  if (warn) buzz(60);
}

function timerPercent() {
  if (state.timeLeft <= 0) return 100;
  const total = state.timeLeft + state.elapsed;
  return Math.max(0, Math.min(100, (state.timeLeft / total) * 100));
}

/* ------------------------------------------------------------------ */
/* عرض السؤال                                                          */
/* ------------------------------------------------------------------ */

function renderQuestion() {
  const body = document.getElementById("modalBody");
  if (!body) return;
  const question = state.qs[state.idx];
  if (!question) return finishQuiz("done");
  state.selected = false;
  state.chosen = null;

  const progress = `<div class="quiz-progress"><span>${toArNum(state.idx + 1)} / ${toArNum(state.count)}</span>
    <span class="badge diff-${question.d}">${DIFFICULTY_LABEL[question.d]}</span></div>`;

  replaceBody(`
    ${progress}
    <h3 class="quiz-question">${escapeHtml(question.q)}</h3>
    <div class="quiz-options" data-type="${question.t}">
      ${optionsHtml(question)}
    </div>
    <div class="quiz-actions">
      <button type="button" class="btn ghost" data-role="prev" ${state.idx === 0 ? "disabled" : ""}>السابق</button>
      <button type="button" class="btn primary" data-role="next" disabled>${state.idx === state.count - 1 ? "إنهاء" : "التالي"}</button>
    </div>
    <div class="quiz-explain" id="quizExplain" hidden></div>`);

  body.querySelector('[data-role="prev"]')?.addEventListener("click", () => {
    if (state.idx > 0) {
      state.idx -= 1;
      renderQuestion();
    }
  });
  body.querySelector('[data-role="next"]')?.addEventListener("click", () => {
    if (state.idx === state.count - 1) finishQuiz("done");
    else {
      state.idx += 1;
      renderQuestion();
    }
  });
  activeHandler = onQuestionClick;
  renderTimer();
}

function optionsHtml(question) {
  if (question.t === "mc") {
    return question.o
      .map((option, index) =>
        `<button type="button" class="quiz-option" data-index="${index}">${escapeHtml(option)}</button>`,
      )
      .join("");
  }
  if (question.t === "tf") {
    return `<button type="button" class="quiz-option" data-index="true">صح</button>
      <button type="button" class="quiz-option" data-index="false">خطأ</button>`;
  }
  return `<label class="quiz-fill">
    <input type="text" id="quizFillInput" autocomplete="off" placeholder="اكتب الإجابة">
    <button type="button" class="btn primary" data-role="check">تحقّق</button>
  </label>`;
}

let questionHandlerBound = false;

function onQuestionClick(event) {
  const target = /** @type {HTMLElement} */ (event.target);
  const body = document.getElementById("modalBody");
  if (!body || !body.contains(target)) return;
  if (target.dataset.role === "check") return checkFill();

  const option = target.closest(".quiz-option");
  if (!option || state.selected) return;
  const question = state.qs[state.idx];
  if (!question) return;

  const value = question.t === "tf"
    ? option.dataset.index === "true"
    : Number(option.dataset.index);
  choose(value, option);
}

function checkFill() {
  if (state.selected) return;
  const input = /** @type {HTMLInputElement | null} */ (document.getElementById("quizFillInput"));
  const value = (input?.value ?? "").trim();
  if (!value) {
    showToast("اكتب الإجابة أولًا.");
    return;
  }
  choose(value, null);
}

function choose(value, option) {
  const body = document.getElementById("modalBody");
  const question = state.qs[state.idx];
  if (!body || !question || state.selected) return;
  const input = /** @type {HTMLElement | null} */ (body.querySelector("#quizFillInput"));
  state.selected = true;
  state.chosen = value;
  const correct = isCorrect(question, value);
  if (correct) state.score += 1;
  state.answers[state.idx] = value;

  if (option) {
    option.classList.add(correct ? "correct" : "wrong");
    if (!correct) {
      body.querySelector(`.quiz-option[data-index="${String(question.a)}"]`)?.classList.add("correct");
    }
  } else {
    input?.classList.add(correct ? "correct" : "wrong");
  }

  const explain = document.getElementById("quizExplain");
  if (explain) {
    explain.hidden = false;
    explain.innerHTML = `<strong>${correct ? "✅ إجابة صحيحة" : "❌ إجابة غير صحيحة"}</strong>
      <p>${escapeHtml(question.e)}</p>`;
  }
  const next = body.querySelector('[data-role="next"]');
  if (next) /** @type {HTMLButtonElement} */ (next).disabled = false;
  buzz(correct ? 40 : 120);
}

/** @param {any} question @param {any} value */
function isCorrect(question, value) {
  if (question.t === "fill") {
    const normalized = normalizeAr(String(value));
    return question.a.some((/** @type {string} */ accepted) => normalizeAr(accepted) === normalized);
  }
  if (question.t === "tf") return Boolean(question.a) === Boolean(value);
  return question.a === value;
}

/* ------------------------------------------------------------------ */
/* النتيجة                                                             */
/* ------------------------------------------------------------------ */

/** @param {"done" | "time"} reason */
function finishQuiz(reason) {
  stopTimer();
  const body = document.getElementById("modalBody");
  if (!body) return;
  const percent = state.count ? Math.round((state.score / state.count) * 100) : 0;
  const stars = percent === 100 ? 3 : percent >= 75 ? 2 : percent >= 50 ? 1 : 0;
  const earned = percent >= CERT_MIN_PERCENT;
  const cert = earned
    ? issueCertificate({
      name: "—",
      title: state.title,
      score: state.score,
      total: state.count,
      percent,
    })
    : null;

  replaceBody(`
    <div class="quiz-result">
      <p class="quiz-stars">${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}</p>
      <p class="quiz-score">${toArNum(state.score)} من ${toArNum(state.count)} — ${toArNum(percent)}٪</p>
      <p class="quiz-note">${reason === "time" ? "انتهى الوقت" : "انتهى الاختبار"}</p>
      ${cert ? `<p class="quiz-cert">🎉 مبروك! حصلت على شهادة — رقم ${escapeHtml(cert.id)}</p>` : ""}
      <table class="quiz-review">
        <caption>مراجعة الأسئلة</caption>
        <thead><tr><th>السؤال</th><th>إجابتك</th><th>الصحيحة</th><th>التعليل</th><th></th></tr></thead>
        <tbody>${state.qs.map((question, index) => reviewRow(question, index) + reviewDetail(question, index)).join("")}</tbody>
      </table>
      <div class="quiz-actions">
        <button type="button" class="btn ghost" data-role="retry">🔁 إعادة المحاولة</button>
        <button type="button" class="btn ghost" data-role="copy">📋 نسخ الملخّص</button>
        ${cert ? `<button type="button" class="btn primary" data-role="cert">📜 عرض الشهادة</button>` : ""}
        <button type="button" class="btn ghost" data-role="close">إغلاق</button>
      </div>
    </div>`);

  body.querySelector('[data-role="retry"]')?.addEventListener("click", () =>
    startQuiz({
      group: state.key ?? "salaf",
      diff: state.diff,
      count: state.count,
      time: Math.round(state.timeLeft / 60),
      shuffle: true,
      weekly: state.key === "weekly",
    }),
  );
  body.querySelector('[data-role="close"]')?.addEventListener("click", closeModal);
  body.querySelectorAll("[data-review]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest("tr");
      const detail = row?.nextElementSibling;
      if (!detail) return;
      const open = detail.hidden;
      detail.hidden = !open;
      button.textContent = open ? "إخفاء" : "راجع";
      button.setAttribute("aria-expanded", String(open));
      if (open) detail.querySelector("td")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
  body.querySelector('[data-role="copy"]')?.addEventListener("click", async () => {
    const { copyText } = await import("../lib/share.js");
    const lines = state.qs.map((question, index) => {
      const given = formatAnswer(question, state.answers[index]);
      return `• ${question.q}\n  إجابتي: ${given}\n  الصحيحة: ${formatAnswer(question, question.a)}\n  التعليل: ${question.e}`;
    });
    await copyText([`نتيجة «${state.title}»: ${state.score}/${state.count} (${percent}٪)`, ...lines].join("\n"));
    showToast("تم نسخ الملخّص.");
  });
  body.querySelector('[data-role="cert"]')?.addEventListener("click", () => {
    if (cert) showCertificatePreview(cert);
  });

  if (state.key === "weekly") saveWeeklyResult(state.score, state.count);
  saveQuizStats(state.score, state.count);
  updateWeeklyCard();
  if (cert) {
    showToast("🎉 مبروك! حصلت على شهادة", true);
    buzz([200, 80, 200, 80, 300]);
  }
}

/** @param {any} question @param {any} value */
function reviewRow(question, index) {
  const given = state.answers[index];
  const correct = given !== undefined && isCorrect(question, given);
  return `<tr>
    <td>${escapeHtml(question.q)}</td>
    <td class="${correct ? "ok" : "bad"}">${given === undefined ? "—" : escapeHtml(formatAnswer(question, given))}</td>
    <td>${escapeHtml(formatAnswer(question, question.a))}</td>
    <td class="muted">${escapeHtml(question.e)}</td>
    <td>${correct ? "" : `<button type="button" class="link" data-review="${index}" aria-expanded="false" aria-controls="review-detail-${index}">راجع</button>`}</td>
  </tr>`;
}

/** صفّ التفاصيل المخفيّ الذي يفتحه زرّ «راجع» ويغلقه. */
function reviewDetail(question, index) {
  const given = state.answers[index];
  const correct = given !== undefined && isCorrect(question, given);
  return `<tr class="quiz-detail" id="review-detail-${index}" data-review-detail="${index}" hidden>
    <td colspan="5"><p class="muted"><strong>السؤال:</strong> ${escapeHtml(question.q)}</p>
      <p class="muted"><strong>إجابتك:</strong> ${given === undefined ? "—" : escapeHtml(formatAnswer(question, given))}</p>
      <p class="muted"><strong>الصحيحة:</strong> ${escapeHtml(formatAnswer(question, question.a))}</p>
      <p class="muted"><strong>التعليل:</strong> ${escapeHtml(question.e)}</p>
      <p class="muted">${correct ? "✔ إجابة صحيحة" : "✘ إجابة غير صحيحة"}</p></td>
  </tr>`;
}

/** @param {any} question @param {any} value */
function formatAnswer(question, value) {
  if (value === undefined || value === null) return "—";
  if (question.t === "tf") return value ? "صح" : "خطأ";
  if (question.t === "fill") return String(value);
  return question.o[Number(value)] ?? "—";
}

/** يعرض الشهادة بحجم كامل داخل النافذة. */
function showCertificatePreview(cert) {
  const holder = document.createElement("div");
  holder.className = "cert-preview";
  const canvas = drawCertificate(cert);
  canvas.id = "certCanvas";
  holder.append(
    canvas,
    Object.assign(document.createElement("a"), {
      className: "btn primary",
      textContent: "💾 تنزيل PNG",
      href: canvas.toDataURL("image/png"),
      download: `${cert.id}.png`,
    }),
  );
  const body = document.getElementById("modalBody");
  if (!body) return;
  body.innerHTML = "";
  body.append(holder);
}

/* ------------------------------------------------------------------ */
/* الإحصاءات والتحدّي الأسبوعي                                          */
/* ------------------------------------------------------------------ */

function saveQuizStats(score, total) {
  const stats = read(KEYS.quizStats, { completed: 0, totalCorrect: 0, best: 0 });
  const percent = total ? Math.round((score / total) * 100) : 0;
  write(KEYS.quizStats, {
    completed: (stats.completed ?? 0) + 1,
    totalCorrect: (stats.totalCorrect ?? 0) + score,
    best: Math.max(stats.best ?? 0, percent),
  });
}

function saveWeeklyResult(score, total) {
  const key = weekKey();
  const done = read(KEYS.weeklyDone, {});
  if (done[key]) return;
  done[key] = { score, total, ts: Date.now() };
  write(KEYS.weeklyDone, done);
}

/** @returns {{ score: number, total: number, ts: number } | null} */
export function weeklyResult() {
  return read(KEYS.weeklyDone, {})[weekKey()] ?? null;
}

/** يحدّث بطاقة التحدّي الأسبوعي في الرئيسية. */
export function updateWeeklyCard() {
  const card = document.getElementById("weeklyCard");
  if (!card) return;
  const result = weeklyResult();
  const button = card.querySelector('[data-role="weekly"]');
  if (result) {
    const percent = Math.round((result.score / result.total) * 100);
    card.dataset.done = "true";
    if (button) button.textContent = `✅ أتممتَ التحدي (${toArNum(percent)}٪)`;
  } else {
    card.dataset.done = "false";
    if (button) button.textContent = `🔥 باقي ${toArNum(daysLeftInWeek())} أيام — ابدأ التحدي`;
  }
}

/** يبدأ تحدّي الأسبوع (نفس الأسئلة كل أسبوع). */
export function startWeeklyChallenge() {
  openQuizSetup({ group: "salaf", weekly: true });
}