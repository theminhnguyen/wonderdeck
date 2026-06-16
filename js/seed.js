/* ===================================================================
   seed.js — Demo-Deck beim ersten Start (3 Folien).
   Hintergründe sind selbst erzeugte SVG-Data-URLs (keine Uploads nötig),
   landen im IndexedDB-images-Store und werden von Ebenen referenziert.
   =================================================================== */
import * as db from "./db.js";
import { uid, createSlide, createLayer, createText } from "./state.js";

const svgURL = (svg) => "data:image/svg+xml," + encodeURIComponent(svg.replace(/\s+/g, " ").trim());

function skyWonder() {
  return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1d2f86"/><stop offset="0.3" stop-color="#5455a8"/>
        <stop offset="0.55" stop-color="#a85fa0"/><stop offset="0.75" stop-color="#e07a96"/>
        <stop offset="1" stop-color="#f4a071"/>
      </linearGradient>
      <radialGradient id="s" cx="0.5" cy="0.62" r="0.4">
        <stop offset="0" stop-color="#fff3d8" stop-opacity="0.8"/><stop offset="1" stop-color="#fff3d8" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="v" cx="0.5" cy="0.5" r="0.75">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#05130a" stop-opacity="0.6"/>
      </radialGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#g)"/>
    <ellipse cx="800" cy="600" rx="300" ry="230" fill="url(#s)"/>
    <g fill="#14301a">
      <ellipse cx="60" cy="880" rx="380" ry="220" opacity="0.9"/>
      <ellipse cx="1560" cy="880" rx="380" ry="220" opacity="0.9"/>
      <ellipse cx="800" cy="980" rx="900" ry="220" opacity="0.85"/>
    </g>
    <rect width="1600" height="900" fill="url(#v)"/>
  </svg>`);
}

function foliageCorners() {
  const greens = ["#1d3f20", "#274f27", "#326332", "#3f7a3a", "#52985f"];
  const corners = [[0, 0], [1600, 0], [0, 900], [1600, 900]];
  let s = "";
  for (const [ox, oy] of corners) {
    const sx = ox ? -1 : 1, sy = oy ? -1 : 1; // ins Bild hinein
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.random() ** 0.6 * 360;
      const cx = ox + sx * Math.abs(Math.cos(a) * d);
      const cy = oy + sy * Math.abs(Math.sin(a) * d);
      const r = 30 + Math.random() * 50;
      s += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${r.toFixed(0)}" fill="${greens[(Math.random() * greens.length) | 0]}" opacity="0.85"/>`;
    }
  }
  return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">${s}</svg>`);
}

function gradientScene(a, b, c, sun) {
  return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/>
      </linearGradient>
      <radialGradient id="s" cx="0.72" cy="0.3" r="0.5">
        <stop offset="0" stop-color="${sun}" stop-opacity="0.55"/><stop offset="1" stop-color="${sun}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#g)"/>
    <circle cx="1150" cy="270" r="430" fill="url(#s)"/>
    <ellipse cx="800" cy="1000" rx="1100" ry="260" fill="#000" opacity="0.22"/>
  </svg>`);
}

/* Himmel-Verlauf (deckend) mit optionalem Sonnen-Glow. */
function skyGrad(stops, sun) {
  const st = stops
    .map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`)
    .join("");
  const sunDef = sun
    ? `<radialGradient id="s" cx="${sun.cx}" cy="${sun.cy}" r="${sun.r}"><stop offset="0" stop-color="${sun.color}" stop-opacity="0.8"/><stop offset="1" stop-color="${sun.color}" stop-opacity="0"/></radialGradient>`
    : "";
  const sunRect = sun ? `<rect width="1600" height="900" fill="url(#s)"/>` : "";
  return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${st}</linearGradient>${sunDef}</defs>
    <rect width="1600" height="900" fill="url(#g)"/>${sunRect}</svg>`);
}

/* Silhouetten-Band (transparent) — für Berge/Hügel als eigene Tiefen-Ebene. */
function ridge(fill, base, amp, n, jitter) {
  let p = `0,901 0,${base}`;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * 1600;
    const y = base - Math.abs(Math.sin(i * 1.3 + 0.5)) * amp - Math.random() * jitter;
    p += ` ${x.toFixed(0)},${y.toFixed(0)}`;
  }
  p += ` 1600,901`;
  return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><polygon points="${p}" fill="${fill}"/></svg>`);
}

