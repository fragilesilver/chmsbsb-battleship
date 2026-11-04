// ============================================================
//  qsets.js  -  question sets: built-in ones, uploaded ones, and checking
//
//  A question set is one object:
//    { id, title, subject, exam, uiLang: "en" | "ms",
//      features: { generated, torpedo, console },
//      rewards:  { easy, medium, hard },        (shots per right answer)
//      ui:       { key: "text" },                (optional label overrides, see i18n.js)
//      questions: [ MCQ or typed items ] }
//
//  MCQ item:   { id, level, topic?, passage?, code?, q, options[4], answer, explain }
//  Typed item: { id, level, topic?, type: "typed", q, accept: ["answer", ...], explain }
//              (typed items are used for torpedoes)
// ============================================================
import { QUESTIONS, REWARD } from "./questions.js";

export const LEVELS = ["easy", "medium", "hard"];
export const MAX_UPLOAD_QUESTIONS = 400;

// The original pseudocode bank, wrapped as a set
const CS_SET = {
  id: "cs-pseudocode",
  title: "Cambridge pseudocode (IGCSE / O Level)",
  subject: "Computer Science",
  exam: "IGCSE 0478 / O Level 2210",
  uiLang: "en",
  features: { generated: true, torpedo: true, console: true },
  rewards: REWARD,
  ui: {},
  questions: QUESTIONS,
};

// Sets that ship with the game. `file` ones are fetched when first needed.
export const BUILTIN_SETS = [
  { id: "ict-general", title: "General ICT (Years 7 to 10)", file: "data/ict-general.json" },
  { id: "cs-year9-topics", title: "Year 9 Computer Studies (CHMS BSB)", file: "data/cs-year9-topics.json" },
  { id: "cs-2210-revision", title: "Computer Science 2210 Revision (Ch 1-6)", file: "data/cs-2210-revision.json" },
  { id: "cs-pseudocode", title: CS_SET.title, set: CS_SET },
  { id: "bm-psr", title: "Bahasa Melayu PSR", file: "data/bm-psr.json" },
];
export const DEFAULT_SET_ID = "ict-general";

const cache = new Map();

// ---------- answer matching (typed items) ----------
// Ignore case, accents, extra spaces and punctuation at the ends
export function normaliseAnswer(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s ]+/g, " ")
    .replace(/^[\s.,;:!?'"“”‘’()-]+|[\s.,;:!?'"“”‘’()-]+$/g, "");
}

export const isTyped = (q) => q.type === "typed";
export const checkTyped = (q, guess) => {
  const g = normaliseAnswer(guess);
  return !!g && q.accept.some((a) => normaliseAnswer(a) === g);
};

// ---------- validating ----------
// Returns { set, errors }. `set` is the cleaned set, or null if there are errors.
export function validateSet(raw) {
  const errors = [];
  const bad = (m) => { if (errors.length < 12) errors.push(m); };
  if (!raw || typeof raw !== "object") return { set: null, errors: ["The file isn't a question set."] };
  if (!Array.isArray(raw.questions) || !raw.questions.length) return { set: null, errors: ["No questions found."] };
  if (raw.questions.length > MAX_UPLOAD_QUESTIONS) return { set: null, errors: [`Too many questions (${raw.questions.length}). The limit is ${MAX_UPLOAD_QUESTIONS}.`] };

  const seen = new Set();
  const questions = raw.questions.map((x, i) => {
    const n = `Question ${i + 1}`;
    const id = String(x.id || `q${i + 1}`);
    if (seen.has(id)) bad(`${n}: the id "${id}" is used twice.`);
    seen.add(id);
    const level = LEVELS.includes(x.level) ? x.level : "easy";
    if (x.level && !LEVELS.includes(x.level)) bad(`${n}: level must be easy, medium or hard (got "${x.level}").`);
    if (!x.q || !String(x.q).trim()) bad(`${n}: the question text is empty.`);
    const base = {
      id, level, q: String(x.q || ""), explain: String(x.explain || ""),
      ...(x.topic ? { topic: String(x.topic) } : {}),
      ...(x.passage ? { passage: String(x.passage) } : {}),
      ...(Array.isArray(x.code) ? { code: x.code.map(String) } : {}),
    };
    if (x.type === "typed") {
      const accept = (Array.isArray(x.accept) ? x.accept : []).map(String).filter((a) => normaliseAnswer(a));
      if (!accept.length) bad(`${n}: a typed question needs at least one accepted answer.`);
      return { ...base, type: "typed", accept };
    }
    const options = Array.isArray(x.options) ? x.options.map(String) : [];
    if (options.length !== 4 || options.some((o) => !o.trim())) bad(`${n}: needs exactly 4 non-empty options.`);
    // exact match only: options that differ just by capital letters are valid (e.g. capitalisation questions)
    if (new Set(options.map((o) => o.trim())).size !== options.length) bad(`${n}: two options are the same.`);
    if (!Number.isInteger(x.answer) || x.answer < 0 || x.answer > 3) bad(`${n}: answer must be 0, 1, 2 or 3.`);
    return { ...base, options, answer: x.answer };
  });
  if (errors.length) return { set: null, errors };

  const hasTyped = questions.some(isTyped);
  const feat = raw.features || {};
  const set = {
    id: String(raw.id || "custom"),
    title: String(raw.title || "Custom question set"),
    subject: String(raw.subject || ""),
    exam: String(raw.exam || ""),
    uiLang: raw.uiLang === "ms" ? "ms" : "en",
    features: {
      generated: !!feat.generated,
      torpedo: feat.torpedo !== undefined ? !!feat.torpedo && hasTyped : hasTyped,
      console: !!feat.console,
    },
    rewards: { easy: 1, medium: 2, hard: 3, ...(raw.rewards || {}) },
    // label overrides go into the page, so strip any markup from them
    ui: Object.fromEntries(Object.entries(raw.ui && typeof raw.ui === "object" ? raw.ui : {})
      .map(([k, v]) => [k, String(v).replace(/[<>]/g, "")])),
    questions,
  };
  if (!questions.some((q) => !isTyped(q))) return { set: null, errors: ["Add at least one multiple-choice question for earning shots."] };
  return { set, errors: [] };
}

// ---------- CSV ----------
// Columns (header row required, any order, case-insensitive):
//   level, topic, passage, question, A, B, C, D, answer, explain, accept
// answer is A-D, 1-4, or the text of the right option.
// A row with no options but an `accept` column (answers separated by |) is a typed question.
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export function setFromCsv(text, meta = {}) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { set: null, errors: ["The CSV needs a header row and at least one question."] };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names) => head.findIndex((h) => names.includes(h));
  const idx = {
    level: col("level"), topic: col("topic"), passage: col("passage"), q: col("question", "q"),
    a: col("a"), b: col("b"), c: col("c"), d: col("d"),
    answer: col("answer"), explain: col("explain", "explanation"), accept: col("accept"),
  };
  if (idx.q < 0) return { set: null, errors: ['The CSV needs a "question" column.'] };
  const get = (r, i) => (i >= 0 && r[i] !== undefined ? r[i].trim() : "");

  const questions = rows.slice(1).map((r, i) => {
    const options = [get(r, idx.a), get(r, idx.b), get(r, idx.c), get(r, idx.d)];
    const level = get(r, idx.level).toLowerCase() || "easy";
    const base = {
      id: `u${i + 1}`, level, q: get(r, idx.q), explain: get(r, idx.explain),
      topic: get(r, idx.topic), passage: get(r, idx.passage),
    };
    const accept = get(r, idx.accept);
    if (options.every((o) => !o) && accept) return { ...base, type: "typed", accept: accept.split("|").map((a) => a.trim()) };
    const raw = get(r, idx.answer);
    let answer = "ABCD".indexOf(raw.toUpperCase());
    if (raw.length !== 1 || answer < 0) answer = /^[1-4]$/.test(raw) ? +raw - 1 : options.findIndex((o) => o && normaliseAnswer(o) === normaliseAnswer(raw));
    return { ...base, options, answer: answer < 0 ? -1 : answer };
  });
  return validateSet({ ...meta, questions });
}

