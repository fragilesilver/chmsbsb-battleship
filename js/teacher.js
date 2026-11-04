// ============================================================
//  teacher.js  -  create games and run them
// ============================================================
import {
  ensureSignedIn, createGame, watchGame, gameExists, setPhase,
  startBattle, giveAmmo, endGame, addFeed, setMode, modesOf,
  advanceStorm, setStormNextAt, givePowerups, ensureCaptains,
  advanceToNextRound, startGrandFinal, setRoundEndsAt, finishRound,
  createEvent, eventExists, finaliseDivision,
} from "./firebase.js";
import { newClock, tickGame, closeStorm, fmtClock as fmt } from "./autorun.js";
import {
  TEAM_PRESETS, fleetComplete, maxStorm, ZONE, ZONE_SIZES, SHIP_TYPES, DEFAULT_FLEET, MAX_PER_TYPE,
  gridSize, colLabel, fleetFor, randomFleet, zoneFor, avatarOf,
  ROLES, rolesOn, captainOf, roleOf,
  YEAR_GROUPS, isCompetition, currentRoundNum, isGrandFinal, getAccumulatedStandings,
} from "./game.js";
import { renderOcean, renderTeams, renderFeed, escapeHtml } from "./board.js";
import { BUILTIN_SETS, DEFAULT_SET_ID, loadBuiltin, setFromFile, setForGame, describeSet, modeAllowed } from "./qsets.js";

const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

const state = { code: null, game: null, stop: null, clock: newClock(), timer: null, qset: null, qsetKey: "" };

// Links work however the page was opened: /teacher.html, /teacher or with extras on the end
const pageUrl = (page) => new URL(page, location.href).href;
// A game in a whole-school event has its clocks run by the event dashboard
const eventIdOf = (g) => (g && g.settings && g.settings.eventId) || null;

// ---------------- question set picker ----------------
// `chosen` is the set the form will create the game with (built-in or uploaded)
const chosen = { set: null, custom: false };
$("qset-pick").innerHTML = BUILTIN_SETS.map((s) =>
  `<option value="${s.id}" ${s.id === DEFAULT_SET_ID ? "selected" : ""}>${escapeHtml(s.title)}</option>`).join("");

// Show only the ways to play the set supports, and describe the set
function applySet(set) {
  chosen.set = set;
  const d = describeSet(set);
  const bits = [`${d.mcq} multiple-choice question${d.mcq === 1 ? "" : "s"}`];
  if (d.typed) bits.push(`${d.typed} typed torpedo question${d.typed === 1 ? "" : "s"}`);
  if (d.topics.length) bits.push(`topics: ${d.topics.join(", ")}`);
  $("qset-info").textContent = `${set.title}${set.exam ? ` (${set.exam})` : ""}: ${bits.join("; ")}.`;
  for (const mode of ["torpedo", "console"]) {
    const ok = modeAllowed(set, mode);
    $("row-" + mode).hidden = !ok;
    $("mode-" + mode).disabled = !ok;
  }
  const typed = !set.features.generated && d.typed > 0;
  $("mode-torpedo-text").textContent = typed
    ? "Torpedoes: type the right answer to launch a guaranteed hit"
    : "Torpedoes: trace code to find the target";
  $("mode-console-text").textContent = "Code console: write FIRE commands in pseudocode";
}

async function pickBuiltin() {
  $("qset-errors").hidden = true;
  $("qset-clear").hidden = true;
  $("qset-file").value = "";
  chosen.custom = false;
  $("qset-info").textContent = "Loading…";
  try { applySet(await loadBuiltin($("qset-pick").value)); }
  catch (e) { $("qset-info").textContent = e.message; chosen.set = null; }
}
$("qset-pick").addEventListener("change", pickBuiltin);
$("qset-clear").addEventListener("click", pickBuiltin);

async function pickFile() {
  const file = $("qset-file").files[0];
  if (!file) return pickBuiltin();
  const { set, errors } = await setFromFile(file, { uiLang: $("qset-lang").value, id: "custom" });
  const list = $("qset-errors");
  list.hidden = !errors.length;
  list.innerHTML = errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("");
  if (!set) { $("qset-info").textContent = "That file can't be used yet. Fix the problems above and choose it again."; chosen.set = null; chosen.custom = true; return; }
  chosen.custom = true;
  $("qset-clear").hidden = false;
  applySet(set);
}
$("qset-file").addEventListener("change", pickFile);
$("qset-lang").addEventListener("change", () => { if ($("qset-file").files[0]) pickFile(); });
pickBuiltin();