/* Vordergrund-Grat mit einer einzelnen Figur (transparent). */
function ridgeFigure(fill, base, amp, n) {
  let p = `0,901 0,${base}`;
  for (let i = 0; i <= n; i++) {
    const x = (i / n) * 1600;
    const y = base - Math.abs(Math.sin(i * 0.9 + 0.3)) * amp - Math.random() * 18;
    p += ` ${x.toFixed(0)},${y.toFixed(0)}`;
  }
  p += ` 1600,901`;
  const fig = `<ellipse cx="822" cy="706" rx="120" ry="40" fill="${fill}"/>
    <g fill="${fill}"><circle cx="822" cy="612" r="11"/>
    <path d="M810 624 q12 -7 24 0 l-4 70 -7 0 -3 -40 -3 40 -7 0 z"/></g>`;
  return svgURL(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><polygon points="${p}" fill="${fill}"/>${fig}</svg>`);
}

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

  // 1 — Wonder-Hero
  const s1 = createSlide({ style: "wonder" });
  s1.bg = "#0a1118";
  s1.layers = [layer(imgs.sky.id, "Himmel", 14, 0.14), layer(imgs.foliage.id, "Laub (reaktiv)", 8, 0, true)];
  s1.texts = [
    Object.assign(createText("kicker"), { text: "WILLKOMMEN", x: 8, y: 26 }),
    Object.assign(createText("title"), { text: "Step Into\nWonder", x: 8, y: 34 }),
    Object.assign(createText("subtitle"), { text: "Bewege die Maus — Tiefe, Licht und Ebenen\nstatt langweiliger Bullet-Points.", x: 8, y: 70, w: 42 }),
  ];

  // 2 — Snap: geschichtete Bergszene (zeigt die Parallax-Tiefe)
  const s2 = createSlide({ style: "snap" });
  s2.bg = "#0c1a4a";
  s2.layers = [
    layer(imgs.sky2.id, "Himmel", 10, 0.08),
    layer(imgs.mtnFar.id, "Berge (fern)", 28),
    layer(imgs.mtnNear.id, "Vordergrund + Figur", 52),
  ];
  s2.texts = [
    Object.assign(createText("kicker"), { text: "KAPITEL 01 · AUFBRUCH", x: 8, y: 22 }),
    Object.assign(createText("title"), { text: "Ins\nUngewisse", x: 8, y: 30 }),
    Object.assign(createText("body"), { text: "Jede Ebene bewegt sich unterschiedlich stark mit der Maus —\nso entsteht echte Tiefe. Am besten im Präsentationsmodus ansehen.", x: 8, y: 78, w: 52 }),
  ];

  // 3 — Snap: andere Stimmung, Text rechts
  const s3 = createSlide({ style: "snap" });
  s3.bg = "#04212e";
  s3.layers = [
    layer(imgs.sky3.id, "Himmel", 12, 0.1),
    layer(imgs.hillFar.id, "Hügel (fern)", 26),
    layer(imgs.hillNear.id, "Vordergrund", 46),
  ];
  s3.texts = [
    Object.assign(createText("kicker"), { text: "KAPITEL 02 · WEITE", x: 50, y: 24, w: 44, align: "right" }),
    Object.assign(createText("title"), { text: "Erzähl deine\nGeschichte", x: 38, y: 32, w: 56, align: "right" }),
    Object.assign(createText("body"), { text: "Titel rechts, Text wohin du willst — Position frei einstellbar.", x: 46, y: 74, w: 48, align: "right" }),
  ];

  // 4 — Abschluss
  const s4 = createSlide({ style: "snap" });
  s4.bg = "#2a1640";
  s4.layers = [layer(imgs.scene4.id, "Hintergrund", 16, 0.12)];
  s4.texts = [
    Object.assign(createText("title"), { text: "Danke.", x: 20, y: 40, w: 60, align: "center" }),
    Object.assign(createText("subtitle"), { text: "Erstellt mit WonderDeck ✦", x: 20, y: 60, w: 60, align: "center" }),
  ];

  const deck = { id: uid(), title: "WonderDeck — Demo", slides: [s1, s2, s3, s4], createdAt: Date.now() };
  await db.saveDeck(structuredClone(deck));
  localStorage.setItem("wonderdeck:currentDeckId", deck.id);
  return deck;
}
