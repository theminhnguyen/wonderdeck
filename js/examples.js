/* ===================================================================
   examples.js — Beispiel-Galerie: fertige Präsentationen zum Laden.
   Jede build()-Funktion erzeugt Bilder (gfx.js) + Folien und gibt ein
   neues Deck zurück (eigene id). Grafiken sind generiert — keine Uploads.
   =================================================================== */
import * as db from "./db.js";
import { uid, createSlide, createLayer, createText } from "./state.js";
import * as G from "./gfx.js";

async function img(url) { const id = uid(); await db.putImage(id, url); return id; }
function L(id, name, parallax, kenburns = 0, reactive = false) {
  const l = createLayer({ imageId: id, name }); l.parallax = parallax; l.kenburns = kenburns; l.reactive = reactive; return l;
}
const T = (role, text, p = {}) => Object.assign(createText(role), { text, ...p });
function Slide(style, bg, layers, texts, transition, ink) {
  const s = createSlide({ style }); s.bg = bg; s.layers = layers; s.texts = texts;
  if (transition) s.transition = transition;
  if (ink) s.ink = ink; // per-Folie Textfarbe (überschreibt Theme)
  return s;
}
async function finalize(title, theme, slides, nav, mode) {
  const deck = { id: uid(), title, theme, mode: mode || "deck", nav: nav || [], slides, createdAt: Date.now() };
  await db.saveDeck(structuredClone(deck));
  localStorage.setItem("wonderdeck:currentDeckId", deck.id);
  return deck;
}

/* ---------- Aurora · Produkt-Keynote ---------- */
async function buildAurora() {
  const space = await img(G.orbGlow("#111838", "#05060f", "#8aa0ff"));
  const stars = await img(G.starfield(150, "#cfe0ff"));
  const feat = await img(G.skyGrad(["#0a1030", "#243a8a", "#5a4bbf", "#9b6bd6"], { cx: 0.7, cy: 0.4, r: 0.5, color: "#bcd0ff" }));
  const featStars = await img(G.starfield(90, "#dce6ff"));
  const aura = await img(G.blobsBg("#0a1030", ["#3a4bd6", "#7a4bd6", "#4bb0d6"], 11));
  const close = await img(G.orbGlow("#1a1240", "#06040f", "#c89bff", 800, 470));

  return finalize("Aurora · Produkt-Keynote", "sky", [
    Slide("wonder", "#05060f", [L(space, "Weltraum", 10, 0.06), L(stars, "Sterne (reaktiv)", 34, 0, true)],
      [T("kicker", "INTRODUCING", { x: 20, y: 28, w: 60, align: "center" }), T("title", "Aurora", { x: 20, y: 38, w: 60, align: "center" }),
       T("subtitle", "Die nächste Generation. Heute.", { x: 20, y: 62, w: 60, align: "center" })]),
    Slide("snap", "#0a1030", [L(feat, "Hintergrund", 14, 0.1), L(featStars, "Sterne", 30)],
      [T("kicker", "WARUM AURORA", { x: 8, y: 24 }), T("title", "Licht,\nneu gedacht.", { x: 8, y: 32, w: 56 }),
       T("body", "Adaptive Helligkeit, ultraleises Design\nund ein Akku, der den ganzen Tag hält.", { x: 8, y: 74, w: 50 })]),
    Slide("snap", "#0a1030", [L(aura, "Aura", 18, 0.08)],
      [T("kicker", "IN ZAHLEN", { x: 8, y: 26 }), T("title", "10×", { x: 8, y: 34, w: 50 }),
       T("body", "schnellere Reaktionszeit als die\nVorgängergeneration.", { x: 8, y: 64, w: 46 })]),
    Slide("snap", "#06040f", [L(close, "Finale", 12, 0.1)],
      [T("title", "Aurora", { x: 20, y: 42, w: 60, align: "center" }), T("subtitle", "Ab Herbst verfügbar.", { x: 20, y: 60, w: 60, align: "center" })]),
  ]);
}

