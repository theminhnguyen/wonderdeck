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
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
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

/* ---------- Verlaufs-Himmel + Marmor-Boden als Texturen (mehr Tiefe/Politur) ---------- */
function gradientSky(THREE, topCss, botCss) {
  const cv = document.createElement("canvas"); cv.width = 8; cv.height = 256; const c = cv.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, topCss); g.addColorStop(1, botCss);
  c.fillStyle = g; c.fillRect(0, 0, 8, 256);
  const t = new THREE.CanvasTexture(cv); if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function marbleTexture(THREE, baseCss, veinCss) {
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 512; const c = cv.getContext("2d");
  c.fillStyle = baseCss; c.fillRect(0, 0, 512, 512);
  c.strokeStyle = veinCss; c.lineWidth = 1.3; c.globalAlpha = 0.45;
  for (let i = 0; i < 26; i++) { c.beginPath(); let x = Math.random() * 512, y = Math.random() * 512; c.moveTo(x, y); for (let j = 0; j < 7; j++) { x += (Math.random() - 0.5) * 130; y += (Math.random() - 0.5) * 130; c.lineTo(x, y); } c.stroke(); }
  c.globalAlpha = 0.045; for (let i = 0; i < 1800; i++) { c.fillStyle = Math.random() < 0.5 ? "#000" : "#fff"; c.fillRect(Math.random() * 512, Math.random() * 512, 1.6, 1.6); }
  c.globalAlpha = 1;
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- Figur im abeto-Stil: schlanke, cel-shaded Bote:in mit Anime-Gesicht, Haar-Dutt + Rucksack ---------- */
function makeHero(THREE, accentHex) {
  const g = new THREE.Group();
  const acc = new THREE.Color(accentHex);

  // Weiche 4-Stufen-Cel-Schattierung (gradientMap) → „gezeichneter" Anime-Look statt hartem 2-Ton
  const rampCv = document.createElement("canvas"); rampCv.width = 4; rampCv.height = 1;
  { const x = rampCv.getContext("2d"); const steps = ["#9a9088", "#c4bcb2", "#ece7df", "#ffffff"]; for (let i = 0; i < 4; i++) { x.fillStyle = steps[i]; x.fillRect(i, 0, 1, 1); } }
  const ramp = new THREE.CanvasTexture(rampCv); ramp.minFilter = ramp.magFilter = THREE.NearestFilter; if ("colorSpace" in ramp) ramp.colorSpace = THREE.SRGBColorSpace;
  const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: ramp });

  const skin = toon(0xf4d9c6);
  const hairC = toon(0x342c40);   // dunkles Aubergine-Lila
  const hairHi = toon(0x4b4060);  // Haar-Glanzsträhne
  const tieC = toon(0xc7423a);    // rotes Haarband
  const shirt = toon(0x23262d);   // fast-schwarzes Shirt
  const pants = toon(0x1a1d22);   // schwarze Culottes
  const bagC = toon(0xeae3d3);    // cremeweißer Rucksack
  const bagD = toon(0xd6cdb9);    // Rucksack-Träger / Deckel
  const sockC = toon(0xf3f0e7);
  const shoeC = toon(0x15171b);
  const blush = toon(0xe9a591);   // sanftes Erröten
  const lip = toon(0xc77f72);     // Mund
  const emblem = toon(acc.getHex());
  const eyeDark = new THREE.MeshBasicMaterial({ color: 0x2a2331 });
  const eyeHi = new THREE.MeshBasicMaterial({ color: 0xfdfcff });
  const out = new THREE.MeshBasicMaterial({ color: 0x141019, side: THREE.BackSide }); // Tinten-Outline
  const M = (geo, mat) => new THREE.Mesh(geo, mat);
  const add = (geo, mat, x, y, z) => { const m = M(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const ol = (mesh, s) => { const o = new THREE.Mesh(mesh.geometry, out); o.scale.setScalar(s); mesh.add(o); return o; };

  // Beine (blank) — Pivot an der Hüfte, mit Söckchen + rundem Schuh
  const legGeo = new THREE.CapsuleGeometry(0.072, 0.5, 6, 14);
  const sockGeo = new THREE.CylinderGeometry(0.084, 0.078, 0.12, 14);
  const shoeGeo = new THREE.CapsuleGeometry(0.078, 0.13, 6, 12);
  const mkLeg = (x) => {
    const p = new THREE.Group(); p.position.set(x, 0.88, 0);
    const leg = M(legGeo, skin); leg.position.y = -0.33; ol(leg, 1.1); p.add(leg);
    p.add(M(sockGeo, sockC).translateY(-0.66));
    const sh = M(shoeGeo, shoeC); sh.rotation.x = Math.PI / 2; sh.position.set(0, -0.79, 0.06); ol(sh, 1.08); p.add(sh);
    g.add(p); return p;
  };
  const lleg = mkLeg(-0.1), rleg = mkLeg(0.1);

  // Culottes + Torso + Brust-Emblem + Hals
  const shorts = add(new THREE.CylinderGeometry(0.175, 0.255, 0.34, 20), pants, 0, 0.85, 0); ol(shorts, 1.05);
  const torso = add(new THREE.CapsuleGeometry(0.175, 0.34, 8, 18), shirt, 0, 1.18, 0); ol(torso, 1.05);
  add(new THREE.BoxGeometry(0.12, 0.12, 0.02), emblem, 0, 1.22, 0.176);
  add(new THREE.CylinderGeometry(0.05, 0.062, 0.1, 12), skin, 0, 1.46, 0);

  // Kopf (leicht ei-/herzförmig) + Kinn + Ohren
  const head = add(new THREE.SphereGeometry(0.15, 24, 20), skin, 0, 1.61, 0.005); head.scale.set(0.95, 1.07, 0.97); ol(head, 1.05);
  const chin = add(new THREE.SphereGeometry(0.085, 16, 12), skin, 0, 1.53, 0.05); chin.scale.set(1.05, 0.9, 0.95);
  for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.03, 10, 8), skin, sx * 0.148, 1.6, -0.005);

  // Haar: Hinterkopf-Kappe + Nacken, mittig geteilter Pony, Seitensträhnen, Dutt + rotes Band, Glanzsträhne
  const crown = add(new THREE.SphereGeometry(0.158, 22, 18), hairC, 0, 1.665, -0.038); crown.scale.set(1.06, 1.0, 1.05);
  const nape = add(new THREE.SphereGeometry(0.132, 18, 14), hairC, 0, 1.56, -0.06); nape.scale.set(1.04, 1.05, 0.85);
  for (const sx of [-1, 1]) { const fr = add(new THREE.CapsuleGeometry(0.045, 0.12, 5, 10), hairC, sx * 0.055, 1.675, 0.108); fr.rotation.set(0.5, 0, sx * 0.62); fr.scale.set(1, 1, 0.7); }
  add(new THREE.SphereGeometry(0.05, 12, 10), hairC, 0, 1.715, 0.075).scale.set(1.5, 0.5, 0.7); // Stirn-Haaransatz
  for (const sx of [-1, 1]) { const lock = add(new THREE.CapsuleGeometry(0.03, 0.2, 5, 10), hairC, sx * 0.138, 1.55, 0.03); lock.rotation.z = sx * 0.16; }
  add(new THREE.SphereGeometry(0.073, 16, 14), hairC, 0, 1.82, -0.045); // Dutt
  add(new THREE.SphereGeometry(0.03, 8, 8), hairHi, -0.05, 1.69, 0.02); // dezente Glanzsträhne
  const tie = add(new THREE.TorusGeometry(0.052, 0.017, 8, 18), tieC, 0, 1.785, -0.045); tie.rotation.x = Math.PI / 2;

  // Gesicht: mandelförmige Augen + Glanzpunkt, Brauen, feine Nase, Mund, sanftes Erröten (auf +Z)
  for (const sx of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(0.027, 12, 10), eyeDark, sx * 0.06, 1.6, 0.132); eye.scale.set(0.78, 1.3, 0.42);
    add(new THREE.SphereGeometry(0.009, 8, 8), eyeHi, sx * 0.052, 1.618, 0.15);
    const brow = add(new THREE.BoxGeometry(0.055, 0.013, 0.012), hairC, sx * 0.062, 1.648, 0.138); brow.rotation.z = -sx * 0.1;
    const bl = add(new THREE.SphereGeometry(0.038, 10, 8), blush, sx * 0.092, 1.575, 0.11); bl.scale.set(1.1, 0.7, 0.25);
  }
  add(new THREE.SphereGeometry(0.02, 10, 8), skin, 0, 1.575, 0.152).scale.set(0.6, 0.7, 0.6); // Nase
  add(new THREE.SphereGeometry(0.024, 10, 8), lip, 0, 1.535, 0.145).scale.set(1.3, 0.4, 0.4); // Mund

  // Arme — runde Schulter + kurzer Ärmel + blanker Unterarm + Hand, Pivot an der Schulter
  const mkArm = (x) => {
    const p = new THREE.Group(); p.position.set(x, 1.4, 0);
    const shoulder = M(new THREE.SphereGeometry(0.082, 14, 12), shirt); ol(shoulder, 1.05); p.add(shoulder);
    const arm = M(new THREE.CapsuleGeometry(0.05, 0.34, 6, 12), skin); arm.position.y = -0.26; ol(arm, 1.1); p.add(arm);
    const sleeve = M(new THREE.SphereGeometry(0.073, 14, 12), shirt); sleeve.position.y = -0.09; sleeve.scale.set(1, 0.78, 1); p.add(sleeve);
    const hand = M(new THREE.SphereGeometry(0.052, 12, 10), skin); hand.position.y = -0.475; hand.scale.set(1, 1.15, 0.78); p.add(hand);
    g.add(p); return p;
  };
  const larm = mkArm(-0.205), rarm = mkArm(0.205);

  // Rucksack auf dem Rücken (-Z) + Fronttasche + Träger über die Schultern (+Z)
  const bag = add(new THREE.BoxGeometry(0.3, 0.4, 0.17), bagC, 0, 1.14, -0.23); ol(bag, 1.04);
  add(new THREE.BoxGeometry(0.3, 0.13, 0.18), bagD, 0, 1.31, -0.23); // Deckel
  add(new THREE.BoxGeometry(0.16, 0.16, 0.04), bagD, 0, 1.05, -0.318); // Fronttasche
  for (const sx of [-1, 1]) { const strap = add(new THREE.BoxGeometry(0.045, 0.44, 0.04), bagD, sx * 0.1, 1.2, 0.165); strap.rotation.x = -0.04; }

  g.userData.parts = { lleg, rleg, larm, rarm };
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
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  stage.innerHTML = ""; stage.appendChild(renderer.domElement);

  const acc = new THREE.Color(accent);
  const hsl = {}; acc.getHSL(hsl);
  const tint = (l, s) => new THREE.Color().setHSL(hsl.h, Math.min(hsl.s, s == null ? 0.4 : s), l);
  // abeto-Basis-Palette (fest): Teal/Aqua-Himmel + warmes Steingrau; Theme-Akzent nur als Highlight
  const A = { wall: 0xdcd6c9, wallDark: 0x39352e, ceil: 0xe6e0d3, stone: 0xd2cbbc, stoneDark: 0x8a8273, wood: 0x9c7b54, beam: 0xc0b8a8, floor: 0xd0c9ba, floorVein: 0xb3ab9a };
  const scene = new THREE.Scene();
  scene.background = gradientSky(THREE, "#6cc2bc", "#cbe9e2");
  scene.fog = new THREE.Fog(0xd2eae3, 46, 150);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 240);

  // Bloom-Pipeline (weiches Leuchten für Laternen, Portal & Akzente — abeto-Glanz)
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.5, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  scene.add(new THREE.HemisphereLight(0xe9f4f1, 0xcdbfa6, 1.05)); // Aqua-Himmel / warmer Boden
  scene.add(new THREE.AmbientLight(0xece5d6, 0.42));
  // Sonne mit weichem Schatten — folgt der Figur (knackige Schatten in der Nähe)
  const dir = new THREE.DirectionalLight(0xfff1d6, 1.3);
  dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048);
  const sc = dir.shadow.camera; sc.near = 1; sc.far = 70; sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.updateProjectionMatrix();
  dir.shadow.bias = -0.0007; dir.shadow.normalBias = 0.04;
  scene.add(dir); scene.add(dir.target);
  const sunOff = new THREE.Vector3(7, 17, 9); // Lichtrichtung relativ zur Figur

  const n = deck.slides.length;
  const spacing = 7, halfW = 7.5, hallLen = n * spacing + 18;
  const FRONT_Z = 13;

  const glowEnd = new THREE.PointLight(acc.getHex(), 0.9, 80, 1.3); glowEnd.position.set(0, 3.6, -hallLen + 6); scene.add(glowEnd);

  const disposables = [];
  const obstacles = []; // {x,z,r} für einfache Kollision
  const place = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

  /* ----- Boden (Marmor), Wände, Decke ----- */
  const floorTex = marbleTexture(THREE, new THREE.Color(A.floor).getStyle(), new THREE.Color(A.floorVein).getStyle());
  floorTex.repeat.set(4, Math.max(4, Math.round((hallLen + 24) / 8)));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, hallLen + 24), new THREE.MeshToonMaterial({ map: floorTex }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = -hallLen / 2 + 6; floor.receiveShadow = true; scene.add(floor);
  disposables.push(floorTex);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.8, hallLen + 24), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.22 }));
  runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.02, floor.position.z); scene.add(runner);

  const wallMat = new THREE.MeshToonMaterial({ color: A.wall, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 24, 6.4), wallMat);
    wall.position.set(sx * halfW, 3.2, floor.position.z); wall.rotation.y = -sx * Math.PI / 2; scene.add(wall);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 24, 0.14), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.4 }));
    strip.position.set(sx * (halfW - 0.01), 4.7, floor.position.z); strip.rotation.y = -sx * Math.PI / 2; scene.add(strip);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, hallLen + 24), new THREE.MeshToonMaterial({ color: A.wallDark }));
    base.position.set(sx * (halfW - 0.08), 0.2, floor.position.z); scene.add(base);
  }
  for (const [z, ry] of [[FRONT_Z, Math.PI], [-hallLen + 5, 0]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, 6.4), wallMat);
    w.position.set(0, 3.2, z); w.rotation.y = ry; scene.add(w);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, hallLen + 24), new THREE.MeshToonMaterial({ color: A.ceil, side: THREE.DoubleSide }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.4, floor.position.z); scene.add(ceil);
  const skylight = new THREE.Mesh(new THREE.PlaneGeometry(2.4, hallLen + 20), new THREE.MeshBasicMaterial({ color: 0xfff4e2 }));
  skylight.rotation.x = Math.PI / 2; skylight.position.set(0, 5.36, floor.position.z); scene.add(skylight);
  for (let z = -4; z > -hallLen + 6; z -= 16) { const sl = new THREE.PointLight(0xfff2e0, 0.45, 26, 1.8); sl.position.set(0, 5.0, z); scene.add(sl); }

  /* ----- Materialien Ausstattung ----- */
  const stoneMat = new THREE.MeshToonMaterial({ color: A.stone });
  const stoneDark = new THREE.MeshToonMaterial({ color: A.stoneDark });
  const woodMat = new THREE.MeshToonMaterial({ color: A.wood });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xb89b5e, roughness: 0.45, metalness: 0.5 });
  const leafMat = new THREE.MeshToonMaterial({ color: 0x6f9a72 }); // gedämpftes Grün
  const potMat = new THREE.MeshToonMaterial({ color: 0xb07a5a }); // weiche Terrakotta
  const beamMat = new THREE.MeshToonMaterial({ color: A.beam }); // schlichte, ruhige Balken
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1620, side: THREE.BackSide }); // abeto-Tinten-Outline
  disposables.push(stoneMat, stoneDark, woodMat, frameMat, leafMat, potMat, beamMat, outlineMat, floor.geometry, floor.material, wallMat, ceil.material, runner.material, skylight.material);

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
    const gate = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.2, 14, 56), new THREE.MeshToonMaterial({ color: A.stone }));
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
    // Teppich unter der Tafel
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.3), new THREE.MeshToonMaterial({ color: tint(0.42, 0.32).getHex() }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(x, 0.016, z); rug.receiveShadow = true; scene.add(rug);
    // Museums-Absperrung (zwei Messing-Pfosten + Seil) zum Gang hin
    const sx2 = x * 0.48;
    for (const oz of [-0.95, 0.95]) {
      scene.add(place(new THREE.CylinderGeometry(0.045, 0.055, 0.82, 10), frameMat, sx2, 0.41, z + oz));
      scene.add(place(new THREE.SphereGeometry(0.08, 10, 8), frameMat, sx2, 0.86, z + oz));
    }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.9, 8), new THREE.MeshToonMaterial({ color: tint(0.4, 0.32).getHex() }));
    rope.position.set(sx2, 0.74, z); rope.rotation.x = Math.PI / 2; scene.add(rope);
    boards.push({ slide, x, z });
    obstacles.push({ x, z, r: 1.25 });
    disposables.push(tex, board.geometry, frame.geometry, outline.geometry, plinth.geometry, board.material, frame.material, outline.material);
  }));

  /* ----- Skulpturen auf Sockeln (füllen den Raum, mehr Tiefe) ----- */
  const sculptBase = new THREE.MeshToonMaterial({ color: A.stone });
  const sculptAcc = new THREE.MeshToonMaterial({ color: tint(0.55, 0.4).getHex() });
  for (let k = 0, z = -12; z > -hallLen + 10; z -= 20, k++) {
    const sx = (k % 2 ? 1 : -1) * 4.4;
    scene.add(place(new THREE.CylinderGeometry(0.48, 0.6, 1.0, 10), sculptBase, sx, 0.5, z));
    scene.add(place(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 10), sculptBase, sx, 1.0, z));
    if (k % 2) scene.add(place(new THREE.TorusKnotGeometry(0.26, 0.09, 80, 10), sculptAcc, sx, 1.55, z));
    else scene.add(place(new THREE.IcosahedronGeometry(0.36, 0), sculptAcc, sx, 1.5, z));
    obstacles.push({ x: sx, z, r: 0.7 });
  }
  disposables.push(sculptBase, sculptAcc);

  /* ----- Warme Wandleuchten (abeto-Wärme; leuchten weich mit Bloom) ----- */
  const sconceBulbGeo = new THREE.SphereGeometry(0.1, 12, 10);
  const sconceArmGeo = new THREE.BoxGeometry(0.05, 0.05, 0.16);
  const sconceBulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const sconceArmMat = new THREE.MeshToonMaterial({ color: A.stoneDark });
  disposables.push(sconceBulbGeo, sconceArmGeo, sconceBulbMat, sconceArmMat);
  for (let z = -3; z > -hallLen + 6; z -= 9) for (const sx of [-1, 1]) {
    const gx = sx * (halfW - 0.12);
    scene.add(place(sconceArmGeo, sconceArmMat, gx - sx * 0.08, 3.75, z));
    const bulb = place(sconceBulbGeo, sconceBulbMat, gx - sx * 0.18, 3.75, z); bulb.scale.set(0.7, 1, 0.7); scene.add(bulb);
  }

  /* ----- Versand-Kisten am Eingang (dezenter abeto-Hafen-Anklang) ----- */
  const crateMat = new THREE.MeshToonMaterial({ color: 0xb58a57 }); // warmes Holz/Karton (abeto)
  const crateBand = new THREE.MeshToonMaterial({ color: 0x7c5f3d });
  const crateGeoL = new THREE.BoxGeometry(0.9, 0.9, 0.9), crateGeoM = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  const crateBandGeoL = new THREE.BoxGeometry(0.92, 0.12, 0.92), crateBandGeoM = new THREE.BoxGeometry(0.62, 0.1, 0.62);
  disposables.push(crateMat, crateBand, crateGeoL, crateGeoM, crateBandGeoL, crateBandGeoM);
  const mkCrate = (geo, bandGeo, x, y, z, ry) => {
    const c = place(geo, crateMat, x, y, z); c.rotation.y = ry || 0;
    const band = new THREE.Mesh(bandGeo, crateBand); band.position.y = geo.parameters.height * 0.5 - 0.02; c.add(band);
    scene.add(c); return c;
  };
  mkCrate(crateGeoL, crateBandGeoL, 4.1, 0.45, -3.2, 0.3); obstacles.push({ x: 4.1, z: -3.2, r: 0.75 });
  mkCrate(crateGeoM, crateBandGeoM, 4.4, 1.2, -2.9, -0.25);
  mkCrate(crateGeoL, crateBandGeoL, -4.2, 0.45, -16, -0.2); obstacles.push({ x: -4.2, z: -16, r: 0.75 });

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

  /* ----- Figur: handgebaute cel-shaded Bote:in (abeto-Stil) — nur Tastatur ----- */
  const START = new THREE.Vector3(0, 0, 3);
  const hero = makeHero(THREE, acc.getHex());
  const proceduralParts = hero.userData.parts;
  hero.position.copy(START); scene.add(hero);
  let heading = Math.PI; hero.rotation.y = heading; // schaut in den Saal (-Z)
  // weicher Kontakt-Tupfer unter der Figur
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; scene.add(shadow);
  let jumpY = 0, vy = 0, grounded = true;
  function jump() { if (grounded) { vy = 5.2; grounded = false; } }

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
    if (k === " " || k === "enter") { if (!tutorialDone) { e.preventDefault(); nextBubble(); return; } if (k === " " && !panelOpen) { e.preventDefault(); jump(); return; } }
    if (k === "e") { e.preventDefault(); if (panelOpen) closePanel(); else if (near) openPanel(near.slide); else if (nearPortal) returnToStart(); }
    if (k === "escape" && panelOpen) closePanel();
  }
  function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
  function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); }
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
  let raf = 0, walkT = 0;
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
      const moving = len > 0.01;
      if (moving) {
        mx /= len; mz /= len;
        const spd = 5 * dt;
        hero.position.x += mx * spd; hero.position.z += mz * spd;
        for (const o of obstacles) { const dx = hero.position.x - o.x, dz = hero.position.z - o.z, dd = Math.hypot(dx, dz), rr = o.r + 0.45; if (dd < rr && dd > 0.001) { hero.position.x = o.x + (dx / dd) * rr; hero.position.z = o.z + (dz / dd) * rr; } }
        hero.position.x = clamp(hero.position.x, xMin, xMax);
        hero.position.z = clamp(hero.position.z, zMin, zMax);
        const targetH = Math.atan2(mx, mz);
        let d = targetH - heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        heading += d * Math.min(1, dt * 12);
        hero.rotation.y = heading;
      }
      // Sprung-Physik (Leertaste)
      if (!grounded) { vy -= 14 * dt; jumpY += vy * dt; if (jumpY <= 0) { jumpY = 0; vy = 0; grounded = true; } }
      // Animation: prozedurale Glieder (Lauf-Schwung) + sanftes Wippen
      if (moving) { walkT += dt * 9; const sw = Math.sin(walkT) * 0.7; proceduralParts.lleg.rotation.x = sw; proceduralParts.rleg.rotation.x = -sw; proceduralParts.larm.rotation.x = -sw * 0.7; proceduralParts.rarm.rotation.x = sw * 0.7; }
      else { walkT = 0; for (const k in proceduralParts) proceduralParts[k].rotation.x *= 0.82; }
      const bob = (grounded && moving) ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.05 : 0;
      hero.position.y = jumpY + bob;
      shadow.position.set(hero.position.x, 0.015, hero.position.z);
      shadow.material.opacity = 0.14 * Math.max(0.25, 1 - jumpY * 0.7);
      // Sonne (Schatten) folgt der Figur
      dir.position.set(hero.position.x + sunOff.x, sunOff.y, hero.position.z + sunOff.z);
      dir.target.position.set(hero.position.x, 0, hero.position.z); dir.target.updateMatrixWorld();

      // Kamera folgt (sanfter Diorama-Blick)
      camPos.set(hero.position.x, 4.6, hero.position.z + 7);
      camera.position.lerp(camPos, 1 - Math.pow(0.0015, dt));
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
    composer.render();
    raf = requestAnimationFrame(loop);
  }

  function close() {
    cancelAnimationFrame(raf); clearTimeout(bubbleTimer);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("resize", onResize);
    if (bubbleEl) { bubbleEl.hidden = true; bubbleEl.onclick = null; }
    try { disposables.forEach((d) => d && d.dispose && d.dispose()); composer.dispose(); renderer.dispose(); } catch (e) {}
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

  // Schatten: feste Toon-Objekte werfen & empfangen Schatten
  scene.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshToonMaterial) { o.castShadow = true; o.receiveShadow = true; } });
  floor.castShadow = false;

  // abeto-Tinten-Outlines: dünne inverted-hull-Hülle um alle festen Objekte
  // (Wände/Boden/Tafeln = Planes und Glows/Figur ausgenommen) → Comic/Manga-Look
  hero.traverse((o) => { o.userData.noOutline = true; });
  (function inkOutline() {
    const todo = [];
    scene.traverse((o) => {
      if (!o.isMesh || o.userData.noOutline || o.userData.isOutline) return;
      if (o.material && o.material.side === THREE.BackSide) return;
      const g = o.geometry; if (!g || /Plane/.test(g.type || "")) return;
      const m = o.material; if (m && m.transparent && (m.opacity == null || m.opacity < 0.92)) return;
      todo.push(o);
    });
    for (const o of todo) { const s = new THREE.Mesh(o.geometry, outlineMat); s.scale.setScalar(1.035); s.userData.isOutline = true; o.add(s); }
  })();

  loader.hidden = true;
  if (tutOff) { tutorialDone = true; if (bubbleEl) bubbleEl.hidden = true; } else showBubble();
  raf = requestAnimationFrame(loop);
}