// ---------------- setup form ----------------
function drawNameInputs() {
  const n = +$("team-count").value;
  $("team-names").innerHTML = TEAM_PRESETS.slice(0, n).map((t, i) => {
    const yr = t.year || YEAR_GROUPS[i % YEAR_GROUPS.length].id;
    return `<label class="name-row" style="--tc:${t.color}"><span class="pennant"></span>
      <input data-i="${i}" value="${t.name}" maxlength="24" aria-label="Team ${i + 1} name">
      <select class="team-year" data-year-i="${i}" aria-label="Year group">
        ${YEAR_GROUPS.map((y) => `<option value="${y.id}" ${y.id === yr ? "selected" : ""}>${y.name}</option>`).join("")}
      </select>
    </label>`;
  }).join("");
}
$("team-count").addEventListener("change", () => { drawNameInputs(); checkMapAndFleet(); });
drawNameInputs();

// map size + how many of each ship
$("zone-size").innerHTML = ZONE_SIZES.map((z) =>
  `<option value="${z}" ${z === ZONE ? "selected" : ""}>${z} × ${z}${z === ZONE ? " (standard)" : ""}</option>`).join("");
$("fleet-table").innerHTML = SHIP_TYPES.map((t) =>
  `<label for="fleet-${t.id}">${t.name} <small class="hint">(${t.len} squares)</small></label>
   <input id="fleet-${t.id}" type="number" min="0" max="${MAX_PER_TYPE}" value="${DEFAULT_FLEET[t.id] || 0}">`).join("") +
  `<p class="fleet-sum" id="fleet-sum" role="status"></p>`;
$("zone-size").addEventListener("change", checkMapAndFleet);
$("fleet-table").addEventListener("input", checkMapAndFleet);

function readFleet() {
  const fleet = {};
  for (const t of SHIP_TYPES) {
    const n = Math.round(+$("fleet-" + t.id).value || 0);
    fleet[t.id] = Math.max(0, Math.min(MAX_PER_TYPE, n));
  }
  return fleet;
}

// Returns an error message, or "" if this map and fleet work
function checkMapAndFleet() {
  const s = { teamCount: +$("team-count").value, zoneSize: +$("zone-size").value, fleet: readFleet() };
  const { cols, rows } = gridSize(s);
  $("ocean-size").textContent = `Whole ocean: ${cols} × ${rows} (columns A to ${colLabel(cols - 1)}, rows 1 to ${rows}).`;
  const ships = fleetFor(s);
  const squares = ships.reduce((sum, x) => sum + x.len, 0);
  let err = "";
  if (!ships.length) err = "Add at least one ship.";
  else if (squares > s.zoneSize * s.zoneSize * 0.4) err = `${squares} squares of ship is too many for ${s.zoneSize} × ${s.zoneSize} waters. Use fewer ships or bigger waters.`;
  else if (!randomFleet(zoneFor(0, s), s)) err = "These ships don't fit in the home waters. Use fewer ships or bigger waters.";
  const sum = $("fleet-sum");
  sum.textContent = err || `${ships.length} ship${ships.length === 1 ? "" : "s"} per team, ${squares} squares to sink.`;
  sum.className = "fleet-sum" + (err ? " bad" : "");
  return err;
}
checkMapAndFleet();

const showRoleTimes = () => { $("role-times").hidden = !$("roles-on").checked; };
$("roles-on").addEventListener("change", showRoleTimes);
showRoleTimes();

// ---------------- competition format ----------------
const formatOf = () => $("comp-format").value;
function showFormat() {
  const f = formatOf();
  $("event-setup").hidden = f !== "event";
  $("single-setup").hidden = f === "event";
  $("round-duration-row").hidden = f === "casual";
  $("create-btn").textContent = f === "event" ? "Create event" : "Create game";
  // An event has large class crews of different sizes. A single game keeps its usual small-class rules.
  const event = f === "event";
  $("even-teams").checked = !event;
  $("fire-secs").value = event ? 15 : 0;
  $("crew-torpedo-secs").value = event ? 60 : 0;
  $("power-secs").value = event ? 120 : 0;
}
$("comp-format").addEventListener("change", showFormat);

