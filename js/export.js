/* ===================================================================
   export.js — exportiert die aktuelle Präsi als EINE in sich
   geschlossene .html (eingebetteter Viewer + Bilder als Data-URL).
   Läuft per Doppelklick in jedem Browser, ohne WonderDeck.
   =================================================================== */

import { themeVars } from "./themes.js";

/* Eigenständiger Viewer (wird via toString() in die Export-Datei eingebettet
   und dort mit dem Deck aufgerufen). Darf nur globale APIs nutzen. */
function VIEWER_RUNTIME(DECK) {
  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const SNAP_DUR = 760, SNAP_EASE = "cubic-bezier(0.22,1,0.36,1)", KEN = 9000;
  const vp = document.getElementById("vp"), cur = document.getElementById("cur");
  const dots = document.getElementById("dots"), counter = document.getElementById("counter");
  const fine = matchMedia("(pointer:fine)").matches;

  function stageEl(slide) {
    const root = document.createElement("div");
    root.className = "wd-stage"; root.style.background = slide.bg || "#05070a"; root.dataset.style = slide.style;
    if (slide.ink) root.style.setProperty("--ink", slide.ink);
    const layers = [];
    (slide.layers || []).forEach((c, i) => {
      const el = document.createElement("div"); el.className = "wd-layer"; el.style.zIndex = i + 1; el.style.opacity = c.opacity == null ? 1 : c.opacity;
      if (c.src) { const im = document.createElement("img"); im.src = c.src; el.appendChild(im); }
      el.style.transform = "scale(" + (c.scale || 1) + ")"; root.appendChild(el); layers.push({ el: el, cfg: c });
    });
    const texts = [];
    (slide.texts || []).forEach((t) => {
      const el = document.createElement("div"); el.className = "wd-text"; el.dataset.role = t.role;
      el.style.left = (t.x == null ? 8 : t.x) + "%"; el.style.top = (t.y == null ? 40 : t.y) + "%";
      el.style.width = (t.w == null ? 60 : t.w) + "%"; el.style.textAlign = t.align || "left"; el.textContent = t.text || "";
      root.appendChild(el); texts.push({ el: el, cfg: t });
    });
    return { root: root, layers: layers, texts: texts };
  }

  const stages = DECK.slides.map((s) => { const st = stageEl(s); st._transition = s.transition || "snap"; st.root.style.display = "none"; vp.appendChild(st.root); return st; });
  let index = 0, target = -1, locked = false, lastWheel = 0, touchY = null;
  const m = { nx: 0, ny: 0, tx: 0, ty: 0, cx: innerWidth / 2, cy: innerHeight / 2, lx: innerWidth / 2, ly: innerHeight / 2 };

  function resetIntro(st, now) { st._t0 = now; st.texts.forEach((t) => { t.el.style.opacity = 0; t.el.style.transform = "translateY(26px)"; }); }
  function update(st, now) {
    const a = now - (st._t0 || now);
    const id = st.root.dataset.style === "wonder" ? 2000 : 1100;
    const is = lerp(st.root.dataset.style === "wonder" ? 1.09 : 1.04, 1, easeOutCubic(clamp01(a / id)));
    st.layers.forEach((L) => {
      const c = L.cfg, ken = 1 + (c.kenburns || 0) * clamp01(a / KEN), sc = (c.scale || 1) * is * ken;
      let tx = -m.nx * (c.parallax || 0), ty = -m.ny * (c.parallax || 0), rot = 0;
      if (c.reactive) { tx += -m.nx * (c.parallax || 0) * 1.3; ty += -m.ny * (c.parallax || 0) * 1.3; rot = m.nx * 1.3; }
      L.el.style.transform = "translate3d(" + tx + "px," + ty + "px,0) scale(" + sc + ") rotate(" + rot + "deg)";
    });
    st.texts.forEach((t, i) => { const te = easeOutCubic(clamp01((a - 250 - i * 140) / 900)); t.el.style.opacity = te; t.el.style.transform = "translateY(" + (1 - te) * 26 + "px)"; });
  }
  const SPEC = {
    snap:  { in: (d) => ({ y: d > 0 ? 100 : -100 }), out: (d) => ({ y: d > 0 ? -30 : 30, s: 0.95, o: 0.4 }) },
    fade:  { in: () => ({ o: 0 }),                    out: () => ({ o: 0 }) },
    slide: { in: (d) => ({ x: d > 0 ? 100 : -100 }),  out: (d) => ({ x: d > 0 ? -100 : 100 }) },
    zoom:  { in: () => ({ s: 1.14, o: 0 }),           out: () => ({ s: 0.9, o: 0 }) },
    push:  { in: (d) => ({ y: d > 0 ? 100 : -100 }),  out: (d) => ({ y: d > 0 ? -100 : 100 }) }
  };
  function setT(st, o) {
    o = o || {};
    var x = o.x || 0, y = o.y || 0, s = o.s == null ? 1 : o.s, op = o.o == null ? 1 : o.o;
    st.root.style.transition = o.instant ? "none" : "transform " + SNAP_DUR + "ms " + SNAP_EASE + ",opacity " + SNAP_DUR + "ms " + SNAP_EASE;
    st.root.style.transform = "translate(" + x + "%," + y + "%) scale(" + s + ")"; st.root.style.opacity = op;
  }
  function setDots(i) { [].forEach.call(dots.children, (d, j) => d.classList.toggle("on", j === i)); counter.textContent = (i + 1) + " / " + stages.length; var tn = document.getElementById("topnav"); if (tn) tn.style.visibility = (DECK.slides[i] && DECK.slides[i].hideNav) ? "hidden" : ""; }
  function go(to) {
    if (locked || to < 0 || to >= stages.length || to === index) return;
    const dir = to > index ? 1 : -1, out = stages[index], inn = stages[to]; target = to; locked = true;
    const sp = SPEC[inn._transition] || SPEC.snap;
    setT(inn, Object.assign({ instant: true }, sp.in(dir))); inn.root.style.display = ""; resetIntro(inn, performance.now());
    void inn.root.offsetWidth; setT(inn, {}); setT(out, sp.out(dir)); setDots(to);
    setTimeout(() => { out.root.style.display = "none"; index = to; target = -1; locked = false; }, SNAP_DUR + 30);
  }
  function loop(now) {
    m.nx += (m.tx - m.nx) * 0.09; m.ny += (m.ty - m.ny) * 0.09;
    update(stages[index], now); if (target >= 0) update(stages[target], now);
    if (fine) { m.lx += (m.cx - m.lx) * 0.18; m.ly += (m.cy - m.ly) * 0.18; cur.style.transform = "translate3d(" + m.lx + "px," + m.ly + "px,0)"; }
    requestAnimationFrame(loop);
  }

  stages.forEach((_, i) => { const b = document.createElement("button"); b.className = "dot"; b.onclick = () => go(i); dots.appendChild(b); });

  // Website-Kopfzeile (Deck-Navigation)
  const topnav = document.getElementById("topnav");
  topnav.className = "topnav" + ((DECK.navPos || "top") === "bottom" ? " topnav--bottom" : "");
  if ((DECK.nav && DECK.nav.length) || DECK.brand || DECK.brandSrc) {
    let brand;
    if (DECK.brandSrc) { brand = document.createElement("img"); brand.className = "tn-brandimg"; brand.src = DECK.brandSrc; }
    else { brand = document.createElement("span"); brand.className = "tn-brand"; brand.textContent = DECK.brand || DECK.title || ""; }
    topnav.appendChild(brand);
    const lw = document.createElement("div"); lw.className = "tn-links";
    (DECK.nav || []).forEach((item) => {
      const a = document.createElement("a"); a.className = "tn-link"; a.href = "#"; a.textContent = item.label || "";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (item.type === "url" && item.target) window.open(item.target, "_blank", "noopener");
        else if (item.type === "deck") { /* andere Präsentation: im eigenständigen Export nicht verfügbar */ }
        else if (item.type === "text") { const note = document.getElementById("note"); const showing = !note.hidden && note.dataset.for === item.label; note.textContent = item.target || ""; note.dataset.for = item.label; note.hidden = showing; }
        else { const idx = DECK.slides.findIndex((s) => s.id === item.target); if (idx >= 0) go(idx); }
      });
      lw.appendChild(a);
    });
    topnav.appendChild(lw);
  } else { topnav.style.display = "none"; }
  addEventListener("mousemove", (e) => { m.tx = (e.clientX / innerWidth) * 2 - 1; m.ty = (e.clientY / innerHeight) * 2 - 1; m.cx = e.clientX; m.cy = e.clientY; });
  addEventListener("wheel", (e) => { e.preventDefault(); const n = performance.now(); if (n - lastWheel < 120 || Math.abs(e.deltaY) < 12) return; lastWheel = n; e.deltaY > 0 ? go(index + 1) : go(index - 1); }, { passive: false });
  addEventListener("keydown", (e) => {
    if (["ArrowDown", "ArrowRight", "PageDown", " "].indexOf(e.key) >= 0) { e.preventDefault(); go(index + 1); }
    else if (["ArrowUp", "ArrowLeft", "PageUp"].indexOf(e.key) >= 0) { e.preventDefault(); go(index - 1); }
    else if (e.key === "Home") go(0); else if (e.key === "End") go(stages.length - 1);
    else if (e.key.toLowerCase() === "f") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); }
  });
  addEventListener("touchstart", (e) => (touchY = e.touches[0].clientY), { passive: true });
  addEventListener("touchend", (e) => { if (touchY == null) return; const d = touchY - e.changedTouches[0].clientY; if (Math.abs(d) > 50) (d > 0 ? go(index + 1) : go(index - 1)); touchY = null; }, { passive: true });

  setT(stages[0], { instant: true }); stages[0].root.style.display = ""; resetIntro(stages[0], performance.now()); setDots(0);
  const hint = document.getElementById("hint"); if (hint) setTimeout(() => (hint.style.opacity = 0), 4200);
  requestAnimationFrame(loop);
}

