// ============================================================
//  student.js  -  join, pick team, place fleet, fire
// ============================================================
import {
  ensureSignedIn, watchGame, getPhase, joinGame, chooseTeam,
  saveFleet, setReady, fire, recordAnswer, modesOf, useSonar, useAirstrike,
  setAvatar, crewAvatars, leaveTeam, setRole, makeCaptain, suggestTargets, serverNow,
} from "./firebase.js";
import {
  fleetFor, shipName, AVATARS, avatarOf, zoneFor, teamIndex, canPlace, randomFleet, shipCells, fleetComplete,
  cellName, zoneOwner, cellKey, gridSize, colLabel,
  POWERUPS, airstrikeCells, sonarCells, maxStorm, crewBlock, torpedoTargets,
  ROLES, JOBS, rolesOn, crewOf, captainOf, roleOf, jobsOf, earnKind,
  YEAR_GROUPS, isCompetition, currentRoundNum, isGrandFinal, getAccumulatedStandings,
  levelWeightsFor, pickLevel,
} from "./game.js";
import { renderOcean, renderTeams, renderFeed, escapeHtml } from "./board.js";
import { setForGame, modeAllowed, isTyped, checkTyped } from "./qsets.js";
import { useLanguage, t } from "./i18n.js";
import { makeTorpedo, normaliseCell } from "./trace.js";
import { makeQuestion, makeOutputPuzzle, makeBlankPuzzle } from "./puzzles.js";
import { run as runPseudo } from "./pseudocode.js";
import { sfx, muteButton } from "./sound.js";
import { attachZoom } from "./zoom.js";

const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};

const state = {
  uid: null, code: null, game: null, stop: null,
  qset: null, qsetKey: "",   // the question set this game uses
  placing: { shipId: null, dir: "h", hover: null },
  avatar: null,
  target: null, busy: false,
};

// ---------------- start-up ----------------
muteButton($("mute"));
attachZoom($("chart-box"));
setInterval(() => {
  const el = document.querySelector(".storm-line");
  if (el && state.game) el.outerHTML = stormLine(state.game) || "<div class=\"storm-line\"></div>";
  // count down the crew's next shot on the Fire button
  const g = state.game;
  const teamId = g && g.players && g.players[state.uid] && g.players[state.uid].team;
  if (g && g.phase === "battle" && teamId && g.settings.fireSecs > 0 && battle.tab === "fire" && g.teams[teamId].alive) updateFireBox(g, teamId);
}, 1000);

// Leave a list alone unless it changed, and then replace only the rows that did,
// so a button isn't swapped out from under a finger while others are joining
function setRows(el, rows) {
  const old = el.__rows;
  if (!old || old.length !== rows.length || el.children.length !== rows.length) {
    el.innerHTML = rows.join("");
  } else {
    rows.forEach((row, i) => { if (row !== old[i]) el.children[i].outerHTML = row; });
  }
  el.__rows = rows;
}

function setHtml(el, html) {
  if (el.__html === html) return;
  el.__html = html;
  el.innerHTML = html;
}

// Seconds until the crew can next fire (0 = now)
const fireWait = (team) => Math.max(0, Math.ceil(((team.nextFireAt || 0) - serverNow()) / 1000));
// the projector's QR code links to ?code=XXXX: fill it in, then tidy the address bar
const linkCode = (new URLSearchParams(location.search).get("code") || "").trim().toUpperCase().slice(0, 4);
if (linkCode) history.replaceState(null, "", location.pathname);
$("join-code").value = linkCode || store.get("bs_code") || "";
$("join-name").value = store.get("bs_name") || "";
state.avatar = avatarOf(store.get("bs_avatar")) || AVATARS[Math.floor(Math.random() * AVATARS.length)];
drawAvatarPicker($("avatar-picker"));

// Avatar grid: used on the join screen and while waiting in the lobby
function drawAvatarPicker(el) {
  const legend = el.querySelector("legend").outerHTML;
  el.innerHTML = legend + AVATARS.map((a) =>
    `<button type="button" class="avatar-opt" role="radio" data-avatar="${a}" aria-checked="${a === state.avatar}" aria-label="Avatar ${a}">${a}</button>`).join("");
  el.onclick = (e) => {
    const b = e.target.closest("[data-avatar]");
    if (!b) return;
    state.avatar = b.dataset.avatar;
    store.set("bs_avatar", state.avatar);
    el.querySelectorAll(".avatar-opt").forEach((x) => x.setAttribute("aria-checked", x === b));
    if (state.code && state.game && state.game.players && state.game.players[state.uid]) setAvatar(state.code, state.uid, state.avatar);
  };
}

ensureSignedIn().then((user) => {
  state.uid = user.uid;
  const code = store.get("bs_code");
  // rejoin after a refresh, but not if a QR link brought them to a different game
  if (code && store.get("bs_name") && (!linkCode || linkCode === code)) tryJoin(code, store.get("bs_name"), true);
}).catch(() => showMsg("Couldn't connect. Check the internet connection and reload."));

$("join-form").addEventListener("submit", (e) => {
  e.preventDefault();
  tryJoin($("join-code").value.trim().toUpperCase(), $("join-name").value.trim(), false);
});

async function tryJoin(code, name, silent) {
  if (!state.uid) return showMsg("Still connecting. Try again in a moment.");
  if (!name) return showMsg("Enter your name.");
  // A database at its connection limit doesn't refuse: it just never answers
  let phase;
  try {
    phase = await Promise.race([
      getPhase(code),
      new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 12000)),
    ]);
  } catch {
    if (!silent) showMsg("Couldn't reach the game. The internet may be slow, or too many devices are connected. Try again, or share a device with your group.");
    return;
  }
  if (!phase) {
    if (!silent) showMsg(`No game with code ${code}. Check the board and try again.`);
    return;
  }
  // after a refresh, don't drop students back into a game that has already ended
  if (silent && phase === "finished") { store.set("bs_code", ""); $("join-code").value = ""; return; }
  await joinGame(code, state.uid, name, state.avatar);
  store.set("bs_code", code);
  store.set("bs_name", name);
  state.code = code;
  if (state.stop) state.stop();
  state.stop = watchGame(code, onGame);
}

// Work out which question set the game uses (a built-in one may need loading) before drawing
let gameTick = 0;
async function onGame(g) {
  const tick = ++gameTick;
  if (g) {
    const key = g.questionSet ? "custom:" + (g.questionSet.id || "") + (g.questionSet.questions || []).length : (g.settings && g.settings.questionSet) || "";
    if (!state.qset || key !== state.qsetKey) {
      const set = await setForGame(g);
      if (tick !== gameTick) return;   // a newer update arrived while loading
      state.qset = set; state.qsetKey = key;
      useLanguage(set);
      resetQuestions();
    }
  }
  state.game = g;
  render();
}

// A different set means the old question and torpedo puzzle no longer apply
function resetQuestions() {
  seenQuestions.clear();
  seenTyped.clear();
  battle.quiz.q = null;
  battle.torpedo.puzzle = null;
  battle.torpedo.result = null;
}

function showMsg(text) { $("join-msg").textContent = text; }

// ---------------- main render ----------------
function show(screen) {
  for (const s of ["join", "team", "wait", "play"]) $("screen-" + s).hidden = s !== screen;
}

