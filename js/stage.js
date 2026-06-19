/* ===================================================================
   stage.js — rendert eine Folie als sichtbares DOM (.wd-stage).
   Genutzt von Editor-Vorschau, Mini-Thumbnails und Präsentation.
   resolveSrc(layer) -> Bild-URL (oder null).
   Gibt Element + Referenzen zurück, damit effects.js animieren kann.
   =================================================================== */

export function createStage(slide, resolveSrc) {
  const root = document.createElement("div");
  root.className = "wd-stage";
  root.style.background = slide.bg || "#05070a";
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

  return { root, layers, texts };
}
