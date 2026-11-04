// ============================================================
//  event.js  -  the event dashboard: every year's game on one page.
//  This tab also runs the clocks (free shots, storm, round end) for all of them.
// ============================================================
import {
  ensureSignedIn, watchEvent, watchGame, setPhase, startBattle, addFeed, finishRound,
  advanceToNextRound, finaliseDivision, createGrandFinal, setEventWinner, ensureCaptains, claimClockLease, setPlaying,
} from "./firebase.js";
import { YEAR_GROUPS, getAccumulatedStandings, rolesOn } from "./game.js";
import { escapeHtml } from "./board.js";
import { newClock, tickGame, fmtClock } from "./autorun.js";
import {
  divisionName, divisionStatus, divisionAction, finalReady, overallWinner, isPlaying, sessionDevices,
  topicTable, toCsv, standingsRows, topicRows,
} from "./tracker.js";

const $ = (id) => document.getElementById(id);
const eventId = (new URLSearchParams(location.search).get("id") || "").trim().toUpperCase();
const tabId = Math.random().toString(36).slice(2);
const pageUrl = (page) => new URL(page, location.href).href;

const state = {
  event: null,
  games: {},       // division id -> game
  codes: {},       // division id -> game code
  stops: {},       // division id -> stop watching
  clocks: {},      // division id -> clock
  hasClocks: false,
  busy: false,
};

const ACTION_LABEL = {
  placement: "Open fleet placement",
  battle: "Start battle",
  end: "End round",
  "next-round": "Start next round",
  finalise: "Finalise and name champion",
};
const BULK_ACTIONS = ["placement", "battle", "next-round", "finalise"];
const DEVICE_LIMIT = 100;   // Firebase's free Spark plan
const DEVICE_WARNING = 85;  // the dashboard and hall screen use connections too

function showError(text) { $("event-error").textContent = text; }

if (!eventId) {
  showError("This page needs an event ID. Open it from the teacher page.");
} else {
  $("event-id").textContent = eventId;
  $("wall-link").href = pageUrl("projector.html?event=" + eventId);
  ensureSignedIn()
    .then(() => watchEvent(eventId, onEvent))
    .catch(() => showError("Couldn't connect to Firebase. Check the internet connection and reload."));
}

// ---------------- live data ----------------
function onEvent(event) {
  if (!event) { showError(`No event with ID ${eventId}.`); return; }
  state.event = event;
  $("event-title").textContent = event.title || "Event";
  document.title = `${event.title || "Event"} | Dashboard`;
  const codes = { ...(event.divisions || {}), ...(event.finalCode ? { final: event.finalCode } : {}) };
  for (const [division, code] of Object.entries(codes)) {
    if (state.codes[division] === code) continue;
    state.codes[division] = code;
    state.clocks[division] = newClock();
    if (state.stops[division]) state.stops[division]();
    state.stops[division] = watchGame(code, (g) => { state.games[division] = g; onGame(division, g); });
  }
  render();
}

let captainsBusy = false;
function onGame(division, g) {
  if (g && state.hasClocks && rolesOn(g) && !captainsBusy) {
    captainsBusy = true;
    ensureCaptains(state.codes[division], g).catch(console.error).finally(() => { captainsBusy = false; });
  }
  const winner = overallWinner(state.event, state.games);
  if (winner && state.hasClocks && state.event.status !== "finished") setEventWinner(eventId, winner).catch(console.error);
  scheduleRender();
}

// A busy battle sends many updates a second, so draw at most a few times a second
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  setTimeout(() => { renderQueued = false; render(); }, 400);
}

// Leave unchanged parts of the page alone, so a button isn't replaced while it's being clicked
function setHtml(el, html) {
  if (el.dataset.drawn === html) return;
  el.dataset.drawn = html;
  el.innerHTML = html;
}

// ---------------- actions ----------------
async function runAction(action, division) {
  const g = state.games[division];
  const code = state.codes[division];
  if (!g || divisionAction(g) !== action) return;
  if (action === "placement") {
    await setPhase(code, "placement");
    await addFeed(code, "Fleet placement is open.", "info");
  }
  if (action === "battle") {
    await startBattle(code, g);
    state.clocks[division].nextReload = Date.now() + g.settings.reloadSecs * 1000;
  }
  if (action === "end") await finishRound(code, "The teacher ended the round.");
  if (action === "next-round") await advanceToNextRound(code, g);
  if (action === "finalise") await finaliseDivision(code, g);
}

