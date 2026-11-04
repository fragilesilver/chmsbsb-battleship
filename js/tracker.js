// ============================================================
//  tracker.js  -  turns live games into event results.
//  Pure functions (no Firebase and no page), so they can be tested on their own.
//  `games` is always { Y7: game, Y8: game, ..., final: game }.
// ============================================================
import { YEAR_GROUPS, getAccumulatedStandings, isGrandFinal } from "./game.js";

const DIVISION_ORDER = [...YEAR_GROUPS.map((y) => y.id), "final"];
export const divisionName = (id) =>
  (id === "final" ? "Grand Final" : (YEAR_GROUPS.find((y) => y.id === id) || { name: id }).name);
const playedDivisions = (games) => DIVISION_ORDER.filter((d) => games[d]);

// Where a division has got to, in words
export function divisionStatus(g) {
  if (!g) return "Loading";
  const comp = g.competition || {};
  if (comp.stage === "complete") return "Complete";
  const round = isGrandFinal(g) ? "Grand Final" : `Round ${comp.currentRound || 1} of ${comp.totalRounds || 3}`;
  const phase = { lobby: "crews joining", placement: "placing fleets", battle: "in battle", finished: "round over" }[g.phase] || g.phase;
  return `${round}, ${phase}`;
}

// Which next steps a dashboard can offer for this division right now
export function divisionAction(g) {
  if (!g) return null;
  const comp = g.competition || {};
  if (g.phase === "lobby") return "placement";
  if (g.phase === "placement") return "battle";
  if (g.phase === "battle") return "end";
  if (g.phase !== "finished" || isGrandFinal(g) || comp.stage === "complete") return null;
  return (comp.currentRound || 1) >= (comp.totalRounds || 3) ? "finalise" : "next-round";
}

// The final can start once every playing year has a champion (and there are at least two)
export function finalReady(event, games) {
  if (!event || event.finalCode) return false;
  const years = Object.keys(event.divisions || {});
  const champions = event.champions || {};
  return years.length >= 2 && years.every((y) => champions[y] && games[y]);
}

// The event's overall winner, once there is one: { name, from } or null
export function overallWinner(event, games) {
  if (!event) return null;
  const finalGame = games.final;
  if (finalGame && finalGame.phase === "finished" && finalGame.winner && finalGame.teams[finalGame.winner]) {
    return { name: finalGame.teams[finalGame.winner].name, from: "Grand Final" };
  }
  const years = Object.keys(event.divisions || {});
  const only = years.length === 1 && event.champions && event.champions[years[0]];
  return only ? { name: only.name, from: divisionName(years[0]) } : null;
}

// ---------- topic analytics ----------
const pct = (right, wrong) => (right + wrong ? Math.round((right / (right + wrong)) * 100) : null);

// Returns { divisions, rows }. Rows are weakest first, and each has a cell per division.
export function topicTable(games) {
  const divisions = playedDivisions(games);
  const byTopic = new Map();
  for (const d of divisions) {
    const topics = (games[d].stats && games[d].stats.topics) || {};
    for (const [topic, c] of Object.entries(topics)) {
      if (!byTopic.has(topic)) byTopic.set(topic, { topic, right: 0, wrong: 0, cells: {} });
      const row = byTopic.get(topic);
      const right = c.correct || 0, wrong = c.wrong || 0;
      row.right += right;
      row.wrong += wrong;
      row.cells[d] = { right, wrong, pct: pct(right, wrong) };
    }
  }
  const rows = [...byTopic.values()]
    .map((r) => ({ ...r, pct: pct(r.right, r.wrong), answered: r.right + r.wrong }))
    .sort((a, b) => (a.pct - b.pct) || a.topic.localeCompare(b.topic));
  return { divisions, rows };
}

// ---------- CSV ----------
// Spreadsheets run any cell starting with = + - or @ as a formula. Team names are
// typed by people, so those get a leading apostrophe. Plain numbers stay as numbers.
export function csvCell(value) {
  if (typeof value === "number") return String(value);
  let s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

export function standingsRows(games, event) {
  const rows = [["Division", "Rank", "Team", "Round 1", "Round 2", "Round 3", "Total points", "Right answers", "Wrong answers", "Accuracy %", "Ships sunk", "Result"]];
  for (const d of playedDivisions(games)) {
    const g = games[d];
    const champ = event && event.champions && event.champions[d];
    getAccumulatedStandings(g).forEach((s, i) => {
      const result = d === "final"
        ? (g.phase === "finished" && g.winner === s.teamId ? "Overall champion" : "")
        : (champ && champ.team === s.teamId ? "Year champion" : "");
      rows.push([divisionName(d), i + 1, s.name, s.r1, s.r2, s.r3, s.totalScore, s.correct, s.wrong, s.accuracy, s.sunkCount, result]);
    });
  }
  return rows;
}

export function topicRows(games) {
  const { divisions, rows } = topicTable(games);
  const head = ["Topic", "Answers", "Overall % right", ...divisions.map((d) => `${divisionName(d)} % right`)];
  return [head, ...rows.map((r) => [
    r.topic, r.answered, r.pct ?? "",
    ...divisions.map((d) => (r.cells[d] && r.cells[d].pct !== null ? r.cells[d].pct : "")),
  ])];
}
