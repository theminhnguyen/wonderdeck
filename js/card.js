/* ===================================================================
   card.js — „Grußkarte": begehbarer Retro-Raum im Game-Boy-Stil
   (4-Farben-Blau-Palette, Kachel-Raum, Pixel-Sprites, Dialogbox mit
   Schreibmaschinen-Text — eigene Pixel-Art, keine fremden Assets).
   Jeder Gruß (deck.greetings) wird ein Männchen im Raum; nah heran +
   A-Taste (E/Leertaste/Enter) zeigt den Gruß. Steuerung: Pfeile/WASD,
   am Handy D-Pad + A. Esc/✕ beendet.
   Auflösung intern 160×144 (Game-Boy-Maß), ganzzahlig hochskaliert.
   =================================================================== */

const el = (id) => document.getElementById(id);

/* ---------- Palette (Blau-Edition-Stimmung, eigene Töne) ---------- */
const PAL = ["#e8f0f8", "#a8c0e0", "#5878a8", "#182840"]; // hell → dunkel
const INK = "#182840", PAPER = "#f8f8f8";

/* ---------- Pixel-Sprites (eigene Art; '.'=durchsichtig, 0–3=Palette) ---------- */
const SPR = {
  down0: [
    "................",
    ".....333333.....",
    "....33333333....",
    "...3333333333...",
    "...3300000033...",
    "...3003003003...",
    "...3000000003...",
    "....30000003....",
    "...3222222223...",
    "..322222222223..",
    "..302222222203..",
    "...3222222223...",
    "....32222223....",
    "....33....33....",
    "....33....33....",
    "................"],
  down1: [
    "................",
    ".....333333.....",
    "....33333333....",
    "...3333333333...",
    "...3300000033...",
    "...3003003003...",
    "...3000000003...",
    "....30000003....",
    "...3222222223...",
    "..322222222223..",
    "..302222222203..",
    "...3222222223...",
    "....32222223....",
    "....33..33......",
    "........33......",
    "................"],
  up0: [
    "................",
    ".....333333.....",
    "....33333333....",
    "...3333333333...",
    "...3333333333...",
    "...3333333333...",
    "...3333333333...",
    "....33333333....",
    "...3222222223...",
    "..322222222223..",
    "..302222222203..",
    "...3222222223...",
    "....32222223....",
    "....33....33....",
    "....33....33....",
    "................"],
  up1: [
    "................",
    ".....333333.....",
    "....33333333....",
    "...3333333333...",
    "...3333333333...",
    "...3333333333...",
    "...3333333333...",
    "....33333333....",
    "...3222222223...",
    "..322222222223..",
    "..302222222203..",
    "...3222222223...",
    "....32222223....",
    "......33..33....",
    "......33........",
    "................"],
  side0: [
    "................",
    ".....333333.....",
    "....33333333....",
    "...3333333333...",
    "...3333000033...",
    "...3330030033...",
    "...3330000033...",
    "....33000033....",
    "...3222222233...",
    "...32222222230..",
    "...3222222223...",
    "...3222222223...",
    "....32222223....",
    "....33...33.....",
    "....33...33.....",
    "................"],
  side1: [
    "................",
    ".....333333.....",
    "....33333333....",
    "...3333333333...",
    "...3333000033...",
    "...3330030033...",
    "...3330000033...",
    "....33000033....",
    "...3222222233...",
    "...32222222230..",
    "...3222222223...",
    "...3222222223...",
    "....32222223....",
    ".....33.33......",
    "....33...33.....",
    "................"],
};

/* NPC = gleiche Silhouette, aber helle Kleidung + dunkle Haare (Tausch 2↔1) */
function npcVariant(rows) {
  return rows.map((r) => r.replace(/[12]/g, (c) => (c === "2" ? "1" : "2")));
}

function renderSprite(rows, flip = false) {
  const c = document.createElement("canvas"); c.width = 16; c.height = 16;
  const x = c.getContext("2d");
  rows.forEach((row, ry) => {
    for (let rx = 0; rx < 16; rx++) {
      const ch = row[rx];
      if (ch === "." || ch == null) continue;
      x.fillStyle = PAL[+ch];
      x.fillRect(flip ? 15 - rx : rx, ry, 1, 1);
    }
  });
  return c;
}

