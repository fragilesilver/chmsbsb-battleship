// ============================================================
//  autorun.js  -  the jobs a teacher's tab does while a round runs:
//  free shots, the storm closing in, and ending the round on time.
//  Used by the single-game control room and the event dashboard.
// ============================================================
import { advanceStorm, finishRound, giveAmmo, setStormNextAt } from "./firebase.js";
import { maxStorm } from "./game.js";

// One of these per game. nextReload is when the next free shot is due.
export const newClock = () => ({ nextReload: 0, autoReload: true, stormBusy: false, roundBusy: false });

export const fmtClock = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

// Move the storm in one step and schedule the next
export async function closeStorm(code, g) {
  await advanceStorm(code, g);
  const max = maxStorm(g.settings);
  await setStormNextAt(code, (g.storm || 0) + 1 >= max ? null : Date.now() + g.settings.stormMins * 60000);
}

async function stormTick(code, g, clock) {
  if (!g.stormNextAt || clock.stormBusy || Date.now() < g.stormNextAt) return;
  clock.stormBusy = true;
  try { await closeStorm(code, g); } finally { clock.stormBusy = false; }
}

async function roundTick(code, g, clock) {
  const ends = g.competition && g.competition.roundEndsAt;
  if (!ends || clock.roundBusy || Date.now() < ends) return;
  clock.roundBusy = true;
  try { await finishRound(code); } finally { clock.roundBusy = false; }
}

async function reloadTick(code, g, clock) {
  if (!clock.autoReload || !(g.settings.reloadSecs > 0)) return;
  if (!clock.nextReload) clock.nextReload = Date.now() + g.settings.reloadSecs * 1000;
  if (Date.now() < clock.nextReload) return;
  clock.nextReload = Date.now() + g.settings.reloadSecs * 1000;
  await giveAmmo(code, g, 1);
}

// Call once a second for each running game
export function tickGame(code, g, clock) {
  if (!g || g.phase !== "battle") { clock.nextReload = 0; return; }
  const report = (e) => console.error(`Clock job failed for game ${code}:`, e);
  stormTick(code, g, clock).catch(report);
  roundTick(code, g, clock).catch(report);
  reloadTick(code, g, clock).catch(report);
}