// One button at a time, so a double click can't start something twice
async function guarded(job) {
  if (state.busy) return;
  state.busy = true;
  showError("");
  render();
  try { await job(); }
  catch (e) { showError(e.message || "That didn't work. Check the internet connection and try again."); }
  finally { state.busy = false; render(); }
}

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const { act, division } = b.dataset;
  if (act === "create-final") {
    guarded(() => createGrandFinal(eventId, state.event, state.games));
  } else if (division) {
    if (act === "end" && !confirm(`End this round for ${divisionName(division)}?`)) return;
    guarded(() => runAction(act, division));
  } else {
    const targets = Object.keys(state.games).filter((d) => isPlaying(state.event, d) && divisionAction(state.games[d]) === act);
    guarded(() => Promise.all(targets.map((d) => runAction(act, d))));
  }
});

document.addEventListener("change", (e) => {
  const box = e.target.closest("[data-playing]");
  if (!box) return;
  setPlaying(eventId, box.dataset.playing, box.checked)
    .catch((err) => showError(err.message || "Couldn't save that. Check the internet connection and try again."));
});

// ---------------- drawing ----------------
function render() {
  if (!state.event) return;
  renderBulk();
  renderBracket();
  renderDivisions();
  renderTopics();
}

function renderBulk() {
  const divisions = Object.keys(state.games).filter((d) => isPlaying(state.event, d));
  setHtml($("bulk"), BULK_ACTIONS.map((act) => {
    const count = divisions.filter((d) => divisionAction(state.games[d]) === act).length;
    return count ? `<button class="btn primary" data-act="${act}" ${state.busy ? "disabled" : ""}>${ACTION_LABEL[act]} (${count} ${count === 1 ? "year" : "years"})</button>` : "";
  }).join(""));

  const devices = sessionDevices(state.event, state.games);
  const crowded = devices >= DEVICE_WARNING;
  $("session-note").classList.toggle("crowded", crowded);
  $("session-note").textContent = !divisions.length
    ? "Tick \"Playing now\" on the years in this session. Their buttons and hall screen panels will appear."
    : `${devices} device${devices === 1 ? "" : "s"} joined this session.` + (crowded
      ? ` The free Firebase plan stops at ${DEVICE_LIMIT} connections, counting this dashboard and the hall screen. Ask students to share devices.`
      : "");
}

function renderBracket() {
  const event = state.event;
  const champions = event.champions || {};
  const years = YEAR_GROUPS.filter((y) => event.divisions && event.divisions[y.id]);
  const winner = overallWinner(event, state.games);
  const finalGame = state.games.final;
  setHtml($("bracket"), `
    <ol class="bracket-years">
      ${years.map((y) => {
        const c = champions[y.id];
        return `<li class="bracket-box ${c ? "done" : ""}" style="--tc:${y.color}">
          <span class="bb-label">${y.name} champion</span>
          <strong>${c ? escapeHtml(c.name) : "To be decided"}</strong>
          ${c ? `<span class="bb-sub">${c.score} pts</span>` : ""}
        </li>`;
      }).join("")}
    </ol>
    <div class="bracket-box bracket-final ${finalGame ? "done" : ""}">
      <span class="bb-label">Grand Final</span>
      <strong>${finalGame ? `Game code ${escapeHtml(state.codes.final)}` : "Not started"}</strong>
      ${finalGame ? `<span class="bb-sub">${escapeHtml(divisionStatus(finalGame))}</span>` : ""}
    </div>
    <div class="bracket-box bracket-winner ${winner ? "done" : ""}">
      <span class="bb-label">🏆 Overall champion</span>
      <strong>${winner ? escapeHtml(winner.name) : "To be decided"}</strong>
    </div>`);
  setHtml($("final-actions"), finalReady(event, state.games)
    ? `<button class="btn primary" data-act="create-final" ${state.busy ? "disabled" : ""}>🏆 Create the Grand Final</button>
       <span class="hint">Each champion's crew gets a button on their device to join.</span>`
    : "");
}

