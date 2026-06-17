/* ===================================================================
   editor.js — Editor-Oberfläche: Folien-Leiste, Bühne, Inspektor,
   Drag-and-drop, Auswahl & Inline-Text-Bearbeitung.
   =================================================================== */
import * as S from "./state.js";
import { srcOf, curSlide, state } from "./state.js";
import { createStage } from "./stage.js";
import { openPresent } from "./present.js";
import { EXAMPLES } from "./examples.js";
import { LAYOUTS } from "./layouts.js";
import { exportStandaloneHTML } from "./export.js";
import { THEMES, applyTheme } from "./themes.js";
import { TRANSITIONS } from "./effects.js";

const el = (id) => document.getElementById(id);
const readFile = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

/* Mini-DOM-Helfer */
function h(tag, props = {}, kids = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v != null) e.setAttribute(k, v);
  }
  (Array.isArray(kids) ? kids : [kids]).forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
  return e;
}

let layerEls = {}; // id -> Ebenen-Element der aktuellen Bühne (für Live-Updates)
let imageMode = { mode: "add", layerId: null };

/* =================== Render: alles =================== */
function renderAll() {
  applyTheme(document.body, state.deck.theme || "aurum");
  renderRail();
  renderStage();
  applyOutline();
  renderInspector();
  const title = el("deckTitle");
  if (document.activeElement !== title) title.value = state.deck.title;
}

/* =================== Folien-Leiste =================== */
function renderRail() {
  const list = el("railList");
  list.innerHTML = "";
  state.deck.slides.forEach((slide, i) => {
    const thumb = h("div", {
      class: "thumb" + (i === state.current ? " is-active" : ""),
      draggable: "true",
      onclick: () => S.selectSlide(i),
    });
    thumb.append(
      h("span", { class: "thumb__num", text: String(i + 1) }),
      h("button", {
        class: "thumb__del",
        text: "✕",
        title: "Folie löschen",
        onclick: (ev) => { ev.stopPropagation(); if (state.deck.slides.length > 1) S.deleteSlide(i); },
      })
    );
    const mini = h("div", { class: "thumb__stage" });
    mini.appendChild(createStage(slide, srcOf).root);
    thumb.appendChild(mini);

    // Drag-Reorder
    thumb.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/sl", String(i)); thumb.classList.add("dragging"); });
    thumb.addEventListener("dragend", () => thumb.classList.remove("dragging"));
    thumb.addEventListener("dragover", (e) => { e.preventDefault(); thumb.classList.add("drop-before"); });
    thumb.addEventListener("dragleave", () => thumb.classList.remove("drop-before"));
    thumb.addEventListener("drop", (e) => {
      e.preventDefault(); thumb.classList.remove("drop-before");
      const from = parseInt(e.dataTransfer.getData("text/sl"), 10);
      if (!isNaN(from) && from !== i) S.moveSlide(from, i);
    });
    list.appendChild(thumb);
  });
}

/* =================== Bühne =================== */
function renderStage() {
  const frame = el("stageFrame");
  frame.innerHTML = "";
  layerEls = {};
  const { root, layers, texts } = createStage(curSlide(), srcOf);
  frame.appendChild(root);

  layers.forEach(({ el: lel, cfg }) => {
    layerEls[cfg.id] = lel;
    lel.addEventListener("click", (e) => { e.stopPropagation(); selectEl("layer", cfg.id); });
  });

  texts.forEach(({ el: tel, cfg }) => {
    tel.contentEditable = "true";
    tel.spellcheck = false;
    tel.addEventListener("focus", () => selectEl("text", cfg.id, false));
    tel.addEventListener("input", () => { S.findText(cfg.id).text = tel.innerText; S.touchSave(); });
    tel.addEventListener("blur", () => renderRail()); // Thumbnail aktualisieren
    tel.addEventListener("click", (e) => e.stopPropagation());
  });

  root.addEventListener("click", () => clearSel());
}