function render() {
  const g = state.game;
  if (!g) { show("join"); return; }
  const me = g.players && g.players[state.uid];
  if (!me) { show("join"); return; }
  const team = me.team && g.teams[me.team];

  const isComp = isCompetition(g);
  const rNum = currentRoundNum(g);
  const isFinal = isGrandFinal(g);

  if ($("student-round-tag")) {
    $("student-round-tag").hidden = !isComp;
    if (isComp) $("student-round-tag").textContent = isFinal ? "🏆 GRAND FINALS" : `Round ${rNum} of 3`;
  }
  if ($("student-score-tag") && team) {
    $("student-score-tag").hidden = !isComp;
    if (isComp) {
      const standings = getAccumulatedStandings(g);
      const myStanding = standings.find((s) => s.teamId === me.team);
      const pts = myStanding ? myStanding.totalScore : 0;
      const rank = myStanding ? standings.indexOf(myStanding) + 1 : 1;
      $("student-score-tag").innerHTML = `<strong>${pts} pts</strong> <small>(#${rank})</small>`;
    }
  }

  $("who").innerHTML = team
    ? `<span class="pennant" style="--tc:${team.color}"></span>${avatarOf(me.avatar)} ${escapeHtml(me.name)}, ${escapeHtml(team.name)} <span class="code">Code ${state.code}</span>`
    : `${avatarOf(me.avatar)} ${escapeHtml(me.name)} <span class="code">Code ${state.code}</span>`;

  watchEvents(g, me.team);
  if (!team && g.phase !== "finished") return renderTeamPicker(g);
  if (g.phase === "lobby") return renderWaiting(g, team);
  show("play");
  if (g.phase !== "battle" && g.phase !== "placement") {
    const panel = $("panel");
    panel.dataset.key = "";
    panel.onsubmit = null;
    panel.oninput = null;
    panel.onchange = null;
  }
  if (g.phase === "placement") return renderPlacement(g, me.team);
  if (g.phase === "battle") return renderBattle(g, me.team);
  return renderFinished(g, me.team);
}

// ---------------- alerts for things other players did ----------------
const seen = { shots: null, storm: 0, won: false, jobs: null, suggest: null };
function watchEvents(g, teamId) {
  const shots = g.shots || {};
  if (seen.shots === null) {
    seen.shots = new Set(Object.keys(shots));
    seen.storm = g.storm || 0;
    seen.won = g.phase === "finished";
    return;
  }
  // If we transitioned to a new round placement/battle, reset won trigger
  if ((g.phase === "placement" || g.phase === "battle") && seen.won) {
    seen.won = false;
  }
  // A new round starts with an empty ocean, so the same squares can be hit again
  if (!Object.keys(shots).length) {
    seen.shots.clear();
    seen.storm = g.storm || 0;
  }
  for (const [k, shot] of Object.entries(shots)) {
    if (seen.shots.has(k)) continue;
    seen.shots.add(k);
    if (teamId && shot.target === teamId && shot.hit) {
      toast(`Incoming! ${g.teams[shot.by].name} hit your ${shipName(g.settings, shot.ship).toLowerCase()} at ${cellName(shot.r, shot.c)}.`, "alert");
      sfx.incoming();
    }
  }
  if ((g.storm || 0) > seen.storm) {
    seen.storm = g.storm;
    toast(g.storm >= maxStorm(g.settings)
      ? "The storm is at full strength!"
      : "The storm closes in! Ships in the storm are visible to everyone.", "storm");
    sfx.storm();
  }
  if (g.phase === "finished" && !seen.won) {
    seen.won = true;
    if (g.winner) sfx.win();
  }
  if (rolesOn(g) && teamId && (g.phase === "placement" || g.phase === "battle")) {
    // tell players when they get a new job
    const jobs = captainOf(g, teamId) ? jobsOf(g, teamId, state.uid).join(",") : "";
    if (jobs && seen.jobs !== null && jobs !== seen.jobs) {
      const list = jobs.split(",").map((j) => `${ROLES[j].icon} ${ROLES[j].name}`).join(" + ");
      toast(`Your job: ${list}`, "big");
    }
    seen.jobs = jobs;
    // the gunner hears about new target suggestions
    const sug = g.teams[teamId].suggest || {};
    const stamp = Object.entries(sug).map(([u, x]) => u + x.t).join();
    if (seen.suggest !== null && stamp !== seen.suggest && jobsOf(g, teamId, state.uid).includes("gunner")) {
      const newest = Object.entries(sug).filter(([u]) => u !== state.uid).sort((a, b) => b[1].t - a[1].t)[0];
      if (newest && !seen.suggest.includes(newest[0] + newest[1].t)) {
        const who = g.players[newest[0]];
        toast(`${who ? avatarOf(who.avatar) + " " + who.name : "Your crew"} suggests ${newest[1].cells.map((c) => cellName(...c)).join(", ")}`);
      }
    }
    seen.suggest = stamp;
  }
}

// ---------------- team picker ----------------
function renderTeamPicker(g) {
  show("team");
  const s = g.settings;
  $("team-note").textContent = s.evenTeams || s.crewMax > 0
    ? `Pick the team your teacher assigned you. ${s.evenTeams ? "Crews stay even, so some may be closed until the others catch up." : ""}${s.crewMax > 0 ? ` Up to ${s.crewMax} per crew.` : ""}`
    : "Pick the team your teacher assigned you.";
  setRows($("team-picker"), Object.entries(g.teams).map(([id, t]) => {
    const crew = Object.values(g.players || {}).filter((p) => p.team === id).map((p) => (avatarOf(p.avatar) ? avatarOf(p.avatar) + " " : "") + escapeHtml(p.name));
    const block = crewBlock(g, id, state.uid);
    const names = crew.slice(0, 6).join(", ") + (crew.length > 6 ? ` and ${crew.length - 6} more` : "");
    return `<li><button class="team-btn" data-team="${id}" style="--tc:${t.color}" ${block ? "disabled" : ""}>
      <span class="pennant"></span><strong>${escapeHtml(t.name)}</strong>
      <span class="crew">${crew.length} aboard${crew.length ? ": " + names : ""}</span>
      ${block && t.alive ? `<span class="crew closed">${block}</span>` : ""}</button></li>`;
  }));
  $("team-picker").onclick = async (e) => {
    const b = e.target.closest("[data-team]");
    if (!b) return;
    try { await chooseTeam(state.code, state.game, state.uid, b.dataset.team); } catch (err) { toast(err.message); }
  };
}

function renderWaiting(g, team) {
  show("wait");
  $("wait-title").textContent = `You're aboard with ${team.name}`;
  if (!$("wait-avatar").querySelector(".avatar-opt")) drawAvatarPicker($("wait-avatar"));
  $("roles-note").hidden = !rolesOn(g);
  $("leave-team").onclick = () => leaveTeam(state.code, state.game, state.uid).catch((err) => toast(err.message));
  renderTeams($("wait-teams"), g, g.players[state.uid].team);
}

// ---------------- crew roles ----------------
function crewHtml(g, teamId) {
  if (!rolesOn(g)) return "";
  const cap = captainOf(g, teamId);
  if (!cap) return `<h3>Your crew</h3><p class="hint">A captain is being picked at random…</p>`;
  const iAmCap = cap === state.uid;
  const rows = crewOf(g, teamId).map((uid) => {
    const p = g.players[uid];
    const name = escapeHtml(p.name);
    const jobs = jobsOf(g, teamId, uid).map((j) => `<span class="role-badge">${ROLES[j].icon} ${ROLES[j].name}</span>`).join("");
    const control = iAmCap
      ? `<select data-role-for="${uid}" aria-label="Job for ${name}">${JOBS.map((j) =>
          `<option value="${j}" ${j === roleOf(g, uid) ? "selected" : ""}>${ROLES[j].icon} ${ROLES[j].name}</option>`).join("")}</select>
         ${uid !== state.uid ? `<button class="linkish" data-captain="${uid}">Make captain</button>` : ""}`
      : "";
    return `<li class="crew-row ${uid === state.uid ? "me" : ""}">
      <span class="crew-name">${avatarOf(p.avatar)} ${name}${uid === state.uid ? " (you)" : ""}</span>
      <span class="crew-jobs">${jobs}</span>${control}</li>`;
  }).join("");
  return `<h3>Your crew</h3>
    ${iAmCap ? `<p class="hint">You're the captain. Give each crew member a job. Any job nobody has is yours.</p>` : ""}
    <ul class="crew-list">${rows}</ul>
    <details class="role-help"><summary>What does each job do?</summary><dl>${Object.values(ROLES).map((r) =>
      `<dt>${r.icon} ${r.name}</dt><dd>${r.job}</dd>`).join("")}</dl></details>`;
}

// Only touch the crew box when it changes, so the captain's dropdowns stay open
function drawCrew(g, teamId) {
  const box = $("crew-box");
  if (!box) return;
  const html = crewHtml(g, teamId);
  if (box.dataset.html !== html) { box.dataset.html = html; box.innerHTML = html; }
}

async function onCrewChange(e, teamId) {
  const sel = e.target.closest("[data-role-for]");
  if (sel) await setRole(state.code, state.game, teamId, sel.dataset.roleFor, sel.value).catch((err) => toast(err.message));
}

async function onCrewClick(e, teamId) {
  const b = e.target.closest("[data-captain]");
  if (!b) return false;
  const p = state.game.players[b.dataset.captain];
  if (p && confirm(`Make ${p.name} the captain? They'll take over placing ships and handing out jobs.`)) {
    await makeCaptain(state.code, teamId, b.dataset.captain);
  }
  return true;
}

