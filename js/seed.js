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

export async function buildSeedDeck() {
  const imgs = {
    sky: { id: uid(), url: skyWonder() },
    foliage: { id: uid(), url: foliageCorners() },
    scene2: { id: uid(), url: gradientScene("#0b2a3a", "#13506b", "#1f8a8a", "#a7f0d8") },
    scene3: { id: uid(), url: gradientScene("#2a1640", "#7a2e63", "#e06a4e", "#ffd28a") },
  };
  for (const v of Object.values(imgs)) await db.putImage(v.id, v.url);

  // Folie 1 — Wonder-Hero
  const s1 = createSlide({ style: "wonder" });
  s1.bg = "#0a1118";
  const bg1 = createLayer({ imageId: imgs.sky.id, name: "Himmel" });
  bg1.parallax = 14; bg1.kenburns = 0.14;
  const fol = createLayer({ imageId: imgs.foliage.id, name: "Laub (reaktiv)" });
  fol.parallax = 8; fol.reactive = true;
  s1.layers = [bg1, fol];
  s1.texts = [
    Object.assign(createText("kicker"), { text: "WILLKOMMEN", x: 8, y: 26 }),
    Object.assign(createText("title"), { text: "Step Into\nWonder", x: 8, y: 34 }),
    Object.assign(createText("subtitle"), {
      text: "So fühlt sich eine Folie an, wenn du die Maus bewegst.\nLayer, Tiefe, Licht — statt langweiliger Bullet-Points.",
      x: 8, y: 70, w: 42,
    }),
  ];

  // Folie 2 — Snap-Szene
  const s2 = createSlide({ style: "snap" });
  const bg2 = createLayer({ imageId: imgs.scene2.id, name: "Hintergrund" });
  bg2.parallax = 22; bg2.kenburns = 0.1;
  s2.layers = [bg2];
  s2.texts = [
    Object.assign(createText("kicker"), { text: "KAPITEL 01", x: 8, y: 28 }),
    Object.assign(createText("title"), { text: "Erzähl deine\nGeschichte", x: 8, y: 36 }),
    Object.assign(createText("body"), {
      text: "Jede Folie hat einen Stil, eigene Ebenen und Texte.\nScrolle, klicke oder nutze die Pfeiltasten — die Übergänge gleiten.",
      x: 8, y: 70, w: 46,
    }),
  ];

  // Folie 3 — Abschluss
  const s3 = createSlide({ style: "snap" });
  const bg3 = createLayer({ imageId: imgs.scene3.id, name: "Hintergrund" });
  bg3.parallax = 18; bg3.kenburns = 0.12;
  s3.layers = [bg3];
  s3.texts = [
    Object.assign(createText("title"), { text: "Danke.", x: 20, y: 40, w: 60, align: "center" }),
    Object.assign(createText("subtitle"), { text: "Erstellt mit WonderDeck ✦", x: 20, y: 60, w: 60, align: "center" }),
  ];

  const deck = { id: uid(), title: "WonderDeck — Demo", slides: [s1, s2, s3], createdAt: Date.now() };
  await db.saveDeck(structuredClone(deck));
  localStorage.setItem("wonderdeck:currentDeckId", deck.id);
  return deck;
}
