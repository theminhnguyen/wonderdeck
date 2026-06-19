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
  world.appendChild(Object.assign(document.createElement("div"), { className: "jr-line" }));
  const depth = Object.assign(document.createElement("div"), { className: "jr-depth" });
  for (let i = 0; i < 30; i++) { const d = document.createElement("span"); d.className = "jr-dot2"; d.dataset.sp = (0.2 + Math.random() * 1.7).toFixed(2); d.style.left = (Math.random() * 100).toFixed(1) + "%"; d.style.top = (Math.random() * 100).toFixed(1) + "%"; const s = (1 + Math.random() * 2.6).toFixed(1); d.style.width = d.style.height = s + "px"; d.style.opacity = (0.12 + Math.random() * 0.5).toFixed(2); depth.appendChild(d); }
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
  + ".jr-line{position:absolute;left:50%;bottom:0;width:1px;height:54%;transform:translateX(-50%);opacity:.45;background:linear-gradient(to top,color-mix(in srgb,var(--accent,#c9a25b) 60%,transparent),transparent)}"
  + ".jr-depth{position:absolute;inset:0;pointer-events:none}.jr-dot2{position:absolute;border-radius:50%;background:var(--ink,#fff);will-change:transform}"
  + ".jr-stations{position:absolute;inset:0}"
  + ".jr-station{position:absolute;left:50%;top:50%;width:min(74%,780px);text-align:center;container-type:inline-size;will-change:transform,opacity}"
  + ".jr-station__img{width:100%;max-height:42vh;object-fit:cover;border-radius:16px;margin:0 auto 26px;display:block;box-shadow:0 36px 90px rgba(0,0,0,.55)}"
  + ".jr-text{max-width:none;display:block;margin:0 auto 14px}"
  + ".jr-dots{position:fixed;right:22px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:13px;z-index:100}.jr-dot{width:9px;height:9px;border-radius:50%;padding:0;cursor:pointer;background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.45)}.jr-dot.on{background:#fff;transform:scale(1.5)}"
  + ".jr-counter{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:100;font-size:13px;letter-spacing:.1em;color:rgba(255,255,255,.7);font-variant-numeric:tabular-nums}"
  + ".jr-hint{position:fixed;bottom:16px;right:20px;z-index:100;font-size:12px;color:rgba(255,255,255,.5)}";

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