/* =================== Auswahl =================== */
function selectEl(type, id, focusToo = true) {
  state.sel = { type, id };
  applyOutline();
  renderInspector();
  if (type === "text" && focusToo) {
    const t = el("stageFrame").querySelector(`.wd-text[data-id="${id}"]`);
    t && t.focus();
  }
}
function clearSel() {
  if (!state.sel.type) return;
  state.sel = { type: null, id: null };
  applyOutline();
  renderInspector();
}
function applyOutline() {
  const frame = el("stageFrame");
  frame.querySelectorAll(".wd-sel").forEach((e) => e.classList.remove("wd-sel"));
  if (state.sel.id) {
    const node = frame.querySelector(`[data-id="${state.sel.id}"]`);
    node && node.classList.add("wd-sel");
  }
}

/* =================== Inspektor =================== */
function field(labelText, control) {
  return h("div", { class: "field" }, [labelText ? h("label", { text: labelText }) : null, control]);
}
function slider(labelText, value, min, max, step, oninput, fmt = (v) => v) {
  const out = h("span", { class: "val", text: fmt(value) });
  const input = h("input", {
    type: "range", min, max, step, value,
    oninput: (e) => { out.textContent = fmt(+e.target.value); oninput(+e.target.value); },
  });
  return h("div", { class: "field" }, [
    h("label", {}, [labelText, " ", out]),
    input,
  ]);
}

function deckSection() {
  const sec = h("div", { class: "insp-section" }, [h("h3", { text: "Theme (ganzes Deck)" })]);
  const grid = h("div", { class: "themes" });
  THEMES.forEach((t) => {
    grid.appendChild(h("button", {
      class: "themebtn" + ((state.deck.theme || "aurum") === t.key ? " is-on" : ""),
      title: t.name,
      onclick: () => S.setDeckTheme(t.key),
    }, [h("span", { class: "sw", style: `background:${t.accent}` }), t.name]));
  });
  sec.appendChild(grid);
  return sec;
}

function renderInspector() {
  const insp = el("inspector");
  insp.innerHTML = "";
  insp.appendChild(deckSection());
  insp.appendChild(slideSection());
  if (state.sel.type === "layer") insp.appendChild(layerSection(S.findLayer(state.sel.id)));
  else if (state.sel.type === "text") insp.appendChild(textSection(S.findText(state.sel.id)));
  else insp.appendChild(h("p", { class: "insp-empty", text: "Tipp: Klicke eine Ebene oder einen Text auf der Bühne an, um sie zu bearbeiten. Bilder ziehst du einfach auf die Bühne." }));
}

function slideSection() {
  const slide = curSlide();
  const sec = h("div", { class: "insp-section" }, [h("h3", { text: "Folie" })]);

  // Stil
  const seg = h("div", { class: "seg" });
  ["wonder", "snap"].forEach((st) => {
    seg.appendChild(h("button", {
      class: slide.style === st ? "is-on" : "",
      text: st === "wonder" ? "✦ Wonder" : "▦ Snap",
      onclick: () => S.setSlideStyle(st),
    }));
  });
  sec.appendChild(field("Stil dieser Folie", seg));

  // Hintergrundfarbe
  sec.appendChild(field("Hintergrundfarbe (hinter Ebenen)",
    h("input", { type: "color", value: slide.bg || "#0a1118", oninput: (e) => S.setSlideBg(e.target.value) })));

  // Übergang zu dieser Folie
  const tsel = h("select", { onchange: (e) => S.setSlideTransition(e.target.value) });
  TRANSITIONS.forEach((tr) =>
    tsel.appendChild(h("option", { value: tr.key, ...((slide.transition || "snap") === tr.key ? { selected: "selected" } : {}), text: tr.name })));
  sec.appendChild(field("Übergang zu dieser Folie", tsel));

  // Ebenen-Liste
  const list = h("div", { class: "layerlist" });
  [...slide.layers].reverse().forEach((layer) => {
    const realIdx = slide.layers.indexOf(layer);
    const item = h("div", {
      class: "layeritem" + (state.sel.id === layer.id ? " is-sel" : ""),
      onclick: () => selectEl("layer", layer.id),
    });
    const src = srcOf(layer);
    item.append(
      src ? h("img", { class: "layeritem__thumb", src }) : h("div", { class: "layeritem__thumb" }),
      h("span", { class: "layeritem__name", text: layer.name + (layer.reactive ? "" : "") }),
      layer.reactive ? h("span", { class: "layeritem__tag", text: "reaktiv" }) : null,
      h("div", { class: "layeritem__ord" }, [
        h("button", { text: "▲", title: "nach vorn", onclick: (e) => { e.stopPropagation(); S.reorderLayer(layer.id, +1); } }),
        h("button", { text: "▼", title: "nach hinten", onclick: (e) => { e.stopPropagation(); S.reorderLayer(layer.id, -1); } }),
      ])
    );
    list.appendChild(item);
  });
  if (slide.layers.length) sec.appendChild(field("Ebenen (oben = vorne)", list));
  else sec.appendChild(h("p", { class: "insp-empty", text: "Noch keine Bild-Ebenen. Zieh ein Bild auf die Bühne." }));

  return sec;
}