// One row per year: how many teams, and their names. Typed names survive changing the count.
const eventNames = Object.fromEntries(YEAR_GROUPS.map((y) => [y.id, []]));
$("event-teams").innerHTML = YEAR_GROUPS.map((y) => `
  <div class="event-year" data-year="${y.id}">
    <label>${y.name}
      <select class="event-count" aria-label="${y.name} number of teams">
        <option value="0">Not playing</option>
        ${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === 4 ? "selected" : ""}>${n} teams</option>`).join("")}
      </select>
    </label>
    <div class="event-names"></div>
  </div>`).join("");

function drawEventNames(row) {
  const year = row.dataset.year;
  const label = YEAR_GROUPS.find((y) => y.id === year).name;
  const names = eventNames[year];
  row.querySelectorAll(".event-names input").forEach((input, i) => { names[i] = input.value; });
  const n = +row.querySelector(".event-count").value;
  row.querySelector(".event-names").innerHTML = TEAM_PRESETS.slice(0, n).map((t, i) =>
    `<label class="name-row" style="--tc:${t.color}"><span class="pennant"></span>
      <input maxlength="24" value="${escapeHtml(names[i] ?? `${label} Team ${i + 1}`)}" aria-label="${label} team ${i + 1} name"></label>`).join("");
}
document.querySelectorAll(".event-year").forEach((row) => {
  drawEventNames(row);
  row.querySelector(".event-count").addEventListener("change", () => drawEventNames(row));
});
showFormat();

const readDivisions = () => [...document.querySelectorAll(".event-year")]
  .map((row) => ({
    id: row.dataset.year,
    teamNames: [...row.querySelectorAll(".event-names input")].map((i, n) => i.value.trim() || `Team ${n + 1}`),
  }))
  .filter((d) => d.teamNames.length >= 2);

const ready = ensureSignedIn().catch(() => { $("setup-msg").textContent = "Couldn't connect to Firebase. Check the internet connection."; });

$("setup-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("create-msg").textContent = "";
  const err = checkMapAndFleet();
  if (err) { $("fleet-sum").scrollIntoView({ block: "center" }); return; }
  if (!chosen.set) { $("qset-info").scrollIntoView({ block: "center" }); return; }
  const format = formatOf();
  const divisions = readDivisions();
  if (format === "event" && !divisions.length) { $("create-msg").textContent = "Choose teams for at least one year."; return; }
  $("create-btn").disabled = true;
  try {
    await ready;
    if (format === "event") {
      const id = await createEvent($("event-title").value.trim() || "CHMS BSB Battle Royale", divisions, sharedSettings());
      store.set("bs_teacher_event", id);
      location.href = pageUrl("event.html?id=" + id);
      return;
    }
    const code = await createGame({
      ...sharedSettings(),
      teamCount: +$("team-count").value,
      teamNames: [...document.querySelectorAll("#team-names input")].map((i) => i.value.trim()),
      teamYears: [...document.querySelectorAll("#team-names .team-year")].map((s) => s.value),
      competitionMode: format === "tournament",
    });
    openGame(code);
  } catch (ex) {
    $("create-msg").textContent = ex.message || "Couldn't create that. Check the internet connection and try again.";
  } finally {
    $("create-btn").disabled = false;
  }
});

// The form choices every format shares
function sharedSettings() {
  return {
    startAmmo: +$("start-ammo").value,
    reloadSecs: +$("reload-secs").value,
    torpedoSecs: +$("torpedo-secs").value,
    stormMins: +$("storm-mins").value,
    zoneSize: +$("zone-size").value,
    crewMax: Math.max(0, Math.round(+$("crew-max").value || 0)),
    evenTeams: $("even-teams").checked,
    roles: $("roles-on").checked,
    navSecs: Math.max(5, Math.round(+$("nav-secs").value || 15)),
    sciSecs: Math.max(10, Math.round(+$("sci-secs").value || 90)),
    fireSecs: Math.max(0, Math.round(+$("fire-secs").value || 0)),
    crewTorpedoSecs: Math.max(0, Math.round(+$("crew-torpedo-secs").value || 0)),
    powerSecs: Math.max(0, Math.round(+$("power-secs").value || 0)),
    fleet: readFleet(),
    modes: {
      quiz: $("mode-quiz").checked,
      torpedo: $("mode-torpedo").checked && modeAllowed(chosen.set, "torpedo"),
      console: $("mode-console").checked && modeAllowed(chosen.set, "console"),
    },
    questionSet: chosen.custom ? "custom" : chosen.set.id,
    customSet: chosen.custom ? chosen.set : null,
    roundDurationMins: Math.max(3, Math.round(+$("round-duration").value || 8)),
    totalRounds: 3,
  };
}

$("reopen-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await ready;
  const code = $("reopen-code").value.trim().toUpperCase();
  if (await gameExists(code)) openGame(code);
  else $("setup-msg").textContent = `No game with code ${code}.`;
});

$("reopen-event-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  await ready;
  const id = $("reopen-event").value.trim().toUpperCase();
  try {
    if (await eventExists(id)) location.href = pageUrl("event.html?id=" + id);
    else $("event-msg").textContent = `No event with ID ${id}.`;
  } catch (ex) { $("event-msg").textContent = ex.message; }
});

$("reopen-code").value = store.get("bs_teacher_code") || "";
$("reopen-event").value = store.get("bs_teacher_event") || "";

// The event dashboard links straight to a control room with ?code=XXXX
const urlCode = (new URLSearchParams(location.search).get("code") || "").trim().toUpperCase();
if (urlCode) {
  ready.then(async () => {
    if (await gameExists(urlCode)) openGame(urlCode);
    else $("setup-msg").textContent = `No game with code ${urlCode}.`;
  });
}

function openGame(code) {
  state.code = code;
  store.set("bs_teacher_code", code);
  $("screen-setup").hidden = true;
  $("screen-control").hidden = false;
  $("join-code").textContent = code;
  $("join-url").textContent = pageUrl(".");
  $("projector-link").href = pageUrl("projector.html?code=" + code);
  if (new URLSearchParams(location.search).get("code") !== code) history.replaceState(null, "", "?code=" + code);
  state.clock = newClock();
  if (state.stop) state.stop();
  state.stop = watchGame(code, async (g) => {
    if (g) {
      const key = g.questionSet ? "custom:" + (g.questionSet.id || "") + (g.questionSet.questions || []).length : (g.settings && g.settings.questionSet) || "";
      if (!state.qset || key !== state.qsetKey) { state.qset = await setForGame(g); state.qsetKey = key; }
    }
    state.game = g;
    render();
    if (g && !eventIdOf(g)) pickCaptains(g);
  });
  startReloadClock();
}

// With crew roles on, this tab picks a random captain for each crew and fills empty jobs
let captainsBusy = false;
async function pickCaptains(g) {
  if (captainsBusy || !rolesOn(g)) return;
  captainsBusy = true;
  try { await ensureCaptains(state.code, g); } finally { captainsBusy = false; }
}

function stormControls(g) {
  const lvl = g.storm || 0, max = maxStorm(g.settings);
  const auto = g.settings.stormMins > 0;
  const next = g.stormNextAt ? Math.max(0, Math.round((g.stormNextAt - Date.now()) / 1000)) : null;
  return `<div class="btn-row storm-row">
      <span class="storm-level">Storm ${lvl} of ${max}</span>
      <button class="btn" data-action="storm" ${lvl >= max ? "disabled" : ""}>Close the storm in now</button>
      ${auto && lvl < max ? `<button class="btn ${g.stormNextAt ? "on" : ""}" data-action="storm-auto" aria-pressed="${!!g.stormNextAt}">
        Auto storm: ${g.stormNextAt ? `on, next in <span id="storm-left">${fmt(next)}</span>` : "paused"}</button>` : ""}
    </div>`;
}

// ---------------- control room ----------------
function render() {
  const g = state.game;
  if (!g) return;

  const isComp = isCompetition(g);
  const rNum = currentRoundNum(g);
  const isFinal = isGrandFinal(g);
  const comp = g.competition || {};

  // Update Tournament Banner
  if ($("tourney-bar")) {
    $("tourney-bar").hidden = !isComp;
    if (isComp) {
      $("tb-badge").textContent = isFinal ? "🏆 GRAND FINALS" : `Round ${rNum} of ${comp.totalRounds || 3}`;
      $("tb-title").textContent = isFinal
        ? "Ultimate Championship Showdown: Y7 vs Y8 vs Y9 vs Y10"
        : `Stage 1: Best of 3 Preliminaries (Accumulated Scores)`;
    }
  }

  // Render Standings Table
  if ($("tourney-standings-card")) {
    $("tourney-standings-card").hidden = !isComp;
    if (isComp && $("standings-table-wrap")) {
      const standings = getAccumulatedStandings(g);
      $("standings-table-wrap").innerHTML = `<table class="standings-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Year</th>
            <th>R1</th>
            <th>R2</th>
            <th>R3</th>
            <th>Live Round</th>
            <th>Total Points</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map((s, idx) => {
            const yrObj = YEAR_GROUPS.find((y) => y.id === s.year);
            const yrLabel = yrObj ? yrObj.name : s.year;
            return `<tr style="--tc:${s.color}">
              <td><strong>#${idx + 1}</strong></td>
              <td><span class="pennant"></span><strong>${escapeHtml(s.name)}</strong></td>
              <td><span class="year-badge">${yrLabel}</span></td>
              <td>${s.r1}</td>
              <td>${s.r2}</td>
              <td>${s.r3}</td>
              <td>${s.liveRoundScore}</td>
              <td><strong class="total-pts">${s.totalScore}</strong></td>
              <td>
                ${s.isYearTop ? '<span class="qual-badge" title="Top in Year: Qualifies for Grand Finals">⭐ Top in ' + s.year + '</span>' : ''}
                ${s.alive ? `<span class="stat-afloat">${s.afloat} afloat</span>` : '<span class="stat-out">Sunk</span>'}
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`;
    }
  }

  document.querySelectorAll("#phases li").forEach((li) => {
    const order = ["lobby", "placement", "battle", "finished"];
    li.className = li.dataset.p === g.phase ? "now" : order.indexOf(li.dataset.p) < order.indexOf(g.phase) ? "done" : "";
  });

  const teamIdsList = Object.keys(g.teams);
  const readyCount = teamIdsList.filter((id) => g.teams[id].ready && fleetComplete(g.fleets && g.fleets[id], g.settings)).length;
  const players = Object.values(g.players || {});
  const clock = state.clock;
  const secsLeft = Math.max(0, Math.ceil((clock.nextReload - Date.now()) / 1000));
  const eventId = eventIdOf(g);

  $("event-link").hidden = !eventId;
  if (eventId) $("event-link").href = pageUrl("event.html?id=" + eventId);

  let html = "";
  if (g.phase === "lobby") {
    html = `<p>${players.length} student${players.length === 1 ? "" : "s"} joined, ${players.filter((p) => !p.team).length} without a team.</p>
      <button class="btn primary" data-action="placement">Open fleet placement</button>`;
  } else if (g.phase === "placement") {
    html = `<p>${readyCount} of ${teamIdsList.length} teams locked in. Teams that aren't ready get a random fleet when the battle starts.</p>
      <button class="btn primary" data-action="battle">Start battle</button>
      <button class="btn" data-action="lobby">Back to lobby</button>`;
  } else if (g.phase === "battle") {
    const hasTimer = g.settings.reloadSecs > 0 && !eventId;
    html = `<div class="btn-row">
        <button class="btn" data-action="ammo1">Give every team +1 shot</button>
        <button class="btn" data-action="ammo3">+3 shots</button>
        ${hasTimer ? `<button class="btn ${clock.autoReload ? "on" : ""}" data-action="reload" aria-pressed="${clock.autoReload}">
          Free shots: ${clock.autoReload ? `on, next in <span id="reload-left">${secsLeft}</span>s` : "paused"}</button>` : ""}
        <button class="btn" data-action="supply">Supply drop: sonar + airstrike for all</button>
        <button class="btn danger" data-action="end">End round now</button>
      </div>
      ${stormControls(g)}
      ${eventId ? `<p class="hint">Free shots, the storm and the round clock are run by the event dashboard. Keep it open and visible.</p>` : ""}`;
  } else {
    const w = g.winner && g.teams[g.winner];
    if (isComp) {
      if (eventId && !isFinal && comp.stage === "complete") {
        const champ = comp.champion && g.teams[comp.champion];
        html = `<p class="big">🏆 ${champ ? `${escapeHtml(champ.name)} are the ${escapeHtml(g.settings.division)} champions!` : "Division complete."}</p>
          <p class="hint">Create the Grand Final from the event dashboard once every year has finished.</p>`;
      } else if (eventId && !isFinal && rNum >= 3) {
        html = `<p class="big">${w ? `${escapeHtml(w.name)} won Round 3.` : "Round 3 concluded."} All three rounds are played.</p>
          <div class="btn-row">
            <button class="btn primary" data-action="finalise">Finalise division and name the champion</button>
          </div>`;
      } else if (isFinal) {
        html = `<p class="big">🏆 ${w ? `<strong>${escapeHtml(w.name)}</strong> crowned CHMS BSB Ultimate Champion!` : "Grand Finals concluded!"}</p>
          ${eventId ? "" : `<div class="btn-row">
            <button class="btn primary" data-action="new">Set up a new tournament</button>
          </div>`}`;
      } else if (rNum < 3) {
        html = `<p class="big">${w ? `${escapeHtml(w.name)} won Round ${rNum}!` : `Round ${rNum} concluded.`} Scores have been accumulated.</p>
          <div class="btn-row">
            <button class="btn primary" data-action="next-round">Start Round ${rNum + 1} of 3 (Keep Crews)</button>
            ${eventId ? "" : `<button class="btn" data-action="new">Set up a new tournament</button>`}
          </div>`;
      } else {
        html = `<p class="big">Preliminaries complete! Best of 3 scores calculated. The 4 Year Champions are ready for the ultimate title.</p>
          <div class="btn-row">
            <button class="btn primary" data-action="grand-final">🏆 Launch Grand Finals (Y7 vs Y8 vs Y9 vs Y10)</button>
            <button class="btn" data-action="new">Set up a new tournament</button>
          </div>`;
      }
    } else {
      html = `<p class="big">${w ? `${escapeHtml(w.name)} win!` : "Game over."}</p>
        <button class="btn primary" data-action="new">Set up a new game</button>`;
    }
  }

  if (g.phase === "placement" || g.phase === "battle") {
    const m = modesOf(g);
    const label = { quiz: "Questions", torpedo: "Torpedoes", console: "Code console" };
    for (const k of Object.keys(label)) if (state.qset && !modeAllowed(state.qset, k)) delete label[k];
    html += `<div class="btn-row modes">${Object.keys(label).map((k) =>
      `<button class="btn ${m[k] ? "on" : ""}" data-action="mode" data-mode="${k}" aria-pressed="${m[k]}">${label[k]}: ${m[k] ? "on" : "off"}</button>`).join("")}</div>`;
  }

  $("controls").innerHTML = html;
  $("controls").onclick = onControl;

  renderOcean($("ocean"), g, { revealAll: true });
  renderTeams($("teams"), g, null);
  renderFeed($("feed"), g);

  $("crews").innerHTML = Object.entries(g.teams).map(([id, t]) => {
    const yr = t.year ? `<span class="year-tag">${t.year}</span> ` : "";
    const names = Object.entries(g.players || {}).filter(([, p]) => p.team === id)
      .map(([uid, p]) => `${avatarOf(p.avatar) ? `<span class="av">${avatarOf(p.avatar)}</span>` : ""}${escapeHtml(p.name)}${rolesOn(g) ? ` <span class="role-tag" title="${captainOf(g, id) === uid ? "Captain, " : ""}${ROLES[roleOf(g, uid)].name}">${captainOf(g, id) === uid ? ROLES.captain.icon : ""}${ROLES[roleOf(g, uid)].icon}</span>` : ""}${p.correct || p.wrong ? ` <span class="score">${p.correct || 0}/${(p.correct || 0) + (p.wrong || 0)}</span>` : ""}`);
    return `<p style="--tc:${t.color}"><span class="pennant"></span><strong>${yr}${escapeHtml(t.name)} (${names.length}):</strong> ${names.join(", ") || "none yet"}</p>`;
  }).join("") + (() => {
    const loose = Object.values(g.players || {}).filter((p) => !p.team).map((p) => (avatarOf(p.avatar) ? avatarOf(p.avatar) + " " : "") + escapeHtml(p.name));
    return loose.length ? `<p><strong>No team:</strong> ${loose.join(", ")}</p>` : "";
  })();
}