// ---------------- placement ----------------
function currentShip(g, teamId) {
  const p = state.placing;
  const proto = fleetFor(g.settings).find((s) => s.id === p.shipId);
  if (!proto || !p.hover) return null;
  return { ...proto, dir: p.dir, r: p.hover[0], c: p.hover[1] };
}

// With crew roles on, only the captain places ships (anyone can if there's no captain yet)
const placer = (g, teamId) => !rolesOn(g) || !captainOf(g, teamId) || captainOf(g, teamId) === state.uid;

function renderPlacement(g, teamId) {
  const zone = zoneFor(teamIndex(teamId), g.settings);
  const fleet = (g.fleets && g.fleets[teamId]) || {};
  const protos = fleetFor(g.settings);
  if (!protos.some((s) => s.id === state.placing.shipId)) state.placing.shipId = protos[0].id;
  const ready = g.teams[teamId].ready;
  const mine = placer(g, teamId);
  const locked = ready || !mine;
  const cand = !locked && currentShip(g, teamId);

  renderOcean($("ocean"), g, {
    myTeam: teamId,
    activeZone: teamId,
    preview: cand ? { cells: shipCells(cand), ok: canPlace(fleet, cand, zone) } : null,
    onCell: locked ? null : (r, c) => placeAt(state.game, teamId, r, c),
    onHover: locked ? null : (r, c) => {
      const h = state.placing.hover;
      if (!h || h[0] !== r || h[1] !== c) { state.placing.hover = [r, c]; renderPlacement(state.game, teamId); }
    },
  });

  // the panel frame is built once; the parts inside are refreshed
  const panel = $("panel");
  const key = `placement:${teamId}`;
  if (panel.dataset.key !== key) {
    panel.dataset.key = key;
    panel.innerHTML = `<div id="place-box"></div><div id="crew-box"></div><h3>Teams</h3><ul class="teams" id="teams"></ul>`;
    panel.onclick = (e) => onPlacementClick(e, teamId);
    panel.onchange = (e) => onCrewChange(e, teamId);
    panel.onsubmit = null;
    panel.oninput = null;
  }

  const shipsHtml = protos.map((s) => {
    const placed = fleet[s.id];
    const sel = s.id === state.placing.shipId && !locked;
    const icon = placed && avatarOf(placed.icon);
    return `<li><button class="ship-pick ${sel ? "sel" : ""} ${placed ? "placed" : ""}" data-ship="${s.id}" ${locked ? "disabled" : ""}>
      <span class="ship-bar" style="--len:${s.len}"></span>${s.name}${icon ? ` <span class="ship-av" aria-hidden="true">${icon}</span>` : ""} <small>${s.len} squares${placed ? ", placed" : ""}</small></button></li>`;
  }).join("");
  const me = g.players[state.uid];
  const cap = rolesOn(g) && captainOf(g, teamId);
  const intro = !mine
    ? `<p class="hint">${ROLES.captain.icon} <strong>${escapeHtml(g.players[cap].name)}</strong> is your captain and places the fleet. Talk to them about where the ships should go!</p>`
    : `<p class="hint">Your home waters are the bright squares. Pick a ship, then tap where its ${state.placing.dir === "h" ? "left" : "top"} end goes. ${
      rolesOn(g) ? "Each ship carries a crew member's avatar. " : avatarOf(me.avatar) ? `Ships you place carry your avatar ${avatarOf(me.avatar)}. ` : ""}Your whole crew sees the same fleet.</p>`;

  $("place-box").innerHTML = `
    <h2>Place your fleet</h2>
    ${intro}
    <ul class="ship-list">${shipsHtml}</ul>
    ${mine ? `<div class="btn-row">
      <button class="btn" data-action="rotate" ${ready ? "disabled" : ""}>Rotate (${state.placing.dir === "h" ? "across" : "down"})</button>
      <button class="btn" data-action="random" ${ready ? "disabled" : ""}>Random</button>
    </div>
    <button class="btn primary wide" data-action="ready" ${fleetComplete(fleet, g.settings) ? "" : "disabled"}>
      ${ready ? "Unlock fleet" : "Lock in fleet"}</button>` : ""}
    <p class="hint">${ready ? "Locked in. Waiting for the other teams and your teacher." : fleetComplete(fleet, g.settings) ? "All ships placed. Lock in when your crew agrees." : `Place all ${protos.length} ships to lock in.`}</p>
    <button class="linkish" data-action="leave-team">Leave ${escapeHtml(g.teams[teamId].name)} and pick another crew</button>`;
  drawCrew(g, teamId);
  renderTeams($("teams"), g, teamId);
}

// Which avatars go on the ships: yours, or the whole crew's in turn when roles are on
function shipIcons(g, teamId) {
  const mine = avatarOf(g.players[state.uid].avatar);
  return [...new Set([mine, ...crewAvatars(g, teamId)].filter(Boolean))];
}

async function onPlacementClick(e, teamId) {
  const g = state.game;
  if (await onCrewClick(e, teamId)) return;
  const zone = zoneFor(teamIndex(teamId), g.settings);
  const shipBtn = e.target.closest("[data-ship]");
  if (shipBtn) { state.placing.shipId = shipBtn.dataset.ship; return renderPlacement(g, teamId); }
  const act = e.target.closest("[data-action]")?.dataset.action;
  if (act === "rotate") { state.placing.dir = state.placing.dir === "h" ? "v" : "h"; renderPlacement(g, teamId); }
  if (act === "random") {
    // share the ships out between the crew's avatars, starting with yours
    const next = randomFleet(zone, g.settings, shipIcons(g, teamId));
    if (next) await saveFleet(state.code, teamId, next);
    else toast("Couldn't fit the fleet. Try again.");
  }
  if (act === "ready") await setReady(state.code, teamId, !g.teams[teamId].ready);
  if (act === "leave-team") await leaveTeam(state.code, g, state.uid).catch((err) => toast(err.message));
}

async function placeAt(g, teamId, r, c) {
  const zone = zoneFor(teamIndex(teamId), g.settings);
  const fleet = (g.fleets && g.fleets[teamId]) || {};
  // tapping one of your ships picks it up for moving
  const onShip = Object.values(fleet).find((s) => shipCells(s).some(([a, b]) => a === r && b === c));
  if (onShip && onShip.id !== state.placing.shipId) {
    state.placing.shipId = onShip.id;
    state.placing.dir = onShip.dir;
    return renderPlacement(g, teamId);
  }
  const protos = fleetFor(g.settings);
  const proto = protos.find((s) => s.id === state.placing.shipId);
  const ship = { ...proto, dir: state.placing.dir, r, c };
  // with roles on, the captain places every ship, so each carries a different crew member's avatar
  const icons = rolesOn(g) ? crewAvatars(g, teamId) : [avatarOf(g.players[state.uid].avatar)].filter(Boolean);
  if (icons.length) ship.icon = icons[protos.indexOf(proto) % icons.length];
  if (!canPlace(fleet, ship, zone)) return toast("That ship doesn't fit there.");
  const next = protos.find((s) => !fleet[s.id] && s.id !== ship.id);
  if (next) state.placing.shipId = next.id;
  await saveFleet(state.code, teamId, { ...fleet, [ship.id]: ship });
}