function renderDivisions() {
  const order = [...YEAR_GROUPS.map((y) => y.id), "final"].filter((d) => state.codes[d]);
  // the clock is left out here: the 1-second timer below updates it on its own
  setHtml($("divisions"), order.map((d) => {
    const g = state.games[d];
    const code = state.codes[d];
    if (!g) return `<article class="division-card"><h3>${divisionName(d)} <small>Code ${escapeHtml(code)}</small></h3><p class="hint">Loading…</p></article>`;
    const players = Object.values(g.players || {});
    const playing = isPlaying(state.event, d);
    const action = playing ? divisionAction(g) : null;
    const final = d === "final";
    return `<article class="division-card ${playing ? "" : "resting"}">
      <div class="dc-head">
        <h3>${divisionName(d)} <small>Code <strong>${escapeHtml(code)}</strong></small></h3>
        <span class="dc-clock" data-clock="${d}">--:--</span>
      </div>
      ${final ? "" : `<label class="check playing-now no-print"><input type="checkbox" data-playing="${d}" ${playing ? "checked" : ""} ${g.phase === "battle" ? "disabled" : ""}> Playing now</label>`}
      <p class="dc-status">${escapeHtml(divisionStatus(g))} · ${players.length} device${players.length === 1 ? "" : "s"}</p>
      <div class="table-wrap">
        <table class="standings-table compact">
          <thead><tr><th>#</th><th>Team</th>${final ? "" : "<th>R1</th><th>R2</th><th>R3</th>"}<th>Total</th><th>Right</th></tr></thead>
          <tbody>${getAccumulatedStandings(g).map((s, i) => `<tr style="--tc:${s.color}">
            <td>${i + 1}</td>
            <td><span class="pennant"></span>${escapeHtml(s.name)}</td>
            ${final ? "" : `<td>${s.r1}</td><td>${s.r2}</td><td>${s.r3}</td>`}
            <td><strong>${s.totalScore}</strong></td>
            <td>${s.correct + s.wrong ? `${s.accuracy}%` : "–"}</td>
          </tr>`).join("")}</tbody>
        </table>
      </div>
      <div class="btn-row no-print">
        ${action ? `<button class="btn ${action === "end" ? "danger" : "primary"}" data-act="${action}" data-division="${d}" ${state.busy ? "disabled" : ""}>${ACTION_LABEL[action]}</button>` : ""}
        <a class="btn" href="${pageUrl("teacher.html?code=" + code)}" target="_blank" rel="noopener">Control room</a>
        <a class="btn" href="${pageUrl("projector.html?code=" + code)}" target="_blank" rel="noopener">Projector</a>
      </div>
    </article>`;
  }).join(""));
  drawClocks();
}

function drawClocks() {
  document.querySelectorAll("[data-clock]").forEach((el) => {
    const g = state.games[el.dataset.clock];
    if (g) el.textContent = clockText(g);
  });
}

function clockText(g) {
  const ends = g.competition && g.competition.roundEndsAt;
  return g.phase === "battle" && ends ? fmtClock(Math.max(0, Math.round((ends - Date.now()) / 1000))) : "--:--";
}

function renderTopics() {
  const { divisions, rows } = topicTable(state.games);
  if (!rows.length) { setHtml($("topics"), `<p class="hint">No answers yet.</p>`); return; }
  const cell = (c) => (c && c.pct !== null
    ? `<span class="topic-pct ${c.pct < 50 ? "low" : ""}">${c.pct}%</span> <small>${c.right + c.wrong}</small>`
    : "–");
  setHtml($("topics"), `<table class="standings-table compact">
    <thead><tr><th>Topic</th><th>Overall</th>${divisions.map((d) => `<th>${divisionName(d)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td>${escapeHtml(r.topic)}</td>
      <td>${cell({ pct: r.pct, right: r.right, wrong: r.wrong })}</td>
      ${divisions.map((d) => `<td>${cell(r.cells[d])}</td>`).join("")}
    </tr>`).join("")}</tbody>
  </table>`);
}

// ---------------- clocks ----------------
// Runs every second. Only the tab holding the lease does the jobs.
let lastLease = 0;
async function renewLease() {
  lastLease = Date.now();
  try { state.hasClocks = await claimClockLease(eventId, tabId); }
  catch (e) { console.error(e); state.hasClocks = false; }
  $("clock-note").textContent = state.hasClocks
    ? "This tab is running the clocks for every year. Keep it open and visible during battles."
    : "Another open dashboard is running the clocks. This one only shows results.";
  $("clock-note").classList.toggle("passive", !state.hasClocks);
}

setInterval(() => {
  if (!state.event) return;
  if (Date.now() - lastLease >= 5000) renewLease();
  drawClocks();
  if (!state.hasClocks) return;
  for (const [d, g] of Object.entries(state.games)) tickGame(state.codes[d], g, state.clocks[d]);
}, 1000);

// ---------------- export ----------------
function download(name, rows) {
  // the BOM makes Excel read accented names correctly
  const url = URL.createObjectURL(new Blob(["﻿" + toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
$("csv-standings").onclick = () => download(`${eventId}-standings.csv`, standingsRows(state.games, state.event));
$("csv-topics").onclick = () => download(`${eventId}-topics.csv`, topicRows(state.games));
$("print").onclick = () => window.print();
