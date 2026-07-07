/* ===================================================================
   stage.js — rendert eine Folie als sichtbares DOM (.wd-stage).
   Genutzt von Editor-Vorschau, Mini-Thumbnails und Präsentation.
   resolveSrc(layer) -> Bild-URL (oder null).
   Gibt Element + Referenzen zurück, damit effects.js animieren kann.
   =================================================================== */

/** Effektiver CSS-Hintergrund: Verlauf (falls vollständig) sonst Solid-Farbe.
    slide.bg bleibt immer eine einfache Farbe (Fallback für Canvas-Thumbs etc.). */
export function bgCss(slide) {
  const g = slide.bgGrad;
  if (g && g.from && g.to) return `linear-gradient(${g.angle == null ? 160 : g.angle}deg, ${g.from}, ${g.to})`;
  return slide.bg || "#05070a";
}

/** Basis-Transform einer Form (Zentrieren + Rotation); effects.js überlagert Parallax/Intro. */
export function shapeTransform(sh, extra = "", scale = 1) {
  return `translate(-50%,-50%) ${extra}rotate(${sh.rotation || 0}deg) scale(${scale})`;
}

export function createStage(slide, resolveSrc) {
  const root = document.createElement("div");
  root.className = "wd-stage";
  root.style.background = bgCss(slide);
  root.dataset.style = slide.style;
  if (slide.ink) root.style.setProperty("--ink", slide.ink); // per-Folie Textfarbe (überschreibt Theme)

  const layers = [];
  slide.layers.forEach((layer, i) => {
    const el = document.createElement("div");
    el.className = "wd-layer";
    el.dataset.id = layer.id;
    el.style.zIndex = String(i + 1);
    el.style.opacity = layer.opacity ?? 1;

    const src = resolveSrc(layer);
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = "";
      el.appendChild(img);
    } else {
      el.classList.add("wd-layer--empty");
      el.style.background =
        "repeating-linear-gradient(45deg,#161d27,#161d27 10px,#1b2330 10px,#1b2330 20px)";
    }
    el.style.transform = `scale(${layer.scale || 1})`;
    root.appendChild(el);
    layers.push({ el, cfg: layer });
  });

  const shapes = [];
  (slide.shapes || []).forEach((sh) => {
    const el = document.createElement("div");
    el.className = "wd-shape wd-shape--" + sh.type;
    el.dataset.id = sh.id;
    el.style.left = (sh.x ?? 50) + "%";
    el.style.top = (sh.y ?? 46) + "%";
    el.style.width = (sh.size ?? 22) + "cqw";
    el.style.setProperty("--sc", sh.color || "#d6452f");
    el.style.setProperty("--th", String(sh.thickness ?? 0.7));
    el.style.opacity = sh.opacity ?? 1;
    el.style.transform = shapeTransform(sh); // Ruhezustand; Präsentation animiert
    root.appendChild(el);
    shapes.push({ el, cfg: sh });
  });

  const texts = [];
  slide.texts.forEach((t) => {
    const el = document.createElement("div");
    el.className = "wd-text";
    el.dataset.id = t.id;
    el.dataset.role = t.role;
    el.style.left = (t.x ?? 8) + "%";
    el.style.top = (t.y ?? 40) + "%";
    el.style.width = (t.w ?? 60) + "%";
    el.style.textAlign = t.align || "left";
    el.textContent = t.text || "";
    root.appendChild(el);
    texts.push({ el, cfg: t });
  });

  return { root, layers, shapes, texts };
}