function layerSection(layer) {
  if (!layer) return h("div");
  const sec = h("div", { class: "insp-section" }, [h("h3", { text: "Bild-Ebene" })]);
  sec.appendChild(field("Name", h("input", {
    type: "text", value: layer.name,
    oninput: (e) => { layer.name = e.target.value; S.touchSave(); },
  })));
  sec.appendChild(field("Bild",
    h("button", { class: "btn btn-block", text: "⭯ Bild ersetzen", onclick: () => { imageMode = { mode: "replace", layerId: layer.id }; el("fileImage").click(); } })));

  sec.appendChild(slider("Parallax (Maus-Tiefe)", layer.parallax, 0, 60, 1,
    (v) => { layer.parallax = v; S.touchSave(); }, (v) => v + "px"));
  sec.appendChild(slider("Grundgröße", layer.scale, 1, 1.6, 0.01,
    (v) => { layer.scale = v; layerEls[layer.id] && (layerEls[layer.id].style.transform = `scale(${v})`); S.touchSave(); }, (v) => v.toFixed(2) + "×"));
  sec.appendChild(slider("Langsamer Zoom (Ken-Burns)", layer.kenburns, 0, 0.3, 0.01,
    (v) => { layer.kenburns = v; S.touchSave(); }, (v) => (v === 0 ? "aus" : "+" + Math.round(v * 100) + "%")));
  sec.appendChild(slider("Deckkraft", layer.opacity ?? 1, 0.1, 1, 0.05,
    (v) => { layer.opacity = v; layerEls[layer.id] && (layerEls[layer.id].style.opacity = v); S.touchSave(); }, (v) => Math.round(v * 100) + "%"));

  const tog = h("label", { class: "toggle" }, [
    h("input", { type: "checkbox", ...(layer.reactive ? { checked: "checked" } : {}), onchange: (e) => { layer.reactive = e.target.checked; S.touchSave(); renderInspector(); } }),
    "Reaktiv (weicht vom Cursor weg)",
  ]);
  sec.appendChild(field(null, tog));

  sec.appendChild(h("button", { class: "btn btn-block btn-danger", text: "Ebene löschen", onclick: () => S.deleteSelected() }));
  return sec;
}

