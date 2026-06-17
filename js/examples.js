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
function Slide(style, bg, layers, texts, transition) {
  const s = createSlide({ style }); s.bg = bg; s.layers = layers; s.texts = texts;
  if (transition) s.transition = transition;
  return s;
}
async function finalize(title, theme, slides) {
  const deck = { id: uid(), title, theme, slides, createdAt: Date.now() };
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

/* ---------- Galerie-Index ---------- */
export const EXAMPLES = [
  { key: "grundlagen", name: "Grundlagen-Demo", desc: "Der Schnellstart: Wonder-Hero plus geschichtete Snap-Szenen.", grad: "linear-gradient(135deg,#1d2f86,#a85fa0,#f4a071)", build: () => import("./seed.js").then((m) => m.buildSeedDeck()) },
  { key: "aurora", name: "Aurora · Keynote", desc: "Produkt-Launch im Keynote-Stil: Weltraum, leuchtender Orb, große Zahlen.", grad: "radial-gradient(circle at 50% 42%,#8aa0ff,#101636 72%)", build: buildAurora },
  { key: "wanderlust", name: "Wanderlust · Reise", desc: "Reise-Story mit echter Tiefe: Berge, Täler und Meer.", grad: "linear-gradient(135deg,#16244e,#c2738e,#f0a36a)", build: buildWanderlust },
  { key: "nova", name: "Studio Nova · Portfolio", desc: "Knallige Kreativ-Agentur: Farb-Blobs und fette Typo.", grad: "linear-gradient(135deg,#ff5a8a,#7a5bff,#3cc8ff)", build: buildStudioNova },
  { key: "stille", name: "Stille · Minimalismus", desc: "Poesie pur: viel Weißraum, ein Gedanke pro Folie.", grad: "linear-gradient(135deg,#2a2630,#46303c)", build: buildStille },
];
