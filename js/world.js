/* ===================================================================
   world.js — "3D-Welt": begehbares Comic-Museum (Three.js).
   - DRITTE PERSON: eine Figur, gesteuert NUR mit Tastatur (WASD/Pfeile),
     keine Maus. Kamera folgt der Figur (Diorama-Blick).
   - Comic/Toon-Look + koreanische Museums-Elemente (Papierlaternen,
     Dancheong-Balken, Steinlaternen, Eingangstor).
   - Folien werden zu Ausstellungs-Tafeln; Nähe + E öffnet Details.
   - Sprechblasen-Tutorial am Anfang erklärt die Steuerung.
   Three.js via Import-Map (CDN), kein Build.
   =================================================================== */
import * as THREE from "three";
import { themeVars } from "./themes.js";

const el = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esc = (s) => String(s == null ? "" : s).replace(/[<&>]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" }[c]));
function hexA(hex, a) {
  let h = String(hex || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return "rgba(255,255,255," + a + ")";
  return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")";
}

let active = null;

/* ---------- Folie -> Canvas-Textur (für die Tafel) ---------- */
function coverDraw(ctx, img, w, h) {
  const r = Math.max(w / img.width, h / img.height);
  const iw = img.width * r, ih = img.height * r;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}
function wrapText(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(/\s+/);
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; }
    else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}
function slideToCanvas(slide, c, resolveSrc) {
  return new Promise((resolve) => {
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 576;
    const ctx = cv.getContext("2d");
    const text = (role) => (slide.texts || []).find((t) => t.role === role);
    const draw = (img) => {
      ctx.fillStyle = slide.bg || "#0a0e16"; ctx.fillRect(0, 0, 1024, 576);
      if (img) {
        coverDraw(ctx, img, 1024, 576);
        const g = ctx.createLinearGradient(0, 576, 0, 0);
        g.addColorStop(0, "rgba(0,0,0,0.82)"); g.addColorStop(0.55, "rgba(0,0,0,0.2)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 576);
      } else {
        const rg = ctx.createRadialGradient(330, 250, 40, 330, 250, 760);
        rg.addColorStop(0, hexA(c.accent, 0.26)); rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg; ctx.fillRect(0, 0, 1024, 576);
        const lg = ctx.createLinearGradient(0, 0, 0, 576);
        lg.addColorStop(0, "rgba(255,255,255,0.08)"); lg.addColorStop(0.6, "rgba(255,255,255,0)");
        ctx.fillStyle = lg; ctx.fillRect(0, 0, 1024, 576);
      }
      ctx.textBaseline = "alphabetic";
      const pad = 60;
      const k = text("kicker"), ti = text("title"), su = text("subtitle") || text("body");
      let y = 372;
      if (k) { ctx.fillStyle = c.accent; ctx.font = "600 22px " + c.fontBody; ctx.fillText((k.text || "").toUpperCase().replace(/\n/g, " "), pad, y); }
      if (ti) { ctx.fillStyle = c.ink; ctx.font = "700 62px " + c.fontTitle; y = wrapText(ctx, (ti.text || "").replace(/\n/g, " "), pad, 452, 904, 62); }
      if (su) { ctx.fillStyle = c.ink; ctx.globalAlpha = 0.85; ctx.font = "300 26px " + c.fontBody; wrapText(ctx, (su.text || "").replace(/\n/g, " "), pad, y + 18, 884, 32); ctx.globalAlpha = 1; }
      resolve(cv);
    };
    const layer = (slide.layers || []).find((l) => resolveSrc(l));
    const src = layer ? resolveSrc(layer) : null;
    if (src) { const img = new Image(); img.onload = () => draw(img); img.onerror = () => draw(null); img.src = src; }
    else draw(null);
  });
}

/* ---------- Dancheong-Muster (koreanische Bemalung) als Textur ---------- */
function dancheongTexture(THREE) {
  const cv = document.createElement("canvas"); cv.width = 256; cv.height = 48; const c = cv.getContext("2d");
  c.fillStyle = "#1f6f4a"; c.fillRect(0, 0, 256, 48);
  const cols = ["#c0392b", "#2e6fb0", "#e8c33a", "#f4f1ea"];
  for (let x = 0, i = 0; x < 256; x += 32, i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(x + 6, 8, 20, 32); }
  c.fillStyle = "#102a1c"; c.fillRect(0, 0, 256, 5); c.fillRect(0, 43, 256, 5);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- Minimalistische, weiche Figur (ruhig, cel-shaded — abeto-Stil) ---------- */
function makeHero(THREE, accentHex) {
  const g = new THREE.Group();
  const ac = new THREE.Color(accentHex); const h = {}; ac.getHSL(h);
  const robe = new THREE.MeshToonMaterial({ color: new THREE.Color().setHSL(h.h, Math.min(h.s, 0.34), 0.7).getHex() }); // sanftes Pastell, dezent am Theme
  const skin = new THREE.MeshToonMaterial({ color: 0xf3d6bf });
  const dark = new THREE.MeshToonMaterial({ color: 0x2a2622 });
  const out = new THREE.MeshBasicMaterial({ color: 0x2a2622, side: THREE.BackSide });
  const add = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (sx != null) m.scale.set(sx, sy, sz); g.add(m); return m; };
  const outline = (geo, x, y, z, s, sy, sz) => { const m = new THREE.Mesh(geo, out); m.position.set(x, y, z); m.scale.set(s, sy == null ? s : sy, sz == null ? s : sz); g.add(m); };

  const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.46, 6, 16);
  const headGeo = new THREE.SphereGeometry(0.28, 20, 16);
  outline(bodyGeo, 0, 0.62, 0, 1.1);
  outline(headGeo, 0, 1.18, 0, 1.09);
  add(bodyGeo, robe, 0, 0.62, 0);
  add(headGeo, skin, 0, 1.18, 0);
  // dezenter Haarschopf statt lautem Hut
  add(new THREE.SphereGeometry(0.22, 14, 10), dark, 0, 1.3, -0.03, 1, 0.62, 1);
  add(new THREE.SphereGeometry(0.05, 8, 8), dark, 0, 1.46, -0.02);
  // Augen (Gesicht zeigt +Z)
  const eyeGeo = new THREE.SphereGeometry(0.035, 8, 8);
  add(eyeGeo, dark, -0.1, 1.19, 0.255); add(eyeGeo, dark, 0.1, 1.19, 0.255);
  // Wangen-Tupfer
  const cheek = new THREE.MeshToonMaterial({ color: 0xeaa48f });
  add(new THREE.SphereGeometry(0.05, 8, 8), cheek, -0.18, 1.12, 0.22, 1, 0.6, 0.35);
  add(new THREE.SphereGeometry(0.05, 8, 8), cheek, 0.18, 1.12, 0.22, 1, 0.6, 0.35);
  // Ärmchen
  for (const sx of [-1, 1]) add(new THREE.CapsuleGeometry(0.07, 0.2, 4, 8), robe, sx * 0.33, 0.62, 0);
  return g;
}

/* ---------- Welt öffnen ---------- */
export async function openWorld(deck, resolveSrc, onClose = null) {
  if (active) active.close();
  const overlay = el("world"), stage = el("worldStage"), loader = el("worldLoad"), hintEl = el("worldHint"), bubbleEl = el("worldBubble");
  overlay.hidden = false; loader.hidden = false; el("worldPanel").hidden = true;
  el("worldCross").hidden = true;
  if (bubbleEl) bubbleEl.hidden = true;

  const tv = themeVars(deck.theme);
  const accent = tv["--accent"], ink = tv["--ink"], fontTitle = tv["--font-title"], fontBody = tv["--font-body"];
  el("worldPanel").style.setProperty("--accent", accent);
  el("worldPanel").style.setProperty("--ink", ink);
  await (document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve());

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.innerHTML = ""; stage.appendChild(renderer.domElement);

  const acc = new THREE.Color(accent);
  const hsl = {}; acc.getHSL(hsl);
  const tint = (l, s) => new THREE.Color().setHSL(hsl.h, Math.min(hsl.s, s == null ? 0.4 : s), l);
  const bgCol = tint(0.52, 0.14);
  const scene = new THREE.Scene();
  scene.background = bgCol;
  scene.fog = new THREE.Fog(bgCol, 34, 130);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 240);

  scene.add(new THREE.HemisphereLight(tint(0.95, 0.06).getHex(), tint(0.42, 0.16).getHex(), 1.45));
  scene.add(new THREE.AmbientLight(tint(0.62, 0.1).getHex(), 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 0.75); dir.position.set(6, 18, 8); scene.add(dir);

  const n = deck.slides.length;
  const spacing = 7, halfW = 7.5, hallLen = n * spacing + 18;
  const FRONT_Z = 13;

  const glowEnd = new THREE.PointLight(acc.getHex(), 0.9, 80, 1.3); glowEnd.position.set(0, 3.6, -hallLen + 6); scene.add(glowEnd);

  const disposables = [];
  const obstacles = []; // {x,z,r} für einfache Kollision
  const place = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

  /* ----- Boden, Wände, Decke (Toon = Comic) ----- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, hallLen + 24), new THREE.MeshToonMaterial({ color: tint(0.4, 0.1).getHex() }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = -hallLen / 2 + 6; scene.add(floor);
  const grid = new THREE.GridHelper(hallLen + 24, Math.max(8, Math.round((hallLen + 24) / 2)), tint(0.5, 0.12).getHex(), tint(0.3, 0.1).getHex());
  grid.position.set(0, 0.012, floor.position.z); scene.add(grid);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.8, hallLen + 24), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.2 }));
  runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.02, floor.position.z); scene.add(runner);

  const wallMat = new THREE.MeshToonMaterial({ color: tint(0.56, 0.07).getHex(), side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 24, 6.4), wallMat);
    wall.position.set(sx * halfW, 3.2, floor.position.z); wall.rotation.y = -sx * Math.PI / 2; scene.add(wall);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 24, 0.14), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.4 }));
    strip.position.set(sx * (halfW - 0.01), 4.7, floor.position.z); strip.rotation.y = -sx * Math.PI / 2; scene.add(strip);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, hallLen + 24), new THREE.MeshToonMaterial({ color: tint(0.3, 0.14).getHex() }));
    base.position.set(sx * (halfW - 0.08), 0.2, floor.position.z); scene.add(base);
  }
  for (const [z, ry] of [[FRONT_Z, Math.PI], [-hallLen + 5, 0]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, 6.4), wallMat);
    w.position.set(0, 3.2, z); w.rotation.y = ry; scene.add(w);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, hallLen + 24), new THREE.MeshToonMaterial({ color: tint(0.46, 0.1).getHex(), side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.4, floor.position.z); scene.add(ceil);
  const skylight = new THREE.Mesh(new THREE.PlaneGeometry(2.4, hallLen + 20), new THREE.MeshBasicMaterial({ color: 0xfff4e2 }));
  skylight.rotation.x = Math.PI / 2; skylight.position.set(0, 5.36, floor.position.z); scene.add(skylight);
  for (let z = -4; z > -hallLen + 6; z -= 16) { const sl = new THREE.PointLight(0xfff2e0, 0.45, 26, 1.8); sl.position.set(0, 5.0, z); scene.add(sl); }

  /* ----- Materialien Ausstattung ----- */
  const stoneMat = new THREE.MeshToonMaterial({ color: tint(0.62, 0.06).getHex() });
  const stoneDark = new THREE.MeshToonMaterial({ color: tint(0.44, 0.1).getHex() });
  const woodMat = new THREE.MeshToonMaterial({ color: tint(0.24, 0.28).getHex() });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xb89b5e, roughness: 0.45, metalness: 0.5 });
  const leafMat = new THREE.MeshToonMaterial({ color: 0x6f9a72 }); // gedämpftes Grün
  const potMat = new THREE.MeshToonMaterial({ color: 0xb07a5a }); // weiche Terrakotta
  const beamMat = new THREE.MeshToonMaterial({ color: tint(0.5, 0.1).getHex() }); // schlichte, ruhige Balken (kein lautes Dancheong)
  disposables.push(stoneMat, stoneDark, woodMat, frameMat, leafMat, potMat, beamMat, floor.geometry, floor.material, wallMat, ceil.material, runner.material, skylight.material);

  const colGeo = new THREE.CylinderGeometry(0.4, 0.46, 4.9, 18);
  const fluteGeo = new THREE.BoxGeometry(1.1, 0.42, 1.1);
  const capGeo = new THREE.BoxGeometry(1.0, 0.34, 1.0);
  const beamGeo = new THREE.BoxGeometry(halfW * 2, 0.3, 0.42);
  disposables.push(colGeo, fluteGeo, capGeo, beamGeo);

  const colXs = [-(halfW - 0.7), halfW - 0.7];
  const colZs = []; for (let z = 1; z > -hallLen + 6; z -= 7) colZs.push(z);
  for (const z of colZs) {
    const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.set(0, 5.22, z); scene.add(beam); // Dancheong-Balken
    for (const cx of colXs) {
      const col = new THREE.Mesh(colGeo, stoneMat); col.position.set(cx, 2.65, z); scene.add(col);
      scene.add(place(fluteGeo, stoneDark, cx, 0.21, z));
      scene.add(place(capGeo, stoneDark, cx, 5.02, z));
      obstacles.push({ x: cx, z, r: 0.6 });
    }
  }
  // Wandbilder (Goldrahmen + farbiges Gemälde)
  const artFrameGeo = new THREE.BoxGeometry(2.7, 3.5, 0.14), artFillGeo = new THREE.PlaneGeometry(2.2, 3.0);
  disposables.push(artFrameGeo, artFillGeo);
  const artZs = []; for (let z = -2.5; z > -hallLen + 6; z -= 7) artZs.push(z);
  for (const z of artZs) for (const sx of [-1, 1]) {
    const fr = new THREE.Mesh(artFrameGeo, frameMat); fr.position.set(sx * (halfW - 0.13), 2.7, z); fr.rotation.y = -sx * Math.PI / 2; scene.add(fr);
    const fillMat = new THREE.MeshToonMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.28, 0.62).getHex() });
    const fill = new THREE.Mesh(artFillGeo, fillMat); fill.position.set(sx * (halfW - 0.19), 2.7, z); fill.rotation.y = -sx * Math.PI / 2; scene.add(fill);
    disposables.push(fillMat);
  }
  // Bänke + Pflanzen (Seitengänge)
  const benchSeatGeo = new THREE.BoxGeometry(2.6, 0.18, 0.8), benchLegGeo = new THREE.BoxGeometry(0.18, 0.5, 0.7), potGeo = new THREE.CylinderGeometry(0.34, 0.26, 0.6, 14), leafGeo = new THREE.SphereGeometry(0.58, 12, 10);
  disposables.push(benchSeatGeo, benchLegGeo, potGeo, leafGeo);
  for (let i = 0, z = -5; z > -hallLen + 6; z -= 14, i++) for (const sx of [-1, 1]) {
    const bx = sx * (halfW - 2.3);
    scene.add(place(benchSeatGeo, woodMat, bx, 0.5, z));
    for (const lz of [-0.7, 0.7]) scene.add(place(benchLegGeo, woodMat, bx, 0.25, z + lz));
    if (i % 2 === 0) {
      const px = sx * (halfW - 0.95);
      scene.add(place(potGeo, potMat, px, 0.3, z + 3.5));
      const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.set(px, 0.95, z + 3.5); leaf.scale.set(1, 1.3, 1); scene.add(leaf);
      obstacles.push({ x: px, z: z + 3.5, r: 0.6 });
    }
  }

  /* ----- Papierlaternen (dezent, gedämpft, sanftes Leuchten) ----- */
  const lampCols = [0xc28a6e, 0x7d8bb0, 0xcdb07a]; // weiche Terrakotta / Indigo / Sandgold
  for (let i = 0, z = -6; z > -hallLen + 6; z -= 13, i++) {
    const col = lampCols[i % lampCols.length];
    const g = new THREE.Group(); g.position.set((i % 2 ? 1 : -1) * 1.9, 0, z); scene.add(g);
    g.add(place(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), new THREE.MeshBasicMaterial({ color: 0x3a3a3a }), 0, 4.75, 0));
    g.add(place(new THREE.CylinderGeometry(0.25, 0.25, 0.44, 16), new THREE.MeshBasicMaterial({ color: col }), 0, 4.06, 0));
    g.add(place(new THREE.CylinderGeometry(0.15, 0.19, 0.07, 16), new THREE.MeshBasicMaterial({ color: 0x2a2622 }), 0, 4.31, 0));
    g.add(place(new THREE.CylinderGeometry(0.19, 0.15, 0.07, 16), new THREE.MeshBasicMaterial({ color: 0x2a2622 }), 0, 3.8, 0));
    const pl = new THREE.PointLight(col, 0.35, 8, 2); pl.position.set(0, 3.9, 0); g.add(pl);
  }

  /* ----- Steinlaternen (seokdeung) in den Seitengängen ----- */
  function stoneLantern(x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    g.add(place(new THREE.BoxGeometry(0.7, 0.2, 0.7), stoneMat, 0, 0.1, 0));
    g.add(place(new THREE.CylinderGeometry(0.14, 0.16, 0.9, 10), stoneMat, 0, 0.6, 0));
    g.add(place(new THREE.BoxGeometry(0.5, 0.45, 0.5), stoneMat, 0, 1.25, 0));
    g.add(place(new THREE.BoxGeometry(0.36, 0.4, 0.36), new THREE.MeshBasicMaterial({ color: 0xffd98a }), 0, 1.25, 0));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.35, 4), stoneDark); roof.position.set(0, 1.66, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
    g.add(place(new THREE.SphereGeometry(0.08, 8, 8), stoneDark, 0, 1.88, 0));
    const pl = new THREE.PointLight(0xffcf80, 0.4, 7, 2); pl.position.set(0, 1.25, 0); g.add(pl);
    obstacles.push({ x, z, r: 0.7 });
  }
  for (let z = -10; z > -hallLen + 8; z -= 22) { stoneLantern(-(halfW - 1.5), z); stoneLantern(halfW - 1.5, z); }

  /* ----- Mondtor am Eingang (dezenter asiatischer Hinweis statt lautem Tor) ----- */
  (function moonGate() {
    const z = FRONT_Z - 2.2;
    const gate = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.2, 14, 56), new THREE.MeshToonMaterial({ color: tint(0.66, 0.05).getHex() }));
    gate.position.set(0, 2.7, z); scene.add(gate);
    for (const sx of [-1, 1]) scene.add(place(new THREE.BoxGeometry(0.6, 0.5, 0.6), stoneMat, sx * 2.55, 0.25, z));
  })();

  /* ----- Folien -> Tafeln ----- */
  const boards = [];
  await Promise.all(deck.slides.map(async (slide, i) => {
    const cv = await slideToCanvas(slide, { accent, ink, fontTitle, fontBody }, resolveSrc);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
    const bw = 5.4, bh = (bw * 9) / 16;
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * 2.9, z = -(7 + i * spacing), y = 2.0, ry = -side * 0.26;
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    const outline = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.34, bh + 0.34), new THREE.MeshBasicMaterial({ color: acc.getHex() })); outline.position.z = -0.04; g.add(outline);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.14, bh + 0.14), new THREE.MeshBasicMaterial({ color: 0x14140f })); frame.position.z = -0.02; g.add(frame);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: tex })); g.add(board);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.8, y - bh / 2, 0.95), stoneMat); plinth.position.set(x, (y - bh / 2) / 2, z); scene.add(plinth);
    scene.add(place(new THREE.BoxGeometry(2.0, 0.1, 1.15), stoneDark, x, y - bh / 2, z));
    const fix = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), stoneDark); fix.position.set(x, 5.32, z + 0.9); scene.add(fix);
    if (n <= 10) { const spot = new THREE.SpotLight(0xfff1dc, 22, 12, 0.5, 0.6, 1.4); spot.position.set(x, 5.2, z + 1.2); spot.target.position.set(x, y - 0.2, z); scene.add(spot); scene.add(spot.target); }
    boards.push({ slide, x, z });
    obstacles.push({ x, z, r: 1.25 });
    disposables.push(tex, board.geometry, frame.geometry, outline.geometry, plinth.geometry, board.material, frame.material, outline.material);
  }));

  /* ----- Rückweg-Portal ----- */
  const portalX = 0, portalZ = -hallLen + 7, portalY = 2.1;
  const portalGrp = new THREE.Group(); portalGrp.position.set(portalX, portalY, portalZ); scene.add(portalGrp);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.8), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.12 })); door.position.z = -0.06; portalGrp.add(door);
  const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1.95, 56), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.16 })); glowDisc.position.z = -0.03; portalGrp.add(glowDisc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.12, 16, 80), new THREE.MeshBasicMaterial({ color: acc.getHex() })); portalGrp.add(ring);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.3, 48), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.22, side: THREE.DoubleSide })); floorRing.rotation.x = -Math.PI / 2; floorRing.position.set(0, -2.08, 0.3); portalGrp.add(floorRing);
  portalGrp.add(new THREE.PointLight(acc.getHex(), 1.0, 30, 1.5));
  (function () {
    const cv = document.createElement("canvas"); cv.width = 640; cv.height = 140; const c = cv.getContext("2d");
    c.fillStyle = accent; c.font = "700 60px " + fontTitle; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("⟲  Zum Anfang", 320, 78);
    const t = new THREE.CanvasTexture(cv); if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.79), new THREE.MeshBasicMaterial({ map: t, transparent: true })); s.position.set(0, 2.7, 0); portalGrp.add(s);
    disposables.push(t, s.geometry, s.material);
  })();
  disposables.push(door.geometry, door.material, glowDisc.geometry, glowDisc.material, ring.geometry, ring.material, floorRing.geometry, floorRing.material);

  /* ----- Figur ----- */
  const hero = makeHero(THREE, acc.getHex());
  const START = new THREE.Vector3(0, 0, 3);
  hero.position.copy(START); scene.add(hero);
  let heading = Math.PI; hero.rotation.y = heading; // schaut in den Saal (-Z)
  // Schatten-Tupfer unter der Figur
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; scene.add(shadow);

  /* ----- Steuerung (nur Tastatur / Touch-Joystick) ----- */
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  el("worldJoy").hidden = !isTouch;
  let panelOpen = false, near = null, nearPortal = false, lastHint = "", tutorialDone = false;
  const keys = {};
  const clock = new THREE.Clock();
  const setHint = (h) => { if (h !== lastHint) { hintEl.innerHTML = h; lastHint = h; } };
  const idleHint = isTouch ? "Joystick = gehen · nah an eine Tafel + tippen" : "<b>WASD</b> / <b>Pfeiltasten</b> gehen · <b>E</b> für Details";

  function returnToStart() { hero.position.copy(START); heading = Math.PI; closePanel(); }

  /* Sprechblasen-Tutorial (abschaltbar, merkt sich die Wahl) */
  const TUT_KEY = "wd:worldTut";
  const tutOff = (() => { try { return localStorage.getItem(TUT_KEY) === "off"; } catch (e) { return false; } })();
  const guide = "🙂";
  const msgs = [
    "Willkommen in der Galerie. 👋",
    "Du steuerst die Figur nur mit der Tastatur: <b>WASD</b> oder die <b>Pfeiltasten</b> — ganz ohne Maus.",
    "Geh nah an eine Tafel und drücke <b>E</b>, um die Details groß zu sehen.",
    "Am Ende führt dich das Tor zurück zum Anfang. Viel Spaß! ✦",
  ];
  let bi = 0, bubbleTimer = null;
  function showBubble() {
    if (!bubbleEl) { tutorialDone = true; return; }
    if (bi >= msgs.length) { bubbleEl.hidden = true; tutorialDone = true; return; }
    bubbleEl.innerHTML = '<span class="wb-av">' + guide + '</span><span class="wb-tx">' + msgs[bi] + '</span><span class="wb-next">' + (isTouch ? "Tippen ▸" : "Weiter ▸ (Leertaste)") + '</span><button class="wb-close" title="Tutorial ausblenden (nicht mehr zeigen)" aria-label="Tutorial ausblenden">✕</button>';
    bubbleEl.hidden = false;
    clearTimeout(bubbleTimer); bubbleTimer = setTimeout(nextBubble, 6500);
  }
  function nextBubble() { bi++; showBubble(); }
  function dismissTutorial() { clearTimeout(bubbleTimer); if (bubbleEl) bubbleEl.hidden = true; tutorialDone = true; try { localStorage.setItem(TUT_KEY, "off"); } catch (e) {} }
  if (bubbleEl) bubbleEl.onclick = (e) => { if (e.target && e.target.classList && e.target.classList.contains("wb-close")) dismissTutorial(); else nextBubble(); };

  function onKeyDown(e) {
    const k = e.key.toLowerCase(); keys[k] = true;
    if (k === "escape" && !tutorialDone && !panelOpen) { e.preventDefault(); dismissTutorial(); return; }
    if (k === " " || k === "enter") { if (!tutorialDone) { e.preventDefault(); nextBubble(); return; } }
    if (k === "e") { e.preventDefault(); if (panelOpen) closePanel(); else if (near) openPanel(near.slide); else if (nearPortal) returnToStart(); }
    if (k === "escape" && panelOpen) closePanel();
  }
  function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
  function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onResize);

  const joy = { x: 0, y: 0, id: null };
  if (isTouch) {
    const joyEl = el("worldJoy"), nub = el("worldNub");
    joyEl.addEventListener("touchstart", (e) => { joy.id = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
    joyEl.addEventListener("touchmove", (e) => { for (const t of e.changedTouches) { if (t.identifier !== joy.id) continue; const r = joyEl.getBoundingClientRect(); let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2); const m = 50, d = Math.hypot(dx, dy) || 1; if (d > m) { dx *= m / d; dy *= m / d; } nub.style.transform = `translate(${dx}px,${dy}px)`; joy.x = dx / m; joy.y = dy / m; } e.preventDefault(); }, { passive: false });
    const end = (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; nub.style.transform = ""; } };
    joyEl.addEventListener("touchend", end); joyEl.addEventListener("touchcancel", end);
    stage.addEventListener("touchend", () => { if (!tutorialDone) { nextBubble(); return; } if (!panelOpen) { if (near) openPanel(near.slide); else if (nearPortal) returnToStart(); } });
  }

  /* ----- Detail-Overlay ----- */
  function openPanel(slide) {
    panelOpen = true;
    const layer = (slide.layers || []).find((l) => resolveSrc(l));
    const t = (role) => (slide.texts || []).find((x) => x.role === role);
    let html = '<div class="wp">';
    if (layer) html += '<img src="' + resolveSrc(layer) + '" alt="">';
    if (t("kicker")) html += '<p class="k">' + esc(t("kicker").text) + "</p>";
    if (t("title")) html += "<h2>" + esc(t("title").text) + "</h2>";
    (slide.texts || []).filter((x) => x.role === "subtitle" || x.role === "body").forEach((x) => (html += "<p>" + esc(x.text) + "</p>"));
    html += '<button class="btn" id="wpClose" style="margin-top:18px">Schließen (E)</button></div>';
    const panel = el("worldPanel"); panel.innerHTML = html; panel.hidden = false;
    el("wpClose").onclick = closePanel;
    panel.onclick = (e) => { if (e.target === panel) closePanel(); };
  }
  function closePanel() { panelOpen = false; el("worldPanel").hidden = true; }

  /* ----- Loop ----- */
  const camPos = new THREE.Vector3(0, 4.6, 5 + 7), camLook = new THREE.Vector3();
  const xMin = -(halfW - 1.3), xMax = halfW - 1.3, zMin = -hallLen + 4, zMax = 5;
  let raf = 0;
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!panelOpen) {
      let mx = 0, mz = 0;
      if (keys["w"] || keys["arrowup"]) mz -= 1;
      if (keys["s"] || keys["arrowdown"]) mz += 1;
      if (keys["a"] || keys["arrowleft"]) mx -= 1;
      if (keys["d"] || keys["arrowright"]) mx += 1;
      if (isTouch) { mx += joy.x; mz += joy.y; }
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len; mz /= len;
        const spd = 5 * dt;
        hero.position.x += mx * spd; hero.position.z += mz * spd;
        // Kollision: aus Hindernissen herausschieben
        for (const o of obstacles) { const dx = hero.position.x - o.x, dz = hero.position.z - o.z, dd = Math.hypot(dx, dz), rr = o.r + 0.45; if (dd < rr && dd > 0.001) { hero.position.x = o.x + (dx / dd) * rr; hero.position.z = o.z + (dz / dd) * rr; } }
        hero.position.x = clamp(hero.position.x, xMin, xMax);
        hero.position.z = clamp(hero.position.z, zMin, zMax);
        const targetH = Math.atan2(mx, mz);
        let d = targetH - heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        heading += d * Math.min(1, dt * 12);
        hero.rotation.y = heading;
        hero.position.y = Math.abs(Math.sin(clock.elapsedTime * 11)) * 0.06; // Hüpfen
      } else { hero.position.y += (0 - hero.position.y) * 0.2; }
      shadow.position.set(hero.position.x, 0.02, hero.position.z);

      // Kamera folgt (fester Diorama-Blick)
      camPos.set(hero.position.x, 4.6, hero.position.z + 7);
      camera.position.lerp(camPos, 1 - Math.pow(0.001, dt));
      camLook.set(hero.position.x, 1.3, hero.position.z - 1.2);
      camera.lookAt(camLook);

      // Nähe zu Tafeln / Portal (horizontal)
      near = null; let best = 3.4;
      for (const b of boards) { const d2 = Math.hypot(hero.position.x - b.x, hero.position.z - b.z); if (d2 < best) { best = d2; near = b; } }
      nearPortal = !near && Math.hypot(hero.position.x - portalX, hero.position.z - portalZ) < 4.2;
      if (!tutorialDone) setHint("");
      else if (near) setHint("<b>" + (isTouch ? "Tippen" : "E") + "</b> für Details");
      else if (nearPortal) setHint("<b>" + (isTouch ? "Tippen" : "E") + "</b> · zurück zum Anfang");
      else setHint(idleHint);
    }
    ring.rotation.z += dt * 0.6;
    glowDisc.material.opacity = 0.12 + 0.06 * (1 + Math.sin(clock.elapsedTime * 2)) / 2;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  function close() {
    cancelAnimationFrame(raf); clearTimeout(bubbleTimer);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("resize", onResize);
    if (bubbleEl) { bubbleEl.hidden = true; bubbleEl.onclick = null; }
    try { disposables.forEach((d) => d && d.dispose && d.dispose()); renderer.dispose(); } catch (e) {}
    stage.innerHTML = ""; overlay.hidden = true; el("worldPanel").hidden = true;
    active = null;
    if (onClose) onClose();
  }
  el("worldExit").onclick = close;
  el("worldHome").onclick = returnToStart;
  active = { close };

  // Kamera initial setzen
  camera.position.set(hero.position.x, 4.6, hero.position.z + 7);
  camera.lookAt(hero.position.x, 1.3, hero.position.z - 1.2);

  if (typeof window !== "undefined" && window.__WD_DEBUG)
    window.__wd = {
      camera, hero, returnToStart, hallLen, halfW,
      setPos: (x, _y, z) => hero.position.set(x, 0, z),
      hint: () => hintEl.textContent,
      skipTutorial: () => { bi = msgs.length; showBubble(); },
      state: () => ({ x: +hero.position.x.toFixed(2), z: +hero.position.z.toFixed(2), near: !!near, nearPortal, tutorialDone, heading: +heading.toFixed(2) }),
    };

  loader.hidden = true;
  if (tutOff) { tutorialDone = true; if (bubbleEl) bubbleEl.hidden = true; } else showBubble();
  raf = requestAnimationFrame(loop);
}
