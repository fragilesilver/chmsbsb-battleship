// ============================================================
//  projector.js  -  the big-screen view for the class TV.
//  Read-only: shows the ocean without anyone's hidden ships.
// ============================================================
import { ensureSignedIn, watchGame, gameExists } from "./firebase.js";
import { maxStorm, fleetComplete, avatarOf, YEAR_GROUPS, isCompetition, currentRoundNum, isGrandFinal, getAccumulatedStandings } from "./game.js";
import { renderOcean, renderTeams, renderFeed, escapeHtml } from "./board.js";
import { sfx, muteButton } from "./sound.js";

const $ = (id) => document.getElementById(id);
const state = { code: null, game: null, stop: null, feedSeen: null, qrFor: null, view: "ocean" };
const baseUrl = location.href.replace(/projector\.html.*$/, "");

muteButton($("mute"));
document.addEventListener("pointerdown", () => $("sound-hint").remove(), { once: true });

const params = new URLSearchParams(location.search);
ensureSignedIn().then(async () => {
  const code = (params.get("code") || "").toUpperCase();
  if (code && (await gameExists(code))) open(code);
  else $("screen-code").hidden = false;
});

$("code-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("code-input").value.trim().toUpperCase();
  if (await gameExists(code)) open(code);
  else $("code-msg").textContent = `No game with code ${code}.`;
});

function open(code) {
  state.code = code;
  history.replaceState(null, "", `?code=${code}`);
  $("screen-code").hidden = true;
  if (state.stop) state.stop();
  state.stop = watchGame(code, (g) => { state.game = g; render(); });
}

function show(which) {
  $("screen-lobby").hidden = which !== "lobby";
  $("screen-battle").hidden = which !== "battle";
}

function render() {
  const g = state.game;
  if (!g) return;
  playFeedSounds(g);

  const isComp = isCompetition(g);
  const rNum = currentRoundNum(g);
  const isFinal = isGrandFinal(g);
  const comp = g.competition || {};

  // Update top HUD
  if ($("proj-stage-badge")) {
    $("proj-stage-badge").textContent = isFinal ? "🏆 GRAND FINALS" : `Round ${rNum} of ${comp.totalRounds || 3}`;
    if (isFinal) $("proj-stage-badge").classList.add("gold");
  }

  // Update Match Timer
  if ($("proj-match-timer")) {
    if (g.competition && g.competition.roundEndsAt && g.phase === "battle") {
      const leftSecs = Math.max(0, Math.round((g.competition.roundEndsAt - Date.now()) / 1000));
      const m = Math.floor(leftSecs / 60);
      const s = String(leftSecs % 60).padStart(2, "0");
      $("proj-match-timer").textContent = `${m}:${s}`;
      if (leftSecs <= 60) $("proj-match-timer").classList.add("urgent");
      else $("proj-match-timer").classList.remove("urgent");
    } else {
      $("proj-match-timer").textContent = "--:--";
      $("proj-match-timer").classList.remove("urgent");
    }
  }

  $("proj-join").innerHTML = g.phase === "battle" || g.phase === "finished"
    ? `Join at <strong>${escapeHtml(baseUrl.replace(/^https?:\/\//, ""))}</strong> with code <strong>${state.code}</strong>`
    : "";

  if (g.phase === "lobby" || g.phase === "placement") return renderLobby(g);
  show("battle");
  updateViewMode();

  renderOcean($("ocean"), g, { revealAll: g.phase === "finished" });
  renderTeams($("teams"), g, null);
  renderFeed($("feed"), g);
  renderStorm(g);

  // Render Mini & Full Leaderboards
  renderProjectorStandings(g);

  const banner = $("winner");
  const w = g.phase === "finished" && g.winner && g.teams[g.winner];
  banner.hidden = !(g.phase === "finished");
  if (g.phase === "finished") {
    banner.style.setProperty("--tc", w ? w.color : "var(--ink)");
    if (isFinal) {
      banner.innerHTML = `<div class="podium-banner">
        <span class="trophy-icon">🏆</span>
        <h2>CHMS BSB BATTLE ROYALE CHAMPION</h2>
        <h1>${escapeHtml(w ? w.name : "Grand Finals Champion")}</h1>
        <p>Victory in the Ultimate Year 7, 8, 9 &amp; 10 Showdown!</p>
      </div>`;
    } else {
      banner.innerHTML = w
        ? `<span class="pennant"></span><strong>${escapeHtml(w.name)} win Round ${rNum}!</strong> <span>Scores accumulated. Next round up shortly!</span>`
        : `<strong>Round ${rNum} Over</strong>`;
    }
  }
}

