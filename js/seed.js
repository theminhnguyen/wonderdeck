/* ===================================================================
   seed.js — Demo-Deck beim ersten Start (Grundlagen-Beispiel).
   Grafiken kommen aus gfx.js, landen im IndexedDB-images-Store.
   =================================================================== */
import * as db from "./db.js";
import { uid, createSlide, createLayer, createText } from "./state.js";
import { skyWonder, foliageCorners, gradientScene, skyGrad, ridge, ridgeFigure } from "./gfx.js";

export async function buildSeedDeck() {
  const imgs = {
    sky:      { id: uid(), url: skyWonder() },
    foliage:  { id: uid(), url: foliageCorners() },
    sky2:     { id: uid(), url: skyGrad(["#0c1a4a", "#3b2a6b", "#8a3d6b", "#e0683f", "#f4b06a"], { cx: 0.5, cy: 0.7, r: 0.45, color: "#ffd9a0" }) },
    mtnFar:   { id: uid(), url: ridge("#3a3f66", 540, 150, 11, 50) },
    mtnNear:  { id: uid(), url: ridgeFigure("#0c1228", 720, 110, 9) },
    sky3:     { id: uid(), url: skyGrad(["#04212e", "#0c4a55", "#1f8a82", "#7fd6b0", "#ffe6a0"], { cx: 0.28, cy: 0.34, r: 0.42, color: "#fff0c0" }) },
    hillFar:  { id: uid(), url: ridge("#0e5a55", 600, 90, 8, 30) },
    hillNear: { id: uid(), url: ridge("#04332f", 760, 70, 7, 20) },
    scene4:   { id: uid(), url: gradientScene("#2a1640", "#7a2e63", "#e06a4e", "#ffd28a") },
  };
  for (const v of Object.values(imgs)) await db.putImage(v.id, v.url);

  const layer = (id, name, parallax, kenburns = 0, reactive = false) => {
    const l = createLayer({ imageId: id, name });
    l.parallax = parallax; l.kenburns = kenburns; l.reactive = reactive;
    return l;
  };
  const T = (role, text, props = {}) => Object.assign(createText(role), { text, ...props });

  const s1 = createSlide({ style: "wonder" });
  s1.bg = "#0a1118";
  s1.layers = [layer(imgs.sky.id, "Himmel", 14, 0.14), layer(imgs.foliage.id, "Laub (reaktiv)", 8, 0, true)];
  s1.texts = [T("kicker", "WILLKOMMEN", { x: 8, y: 26 }), T("title", "Step Into\nWonder", { x: 8, y: 34 }),
    T("subtitle", "Bewege die Maus — Tiefe, Licht und Ebenen\nstatt langweiliger Bullet-Points.", { x: 8, y: 70, w: 42 })];

  const s2 = createSlide({ style: "snap" });
  s2.bg = "#0c1a4a";
  s2.layers = [layer(imgs.sky2.id, "Himmel", 10, 0.08), layer(imgs.mtnFar.id, "Berge (fern)", 28), layer(imgs.mtnNear.id, "Vordergrund + Figur", 52)];
  s2.texts = [T("kicker", "KAPITEL 01 · AUFBRUCH", { x: 8, y: 22 }), T("title", "Ins\nUngewisse", { x: 8, y: 30 }),
    T("body", "Jede Ebene bewegt sich unterschiedlich stark mit der Maus —\nso entsteht echte Tiefe. Am besten im Präsentationsmodus ansehen.", { x: 8, y: 78, w: 52 })];

  const s3 = createSlide({ style: "snap" });
  s3.bg = "#04212e";
  s3.layers = [layer(imgs.sky3.id, "Himmel", 12, 0.1), layer(imgs.hillFar.id, "Hügel (fern)", 26), layer(imgs.hillNear.id, "Vordergrund", 46)];
  s3.texts = [T("kicker", "KAPITEL 02 · WEITE", { x: 50, y: 24, w: 44, align: "right" }), T("title", "Erzähl deine\nGeschichte", { x: 38, y: 32, w: 56, align: "right" }),
    T("body", "Titel rechts, Text wohin du willst — Position frei einstellbar.", { x: 46, y: 74, w: 48, align: "right" })];

  const s4 = createSlide({ style: "snap" });
  s4.bg = "#2a1640";
  s4.layers = [layer(imgs.scene4.id, "Hintergrund", 16, 0.12)];
  s4.texts = [T("title", "Danke.", { x: 20, y: 40, w: 60, align: "center" }), T("subtitle", "Erstellt mit WonderDeck ✦", { x: 20, y: 60, w: 60, align: "center" })];

  const deck = { id: uid(), title: "WonderDeck — Demo", slides: [s1, s2, s3, s4], createdAt: Date.now() };
  await db.saveDeck(structuredClone(deck));
  localStorage.setItem("wonderdeck:currentDeckId", deck.id);
  return deck;
}