function textSection(t) {
  if (!t) return h("div");
  const sec = h("div", { class: "insp-section" }, [h("h3", { text: "Text" })]);
  sec.appendChild(field("Inhalt", h("textarea", {
    oninput: (e) => { t.text = e.target.value; const node = el("stageFrame").querySelector(`.wd-text[data-id="${t.id}"]`); if (node) node.textContent = e.target.value; S.touchSave(); renderRail(); },
  }, t.text)));

  const roleSel = h("select", { onchange: (e) => S.updateText(t.id, { role: e.target.value }) });
  [["kicker", "Kicker (klein, Großbuchstaben)"], ["title", "Titel (groß, Serif)"], ["subtitle", "Untertitel"], ["body", "Fließtext"]]
    .forEach(([v, lab]) => roleSel.appendChild(h("option", { value: v, ...(t.role === v ? { selected: "selected" } : {}), text: lab })));
  sec.appendChild(field("Art", roleSel));

  const seg = h("div", { class: "seg" });
  [["left", "⫷"], ["center", "≡"], ["right", "⫸"]].forEach(([v, sym]) =>
    seg.appendChild(h("button", { class: t.align === v ? "is-on" : "", text: sym, onclick: () => S.updateText(t.id, { align: v }) })));
  sec.appendChild(field("Ausrichtung", seg));

  sec.appendChild(slider("Position X", t.x, 0, 92, 1, (v) => { t.x = v; const n = el("stageFrame").querySelector(`.wd-text[data-id="${t.id}"]`); if (n) n.style.left = v + "%"; S.touchSave(); }, (v) => v + "%"));
  sec.appendChild(slider("Position Y", t.y, 0, 92, 1, (v) => { t.y = v; const n = el("stageFrame").querySelector(`.wd-text[data-id="${t.id}"]`); if (n) n.style.top = v + "%"; S.touchSave(); }, (v) => v + "%"));
  sec.appendChild(slider("Breite", t.w, 15, 92, 1, (v) => { t.w = v; const n = el("stageFrame").querySelector(`.wd-text[data-id="${t.id}"]`); if (n) n.style.width = v + "%"; S.touchSave(); }, (v) => v + "%"));

  sec.appendChild(h("button", { class: "btn btn-block btn-danger", text: "Text löschen", onclick: () => S.deleteSelected() }));
  return sec;
}

/* =================== Bilder hinzufügen =================== */
async function handleImageFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    const data = await readFile(f);
    const name = f.name.replace(/\.[^.]+$/, "");
    if (imageMode.mode === "replace" && imageMode.layerId) {
      await S.replaceLayerImage(imageMode.layerId, data, name);
      imageMode = { mode: "add", layerId: null };
      break;
    } else {
      await S.addImageLayer(data, name);
    }
  }
}

