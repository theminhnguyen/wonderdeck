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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
  scene.fog = new THREE.Fog(0x05060a, 14, 64);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 220);
  camera.position.set(0, 1.6, 5);

  scene.add(new THREE.HemisphereLight(0x9fb4d6, 0x0a0c12, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 0.55); dir.position.set(6, 16, 6); scene.add(dir);

  const n = deck.slides.length;
  const spacing = 7, halfW = 6, hallLen = n * spacing + 16;

  const acc = new THREE.Color(accent);
  const glow = new THREE.PointLight(acc.getHex(), 0.6, 60, 1.4);
  glow.position.set(0, 3.5, -hallLen + 6); scene.add(glow);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, hallLen + 24), new THREE.MeshStandardMaterial({ color: 0x0b0d13, roughness: 1, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = -hallLen / 2 + 6; scene.add(floor);
  const grid = new THREE.GridHelper(hallLen + 24, Math.max(8, Math.round((hallLen + 24) / 2)), 0x2a3550, 0x141a28);
  grid.position.set(0, 0.01, floor.position.z); scene.add(grid);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0a0c12, roughness: 1, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 24, 6), wallMat);
    wall.position.set(sx * halfW, 3, floor.position.z); wall.rotation.y = -sx * Math.PI / 2; scene.add(wall);
  }
  for (const [z, ry] of [[7, Math.PI], [-hallLen + 5, 0]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, 6), wallMat);
    w.position.set(0, 3, z); w.rotation.y = ry; scene.add(w);
  }

  const boards = [];
  const disposables = [];
  await Promise.all(deck.slides.map(async (slide, i) => {
    const cv = await slideToCanvas(slide, { accent, ink, fontTitle, fontBody }, resolveSrc);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
    const bw = 6, bh = (bw * 9) / 16;
    const sx = i % 2 === 0 ? -1 : 1;
    const x = sx * (halfW - 0.2), z = -(9 + i * spacing), y = 2.15;
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.5, bh + 0.5), new THREE.MeshBasicMaterial({ color: 0x05070c }));
    frame.position.set(x + sx * 0.03, y, z); frame.rotation.y = -sx * Math.PI / 2; scene.add(frame);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: tex }));
    board.position.set(x, y, z); board.rotation.y = -sx * Math.PI / 2; scene.add(board);
    boards.push({ slide, pos: new THREE.Vector3(x, y, z) });
    disposables.push(tex, board.geometry, frame.geometry, board.material, frame.material);
  }));

  /* ----- Steuerung ----- */
  const isTouch = window.matchMedia("(pointer: coarse)").matches;
  el("worldCross").hidden = isTouch;
  el("worldJoy").hidden = !isTouch;
  let yaw = 0, pitch = 0, locked = false, panelOpen = false, near = null, lastHint = "";
  const keys = {};
  const clock = new THREE.Clock();

  function setHint(html) { if (html !== lastHint) { hintEl.innerHTML = html; lastHint = html; } }
  const idleHint = isTouch ? "Joystick = gehen · ziehen = schauen" : "<b>Klick</b> zum Start · <b>WASD</b> gehen · <b>Maus</b> schauen";

  function lockPointer() { if (!isTouch && !panelOpen && document.pointerLockElement !== stage) stage.requestPointerLock(); }
  function onPL() { locked = document.pointerLockElement === stage; }
  function onMouse(e) { if (!locked) return; yaw -= e.movementX * 0.0022; pitch = clamp(pitch - e.movementY * 0.0022, -1.2, 1.2); }
  function onKeyDown(e) {
    const k = e.key.toLowerCase(); keys[k] = true;
    if (k === "e") { e.preventDefault(); panelOpen ? closePanel() : (near && openPanel(near.slide)); }
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
    stage.addEventListener("touchend", () => { if (tapMove < 12 && near && !panelOpen) openPanel(near.slide); lookId = null; });
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
      if (near) setHint("<b>" + (isTouch ? "Tippen" : "E") + "</b> für Details");
      else if (!locked && !isTouch) setHint(idleHint);
      else setHint("");
    }
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
  active = { close };

  loader.hidden = true;
  raf = requestAnimationFrame(loop);
}
