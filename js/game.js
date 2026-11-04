// ============================================================
//  game.js  -  pure game rules (no Firebase in here)
//  Coordinates: r = row (0-based), c = column (0-based)
//  Shown to students as letter + number, e.g. column C, row 7 -> "C7"
// ============================================================

export const ZONE = 8;           // default home waters: 8 x 8
export const ZONE_SIZES = [6, 7, 8, 9, 10, 11, 12];
export const MAX_AMMO = 8;       // a team can bank at most this many shots

// Every kind of ship the teacher can add. DEFAULT_FLEET is how many of each.
export const SHIP_TYPES = [
  { id: "battleship", name: "Battleship",  len: 5 },
  { id: "carrier",    name: "Carrier",     len: 4 },
  { id: "destroyer",  name: "Destroyer",   len: 3 },
  { id: "submarine",  name: "Submarine",   len: 3 },
  { id: "patrol",     name: "Patrol boat", len: 2 },
];
export const DEFAULT_FLEET = { battleship: 0, carrier: 1, destroyer: 1, submarine: 1, patrol: 1 };
export const MAX_PER_TYPE = 4;

// Students pick one of these; it's painted on the ships they place
export const AVATARS = [
  "🦈", "🐙", "🐢", "🦀", "🐬", "🐳", "🦑", "🐡", "🐠", "🦭", "🐧", "🦜",
  "🦊", "🐯", "🐼", "🐸", "🦁", "🐨", "🦄", "🐉", "🤖", "👻", "👽", "🏴‍☠️",
  "⚓", "⭐", "🔥", "⚡", "🌊", "🚀", "💎", "🍕",
];
// only ever show avatars from the list (players write their own avatar)
export const avatarOf = (a) => (AVATARS.includes(a) ? a : "");

// The ships in this game, e.g. [{id:"destroyer", ...}, {id:"destroyer2", name:"Destroyer 2", ...}]
export function fleetFor(s) {
  const counts = (s && s.fleet) || DEFAULT_FLEET;
  const out = [];
  for (const t of SHIP_TYPES) {
    const n = counts[t.id] || 0;
    for (let i = 1; i <= n; i++) {
      out.push({ id: i === 1 ? t.id : t.id + i, name: n > 1 ? `${t.name} ${i}` : t.name, len: t.len });
    }
  }
  return out;
}

// Name of the ship with this id in this game ("destroyer2" -> "Destroyer 2")
export const shipName = (s, id) => (fleetFor(s).find((f) => f.id === id) || { name: "ship" }).name;

export const YEAR_GROUPS = [
  { id: "Y7", name: "Year 7", color: "#1f6fb2", icon: "⚓" },
  { id: "Y8", name: "Year 8", color: "#1f8a5b", icon: "🧭" },
  { id: "Y9", name: "Year 9", color: "#c98a06", icon: "⚡" },
  { id: "Y10", name: "Year 10", color: "#d0342c", icon: "👑" },
];

export const TEAM_PRESETS = [
  { name: "Year 7 Titans",     color: "#1f6fb2", year: "Y7" },
  { name: "Year 8 Krakens",    color: "#1f8a5b", year: "Y8" },
  { name: "Year 9 Cyberhawks", color: "#c98a06", year: "Y9" },
  { name: "Year 10 Apex",      color: "#d0342c", year: "Y10" },
  { name: "Purple Squids",     color: "#7a3fb0", year: "Y7" },
  { name: "Orange Barracudas", color: "#e0621b", year: "Y8" },
];

// Geometry functions take the game settings `s` ({ teamCount, zoneSize })
export const zoneSizeOf = (s) => s.zoneSize || ZONE;

// How the team zones are arranged on the shared ocean.
// Columns are lettered A to Z, so big zones go 2 across instead of 3.
export function layoutFor(s) {
  const n = s.teamCount;
  const wide = zoneSizeOf(s) * 3 <= 26;
  if (n <= 2) return { zc: 2, zr: 1 };
  if (n === 3) return wide ? { zc: 3, zr: 1 } : { zc: 2, zr: 2 };
  if (n === 4) return { zc: 2, zr: 2 };
  return wide ? { zc: 3, zr: 2 } : { zc: 2, zr: 3 };   // 5 or 6 teams
}

export function gridSize(s) {
  const { zc, zr } = layoutFor(s);
  const z = zoneSizeOf(s);
  return { cols: zc * z, rows: zr * z };
}