// ---------------- battle ----------------
// The panel is built once, then only the live parts are refreshed,
// so a half-answered question or half-written code isn't wiped
// every time another team fires.
const TABS = [
  { id: "fire", label: () => t("tab_fire") },
  { id: "quiz", label: () => t("earn_shots"), mode: "quiz" },
  { id: "torpedo", label: () => t("tab_torpedo"), mode: "torpedo" },
  { id: "code", label: () => t("tab_code"), mode: "console" },
];

// A mode is on when the teacher has it on and the question set supports it
const modeOn = (g, mode) => modesOf(g)[mode] && modeAllowed(state.qset, mode);

const battle = {
  tab: "fire",
  weapon: "shot",   // "shot", "sonar" or "airstrike"
  quiz: { q: null, order: null, picked: null, lockUntil: 0, note: "" },
  torpedo: { puzzle: null, cell: null, result: null, readyAt: 0 },
  code: {
    text: '// Fire at C7 (column, row)\nFIRE("C", 7)\n\n// A loop fires one shot per turn:\n// FOR Row ← 2 TO 4\n//     FIRE("K", Row)\n// NEXT Row\n',
    log: [], running: false,
  },
};
const seenQuestions = new Set();

const EARN_LABEL = { shots: "earn_shots", sonar: "earn_sonar", airstrike: "earn_airstrike" };

// Weapons this player may use. With roles on: gunner fires, navigator sonar, scientist airstrike.
function myWeapons(g, teamId) {
  const jobs = jobsOf(g, teamId, state.uid);
  return ["shot", "sonar", "airstrike"].filter((w) => jobs.includes({ shot: "gunner", sonar: "navigator", airstrike: "scientist" }[w]));
}

// Suggested targets still worth firing at: { cellKey: [uid, ...] }
function liveSuggestions(g, teamId) {
  const out = {};
  if (!rolesOn(g)) return out;
  const members = new Set(crewOf(g, teamId));
  for (const [uid, sg] of Object.entries(g.teams[teamId].suggest || {})) {
    if (!members.has(uid)) continue;
    for (const [r, c] of sg.cells || []) {
      const k = cellKey(r, c);
      if (g.shots && g.shots[k]) continue;
      (out[k] = out[k] || []).push(uid);
    }
  }
  return out;
}

function renderBattle(g, teamId) {
  const team = g.teams[teamId];
  const kind = earnKind(g, state.uid);
  const tabs = TABS.filter((x) => !x.mode || modeOn(g, x.mode))
    .map((x) => ({ id: x.id, label: x.id === "quiz" ? t(EARN_LABEL[kind]) : x.label() }));
  if (!tabs.some((t) => t.id === battle.tab)) battle.tab = "fire";

  const tgt = state.target;
  if (tgt && g.shots && g.shots[cellKey(tgt[0], tgt[1])]) state.target = null;

  const pu = team.powerups || {};
  const weapons = myWeapons(g, teamId);
  if (!weapons.includes(battle.weapon) || (battle.weapon !== "shot" && !(pu[battle.weapon] > 0))) {
    battle.weapon = weapons.find((w) => (w === "shot" ? true : pu[w] > 0)) || weapons[0] || null;
  }
  let area = null;
  if (battle.tab === "fire" && state.target && battle.weapon === "sonar") area = sonarCells(...state.target, g.settings);
  if (battle.tab === "fire" && state.target && battle.weapon === "airstrike") area = airstrikeCells(...state.target, g.settings);

  renderOcean($("ocean"), g, {
    myTeam: teamId,
    selected: battle.tab === "fire" ? state.target : null,
    onCell: team.alive ? (r, c) => onChartTap(g, teamId, r, c) : null,
    intel: team.intel,
    area,
    suggest: Object.fromEntries(Object.entries(liveSuggestions(g, teamId)).map(([k, v]) => [k, v.length])),
  });

  const key = `battle:${teamId}:${team.alive}:${tabs.map((x) => x.id + x.label).join(",")}:${jobsOf(g, teamId, state.uid).join()}`;
  const panel = $("panel");
  if (panel.dataset.key !== key) {
    panel.dataset.key = key;
    panel.innerHTML = team.alive ? `
      <div class="ammo" id="ammo"></div>
      <div class="tabs" role="tablist">${tabs.map((x) =>
        `<button role="tab" class="tab" data-tab="${x.id}">${x.label}</button>`).join("")}</div>
      <div class="tab-body" id="tab-body"></div>
      <div id="crew-box"></div>
      <h3>Teams</h3><ul class="teams" id="teams"></ul>
      <h3>Battle log</h3><ol class="feed" id="feed"></ol>`
      : `<div class="sunk-note"><h2>Your fleet is sunk</h2><p>Keep watching. The chart updates live until one team is left.</p></div>
      <h3>Teams</h3><ul class="teams" id="teams"></ul>
      <h3>Battle log</h3><ol class="feed" id="feed"></ol>`;
    panel.onclick = (e) => onPanelClick(e, teamId);
    panel.onsubmit = (e) => onPanelSubmit(e, teamId);
    panel.oninput = (e) => { if (e.target.id === "code-input") battle.code.text = e.target.value; };
    panel.onchange = (e) => onCrewChange(e, teamId);
    if (team.alive) renderTab(g, teamId);
  }

  if (team.alive) {
    const max = g.settings.maxAmmo;
    $("ammo").innerHTML = `
      <span class="ammo-n">${team.ammo}</span><span class="ammo-l">shot${team.ammo === 1 ? "" : "s"} for your crew</span>
      <div class="shells">${Array.from({ length: max }, (_, i) => `<span class="shell ${i < team.ammo ? "full" : ""}"></span>`).join("")}</div>
      <div class="pu-count">${pu.sonar || 0} sonar, ${pu.airstrike || 0} airstrike${pu.airstrike === 1 ? "" : "s"}</div>
      ${rolesOn(g) ? `<div class="my-role">${jobsOf(g, teamId, state.uid).map((j) => `${ROLES[j].icon} ${ROLES[j].name}`).join(" + ") || ROLES.crew.icon + " Crew"}</div>` : ""}
      ${stormLine(g)}`;
    panel.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === battle.tab));
    if (battle.tab === "fire") updateFireBox(g, teamId);
  }
  if (team.alive) drawCrew(g, teamId);
  renderTeams($("teams"), g, teamId);
  renderFeed($("feed"), g);
}

function stormLine(g) {
  const lvl = g.storm || 0, max = maxStorm(g.settings);
  if (!lvl && !g.stormNextAt) return "";
  const next = g.stormNextAt && lvl < max ? Math.max(0, Math.round((g.stormNextAt - Date.now()) / 1000)) : null;
  const t = next !== null ? `${Math.floor(next / 60)}:${String(next % 60).padStart(2, "0")}` : null;
  const text = lvl
    ? `Storm ${lvl} of ${max}${t ? `, closes in again in ${t}` : ""}`
    : `Storm arrives in ${t}`;
  return `<div class="storm-line">${text}</div>`;
}