const VIEWER_CSS = "*{margin:0;box-sizing:border-box}html,body{height:100%;overflow:hidden;background:#000;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f6efe6}@media(pointer:fine){html,body,*{cursor:none}}"
  + ".vp{position:fixed;inset:0;overflow:hidden}"
  + ".wd-stage{position:absolute;inset:0;overflow:hidden;container-type:inline-size;background:#05070a;will-change:transform,opacity}"
  + ".wd-layer{position:absolute;inset:-8%;width:116%;height:116%;will-change:transform,opacity}"
  + ".wd-layer img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}"
  + ".wd-text{position:absolute;max-width:60%;color:var(--ink,#f6efe6);text-shadow:0 2px 28px rgba(0,0,0,.5);line-height:1.08;white-space:pre-wrap;word-break:break-word;z-index:50}"
  + ".wd-text[data-role=title]{font-family:var(--font-title,'Playfair Display',Georgia,serif);font-weight:600;font-size:clamp(28px,7.4cqw,96px)}"
  + ".wd-text[data-role=subtitle]{font-family:var(--font-body,'Inter',sans-serif);font-weight:300;font-size:clamp(13px,2.1cqw,24px);line-height:1.5;opacity:.9}"
  + ".wd-text[data-role=body]{font-family:var(--font-body,'Inter',sans-serif);font-weight:400;font-size:clamp(12px,1.9cqw,21px);line-height:1.55;opacity:.86}"
  + ".wd-text[data-role=kicker]{font-family:var(--font-body,'Inter',sans-serif);font-weight:600;font-size:clamp(10px,1.4cqw,15px);letter-spacing:.22em;text-transform:uppercase;color:var(--accent,#c9a25b)}"
  + ".cur{position:fixed;top:0;left:0;width:28px;height:28px;margin:-14px 0 0 -14px;border:2px solid #fff;border-radius:50%;pointer-events:none;z-index:9999;mix-blend-mode:difference}@media(pointer:coarse){.cur{display:none}}"
  + ".dots{position:fixed;right:22px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:11px;z-index:100}"
  + ".dot{width:11px;height:11px;border-radius:50%;padding:0;cursor:pointer;background:rgba(255,255,255,.28);border:1px solid rgba(255,255,255,.5);transition:transform .2s,background .2s}.dot.on{background:#fff;transform:scale(1.35)}"
  + ".counter{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:100;font-size:13px;letter-spacing:.1em;color:rgba(255,255,255,.7);font-variant-numeric:tabular-nums}"
  + ".hint{position:fixed;bottom:16px;right:20px;z-index:100;font-size:12px;color:rgba(255,255,255,.5);transition:opacity .6s}"
  + ".topnav{position:fixed;top:0;left:0;right:0;z-index:120;display:flex;align-items:center;justify-content:space-between;padding:20px clamp(22px,5vw,60px);mix-blend-mode:difference;color:#fff;pointer-events:none}"
  + ".tn-brand{font-family:var(--font-title,'Playfair Display',Georgia,serif);font-weight:600;font-size:15px;letter-spacing:.04em}"
  + ".tn-links{display:flex;gap:clamp(14px,2vw,30px);pointer-events:auto}"
  + ".tn-link{color:#fff;text-decoration:none;font-size:12.5px;letter-spacing:.08em;text-transform:uppercase;opacity:.82}.tn-link:hover{opacity:1}"
  + ".topnav--bottom{top:auto;bottom:0}.tn-brandimg{height:26px;width:auto;display:block}"
  + ".note{position:fixed;top:64px;left:50%;transform:translateX(-50%);z-index:130;max-width:min(520px,86vw);background:rgba(20,24,30,.85);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:14px 18px;color:#f4f4f6;font-size:14px;line-height:1.55;white-space:pre-wrap}.note[hidden]{display:none}";

function esc(s) { return String(s).replace(/[<&>]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" }[c])); }

/* Eigenständiger Journey-Viewer (durchlaufbare Welt) für den Export. */
function JOURNEY_RUNTIME(DECK) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const world = document.getElementById("jworld");
  world.appendChild(Object.assign(document.createElement("div"), { className: "jr-sky" }));
  world.appendChild(Object.assign(document.createElement("div"), { className: "jr-floor" }));
  const trail = document.createElement("div"); trail.className = "jr-trail"; trail.innerHTML = '<svg viewBox="0 0 200 1000" preserveAspectRatio="xMidYMax slice"><path d="M100 1000 C60 840 150 700 98 540 C58 380 138 240 100 90 C92 56 104 30 100 0" fill="none" stroke-width="2.5"/></svg>'; world.appendChild(trail);
  const arcs = document.createElement("div"); arcs.className = "jr-arcs";
  [["left:-9%;top:16%", 0.6], ["right:-11%;top:40%", 0.9], ["left:-13%;top:64%", 1.3], ["right:-8%;top:82%", 1.7]].forEach((q) => { const a = document.createElement("span"); a.style.cssText = q[0]; a.dataset.sp = String(q[1]); arcs.appendChild(a); });
  world.appendChild(arcs);
  const depth = Object.assign(document.createElement("div"), { className: "jr-depth" });
  for (let i = 0; i < 44; i++) { const d = document.createElement("span"); d.className = "jr-dot2"; const sp = 0.2 + Math.random() * 2.8; d.dataset.sp = sp.toFixed(2); d.style.left = (Math.random() * 100).toFixed(1) + "%"; d.style.top = (Math.random() * 100).toFixed(1) + "%"; const s = (0.8 + sp * 0.9).toFixed(1); d.style.width = d.style.height = s + "px"; d.style.opacity = (0.1 + Math.random() * 0.45).toFixed(2); depth.appendChild(d); }
  world.appendChild(depth);
  const stageEl = Object.assign(document.createElement("div"), { className: "jr-stations" });
  world.appendChild(stageEl);
  const stations = DECK.slides.map((slide) => {
    const st = Object.assign(document.createElement("div"), { className: "jr-station" });
    if (slide.ink) st.style.setProperty("--ink", slide.ink);
    const bg = (slide.layers || []).find((l) => l.src);
    if (bg) { const im = document.createElement("img"); im.className = "jr-station__img"; im.src = bg.src; st.appendChild(im); }
    (slide.texts || []).forEach((t) => { const d = document.createElement("div"); d.className = "wd-text jr-text"; d.dataset.role = t.role; d.style.textAlign = t.align || "center"; d.textContent = t.text || ""; st.appendChild(d); });
    stageEl.appendChild(st); return st;
  });
  const n = stations.length; let prog = 0, target = 0, drag = null;
  const dots = document.getElementById("jdots"), counter = document.getElementById("jcounter");
  stations.forEach((_, i) => { const b = document.createElement("button"); b.className = "jr-dot"; b.onclick = () => (target = i); dots.appendChild(b); });
  function loop() {
    target = clamp(target, 0, n - 1); prog += (target - prog) * 0.12; const p = prog;
    const sky = world.querySelector(".jr-sky"), floor = world.querySelector(".jr-floor");
    if (sky) sky.style.transform = "translateY(" + (-p * 22).toFixed(1) + "px) scale(1.1)";
    if (floor) floor.style.backgroundPosition = "0 " + (p * 120).toFixed(0) + "px";
    for (const d of depth.children) d.style.transform = "translateY(" + (-p * parseFloat(d.dataset.sp) * 38).toFixed(1) + "px)";
    const tr = world.querySelector(".jr-trail svg"); if (tr) tr.style.transform = "translateY(" + (-p * 44).toFixed(1) + "px)";
    const ar = world.querySelector(".jr-arcs"); if (ar) for (const a of ar.children) a.style.transform = "translateY(" + (-p * parseFloat(a.dataset.sp) * 60).toFixed(1) + "px)";
    stations.forEach((st, i) => { const dd = i - p; if (dd < -1.1 || dd > 3.4) { st.style.display = "none"; return; } st.style.display = ""; let sc, op, ty; if (dd >= 0) { sc = 1 / (1 + dd * 0.55); op = clamp(1 - dd * 0.42, 0, 1); ty = -dd * 70; } else { sc = 1 + (-dd) * 0.7; op = clamp(1 + dd * 1.4, 0, 1); ty = (-dd) * 150; } st.style.transform = "translate(-50%,-50%) translateY(" + ty.toFixed(1) + "px) scale(" + sc.toFixed(3) + ")"; st.style.opacity = op.toFixed(3); st.style.zIndex = String(200 - Math.round(Math.abs(dd) * 10)); });
    const idx = Math.round(p); [].forEach.call(dots.children, (d, i) => d.classList.toggle("on", i === idx)); counter.textContent = (idx + 1) + " / " + n;
    requestAnimationFrame(loop);
  }
  addEventListener("wheel", (e) => { e.preventDefault(); target = clamp(target + e.deltaY * 0.0016, 0, n - 1); }, { passive: false });
  addEventListener("keydown", (e) => { if (["ArrowDown", "ArrowRight", "PageDown", " "].indexOf(e.key) >= 0) { e.preventDefault(); target = clamp(Math.round(target) + 1, 0, n - 1); } else if (["ArrowUp", "ArrowLeft", "PageUp"].indexOf(e.key) >= 0) { e.preventDefault(); target = clamp(Math.round(target) - 1, 0, n - 1); } else if (e.key === "Home") target = 0; else if (e.key === "End") target = n - 1; else if (e.key.toLowerCase() === "f") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); } });
  function down(e) { drag = e.touches ? e.touches[0].clientY : e.clientY; }
  function move(e) { if (drag == null) return; const y = e.touches ? e.touches[0].clientY : e.clientY; target = clamp(target + (drag - y) * 0.004, 0, n - 1); drag = y; if (e.cancelable) e.preventDefault(); }
  function up() { drag = null; }
  addEventListener("mousedown", down); addEventListener("mousemove", move); addEventListener("mouseup", up);
  addEventListener("touchstart", down, { passive: true }); addEventListener("touchmove", move, { passive: false }); addEventListener("touchend", up);
  requestAnimationFrame(loop);
}