export function zoneFor(teamIndex, s) {
  const { zc } = layoutFor(s);
  const z = zoneSizeOf(s);
  return {
    r0: Math.floor(teamIndex / zc) * z,
    c0: (teamIndex % zc) * z,
    size: z,
  };
}

export const teamIndex = (teamId) => Number(teamId.slice(1));   // "t3" -> 3
export const teamIds = (n) => Array.from({ length: n }, (_, i) => "t" + i);

export const colLabel = (c) => String.fromCharCode(65 + c);      // 0 -> "A"
export const cellName = (r, c) => colLabel(c) + (r + 1);         // (6,2) -> "C7"
export const cellKey = (r, c) => r + "_" + c;

export function inZone(r, c, z) {
  return r >= z.r0 && r < z.r0 + z.size && c >= z.c0 && c < z.c0 + z.size;
}

export function zoneOwner(r, c, s) {
  for (let i = 0; i < s.teamCount; i++) {
    if (inZone(r, c, zoneFor(i, s))) return "t" + i;
  }
  return null;
}

export function shipCells(ship) {
  const cells = [];
  for (let i = 0; i < ship.len; i++) {
    cells.push(ship.dir === "h" ? [ship.r, ship.c + i] : [ship.r + i, ship.c]);
  }
  return cells;
}

// Firebase stores a team's ships as an object keyed by ship id
export const shipList = (fleetObj) => (fleetObj ? Object.values(fleetObj) : []);

export function canPlace(fleetObj, candidate, zone) {
  const taken = new Set();
  shipList(fleetObj)
    .filter((s) => s.id !== candidate.id)
    .forEach((s) => shipCells(s).forEach(([r, c]) => taken.add(cellKey(r, c))));
  return shipCells(candidate).every(
    ([r, c]) => inZone(r, c, zone) && !taken.has(cellKey(r, c))
  );
}

// icons: avatars to paint on the ships, shared out in turn
export function randomFleet(zone, s, icons = []) {
  const protos = fleetFor(s);
  for (let attempt = 0; attempt < 50; attempt++) {
    const fleet = {};
    protos.forEach((proto, i) => {
      for (let tries = 0; tries < 500; tries++) {
        const dir = Math.random() < 0.5 ? "h" : "v";
        const ship = {
          ...proto,
          dir,
          r: zone.r0 + Math.floor(Math.random() * zone.size),
          c: zone.c0 + Math.floor(Math.random() * zone.size),
        };
        if (icons.length) ship.icon = icons[i % icons.length];
        if (canPlace(fleet, ship, zone)) { fleet[ship.id] = ship; break; }
      }
    });
    if (fleetComplete(fleet, s)) return fleet;
  }
  return null;   // this fleet doesn't fit in the zone
}

export const fleetComplete = (fleetObj, s) =>
  fleetFor(s).every((p) => fleetObj && fleetObj[p.id]);

export function findShipAt(fleets, r, c) {
  for (const [teamId, fleetObj] of Object.entries(fleets || {})) {
    for (const ship of shipList(fleetObj)) {
      if (shipCells(ship).some(([a, b]) => a === r && b === c)) {
        return { teamId, ship };
      }
    }
  }
  return null;
}

export function isSunk(ship, shots) {
  return shipCells(ship).every(([r, c]) => shots && shots[cellKey(r, c)]);
}

export function shipsAfloat(fleetObj, shots) {
  return shipList(fleetObj).filter((s) => !isSunk(s, shots)).length;
}

export function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no O/0 or I/1 confusion
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ---------------- storm ----------------
// The storm closes in from the edges of the ocean one ring at a time.
// Ships inside the storm are exposed on everyone's chart.
export function maxStorm(s) {
  const { cols, rows } = gridSize(s);
  return Math.floor(Math.min(cols, rows) / 2) - 1;
}

export function inStorm(r, c, s, level) {
  if (!level) return false;
  const { cols, rows } = gridSize(s);
  return Math.min(r, c, rows - 1 - r, cols - 1 - c) < level;
}

// ---------------- power-ups ----------------
export const POWERUPS = {
  sonar: { name: "Sonar", verb: "Ping sonar", help: "Scans a 3 × 3 area. Your crew sees which squares hide a ship. Nobody else does." },
  airstrike: { name: "Airstrike", verb: "Call airstrike", help: "Hits the square you pick and the four squares next to it. Uses no shots." },
};
export const STREAK_FOR_POWERUP = 3;   // correct answers in a row

function inGrid(r, c, s) {
  const { cols, rows } = gridSize(s);
  return r >= 0 && c >= 0 && r < rows && c < cols;
}

