/* ===================================================================
   effects.js — Animations-Helfer für die Präsentation.
   - Pro Folie: Intro-Zoom (Stil-abhängig), Ken-Burns, Text-Einblendung
   - Laufend: Maus-Parallax + reaktive Ebenen (weichen vom Cursor weg)
   - Snap-Übergang zwischen zwei Folien
   Die Snap-Bewegung läuft auf stage.root (CSS-Transition), die Parallax-/
   Intro-Transforms auf den einzelnen Ebenen (RAF) — sie überlagern sich.
   =================================================================== */

export const SNAP_DUR = 760; // ms
export const SNAP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const KEN_DUR = 9000; // ms für volle Ken-Burns-Fahrt

const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Anfangszustand für das Intro setzen (Folie betritt die Bühne). */
export function resetIntro(stage, now = performance.now()) {
  stage._t0 = now;
  stage._style = stage.root.dataset.style || "snap";
  stage.texts.forEach((t) => {
    t.el.style.opacity = "0";
    t.el.style.transform = "translateY(26px)";
  });
}

/** Einen Frame der Folie aktualisieren. mouse = {nx, ny} in -1..1. */
export function updateStage(stage, mouse, now = performance.now()) {
  const active = now - (stage._t0 || now);
  const introDur = stage._style === "wonder" ? 2000 : 1100;
  const introScale = lerp(
    stage._style === "wonder" ? 1.09 : 1.04,
    1,
    easeOutCubic(clamp01(active / introDur))
  );

  stage.layers.forEach((L) => {
    const c = L.cfg;
    const ken = 1 + (c.kenburns || 0) * clamp01(active / KEN_DUR);
    const scale = (c.scale || 1) * introScale * ken;
    let tx = -mouse.nx * (c.parallax || 0);
    let ty = -mouse.ny * (c.parallax || 0);
    let rot = 0;
    if (c.reactive) {
      tx += -mouse.nx * (c.parallax || 0) * 1.3;
      ty += -mouse.ny * (c.parallax || 0) * 1.3;
      rot = mouse.nx * 1.3;
    }
    L.el.style.transform =
      `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(4)}) rotate(${rot.toFixed(2)}deg)`;
  });

  stage.texts.forEach((t, i) => {
    const te = easeOutCubic(clamp01((active - 250 - i * 140) / 900));
    t.el.style.opacity = te.toFixed(3);
    t.el.style.transform = `translateY(${((1 - te) * 26).toFixed(2)}px)`;
  });
}

/* ---------- Snap-Übergänge ---------- */
function setSnap(stage, { y, scale, opacity, instant }) {
  stage.root.style.transition = instant
    ? "none"
    : `transform ${SNAP_DUR}ms ${SNAP_EASE}, opacity ${SNAP_DUR}ms ${SNAP_EASE}`;
  stage.root.style.transform = `translateY(${y}%) scale(${scale})`;
  stage.root.style.opacity = String(opacity);
}

/** Folie sofort als aktiv positionieren (kein Übergang). */
export function placeActive(stage) {
  setSnap(stage, { y: 0, scale: 1, opacity: 1, instant: true });
}

/** Snap von out -> in. dir: +1 (weiter/runter), -1 (zurück/hoch). */
export function snapTransition(outStage, inStage, dir, now = performance.now()) {
  // Eingehende Folie vorpositionieren
  setSnap(inStage, { y: dir > 0 ? 100 : -100, scale: 1, opacity: 1, instant: true });
  inStage.root.style.display = "";
  resetIntro(inStage, now);
  // Reflow erzwingen, damit die Transition greift
  void inStage.root.offsetWidth;
  // Bewegung starten
  setSnap(inStage, { y: 0, scale: 1, opacity: 1 });
  if (outStage) setSnap(outStage, { y: dir > 0 ? -30 : 30, scale: 0.95, opacity: 0.4 });
}
