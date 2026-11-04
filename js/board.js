// ============================================================
//  board.js  -  draws the shared ocean chart
// ============================================================
import {
  zoneSizeOf, gridSize, colLabel, cellKey, zoneOwner, shipList, shipCells, isSunk, inStorm,
  fleetFor, avatarOf,
} from "./game.js";

/**
 * opts:
 *   myTeam       team id whose ships are visible ("t0"), or null
 *   revealAll    true on the teacher view: show every ship
 *   activeZone   team id: only this zone is clickable (placement)
 *   preview      { cells:[[r,c]...], ok:bool } ghost ship while placing
 *   selected     [r,c] the chosen target
 *   onCell       function(r, c) called on click
 *   intel        { cellKey: true/false } sonar results for this team
 *   area         [[r,c]...] squares a power-up will cover
 *   suggest      { cellKey: votes } targets the crew has suggested
 */
export function renderOcean(el, game, opts = {}) {
  const n = game.settings;
  const { cols, rows } = gridSize(n);
  const zone = zoneSizeOf(n);
  const shots = game.shots || {};
  const storm = game.storm || 0;

  // which cells hold ships we are allowed to see
  const shipAt = {};
  for (const [tid, fleet] of Object.entries(game.fleets || {})) {
    for (const ship of shipList(fleet)) {
      const sunk = isSunk(ship, shots);
      const always = opts.revealAll || tid === opts.myTeam || sunk;
      const icon = avatarOf(ship.icon);
      const mid = Math.floor((ship.len - 1) / 2);   // the icon sits on the middle square
      shipCells(ship).forEach(([r, c], i) => {
        const spotted = !always && inStorm(r, c, n, storm);   // exposed by the storm
        if (!always && !spotted) return;
        shipAt[cellKey(r, c)] = {
          spotted,
          sunk,
          end: i === 0 ? "start" : i === ship.len - 1 ? "end" : "",
          dir: ship.dir,
          icon: i === mid ? icon : "",
        };
      });
    }
  }
  const previewSet = new Set((opts.preview?.cells || []).map(([r, c]) => cellKey(r, c)));
  const areaSet = new Set((opts.area || []).map(([r, c]) => cellKey(r, c)));
  const intel = opts.intel || {};
  const suggest = opts.suggest || {};

  let frame = `<div class="ocean" style="--cols:${cols};--rows:${rows}" role="grid" aria-label="Ocean chart">`;
  frame += `<div class="axis corner"></div>`;
  for (let c = 0; c < cols; c++) frame += `<div class="axis col">${colLabel(c)}</div>`;

  let html = frame;
  const cells = [];
  for (let r = 0; r < rows; r++) {
    html += `<div class="axis row">${r + 1}</div>`;
    for (let c = 0; c < cols; c++) {
      const key = cellKey(r, c);
      const owner = zoneOwner(r, c, n);
      const team = owner && game.teams[owner];
      const cls = ["cell"];
      if (c % zone === 0) cls.push("zl");
      if (r % zone === 0) cls.push("zt");
      if (!team) cls.push("open-water");
      else if (!team.alive) cls.push("dead-zone");
      if (owner === opts.myTeam) cls.push("mine");
      if (opts.activeZone && owner !== opts.activeZone) cls.push("inactive");

      if (inStorm(r, c, n, storm)) cls.push("storm");
      const ship = shipAt[key];
      if (ship) cls.push("ship", ship.dir === "h" ? "sh" : "sv", ship.end, ship.sunk ? "sunk" : "", ship.spotted ? "spotted" : "");
      const shot = shots[key];
      if (shot) cls.push(shot.hit ? "hit" : "miss");
      else if (key in intel && !ship) cls.push(intel[key] ? "intel-ship" : "intel-clear");
      if (areaSet.has(key)) cls.push("area");
      if (suggest[key] && !shot) cls.push("suggested");
      if (previewSet.has(key)) cls.push(opts.preview.ok ? "ghost" : "ghost bad");
      if (opts.selected && opts.selected[0] === r && opts.selected[1] === c) cls.push("target");

      const label = colLabel(c) + (r + 1) + (shot ? (shot.hit ? ", hit" : ", miss") : "") +
        (ship && !shot ? ", ship" : "") + (!shot && intel[key] ? ", sonar contact" : "") +
        (suggest[key] && !shot ? `, suggested by ${suggest[key]}` : "");
      const cell = `<button class="${cls.join(" ")}" data-r="${r}" data-c="${c}"` +
        (team ? ` style="--tc:${team.color}"` : "") +
        ` aria-label="${label}">${ship && ship.icon ? `<span class="ship-icon" aria-hidden="true">${ship.icon}</span>` : ""}` +
        `${suggest[key] && !shot ? `<span class="sug" aria-hidden="true">${suggest[key]}</span>` : ""}</button>`;
      cells.push(cell);
      html += cell;
    }
  }
  html += `</div>`;

  // Replace only the squares that changed: it's far lighter on a phone, and a
  // square being tapped isn't swapped out from under a finger when others are hit.
  const nodes = el.__oceanFrame === frame && el.__oceanCells?.length === cells.length && el.querySelectorAll(".cell");
  if (nodes && nodes.length === cells.length) {
    cells.forEach((cell, i) => { if (cell !== el.__oceanCells[i]) nodes[i].outerHTML = cell; });
  } else {
    el.innerHTML = html;
  }
  el.__oceanFrame = frame;
  el.__oceanCells = cells;

  if (opts.onCell) {
    el.onclick = (e) => {
      const b = e.target.closest(".cell");
      if (b && !b.classList.contains("inactive")) opts.onCell(+b.dataset.r, +b.dataset.c);
    };
    el.onmouseover = opts.onHover
      ? (e) => { const b = e.target.closest(".cell"); if (b) opts.onHover(+b.dataset.r, +b.dataset.c); }
      : null;
  } else {
    el.onclick = null;
    el.onmouseover = null;
  }
}

// Team status list (name, pennant, ships left, shots)
export function renderTeams(el, game, myTeam) {
  const shots = game.shots || {};
  el.innerHTML = Object.entries(game.teams).map(([id, t]) => {
    const fleet = game.fleets && game.fleets[id];
    const afloat = fleet ? shipList(fleet).filter((s) => !isSunk(s, shots)).length : fleetFor(game.settings).length;
    const members = Object.values(game.players || {}).filter((p) => p.team === id).length;
    return `<li class="team-row ${t.alive ? "" : "out"} ${id === myTeam ? "me" : ""}" style="--tc:${t.color}">
      <span class="pennant" aria-hidden="true"></span>
      <span class="tname">${escapeHtml(t.name)}${id === myTeam ? " (you)" : ""}</span>
      <span class="tstat">${t.alive ? `${afloat} afloat, ${t.ammo} shot${t.ammo === 1 ? "" : "s"}` : "Sunk"}</span>
      <span class="tmembers">${members} crew</span>
    </li>`;
  }).join("");
}

export function renderFeed(el, game) {
  const items = Object.values(game.feed || {}).sort((a, b) => b.t - a.t).slice(0, 30);
  el.innerHTML = items.map((f) => {
    const color = f.teamId && game.teams[f.teamId] ? game.teams[f.teamId].color : "var(--ink-soft)";
    return `<li class="feed-${f.type}" style="--tc:${color}"><time>${new Date(f.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time> ${escapeHtml(f.text)}</li>`;
  }).join("");
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