// Tapping the chart does something different on each tab
function onChartTap(g, teamId, r, c) {
  if (battle.tab === "code") {
    const box = $("code-input");
    const line = `FIRE("${colLabel(c)}", ${r + 1})\n`;
    const at = box.selectionStart ?? box.value.length;
    const before = box.value.slice(0, at);
    const pad = before && !before.endsWith("\n") ? "\n" : "";
    box.value = before + pad + line + box.value.slice(at);
    battle.code.text = box.value;
    box.focus();
    box.selectionStart = box.selectionEnd = at + pad.length + line.length;
    return;
  }
  if (battle.tab === "torpedo" && battle.torpedo.puzzle && battle.torpedo.puzzle.type === "square" && !battle.torpedo.result) {
    const input = $("torpedo-answer");
    if (input) input.value = cellName(r, c);
    return;
  }
  const needsFresh = battle.tab !== "fire" || battle.weapon === "shot";
  if (needsFresh && g.shots && g.shots[cellKey(r, c)]) return toast(`${cellName(r, c)} has already been hit.`);
  if (needsFresh && zoneOwner(r, c, g.settings) === teamId) return toast("That's your own waters.");
  state.target = [r, c];
  if (battle.tab !== "fire") { battle.tab = "fire"; renderTab(g, teamId); }
  render();
}

function renderTab(g, teamId) {
  const body = $("tab-body");
  if (!body) return;
  if (battle.tab === "fire") {
    body.innerHTML = `
      <div class="fire-box">
        <div class="weapons" role="radiogroup" aria-label="Weapon" id="weapons"></div>
        <span class="target-label">Target</span>
        <span class="target-cell" id="target-cell"></span>
        <button class="btn fire wide" data-action="fire" id="fire-btn">Fire</button>
        <button class="btn wide" data-action="suggest" id="suggest-btn" hidden>Suggest to the gunner</button>
        <p class="hint" id="weapon-help"></p>
        <div id="suggest-box"></div>
      </div>`;
    updateFireBox(g, teamId);
  }
  if (battle.tab === "quiz") renderQuiz(g);
  if (battle.tab === "torpedo") renderTorpedo(g);
  if (battle.tab === "code") renderCode(g);
  $("panel").querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === battle.tab));
}

function updateFireBox(g, teamId) {
  const team = g.teams[teamId];
  const pu = team.powerups || {};
  const cell = $("target-cell"), btn = $("fire-btn");
  if (!cell) return;
  const w = battle.weapon;
  const allowed = myWeapons(g, teamId);
  setHtml($("weapons"), [
    ["shot", "Shot", team.ammo],
    ["sonar", "Sonar", pu.sonar || 0],
    ["airstrike", "Airstrike", pu.airstrike || 0],
  ].filter(([id]) => allowed.includes(id))
    .map(([id, label, n]) => `<button role="radio" class="weapon" data-weapon="${id}" aria-checked="${w === id}" ${n > 0 ? "" : "disabled"}>
      ${label} <span>${n}</span></button>`).join(""));
  cell.textContent = state.target ? cellName(...state.target) : "None";
  btn.hidden = !w;
  if (w) {
    const wait = w === "shot" && g.settings.fireSecs > 0 ? fireWait(team) : 0;
    btn.textContent = wait ? `Crew reloading: ${wait}s` : w === "shot" ? "Fire" : POWERUPS[w].verb;
    const have = w === "shot" ? team.ammo > 0 : (pu[w] || 0) > 0;
    btn.disabled = !(state.target && have && !state.busy && !wait);
  }
  // anyone who isn't the gunner can suggest a target
  const roles = rolesOn(g);
  const gunner = !roles || allowed.includes("shot");
  const sBtn = $("suggest-btn");
  sBtn.hidden = gunner;
  sBtn.className = w ? "btn wide" : "btn primary wide";
  sBtn.disabled = !state.target;
  $("weapon-help").textContent = !roles
    ? (w === "shot" ? t("fire_help") : POWERUPS[w].help)
    : w === "shot" ? "You're the gunner. Tap a square, or pick one your crew suggested below, then fire."
    : w ? POWERUPS[w].help + " Or suggest the square to your gunner."
    : "Tap a square in enemy waters and suggest it to your gunner. Only the gunner can fire shots.";

  // the crew's suggestions, most votes first
  const box = $("suggest-box");
  if (!roles) { setHtml(box, ""); return; }
  const sug = Object.entries(liveSuggestions(g, teamId)).sort((a, b) => b[1].length - a[1].length);
  setHtml(box, sug.length
    ? `<h4>Crew suggestions</h4><div class="sug-list">${sug.map(([k, uids]) => {
        const [r, c] = k.split("_").map(Number);
        const who = uids.map((u) => avatarOf(g.players[u].avatar) || "⚓").join("");
        return `<button class="sug-pick ${state.target && cellKey(...state.target) === k ? "sel" : ""}" data-pick="${k}" title="${uids.map((u) => escapeHtml(g.players[u].name)).join(", ")}">
          <strong>${cellName(r, c)}</strong> <span>${who}</span></button>`;
      }).join("")}</div>
      ${g.teams[teamId].suggest && g.teams[teamId].suggest[state.uid] ? `<button class="linkish" data-action="unsuggest">Clear my suggestions</button>` : ""}`
    : `<p class="hint">No targets suggested yet.</p>`);
}

async function onPanelClick(e, teamId) {
  const g = state.game;
  if (await onCrewClick(e, teamId)) return;
  const pickBtn = e.target.closest("[data-pick]");
  if (pickBtn) {
    const [r, c] = pickBtn.dataset.pick.split("_").map(Number);
    state.target = [r, c];
    if (myWeapons(g, teamId).includes("shot")) battle.weapon = "shot";
    render(); return;
  }
  const tabBtn = e.target.closest("[data-tab]");
  if (tabBtn) { battle.tab = tabBtn.dataset.tab; renderTab(g, teamId); render(); return; }
  const weaponBtn = e.target.closest("[data-weapon]");
  if (weaponBtn) {
    battle.weapon = weaponBtn.dataset.weapon;
    // a plain shot can't go at a square that's already been hit
    if (battle.weapon === "shot" && state.target && ((g.shots && g.shots[cellKey(...state.target)]) || zoneOwner(...state.target, g.settings) === teamId)) state.target = null;
    render(); return;
  }
  const act = e.target.closest("[data-action]")?.dataset.action;
  if (!act) return;


  if (act === "suggest" && state.target) {
    const cells = [state.target, ...((g.teams[teamId].suggest || {})[state.uid]?.cells || [])
      .filter(([r, c]) => r !== state.target[0] || c !== state.target[1])];
    await suggestTargets(state.code, teamId, state.uid, cells);
    toast(`Suggested ${cellName(...state.target)} to your gunner.`);
    state.target = null; render(); return;
  }
  if (act === "unsuggest") { await suggestTargets(state.code, teamId, state.uid, []); return; }
  if (act === "fire" && state.target && battle.weapon) {
    state.busy = true; updateFireBox(g, teamId);
    try {
      if (battle.weapon === "shot") {
        sfx.fire();
        announce(await fire(state.code, g, teamId, ...state.target, state.uid));
      } else if (battle.weapon === "sonar") {
        sfx.sonar();
        const res = await useSonar(state.code, g, teamId, ...state.target);
        toast(res.found ? `Sonar contact! ${res.found} square${res.found === 1 ? "" : "s"} near ${res.cell} hide a ship.` : `Sonar around ${res.cell}: clear water.`, res.found ? "big" : "");
      } else {
        sfx.fire();
        const results = await useAirstrike(state.code, teamId, ...state.target, state.uid);
        const hits = results.filter((r) => r.hit);
        const sunk = results.find((r) => r.eliminated) || results.find((r) => r.sunk);
        if (sunk) announce(sunk);
        else if (hits.length) { toast(`Airstrike: ${hits.length} hit${hits.length === 1 ? "" : "s"}!`, "big"); sfx.hit(); }
        else { toast("Airstrike: all misses."); sfx.miss(); }
      }
    } catch (err) { toast(err.message); }
    state.target = null; state.busy = false; battle.weapon = myWeapons(g, teamId)[0] || null; render();
  }
  if (act === "next-q") nextQuestion();
  if (act === "answer") await answerQuestion(g, teamId, +e.target.closest("[data-opt]").dataset.opt);
  if (act === "launch") launchTorpedo(g, teamId);
  if (act === "arrow") insertAtCursor($("code-input"), " ← ");
  if (act === "run") await runCode(teamId);
  if (act === "clear-log") { battle.code.log = []; renderCode(state.game); }
}

