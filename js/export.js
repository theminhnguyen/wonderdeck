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
function WORLD_RUNTIME(DECK, CFG, THREE) {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const esc = (s) => String(s == null ? "" : s).replace(/[<&>]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" }[c]));
  const hexA = (hex, a) => { let h = String(hex || "").trim().replace("#", ""); if (h.length === 3) h = h.split("").map((x) => x + x).join(""); if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return "rgba(255,255,255," + a + ")"; return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")"; };
  const accent = CFG.accent, ink = CFG.ink, fontTitle = CFG.fontTitle, fontBody = CFG.fontBody;
  const resolveSrc = (l) => (l && l.src) || null;

  const mk = (cls) => { const d = document.createElement("div"); if (cls) d.className = cls; return d; };
  const stage = mk("world__stage"); document.body.appendChild(stage);
  const cross = mk("world__cross"); cross.hidden = true; document.body.appendChild(cross);
  const loader = mk("world__load"); loader.innerHTML = '<div class="world__spinner"></div><p>3D-Welt wird geladen …</p>'; document.body.appendChild(loader);
  const hintEl = mk("world__hint"); document.body.appendChild(hintEl);
  const panel = mk("world__panel"); panel.hidden = true; document.body.appendChild(panel);
  const joy = mk("world__joy"); joy.hidden = true; const nub = mk("world__nub"); joy.appendChild(nub); document.body.appendChild(joy);
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

  async function boot() {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(window.innerWidth, window.innerHeight);
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    stage.innerHTML = ""; stage.appendChild(renderer.domElement);

    const acc = new THREE.Color(accent); const hsl = {}; acc.getHSL(hsl);
    const tint = (l, s) => new THREE.Color().setHSL(hsl.h, Math.min(hsl.s, s == null ? 0.4 : s), l);
    const bgCol = tint(0.045, 0.5);
    const scene = new THREE.Scene(); scene.background = bgCol; scene.fog = new THREE.Fog(bgCol, 26, 110);
    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 240); camera.position.set(0, 1.6, 6);
    scene.add(new THREE.HemisphereLight(tint(0.62, 0.25).getHex(), tint(0.08, 0.3).getHex(), 1.2));
    scene.add(new THREE.AmbientLight(tint(0.18, 0.35).getHex(), 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.75); dir.position.set(6, 18, 8); scene.add(dir);

    const n = DECK.slides.length; const spacing = 7, halfW = 7.5, hallLen = n * spacing + 18;
    const glowEnd = new THREE.PointLight(acc.getHex(), 0.9, 80, 1.3); glowEnd.position.set(0, 3.6, -hallLen + 6); scene.add(glowEnd);
    const glowIn = new THREE.PointLight(acc.getHex(), 0.6, 40, 1.6); glowIn.position.set(0, 3.2, 2); scene.add(glowIn);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, hallLen + 24), new THREE.MeshStandardMaterial({ color: tint(0.10, 0.32).getHex(), roughness: 0.82, metalness: 0.12 }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = -hallLen / 2 + 6; scene.add(floor);
    const grid = new THREE.GridHelper(hallLen + 24, Math.max(8, Math.round((hallLen + 24) / 2)), tint(0.32, 0.4).getHex(), tint(0.16, 0.3).getHex());
    grid.position.set(0, 0.012, floor.position.z); scene.add(grid);
    const runner = new THREE.Mesh(new THREE.PlaneGeometry(1.2, hallLen + 24), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.16 }));
    runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.02, floor.position.z); scene.add(runner);

    const wallMat = new THREE.MeshStandardMaterial({ color: tint(0.075, 0.32).getHex(), roughness: 0.95, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 24, 6.4), wallMat); wall.position.set(sx * halfW, 3.2, floor.position.z); wall.rotation.y = -sx * Math.PI / 2; scene.add(wall);
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(hallLen + 24, 0.14), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.55 })); strip.position.set(sx * (halfW - 0.01), 4.7, floor.position.z); strip.rotation.y = -sx * Math.PI / 2; scene.add(strip);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.34, hallLen + 24), new THREE.MeshStandardMaterial({ color: tint(0.13, 0.3).getHex(), roughness: 0.9 })); base.position.set(sx * (halfW - 0.08), 0.17, floor.position.z); scene.add(base);
    }
    for (const [z, ry] of [[8, Math.PI], [-hallLen + 5, 0]]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, 6.4), wallMat); w.position.set(0, 3.2, z); w.rotation.y = ry; scene.add(w); }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(halfW * 2, hallLen + 24), new THREE.MeshStandardMaterial({ color: tint(0.06, 0.35).getHex(), roughness: 1, side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 5.4, floor.position.z); scene.add(ceil);

    // Museums-Ausstattung: Säulen, Deckenbalken, Wandbilder, Bänke, Pflanzen
    const stoneMat = new THREE.MeshStandardMaterial({ color: tint(0.2, 0.14).getHex(), roughness: 0.9 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: tint(0.12, 0.18).getHex(), roughness: 0.95 });
    const woodMat = new THREE.MeshStandardMaterial({ color: tint(0.14, 0.3).getHex(), roughness: 0.6, metalness: 0.15 });
    const frameMat = new THREE.MeshStandardMaterial({ color: tint(0.09, 0.2).getHex(), roughness: 0.8 });
    const potMat = new THREE.MeshStandardMaterial({ color: tint(0.16, 0.22).getHex(), roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5a3a, roughness: 1 });
    const colGeo = new THREE.CylinderGeometry(0.4, 0.46, 4.9, 18), fluteGeo = new THREE.BoxGeometry(1.1, 0.42, 1.1), capGeo = new THREE.BoxGeometry(1.0, 0.34, 1.0);
    const beamGeo = new THREE.BoxGeometry(halfW * 2, 0.26, 0.4), artFrameGeo = new THREE.BoxGeometry(2.7, 3.5, 0.14), artFillGeo = new THREE.PlaneGeometry(2.2, 3.0);
    const benchSeatGeo = new THREE.BoxGeometry(2.6, 0.18, 0.8), benchLegGeo = new THREE.BoxGeometry(0.18, 0.5, 0.7), potGeo = new THREE.CylinderGeometry(0.32, 0.24, 0.6, 14), leafGeo = new THREE.SphereGeometry(0.55, 12, 10);
    const colXs = [-(halfW - 0.7), halfW - 0.7];
    const colZs = []; for (let z = 1; z > -hallLen + 6; z -= 7) colZs.push(z);
    for (const z of colZs) {
      const beam = new THREE.Mesh(beamGeo, stoneDark); beam.position.set(0, 5.24, z); scene.add(beam);
      for (const cx of colXs) { const col = new THREE.Mesh(colGeo, stoneMat); col.position.set(cx, 2.65, z); scene.add(col); const cb = new THREE.Mesh(fluteGeo, stoneDark); cb.position.set(cx, 0.21, z); scene.add(cb); const cc = new THREE.Mesh(capGeo, stoneDark); cc.position.set(cx, 5.02, z); scene.add(cc); }
    }
    const artZs = []; for (let z = -2.5; z > -hallLen + 6; z -= 7) artZs.push(z);
    for (const z of artZs) for (const sx of [-1, 1]) {
      const fr = new THREE.Mesh(artFrameGeo, frameMat); fr.position.set(sx * (halfW - 0.13), 2.7, z); fr.rotation.y = -sx * Math.PI / 2; scene.add(fr);
      const fill = new THREE.Mesh(artFillGeo, new THREE.MeshBasicMaterial({ color: tint(0.16 + Math.random() * 0.16, 0.5).getHex() })); fill.position.set(sx * (halfW - 0.19), 2.7, z); fill.rotation.y = -sx * Math.PI / 2; scene.add(fill);
    }
    for (let i = 0, z = -5; z > -hallLen + 6; z -= 14, i++) for (const sx of [-1, 1]) {
      const bx = sx * (halfW - 2.3);
      const seat = new THREE.Mesh(benchSeatGeo, woodMat); seat.position.set(bx, 0.5, z); scene.add(seat);
      for (const lz of [-0.7, 0.7]) { const leg = new THREE.Mesh(benchLegGeo, woodMat); leg.position.set(bx, 0.25, z + lz); scene.add(leg); }
      if (i % 2 === 0) { const pot = new THREE.Mesh(potGeo, potMat); pot.position.set(sx * (halfW - 0.9), 0.3, z + 3.5); scene.add(pot); const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.set(sx * (halfW - 0.9), 0.95, z + 3.5); leaf.scale.set(1, 1.3, 1); scene.add(leaf); }
    }

    const boards = [];
    await Promise.all(DECK.slides.map(async (slide, i) => {
      const cv = await slideToCanvas(slide); const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; if ("colorSpace" in tex) tex.colorSpace = THREE.SRGBColorSpace;
      const bw = 5.4, bh = (bw * 9) / 16; const side = i % 2 === 0 ? -1 : 1; const x = side * 2.9, z = -(7 + i * spacing), y = 2.0; const ry = -side * 0.26;
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
      const outline = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.34, bh + 0.34), new THREE.MeshBasicMaterial({ color: acc.getHex() })); outline.position.z = -0.04; g.add(outline);
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(bw + 0.14, bh + 0.14), new THREE.MeshBasicMaterial({ color: 0x0a0e16 })); frame.position.z = -0.02; g.add(frame);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshBasicMaterial({ map: tex })); g.add(board);
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.8, y - bh / 2, 0.95), stoneMat); plinth.position.set(x, (y - bh / 2) / 2, z); scene.add(plinth);
      const plinthTop = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 1.15), stoneDark); plinthTop.position.set(x, y - bh / 2, z); scene.add(plinthTop);
      const fix = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), new THREE.MeshStandardMaterial({ color: tint(0.14, 0.3).getHex(), roughness: 0.8 })); fix.position.set(x, 5.32, z + 0.9); scene.add(fix);
      if (n <= 16) { const spot = new THREE.SpotLight(0xfff1dc, 26, 12, 0.5, 0.6, 1.4); spot.position.set(x, 5.2, z + 1.2); spot.target.position.set(x, y - 0.2, z); scene.add(spot); scene.add(spot.target); }
      boards.push({ slide, pos: new THREE.Vector3(x, y, z) });
    }));

    // Rückweg-Portal am Ende des Pfades (großes, leuchtendes Tor)
    const portalPos = new THREE.Vector3(0, 2.1, -hallLen + 7);
    const portalGrp = new THREE.Group(); portalGrp.position.copy(portalPos); scene.add(portalGrp);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 4.8), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.12 })); door.position.z = -0.06; portalGrp.add(door);
    const glowDisc = new THREE.Mesh(new THREE.CircleGeometry(1.95, 56), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.16 })); glowDisc.position.z = -0.03; portalGrp.add(glowDisc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.12, 16, 80), new THREE.MeshBasicMaterial({ color: acc.getHex() })); portalGrp.add(ring);
    const floorRing = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.3, 48), new THREE.MeshBasicMaterial({ color: acc.getHex(), transparent: true, opacity: 0.22, side: THREE.DoubleSide })); floorRing.rotation.x = -Math.PI / 2; floorRing.position.set(0, -2.08, 0.3); portalGrp.add(floorRing);
    const portalLight = new THREE.PointLight(acc.getHex(), 1.2, 32, 1.5); portalLight.position.set(0, 0, 1.6); portalGrp.add(portalLight);
    const signCv = document.createElement("canvas"); signCv.width = 640; signCv.height = 140; const sc = signCv.getContext("2d");
    sc.fillStyle = accent; sc.font = "700 64px " + fontTitle; sc.textAlign = "center"; sc.textBaseline = "middle"; sc.fillText("⟲  Zum Anfang", 320, 78);
    const signTex = new THREE.CanvasTexture(signCv); if ("colorSpace" in signTex) signTex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.79), new THREE.MeshBasicMaterial({ map: signTex, transparent: true })); sign.position.set(0, 2.7, 0); portalGrp.add(sign);

    const isTouch = window.matchMedia("(pointer: coarse)").matches; cross.hidden = isTouch; joy.hidden = !isTouch;
    let yaw = 0, pitch = 0, locked = false, panelOpen = false, near = null, nearPortal = false, lastHint = "";
    const keys = {}; const clock = new THREE.Clock();
    const setHint = (html) => { if (html !== lastHint) { hintEl.innerHTML = html; lastHint = html; } };
    const idleHint = isTouch ? "Joystick = gehen · ziehen = schauen" : "<b>Klick</b> zum Start · <b>WASD</b> gehen · <b>Maus</b> schauen";
    const returnToStart = () => { camera.position.set(0, 1.6, 6); yaw = 0; pitch = 0; closePanel(); };
    homeBtn.onclick = () => { returnToStart(); if (!isTouch) lockPointer(); };
    const lockPointer = () => { if (!isTouch && !panelOpen && document.pointerLockElement !== stage) stage.requestPointerLock(); };
    const onPL = () => { locked = document.pointerLockElement === stage; };
    const onMouse = (e) => { if (!locked) return; yaw -= e.movementX * 0.0022; pitch = clamp(pitch - e.movementY * 0.0022, -1.2, 1.2); };
    const onKeyDown = (e) => { const k = e.key.toLowerCase(); keys[k] = true; if (k === "e") { e.preventDefault(); if (panelOpen) closePanel(); else if (near) openPanel(near.slide); else if (nearPortal) returnToStart(); } if (k === "escape" && panelOpen) closePanel(); if (k === "f") { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); } };
    const onKeyUp = (e) => { keys[e.key.toLowerCase()] = false; };
    const onResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    stage.addEventListener("click", lockPointer); document.addEventListener("pointerlockchange", onPL); document.addEventListener("mousemove", onMouse);
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp); window.addEventListener("resize", onResize);

    const jstate = { x: 0, y: 0, id: null }; let lookId = null, lx = 0, ly = 0, tapMove = 0;
    if (isTouch) {
      joy.addEventListener("touchstart", (e) => { jstate.id = e.changedTouches[0].identifier; e.preventDefault(); }, { passive: false });
      joy.addEventListener("touchmove", (e) => { for (const t of e.changedTouches) { if (t.identifier !== jstate.id) continue; const r = joy.getBoundingClientRect(); let dx = t.clientX - (r.left + r.width / 2), dy = t.clientY - (r.top + r.height / 2); const m = 50, d = Math.hypot(dx, dy) || 1; if (d > m) { dx *= m / d; dy *= m / d; } nub.style.transform = "translate(" + dx + "px," + dy + "px)"; jstate.x = dx / m; jstate.y = dy / m; } e.preventDefault(); }, { passive: false });
      const je = (e) => { for (const t of e.changedTouches) if (t.identifier === jstate.id) { jstate.id = null; jstate.x = jstate.y = 0; nub.style.transform = ""; } };
      joy.addEventListener("touchend", je); joy.addEventListener("touchcancel", je);
      stage.addEventListener("touchstart", (e) => { const t = e.changedTouches[0]; lookId = t.identifier; lx = t.clientX; ly = t.clientY; tapMove = 0; });
      stage.addEventListener("touchmove", (e) => { for (const t of e.changedTouches) { if (t.identifier !== lookId) continue; yaw -= (t.clientX - lx) * 0.005; pitch = clamp(pitch - (t.clientY - ly) * 0.005, -1.2, 1.2); tapMove += Math.abs(t.clientX - lx) + Math.abs(t.clientY - ly); lx = t.clientX; ly = t.clientY; } }, { passive: true });
      stage.addEventListener("touchend", () => { if (tapMove < 12 && !panelOpen) { if (near) openPanel(near.slide); else if (nearPortal) returnToStart(); } lookId = null; });
    }

    function openPanel(slide) {
      panelOpen = true; if (document.pointerLockElement) document.exitPointerLock();
      const layer = (slide.layers || []).find((l) => resolveSrc(l)); const t = (role) => (slide.texts || []).find((x) => x.role === role);
      let html = '<div class="wp">';
      if (layer) html += '<img src="' + resolveSrc(layer) + '" alt="">';
      if (t("kicker")) html += '<p class="k">' + esc(t("kicker").text) + "</p>";
      if (t("title")) html += "<h2>" + esc(t("title").text) + "</h2>";
      (slide.texts || []).filter((x) => x.role === "subtitle" || x.role === "body").forEach((x) => (html += "<p>" + esc(x.text) + "</p>"));
      html += '<button class="wp-close">Schließen (E)</button></div>';
      panel.innerHTML = html; panel.hidden = false; panel.querySelector(".wp-close").onclick = closePanel;
      panel.onclick = (e) => { if (e.target === panel) closePanel(); };
    }
    function closePanel() { panelOpen = false; panel.hidden = true; }

    function loop() {
      const dt = Math.min(clock.getDelta(), 0.05); camera.rotation.set(pitch, yaw, 0, "YXZ");
      if (!panelOpen) {
        let fwd = 0, str = 0;
        if (keys["w"] || keys["arrowup"]) fwd += 1; if (keys["s"] || keys["arrowdown"]) fwd -= 1;
        if (keys["d"] || keys["arrowright"]) str += 1; if (keys["a"] || keys["arrowleft"]) str -= 1;
        if (isTouch) { str += jstate.x; fwd -= jstate.y; }
        const spd = 4.4 * dt, sy = Math.sin(yaw), cy = Math.cos(yaw);
        camera.position.x += (-sy * fwd + cy * str) * spd; camera.position.z += (-cy * fwd - sy * str) * spd;
        camera.position.x = clamp(camera.position.x, -halfW + 0.6, halfW - 0.6); camera.position.z = clamp(camera.position.z, -hallLen + 5, 6); camera.position.y = 1.6;
        near = null; let best = 5.4; for (const b of boards) { const d = camera.position.distanceTo(b.pos); if (d < best) { best = d; near = b; } }
        nearPortal = !near && camera.position.distanceTo(portalPos) < 4.4;
        if (near) setHint("<b>" + (isTouch ? "Tippen" : "E") + "</b> für Details"); else if (nearPortal) setHint("<b>" + (isTouch ? "Tippen" : "E") + "</b> · zurück zum Anfang"); else if (!locked && !isTouch) setHint(idleHint); else setHint("");
      }
      ring.rotation.z += dt * 0.6; glowDisc.material.opacity = 0.12 + 0.06 * (1 + Math.sin(clock.elapsedTime * 2)) / 2;
      renderer.render(scene, camera); requestAnimationFrame(loop);
    }
    loader.hidden = true; requestAnimationFrame(loop);
  }
  (document.fonts ? document.fonts.ready.catch(() => {}) : Promise.resolve()).then(boot);
}