const JOURNEY_CSS = "*{margin:0;box-sizing:border-box}html,body{height:100%;overflow:hidden;background:#06070a;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:var(--ink,#f4f1ea)}"
  + ".wd-text{color:var(--ink,#f6efe6);text-shadow:0 2px 28px rgba(0,0,0,.5);line-height:1.08;white-space:pre-wrap;word-break:break-word}"
  + ".wd-text[data-role=title]{font-family:var(--font-title,'Playfair Display',Georgia,serif);font-weight:600;font-size:clamp(28px,7.4cqw,96px)}"
  + ".wd-text[data-role=subtitle]{font-family:var(--font-body,'Inter',sans-serif);font-weight:300;font-size:clamp(13px,2.1cqw,24px);line-height:1.5;opacity:.9}"
  + ".wd-text[data-role=body]{font-family:var(--font-body,'Inter',sans-serif);font-weight:400;font-size:clamp(12px,1.9cqw,21px);line-height:1.55;opacity:.86}"
  + ".wd-text[data-role=kicker]{font-family:var(--font-body,'Inter',sans-serif);font-weight:600;font-size:clamp(10px,1.4cqw,15px);letter-spacing:.22em;text-transform:uppercase;color:var(--accent,#c9a25b)}"
  + ".jr-world{position:fixed;inset:0;overflow:hidden}"
  + ".jr-sky{position:absolute;inset:-12%;will-change:transform;background:radial-gradient(120% 80% at 50% 32%,color-mix(in srgb,var(--accent,#c9a25b) 16%,#0a0c12),#06070a 72%)}"
  + ".jr-floor{position:absolute;left:0;right:0;bottom:0;height:46%;opacity:.5;clip-path:polygon(40% 0,60% 0,100% 100%,0 100%);background-image:repeating-linear-gradient(to top,color-mix(in srgb,var(--accent,#c9a25b) 16%,transparent) 0 2px,transparent 2px 48px)}"
  + ".jr-trail{position:absolute;left:50%;bottom:0;width:46vw;height:72%;transform:translateX(-50%);pointer-events:none;-webkit-mask-image:linear-gradient(to top,#000 28%,transparent);mask-image:linear-gradient(to top,#000 28%,transparent)}.jr-trail svg{width:100%;height:118%;will-change:transform}.jr-trail path{stroke:var(--accent,#c9a25b);stroke-opacity:.55}"
  + ".jr-arcs{position:absolute;inset:0;pointer-events:none}.jr-arcs span{position:absolute;width:44vmin;height:44vmin;border-radius:50%;border:1px solid color-mix(in srgb,var(--accent,#c9a25b) 20%,transparent);will-change:transform}"
  + ".jr-depth{position:absolute;inset:0;pointer-events:none}.jr-dot2{position:absolute;border-radius:50%;background:var(--ink,#fff);will-change:transform}"
  + ".jr-stations{position:absolute;inset:0}"
  + ".jr-station{position:absolute;left:50%;top:50%;width:min(74%,780px);text-align:center;container-type:inline-size;will-change:transform,opacity}"
  + ".jr-station__img{width:100%;max-height:42vh;object-fit:cover;border-radius:16px;margin:0 auto 26px;display:block;box-shadow:0 36px 90px rgba(0,0,0,.55)}"
  + ".jr-text{max-width:none;display:block;margin:0 auto 14px}"
  + ".jr-dots{position:fixed;right:22px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:13px;z-index:100}.jr-dot{width:9px;height:9px;border-radius:50%;padding:0;cursor:pointer;background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.45)}.jr-dot.on{background:#fff;transform:scale(1.5)}"
  + ".jr-counter{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:100;font-size:13px;letter-spacing:.1em;color:rgba(255,255,255,.7);font-variant-numeric:tabular-nums}"
  + ".jr-hint{position:fixed;bottom:16px;right:20px;z-index:100;font-size:12px;color:rgba(255,255,255,.5)}";

/* Eigenständige, begehbare 3D-Welt (Three.js via CDN-Import-Map) für den Export.
   Wird als type="module" eingebettet, das THREE importiert und dann diese
   Funktion mit (DECK, CFG, THREE) aufruft. Spiegelt js/world.js. */
/* Eigenständige, begehbare 3D-Welt (Comic-Museum, dritte Person, nur Tastatur).
   Spiegelt js/world.js. Wird als type="module" eingebettet, importiert THREE
   und ruft diese Funktion mit (DECK, CFG, THREE) auf. */