async function onPanelSubmit(e, teamId) {
  e.preventDefault();
  if (e.target.id === "torpedo-form") await submitTorpedo(teamId);
}

function announce(res) {
  if (!res.hit) { toast(`Miss at ${res.cell}.`); sfx.miss(); }
  else if (res.eliminated) { toast(`Hit! You finished off ${res.eliminated}!`, "big"); sfx.sink(); }
  else if (res.sunk) { toast(`Hit! You sank a ${res.sunk.toLowerCase()}!`, "big"); sfx.sink(); }
  else { toast(`Hit at ${res.cell}!`, "big"); sfx.hit(); }
}

// ---------------- Earn shots (quiz) ----------------
// Half the questions come from the bank, half are freshly made trace questions
function nextQuestion() {
  let q;
  const set = state.qset;
  if (set.features.generated && Math.random() < 0.5) {
    q = makeQuestion();
  } else {
    // typed items are for torpedoes, so only multiple-choice ones appear here
    const all = set.questions.filter((x) => !isTyped(x));
    let pool = all.filter((x) => !seenQuestions.has(x.id));
    if (!pool.length) { seenQuestions.clear(); pool = all; }
    // in a whole-school event, each year gets a mix of levels that suits it
    const weights = levelWeightsFor(state.game, state.game && state.game.players && state.game.players[state.uid] && state.game.players[state.uid].team);
    const level = weights && pickLevel(weights, [...new Set(pool.map((x) => x.level))]);
    if (level) pool = pool.filter((x) => x.level === level);
    q = pool[Math.floor(Math.random() * pool.length)];
    seenQuestions.add(q.id);
  }
  const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
  Object.assign(battle.quiz, { q, order, picked: null, note: "" });
  renderQuiz(state.game);
}

function renderQuiz(g) {
  const body = $("tab-body");
  const Q = battle.quiz;
  if (!Q.q) { nextQuestion(); return; }
  const locked = Date.now() < Q.lockUntil;
  const reward = rewardFor(Q.q);
  const done = Q.picked !== null;
  const kind = earnKind(g, state.uid);
  const level = t("level_" + Q.q.level);
  const worth = kind === "shots" ? (reward === 1 ? t("q_worth_one") : t("q_worth_many", { n: reward }))
    : t("q_worth_" + kind);

  body.innerHTML = `
    <div class="quiz">
      <p class="q-level">${escapeHtml(level)}, ${escapeHtml(worth)}${Q.q.topic ? ` <span class="q-topic">· ${escapeHtml(Q.q.topic)}</span>` : ""}</p>
      ${Q.q.passage ? `<div class="passage" role="group" aria-label="${escapeHtml(t("q_passage"))}"><p>${escapeHtml(Q.q.passage)}</p></div>` : ""}
      ${Q.q.code ? `<pre class="code-view">${escapeHtml(Q.q.code.join("\n"))}</pre>` : ""}
      <p class="q-text">${escapeHtml(Q.q.q)}</p>
      <div class="options">${Q.order.map((i) => {
        let cls = "opt";
        if (done && i === Q.q.answer) cls += " right";
        else if (done && i === Q.picked) cls += " wrong";
        return `<button class="${cls}" data-action="answer" data-opt="${i}" ${done ? "disabled" : ""}>${escapeHtml(Q.q.options[i])}</button>`;
      }).join("")}</div>
      ${done ? `<p class="explain">${escapeHtml(Q.q.explain)}</p>` : ""}
      ${Q.note ? `<p class="q-note">${escapeHtml(Q.note)}</p>` : ""}
      ${done ? `<button class="btn primary wide" data-action="next-q" id="next-q" ${locked ? "disabled" : ""}>
        ${locked ? escapeHtml(t("q_nextIn", { n: "@@" })).replace("@@", `<span id="lock-left">${Math.ceil((Q.lockUntil - Date.now()) / 1000)}</span>`) : escapeHtml(t("q_next"))}</button>` : ""}
    </div>`;

  if (locked) {
    const tick = setInterval(() => {
      const left = Math.ceil((Q.lockUntil - Date.now()) / 1000);
      const span = $("lock-left"), btn = $("next-q");
      if (!span || !btn) return clearInterval(tick);
      if (left <= 0) { clearInterval(tick); btn.disabled = false; btn.textContent = t("q_next"); }
      else span.textContent = left;
    }, 250);
  }
}

// Generated questions (pseudocode set only) follow the same reward scale
const rewardFor = (q) => state.qset.rewards[q.level] || 1;

async function answerQuestion(g, teamId, opt) {
  const Q = battle.quiz;
  if (Q.picked !== null) return;
  Q.picked = opt;
  const correct = opt === Q.q.answer;
  if (correct) {
    Q.note = "";
    renderQuiz(g);
    sfx.correct();
    const { added, powerup, readyAt } = await recordAnswer(state.code, g, teamId, state.uid, true, rewardFor(Q.q), Q.q);
    const kind = earnKind(g, state.uid);
    if (kind !== "shots") {
      // navigator / scientist: one power-up, then a wait before the next can be earned
      if (readyAt) Q.lockUntil = Math.max(Q.lockUntil, readyAt);
      const name = t("power_" + kind);
      Q.note = powerup ? t("q_power", { power: name }) : t("q_recharge", { power: name });
      if (powerup) { toast(`+1 ${POWERUPS[kind].name}!`, "big"); sfx.power(); }
    } else {
    Q.note = added ? (added === 1 ? t("q_shots_one") : t("q_shots_many", { n: added })) : t("q_full");
    if (powerup) {
      Q.note += t("q_streak", { power: t("power_" + powerup) });
      toast(`Power-up: ${POWERUPS[powerup].name}!`, "big");
      sfx.power();
    } else if (added) toast(`+${added} shot${added === 1 ? "" : "s"}!`, "big");
    }
  } else {
    Q.lockUntil = Date.now() + 10000;
    Q.note = t("q_wrong");
    sfx.wrong();
    recordAnswer(state.code, g, teamId, state.uid, false, 0, Q.q);
  }
  if (battle.tab === "quiz") renderQuiz(g);
}

// ---------------- Torpedo (solve the code, never misses) ----------------
// A torpedo locks on to a real enemy ship square when it's loaded.
// Solve its puzzle and it hits. There are three kinds of puzzle:
//   square  trace the code to find the square it outputs
//   output  trace the code and type what it outputs
//   blank   find the missing number that gives the output shown
const TORPEDO_KINDS = { square: "Find the square", output: "Predict the output", blank: "Fill the gap" };

// Sets that don't generate code puzzles use their own typed questions for torpedoes
const seenTyped = new Set();
const torpedoTyped = () => !state.qset.features.generated && state.qset.questions.some(isTyped);

