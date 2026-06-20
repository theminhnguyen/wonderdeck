/* ===================================================================
   present.js — Vollbild-Präsentationsmodus
   Baut alle Folien als Stages, steuert Navigation (Wheel/Touch/Tasten/
   Dots), den RAF-Loop (Parallax + Cursor) und die Snap-Übergänge.
   =================================================================== */
import { createStage } from "./stage.js";
import { resetIntro, updateStage, placeActive, transition, SNAP_DUR } from "./effects.js";

const el = (id) => document.getElementById(id);

const P = {
  open: false,
  stages: [],
  index: 0,
  target: -1,
  locked: false,
  raf: 0,
  mouse: { nx: 0, ny: 0, tx: 0, ty: 0, cx: 0, cy: 0, lx: 0, ly: 0 },
  lastWheel: 0,
  touchY: null,
  onClose: null,
  onDeck: null,
  deck: null,
  resolveSrc: null,
  fine: window.matchMedia("(pointer: fine)").matches,
};

export function openPresent(deck, resolveSrc, startIndex = 0, onClose = null, onDeck = null) {
  cancelAnimationFrame(P.raf); // Re-Entrancy: erlaubt Deck-Wechsel mitten in der Präsentation
  const overlay = el("present");
  const viewport = el("presentViewport");
  viewport.innerHTML = "";
  P.stages = [];
  P.onClose = onClose;
  P.onDeck = onDeck;
  P.deck = deck;
  P.resolveSrc = resolveSrc;

  deck.slides.forEach((slide, i) => {
    const stage = createStage(slide, resolveSrc);
    stage._transition = slide.transition || "snap";
    stage._slide = slide;
    stage.root.style.display = i === startIndex ? "" : "none";
    viewport.appendChild(stage.root);
    P.stages.push(stage);
  });

  P.index = Math.max(0, Math.min(startIndex, P.stages.length - 1));
  P.target = -1;
  P.locked = false;
  P.open = true;

  buildDots();
  buildNav(deck);
  updateChrome();
  placeActive(P.stages[P.index]);
  resetIntro(P.stages[P.index]);

  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("is-live"));
  bind();
  if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
  P.mouse.cx = P.mouse.lx = window.innerWidth / 2;
  P.mouse.cy = P.mouse.ly = window.innerHeight / 2;
  P.raf = requestAnimationFrame(loop);
}

function close() {
  if (!P.open) return;
  P.open = false;
  cancelAnimationFrame(P.raf);
  unbind();
  const overlay = el("present");
  overlay.classList.remove("is-live");
  overlay.hidden = true;
  el("presentViewport").innerHTML = "";
  el("presentNav").innerHTML = "";
  el("presentNote").hidden = true;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (P.onClose) P.onClose(P.index);
}

/* ---------- Navigation ---------- */
function go(to) {
  if (P.locked || !P.open) return;
  if (to < 0 || to >= P.stages.length || to === P.index) return;
  el("presentNote").hidden = true; // Popover bei Navigation schließen
  const dir = to > P.index ? 1 : -1;
  const out = P.stages[P.index];
  const inS = P.stages[to];
  P.target = to;
  P.locked = true;
  transition(out, inS, dir, inS._transition || "snap");
  updateChrome(to);
  setTimeout(() => {
    out.root.style.display = "none";
    P.index = to;
    P.target = -1;
    P.locked = false;
  }, SNAP_DUR + 30);
}
const next = () => go(P.index + 1);
const prev = () => go(P.index - 1);

/* ---------- RAF-Loop ---------- */
function loop() {
  if (!P.open) return;
  const m = P.mouse;
  m.nx += (m.tx - m.nx) * 0.09;
  m.ny += (m.ty - m.ny) * 0.09;
  updateStage(P.stages[P.index], m);
  if (P.target >= 0) updateStage(P.stages[P.target], m);

  // Custom-Cursor
  if (P.fine) {
    m.lx += (m.cx - m.lx) * 0.18;
    m.ly += (m.cy - m.ly) * 0.18;
    el("presentCursor").style.transform = `translate3d(${m.lx}px, ${m.ly}px, 0)`;
  }
  P.raf = requestAnimationFrame(loop);
}