async function onControl(e) {
  const act = e.target.closest("[data-action]")?.dataset.action;
  const g = state.game;
  if (!act) return;
  if (act === "placement") { await setPhase(state.code, "placement"); await addFeed(state.code, "Fleet placement is open.", "info"); }
  if (act === "lobby") await setPhase(state.code, "lobby");
  if (act === "battle") { await startBattle(state.code, g); state.clock.nextReload = Date.now() + g.settings.reloadSecs * 1000; }
  if (act === "ammo1") { await giveAmmo(state.code, g, 1); toast("Every team got +1 shot."); }
  if (act === "ammo3") { await giveAmmo(state.code, g, 3); toast("Every team got +3 shots."); }
  if (act === "reload") { state.clock.autoReload = !state.clock.autoReload; state.clock.nextReload = Date.now() + g.settings.reloadSecs * 1000; render(); }
  if (act === "mode") {
    const k = e.target.closest("[data-mode]").dataset.mode;
    await setMode(state.code, k, !modesOf(g)[k]);
  }
  if (act === "supply") { await givePowerups(state.code, g); toast("Supply drop sent."); }
  if (act === "storm") {
    if (g.stormNextAt) await closeStorm(state.code, g);
    else await advanceStorm(state.code, g);
  }
  if (act === "storm-auto") await setStormNextAt(state.code, g.stormNextAt ? null : Date.now() + g.settings.stormMins * 60000);
  if (act === "end" && confirm("End this round for everyone?")) {
    if (isCompetition(g)) await finishRound(state.code, "The teacher ended the round.");
    else await endGame(state.code);
  }
  if (act === "next-round") { await advanceToNextRound(state.code, g); toast("Fleet placement is open for the next round."); }
  if (act === "grand-final" && confirm("Launch the Grand Finals? Round 3 scores will be locked in.")) await startGrandFinal(state.code, g);
  if (act === "finalise" && confirm("Lock in the scores and name the champion for this year?")) await finaliseDivision(state.code, g);
  if (act === "new") location.href = pageUrl("teacher.html");
}