/* ---------- Wanderlust · Reise-Story ---------- */
async function buildWanderlust() {
  const sky1 = await img(G.skyGrad(["#16244e", "#5a4a8a", "#c2738e", "#f0a36a"], { cx: 0.5, cy: 0.72, r: 0.4, color: "#ffe0b0" }));
  const far1 = await img(G.ridge("#46507e", 520, 160, 11, 50));
  const near1 = await img(G.ridgeFigure("#0e1430", 720, 110, 9));
  const sky2 = await img(G.skyGrad(["#0a2a2e", "#16635a", "#5fae7a", "#ffe6a0"], { cx: 0.3, cy: 0.34, r: 0.42, color: "#fff0c0" }));
  const far2 = await img(G.ridge("#1a6a55", 590, 90, 8, 30));
  const near2 = await img(G.ridge("#06352e", 760, 80, 7, 22));
  const ocean = await img(G.waves(["#0a1e3a", "#13507a", "#2a86b0"], [
    { y: 560, amp: 24, phase: 0, color: "#0c3a5e", op: 0.9 },
    { y: 640, amp: 30, phase: 1.2, color: "#0a2c4a", op: 0.95 },
    { y: 740, amp: 26, phase: 2.1, color: "#06203a" }]));
  const night = await img(G.skyGrad(["#0e1430", "#2a2050", "#5a3a6a"]));

  return finalize("Wanderlust · Reise-Story", "aurum", [
    Slide("wonder", "#16244e", [L(sky1, "Himmel", 12, 0.12), L(far1, "Berge", 28), L(near1, "Vordergrund", 52)],
      [T("kicker", "EINE REISE", { x: 8, y: 24 }), T("title", "Wander-\nlust", { x: 8, y: 32, w: 56 }), T("subtitle", "Geschichten von unterwegs.", { x: 8, y: 76, w: 46 })]),
    Slide("snap", "#0a2a2e", [L(sky2, "Himmel", 12, 0.1), L(far2, "Hügel", 26), L(near2, "Vordergrund", 46)],
      [T("kicker", "TAG 3 · DAS TAL", { x: 50, y: 24, w: 44, align: "right" }), T("title", "Grüne\nWeiten", { x: 42, y: 32, w: 52, align: "right" }), T("body", "Wo der Pfad sich im Nebel verliert.", { x: 50, y: 74, w: 44, align: "right" })]),
    Slide("snap", "#0a1e3a", [L(ocean, "Meer", 30, 0.08)],
      [T("kicker", "TAG 7 · DIE KÜSTE", { x: 8, y: 26 }), T("title", "Endlich\nMeer", { x: 8, y: 34, w: 52 }), T("body", "Salz in der Luft, Ruhe im Kopf.", { x: 8, y: 74, w: 44 })]),
    Slide("snap", "#0e1430", [L(night, "Nacht", 14, 0.1)],
      [T("title", "Der Weg ist\ndas Ziel.", { x: 20, y: 38, w: 60, align: "center" })]),
  ]);
}

