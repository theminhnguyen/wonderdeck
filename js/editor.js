/* ===================================================================
   editor.js — Editor-Oberfläche: Folien-Leiste, Bühne, Inspektor,
   Drag-and-drop, Auswahl & Inline-Text-Bearbeitung.
   =================================================================== */
import * as S from "./state.js";
import { srcOf, curSlide, state } from "./state.js";
import { createStage } from "./stage.js";
import { openPresent } from "./present.js";
import { openJourney } from "./journey.js";
import { EXAMPLES, CATEGORIES } from "./examples.js";
import { LAYOUTS } from "./layouts.js";
import { exportStandaloneHTML } from "./export.js";
import { THEMES, applyTheme } from "./themes.js";
import { TRANSITIONS } from "./effects.js";
import { HEROES } from "./heroes.js";

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

/* Kurze Einblendung unten (Feedback z. B. nach Einfügen). */
let toastTimer = null;
function toast(msg) {
  let t = el("wdToast");
  if (!t) { t = h("div", { class: "wd-toast", id: "wdToast" }); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-on"), 2600);
}

let layerEls = {}; // id -> Ebenen-Element der aktuellen Bühne (für Live-Updates)
let imageMode = { mode: "add", layerId: null };
let deckList = []; // Cache aller Präsentationen (für Nav-Ziele & Bibliothek)
async function refreshDecks() { deckList = await S.listDecks(); }

/* =================== Render: alles =================== */
function renderAll() {
  applyTheme(document.body, state.deck.theme || "aurum");
  renderRail();
  renderStage();
  applyOutline();
  renderInspector();
  const title = el("deckTitle");
  if (document.activeElement !== title) title.value = state.deck.title;
  // Präsentieren-Button zeigt den Modus, damit klar ist, was passiert
  const mode = state.deck.mode || "deck";
  el("btnPresent").textContent = mode === "world" ? "▶ 3D-Welt betreten" : mode === "journey" ? "▶ Journey starten" : "▶ Präsentieren";
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

  // Nicht-interaktive Vorschau der Deck-Navigation (Kopfzeile)
  if ((state.deck.nav || []).length) {
    const np = h("div", { class: "wd-navpreview" }, [h("span", { class: "b", text: state.deck.title || "" })]);
    const l = h("div", { class: "l" });
    state.deck.nav.forEach((it) => l.appendChild(h("span", { text: it.label || "" })));
    np.appendChild(l);
    frame.appendChild(np);
  }

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

  // Modus: klassisches Folien-Deck vs. durchlaufbare Journey-Welt
  const modeSeg = h("div", { class: "seg" });
  [["deck", "▦ Folien"], ["journey", "🚶 Journey"], ["world", "🌐 3D-Welt"]].forEach(([val, lab]) =>
    modeSeg.appendChild(h("button", { class: (state.deck.mode || "deck") === val ? "is-on" : "", text: lab, onclick: () => S.setDeckMode(val) })));
  sec.appendChild(field("Modus", modeSeg));
  if ((state.deck.mode || "deck") === "journey")
    sec.appendChild(h("p", { class: "insp-empty", text: "Journey: Folien werden zu Stationen auf einem Pfad. Stil, Übergang & Kopfzeile haben hier keine Wirkung." }));
  if ((state.deck.mode || "deck") === "world") {
    sec.appendChild(h("p", { class: "insp-empty", text: "3D-Welt: Folien werden zu Ausstellungs-Tafeln in einer begehbaren Galerie (WASD/Maus, am Handy Joystick). Nah herangehen + E/Tippen öffnet die Details." }));
    const hsel = h("select", { onchange: (e) => S.setDeckHero(e.target.value) });
    HEROES.forEach((hh) =>
      hsel.appendChild(h("option", { value: hh.id, ...((state.deck.hero || "shibu") === hh.id ? { selected: "selected" } : {}), text: hh.label })));
    sec.appendChild(field("Figur", hsel));
  }

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

function navSection() {
  const sec = h("div", { class: "insp-section" }, [h("h3", { text: "Navigation (Kopfzeile)" })]);
  const nav = state.deck.nav || [];

  // Marke (Text oder Logo) + Position der Kopfzeile
  sec.appendChild(field("Marke (Text)", h("input", { type: "text", value: state.deck.brand || "", placeholder: state.deck.title || "Titel", oninput: (e) => { state.deck.brand = e.target.value; S.touchSave(); } })));
  sec.appendChild(field("Logo statt Text", h("div", { class: "row" }, [
    h("button", { class: "btn", text: state.deck.brandImageId ? "Logo ersetzen" : "Logo hochladen", onclick: () => { imageMode = { mode: "brand", layerId: null }; el("fileImage").click(); } }),
    state.deck.brandImageId ? h("button", { class: "btn btn-danger", text: "Entfernen", onclick: () => S.clearBrandImage() }) : null,
  ])));
  const posSeg = h("div", { class: "seg" });
  [["top", "Oben"], ["bottom", "Unten"]].forEach(([val, lab]) =>
    posSeg.appendChild(h("button", { class: (state.deck.navPos || "top") === val ? "is-on" : "", text: lab, onclick: () => S.setNavPos(val) })));
  sec.appendChild(field("Position", posSeg));

  if (!nav.length)
    sec.appendChild(h("p", { class: "insp-empty", text: "Noch keine Einträge. Klick auf einen Eintrag springt zur Folie, öffnet einen Link oder eine andere Präsentation." }));
  nav.forEach((item) => {
    const row = h("div", { class: "navrow" });
    row.appendChild(h("input", { type: "text", value: item.label, placeholder: "Text (z. B. About me)", oninput: (e) => { item.label = e.target.value; S.touchSave(); } }));
    const sel = h("select", {
      onchange: (e) => {
        const v = e.target.value;
        if (v === "__url__") S.updateNavItem(item.id, { type: "url", target: item.type === "url" ? item.target : "https://" });
        else if (v === "__text__") S.updateNavItem(item.id, { type: "text", target: item.type === "text" ? item.target : "Kurzer Hinweistext." });
        else if (v.indexOf("deck:") === 0) S.updateNavItem(item.id, { type: "deck", target: v.slice(5) });
        else S.updateNavItem(item.id, { type: "slide", target: v });
      },
    });
    state.deck.slides.forEach((s, i) => {
      const ttl = (s.texts.find((x) => x.role === "title") || {}).text || "";
      const lab = "→ Folie " + (i + 1) + (ttl ? " · " + ttl.replace(/\n/g, " ").slice(0, 16) : "");
      sel.appendChild(h("option", { value: s.id, ...(item.type === "slide" && item.target === s.id ? { selected: "selected" } : {}), text: lab }));
    });
    sel.appendChild(h("option", { value: "__url__", ...(item.type === "url" ? { selected: "selected" } : {}), text: "🔗 Externer Link" }));
    sel.appendChild(h("option", { value: "__text__", ...(item.type === "text" ? { selected: "selected" } : {}), text: "💬 Kurztext (Popover)" }));
    deckList.filter((d) => d.id !== state.deck.id).forEach((d) =>
      sel.appendChild(h("option", { value: "deck:" + d.id, ...(item.type === "deck" && item.target === d.id ? { selected: "selected" } : {}), text: "📑 " + (d.title || "Präsentation") })));
    row.appendChild(sel);
    row.appendChild(h("button", { class: "navrow__del", text: "✕", title: "Eintrag löschen", onclick: () => S.deleteNavItem(item.id) }));
    sec.appendChild(row);
    if (item.type === "url")
      sec.appendChild(h("div", { class: "field" }, [h("input", { type: "text", value: item.target || "", placeholder: "https://…", oninput: (e) => { item.target = e.target.value; S.touchSave(); } })]));
    if (item.type === "text")
      sec.appendChild(h("div", { class: "field" }, [h("textarea", { placeholder: "Text, der bei Klick erscheint …", oninput: (e) => { item.target = e.target.value; S.touchSave(); } }, item.target || "")]));
  });
  sec.appendChild(h("button", { class: "btn btn-block", text: "+ Navigations-Eintrag", onclick: () => S.addNavItem() }));
  return sec;
}

function renderInspector() {
  const insp = el("inspector");
  insp.innerHTML = "";
  insp.appendChild(deckSection());
  // Website-Kopfzeile gibt es nur im klassischen Folien-Modus (Journey/3D-Welt zeigen keine Nav).
  if ((state.deck.mode || "deck") === "deck") insp.appendChild(navSection());
  insp.appendChild(slideSection());
  if (state.sel.type === "layer") insp.appendChild(layerSection(S.findLayer(state.sel.id)));
  else if (state.sel.type === "text") insp.appendChild(textSection(S.findText(state.sel.id)));
  else insp.appendChild(h("p", { class: "insp-empty", text: "Tipp: Klicke eine Ebene oder einen Text auf der Bühne an, um sie zu bearbeiten. Bilder ziehst du einfach auf die Bühne." }));
}

function slideSection() {
  const slide = curSlide();
  const mode = state.deck.mode || "deck";
  const sec = h("div", { class: "insp-section" }, [h("h3", { text: "Folie" })]);

  // Stil — nur im Folien-Modus wirksam (Journey/3D-Welt ignorieren ihn).
  if (mode === "deck") {
    const seg = h("div", { class: "seg" });
    ["wonder", "snap"].forEach((st) => {
      seg.appendChild(h("button", {
        class: slide.style === st ? "is-on" : "",
        text: st === "wonder" ? "✦ Wonder" : "▦ Snap",
        onclick: () => S.setSlideStyle(st),
      }));
    });
    sec.appendChild(field("Stil dieser Folie", seg));
  }

  // Hintergrundfarbe (wirkt in allen Modi: hinter Ebenen / als Tafel-Hintergrund)
  sec.appendChild(field("Hintergrundfarbe (hinter Ebenen)",
    h("input", { type: "color", value: slide.bg || "#0a1118", oninput: (e) => S.setSlideBg(e.target.value) })));

  // Übergang zu dieser Folie — nur im Folien-Modus.
  if (mode === "deck") {
    const tsel = h("select", { onchange: (e) => S.setSlideTransition(e.target.value) });
    TRANSITIONS.forEach((tr) =>
      tsel.appendChild(h("option", { value: tr.key, ...((slide.transition || "snap") === tr.key ? { selected: "selected" } : {}), text: tr.name })));
    sec.appendChild(field("Übergang zu dieser Folie", tsel));
  }

  // Textfarbe dieser Folie (überschreibt das Theme) — Folien- & Journey-Modus.
  if (mode !== "world") {
    const inkSeg = h("div", { class: "seg" });
    const curInk = slide.ink || "auto";
    [["auto", "Auto"], ["#f4f1ea", "Hell"], ["#1a1a1a", "Dunkel"]].forEach(([val, lab]) =>
      inkSeg.appendChild(h("button", { class: curInk === val ? "is-on" : "", text: lab, onclick: () => S.setSlideInk(val === "auto" ? null : val) })));
    sec.appendChild(field("Textfarbe (diese Folie)", inkSeg));
  }

  // Kopfzeile auf dieser Folie ausblenden — nur im Folien-Modus (nur dort gibt es eine Kopfzeile).
  if (mode === "deck") {
    sec.appendChild(field(null, h("label", { class: "toggle" }, [
      h("input", { type: "checkbox", ...(slide.hideNav ? { checked: "checked" } : {}), onchange: (e) => S.setSlideHideNav(e.target.checked) }),
      "Kopfzeile auf dieser Folie ausblenden",
    ])));
  }

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
  const mode = state.deck.mode || "deck";
  const sec = h("div", { class: "insp-section" }, [h("h3", { text: "Bild-Ebene" })]);
  sec.appendChild(field("Name", h("input", {
    type: "text", value: layer.name,
    oninput: (e) => { layer.name = e.target.value; S.touchSave(); },
  })));
  sec.appendChild(field("Bild",
    h("button", { class: "btn btn-block", text: "⭯ Bild ersetzen", onclick: () => { imageMode = { mode: "replace", layerId: layer.id }; el("fileImage").click(); } })));

  // Parallax/Zoom/Reaktiv wirken nur im Folien-Modus (Journey/3D-Welt nutzen
  // nur das Bild selbst). Sonst hier ausblenden, damit keine toten Regler entstehen.
  if (mode === "deck") {
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
  } else {
    sec.appendChild(h("p", { class: "insp-empty", text: mode === "world" ? "In der 3D-Welt wird dieses Bild als Tafel gezeigt. Parallax/Zoom/Reaktiv haben hier keine Wirkung." : "Im Journey-Modus wird dieses Bild als Station gezeigt. Parallax/Zoom/Reaktiv haben hier keine Wirkung." }));
  }

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

  const mode = state.deck.mode || "deck";
  // Ausrichtung wirkt im Folien- & Journey-Modus (3D-Welt setzt Text fest).
  if (mode !== "world") {
    const seg = h("div", { class: "seg" });
    [["left", "⫷"], ["center", "≡"], ["right", "⫸"]].forEach(([v, sym]) =>
      seg.appendChild(h("button", { class: t.align === v ? "is-on" : "", text: sym, onclick: () => S.updateText(t.id, { align: v }) })));
    sec.appendChild(field("Ausrichtung", seg));
  }

  // Freie Position/Breite nur im Folien-Modus (Journey/3D-Welt setzen Text automatisch).
  if (mode === "deck") {
    sec.appendChild(slider("Position X", t.x, 0, 92, 1, (v) => { t.x = v; const n = el("stageFrame").querySelector(`.wd-text[data-id="${t.id}"]`); if (n) n.style.left = v + "%"; S.touchSave(); }, (v) => v + "%"));
    sec.appendChild(slider("Position Y", t.y, 0, 92, 1, (v) => { t.y = v; const n = el("stageFrame").querySelector(`.wd-text[data-id="${t.id}"]`); if (n) n.style.top = v + "%"; S.touchSave(); }, (v) => v + "%"));
    sec.appendChild(slider("Breite", t.w, 15, 92, 1, (v) => { t.w = v; const n = el("stageFrame").querySelector(`.wd-text[data-id="${t.id}"]`); if (n) n.style.width = v + "%"; S.touchSave(); }, (v) => v + "%"));
  } else {
    sec.appendChild(h("p", { class: "insp-empty", text: "Position & Breite werden in diesem Modus automatisch gesetzt." }));
  }

  sec.appendChild(h("button", { class: "btn btn-block btn-danger", text: "Text löschen", onclick: () => S.deleteSelected() }));
  return sec;
}

/* =================== Bilder hinzufügen =================== */
async function handleImageFiles(files) {
  for (const f of files) {
    if (!f.type.startsWith("image/")) continue;
    const data = await readFile(f);
    const name = f.name.replace(/\.[^.]+$/, "");
    if (imageMode.mode === "brand") {
      await S.setBrandImage(data);
      imageMode = { mode: "add", layerId: null };
      break;
    } else if (imageMode.mode === "replace" && imageMode.layerId) {
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
  const present = (idx) => {
    if (state.deck.mode === "world") import("./world.js?v=" + Date.now()).then((m) => m.openWorld(state.deck, srcOf, () => {}));
    else if (state.deck.mode === "journey") openJourney(state.deck, srcOf, () => {});
    else openPresent(state.deck, srcOf, idx == null ? state.current : idx, (i) => S.selectSlide(i), onDeckNav);
  };
  async function onDeckNav(deckId) { const d = await S.openDeckById(deckId); if (d) present(0); }
  el("btnPresent").addEventListener("click", () => present());

  // File-Inputs
  el("fileImage").addEventListener("change", async (e) => { await handleImageFiles([...e.target.files]); e.target.value = ""; });
  el("fileImport").addEventListener("change", async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try { await S.importDeck(JSON.parse(await f.text())); }
    catch (err) { alert("Konnte Datei nicht laden: " + err.message); }
  });

  // Einfügen (Cmd/Strg+V): kopierte PowerPoint-Folie oder ein Bild aus der
  // Zwischenablage wird als NEUE Folie eingefügt (Bild als vollflächige Ebene).
  document.addEventListener("paste", async (e) => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable)) return; // Text normal einfügen
    if (!el("present").hidden || !el("journey").hidden || !el("world").hidden) return; // nicht während Präsentation
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const files = [];
    for (const it of items) if (it.type && it.type.indexOf("image/") === 0) { const f = it.getAsFile(); if (f) files.push(f); }
    if (!files.length) return;
    e.preventDefault();
    let count = 0;
    for (const f of files) { try { await S.addSlideFromImage(await readFile(f), "Eingefügte Folie"); count++; } catch (err) { console.error(err); } }
    if (count) toast(count === 1 ? "Folie aus Zwischenablage eingefügt." : count + " Folien eingefügt.");
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
  function makeCard(ex) {
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
    return card;
  }
  function renderGallery() {
    const grid = el("galleryGrid");
    grid.innerHTML = "";
    // Nach Kategorien gruppiert; unbekannte Kategorien landen am Ende.
    const groups = CATEGORIES.map((c) => ({ cat: c, items: EXAMPLES.filter((e) => e.cat === c.key) }))
      .filter((g) => g.items.length);
    const known = new Set(CATEGORIES.map((c) => c.key));
    const rest = EXAMPLES.filter((e) => !known.has(e.cat));
    if (rest.length) groups.push({ cat: { name: "Weitere", desc: "" }, items: rest });
    groups.forEach((g) => {
      grid.appendChild(h("div", { class: "gcat" }, [
        h("h3", { class: "gcat__name", text: g.cat.name }),
        g.cat.desc ? h("p", { class: "gcat__desc", text: g.cat.desc }) : null,
      ]));
      const row = h("div", { class: "gcat__grid" });
      g.items.forEach((ex) => row.appendChild(makeCard(ex)));
      grid.appendChild(row);
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
      prev.appendChild(createStage({ style: lo.style, bg: lo.bg, ink: lo.ink, layers: [], texts: lo.texts() }, () => null).root);
      const card = h("button", { class: "lcard" }, [prev, h("span", { class: "lcard__name", text: lo.name })]);
      card.addEventListener("click", () => { S.addSlideFromSpec(lo); closeLayouts(); });
      grid.appendChild(card);
    });
  }
  const openLayouts = () => { renderLayouts(); layoutsM.hidden = false; };
  el("layoutsClose").addEventListener("click", closeLayouts);
  el("layoutsBackdrop").addEventListener("click", closeLayouts);

  // Präsentations-Bibliothek (mehrere Decks)
  const decksM = el("decks");
  const closeDecks = () => (decksM.hidden = true);
  async function renderDecks() {
    await refreshDecks();
    const grid = el("decksGrid");
    grid.innerHTML = "";
    deckList.slice().reverse().forEach((d) => {
      const card = h("div", { class: "dcard" + (d.id === state.deck.id ? " is-current" : "") });
      card.appendChild(h("div", { class: "dcard__prev", style: `background:${(d.slides && d.slides[0] && d.slides[0].bg) || "#11151c"}` }));
      card.appendChild(h("div", { class: "dcard__body" }, [h("p", { class: "dcard__name", text: (d.title || "Ohne Titel") + " · " + (d.slides ? d.slides.length : 0) + " Folien" })]));
      card.appendChild(h("div", { class: "dcard__acts" }, [
        h("button", { class: "chip", text: "Öffnen", onclick: async () => { await S.openDeckById(d.id); closeDecks(); } }),
        h("button", { class: "chip", text: "Umben.", onclick: async () => { const t = prompt("Neuer Titel:", d.title || ""); if (t != null) { await S.renameDeckById(d.id, t); renderDecks(); } } }),
        h("button", { class: "chip", text: "Löschen", onclick: async () => { if (confirm("Präsentation löschen? (nicht umkehrbar)")) { await S.deleteDeckById(d.id); renderDecks(); } } }),
      ]));
      grid.appendChild(card);
    });
  }
  const openDecks = () => { renderDecks(); decksM.hidden = false; };
  el("btnDecks").addEventListener("click", () => { menuPanel.hidden = true; openDecks(); });
  el("decksClose").addEventListener("click", closeDecks);
  el("decksBackdrop").addEventListener("click", closeDecks);
  refreshDecks(); // Deck-Liste für Nav-Ziele vorladen

  // Tastenkürzel im Editor
  document.addEventListener("keydown", (e) => {
    if (el("present").hidden === false) return; // Präsentation hat Vorrang
    if (!help.hidden) { if (e.key === "Escape") closeHelp(); return; } // Hilfe offen
    if (!gallery.hidden) { if (e.key === "Escape") closeGallery(); return; } // Galerie offen
    if (!layoutsM.hidden) { if (e.key === "Escape") closeLayouts(); return; } // Vorlagen offen
    if (!decksM.hidden) { if (e.key === "Escape") closeDecks(); return; } // Bibliothek offen
    const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) || document.activeElement.isContentEditable;
    if ((e.key === "Delete" || e.key === "Backspace") && state.sel.type && !typing) { e.preventDefault(); S.deleteSelected(); }
    if (e.key === "Escape") clearSel();
  });
}