function renderTorpedo(g) {
  const body = $("tab-body");
  const T = battle.torpedo;
  const wait = Math.ceil((T.readyAt - Date.now()) / 1000);

  if (!T.puzzle) {
    body.innerHTML = `
      <div class="torpedo">
        <p>${t(torpedoTyped() ? "torp_introTyped" : "torp_intro")}</p>
        <button class="btn primary wide" data-action="launch" id="launch-btn" ${wait > 0 ? "disabled" : ""}>
          ${wait > 0 ? escapeHtml(t("torp_reloading", { n: "@@" })).replace("@@", `<span id="torp-left">${wait}</span>`) : escapeHtml(t("torp_load"))}</button>
      </div>`;
    if (wait > 0) {
      const tick = setInterval(() => {
        const left = Math.ceil((T.readyAt - Date.now()) / 1000);
        const span = $("torp-left"), btn = $("launch-btn");
        if (!span || !btn) return clearInterval(tick);
        if (left <= 0) { clearInterval(tick); btn.disabled = false; btn.textContent = t("torp_load"); }
        else span.textContent = left;
      }, 250);
    }
    return;
  }

  const P = T.puzzle;
  const typed = P.type === "typed";
  const hint = P.type === "square" ? "Trace the code. Which square does it output? Type it, or tap it on the chart." : P.prompt;
  body.innerHTML = `
    <div class="torpedo">
      <p class="q-level">${typed ? `${escapeHtml(t("torp_typedTitle"))}${P.topic ? ` <span class="q-topic">· ${escapeHtml(P.topic)}</span>` : ""}` : `Torpedo puzzle: ${TORPEDO_KINDS[P.type]}`}</p>
      ${typed ? "" : `<pre class="code-view">${escapeHtml(P.code)}</pre>`}
      <p class="q-text">${escapeHtml(hint)}</p>
      ${T.result ? `<p class="${T.result.ok ? "q-note ok" : "q-note"}">${escapeHtml(T.result.text)}</p>
        ${T.result.explain ? `<p class="explain">${escapeHtml(T.result.explain)}</p>` : ""}
        <button class="btn wide" data-action="launch" ${wait > 0 ? "disabled" : ""}>${escapeHtml(wait > 0 ? t("torp_nextIn", { n: wait }) : t("torp_loadAnother"))}</button>`
      : `<form id="torpedo-form" class="inline">
          <input id="torpedo-answer" class="${P.type === "square" ? "square" : ""}" maxlength="${P.type === "square" ? 3 : typed ? 60 : 24}"
            placeholder="${typed ? escapeHtml(t("torp_placeholder")) : P.type === "square" ? "K7" : P.type === "blank" ? "Number" : "Output"}" aria-label="${escapeHtml(t("torp_placeholder"))}" autocomplete="off"
            ${P.type === "blank" ? 'inputmode="numeric"' : ""} ${typed ? 'autocapitalize="none"' : 'autocapitalize="characters"'} spellcheck="false">
          <button class="btn fire" type="submit">${escapeHtml(t("torp_launch"))}</button>
        </form>`}
    </div>`;
  if (T.result && wait > 0) setTimeout(() => { if (battle.tab === "torpedo") renderTorpedo(state.game); }, wait * 1000 + 50);
}

function launchTorpedo(g, teamId) {
  const T = battle.torpedo;
  if (Date.now() < T.readyAt) return;
  const crewWait = g.settings.crewTorpedoSecs > 0 ? Math.ceil(((g.teams[teamId].nextTorpedoAt || 0) - serverNow()) / 1000) : 0;
  if (crewWait > 0) return toast(`Your crew just launched a torpedo. Load another in ${crewWait}s.`);
  const targets = torpedoTargets(g, teamId);
  if (!targets.length) return toast("There are no enemy ships left to lock on to.");
  T.cell = targets[Math.floor(Math.random() * targets.length)];
  const roll = Math.random();
  if (torpedoTyped()) {
    // the set's own typed questions, never repeating one until they've all been used
    const all = state.qset.questions.filter(isTyped);
    let pool = all.filter((x) => !seenTyped.has(x.id));
    if (!pool.length) { seenTyped.clear(); pool = all; }
    const q = pool[Math.floor(Math.random() * pool.length)];
    seenTyped.add(q.id);
    T.puzzle = { type: "typed", prompt: q.q, topic: q.topic, answer: q.accept[0], explain: q.explain, check: (v) => checkTyped(q, v) };
  } else if (roll < 0.4) {
    const { cols } = gridSize(g.settings);
    const t = makeTorpedo(...T.cell, cols);
    T.puzzle = { type: "square", code: t.code, answer: t.answer, check: (v) => normaliseCell(v) === t.answer };
  } else {
    T.puzzle = roll < 0.75 ? makeOutputPuzzle() : makeBlankPuzzle();
  }
  T.result = null;
  renderTorpedo(g);
}

async function submitTorpedo(teamId) {
  const T = battle.torpedo;
  const P = T.puzzle;
  const guess = $("torpedo-answer").value.trim();
  if (!guess) return;
  T.readyAt = Date.now() + (state.game.settings.torpedoSecs || 30) * 1000;
  if (!P.check(guess)) {
    T.result = {
      ok: false,
      text: P.type === "typed" ? t("torp_lost", { answer: P.answer, guess })
        : P.type === "blank"
        ? `${guess} doesn't give that output. The torpedo is lost.`
        : `The code outputs ${P.answer}, not ${guess}. The torpedo is lost.`,
      explain: P.explain || "",
    };
    sfx.wrong();
    renderTorpedo(state.game);
    return;
  }
  // The locked-on square may have been hit by someone else meanwhile: home in on another ship square
  const g = state.game;
  let [r, c] = T.cell;
  let moved = false;
  if (g.shots && g.shots[cellKey(r, c)]) {
    const targets = torpedoTargets(g, teamId);
    if (!targets.length) {
      T.result = { ok: false, text: "Correct! But there are no enemy ships left to hit." };
      if (battle.tab === "torpedo") renderTorpedo(g);
      return;
    }
    [r, c] = targets[Math.floor(Math.random() * targets.length)];
    moved = true;
  }
  try {
    sfx.fire();
    const res = await fire(state.code, g, teamId, r, c, state.uid, { free: true, via: "torpedo" });
    announce(res);
    T.result = {
      ok: true,
      text: `Correct! Torpedo away${moved ? `. Its first target was already hit, so it homed in on ${res.cell} instead` : ` to ${res.cell}`}: ${res.hit ? "direct hit!" : "a miss."}`,
    };
  } catch (err) {
    T.result = { ok: false, text: `Correct, but ${err.message.charAt(0).toLowerCase() + err.message.slice(1)}` };
  }
  if (battle.tab === "torpedo") renderTorpedo(state.game);
}

// ---------------- Code console ----------------
function renderCode() {
  const body = $("tab-body");
  const C = battle.code;
  body.innerHTML = `
    <div class="console">
      <p class="hint">${canFireCode() ? "Write pseudocode that uses FIRE(column, row). Each FIRE uses one shot. Tap the chart to add a FIRE line."
        : "Write pseudocode that uses FIRE(column, row). You're not the gunner, so your first 5 FIRE squares are suggested to the gunner instead. Tap the chart to add a FIRE line."}</p>
      <textarea id="code-input" spellcheck="false" autocapitalize="off" autocomplete="off" rows="9" aria-label="Your pseudocode">${escapeHtml(C.text)}</textarea>
      <div class="btn-row">
        <button class="btn" data-action="arrow" title="Insert the assignment arrow">←</button>
        <button class="btn fire run" data-action="run" ${C.running ? "disabled" : ""}>${C.running ? "Running…" : canFireCode() ? "Run" : "Run and suggest"}</button>
      </div>
      ${C.log.length ? `<ol class="console-log">${C.log.map((l) => `<li class="log-${l.kind}">${escapeHtml(l.text)}</li>`).join("")}</ol>
        <button class="linkish" data-action="clear-log">Clear output</button>` : ""}
    </div>`;
}

function canFireCode() {
  const g = state.game;
  const teamId = g.players[state.uid].team;
  return !rolesOn(g) || jobsOf(g, teamId, state.uid).includes("gunner");
}

function insertAtCursor(box, text) {
  const at = box.selectionStart ?? box.value.length;
  box.value = box.value.slice(0, at) + text + box.value.slice(box.selectionEnd ?? at);
  battle.code.text = box.value;
  box.focus();
  box.selectionStart = box.selectionEnd = at + text.length;
}

