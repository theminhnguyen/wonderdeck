/* ===================================================================
   journey.js — "Journey"-Modus: eine durchlaufbare 2.5D-Welt.
   EIN Pfad; die Folien erscheinen als Stationen, auf die man zuläuft.
   Bewegung: Scrollen / Ziehen / Pfeile / Punkte. Kein 3D-Framework.
   =================================================================== */
const el = (id) => document.getElementById(id);

const J = {
  open: false, raf: 0, prog: 0, target: 0, n: 0,
  stations: [], onClose: null, fine: window.matchMedia("(pointer: fine)").matches,
  drag: null, lastWheel: 0,
};

export function openJourney(deck, resolveSrc, onClose = null, startIndex = 0) {
  cancelAnimationFrame(J.raf);
  const ov = el("journey");
  const world = el("journeyWorld");
  world.innerHTML = "";
  J.onClose = onClose;

  // Ambiente + Boden (Perspektive) + Pfad-Mittellinie
  world.appendChild(Object.assign(document.createElement("div"), { className: "jr-sky" }));
  world.appendChild(Object.assign(document.createElement("div"), { className: "jr-floor" }));
  world.appendChild(Object.assign(document.createElement("div"), { className: "jr-line" }));

  // Tiefen-Partikel (Parallaxe für mehr Tiefe)
  const depth = Object.assign(document.createElement("div"), { className: "jr-depth" });
  for (let i = 0; i < 30; i++) {
    const dot = document.createElement("span");
    dot.className = "jr-dot2";
    dot.dataset.sp = (0.2 + Math.random() * 1.7).toFixed(2);
    dot.style.left = (Math.random() * 100).toFixed(1) + "%";
    dot.style.top = (Math.random() * 100).toFixed(1) + "%";
    const s = (1 + Math.random() * 2.6).toFixed(1);
    dot.style.width = dot.style.height = s + "px";
    dot.style.opacity = (0.12 + Math.random() * 0.5).toFixed(2);
    depth.appendChild(dot);
  }
  world.appendChild(depth);

  const stage = Object.assign(document.createElement("div"), { className: "jr-stations" });
  world.appendChild(stage);

  J.stations = deck.slides.map((slide) => {
    const st = Object.assign(document.createElement("div"), { className: "jr-station" });
    if (slide.ink) st.style.setProperty("--ink", slide.ink);
    const bgLayer = (slide.layers || []).find((l) => resolveSrc(l));
    if (bgLayer) {
      const im = document.createElement("img");
      im.className = "jr-station__img";
      im.src = resolveSrc(bgLayer);
      st.appendChild(im);
    }
    (slide.texts || []).forEach((t) => {
      const d = document.createElement("div");
      d.className = "wd-text jr-text";
      d.dataset.role = t.role;
      d.style.textAlign = t.align || "center";
      d.textContent = t.text || "";
      st.appendChild(d);
    });
    stage.appendChild(st);
    return st;
  });
  J.n = J.stations.length;
  J.prog = J.target = Math.max(0, Math.min(startIndex, J.n - 1));
  J.open = true;

  buildDots();
  ov.hidden = false;
  requestAnimationFrame(() => ov.classList.add("is-live"));
  bind();
  if (ov.requestFullscreen && !document.fullscreenElement) ov.requestFullscreen().catch(() => {});
  J.raf = requestAnimationFrame(loop);
}