export function airstrikeCells(r, c, s) {
  return [[r, c], [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => inGrid(a, b, s));
}

export function sonarCells(r, c, s) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (inGrid(r + dr, c + dc, s)) out.push([r + dr, c + dc]);
  }
  return out;
}

// ---------------- crews ----------------
// Can this player join teamId? Returns "" if yes, or the reason why not.
// evenTeams: a crew can't get more than one player ahead of the smallest crew.
// crewMax: most players a crew can have (0 = no limit).
export function crewBlock(game, teamId, uid) {
  const s = game.settings;
  const team = game.teams[teamId];
  if (!team || !team.alive) return "This crew is out.";
  const counts = {};
  for (const id of Object.keys(game.teams)) counts[id] = 0;
  for (const [pid, p] of Object.entries(game.players || {})) {
    if (pid !== uid && p.team && p.team in counts) counts[p.team]++;
  }
  if (s.crewMax > 0 && counts[teamId] >= s.crewMax) return "Full";
  if (s.evenTeams) {
    const open = Object.keys(counts).filter((id) => game.teams[id].alive && !(s.crewMax > 0 && counts[id] >= s.crewMax));
    const smallest = Math.min(...open.map((id) => counts[id]));
    if (counts[teamId] > smallest) return "Join a smaller crew first";
  }
  return "";
}

// ---------------- torpedoes ----------------
// Torpedoes never miss: they aim at an unhit square of an enemy ship that's still afloat
export function torpedoTargets(game, teamId) {
  const shots = game.shots || {};
  const out = [];
  for (const [tid, fleet] of Object.entries(game.fleets || {})) {
    if (tid === teamId || !game.teams[tid] || !game.teams[tid].alive) continue;
    for (const ship of shipList(fleet)) {
      for (const [r, c] of shipCells(ship)) if (!shots[cellKey(r, c)]) out.push([r, c]);
    }
  }
  return out;
}

// ---------------- crew roles (optional, set by the teacher) ----------------
// The captain places the fleet and hands out jobs. Any job nobody has
// falls to the captain, so a small crew still has every job covered.
export const ROLES = {
  captain:   { name: "Captain",   icon: "👑", job: "Places the fleet and hands out the jobs. Covers any job nobody else has." },
  gunner:    { name: "Gunner",    icon: "🎯", job: "Fires the crew's shots, and runs FIRE code. Aim at the targets your crew suggests." },
  navigator: { name: "Navigator", icon: "🧭", job: "Answers questions to earn sonar, and pings it." },
  scientist: { name: "Scientist", icon: "🧪", job: "Answers questions to earn airstrikes, and calls them in." },
  crew:      { name: "Crew",      icon: "⚓", job: "Answers questions to earn shots, and suggests targets to the gunner." },
};
export const JOBS = ["gunner", "navigator", "scientist", "crew"];   // what the captain can hand out
export const KEY_JOBS = ["gunner", "navigator", "scientist"];       // one person each
export const DEFAULT_NAV_SECS = 15;
export const DEFAULT_SCI_SECS = 90;

export const rolesOn = (g) => !!(g.settings && g.settings.roles);
export const crewOf = (g, teamId) =>
  Object.entries(g.players || {}).filter(([, p]) => p.team === teamId).map(([uid]) => uid);
export const roleOf = (g, uid) => (g.players && g.players[uid] && JOBS.includes(g.players[uid].role) ? g.players[uid].role : "crew");
export const captainOf = (g, teamId) => {
  const cap = g.teams[teamId] && g.teams[teamId].captain;
  return cap && g.players && g.players[cap] && g.players[cap].team === teamId ? cap : null;
};

// Who does this key job on the crew? The member given it, otherwise the captain.
// (If there's no captain yet, the first member in a fixed order, so the crew is never stuck.)
export function jobHolder(g, teamId, job) {
  const members = crewOf(g, teamId);
  const uid = members.find((u) => roleOf(g, u) === job);
  return uid || captainOf(g, teamId) || members.sort()[0] || null;
}

// Every job this player does (a captain may cover several)
export function jobsOf(g, teamId, uid) {
  if (!rolesOn(g)) return ["captain", ...KEY_JOBS, "crew"];
  const out = [];
  if (captainOf(g, teamId) === uid) out.push("captain");
  for (const j of KEY_JOBS) if (jobHolder(g, teamId, j) === uid) out.push(j);
  if (roleOf(g, uid) === "crew") out.push("crew");
  return out;
}

