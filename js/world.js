/* ===================================================================
   world.js — "3D-Welt"-Modus: eine begehbare Galerie (Three.js).
   - First-Person: Pointer-Lock-API + WASD/Maus (Desktop), Joystick+Drag (Touch)
   - Folien werden zu Ausstellungs-Tafeln entlang eines Korridors
   - Nähe zu einer Tafel + E/Tippen -> fokussiertes Detail-Overlay
   - Kollision: leichte Korridor-Begrenzung (keine Physik-Engine nötig)
   Three.js wird ohne Build via Import-Map (CDN) geladen.
   =================================================================== */
import * as THREE from "three";
import { themeVars } from "./themes.js";

const el = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esc = (s) => String(s == null ? "" : s).replace(/[<&>]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" }[c]));
// Hex-Farbe (#rgb / #rrggbb) + Alpha -> rgba(); Fallback: helles Weiß
function hexA(hex, a) {
  let h = String(hex || "").trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return "rgba(255,255,255," + a + ")";
  return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")";
}

let active = null; // aktuell offene Welt (für sauberes Schließen / Re-Entrancy)

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
        // Ohne Bild: sanfter Akzent-Schein + Aufhellung, damit die Tafel nicht flach/dunkel wirkt
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

/* ---------- Welt öffnen ---------- */
export async function openWorld(deck, resolveSrc, onClose = null) {
  if (active) active.close();
  const overlay = el("world"), stage = el("worldStage"), loader = el("worldLoad"), hintEl = el("worldHint");
  overlay.hidden = false; loader.hidden = false; el("worldPanel").hidden = true;

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
  // Umgebungsfarben aus dem Theme-Akzent ableiten -> Raum passt zur Präsentation.
  const hsl = {}; acc.getHSL(hsl);
  const tint = (l, s) => new THREE.Color().setHSL(hsl.h, Math.min(hsl.s, s == null ? 0.4 : s), l);
  // Heller Galeriesaal: Wände/Boden/Decke hell (mit Theme-Tönung), Akzent als Highlight.
  const bgCol = tint(0.5, 0.12);
  const scene = new THREE.Scene();
  scene.background = bgCol;
  scene.fog = new THREE.Fog(bgCol, 34, 130);

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 240);
  camera.position.set(0, 1.6, 6);

  scene.add(new THREE.HemisphereLight(tint(0.92, 0.08).getHex(), tint(0.4, 0.16).getHex(), 1.5));
  scene.add(new THREE.AmbientLight(tint(0.6, 0.12).getHex(), 0.95));
  const dir = new THREE.DirectionalLight(0xffffff, 0.7); dir.position.set(6, 18, 8); scene.add(dir);

  const n = deck.slides.length;
  const spacing = 7, halfW = 7.5, hallLen = n * spacing + 18;

  // Akzent-Licht am Eingang + am Ende -> Tiefe & Farbe
  const glowEnd = new THREE.PointLight(acc.getHex(), 0.9, 80, 1.3); glowEnd.position.set(0, 3.6, -hallLen + 6); scene.add(glowEnd);
  const glowIn = new THREE.PointLight(acc.getHex(), 0.5, 40, 1.6); glowIn.position.set(0, 3.2, 2); scene.add(glowIn);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, hallLen + 24), new THREE.MeshStandardMaterial({ color: tint(0.36, 0.1).getHex(), roughness: 0.45, metalness: 0.25 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = -hallLen / 2 + 6; scene.add(floor);
  const grid = new THREE.GridHelper(hallLen + 24, Math.max(8, Math.round((hallLen + 24) / 2)), tint(0.48, 0.12).getHex(), tint(0.28, 0.1).getHex());
  grid.position.set(0, 0.012, floor.position.z); scene.add(grid);
  // Akzent-Teppich in der Mitte (führt den Blick nach vorn)
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, hallLen + 24), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.3 }));
  runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.02, floor.position.z); scene.add(runner);

  const wallMat = new THREE.MeshStandardMaterial({ color: tint(0.54, 0.08).getHex(), roughness: 0.92, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 24, 6.4), wallMat);
    wall.position.set(sx * halfW, 3.2, floor.position.z); wall.rotation.y = -sx * Math.PI / 2; scene.add(wall);
    // Akzent-Leiste oben an jeder Wand (Galerie-Beleuchtung)
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 24, 0.14), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.7 }));
    strip.position.set(sx * (halfW - 0.01), 4.7, floor.position.z); strip.rotation.y = -sx * Math.PI / 2; scene.add(strip);
    // dunkle Sockelleiste unten -> Kontrast wie im echten Saal
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, hallLen + 24), new THREE.MeshStandardMaterial({ color: tint(0.28, 0.14).getHex(), roughness: 0.85 }));
    base.position.set(sx * (halfW - 0.08), 0.2, floor.position.z); scene.add(base);
  }
  for (const [z, ry] of [[8, Math.PI], [-hallLen + 5, 0]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, 6.4), wallMat);
    w.position.set(0, 3.2, z); w.rotation.y = ry; scene.add(w);
  }
  // helle Decke + leuchtendes Oberlicht in der Mitte (wie Tageslicht im Saal)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, hallLen + 24), new THREE.MeshStandardMaterial({ color: tint(0.44, 0.1).getHex(), roughness: 1, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.4, floor.position.z); scene.add(ceil);
  const skylight = new THREE.Mesh(new THREE.PlaneGeometry(2.4, hallLen + 20), new THREE.MeshBasicMaterial({ color: 0xfff4e2 }));
  skylight.rotation.x = Math.PI / 2; skylight.position.set(0, 5.36, floor.position.z); scene.add(skylight);
  for (let z = -2; z > -hallLen + 6; z -= 12) { const sl = new THREE.PointLight(0xfff2e0, 0.5, 26, 1.8); sl.position.set(0, 5.0, z); scene.add(sl); }

  const boards = [];
  const disposables = [];

  /* ===== Museums-Ausstattung: Säulen, Deckenbalken, Wandbilder, Bänke, Pflanzen ===== */
  const stoneMat = new THREE.MeshStandardMaterial({ color: tint(0.6, 0.07).getHex(), roughness: 0.85 });  // helle Säulen (Marmor)
  const stoneDark = new THREE.MeshStandardMaterial({ color: tint(0.42, 0.1).getHex(), roughness: 0.9 });
  const woodMat = new THREE.MeshStandardMaterial({ color: tint(0.22, 0.28).getHex(), roughness: 0.55, metalness: 0.2 }); // dunkles Holz (Bänke)
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xb89b5e, roughness: 0.45, metalness: 0.5 }); // Goldrahmen
  const potMat = new THREE.MeshStandardMaterial({ color: tint(0.3, 0.16).getHex(), roughness: 0.8 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a7a4a, roughness: 1 });
  const colGeo = new THREE.CylinderGeometry(0.4, 0.46, 4.9, 18);
  const fluteGeo = new THREE.BoxGeometry(1.1, 0.42, 1.1);
  const capGeo = new THREE.BoxGeometry(1.0, 0.34, 1.0);
  const beamGeo = new THREE.BoxGeometry(halfW * 2, 0.26, 0.4);
  const artFrameGeo = new THREE.BoxGeometry(2.7, 3.5, 0.14);
  const artFillGeo = new THREE.PlaneGeometry(2.2, 3.0);
  const benchSeatGeo = new THREE.BoxGeometry(2.6, 0.18, 0.8);
  const benchLegGeo = new THREE.BoxGeometry(0.18, 0.5, 0.7);
  const potGeo = new THREE.CylinderGeometry(0.32, 0.24, 0.6, 14);
  const leafGeo = new THREE.SphereGeometry(0.55, 12, 10);
  disposables.push(stoneMat, stoneDark, woodMat, frameMat, potMat, leafMat, colGeo, fluteGeo, capGeo, beamGeo, artFrameGeo, artFillGeo, benchSeatGeo, benchLegGeo, potGeo, leafGeo);

  const colXs = [-(halfW - 0.7), halfW - 0.7];
  const colZs = []; for (let z = 1; z > -hallLen + 6; z -= 7) colZs.push(z);
  for (const z of colZs) {
    const beam = new THREE.Mesh(beamGeo, stoneDark); beam.position.set(0, 5.24, z); scene.add(beam); // Deckenbalken
    for (const cx of colXs) {
      const col = new THREE.Mesh(colGeo, stoneMat); col.position.set(cx, 2.65, z); scene.add(col);
      const cb = new THREE.Mesh(fluteGeo, stoneDark); cb.position.set(cx, 0.21, z); scene.add(cb);
      const cc = new THREE.Mesh(capGeo, stoneDark); cc.position.set(cx, 5.02, z); scene.add(cc);
    }
  }
  // Wandbilder zwischen den Säulen (dekorative gerahmte „Gemälde")
  const artZs = []; for (let z = -2.5; z > -hallLen + 6; z -= 7) artZs.push(z);
  for (const z of artZs) for (const sx of [-1, 1]) {
    const fr = new THREE.Mesh(artFrameGeo, frameMat); fr.position.set(sx * (halfW - 0.13), 2.7, z); fr.rotation.y = -sx * Math.PI / 2; scene.add(fr);
    // farbiges „Gemälde" (variierende Farbtöne) -> Wände wirken belebt
    const fillMat = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.45, 0.45).getHex() });
    const fill = new THREE.Mesh(artFillGeo, fillMat); fill.position.set(sx * (halfW - 0.19), 2.7, z); fill.rotation.y = -sx * Math.PI / 2; scene.add(fill);
    disposables.push(fillMat);
  }
  // Bänke in den Seitengängen (nicht im Laufweg) + ein paar Pflanzen
  for (let i = 0, z = -5; z > -hallLen + 6; z -= 14, i++) for (const sx of [-1, 1]) {
    const bx = sx * (halfW - 2.3);
    const seat = new THREE.Mesh(benchSeatGeo, woodMat); seat.position.set(bx, 0.5, z); scene.add(seat);
    for (const lz of [-0.7, 0.7]) { const leg = new THREE.Mesh(benchLegGeo, woodMat); leg.position.set(bx, 0.25, z + lz); scene.add(leg); }
    if (i % 2 === 0) { const pot = new THREE.Mesh(potGeo, potMat); pot.position.set(sx * (halfW - 0.9), 0.3, z + 3.5); scene.add(pot); const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.set(sx * (halfW - 0.9), 0.95, z + 3.5); leaf.scale.set(1, 1.3, 1); scene.add(leaf); }
  }
  await Promise.all(deck.slides.map(async (slide, i) => {
    const cv = await slideToCanvas(slide, { accent, ink, fontTitle, fontBody }, resolveSrc);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
    const bw = 5.4, bh = (bw * 9) / 16;
    // Tafeln stehen versetzt links/rechts der Mittelachse und sind dem Eingang
    // zugewandt (leicht zur Mitte gedreht) -> beim Reinlaufen sofort lesbar.
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * 2.9, z = -(7 + i * spacing), y = 2.0;
    const ry = -side * 0.26;
    const g = new THREE.Group();
    g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    const outline = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.34, bh + 0.34), new THREE.MeshBasicMaterial({ color: acc.getHex() }));
    outline.position.z = -0.04; g.add(outline);
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.14, bh + 0.14), new THREE.MeshBasicMaterial({ color: 0x0a0e16 }));
    frame.position.z = -0.02; g.add(frame);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: tex }));
    g.add(board);
    // Sockel/Plinthe, auf dem die Tafel „steht" (Museums-Look)
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.8, y - bh / 2, 0.95), stoneMat); plinth.position.set(x, (y - bh / 2) / 2, z); scene.add(plinth);
    const plinthTop = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 1.15), stoneDark); plinthTop.position.set(x, y - bh / 2, z); scene.add(plinthTop);
    // Decken-Strahler über der Tafel (Museums-Beleuchtung): Fixture + Spot auf die Tafel
    const fix = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: tint(0.14, 0.3).getHex(), roughness: 0.8 }));
    fix.position.set(x, 5.32, z + 0.9); scene.add(fix);
    if (n <= 16) {
      const spot = new THREE.SpotLight(0xfff1dc, 26, 12, 0.5, 0.6, 1.4);
      spot.position.set(x, 5.2, z + 1.2); spot.target.position.set(x, y - 0.2, z);
      scene.add(spot); scene.add(spot.target);
    }
    boards.push({ slide, pos: new THREE.Vector3(x, y, z) });
    disposables.push(tex, board.geometry, frame.geometry, outline.geometry, plinth.geometry, plinthTop.geometry, fix.geometry, board.material, frame.material, outline.material, fix.material);
  }));

  /* ----- Rückweg-Portal am Ende des Pfades (großes, leuchtendes Tor) ----- */
  const portalPos = new THREE.Vector3(0, 2.1, -hallLen + 7);
  const portalGrp = new THREE.Group(); portalGrp.position.copy(portalPos); scene.add(portalGrp);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.8), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.12 })); door.position.z = -0.06; portalGrp.add(door);
  const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1.95, 56), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.16 })); glowDisc.position.z = -0.03; portalGrp.add(glowDisc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.12, 16, 80), new THREE.MeshBasicMaterial({ color: acc.getHex() })); portalGrp.add(ring);
  const floorRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.3, 48), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.22, side: THREE.DoubleSide })); floorRing.rotation.x = -Math.PI / 2; floorRing.position.set(0, -2.08, 0.3); portalGrp.add(floorRing);
  const portalLight = new THREE.PointLight(acc.getHex(), 1.2, 32, 1.5); portalLight.position.set(0, 0, 1.6); portalGrp.add(portalLight);
  // Schild „Zum Anfang"
  function makeSign(text) {
    const cv = document.createElement("canvas"); cv.width = 640; cv.height = 140; const c = cv.getContext("2d");
    c.fillStyle = accent; c.font = "700 64px " + fontTitle; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(text, 320, 78);
    const t = new THREE.CanvasTexture(cv); if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  const signTex = makeSign("⟲  Zum Anfang");
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.79), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
  sign.position.set(0, 2.7, 0); portalGrp.add(sign);
  disposables.push(door.geometry, door.material, glowDisc.geometry, glowDisc.material, ring.geometry, ring.material, floorRing.geometry, floorRing.material, sign.geometry, sign.material, signTex);

  /* ----- Steuerung ----- */
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  el("worldCross").hidden = isTouch;
  el("worldJoy").hidden = !isTouch;
  let yaw = 0, pitch = 0, locked = false, panelOpen = false, near = null, nearPortal = false, lastHint = "";
  const keys = {};
  const clock = new THREE.Clock();

  function setHint(html) { if (html !== lastHint) { hintEl.innerHTML = html; lastHint = html; } }
  const idleHint = isTouch ? "Joystick = gehen · ziehen = schauen" : "<b>Klick</b> zum Start · <b>WASD</b> gehen · <b>Maus</b> schauen";
  // Zum Anfang zurückspringen (Portal am Ende des Pfades).
  function returnToStart() { camera.position.set(0, 1.6, 6); yaw = 0; pitch = 0; closePanel(); }

  function lockPointer() { if (!isTouch && !panelOpen && document.pointerLockElement !== stage) stage.requestPointerLock(); }
  function onPL() { locked = document.pointerLockElement === stage; }
  function onMouse(e) { if (!locked) return; yaw -= e.movementX * 0.0022; pitch = clamp(pitch - e.movementY * 0.0022, -1.2, 1.2); }
  function onKeyDown(e) {
    const k = e.key.toLowerCase(); keys[k] = true;
    if (k === "e") { e.preventDefault(); if (panelOpen) closePanel(); else if (near) openPanel(near.slide); else if (nearPortal) returnToStart(); }
    if (k === "escape" && panelOpen) closePanel();
  }
  function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
  function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }

  stage.addEventListener("click", lockPointer);
  document.addEventListener("pointerlockchange", onPL);
  document.addEventListener("mousemove", onMouse);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onResize);

  const joy = { x: 0, y: 0, id: null };
  let lookId = null, lx = 0, ly = 0, tapMove = 0;
  if (isTouch) {
    const joyEl = el("worldJoy"), nub = el("worldNub");
    joyEl.addEventListener("touchstart", (e) => { joy.id = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
    joyEl.addEventListener("touchmove", (e) => {
      for (const t of e.changedTouches) { if (t.identifier !== joy.id) continue; const r = joyEl.getBoundingClientRect(); let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2); const m = 50, d = Math.hypot(dx, dy) || 1; if (d > m) { dx *= m / d; dy *= m / d; } nub.style.transform = `translate(${dx}px,${dy}px)`; joy.x = dx / m; joy.y = dy / m; }
      e.preventDefault();
    }, { passive: false });
    const joyEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === joy.id) { joy.id = null; joy.x = joy.y = 0; nub.style.transform = ""; } };
    joyEl.addEventListener("touchend", joyEnd); joyEl.addEventListener("touchcancel", joyEnd);
    stage.addEventListener("touchstart", (e) => { const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; tapMove = 0; });
    stage.addEventListener("touchmove", (e) => { for (const t of e.changedTouches) { if (t.identifier !== lookId) continue; yaw -= (t.clientX - lx) * 0.005; pitch = clamp(pitch - (t.clientY - ly) * 0.005, -1.2, 1.2); tapMove += Math.abs(t.clientX - lx) + Math.abs(t.clientY - ly); lx = t.clientX; ly = t.clientY; } }, { passive: true });
    stage.addEventListener("touchend", () => { if (tapMove < 12 && !panelOpen) { if (near) openPanel(near.slide); else if (nearPortal) returnToStart(); } lookId = null; });
  }

  /* ----- Detail-Overlay ----- */
  function openPanel(slide) {
    panelOpen = true;
    if (document.pointerLockElement) document.exitPointerLock();
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
  let raf = 0;
  function loop() {
    const dt = Math.min(clock.getDelta(), 0.05);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    if (!panelOpen) {
      let fwd = 0, str = 0;
      if (keys["w"] || keys["arrowup"]) fwd += 1;
      if (keys["s"] || keys["arrowdown"]) fwd -= 1;
      if (keys["d"] || keys["arrowright"]) str += 1;
      if (keys["a"] || keys["arrowleft"]) str -= 1;
      if (isTouch) { str += joy.x; fwd -= joy.y; }
      const spd = 4.4 * dt, sy = Math.sin(yaw), cy = Math.cos(yaw);
      camera.position.x += (-sy * fwd + cy * str) * spd;
      camera.position.z += (-cy * fwd - sy * str) * spd;
      camera.position.x = clamp(camera.position.x, -halfW + 0.6, halfW - 0.6);
      camera.position.z = clamp(camera.position.z, -hallLen + 5, 6);
      camera.position.y = 1.6;
      near = null; let best = 5.4;
      for (const b of boards) { const d = camera.position.distanceTo(b.pos); if (d < best) { best = d; near = b; } }
      nearPortal = !near && camera.position.distanceTo(portalPos) < 4.4;
      if (near) setHint("<b>" + (isTouch ? "Tippen" : "E") + "</b> für Details");
      else if (nearPortal) setHint("<b>" + (isTouch ? "Tippen" : "E") + "</b> · zurück zum Anfang");
      else if (!locked && !isTouch) setHint(idleHint);
      else setHint("");
    }
    ring.rotation.z += dt * 0.6; // Portal lebt
    glowDisc.material.opacity = 0.12 + 0.06 * (1 + Math.sin(clock.elapsedTime * 2)) / 2;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  function close() {
    cancelAnimationFrame(raf);
    stage.removeEventListener("click", lockPointer);
    document.removeEventListener("pointerlockchange", onPL);
    document.removeEventListener("mousemove", onMouse);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("resize", onResize);
    if (document.pointerLockElement) document.exitPointerLock();
    try { disposables.forEach((d) => d.dispose && d.dispose()); floor.geometry.dispose(); floor.material.dispose(); renderer.dispose(); } catch (e) {}
    stage.innerHTML = ""; overlay.hidden = true; el("worldPanel").hidden = true;
    active = null;
    if (onClose) onClose();
  }
  el("worldExit").onclick = close;
  el("worldHome").onclick = () => { returnToStart(); if (!isTouch) lockPointer(); };
  active = { close };

  // Debug-Hook nur für automatisierte Tests (window.__WD_DEBUG=true vor dem Import).
  if (typeof window !== "undefined" && window.__WD_DEBUG)
    window.__wd = {
      camera, returnToStart, portalPos, hallLen, halfW,
      setPos: (x, yy, z) => camera.position.set(x, yy, z),
      setView: (y, p) => { yaw = y; pitch = p; },
      hint: () => hintEl.textContent,
      state: () => ({ z: +camera.position.z.toFixed(2), near: !!near, nearPortal, locked }),
    };

  loader.hidden = true;
  raf = requestAnimationFrame(loop);
}