function WORLD_RUNTIME(DECK, CFG, THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const esc = (s) => String(s == null ? "" : s).replace(/[<&>]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" }[c]));
  const hexA = (hex, a) => { let h = String(hex || "").trim().replace("#", ""); if (h.length === 3) h = h.split("").map((x) => x + x).join(""); if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return "rgba(255,255,255," + a + ")"; return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")"; };
  const accent = CFG.accent, ink = CFG.ink, fontTitle = CFG.fontTitle, fontBody = CFG.fontBody;
  const resolveSrc = (l) => (l && l.src) || null;

  const mk = (cls) => { const d = document.createElement("div"); if (cls) d.className = cls; return d; };
  const stage = mk("world__stage"); document.body.appendChild(stage);
  const loader = mk("world__load"); loader.innerHTML = '<div class="world__spinner"></div><p>3D-Welt wird geladen …</p>'; document.body.appendChild(loader);
  const hintEl = mk("world__hint"); document.body.appendChild(hintEl);
  const panel = mk("world__panel"); panel.hidden = true; document.body.appendChild(panel);
  const joy = mk("world__joy"); joy.hidden = true; const nub = mk("world__nub"); joy.appendChild(nub); document.body.appendChild(joy);
  const bubbleEl = mk("world__bubble"); bubbleEl.hidden = true; document.body.appendChild(bubbleEl);
  const homeBtn = document.createElement("button"); homeBtn.className = "world__home"; homeBtn.textContent = "⟲ Anfang"; document.body.appendChild(homeBtn);
  panel.style.setProperty("--accent", accent); panel.style.setProperty("--ink", ink);

  function coverDraw(ctx, img, w, h) { const r = Math.max(w / img.width, h / img.height), iw = img.width * r, ih = img.height * r; ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih); }
  function wrapText(ctx, text, x, y, maxW, lh) { const words = String(text).split(/\s+/); let line = ""; for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t; } if (line) { ctx.fillText(line, x, y); y += lh; } return y; }
  function slideToCanvas(slide) {
    return new Promise((resolve) => {
      const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 576; const ctx = cv.getContext("2d");
      const text = (role) => (slide.texts || []).find((t) => t.role === role);
      const draw = (img) => {
        ctx.fillStyle = slide.bg || "#0a0e16"; ctx.fillRect(0, 0, 1024, 576);
        if (img) { coverDraw(ctx, img, 1024, 576); const g = ctx.createLinearGradient(0, 576, 0, 0); g.addColorStop(0, "rgba(0,0,0,0.82)"); g.addColorStop(0.55, "rgba(0,0,0,0.2)"); g.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 576); }
        else { const rg = ctx.createRadialGradient(330, 250, 40, 330, 250, 760); rg.addColorStop(0, hexA(accent, 0.26)); rg.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = rg; ctx.fillRect(0, 0, 1024, 576); const lg = ctx.createLinearGradient(0, 0, 0, 576); lg.addColorStop(0, "rgba(255,255,255,0.08)"); lg.addColorStop(0.6, "rgba(255,255,255,0)"); ctx.fillStyle = lg; ctx.fillRect(0, 0, 1024, 576); }
        ctx.textBaseline = "alphabetic"; const pad = 60;
        const k = text("kicker"), ti = text("title"), su = text("subtitle") || text("body"); let y = 372;
        if (k) { ctx.fillStyle = accent; ctx.font = "600 22px " + fontBody; ctx.fillText((k.text || "").toUpperCase().replace(/\n/g, " "), pad, y); }
        if (ti) { ctx.fillStyle = ink; ctx.font = "700 62px " + fontTitle; y = wrapText(ctx, (ti.text || "").replace(/\n/g, " "), pad, 452, 904, 62); }
        if (su) { ctx.fillStyle = ink; ctx.globalAlpha = 0.85; ctx.font = "300 26px " + fontBody; wrapText(ctx, (su.text || "").replace(/\n/g, " "), pad, y + 18, 884, 32); ctx.globalAlpha = 1; }
        resolve(cv);
      };
      const layer = (slide.layers || []).find((l) => resolveSrc(l)); const src = layer ? resolveSrc(layer) : null;
      if (src) { const img = new Image(); img.onload = () => draw(img); img.onerror = () => draw(null); img.src = src; } else draw(null);
    });
  }
  function dancheongTexture() {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 48; const c = cv.getContext("2d");
    c.fillStyle = "#1f6f4a"; c.fillRect(0, 0, 256, 48);
    const cols = ["#c0392b", "#2e6fb0", "#e8c33a", "#f4f1ea"];
    for (let x = 0, i = 0; x < 256; x += 32, i++) { c.fillStyle = cols[i % cols.length]; c.fillRect(x + 6, 8, 20, 32); }
    c.fillStyle = "#102a1c"; c.fillRect(0, 0, 256, 5); c.fillRect(0, 43, 256, 5);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function makeHero(accentHex) {
    const g = new THREE.Group();
    const acc = new THREE.Color(accentHex);
    // Weiche 4-Stufen-Cel-Schattierung (gradientMap) → „gezeichneter" Anime-Look
    const rampCv = document.createElement("canvas"); rampCv.width = 4; rampCv.height = 1;
    { const x = rampCv.getContext("2d"); const steps = ["#9a9088", "#c4bcb2", "#ece7df", "#ffffff"]; for (let i = 0; i < 4; i++) { x.fillStyle = steps[i]; x.fillRect(i, 0, 1, 1); } }
    const ramp = new THREE.CanvasTexture(rampCv); ramp.minFilter = ramp.magFilter = THREE.NearestFilter; if ("colorSpace" in ramp) ramp.colorSpace = THREE.SRGBColorSpace;
    const toon = (color) => new THREE.MeshToonMaterial({ color, gradientMap: ramp });
    const skin = toon(0xf4d9c6), hairC = toon(0x342c40), hairHi = toon(0x4b4060), tieC = toon(0xc7423a);
    const shirt = toon(0x23262d), pants = toon(0x1a1d22), bagC = toon(0xeae3d3), bagD = toon(0xd6cdb9);
    const sockC = toon(0xf3f0e7), shoeC = toon(0x15171b), blush = toon(0xe9a591), lip = toon(0xc77f72), emblem = toon(acc.getHex());
    const eyeDark = new THREE.MeshBasicMaterial({ color: 0x2a2331 }), eyeHi = new THREE.MeshBasicMaterial({ color: 0xfdfcff });
    const out = new THREE.MeshBasicMaterial({ color: 0x141019, side: THREE.BackSide });
    const M = (geo, mat) => new THREE.Mesh(geo, mat);
    const add = (geo, mat, x, y, z) => { const m = M(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    const ol = (mesh, s) => { const o = new THREE.Mesh(mesh.geometry, out); o.scale.setScalar(s); mesh.add(o); return o; };
    const legGeo = new THREE.CapsuleGeometry(0.072, 0.5, 6, 14), sockGeo = new THREE.CylinderGeometry(0.084, 0.078, 0.12, 14), shoeGeo = new THREE.CapsuleGeometry(0.078, 0.13, 6, 12);
    const mkLeg = (x) => {
      const p = new THREE.Group(); p.position.set(x, 0.88, 0);
      const leg = M(legGeo, skin); leg.position.y = -0.33; ol(leg, 1.1); p.add(leg);
      p.add(M(sockGeo, sockC).translateY(-0.66));
      const sh = M(shoeGeo, shoeC); sh.rotation.x = Math.PI / 2; sh.position.set(0, -0.79, 0.06); ol(sh, 1.08); p.add(sh);
      g.add(p); return p;
    };
    const lleg = mkLeg(-0.1), rleg = mkLeg(0.1);
    const shorts = add(new THREE.CylinderGeometry(0.175, 0.255, 0.34, 20), pants, 0, 0.85, 0); ol(shorts, 1.05);
    const torso = add(new THREE.CapsuleGeometry(0.175, 0.34, 8, 18), shirt, 0, 1.18, 0); ol(torso, 1.05);
    add(new THREE.BoxGeometry(0.12, 0.12, 0.02), emblem, 0, 1.22, 0.176);
    add(new THREE.CylinderGeometry(0.05, 0.062, 0.1, 12), skin, 0, 1.46, 0);
    const head = add(new THREE.SphereGeometry(0.15, 24, 20), skin, 0, 1.61, 0.005); head.scale.set(0.95, 1.07, 0.97); ol(head, 1.05);
    const chin = add(new THREE.SphereGeometry(0.085, 16, 12), skin, 0, 1.53, 0.05); chin.scale.set(1.05, 0.9, 0.95);
    for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.03, 10, 8), skin, sx * 0.148, 1.6, -0.005);
    const crown = add(new THREE.SphereGeometry(0.158, 22, 18), hairC, 0, 1.665, -0.038); crown.scale.set(1.06, 1.0, 1.05);
    const nape = add(new THREE.SphereGeometry(0.132, 18, 14), hairC, 0, 1.56, -0.06); nape.scale.set(1.04, 1.05, 0.85);
    for (const sx of [-1, 1]) { const fr = add(new THREE.CapsuleGeometry(0.045, 0.12, 5, 10), hairC, sx * 0.055, 1.675, 0.108); fr.rotation.set(0.5, 0, sx * 0.62); fr.scale.set(1, 1, 0.7); }
    add(new THREE.SphereGeometry(0.05, 12, 10), hairC, 0, 1.715, 0.075).scale.set(1.5, 0.5, 0.7);
    for (const sx of [-1, 1]) { const lock = add(new THREE.CapsuleGeometry(0.03, 0.2, 5, 10), hairC, sx * 0.138, 1.55, 0.03); lock.rotation.z = sx * 0.16; }
    add(new THREE.SphereGeometry(0.073, 16, 14), hairC, 0, 1.82, -0.045);
    add(new THREE.SphereGeometry(0.03, 8, 8), hairHi, -0.05, 1.69, 0.02);
    const tie = add(new THREE.TorusGeometry(0.052, 0.017, 8, 18), tieC, 0, 1.785, -0.045); tie.rotation.x = Math.PI / 2;
    for (const sx of [-1, 1]) {
      const eye = add(new THREE.SphereGeometry(0.027, 12, 10), eyeDark, sx * 0.06, 1.6, 0.132); eye.scale.set(0.78, 1.3, 0.42);
      add(new THREE.SphereGeometry(0.009, 8, 8), eyeHi, sx * 0.052, 1.618, 0.15);
      const brow = add(new THREE.BoxGeometry(0.055, 0.013, 0.012), hairC, sx * 0.062, 1.648, 0.138); brow.rotation.z = -sx * 0.1;
      const bl = add(new THREE.SphereGeometry(0.038, 10, 8), blush, sx * 0.092, 1.575, 0.11); bl.scale.set(1.1, 0.7, 0.25);
    }
    add(new THREE.SphereGeometry(0.02, 10, 8), skin, 0, 1.575, 0.152).scale.set(0.6, 0.7, 0.6);
    add(new THREE.SphereGeometry(0.024, 10, 8), lip, 0, 1.535, 0.145).scale.set(1.3, 0.4, 0.4);
    const mkArm = (x) => {
      const p = new THREE.Group(); p.position.set(x, 1.4, 0);
      const shoulder = M(new THREE.SphereGeometry(0.082, 14, 12), shirt); ol(shoulder, 1.05); p.add(shoulder);
      const arm = M(new THREE.CapsuleGeometry(0.05, 0.34, 6, 12), skin); arm.position.y = -0.26; ol(arm, 1.1); p.add(arm);
      const sleeve = M(new THREE.SphereGeometry(0.073, 14, 12), shirt); sleeve.position.y = -0.09; sleeve.scale.set(1, 0.78, 1); p.add(sleeve);
      const hand = M(new THREE.SphereGeometry(0.052, 12, 10), skin); hand.position.y = -0.475; hand.scale.set(1, 1.15, 0.78); p.add(hand);
      g.add(p); return p;
    };
    const larm = mkArm(-0.205), rarm = mkArm(0.205);
    const bag = add(new THREE.BoxGeometry(0.3, 0.4, 0.17), bagC, 0, 1.14, -0.23); ol(bag, 1.04);
    add(new THREE.BoxGeometry(0.3, 0.13, 0.18), bagD, 0, 1.31, -0.23);
    add(new THREE.BoxGeometry(0.16, 0.16, 0.04), bagD, 0, 1.05, -0.318);
    for (const sx of [-1, 1]) { const strap = add(new THREE.BoxGeometry(0.045, 0.44, 0.04), bagD, sx * 0.1, 1.2, 0.165); strap.rotation.x = -0.04; }
    g.userData.parts = { lleg, rleg, larm, rarm };
    return g;
  }

  function gradientSky(topCss, botCss) { const cv = document.createElement("canvas"); cv.width = 8; cv.height = 256; const c = cv.getContext("2d"); const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, topCss); g.addColorStop(1, botCss); c.fillStyle = g; c.fillRect(0, 0, 8, 256); const t = new THREE.CanvasTexture(cv); if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; return t; }
  function marbleTexture(baseCss, veinCss) { const cv = document.createElement("canvas"); cv.width = 512; cv.height = 512; const c = cv.getContext("2d"); c.fillStyle = baseCss; c.fillRect(0, 0, 512, 512); c.strokeStyle = veinCss; c.lineWidth = 1.3; c.globalAlpha = 0.45; for (let i = 0; i < 26; i++) { c.beginPath(); let x = Math.random() * 512, y = Math.random() * 512; c.moveTo(x, y); for (let j = 0; j < 7; j++) { x += (Math.random() - 0.5) * 130; y += (Math.random() - 0.5) * 130; c.lineTo(x, y); } c.stroke(); } c.globalAlpha = 0.045; for (let i = 0; i < 1800; i++) { c.fillStyle = Math.random() < 0.5 ? "#000" : "#fff"; c.fillRect(Math.random() * 512, Math.random() * 512, 1.6, 1.6); } c.globalAlpha = 1; const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; return t; }
  async function boot() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(window.innerWidth, window.innerHeight);
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
    stage.innerHTML = ""; stage.appendChild(renderer.domElement);

    const acc = new THREE.Color(accent); const hsl = {}; acc.getHSL(hsl);
    const tint = (l, s) => new THREE.Color().setHSL(hsl.h, Math.min(hsl.s, s == null ? 0.4 : s), l);
    const place = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
    // abeto-Basis-Palette (fest): Teal/Aqua-Himmel + warmes Steingrau; Theme-Akzent nur als Highlight
    const A = { wall: 0xdcd6c9, wallDark: 0x39352e, ceil: 0xe6e0d3, stone: 0xd2cbbc, stoneDark: 0x8a8273, wood: 0x9c7b54, beam: 0xc0b8a8, floor: 0xd0c9ba, floorVein: 0xb3ab9a };
    const scene = new THREE.Scene(); scene.background = gradientSky("#6cc2bc", "#cbe9e2"); scene.fog = new THREE.Fog(0xd2eae3, 46, 150);
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 240);
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.5, 0.82);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    scene.add(new THREE.HemisphereLight(0xe9f4f1, 0xcdbfa6, 1.05));
    scene.add(new THREE.AmbientLight(0xece5d6, 0.42));
    const dir = new THREE.DirectionalLight(0xfff1d6, 1.3); dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048);
    const sc = dir.shadow.camera; sc.near = 1; sc.far = 70; sc.left = -18; sc.right = 18; sc.top = 18; sc.bottom = -18; sc.updateProjectionMatrix();
    dir.shadow.bias = -0.0007; dir.shadow.normalBias = 0.04; scene.add(dir); scene.add(dir.target);
    const sunOff = new THREE.Vector3(7, 17, 9);

    const n = DECK.slides.length; const spacing = 7, halfW = 7.5, hallLen = n * spacing + 18, FRONT_Z = 13;
    const obstacles = [];
    const glowEnd = new THREE.PointLight(acc.getHex(), 0.9, 80, 1.3); glowEnd.position.set(0, 3.6, -hallLen + 6); scene.add(glowEnd);

    const floorTex = marbleTexture(new THREE.Color(A.floor).getStyle(), new THREE.Color(A.floorVein).getStyle()); floorTex.repeat.set(4, Math.max(4, Math.round((hallLen + 24) / 8)));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, hallLen + 24), new THREE.MeshToonMaterial({ map: floorTex }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = -hallLen / 2 + 6; floor.receiveShadow = true; scene.add(floor);
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.8, hallLen + 24), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.22 }));
    runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.02, floor.position.z); scene.add(runner);

    const wallMat = new THREE.MeshToonMaterial({ color: A.wall, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 24, 6.4), wallMat); wall.position.set(sx * halfW, 3.2, floor.position.z); wall.rotation.y = -sx * Math.PI / 2; scene.add(wall);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 24, 0.14), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.4 })); strip.position.set(sx * (halfW - 0.01), 4.7, floor.position.z); strip.rotation.y = -sx * Math.PI / 2; scene.add(strip);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, hallLen + 24), new THREE.MeshToonMaterial({ color: A.wallDark })); base.position.set(sx * (halfW - 0.08), 0.2, floor.position.z); scene.add(base);
    }
    for (const [z, ry] of [[FRONT_Z, Math.PI], [-hallLen + 5, 0]]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, 6.4), wallMat); w.position.set(0, 3.2, z); w.rotation.y = ry; scene.add(w); }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, hallLen + 24), new THREE.MeshToonMaterial({ color: A.ceil, side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.4, floor.position.z); scene.add(ceil);
    const skylight = new THREE.Mesh(new THREE.PlaneGeometry(2.4, hallLen + 20), new THREE.MeshBasicMaterial({ color: 0xfff4e2 })); skylight.rotation.x = Math.PI / 2; skylight.position.set(0, 5.36, floor.position.z); scene.add(skylight);
    for (let z = -4; z > -hallLen + 6; z -= 16) { const sl = new THREE.PointLight(0xfff2e0, 0.45, 26, 1.8); sl.position.set(0, 5.0, z); scene.add(sl); }

    const stoneMat = new THREE.MeshToonMaterial({ color: A.stone });
    const stoneDark = new THREE.MeshToonMaterial({ color: A.stoneDark });
    const woodMat = new THREE.MeshToonMaterial({ color: A.wood });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xb89b5e, roughness: 0.45, metalness: 0.5 });
    const leafMat = new THREE.MeshToonMaterial({ color: 0x6f9a72 });
    const potMat = new THREE.MeshToonMaterial({ color: 0xb07a5a });
    const beamMat = new THREE.MeshToonMaterial({ color: A.beam });
    const outlineMat = new THREE.MeshBasicMaterial({ color: 0x1a1620, side: THREE.BackSide }); // abeto-Tinten-Outline
    const colGeo = new THREE.CylinderGeometry(0.4, 0.46, 4.9, 18), fluteGeo = new THREE.BoxGeometry(1.1, 0.42, 1.1), capGeo = new THREE.BoxGeometry(1.0, 0.34, 1.0), beamGeo = new THREE.BoxGeometry(halfW * 2, 0.3, 0.42);
    const colXs = [-(halfW - 0.7), halfW - 0.7];
    const colZs = []; for (let z = 1; z > -hallLen + 6; z -= 7) colZs.push(z);
    for (const z of colZs) {
      scene.add(place(beamGeo, beamMat, 0, 5.22, z));
      for (const cx of colXs) { scene.add(place(colGeo, stoneMat, cx, 2.65, z)); scene.add(place(fluteGeo, stoneDark, cx, 0.21, z)); scene.add(place(capGeo, stoneDark, cx, 5.02, z)); obstacles.push({ x: cx, z, r: 0.6 }); }
    }
    const artFrameGeo = new THREE.BoxGeometry(2.7, 3.5, 0.14), artFillGeo = new THREE.PlaneGeometry(2.2, 3.0);
    const artZs = []; for (let z = -2.5; z > -hallLen + 6; z -= 7) artZs.push(z);
    for (const z of artZs) for (const sx of [-1, 1]) {
      const fr = new THREE.Mesh(artFrameGeo, frameMat); fr.position.set(sx * (halfW - 0.13), 2.7, z); fr.rotation.y = -sx * Math.PI / 2; scene.add(fr);
      const fill = new THREE.Mesh(artFillGeo, new THREE.MeshToonMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.28, 0.62).getHex() })); fill.position.set(sx * (halfW - 0.19), 2.7, z); fill.rotation.y = -sx * Math.PI / 2; scene.add(fill);
    }
    const benchSeatGeo = new THREE.BoxGeometry(2.6, 0.18, 0.8), benchLegGeo = new THREE.BoxGeometry(0.18, 0.5, 0.7), potGeo = new THREE.CylinderGeometry(0.34, 0.26, 0.6, 14), leafGeo = new THREE.SphereGeometry(0.58, 12, 10);
    for (let i = 0, z = -5; z > -hallLen + 6; z -= 14, i++) for (const sx of [-1, 1]) {
      const bx = sx * (halfW - 2.3);
      scene.add(place(benchSeatGeo, woodMat, bx, 0.5, z));
      for (const lz of [-0.7, 0.7]) scene.add(place(benchLegGeo, woodMat, bx, 0.25, z + lz));
      if (i % 2 === 0) { const px = sx * (halfW - 0.95); scene.add(place(potGeo, potMat, px, 0.3, z + 3.5)); const leaf = place(leafGeo, leafMat, px, 0.95, z + 3.5); leaf.scale.set(1, 1.3, 1); scene.add(leaf); obstacles.push({ x: px, z: z + 3.5, r: 0.6 }); }
    }

    const lampCols = [0xc28a6e, 0x7d8bb0, 0xcdb07a];
    for (let i = 0, z = -6; z > -hallLen + 6; z -= 13, i++) {
      const col = lampCols[i % lampCols.length];
      const g = new THREE.Group(); g.position.set((i % 2 ? 1 : -1) * 1.9, 0, z); scene.add(g);
      g.add(place(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), new THREE.MeshBasicMaterial({ color: 0x3a3a3a }), 0, 4.75, 0));
      g.add(place(new THREE.CylinderGeometry(0.25, 0.25, 0.44, 16), new THREE.MeshBasicMaterial({ color: col }), 0, 4.06, 0));
      g.add(place(new THREE.CylinderGeometry(0.15, 0.19, 0.07, 16), new THREE.MeshBasicMaterial({ color: 0x2a2622 }), 0, 4.31, 0));
      g.add(place(new THREE.CylinderGeometry(0.19, 0.15, 0.07, 16), new THREE.MeshBasicMaterial({ color: 0x2a2622 }), 0, 3.8, 0));
      const pl = new THREE.PointLight(col, 0.35, 8, 2); pl.position.set(0, 3.9, 0); g.add(pl);
    }
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
    (function moonGate() {
      const z = FRONT_Z - 2.2;
      const gate = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.2, 14, 56), new THREE.MeshToonMaterial({ color: A.stone })); gate.position.set(0, 2.7, z); scene.add(gate);
      for (const sx of [-1, 1]) scene.add(place(new THREE.BoxGeometry(0.6, 0.5, 0.6), stoneMat, sx * 2.55, 0.25, z));
    })();

    const boards = [];
    await Promise.all(DECK.slides.map(async (slide, i) => {
      const cv = await slideToCanvas(slide); const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
      const bw = 5.4, bh = (bw * 9) / 16; const side = i % 2 === 0 ? -1 : 1; const x = side * 2.9, z = -(7 + i * spacing), y = 2.0, ry = -side * 0.26;
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
      const outline = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.34, bh + 0.34), new THREE.MeshBasicMaterial({ color: acc.getHex() })); outline.position.z = -0.04; g.add(outline);
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.14, bh + 0.14), new THREE.MeshBasicMaterial({ color: 0x14140f })); frame.position.z = -0.02; g.add(frame);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: tex })); g.add(board);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.8, y - bh / 2, 0.95), stoneMat); plinth.position.set(x, (y - bh / 2) / 2, z); scene.add(plinth);
      scene.add(place(new THREE.BoxGeometry(2.0, 0.1, 1.15), stoneDark, x, y - bh / 2, z));
      scene.add(place(new THREE.BoxGeometry(0.5, 0.12, 0.3), stoneDark, x, 5.32, z + 0.9));
      if (n <= 10) { const spot = new THREE.SpotLight(0xfff1dc, 22, 12, 0.5, 0.6, 1.4); spot.position.set(x, 5.2, z + 1.2); spot.target.position.set(x, y - 0.2, z); scene.add(spot); scene.add(spot.target); }
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.3), new THREE.MeshToonMaterial({ color: tint(0.42, 0.32).getHex() })); rug.rotation.x = -Math.PI / 2; rug.position.set(x, 0.016, z); rug.receiveShadow = true; scene.add(rug);
      const sx2 = x * 0.48;
      for (const oz of [-0.95, 0.95]) { scene.add(place(new THREE.CylinderGeometry(0.045, 0.055, 0.82, 10), frameMat, sx2, 0.41, z + oz)); scene.add(place(new THREE.SphereGeometry(0.08, 10, 8), frameMat, sx2, 0.86, z + oz)); }
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.9, 8), new THREE.MeshToonMaterial({ color: tint(0.4, 0.32).getHex() })); rope.position.set(sx2, 0.74, z); rope.rotation.x = Math.PI / 2; scene.add(rope);
      boards.push({ slide, x, z }); obstacles.push({ x, z, r: 1.25 });
    }));

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

    // Warme Wandleuchten (abeto-Wärme; leuchten weich mit Bloom)
    const sconceBulbGeo = new THREE.SphereGeometry(0.1, 12, 10), sconceArmGeo = new THREE.BoxGeometry(0.05, 0.05, 0.16);
    const sconceBulbMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), sconceArmMat = new THREE.MeshToonMaterial({ color: A.stoneDark });
    for (let z = -3; z > -hallLen + 6; z -= 9) for (const sx of [-1, 1]) {
      const gx = sx * (halfW - 0.12);
      scene.add(place(sconceArmGeo, sconceArmMat, gx - sx * 0.08, 3.75, z));
      const bulb = place(sconceBulbGeo, sconceBulbMat, gx - sx * 0.18, 3.75, z); bulb.scale.set(0.7, 1, 0.7); scene.add(bulb);
    }
    // Versand-Kisten in den Seitengängen (dezenter abeto-Hafen-Anklang)
    const crateMat = new THREE.MeshToonMaterial({ color: 0xb58a57 }), crateBand = new THREE.MeshToonMaterial({ color: 0x7c5f3d });
    const crateGeoL = new THREE.BoxGeometry(0.9, 0.9, 0.9), crateGeoM = new THREE.BoxGeometry(0.6, 0.6, 0.6), crateBandGeoL = new THREE.BoxGeometry(0.92, 0.12, 0.92), crateBandGeoM = new THREE.BoxGeometry(0.62, 0.1, 0.62);
    const mkCrate = (geo, bandGeo, x, y, z, ry) => {
      const c = place(geo, crateMat, x, y, z); c.rotation.y = ry || 0;
      const band = new THREE.Mesh(bandGeo, crateBand); band.position.y = geo.parameters.height * 0.5 - 0.02; c.add(band);
      scene.add(c); return c;
    };
    mkCrate(crateGeoL, crateBandGeoL, 4.1, 0.45, -3.2, 0.3); obstacles.push({ x: 4.1, z: -3.2, r: 0.75 });
    mkCrate(crateGeoM, crateBandGeoM, 4.4, 1.2, -2.9, -0.25);
    mkCrate(crateGeoL, crateBandGeoL, -4.2, 0.45, -16, -0.2); obstacles.push({ x: -4.2, z: -16, r: 0.75 });

    const portalX = 0, portalZ = -hallLen + 7, portalY = 2.1;
    const portalGrp = new THREE.Group(); portalGrp.position.set(portalX, portalY, portalZ); scene.add(portalGrp);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.8), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.12 })); door.position.z = -0.06; portalGrp.add(door);
    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1.95, 56), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.16 })); glowDisc.position.z = -0.03; portalGrp.add(glowDisc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.12, 16, 80), new THREE.MeshBasicMaterial({ color: acc.getHex() })); portalGrp.add(ring);
    const floorRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.3, 48), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.22, side: THREE.DoubleSide })); floorRing.rotation.x = -Math.PI / 2; floorRing.position.set(0, -2.08, 0.3); portalGrp.add(floorRing);
    portalGrp.add(new THREE.PointLight(acc.getHex(), 1.0, 30, 1.5));
    { const cv = document.createElement("canvas"); cv.width = 640; cv.height = 140; const c = cv.getContext("2d"); c.fillStyle = accent; c.font = "700 60px " + fontTitle; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("⟲  Zum Anfang", 320, 78); const t = new THREE.CanvasTexture(cv); if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.79), new THREE.MeshBasicMaterial({ map: t, transparent: true })); s.position.set(0, 2.7, 0); portalGrp.add(s); }

    const START = new THREE.Vector3(0, 0, 3);
    const hero = makeHero(acc.getHex());
    const proceduralParts = hero.userData.parts;
    hero.position.copy(START); scene.add(hero);
    let heading = Math.PI; hero.rotation.y = heading;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015; scene.add(shadow);
    let jumpY = 0, vy = 0, grounded = true;
    function jump() { if (grounded) { vy = 5.2; grounded = false; } }

    const isTouch = window.matchMedia("(pointer: coarse)").matches; joy.hidden = !isTouch;
    let panelOpen = false, near = null, nearPortal = false, lastHint = "", tutorialDone = false;
    const keys = {}; const clock = new THREE.Clock();
    const setHint = (h) => { if (h !== lastHint) { hintEl.innerHTML = h; lastHint = h; } };
    const idleHint = isTouch ? "Joystick = gehen · nah an eine Tafel + tippen" : "<b>WASD</b> / <b>Pfeiltasten</b> gehen · <b>E</b> für Details";
    function returnToStart() { hero.position.copy(START); heading = Math.PI; closePanel(); }

    const TUT_KEY = "wd:worldTut";
    const tutOff = (() => { try { return localStorage.getItem(TUT_KEY) === "off"; } catch (e) { return false; } })();
    const guide = "🙂";
    const msgs = ["Willkommen in der Galerie. 👋", "Du steuerst die Figur nur mit der Tastatur: <b>WASD</b> oder die <b>Pfeiltasten</b> — ganz ohne Maus.", "Geh nah an eine Tafel und drücke <b>E</b>, um die Details groß zu sehen.", "Am Ende führt dich das Tor zurück zum Anfang. Viel Spaß! ✦"];
    let bi = 0, bubbleTimer = null;
    function showBubble() { if (bi >= msgs.length) { bubbleEl.hidden = true; tutorialDone = true; return; } bubbleEl.innerHTML = '<span class="wb-av">' + guide + '</span><span class="wb-tx">' + msgs[bi] + '</span><span class="wb-next">' + (isTouch ? "Tippen ▸" : "Weiter ▸ (Leertaste)") + '</span><button class="wb-close" title="Tutorial ausblenden (nicht mehr zeigen)" aria-label="Tutorial ausblenden">✕</button>'; bubbleEl.hidden = false; clearTimeout(bubbleTimer); bubbleTimer = setTimeout(nextBubble, 6500); }
    function nextBubble() { bi++; showBubble(); }
    function dismissTutorial() { clearTimeout(bubbleTimer); bubbleEl.hidden = true; tutorialDone = true; try { localStorage.setItem(TUT_KEY, "off"); } catch (e) {} }
    bubbleEl.onclick = (e) => { if (e.target && e.target.classList && e.target.classList.contains("wb-close")) dismissTutorial(); else nextBubble(); };

    function onKeyDown(e) { const k = e.key.toLowerCase(); keys[k] = true; if (k === "escape" && !tutorialDone && !panelOpen) { e.preventDefault(); dismissTutorial(); return; } if (k === " " || k === "enter") { if (!tutorialDone) { e.preventDefault(); nextBubble(); return; } } if (k === "e") { e.preventDefault(); if (panelOpen) closePanel(); else if (near) openPanel(near.slide); else if (nearPortal) returnToStart(); } if (k === "escape" && panelOpen) closePanel(); if (k === "f") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); } }
    function onKeyUp(e) { keys[e.key.toLowerCase()] = false; }
    function onResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); }
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp); window.addEventListener("resize", onResize);

    const jst = { x: 0, y: 0, id: null };
    if (isTouch) {
      joy.addEventListener("touchstart", (e) => { jst.id = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
      joy.addEventListener("touchmove", (e) => { for (const t of e.changedTouches) { if (t.identifier !== jst.id) continue; const r = joy.getBoundingClientRect(); let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2); const m = 50, d = Math.hypot(dx, dy) || 1; if (d > m) { dx *= m / d; dy *= m / d; } nub.style.transform = "translate(" + dx + "px," + dy + "px)"; jst.x = dx / m; jst.y = dy / m; } e.preventDefault(); }, { passive: false });
      const end = (e) => { for (const t of e.changedTouches) if (t.identifier === jst.id) { jst.id = null; jst.x = jst.y = 0; nub.style.transform = ""; } };
      joy.addEventListener("touchend", end); joy.addEventListener("touchcancel", end);
      stage.addEventListener("touchend", () => { if (!tutorialDone) { nextBubble(); return; } if (!panelOpen) { if (near) openPanel(near.slide); else if (nearPortal) returnToStart(); } });
    }

    function openPanel(slide) {
      panelOpen = true;
      const layer = (slide.layers || []).find((l) => resolveSrc(l)); const t = (role) => (slide.texts || []).find((x) => x.role === role);
      let html = '<div class="wp">';
      if (layer) html += '<img src="' + resolveSrc(layer) + '" alt="">';
      if (t("kicker")) html += '<p class="k">' + esc(t("kicker").text) + "</p>";
      if (t("title")) html += "<h2>" + esc(t("title").text) + "</h2>";
      (slide.texts || []).filter((x) => x.role === "subtitle" || x.role === "body").forEach((x) => (html += "<p>" + esc(x.text) + "</p>"));
      html += '<button class="wp-close">Schließen (E)</button></div>';
      panel.innerHTML = html; panel.hidden = false; panel.querySelector(".wp-close").onclick = closePanel; panel.onclick = (e) => { if (e.target === panel) closePanel(); };
    }
    function closePanel() { panelOpen = false; panel.hidden = true; }

    const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    const xMin = -(halfW - 1.3), xMax = halfW - 1.3, zMin = -hallLen + 4, zMax = 5;
    let walkT = 0;
    function loop() {
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!panelOpen) {
        let mx = 0, mz = 0;
        if (keys["w"] || keys["arrowup"]) mz -= 1; if (keys["s"] || keys["arrowdown"]) mz += 1;
        if (keys["a"] || keys["arrowleft"]) mx -= 1; if (keys["d"] || keys["arrowright"]) mx += 1;
        if (isTouch) { mx += jst.x; mz += jst.y; }
        const len = Math.hypot(mx, mz);
        const moving = len > 0.01;
        if (moving) {
          mx /= len; mz /= len; const spd = 5 * dt;
          hero.position.x += mx * spd; hero.position.z += mz * spd;
          for (const o of obstacles) { const dx = hero.position.x - o.x, dz = hero.position.z - o.z, dd = Math.hypot(dx, dz), rr = o.r + 0.45; if (dd < rr && dd > 0.001) { hero.position.x = o.x + (dx / dd) * rr; hero.position.z = o.z + (dz / dd) * rr; } }
          hero.position.x = clamp(hero.position.x, xMin, xMax); hero.position.z = clamp(hero.position.z, zMin, zMax);
          const targetH = Math.atan2(mx, mz); let d = targetH - heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; heading += d * Math.min(1, dt * 12); hero.rotation.y = heading;
        }
        if (!grounded) { vy -= 14 * dt; jumpY += vy * dt; if (jumpY <= 0) { jumpY = 0; vy = 0; grounded = true; } }
        if (moving) { walkT += dt * 9; const sw = Math.sin(walkT) * 0.7; proceduralParts.lleg.rotation.x = sw; proceduralParts.rleg.rotation.x = -sw; proceduralParts.larm.rotation.x = -sw * 0.7; proceduralParts.rarm.rotation.x = sw * 0.7; }
        else { walkT = 0; for (const k in proceduralParts) proceduralParts[k].rotation.x *= 0.82; }
        const bob = (grounded && moving) ? Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.05 : 0;
        hero.position.y = jumpY + bob;
        shadow.position.set(hero.position.x, 0.015, hero.position.z); shadow.material.opacity = 0.14 * Math.max(0.25, 1 - jumpY * 0.7);
        dir.position.set(hero.position.x + sunOff.x, sunOff.y, hero.position.z + sunOff.z); dir.target.position.set(hero.position.x, 0, hero.position.z); dir.target.updateMatrixWorld();
        camPos.set(hero.position.x, 4.6, hero.position.z + 7); camera.position.lerp(camPos, 1 - Math.pow(0.0015, dt));
        camLook.set(hero.position.x, 1.3, hero.position.z - 1.2); camera.lookAt(camLook);
        near = null; let best = 3.4;
        for (const b of boards) { const d2 = Math.hypot(hero.position.x - b.x, hero.position.z - b.z); if (d2 < best) { best = d2; near = b; } }
        nearPortal = !near && Math.hypot(hero.position.x - portalX, hero.position.z - portalZ) < 4.2;
        if (!tutorialDone) setHint(""); else if (near) setHint("<b>" + (isTouch ? "Tippen" : "E") + "</b> für Details"); else if (nearPortal) setHint("<b>" + (isTouch ? "Tippen" : "E") + "</b> · zurück zum Anfang"); else setHint(idleHint);
      }
      ring.rotation.z += dt * 0.6; glowDisc.material.opacity = 0.12 + 0.06 * (1 + Math.sin(clock.elapsedTime * 2)) / 2;
      composer.render(); requestAnimationFrame(loop);
    }
    homeBtn.onclick = returnToStart;
    camera.position.set(hero.position.x, 4.6, hero.position.z + 7); camera.lookAt(hero.position.x, 1.3, hero.position.z - 1.2);
    scene.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshToonMaterial) { o.castShadow = true; o.receiveShadow = true; } });
    floor.castShadow = false;
    // abeto-Tinten-Outlines: inverted-hull-Hülle um feste Objekte (Planes/Glows/Figur ausgenommen)
    hero.traverse((o) => { o.userData.noOutline = true; });
    (function inkOutline() {
      const todo = [];
      scene.traverse((o) => {
        if (!o.isMesh || o.userData.noOutline || o.userData.isOutline) return;
        if (o.material && o.material.side === THREE.BackSide) return;
        const gg = o.geometry; if (!gg || /Plane/.test(gg.type || "")) return;
        const m = o.material; if (m && m.transparent && (m.opacity == null || m.opacity < 0.92)) return;
        todo.push(o);
      });
      for (const o of todo) { const s = new THREE.Mesh(o.geometry, outlineMat); s.scale.setScalar(1.035); s.userData.isOutline = true; o.add(s); }
    })();
    loader.hidden = true; if (tutOff) { tutorialDone = true; bubbleEl.hidden = true; } else showBubble(); requestAnimationFrame(loop);
  }
  (document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve()).then(boot);
}