const WORLD_CSS = "*{margin:0;box-sizing:border-box}html,body{height:100%;overflow:hidden;background:#05060a;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#eef2f7}"
  + ".world__stage{position:fixed;inset:0}.world__stage canvas{display:block}"
  + ".world__cross{position:fixed;left:50%;top:50%;width:8px;height:8px;margin:-4px 0 0 -4px;border-radius:50%;border:1.5px solid rgba(255,255,255,.7);z-index:9100;pointer-events:none}.world__cross[hidden]{display:none}"
  + ".world__load{position:fixed;inset:0;z-index:9200;display:grid;place-items:center;align-content:center;gap:16px;background:#05060a;color:#cdd3dd;font-size:14px}.world__load[hidden]{display:none}.world__load p{margin:0}"
  + ".world__spinner{width:40px;height:40px;border-radius:50%;border:3px solid rgba(255,255,255,.15);border-top-color:var(--accent,#5aa6ff);animation:wspin .9s linear infinite}@keyframes wspin{to{transform:rotate(360deg)}}"
  + ".world__hint{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:9100;font-size:13px;color:rgba(255,255,255,.78);background:rgba(0,0,0,.42);padding:8px 16px;border-radius:999px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}.world__hint b{color:#fff}"
  + ".world__panel{position:fixed;inset:0;z-index:9300;display:grid;place-items:center;background:rgba(5,6,10,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);padding:24px}.world__panel[hidden]{display:none}"
  + ".world__panel .wp{width:min(720px,92vw);max-height:86vh;overflow-y:auto;background:#11151c;border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:28px 30px;box-shadow:0 30px 80px rgba(0,0,0,.6)}"
  + ".world__panel img{width:100%;border-radius:12px;margin-bottom:18px;display:block}"
  + ".world__panel h2{font-family:var(--font-title,'Space Grotesk',sans-serif);font-weight:600;font-size:30px;line-height:1.05;margin:0 0 8px;color:var(--ink,#eef4ff);white-space:pre-wrap}"
  + ".world__panel .k{font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--accent,#5aa6ff);margin:0 0 10px}"
  + ".world__panel p{font-size:15px;line-height:1.6;color:#dfe5ee;white-space:pre-wrap;margin:0 0 10px}"
  + ".world__panel .wp-close{margin-top:18px;background:var(--accent,#5aa6ff);color:#05060a;border:0;border-radius:999px;padding:10px 20px;font-size:14px;font-weight:600;cursor:pointer}"
  + ".world__joy{position:fixed;left:26px;bottom:26px;width:110px;height:110px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);z-index:9100;touch-action:none}.world__joy[hidden]{display:none}"
  + ".world__nub{position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.4)}"
  + ".world__home{position:fixed;top:18px;left:18px;z-index:9400;padding:9px 15px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.42);color:#fff;font-size:13px;font-weight:600;cursor:pointer;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:.82}.world__home:hover{opacity:1;background:rgba(0,0,0,.6)}";

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
      + "<script type=\"importmap\">{\"imports\":{\"three\":\"https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js\"}}<\/script>"
      + "<script type=\"module\">import * as THREE from \"three\";(" + WORLD_RUNTIME.toString() + ")(" + json + "," + JSON.stringify(cfg) + ",THREE);<\/script>"
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