/* ---------- Kacheln (16×16, prozedural gezeichnet) ---------- */
function makeTile(draw) {
  const c = document.createElement("canvas"); c.width = 16; c.height = 16;
  const x = c.getContext("2d"); draw(x); return c;
}
function buildTiles() {
  const T = {};
  T.floor = makeTile((x) => {
    x.fillStyle = PAL[0]; x.fillRect(0, 0, 16, 16);
    x.fillStyle = PAL[1]; x.fillRect(0, 15, 16, 1); x.fillRect(15, 0, 1, 16);
    x.fillRect(3, 3, 1, 1); x.fillRect(11, 9, 1, 1);
  });
  T.wall = makeTile((x) => {
    x.fillStyle = PAL[2]; x.fillRect(0, 0, 16, 16);
    x.fillStyle = PAL[3];
    for (let y = 3; y < 16; y += 4) x.fillRect(0, y, 16, 1);
    x.fillRect(7, 0, 1, 4); x.fillRect(3, 4, 1, 4); x.fillRect(11, 4, 1, 4);
    x.fillRect(7, 8, 1, 4); x.fillRect(3, 12, 1, 4); x.fillRect(11, 12, 1, 4);
    x.fillRect(0, 0, 16, 1);
  });
  T.window = makeTile((x) => {
    x.drawImage(T.wall, 0, 0);
    x.fillStyle = PAL[3]; x.fillRect(2, 3, 12, 10);
    x.fillStyle = PAL[0]; x.fillRect(3, 4, 10, 8);
    x.fillStyle = PAL[1]; x.fillRect(3, 9, 10, 3);
    x.fillStyle = PAL[3]; x.fillRect(7, 4, 1, 8); x.fillRect(3, 7, 10, 1);
  });
  T.rug = makeTile((x) => {
    x.fillStyle = PAL[1]; x.fillRect(0, 0, 16, 16);
    x.fillStyle = PAL[2]; x.fillRect(0, 0, 16, 1); x.fillRect(0, 15, 16, 1); x.fillRect(0, 0, 1, 16); x.fillRect(15, 0, 1, 16);
    x.fillRect(4, 4, 2, 2); x.fillRect(10, 10, 2, 2); x.fillRect(10, 4, 2, 2); x.fillRect(4, 10, 2, 2);
  });
  T.plant = makeTile((x) => {
    x.drawImage(T.floor, 0, 0);
    x.fillStyle = PAL[3]; x.fillRect(5, 10, 6, 5); x.fillRect(4, 14, 8, 1);
    x.fillStyle = PAL[2]; x.fillRect(6, 11, 4, 3);
    x.fillStyle = PAL[2]; x.fillRect(6, 2, 4, 8); x.fillRect(3, 4, 4, 5); x.fillRect(9, 4, 4, 5);
    x.fillStyle = PAL[3]; x.fillRect(7, 6, 2, 4); x.fillRect(5, 5, 1, 2); x.fillRect(10, 5, 1, 2);
  });
  T.table = makeTile((x) => {
    x.drawImage(T.floor, 0, 0);
    x.fillStyle = PAL[3]; x.fillRect(1, 4, 14, 9);
    x.fillStyle = PAL[1]; x.fillRect(2, 5, 12, 6);
    x.fillStyle = PAL[2]; x.fillRect(2, 9, 12, 2);
    x.fillStyle = PAL[0]; x.fillRect(4, 6, 3, 2); // Briefumschlag auf dem Tisch
    x.fillStyle = PAL[2]; x.fillRect(4, 6, 3, 1);
  });
  return T;
}