/* ---------- Studio Nova · Kreativ-Portfolio ---------- */
async function buildStudioNova() {
  const bg1 = await img(G.blobsBg("#0c0a18", ["#ff5a8a", "#7a5bff", "#ff9a3c", "#3cc8ff"], 14));
  const deco = await img(G.blobsBg("transparent", ["#ff5a8a", "#ffd23c", "#3cc8ff"], 7));
  const bg2 = await img(G.blobsBg("#100a1a", ["#7a5bff", "#ff5a8a", "#3cc8ff"], 12));
  const bg3 = await img(G.blobsBg("#0c0a18", ["#ff9a3c", "#ff5a8a", "#7a5bff"], 12));
  const bg4 = await img(G.blobsBg("#0c0a18", ["#ff5a8a", "#7a5bff"], 8));

  return finalize("Studio Nova · Portfolio", "coral", [
    Slide("wonder", "#0c0a18", [L(bg1, "Farben", 12, 0.1), L(deco, "Akzent (reaktiv)", 40, 0, true)],
      [T("kicker", "CREATIVE STUDIO", { x: 8, y: 26 }), T("title", "Studio\nNova", { x: 8, y: 34, w: 60 }), T("subtitle", "Wir gestalten Erlebnisse, die man fühlt.", { x: 8, y: 74, w: 48 })]),
    Slide("snap", "#100a1a", [L(bg2, "Farben", 16, 0.08)],
      [T("kicker", "UNSERE ARBEIT", { x: 8, y: 24 }), T("title", "50+", { x: 8, y: 32, w: 50 }), T("body", "Projekte für Marken auf vier Kontinenten.", { x: 8, y: 62, w: 46 })]),
    Slide("snap", "#0c0a18", [L(bg3, "Farben", 16, 0.08)],
      [T("kicker", "WAS WIR MACHEN", { x: 50, y: 22, w: 44, align: "right" }), T("title", "Branding ·\nWeb · Motion", { x: 36, y: 32, w: 58, align: "right" }), T("body", "Von der Idee bis zum letzten Pixel.", { x: 50, y: 74, w: 44, align: "right" })]),
    Slide("snap", "#0c0a18", [L(bg4, "Farben", 14, 0.1)],
      [T("title", "Reden wir.", { x: 20, y: 40, w: 60, align: "center" }), T("subtitle", "hello@studio-nova.example", { x: 20, y: 60, w: 60, align: "center" })]),
  ]);
}

/* ---------- Stille · Minimalismus / Poesie ---------- */
async function buildStille() {
  const g1 = await img(G.skyGrad(["#1a1a22", "#2a2630", "#3a3340"]));
  const g2 = await img(G.skyGrad(["#12161c", "#1c2630", "#2a3a44"]));
  const g3 = await img(G.skyGrad(["#201820", "#33232e", "#46303c"]));
  return finalize("Stille · Minimalismus", "editorial", [
    Slide("wonder", "#1a1a22", [L(g1, "Verlauf", 8, 0.06)], [T("title", "Weniger,\naber besser.", { x: 20, y: 38, w: 60, align: "center" })], "fade"),
    Slide("snap", "#12161c", [L(g2, "Verlauf", 8, 0.06)], [T("subtitle", "Die Stille zwischen den Noten\nmacht die Musik.", { x: 22, y: 40, w: 56, align: "center" })], "fade"),
    Slide("snap", "#201820", [L(g3, "Verlauf", 8, 0.06)], [T("kicker", "✦", { x: 20, y: 46, w: 60, align: "center" })], "fade"),
  ]);
}