const WORLD_CSS = "*{margin:0;box-sizing:border-box}html,body{height:100%;overflow:hidden;background:#0a0f1a;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#eef2f7}"
  + ".world__stage{position:fixed;inset:0}.world__stage canvas{display:block}"
  + ".world__load{position:fixed;inset:0;z-index:9200;display:grid;place-items:center;align-content:center;gap:16px;background:#0a0f1a;color:#cdd3dd;font-size:14px}.world__load[hidden]{display:none}.world__load p{margin:0}"
  + ".world__spinner{width:40px;height:40px;border-radius:50%;border:3px solid rgba(255,255,255,.15);border-top-color:var(--accent,#5aa6ff);animation:wspin .9s linear infinite}@keyframes wspin{to{transform:rotate(360deg)}}"
  + ".world__hint{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:9100;font-size:13px;color:rgba(255,255,255,.85);background:rgba(0,0,0,.45);padding:8px 16px;border-radius:999px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}.world__hint b{color:#fff}"
  + ".world__panel{position:fixed;inset:0;z-index:9300;display:grid;place-items:center;background:rgba(5,6,10,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);padding:24px}.world__panel[hidden]{display:none}"
  + ".world__panel .wp{width:min(720px,92vw);max-height:86vh;overflow-y:auto;background:#11151c;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:28px 30px;box-shadow:0 30px 80px rgba(0,0,0,.6)}"
  + ".world__panel img{width:100%;border-radius:12px;margin-bottom:18px;display:block}"
  + ".world__panel h2{font-family:var(--font-title,'Space Grotesk',sans-serif);font-weight:600;font-size:30px;line-height:1.05;margin:0 0 8px;color:var(--ink,#eef4ff);white-space:pre-wrap}"
  + ".world__panel .k{font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--accent,#5aa6ff);margin:0 0 10px}"
  + ".world__panel p{font-size:15px;line-height:1.6;color:#dfe5ee;white-space:pre-wrap;margin:0 0 10px}"
  + ".world__panel .wp-close{margin-top:18px;background:var(--accent,#5aa6ff);color:#05060a;border:0;border-radius:999px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer}"
  + ".world__joy{position:fixed;left:26px;bottom:26px;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);z-index:9100;touch-action:none}.world__joy[hidden]{display:none}"
  + ".world__nub{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.4)}"
  + ".world__home{position:fixed;top:18px;left:18px;z-index:9400;padding:9px 15px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.42);color:#fff;font-size:13px;font-weight:600;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:.82}.world__home:hover{opacity:1;background:rgba(0,0,0,.6)}"
  + ".world__bubble{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);z-index:9350;display:flex;align-items:center;gap:12px;max-width:min(680px,92vw);padding:16px 20px;background:#fffef8;color:#1a1a1a;border:3px solid #1a1a1a;border-radius:20px;box-shadow:0 10px 0 rgba(26,26,26,.18),0 18px 44px rgba(0,0,0,.4);cursor:pointer}.world__bubble[hidden]{display:none}"
  + ".world__bubble::after{content:'';position:absolute;left:46px;bottom:-16px;width:26px;height:26px;background:#fffef8;border-right:3px solid #1a1a1a;border-bottom:3px solid #1a1a1a;transform:rotate(45deg)}"
  + ".world__bubble .wb-av{font-size:34px;line-height:1;flex:0 0 auto}.world__bubble .wb-tx{font-size:15.5px;line-height:1.5;font-weight:500}.world__bubble .wb-tx b{font-weight:800}.world__bubble .wb-next{flex:0 0 auto;align-self:flex-end;font-size:12px;font-weight:700;color:var(--accent,#5aa6ff);white-space:nowrap}"
  + ".world__bubble .wb-close{position:absolute;top:-12px;right:-12px;width:26px;height:26px;border-radius:50%;border:2px solid #1a1a1a;background:#fffef8;color:#1a1a1a;font-size:13px;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0;box-shadow:0 3px 0 rgba(26,26,26,.18)}.world__bubble .wb-close:hover{background:#ffe9e2}";

