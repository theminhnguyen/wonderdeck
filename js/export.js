/* ===================================================================
   export.js — exportiert die aktuelle Präsi als EINE in sich
   geschlossene .html (eingebetteter Viewer + Bilder als Data-URL).
   Läuft per Doppelklick in jedem Browser, ohne WonderDeck.
   =================================================================== */

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

  const stages = DECK.slides.map((s) => { const st = stageEl(s); st.root.style.display = "none"; vp.appendChild(st.root); return st; });
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
  function snap(st, o) {
    st.root.style.transition = o.instant ? "none" : "transform " + SNAP_DUR + "ms " + SNAP_EASE + ",opacity " + SNAP_DUR + "ms " + SNAP_EASE;
    st.root.style.transform = "translateY(" + o.y + "%) scale(" + o.s + ")"; st.root.style.opacity = o.o;
  }
  function setDots(i) { [].forEach.call(dots.children, (d, j) => d.classList.toggle("on", j === i)); counter.textContent = (i + 1) + " / " + stages.length; }
  function go(to) {
    if (locked || to < 0 || to >= stages.length || to === index) return;
    const dir = to > index ? 1 : -1, out = stages[index], inn = stages[to]; target = to; locked = true;
    snap(inn, { y: dir > 0 ? 100 : -100, s: 1, o: 1, instant: true }); inn.root.style.display = ""; resetIntro(inn, performance.now());
    void inn.root.offsetWidth; snap(inn, { y: 0, s: 1, o: 1 }); snap(out, { y: dir > 0 ? -30 : 30, s: 0.95, o: 0.4 }); setDots(to);
    setTimeout(() => { out.root.style.display = "none"; index = to; target = -1; locked = false; }, SNAP_DUR + 30);
  }
  function loop(now) {
    m.nx += (m.tx - m.nx) * 0.09; m.ny += (m.ty - m.ny) * 0.09;
    update(stages[index], now); if (target >= 0) update(stages[target], now);
    if (fine) { m.lx += (m.cx - m.lx) * 0.18; m.ly += (m.cy - m.ly) * 0.18; cur.style.transform = "translate3d(" + m.lx + "px," + m.ly + "px,0)"; }
    requestAnimationFrame(loop);
  }

  stages.forEach((_, i) => { const b = document.createElement("button"); b.className = "dot"; b.onclick = () => go(i); dots.appendChild(b); });
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

  snap(stages[0], { y: 0, s: 1, o: 1, instant: true }); stages[0].root.style.display = ""; resetIntro(stages[0], performance.now()); setDots(0);
  const hint = document.getElementById("hint"); if (hint) setTimeout(() => (hint.style.opacity = 0), 4200);
  requestAnimationFrame(loop);
}

const VIEWER_CSS = "*{margin:0;box-sizing:border-box}html,body{height:100%;overflow:hidden;background:#000;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f6efe6}@media(pointer:fine){html,body,*{cursor:none}}"
  + ".vp{position:fixed;inset:0;overflow:hidden}"
  + ".wd-stage{position:absolute;inset:0;overflow:hidden;container-type:inline-size;background:#05070a;will-change:transform,opacity}"
  + ".wd-layer{position:absolute;inset:-8%;width:116%;height:116%;will-change:transform,opacity}"
  + ".wd-layer img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}"
  + ".wd-text{position:absolute;max-width:60%;text-shadow:0 2px 28px rgba(0,0,0,.5);line-height:1.08;white-space:pre-wrap;word-break:break-word;z-index:50}"
  + ".wd-text[data-role=title]{font-family:'Playfair Display',Georgia,serif;font-weight:600;font-size:clamp(28px,7.4cqw,96px)}"
  + ".wd-text[data-role=subtitle]{font-weight:300;font-size:clamp(13px,2.1cqw,24px);line-height:1.5;color:rgba(246,239,230,.9)}"
  + ".wd-text[data-role=body]{font-weight:400;font-size:clamp(12px,1.9cqw,21px);line-height:1.55;color:rgba(246,239,230,.86)}"
  + ".wd-text[data-role=kicker]{font-weight:600;font-size:clamp(10px,1.4cqw,15px);letter-spacing:.22em;text-transform:uppercase;color:#c9a25b}"
  + ".cur{position:fixed;top:0;left:0;width:28px;height:28px;margin:-14px 0 0 -14px;border:2px solid #fff;border-radius:50%;pointer-events:none;z-index:9999;mix-blend-mode:difference}@media(pointer:coarse){.cur{display:none}}"
  + ".dots{position:fixed;right:22px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:11px;z-index:100}"
  + ".dot{width:11px;height:11px;border-radius:50%;padding:0;cursor:pointer;background:rgba(255,255,255,.28);border:1px solid rgba(255,255,255,.5);transition:transform .2s,background .2s}.dot.on{background:#fff;transform:scale(1.35)}"
  + ".counter{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:100;font-size:13px;letter-spacing:.1em;color:rgba(255,255,255,.7);font-variant-numeric:tabular-nums}"
  + ".hint{position:fixed;bottom:16px;right:20px;z-index:100;font-size:12px;color:rgba(255,255,255,.5);transition:opacity .6s}";

function esc(s) { return String(s).replace(/[<&>]/g, (c) => ({ "<": "&lt;", "&": "&amp;", ">": "&gt;" }[c])); }

function buildDoc(deck) {
  const json = JSON.stringify(deck).replace(/</g, "\\u003c");
  return "<!DOCTYPE html>\n<html lang=\"de\"><head><meta charset=\"utf-8\">"
    + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
    + "<title>" + esc(deck.title || "WonderDeck") + "</title>"
    + "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>"
    + "<link href=\"https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=Inter:wght@300;400;500;600&display=swap\" rel=\"stylesheet\">"
    + "<style>" + VIEWER_CSS + "</style></head><body>"
    + "<div id=\"vp\" class=\"vp\"></div><div id=\"cur\" class=\"cur\"></div>"
    + "<nav id=\"dots\" class=\"dots\"></nav><div id=\"counter\" class=\"counter\"></div>"
    + "<div id=\"hint\" class=\"hint\">Pfeiltasten / Scrollen zum Blättern · F = Vollbild</div>"
    + "<script>(" + VIEWER_RUNTIME.toString() + ")(" + json + ");<\/script></body></html>";
}

/** Erzeugt das eigenständige HTML als String (Bilder eingebettet). */
export function buildStandaloneHTML(deck, images) {
  const d = structuredClone(deck);
  for (const s of d.slides)
    for (const l of s.layers) { if (l.imageId && images[l.imageId]) l.src = images[l.imageId]; delete l.imageId; }
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