function close() {
  if (!J.open) return;
  J.open = false;
  cancelAnimationFrame(J.raf);
  unbind();
  const ov = el("journey");
  ov.classList.remove("is-live");
  ov.hidden = true;
  el("journeyWorld").innerHTML = "";
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (J.onClose) J.onClose(Math.round(J.prog));
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function loop() {
  if (!J.open) return;
  J.target = clamp(J.target, 0, J.n - 1);
  J.prog += (J.target - J.prog) * 0.12;
  const p = J.prog;

  // Hintergrund-Parallaxe (sanfte Vorwärtsbewegung)
  const world = el("journeyWorld");
  const sky = world.querySelector(".jr-sky");
  const floor = world.querySelector(".jr-floor");
  if (sky) sky.style.transform = `translateY(${(-p * 22).toFixed(1)}px) scale(1.1)`;
  if (floor) floor.style.backgroundPosition = `0 ${(p * 120).toFixed(0)}px`;
  const depth = world.querySelector(".jr-depth");
  if (depth) for (const d of depth.children) d.style.transform = `translateY(${(-p * parseFloat(d.dataset.sp) * 38).toFixed(1)}px)`;

  J.stations.forEach((st, i) => {
    const d = i - p; // >0 = noch vor uns, <0 = passiert
    if (d < -1.1 || d > 3.4) { st.style.display = "none"; return; }
    st.style.display = "";
    let scale, opacity, ty;
    if (d >= 0) {
      scale = 1 / (1 + d * 0.55);          // fern = klein
      opacity = clamp(1 - d * 0.42, 0, 1);
      ty = -d * 70;                         // fern = höher (Richtung Fluchtpunkt)
    } else {
      scale = 1 + (-d) * 0.7;               // passiert = wächst
      opacity = clamp(1 + d * 1.4, 0, 1);   // und blendet aus
      ty = (-d) * 150;                      // wandert nach unten am Betrachter vorbei
    }
    st.style.transform = `translate(-50%, -50%) translateY(${ty.toFixed(1)}px) scale(${scale.toFixed(3)})`;
    st.style.opacity = opacity.toFixed(3);
    st.style.zIndex = String(200 - Math.round(Math.abs(d) * 10));
  });

  updateDots();
  J.raf = requestAnimationFrame(loop);
}

/* ---------- Eingaben ---------- */
function onWheel(e) {
  e.preventDefault();
  J.target = clamp(J.target + e.deltaY * 0.0016, 0, J.n - 1);
}
function onKey(e) {
  if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); J.target = clamp(Math.round(J.target) + 1, 0, J.n - 1); }
  else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); J.target = clamp(Math.round(J.target) - 1, 0, J.n - 1); }
  else if (e.key === "Escape") close();
  else if (e.key === "Home") J.target = 0;
  else if (e.key === "End") J.target = J.n - 1;
}
function onDown(e) { J.drag = (e.touches ? e.touches[0].clientY : e.clientY); }
function onMoveDrag(e) {
  if (J.drag == null) return;
  const y = e.touches ? e.touches[0].clientY : e.clientY;
  J.target = clamp(J.target + (J.drag - y) * 0.004, 0, J.n - 1);
  J.drag = y;
  if (e.cancelable) e.preventDefault();
}
function onUp() { J.drag = null; }

function bind() {
  const ov = el("journey");
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);
  ov.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMoveDrag);
  window.addEventListener("mouseup", onUp);
  ov.addEventListener("touchstart", onDown, { passive: true });
  ov.addEventListener("touchmove", onMoveDrag, { passive: false });
  ov.addEventListener("touchend", onUp);
  el("journeyExit").addEventListener("click", close);
}
function unbind() {
  const ov = el("journey");
  window.removeEventListener("wheel", onWheel);
  window.removeEventListener("keydown", onKey);
  ov.removeEventListener("mousedown", onDown);
  window.removeEventListener("mousemove", onMoveDrag);
  window.removeEventListener("mouseup", onUp);
  ov.removeEventListener("touchstart", onDown);
  ov.removeEventListener("touchmove", onMoveDrag);
  ov.removeEventListener("touchend", onUp);
  el("journeyExit").removeEventListener("click", close);
}

/* ---------- Fortschritts-Punkte ---------- */
function buildDots() {
  const dots = el("journeyDots");
  dots.innerHTML = "";
  J.stations.forEach((_, i) => {
    const b = document.createElement("button");
    b.className = "jr-dot";
    b.addEventListener("click", () => (J.target = i));
    dots.appendChild(b);
  });
}
function updateDots() {
  const idx = Math.round(J.prog);
  [...el("journeyDots").children].forEach((d, i) => d.classList.toggle("on", i === idx));
  el("journeyCounter").textContent = `${idx + 1} / ${J.n}`;
}