/* ---------- Eingaben ---------- */
function onMove(e) {
  P.mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
  P.mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  P.mouse.cx = e.clientX;
  P.mouse.cy = e.clientY;
}
function onWheel(e) {
  e.preventDefault();
  const now = performance.now();
  if (now - P.lastWheel < 120) return;
  if (Math.abs(e.deltaY) < 12) return;
  P.lastWheel = now;
  e.deltaY > 0 ? next() : prev();
}
function onKey(e) {
  if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key)) { e.preventDefault(); next(); }
  else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); prev(); }
  else if (e.key === "Escape") close();
  else if (e.key === "Home") go(0);
  else if (e.key === "End") go(P.stages.length - 1);
}
function onTouchStart(e) { P.touchY = e.touches[0].clientY; }
function onTouchEnd(e) {
  if (P.touchY == null) return;
  const dy = P.touchY - e.changedTouches[0].clientY;
  if (Math.abs(dy) > 50) (dy > 0 ? next() : prev());
  P.touchY = null;
}

function bind() {
  const vp = el("presentViewport");
  vp.addEventListener("mousemove", onMove);
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);
  vp.addEventListener("touchstart", onTouchStart, { passive: true });
  vp.addEventListener("touchend", onTouchEnd, { passive: true });
  el("presentNext").addEventListener("click", next);
  el("presentPrev").addEventListener("click", prev);
  el("presentExit").addEventListener("click", close);
}
function unbind() {
  const vp = el("presentViewport");
  vp.removeEventListener("mousemove", onMove);
  window.removeEventListener("wheel", onWheel);
  window.removeEventListener("keydown", onKey);
  vp.removeEventListener("touchstart", onTouchStart);
  vp.removeEventListener("touchend", onTouchEnd);
  el("presentNext").removeEventListener("click", next);
  el("presentPrev").removeEventListener("click", prev);
  el("presentExit").removeEventListener("click", close);
}

/* ---------- Website-Kopfzeile (Deck-Navigation) ---------- */
function buildNav(deck) {
  const nav = el("presentNav");
  nav.innerHTML = "";
  const items = deck.nav || [];
  nav.classList.toggle("present__topnav--bottom", (deck.navPos || "top") === "bottom");
  el("presentNote").classList.toggle("present__note--bottom", (deck.navPos || "top") === "bottom");
  if (!items.length && !deck.brand && !deck.brandImageId) { nav.style.display = "none"; return; }
  nav.style.display = "";
  // Marke: Logo-Bild oder Text
  let brand;
  if (deck.brandImageId && P.resolveSrc) {
    brand = document.createElement("img");
    brand.className = "present__brandimg";
    brand.src = P.resolveSrc({ imageId: deck.brandImageId }) || "";
  } else {
    brand = document.createElement("span");
    brand.className = "present__brand";
    brand.textContent = deck.brand || deck.title || "";
  }
  nav.appendChild(brand);
  const links = document.createElement("div");
  links.className = "present__links";
  items.forEach((item) => {
    const a = document.createElement("a");
    a.className = "present__navlink";
    a.href = "#";
    a.textContent = item.label || "";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (item.type === "url" && item.target) window.open(item.target, "_blank", "noopener");
      else if (item.type === "deck" && item.target) { if (P.onDeck) P.onDeck(item.target); }
      else if (item.type === "text") {
        const note = el("presentNote");
        const showing = !note.hidden && note.dataset.for === item.id;
        note.textContent = item.target || "";
        note.dataset.for = item.id;
        note.hidden = showing; // erneuter Klick blendet wieder aus
      } else {
        const idx = deck.slides.findIndex((s) => s.id === item.target);
        if (idx >= 0) go(idx);
      }
    });
    links.appendChild(a);
  });
  nav.appendChild(links);
}

/* ---------- Chrome (Dots, Zähler) ---------- */
function buildDots() {
  const dots = el("presentDots");
  dots.innerHTML = "";
  P.stages.forEach((_, i) => {
    const b = document.createElement("button");
    b.className = "present__dot";
    b.setAttribute("aria-label", `Folie ${i + 1}`);
    b.addEventListener("click", () => go(i));
    dots.appendChild(b);
  });
}
function updateChrome(idx = P.index) {
  el("presentCounter").textContent = `${idx + 1} / ${P.stages.length}`;
  [...el("presentDots").children].forEach((d, i) => d.classList.toggle("is-on", i === idx));
  // Kopfzeile pro Folie aus-/einblenden
  const slide = P.stages[idx] && P.stages[idx]._slide;
  el("presentNav").style.visibility = slide && slide.hideNav ? "hidden" : "";
}