export async function setFromFile(file, meta = {}) {
  const text = await file.text();
  if (/\.json$/i.test(file.name) || /^\s*[{[]/.test(text)) {
    let raw;
    try { raw = JSON.parse(text); } catch (e) { return { set: null, errors: ["That isn't valid JSON: " + e.message] }; }
    if (Array.isArray(raw)) raw = { questions: raw };
    return validateSet({ title: file.name.replace(/\.\w+$/, ""), ...meta, ...raw });
  }
  return setFromCsv(text, { title: file.name.replace(/\.\w+$/, ""), ...meta });
}

// ---------- loading ----------
export async function loadBuiltin(id) {
  if (cache.has(id)) return cache.get(id);
  const entry = BUILTIN_SETS.find((s) => s.id === id) || BUILTIN_SETS.find((s) => s.id === DEFAULT_SET_ID);
  let set = entry.set;
  if (!set) {
    const res = await fetch(entry.file);
    if (!res.ok) throw new Error(`Couldn't load ${entry.title}.`);
    const { set: clean, errors } = validateSet(await res.json());
    if (!clean) throw new Error(`${entry.title} has a problem: ${errors[0]}`);
    set = clean;
  }
  cache.set(entry.id, set);
  return set;
}

// The set a game is using: uploaded with the game, or a built-in one by id.
// Uploaded sets are checked again here because anyone could write to the database.
const customCache = new WeakMap();
export async function setForGame(game) {
  if (game.questionSet) {
    const raw = game.questionSet;
    if (!customCache.has(raw)) customCache.set(raw, validateSet(raw).set);
    const custom = customCache.get(raw);
    if (custom) return custom;
  }
  try { return await loadBuiltin((game.settings && game.settings.questionSet) || DEFAULT_SET_ID); }
  catch { return CS_SET; }
}

// Which of the game's modes the set allows
export const modeAllowed = (set, mode) =>
  mode === "quiz" || !!set.features[mode];

// What a set offers, for the teacher's preview line
export function describeSet(set) {
  const typed = set.questions.filter(isTyped).length;
  const mcq = set.questions.length - typed;
  const topics = [...new Set(set.questions.map((q) => q.topic).filter(Boolean))];
  return { mcq, typed, topics };
}