async function runCode(teamId) {
  const C = battle.code;
  const g = state.game;
  const { cols, rows } = gridSize(g.settings);
  C.log = [];
  let result;
  try {
    result = runPseudo(C.text, { cols, rows });
  } catch (err) {
    C.log.push({ kind: "err", text: err.message + " Nothing was fired." });
    return renderCode();
  }
  result.outputs.forEach((o) => C.log.push({ kind: "out", text: o }));
  if (!result.fires.length) {
    C.log.push({ kind: "info", text: "The program ran, but it has no FIRE commands." });
    return renderCode();
  }

  if (!canFireCode()) {
    const cells = [];
    for (const f of result.fires) if (!cells.some(([r, c]) => r === f.r && c === f.c) && cells.length < 5) cells.push([f.r, f.c]);
    await suggestTargets(state.code, teamId, state.uid, cells);
    C.log.push({ kind: "info", text: `Suggested to your gunner: ${cells.map((c) => cellName(...c)).join(", ")}${result.fires.length > 5 ? " (only the first 5 squares are sent)" : ""}.` });
    return renderCode();
  }
  C.running = true; renderCode();
  for (const f of result.fires) {
    const where = cellName(f.r, f.c);
    if (state.game.teams[teamId].ammo <= 0) {
      C.log.push({ kind: "err", text: `Out of shots at ${where} (line ${f.line}). The rest didn't fire.` });
      break;
    }
    try {
      const res = await fire(state.code, state.game, teamId, f.r, f.c, state.uid, { via: "code" });
      C.log.push({ kind: res.hit ? "hit" : "miss", text: `${where}: ${res.hit ? (res.sunk ? `hit, sank a ${res.sunk.toLowerCase()}!` : "hit!") : "miss"}` });
      if (res.hit) announce(res);
    } catch (err) {
      C.log.push({ kind: "info", text: `${where} skipped (line ${f.line}): ${err.message}` });
    }
    renderCode();
  }
  C.running = false;
  if (battle.tab === "code") renderCode();
}

// ---------------- finished ----------------
// Leave the finished game and go back to the join screen (name stays filled in)
function leaveGame() {
  if (state.stop) state.stop();
  Object.assign(state, { code: null, game: null, stop: null, target: null, busy: false, qset: null, qsetKey: "" });
  Object.assign(seen, { shots: null, storm: 0, won: false, jobs: null, suggest: null });
  Object.assign(battle, { tab: "fire", weapon: "shot" });
  Object.assign(battle.torpedo, { puzzle: null, cell: null, result: null, readyAt: 0 });
  battle.quiz.lockUntil = 0;
  battle.code.log = [];
  store.set("bs_code", "");
  const panel = $("panel");
  panel.dataset.key = "";
  panel.innerHTML = "";
  panel.onclick = null;
  $("ocean").innerHTML = "";
  $("who").innerHTML = "";
  $("join-code").value = "";
  $("join-name").value = store.get("bs_name") || "";
  showMsg("");
  show("join");
  $("join-code").focus();
}

function renderFinished(g, teamId) {
  renderOcean($("ocean"), g, { myTeam: teamId, revealAll: true });
  const w = g.winner && g.teams[g.winner];
  const isComp = isCompetition(g);
  const rNum = currentRoundNum(g);
  const isFinal = isGrandFinal(g);
  const standings = isComp ? getAccumulatedStandings(g) : [];
  const myStanding = standings.find((s) => s.teamId === teamId);

  let bannerHtml = "";
  if (isComp) {
    if (isFinal) {
      bannerHtml = `<div class="winner" style="--tc:${w ? w.color : "var(--ink)"}">
        <h2>🏆 CHMS BSB ULTIMATE CHAMPION!</h2>
        <p class="big"><strong>${w ? escapeHtml(w.name) : "Champion"}</strong> wins the Grand Finals!</p>
        <p>${w && g.winner === teamId ? "⭐ YOUR CREW WINS THE ENTIRE BATTLE ROYALE COMPETITION! ⭐" : "The Grand Finals have concluded. Spectacular effort by all year teams!"}</p>
      </div>`;
    } else if (rNum < 3) {
      bannerHtml = `<div class="winner" style="--tc:${w ? w.color : "var(--ink)"}">
        <h2>Round ${rNum} Finished!</h2>
        <p>${w ? `<strong>${escapeHtml(w.name)}</strong> won Round ${rNum}.` : "Round complete."}</p>
        <div class="intermission-box">
          <p>⚡ <strong>Round ${rNum + 1} of 3 is starting soon!</strong></p>
          <p class="hint">Keep this tab open. Your teacher will open fleet placement for the next round without you needing to re-enter any code.</p>
        </div>
      </div>`;
    } else {
      const myYear = (g.teams[teamId] && g.teams[teamId].year) || "Year";
      const isTop = myStanding && myStanding.isYearTop;
      bannerHtml = `<div class="winner" style="--tc:${w ? w.color : "var(--ink)"}">
        <h2>Preliminaries Concluded!</h2>
        <p>Best of 3 accumulated scores are locked in.</p>
        ${isTop ? `<div class="qualify-celebrate">🎉 <strong>CONGRATULATIONS!</strong> Your crew is Champion of ${myYear} and advances to the <strong>GRAND FINALS</strong>! Get ready!</div>` : `<p>Top qualifiers from Year 7, 8, 9 &amp; 10 advance to the Grand Finals arena!</p>`}
      </div>`;
    }
  } else {
    bannerHtml = `<div class="winner" style="--tc:${w ? w.color : "var(--ink)"}">
      <h2>${w ? `${escapeHtml(w.name)} win!` : "Game over"}</h2>
      <p>${w && g.winner === teamId ? "Your crew is the last fleet afloat." : "Every ship is now shown on the chart."}</p>
    </div>`;
  }

  let standingsHtml = "";
  if (isComp) {
    standingsHtml = `<div class="student-standings-card">
      <h3>🏆 Tournament Standings (Accumulated Points)</h3>
      <table class="standings-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Year</th>
            <th>R1</th>
            <th>R2</th>
            <th>R3</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map((s, idx) => `
            <tr class="${s.teamId === teamId ? "me-row" : ""}" style="--tc:${s.color}">
              <td>#${idx + 1}</td>
              <td><span class="pennant"></span>${escapeHtml(s.name)}${s.teamId === teamId ? " (you)" : ""}</td>
              <td><span class="year-badge">${s.year}</span></td>
              <td>${s.r1}</td>
              <td>${s.r2}</td>
              <td>${s.r3}</td>
              <td><strong>${s.totalScore}</strong></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>`;
  }

  // A whole-school event: the year champions move on to a separate final game
  const comp = g.competition || {};
  const inEvent = !!(g.settings && g.settings.eventId);
  const finalCode = !isFinal && comp.champion === teamId && comp.finalCode;
  const nextStep = finalCode
    ? `<button class="btn primary wide" data-action="join-final">🏆 Join the Grand Final</button>`
    : inEvent && !isFinal
      ? `<p class="hint">${comp.champion ? "Well played! Watch the Grand Final on the big screen." : rNum < 3 ? `Keep your device ready for Round ${rNum + 1}.` : "Your teacher is confirming the results. Keep this page open."}</p>`
      : isComp && rNum < 3
        ? `<p class="hint">Keep your devices ready for Round ${rNum + 1}.</p>`
        : `<button class="btn primary wide" data-action="leave">Join a new game</button>`;

  $("panel").innerHTML = `
    ${bannerHtml}
    ${standingsHtml}
    ${nextStep}
    <h3>Teams</h3><ul class="teams" id="teams"></ul>
    <h3>Battle log</h3><ol class="feed" id="feed"></ol>`;

  renderTeams($("teams"), g, teamId);
  renderFeed($("feed"), g);
  $("panel").onclick = (e) => {
    if (e.target.closest('[data-action="leave"]')) leaveGame();
    if (e.target.closest('[data-action="join-final"]')) {
      const name = g.players[state.uid].name;
      leaveGame();
      tryJoin(finalCode, name, false);
    }
  };
}

// ---------------- toast ----------------
let toastTimer = null;
function toast(text, kind = "") {
  const el = $("toast");
  el.textContent = text;
  el.className = "toast show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = "toast"), 2600);
}