// What a correct answer earns this player: "shots", "sonar" or "airstrike"
export function earnKind(g, uid) {
  if (!rolesOn(g)) return "shots";
  const r = roleOf(g, uid);
  return r === "navigator" ? "sonar" : r === "scientist" ? "airstrike" : "shots";
}

// Give every member without a job one: unfilled key jobs first, then crew
export function fillJobs(g, teamId) {
  const members = crewOf(g, teamId);
  const taken = new Set(members.map((u) => g.players[u].role).filter((r) => KEY_JOBS.includes(r)));
  const open = KEY_JOBS.filter((j) => !taken.has(j));
  const updates = {};
  const jobless = members.filter((u) => !JOBS.includes(g.players[u].role));
  for (const u of jobless.sort(() => Math.random() - 0.5)) updates[u] = open.shift() || "crew";
  return updates;   // { uid: role }
}

// ---------------- competition & scoring ----------------
export const SCORE_RULES = {
  hit: 25,
  sink: { patrol: 50, submarine: 75, destroyer: 75, carrier: 100, battleship: 125 },
  eliminate: 200,
  placement: [300, 200, 100, 50],
  quiz: { easy: 10, medium: 20, hard: 30 },
  streak: 25,
};

export const getBaseShipType = (id) => String(id || "").replace(/\d+$/, "");

export const isCompetition = (g) => !!(g && g.settings && g.settings.competitionMode);
export const currentRoundNum = (g) => (g && g.competition && g.competition.currentRound) || 1;
export const isGrandFinal = (g) => !!(g && g.competition && (g.competition.stage === "finals" || g.competition.currentRound === "final"));

// Standings across rounds (Best of 3 + current round)
export function getAccumulatedStandings(g) {
  if (!g || !g.teams) return [];
  const comp = g.competition || {};
  const pastRounds = comp.rounds || {};
  const shots = g.shots || {};

  const list = Object.entries(g.teams).map(([id, t]) => {
    const r1 = (pastRounds["1"] && pastRounds["1"][id] && pastRounds["1"][id].total) || 0;
    const r2 = (pastRounds["2"] && pastRounds["2"][id] && pastRounds["2"][id].total) || 0;
    const r3 = (pastRounds["3"] && pastRounds["3"][id] && pastRounds["3"][id].total) || 0;

    // Current round live score
    const curCombat = t.combatScore || 0;
    const curQuiz = t.quizScore || 0;
    const curPlacement = t.placementScore || 0;
    const curTotal = curCombat + curQuiz + curPlacement;

    const roundNum = currentRoundNum(g);
    const liveRoundScore = (pastRounds[String(roundNum)] && pastRounds[String(roundNum)][id]) ? 0 : curTotal;
    const totalScore = r1 + r2 + r3 + liveRoundScore;

    const fleet = g.fleets && g.fleets[id];
    const afloat = fleet ? shipList(fleet).filter((s) => !isSunk(s, shots)).length : fleetFor(g.settings).length;

    const correct = t.correct || 0;
    const wrong = t.wrong || 0;
    const accuracy = (correct + wrong) > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;

    return {
      teamId: id,
      name: t.name,
      year: t.year || YEAR_GROUPS[teamIndex(id) % YEAR_GROUPS.length].id,
      color: t.color,
      alive: t.alive,
      afloat,
      r1: (pastRounds["1"] && pastRounds["1"][id] && pastRounds["1"][id].total) || (roundNum === 1 ? curTotal : 0),
      r2: (pastRounds["2"] && pastRounds["2"][id] && pastRounds["2"][id].total) || (roundNum === 2 ? curTotal : 0),
      r3: (pastRounds["3"] && pastRounds["3"][id] && pastRounds["3"][id].total) || (roundNum === 3 ? curTotal : 0),
      liveRoundScore: curTotal,
      totalScore,
      correct,
      wrong,
      accuracy,
      sunkCount: t.sunkCount || 0,
      qualified: false,
    };
  });

  // Sort overall by totalScore descending, then accuracy descending, then afloat descending
  list.sort((a, b) => (b.totalScore - a.totalScore) || (b.accuracy - a.accuracy) || (b.afloat - a.afloat));

  // Determine top for each year group
  const topPerYear = {};
  for (const item of list) {
    if (!topPerYear[item.year]) {
      topPerYear[item.year] = item.teamId;
      item.isYearTop = true;
    } else {
      item.isYearTop = false;
    }
  }

  return list;
}