/* ---------- Öffnen ---------- */
let active = null;
export function openCard(deck, onClose = null) {
  if (active) active.close();
  const overlay = el("card"), holder = el("cardHolder");
  overlay.hidden = false;
  holder.innerHTML = "";

  const cv = document.createElement("canvas");
  cv.width = 160; cv.height = 144;
  cv.className = "card__screen";
  holder.appendChild(cv);
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const T = buildTiles();
  const sprites = {
    down: [renderSprite(SPR.down0), renderSprite(SPR.down1)],
    up: [renderSprite(SPR.up0), renderSprite(SPR.up1)],
    right: [renderSprite(SPR.side0), renderSprite(SPR.side1)],
    left: [renderSprite(SPR.side0, true), renderSprite(SPR.side1, true)],
  };
  const npcSprites = {
    down: renderSprite(npcVariant(SPR.down0)),
    up: renderSprite(npcVariant(SPR.up0)),
    right: renderSprite(npcVariant(SPR.side0)),
    left: renderSprite(npcVariant(SPR.side0), true),
  };

  /* ----- Raum ----- */
  const greet = (deck.greetings || []).filter((g) => (g.text || "").trim() || (g.name || "").trim());
  const COLS = 10;
  const ROWS = Math.max(9, 7 + Math.ceil(greet.length / 3) * 2); // wächst mit Grüßen
  const solid = new Set(); // "x,y" belegt (Möbel/NPC)
  const tiles = []; // {x,y,img}
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    let img = T.floor;
    if (y === 0 || y === 1) { img = (y === 0 || x % 3 !== 1) ? T.wall : T.window; solid.add(x + ",1"); solid.add(x + ",0"); }
    tiles.push({ x, y, img });
  }
  // Teppich in der Mitte
  for (let y = 3; y <= 4; y++) for (let x = 3; x <= 6; x++) tiles.push({ x, y, img: T.rug });
  // Deko: Pflanzen in den Ecken, Tisch oben
  const deco = [[0, 2, T.plant], [COLS - 1, 2, T.plant], [0, ROWS - 1, T.plant], [COLS - 1, ROWS - 1, T.plant], [4, 2, T.table], [5, 2, T.table]];
  deco.forEach(([x, y, img]) => { tiles.push({ x, y, img }); solid.add(x + "," + y); });

  /* ----- NPCs (ein Männchen pro Gruß) ----- */
  const spots = [];
  for (let row = 3; spots.length < greet.length; row += 2)
    for (const gx of [2, 7, 4]) { if (spots.length < greet.length) spots.push([gx, row + (gx === 4 ? 1 : 0)]); }
  const npcs = greet.map((g, i) => ({ g, x: spots[i][0], y: spots[i][1], dir: "down" }));
  npcs.forEach((n) => solid.add(n.x + "," + n.y));

  /* ----- Spieler ----- */
  const P = { x: Math.floor(COLS / 2), y: ROWS - 2, px: 0, py: 0, dir: "up", step: 0, moving: false, mx: 0, my: 0, prog: 0 };
  P.px = P.x * 16; P.py = P.y * 16;

  /* ----- Dialog ----- */
  const D = { open: false, pages: [], page: 0, shown: 0, done: false };
  function wrap(text, width = 17) {
    const words = String(text).split(/\s+/); const lines = []; let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (t.length > width && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
  function openDialog(text) {
    const lines = wrap(text);
    D.pages = []; for (let i = 0; i < lines.length; i += 2) D.pages.push(lines.slice(i, i + 2));
    D.page = 0; D.shown = 0; D.open = true; D.done = false;
  }
  function aPress() {
    if (!D.open) {
      // NPC vor dem Spieler?
      const fx = P.x + (P.dir === "left" ? -1 : P.dir === "right" ? 1 : 0);
      const fy = P.y + (P.dir === "up" ? -1 : P.dir === "down" ? 1 : 0);
      const n = npcs.find((n) => n.x === fx && n.y === fy);
      if (n) {
        // NPC dreht sich zum Spieler
        n.dir = P.dir === "up" ? "down" : P.dir === "down" ? "up" : P.dir === "left" ? "right" : "left";
        const name = (n.g.name || "").trim();
        openDialog((name ? name.toUpperCase() + ": " : "") + (n.g.text || "…"));
      }
      return;
    }
    const total = D.pages[D.page].join(" ").length + D.pages[D.page].length;
    if (D.shown < total) { D.shown = total; return; } // Text sofort vollenden
    if (D.page < D.pages.length - 1) { D.page++; D.shown = 0; }
    else D.open = false;
  }

  /* ----- Eingabe ----- */
  const keys = {};
  function dirFromKeys() {
    if (keys["arrowup"] || keys["w"]) return "up";
    if (keys["arrowdown"] || keys["s"]) return "down";
    if (keys["arrowleft"] || keys["a"]) return "left";
    if (keys["arrowright"] || keys["d"]) return "right";
    return null;
  }
  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    keys[k] = true;
    if (k === "e" || k === " " || k === "enter") aPress();
    if (k === "escape") close();
  }
  function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // Touch: D-Pad + A-Knopf
  const pad = el("cardPad");
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  pad.hidden = !isTouch;
  const bindBtn = (id, key) => {
    const b = el(id); if (!b) return;
    const on = (e) => { e.preventDefault(); if (key === "e") aPress(); else keys[key] = true; };
    const off = (e) => { e.preventDefault(); keys[key] = false; };
    b.addEventListener("touchstart", on, { passive: false });
    b.addEventListener("touchend", off); b.addEventListener("touchcancel", off);
  };
  bindBtn("cardUp", "arrowup"); bindBtn("cardDown", "arrowdown");
  bindBtn("cardLeft", "arrowleft"); bindBtn("cardRight", "arrowright"); bindBtn("cardA", "e");

  /* ----- Skalierung ----- */
  function fit() {
    const s = Math.max(1, Math.floor(Math.min(window.innerWidth / 160, (window.innerHeight - (isTouch ? 150 : 0)) / 144)));
    cv.style.width = 160 * s + "px"; cv.style.height = 144 * s + "px";
  }
  fit();
  window.addEventListener("resize", fit);

  /* ----- Loop ----- */
  const walkable = (x, y) => x >= 0 && x < COLS && y >= 2 && y < ROWS && !solid.has(x + "," + y);
  let raf = 0, frame = 0;
  function loop() {
    frame++;
    // Bewegung (kachelweise, weich interpoliert)
    if (!D.open) {
      if (!P.moving) {
        const d = dirFromKeys();
        if (d) {
          P.dir = d;
          const nx = P.x + (d === "left" ? -1 : d === "right" ? 1 : 0);
          const ny = P.y + (d === "up" ? -1 : d === "down" ? 1 : 0);
          if (walkable(nx, ny)) { P.moving = true; P.mx = nx; P.my = ny; P.prog = 0; }
        }
      }
      if (P.moving) {
        P.prog += 1 / 10; // ~10 Frames pro Kachel
        if (P.prog >= 1) { P.x = P.mx; P.y = P.my; P.moving = false; P.prog = 0; }
        const fx = P.moving ? P.x + (P.mx - P.x) * P.prog : P.x;
        const fy = P.moving ? P.y + (P.my - P.y) * P.prog : P.y;
        P.px = Math.round(fx * 16); P.py = Math.round(fy * 16);
        if (frame % 8 === 0) P.step = 1 - P.step;
      } else { P.px = P.x * 16; P.py = P.y * 16; P.step = 0; }
    }

    // Kamera (vertikal, Raum ist 160 breit)
    const camY = Math.max(0, Math.min(P.py - 64, ROWS * 16 - 144));

    // Zeichnen
    ctx.fillStyle = PAL[3]; ctx.fillRect(0, 0, 160, 144);
    for (const t of tiles) ctx.drawImage(t.img, t.x * 16, t.y * 16 - camY);
    for (const n of npcs) {
      ctx.drawImage(npcSprites[n.dir], n.x * 16, n.y * 16 - camY - 2);
      // "!"-Hinweis, wenn Spieler direkt davor steht
      if (Math.abs(n.x - P.x) + Math.abs(n.y - P.y) === 1 && !D.open) {
        ctx.fillStyle = INK; ctx.fillRect(n.x * 16 + 7, n.y * 16 - camY - 8, 2, 4); ctx.fillRect(n.x * 16 + 7, n.y * 16 - camY - 3, 2, 2);
      }
    }
    ctx.drawImage(sprites[P.dir][P.moving ? P.step : 0], P.px, P.py - camY - 2);

    // Dialogbox (klassisch: weiß, doppelter Rahmen, Schreibmaschine)
    if (D.open) {
      ctx.fillStyle = PAPER; ctx.fillRect(2, 102, 156, 40);
      ctx.fillStyle = INK;
      ctx.fillRect(2, 102, 156, 2); ctx.fillRect(2, 140, 156, 2); ctx.fillRect(2, 102, 2, 40); ctx.fillRect(156, 102, 2, 40);
      ctx.fillStyle = PAPER; ctx.fillRect(5, 105, 150, 34);
      ctx.fillStyle = INK; ctx.fillRect(5, 105, 150, 1); ctx.fillRect(5, 138, 150, 1); ctx.fillRect(5, 105, 1, 34); ctx.fillRect(154, 105, 1, 34);
      D.shown = Math.min(D.shown + 1, 999);
      let budget = D.shown;
      ctx.font = "8px 'Press Start 2P', monospace"; ctx.textBaseline = "top"; ctx.fillStyle = INK;
      const lines = D.pages[D.page] || [];
      lines.forEach((ln, i) => {
        const part = ln.slice(0, Math.max(0, budget)); budget -= ln.length + 1;
        ctx.fillText(part, 10, 111 + i * 13);
      });
      const total = lines.join(" ").length + lines.length;
      if (D.shown >= total && frame % 30 < 18) { // ▼ blinkt
        ctx.fillStyle = INK;
        ctx.fillRect(146, 132, 6, 2); ctx.fillRect(147, 134, 4, 1); ctx.fillRect(148, 135, 2, 1);
      }
    } else if (npcs.length === 0) {
      ctx.font = "8px 'Press Start 2P', monospace"; ctx.textBaseline = "top"; ctx.fillStyle = INK;
      ctx.fillStyle = PAPER; ctx.fillRect(2, 110, 156, 26); ctx.fillStyle = INK;
      ctx.fillText("NOCH KEINE", 10, 114); ctx.fillText("GRUESSE …", 10, 124);
    }

    raf = requestAnimationFrame(loop);
  }

  function close() {
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("resize", fit);
    holder.innerHTML = ""; overlay.hidden = true;
    active = null;
    if (onClose) onClose();
  }
  el("cardExit").onclick = close;
  active = { close };

  // Begrüßung (Titel der Karte)
  openDialog((deck.title || "Grußkarte") + " — Sprich mit allen Leuten! (A = E-Taste)");
  if (typeof window !== "undefined" && window.__WD_DEBUG)
    window.__wdCard = { P, npcs, D, aPress, state: () => ({ x: P.x, y: P.y, dir: P.dir, dialog: D.open, npcs: npcs.length }) };

  raf = requestAnimationFrame(loop);
}