function renderProjectorStandings(g) {
  const standings = getAccumulatedStandings(g);
  const rNum = currentRoundNum(g);
  const isFinal = isGrandFinal(g);

  // Full Screen Standings Table
  if ($("psv-table-wrap")) {
    $("psv-table-wrap").innerHTML = `<table class="standings-table big-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Team</th>
          <th>Division</th>
          <th>Round 1</th>
          <th>Round 2</th>
          <th>Round 3</th>
          <th>Live Round</th>
          <th>Accumulated Total</th>
          <th>Qualification Status</th>
        </tr>
      </thead>
      <tbody>
        ${standings.map((s, idx) => {
          const yrObj = YEAR_GROUPS.find((y) => y.id === s.year);
          const yrLabel = yrObj ? yrObj.name : s.year;
          return `<tr style="--tc:${s.color}">
            <td><strong class="rank-badge">#${idx + 1}</strong></td>
            <td><span class="pennant"></span><strong class="team-name-big">${escapeHtml(s.name)}</strong></td>
            <td><span class="year-badge">${yrLabel}</span></td>
            <td>${s.r1}</td>
            <td>${s.r2}</td>
            <td>${s.r3}</td>
            <td>${s.liveRoundScore}</td>
            <td><strong class="total-pts-big">${s.totalScore} pts</strong></td>
            <td>
              ${s.isYearTop ? '<span class="qual-badge-big">⭐ Top in ' + s.year + ' (Finals Bound)</span>' : ''}
              ${s.alive ? `<span class="stat-afloat">${s.afloat} ships afloat</span>` : '<span class="stat-out">Fleet Sunk</span>'}
            </td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;
  }

  // Mini Leaderboard on Ocean View sidebar
  if ($("proj-mini-leaderboard")) {
    $("proj-mini-leaderboard").innerHTML = `<div class="mini-lead-box">
      <h4>🏆 Accumulated Points</h4>
      <ol class="mini-lead-list">
        ${standings.slice(0, 4).map((s, i) => `
          <li style="--tc:${s.color}">
            <span class="ml-rank">#${i+1}</span>
            <span class="ml-name">${escapeHtml(s.name)}</span>
            <span class="ml-pts">${s.totalScore} pts</span>
          </li>`).join("")}
      </ol>
    </div>`;
  }
}

function renderLobby(g) {
  show("lobby");
  $("lj-url").textContent = baseUrl.replace(/^https?:\/\//, "");
  $("lj-code").textContent = state.code;
  if (state.qrFor !== state.code && window.QRCode) {
    $("qr").innerHTML = "";
    new window.QRCode($("qr"), { text: `${baseUrl}?code=${state.code}`, width: 220, height: 220, colorDark: "#14324a", colorLight: "#f7fafb" });
    state.qrFor = state.code;
  }

  const players = Object.values(g.players || {});
  const ids = Object.keys(g.teams);
  const ready = ids.filter((id) => g.teams[id].ready && fleetComplete(g.fleets && g.fleets[id], g.settings)).length;
  $("lobby-status").textContent = g.phase === "lobby"
    ? `${players.length} sailor${players.length === 1 ? "" : "s"} aboard`
    : `Placing fleets: ${ready} of ${ids.length} crews locked in`;

  $("lobby-teams").innerHTML = Object.entries(g.teams).map(([id, t]) => {
    const crew = players.filter((p) => p.team === id).map((p) => (avatarOf(p.avatar) ? avatarOf(p.avatar) + " " : "") + escapeHtml(p.name));
    const locked = g.phase === "placement" && t.ready && fleetComplete(g.fleets && g.fleets[id], g.settings);
    return `<div class="lobby-team" style="--tc:${t.color}">
      <h3><span class="pennant"></span>${escapeHtml(t.name)}${locked ? ' <span class="locked">locked in</span>' : ""}</h3>
      <p>${crew.join(", ") || "Waiting for crew"}</p></div>`;
  }).join("");
}

function renderStorm(g) {
  const lvl = g.storm || 0, max = maxStorm(g.settings);
  const el = $("proj-storm");
  if (g.phase !== "battle" || (!lvl && !g.stormNextAt)) { el.innerHTML = ""; return; }
  const secs = g.stormNextAt && lvl < max ? Math.max(0, Math.round((g.stormNextAt - Date.now()) / 1000)) : null;
  const t = secs !== null ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}` : null;
  el.innerHTML = `<span class="ps-level">${lvl ? `Storm ${lvl} of ${max}` : "Storm arrives"}</span>` +
    (t ? `<span class="ps-time">${lvl ? "closes in again in " : "in "}${t}</span>` : "");
}
setInterval(() => { if (state.game) renderStorm(state.game); }, 1000);

// Play a sound for each new event in the battle log
function playFeedSounds(g) {
  const feed = g.feed || {};
  if (!state.feedSeen) { state.feedSeen = new Set(Object.keys(feed)); return; }
  const fresh = Object.entries(feed).filter(([k]) => !state.feedSeen.has(k));
  fresh.forEach(([k]) => state.feedSeen.add(k));
  const types = new Set(fresh.map(([, f]) => f.type));
  if (types.has("win")) sfx.win();
  else if (types.has("out") || types.has("sink")) sfx.sink();
  else if (types.has("storm")) sfx.storm();
  else if (types.has("hit")) sfx.hit();
  else if (types.has("power")) sfx.power();
}

if ($("proj-toggle-view")) {
  $("proj-toggle-view").onclick = () => {
    state.view = state.view === "ocean" ? "standings" : "ocean";
    $("proj-toggle-view").textContent = state.view === "ocean" ? "Leaderboard" : "Ocean Map";
    updateViewMode();
  };
}

function updateViewMode() {
  if ($("proj-view-ocean")) $("proj-view-ocean").hidden = state.view !== "ocean";
  if ($("proj-view-standings")) $("proj-view-standings").hidden = state.view !== "standings";
}