/* =================== Init / Verdrahtung =================== */
export function init() {
  S.subscribe(renderAll);
  renderAll();

  el("deckTitle").addEventListener("input", (e) => { state.deck.title = e.target.value; S.touchSave(); });
  el("btnAddSlide").addEventListener("click", () => openLayouts());
  el("railAdd").addEventListener("click", () => openLayouts());
  el("btnAddLayer").addEventListener("click", () => { imageMode = { mode: "add", layerId: null }; el("fileImage").click(); });
  el("btnAddText").addEventListener("click", () => S.addText("body"));
  el("btnPresent").addEventListener("click", () =>
    openPresent(state.deck, srcOf, state.current, (i) => S.selectSlide(i)));

  // File-Inputs
  el("fileImage").addEventListener("change", async (e) => { await handleImageFiles([...e.target.files]); e.target.value = ""; });
  el("fileImport").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try { await S.importDeck(JSON.parse(await f.text())); }
    catch (err) { alert("Konnte Datei nicht laden: " + err.message); }
  });

  // Drag-and-drop von Bildern auf die Bühne
  const wrap = el("stageWrap");
  ["dragenter", "dragover"].forEach((ev) => wrap.addEventListener(ev, (e) => {
    if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); wrap.classList.add("drag-over"); }
  }));
  ["dragleave", "drop"].forEach((ev) => wrap.addEventListener(ev, (e) => {
    if (ev === "dragleave" && wrap.contains(e.relatedTarget)) return;
    wrap.classList.remove("drag-over");
  }));
  wrap.addEventListener("drop", async (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) { imageMode = { mode: "add", layerId: null }; await handleImageFiles([...e.dataTransfer.files]); }
  });

  // Menü
  const menuPanel = el("menuPanel");
  el("btnMenu").addEventListener("click", (e) => { e.stopPropagation(); menuPanel.hidden = !menuPanel.hidden; });
  document.addEventListener("click", () => (menuPanel.hidden = true));
  menuPanel.addEventListener("click", (e) => e.stopPropagation());
  el("btnExport").addEventListener("click", async () => {
    menuPanel.hidden = true;
    const bundle = await S.exportDeck();
    const blob = new Blob([JSON.stringify(bundle)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: (state.deck.title || "praesentation").replace(/[^\w\-]+/g, "_") + ".wdeck.json" });
    a.click(); URL.revokeObjectURL(a.href);
  });
  el("btnExportHtml").addEventListener("click", () => { menuPanel.hidden = true; exportStandaloneHTML(state.deck, state.images); });
  el("btnImport").addEventListener("click", () => { menuPanel.hidden = true; el("fileImport").click(); });
  el("btnNewDeck").addEventListener("click", () => { menuPanel.hidden = true; if (confirm("Neue, leere Präsentation starten? Sie ersetzt die aktuelle Ansicht (vorher ggf. über das Backup-Menü sichern).")) S.newDeck(); });

  // Hilfe-Fenster
  const help = el("help");
  const closeHelp = () => (help.hidden = true);
  el("btnHelp").addEventListener("click", () => (help.hidden = false));
  el("helpClose").addEventListener("click", closeHelp);
  el("helpBackdrop").addEventListener("click", closeHelp);

  // Beispiel-Galerie
  const gallery = el("gallery");
  const closeGallery = () => (gallery.hidden = true);
  function renderGallery() {
    const grid = el("galleryGrid");
    grid.innerHTML = "";
    EXAMPLES.forEach((ex) => {
      const card = h("button", { class: "gcard" }, [
        h("div", { class: "gcard__banner", style: `background:${ex.grad}` }),
        h("div", { class: "gcard__body" }, [
          h("p", { class: "gcard__name", text: ex.name }),
          h("p", { class: "gcard__desc", text: ex.desc }),
        ]),
      ]);
      card.addEventListener("click", async () => {
        if (card.dataset.busy) return;
        card.dataset.busy = "1";
        card.querySelector(".gcard__body").appendChild(h("p", { class: "gcard__busy", text: "Lädt …" }));
        try {
          const deck = await ex.build();
          await S.loadDeckObject(deck);
          closeGallery();
        } catch (err) {
          alert("Beispiel konnte nicht geladen werden: " + err.message);
        } finally {
          delete card.dataset.busy;
        }
      });
      grid.appendChild(card);
    });
  }
  const openGallery = () => { renderGallery(); gallery.hidden = false; };
  el("btnGallery").addEventListener("click", () => { menuPanel.hidden = true; openGallery(); });
  el("galleryClose").addEventListener("click", closeGallery);
  el("galleryBackdrop").addEventListener("click", closeGallery);

  // Layout-Vorlagen (neue Folie)
  const layoutsM = el("layouts");
  const closeLayouts = () => (layoutsM.hidden = true);
  function renderLayouts() {
    const grid = el("layoutGrid");
    grid.innerHTML = "";
    LAYOUTS.forEach((lo) => {
      const prev = h("div", { class: "lcard__prev" });
      prev.appendChild(createStage({ style: lo.style, bg: lo.bg, layers: [], texts: lo.texts() }, () => null).root);
      const card = h("button", { class: "lcard" }, [prev, h("span", { class: "lcard__name", text: lo.name })]);
      card.addEventListener("click", () => { S.addSlideFromSpec(lo); closeLayouts(); });
      grid.appendChild(card);
    });
  }
  const openLayouts = () => { renderLayouts(); layoutsM.hidden = false; };
  el("layoutsClose").addEventListener("click", closeLayouts);
  el("layoutsBackdrop").addEventListener("click", closeLayouts);

  // Tastenkürzel im Editor
  document.addEventListener("keydown", (e) => {
    if (el("present").hidden === false) return; // Präsentation hat Vorrang
    if (!help.hidden) { if (e.key === "Escape") closeHelp(); return; } // Hilfe offen
    if (!gallery.hidden) { if (e.key === "Escape") closeGallery(); return; } // Galerie offen
    if (!layoutsM.hidden) { if (e.key === "Escape") closeLayouts(); return; } // Vorlagen offen
    const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === "Delete" || e.key === "Backspace") && state.sel.type && !typing) { e.preventDefault(); S.deleteSelected(); }
    if (e.key === "Escape") clearSel();
  });
}