/* E.ON-Bildmarke (Chevron ">") aus dem .potx-Master, als Ecken-Logo (oben rechts). */
function eonLogo() {
  const p = "M0 20.2576 20.328 0 70 49.5 20.328 99 0 78.7424 29.343 49.5 0 20.2576Z";
  return G.svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><g transform="translate(1362 118) scale(0.8)"><path d="${p}" fill="#ffffff" fill-rule="evenodd" clip-rule="evenodd" opacity="0.92"/></g></svg>`);
}

/* ---------- E.ON Expert Services · Markenvorlage ---------- */
async function buildEon() {
  const bg1 = await img(G.blobsBg("#0e0a0c", ["#ea1b0a", "#700e61", "#ab3f98"], 12));
  const deco = await img(G.blobsBg("transparent", ["#ea1b0a", "#f69c91"], 6));
  const bg2 = await img(G.skyGrad(["#0a0708", "#2a0c0a", "#5a1410"], { cx: 0.72, cy: 0.34, r: 0.5, color: "#ea1b0a" }));
  const bg3 = await img(G.orbGlow("#1a0a14", "#0a0608", "#ab3f98"));
  const bg4 = await img(G.skyGrad(["#0a0708", "#1a0a0c", "#2a0c0a"]));
  const logo = await img(eonLogo()); // gleiche Bildmarke auf allen Folien

  return finalize("E.ON Expert Services", "eon", [
    Slide("wonder", "#0e0a0c", [L(bg1, "Marke", 12, 0.1), L(deco, "Akzent (reaktiv)", 38, 0, true), L(logo, "E.ON-Logo", 0)],
      [T("kicker", "E.ON · INTELLIGENT AUTOMATION", { x: 8, y: 26 }), T("title", "Expert\nServices", { x: 8, y: 34, w: 60 }),
       T("subtitle", "Prozesse neu gedacht — mit KI und Automatisierung.", { x: 8, y: 74, w: 48 })]),
    Slide("snap", "#0a0708", [L(bg2, "Hintergrund", 16, 0.08), L(logo, "E.ON-Logo", 0)],
      [T("kicker", "WAS WIR TUN", { x: 8, y: 24 }), T("title", "Vom Prozess\nzur Plattform", { x: 8, y: 32, w: 58 }),
       T("body", "BPM, RAG-Architekturen und Copilot-Lösungen\nfür den Expert-Service.", { x: 8, y: 74, w: 50 })], "slide"),
    Slide("snap", "#1a0a14", [L(bg3, "Orb", 16, 0.08), L(logo, "E.ON-Logo", 0)],
      [T("kicker", "WIRKUNG", { x: 8, y: 26 }), T("title", "100+", { x: 8, y: 34, w: 50 }),
       T("body", "automatisierte Schritte (Platzhalter — anpassen).", { x: 8, y: 64, w: 46 })], "zoom"),
    Slide("snap", "#0a0708", [L(bg4, "Hintergrund", 14, 0.1), L(logo, "E.ON-Logo", 0)],
      [T("title", "Danke.", { x: 20, y: 40, w: 60, align: "center" }),
       T("subtitle", "E.ON Expert Services · BPM & Intelligent Automation", { x: 20, y: 60, w: 60, align: "center" })], "fade"),
  ]);
}

/* ---------- Swiss · Editorial (High-End-Minimalismus) ---------- */
async function buildSwiss() {
  const bg1 = await img(G.skyGrad(["#1c1b19", "#2a2825", "#5f574c"]));
  const ring = await img(G.svgURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><circle cx="800" cy="450" r="300" fill="none" stroke="#f4f1ea" stroke-opacity="0.5" stroke-width="2"/><circle cx="800" cy="450" r="215" fill="none" stroke="#f4f1ea" stroke-opacity="0.16" stroke-width="1.5"/></svg>'));
  const bg2 = await img(G.skyGrad(["#e7e1d4", "#d8d0c0", "#c4b9a6"])); // helle Sektion
  const square = await img(G.svgURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect x="1090" y="250" width="380" height="380" fill="#3a352d"/></svg>'));
  const bg3 = await img(G.skyGrad(["#141414", "#1c1c1c", "#262320"]));
  const bars = await img(G.svgURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect x="240" y="120" width="3" height="640" fill="#f4f1ea" fill-opacity="0.35"/><circle cx="1150" cy="250" r="70" fill="#d6452f"/></svg>'));

  const slides = [
    Slide("wonder", "#1a1916", [L(bg1, "Verlauf", 10, 0.08), L(ring, "Ring (reaktiv)", 26, 0, true)],
      [T("kicker", "◆ UNIVERSAL TEMPLATE", { x: 20, y: 26, w: 60, align: "center" }),
       T("title", "FORM &\nFUNCTION", { x: 10, y: 36, w: 80, align: "center" }),
       T("subtitle", "High-End-Minimalismus im Swiss-Design-Stil.", { x: 20, y: 66, w: 60, align: "center" })]),
    Slide("snap", "#201d18", [L(bg2, "Verlauf", 12, 0.08), L(square, "Block", 30)],
      [T("body", "Wir reduzieren auf das Wesentliche, damit das Wichtige sprechen kann. Raster, Typografie, Weißraum.", { x: 8, y: 22, w: 42 }),
       T("title", "Less,\nbut better", { x: 40, y: 60, w: 54, align: "right" })], "slide", "#1a1a1a"),
    Slide("snap", "#141414", [L(bg3, "Verlauf", 10, 0.1), L(bars, "Linie + Punkt", 22)],
      [T("title", "Let's\ntalk", { x: 8, y: 34, w: 50 }),
       T("body", "Bereit für ein Projekt, das auffällt? Schreib uns.", { x: 52, y: 42, w: 40, align: "right" }),
       T("kicker", "INSTAGRAM · LINKEDIN · BEHANCE", { x: 8, y: 82, w: 80 })], "fade"),
  ];
  const nav = [
    { id: uid(), label: "Work", type: "slide", target: slides[0].id },
    { id: uid(), label: "About", type: "slide", target: slides[1].id },
    { id: uid(), label: "Contact", type: "slide", target: slides[2].id },
  ];
  return finalize("Swiss · Editorial", "swiss", slides, nav);
}

/* ---------- Journey · durchlaufbare 2.5D-Welt ---------- */
async function buildJourney() {
  const a = await img(G.skyGrad(["#0a1230", "#243a8a", "#5a4bbf"], { cx: 0.5, cy: 0.4, r: 0.5, color: "#bcd0ff" }));
  const b = await img(G.orbGlow("#101838", "#06070f", "#8aa0ff"));
  const c = await img(G.gradientScene("#0b2a3a", "#13506b", "#1f8a8a", "#a7f0d8"));
  const d = await img(G.gradientScene("#2a1640", "#7a2e63", "#e06a4e", "#ffd28a"));
  const e = await img(G.skyGrad(["#0a0708", "#1a0a0c", "#2a0c0a"]));
  const slides = [
    Slide("snap", "#0a1230", [L(a, "Szene", 0)], [T("kicker", "DIE REISE BEGINNT"), T("title", "Willkommen"), T("subtitle", "Scrolle oder ziehe, um loszugehen.")]),
    Slide("snap", "#101838", [L(b, "Szene", 0)], [T("kicker", "STATION 1"), T("title", "Eine Idee"), T("body", "Jede Station zeigt einen Gedanken auf dem Weg.")]),
    Slide("snap", "#0b2a3a", [L(c, "Szene", 0)], [T("kicker", "STATION 2"), T("title", "Sie wächst"), T("body", "Du gehst weiter — die Geschichte entfaltet sich.")]),
    Slide("snap", "#2a1640", [L(d, "Szene", 0)], [T("kicker", "STATION 3"), T("title", "Der Höhepunkt"), T("body", "Alles führt hierher.")]),
    Slide("snap", "#0a0708", [L(e, "Szene", 0)], [T("title", "Ende des Wegs"), T("subtitle", "Danke fürs Mitlaufen ✦")]),
  ];
  return finalize("Journey · Eine Reise", "sky", slides, [], "journey");
}

/* ---------- Projekt-Pitch (Business) ---------- */
async function buildPitch() {
  const bg1 = await img(G.skyGrad(["#0a1230", "#1b3a6b", "#2f6f9e"], { cx: 0.5, cy: 0.68, r: 0.45, color: "#bcd0ff" }));
  const bg2 = await img(G.skyGrad(["#0a1018", "#16263a", "#1f3a52"]));
  const bg3 = await img(G.skyGrad(["#0a1812", "#143a2a", "#1f6f4a"], { cx: 0.7, cy: 0.34, r: 0.42, color: "#a7f0c8" }));
  const bg4 = await img(G.blobsBg("#0a1030", ["#3a4bd6", "#4bb0d6"], 9));
  const bg5 = await img(G.skyGrad(["#0a0e16", "#141c2a", "#24324a"]));
  const slides = [
    Slide("wonder", "#0a1230", [L(bg1, "Hintergrund", 12, 0.12)],
      [T("kicker", "PROJEKT-PITCH", { x: 8, y: 26 }), T("title", "Automatisierung,\ndie entlastet", { x: 8, y: 34, w: 60 }), T("subtitle", "Vorname Nachname · Bereich · Datum", { x: 8, y: 72, w: 50 })]),
    Slide("snap", "#0a1018", [L(bg2, "Hintergrund", 14)],
      [T("kicker", "DAS PROBLEM", { x: 8, y: 26 }), T("title", "Zu viele\nmanuelle Schritte", { x: 8, y: 34, w: 56 }), T("body", "Wiederkehrende Aufgaben binden Zeit, verzögern\nund sind fehleranfällig.", { x: 8, y: 72, w: 50 })], "slide"),
    Slide("snap", "#0a1812", [L(bg3, "Hintergrund", 14)],
      [T("kicker", "DIE LÖSUNG", { x: 46, y: 26, w: 48, align: "right" }), T("title", "Ein Agent,\nder mitdenkt", { x: 40, y: 34, w: 54, align: "right" }), T("body", "KI und Automatisierung übernehmen die Routine —\nder Mensch entscheidet.", { x: 44, y: 72, w: 50, align: "right" })], "slide"),
    Slide("snap", "#0a1030", [L(bg4, "Hintergrund", 16, 0.08)],
      [T("kicker", "WIRKUNG", { x: 20, y: 30, w: 60, align: "center" }), T("title", "−70 %", { x: 20, y: 38, w: 60, align: "center" }), T("body", "weniger manuelle Schritte (Platzhalter — anpassen).", { x: 20, y: 64, w: 60, align: "center" })], "zoom"),
    Slide("snap", "#0a0e16", [L(bg5, "Hintergrund", 12, 0.1)],
      [T("title", "Lass uns starten.", { x: 20, y: 40, w: 60, align: "center" }), T("subtitle", "vorname.nachname@example.com", { x: 20, y: 60, w: 60, align: "center" })], "fade"),
  ];
  const nav = [
    { id: uid(), label: "Problem", type: "slide", target: slides[1].id },
    { id: uid(), label: "Lösung", type: "slide", target: slides[2].id },
    { id: uid(), label: "Wirkung", type: "slide", target: slides[3].id },
  ];
  return finalize("Projekt-Pitch", "sky", slides, nav);
}

/* ---------- Quartals-Update (Business/Team) ---------- */
async function buildUpdate() {
  const bg1 = await img(G.skyGrad(["#06231c", "#0e4a38", "#1f8a64"], { cx: 0.5, cy: 0.66, r: 0.44, color: "#a7f0d8" }));
  const bg2 = await img(G.skyGrad(["#08130f", "#10241c", "#1a3a2c"]));
  const bg3 = await img(G.blobsBg("#08130f", ["#1f8a64", "#3fd6a0"], 9));
  const bg4 = await img(G.skyGrad(["#08130f", "#12241c", "#1c3a2c"]));
  const slides = [
    Slide("wonder", "#06231c", [L(bg1, "Hintergrund", 12, 0.12)],
      [T("kicker", "Q3 · UPDATE", { x: 8, y: 26 }), T("title", "Wo wir\nstehen", { x: 8, y: 34, w: 56 }), T("subtitle", "Team Intelligent Automation", { x: 8, y: 72, w: 50 })]),
    Slide("snap", "#08130f", [L(bg2, "Hintergrund", 14)],
      [T("kicker", "HIGHLIGHTS", { x: 8, y: 22 }), T("title", "Drei Meilensteine", { x: 8, y: 30, w: 60 }), T("body", "• Prozess X live geschaltet\n• Copilot-Pilot gestartet\n• Governance-Standard v1 freigegeben", { x: 8, y: 60, w: 56 })], "slide"),
    Slide("snap", "#08130f", [L(bg3, "Hintergrund", 16, 0.08)],
      [T("kicker", "IN ZAHLEN", { x: 20, y: 28, w: 60, align: "center" }), T("title", "12", { x: 20, y: 36, w: 60, align: "center" }), T("body", "automatisierte Prozesse im Quartal (Platzhalter).", { x: 20, y: 64, w: 60, align: "center" })], "zoom"),
    Slide("snap", "#08130f", [L(bg4, "Hintergrund", 12, 0.1)],
      [T("kicker", "AUSBLICK", { x: 50, y: 24, w: 44, align: "right" }), T("title", "Was Q4\nbringt", { x: 42, y: 32, w: 52, align: "right" }), T("body", "Skalierung, Schulungen und neue Use-Cases.", { x: 46, y: 72, w: 48, align: "right" })], "slide"),
  ];
  const nav = [
    { id: uid(), label: "Highlights", type: "slide", target: slides[1].id },
    { id: uid(), label: "Zahlen", type: "slide", target: slides[2].id },
    { id: uid(), label: "Ausblick", type: "slide", target: slides[3].id },
  ];
  return finalize("Quartals-Update", "mint", slides, nav);
}

/* ---------- Roadmap (Business) ---------- */
async function buildRoadmap() {
  const bg1 = await img(G.skyGrad(["#0a1230", "#1b3a6b", "#2f6f9e"], { cx: 0.5, cy: 0.66, r: 0.45, color: "#bcd0ff" }));
  const bg2 = await img(G.skyGrad(["#0a1018", "#142236", "#1d3450"]));
  const axis = await img(G.svgURL('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><line x1="130" y1="470" x2="1470" y2="470" stroke="#ffffff" stroke-opacity="0.22" stroke-width="2"/><g fill="#5aa6ff">' + [240, 620, 1000, 1380].map((x) => `<circle cx="${x}" cy="470" r="7"/>`).join("") + "</g></svg>"));
  const bg3 = await img(G.skyGrad(["#0a0e16", "#141c2a", "#24324a"]));
  const col = (kx, label, body) => [T("kicker", label, { x: kx, y: 40, w: 20 }), T("body", body, { x: kx, y: 56, w: 20 })];
  const slides = [
    Slide("wonder", "#0a1230", [L(bg1, "Hintergrund", 12, 0.12)],
      [T("kicker", "ROADMAP", { x: 8, y: 26 }), T("title", "Der Weg\nnach vorn", { x: 8, y: 34, w: 56 }), T("subtitle", "2026", { x: 8, y: 72, w: 50 })]),
    Slide("snap", "#0a1018", [L(bg2, "Hintergrund", 12), L(axis, "Zeitachse", 18)],
      [T("kicker", "PHASEN", { x: 8, y: 18 }), ...col(8, "Q1", "Discovery & Scope"), ...col(31, "Q2", "Pilot & Aufbau"), ...col(54, "Q3", "Rollout"), ...col(77, "Q4", "Skalierung")], "slide"),
    Slide("snap", "#0a0e16", [L(bg3, "Hintergrund", 12, 0.1)],
      [T("kicker", "MEILENSTEINE", { x: 8, y: 24 }), T("title", "Was zählt", { x: 8, y: 32, w: 56 }), T("body", "• Erster Prozess live\n• Schulung des Teams\n• Governance verankert", { x: 8, y: 60, w: 56 })], "slide"),
    Slide("snap", "#0a1230", [L(bg1, "Hintergrund", 12, 0.1)],
      [T("title", "Fragen?", { x: 20, y: 42, w: 60, align: "center" })], "fade"),
  ];
  return finalize("Roadmap", "sky", slides, []);
}

/* ---------- Team & Onboarding (Team) ---------- */
async function buildTeam() {
  const bg1 = await img(G.blobsBg("#1a0a12", ["#ff6f61", "#ffb199", "#7a2e63"], 11));
  const bg2 = await img(G.skyGrad(["#160a10", "#2a1018", "#3a1622"]));
  const bg3 = await img(G.skyGrad(["#160a10", "#2a141c", "#451f2e"], { cx: 0.7, cy: 0.34, r: 0.42, color: "#ffb199" }));
  const bg4 = await img(G.blobsBg("#160a10", ["#ff6f61", "#7a2e63"], 8));
  const slides = [
    Slide("wonder", "#1a0a12", [L(bg1, "Hintergrund", 12, 0.1)],
      [T("kicker", "WILLKOMMEN", { x: 8, y: 26 }), T("title", "Das Team", { x: 8, y: 34, w: 56 }), T("subtitle", "Intelligent Automation", { x: 8, y: 72, w: 50 })]),
    Slide("snap", "#160a10", [L(bg2, "Hintergrund", 14)],
      [T("kicker", "WER WIR SIND", { x: 8, y: 24 }), T("title", "Klein,\nschlagkräftig", { x: 8, y: 32, w: 56 }), T("body", "Wir verbinden Prozesse, KI und Pragmatismus —\nund liefern.", { x: 8, y: 70, w: 52 })], "slide"),
    Slide("snap", "#160a10", [L(bg3, "Hintergrund", 14)],
      [T("kicker", "SO ARBEITEN WIR", { x: 46, y: 24, w: 48, align: "right" }), T("title", "Vom Problem\nzur Lösung", { x: 40, y: 32, w: 54, align: "right" }), T("body", "Entdecken → Bauen → Skalieren.", { x: 48, y: 72, w: 46, align: "right" })], "slide"),
    Slide("snap", "#160a10", [L(bg4, "Hintergrund", 12, 0.1)],
      [T("title", "Schön, dass\ndu da bist.", { x: 20, y: 38, w: 60, align: "center" })], "fade"),
  ];
  const nav = [
    { id: uid(), label: "Team", type: "slide", target: slides[1].id },
    { id: uid(), label: "Arbeit", type: "slide", target: slides[2].id },
  ];
  return finalize("Team & Onboarding", "coral", slides, nav);
}

/* ---------- Galerie-Index ---------- */
export const EXAMPLES = [
  { key: "grundlagen", name: "Grundlagen-Demo", desc: "Der Schnellstart: Wonder-Hero plus geschichtete Snap-Szenen.", grad: "linear-gradient(135deg,#1d2f86,#a85fa0,#f4a071)", build: () => import("./seed.js").then((m) => m.buildSeedDeck()) },
  { key: "swiss", name: "Landing · Snap-Scroll Website", desc: "Website-Look wie eine Landingpage (Swiss-Stil, wie reference.html): Kopfzeile + 3 Sektionen.", grad: "linear-gradient(135deg,#1c1b19,#5f574c)", build: buildSwiss },
  { key: "pitch", name: "Projekt-Pitch", desc: "Business-Pitch: Problem · Lösung · Wirkung · Call-to-Action.", grad: "linear-gradient(135deg,#0a1230,#2f6f9e)", build: buildPitch },
  { key: "update", name: "Quartals-Update", desc: "Status-Update: Highlights, Kennzahlen, Ausblick.", grad: "linear-gradient(135deg,#06231c,#3fd6a0)", build: buildUpdate },
  { key: "roadmap", name: "Roadmap", desc: "Zeitachse mit Phasen (Q1–Q4) und Meilensteinen.", grad: "linear-gradient(135deg,#0a1230,#5aa6ff)", build: buildRoadmap },
  { key: "team", name: "Team & Onboarding", desc: "Team-Vorstellung & Einstieg für Kolleg:innen.", grad: "linear-gradient(135deg,#ff6f61,#7a2e63)", build: buildTeam },
  { key: "aurora", name: "Aurora · Keynote", desc: "Produkt-Launch im Keynote-Stil: Weltraum, leuchtender Orb, große Zahlen.", grad: "radial-gradient(circle at 50% 42%,#8aa0ff,#101636 72%)", build: buildAurora },
  { key: "eon", name: "E.ON Expert Services", desc: "Markenvorlage aus dem PowerPoint-Master: E.ON-Rot, Brix-Sans-Schrift — cinematisch, Platzhalter zum Anpassen.", grad: "linear-gradient(135deg,#ea1b0a,#9d1207,#700e61)", build: buildEon },
  { key: "journey", name: "Journey · Reise", desc: "Durchlaufbare 2.5D-Welt: ein Pfad, Stationen tauchen auf, während du gehst.", grad: "linear-gradient(135deg,#243a8a,#8aa0ff)", build: buildJourney },
  { key: "wanderlust", name: "Wanderlust · Reise", desc: "Kreativ-Story mit echter Tiefe: Berge, Täler und Meer.", grad: "linear-gradient(135deg,#16244e,#c2738e,#f0a36a)", build: buildWanderlust },
  { key: "nova", name: "Studio Nova · Portfolio", desc: "Knallige Kreativ-Agentur: Farb-Blobs und fette Typo.", grad: "linear-gradient(135deg,#ff5a8a,#7a5bff,#3cc8ff)", build: buildStudioNova },
  { key: "stille", name: "Stille · Minimalismus", desc: "Poesie pur: viel Weißraum, ein Gedanke pro Folie.", grad: "linear-gradient(135deg,#2a2630,#46303c)", build: buildStille },
];