// Free shots, the storm and the round clock run from this tab, so keep it open during
// the battle. In a whole-school event the dashboard does this job instead.
function startReloadClock() {
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    const g = state.game;
    if (!g) return;
    const ends = g.competition && g.competition.roundEndsAt;
    const leftSecs = ends ? Math.max(0, Math.round((ends - Date.now()) / 1000)) : null;
    $("tb-timer").textContent = leftSecs === null ? "--:--" : fmt(leftSecs);
    $("tb-timer").classList.toggle("expired", leftSecs === 0 && g.phase === "battle");

    const stormSpan = $("storm-left");
    if (stormSpan && g.stormNextAt) stormSpan.textContent = fmt(Math.max(0, Math.round((g.stormNextAt - Date.now()) / 1000)));

    if (eventIdOf(g)) return;
    tickGame(state.code, g, state.clock);
    const reloadSpan = $("reload-left");
    if (reloadSpan) reloadSpan.textContent = Math.max(0, Math.ceil((state.clock.nextReload - Date.now()) / 1000));
  }, 1000);
}

let toastTimer;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.className = "toast show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = "toast"), 2400);
}

if ($("btn-timer-add")) {
  $("btn-timer-add").onclick = async () => {
    if (!state.game || !state.game.competition) return;
    const ends = state.game.competition.roundEndsAt || (Date.now() + 60000);
    await setRoundEndsAt(state.code, ends + 60000);
    toast("+1 minute added to round clock.");
  };
}