function docHead(deck, css) {
  const tv = themeVars(deck.theme);
  const rootVars = ":root{" + Object.keys(tv).map((k) => k + ":" + tv[k]).join(";") + "}";
  return "<!DOCTYPE html>\n<html lang=\"de\"><head><meta charset=\"utf-8\">"
    + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
    + "<title>" + esc(deck.title || "WonderDeck") + "</title>"
    + "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>"
    + "<link href=\"https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@300;400;500;600&family=Space+Grotesk:wght@500;600;700&family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@400;500;600&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&display=swap\" rel=\"stylesheet\">"
    + "<style>" + rootVars + css + "</style></head>";
}

function buildDoc(deck) {
  const json = JSON.stringify(deck).replace(/</g, "\\u003c");
  if (deck.mode === "world") {
    const tv = themeVars(deck.theme);
    const cfg = { accent: tv["--accent"], ink: tv["--ink"], fontTitle: tv["--font-title"], fontBody: tv["--font-body"] };
    return docHead(deck, WORLD_CSS)
      + "<body>"
      + "<script type=\"importmap\">{\"imports\":{\"three\":\"https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js\",\"three/addons/\":\"https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/\"}}<\/script>"
      + "<script type=\"module\">import * as THREE from \"three\";import { EffectComposer } from \"three/addons/postprocessing/EffectComposer.js\";import { RenderPass } from \"three/addons/postprocessing/RenderPass.js\";import { UnrealBloomPass } from \"three/addons/postprocessing/UnrealBloomPass.js\";import { OutputPass } from \"three/addons/postprocessing/OutputPass.js\";(" + WORLD_RUNTIME.toString() + ")(" + json + "," + JSON.stringify(cfg) + ",THREE,EffectComposer,RenderPass,UnrealBloomPass,OutputPass);<\/script>"
      + "</body></html>";
  }
  if (deck.mode === "journey") {
    return docHead(deck, JOURNEY_CSS)
      + "<body><div id=\"jworld\" class=\"jr-world\"></div><nav id=\"jdots\" class=\"jr-dots\"></nav>"
      + "<div id=\"jcounter\" class=\"jr-counter\"></div><div class=\"jr-hint\">Scrollen / Ziehen zum Gehen · F = Vollbild</div>"
      + "<script>(" + JOURNEY_RUNTIME.toString() + ")(" + json + ");<\/script></body></html>";
  }
  return docHead(deck, VIEWER_CSS)
    + "<body>"
    + "<div id=\"vp\" class=\"vp\"></div><nav id=\"topnav\" class=\"topnav\"></nav><div id=\"note\" class=\"note\" hidden></div><div id=\"cur\" class=\"cur\"></div>"
    + "<nav id=\"dots\" class=\"dots\"></nav><div id=\"counter\" class=\"counter\"></div>"
    + "<div id=\"hint\" class=\"hint\">Pfeiltasten / Scrollen zum Blättern · F = Vollbild</div>"
    + "<script>(" + VIEWER_RUNTIME.toString() + ")(" + json + ");<\/script></body></html>";
}

/** Erzeugt das eigenständige HTML als String (Bilder eingebettet). */
export function buildStandaloneHTML(deck, images) {
  const d = structuredClone(deck);
  for (const s of d.slides)
    for (const l of s.layers) { if (l.imageId && images[l.imageId]) l.src = images[l.imageId]; delete l.imageId; }
  if (d.brandImageId && images[d.brandImageId]) d.brandSrc = images[d.brandImageId]; // Logo einbetten
  return buildDoc(d);
}

/** Aktuelle Präsi als eigenständige .html herunterladen. */
export function exportStandaloneHTML(deck, images) {
  const blob = new Blob([buildStandaloneHTML(deck, images)], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (deck.title || "praesentation").replace(/[^\w\-]+/g, "_") + ".html";
  a.click();
  URL.revokeObjectURL(a.href);
}
