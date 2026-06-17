/* ===================================================================
   state.js — zentrale Datenhaltung + Auto-Speichern
   Mutationen laufen über commit(): benachrichtigt Listener und speichert
   debounced in IndexedDB.
   =================================================================== */
import * as db from "./db.js";

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());

/* ---------- Modell-Fabriken ---------- */
export function createLayer({ imageId = null, name = "Ebene", src = null } = {}) {
  return {
    id: uid(),
    name,
    imageId,       // Verweis ins IndexedDB-images-Store
    src,           // optionale Direkt-URL (für Demo/Seed)
    parallax: 18,  // Maus-Parallax-Stärke (px)
    reactive: false, // weicht vom Cursor weg (wie Laub)
    scale: 1,      // Grundskalierung
    kenburns: 0,   // langsames Hineinzoomen beim Folienstart (0 = aus)
    opacity: 1,
  };
}

const TEXT_PRESETS = {
  kicker:   { role: "kicker",   text: "KAPITEL", x: 8, y: 30, w: 60, align: "left" },
  title:    { role: "title",    text: "Deine Überschrift", x: 8, y: 38, w: 64, align: "left" },
  subtitle: { role: "subtitle", text: "Ein kurzer, beschreibender Untertitel für diese Folie.", x: 8, y: 62, w: 46, align: "left" },
  body:     { role: "body",     text: "Hier steht dein Fließtext. Klicke, um ihn zu bearbeiten.", x: 8, y: 60, w: 44, align: "left" },
};
export function createText(role = "title") {
  const p = TEXT_PRESETS[role] || TEXT_PRESETS.title;
  return { id: uid(), ...p };
}

export function createSlide({ style = "snap" } = {}) {
  return {
    id: uid(),
    style,                 // "wonder" (maus-reaktiver Hero) | "snap" (Szene)
    bg: "#0a1118",
    layers: [],
    texts: [createText("title")],
  };
}

export function createDeck(title = "Meine Präsentation") {
  return { id: uid(), title, slides: [createSlide({ style: "wonder" })], createdAt: Date.now() };
}

/* ---------- State-Singleton ---------- */
export const state = {
  deck: null,
  images: {},            // id -> dataURL (Laufzeit-Cache)
  current: 0,            // aktiver Folien-Index
  sel: { type: null, id: null }, // Auswahl im Editor
  _listeners: new Set(),
  _saveTimer: null,
};

export function subscribe(fn) { state._listeners.add(fn); return () => state._listeners.delete(fn); }
function emit() { state._listeners.forEach((fn) => fn()); }

function autosave() {
  clearTimeout(state._saveTimer);
  state._saveTimer = setTimeout(() => {
    if (state.deck) {
      db.saveDeck(structuredClone(state.deck)).catch((e) => console.warn("Speichern fehlgeschlagen", e));
      localStorage.setItem("wonderdeck:currentDeckId", state.deck.id);
    }
  }, 600);
}

/** Eine Änderung anwenden: neu rendern + speichern. */
export function commit({ save = true } = {}) {
  emit();
  if (save) autosave();
}

/** Nur speichern (kein Re-Render) — für Live-Edits (Slider, Texteingabe). */
export function touchSave() { autosave(); }

/* ---------- Zugriffshelfer ---------- */
export const curSlide = () => state.deck.slides[state.current];
export const srcOf = (layer) => layer.src || state.images[layer.imageId] || null;
export function findLayer(id) { return curSlide().layers.find((l) => l.id === id); }
export function findText(id) { return curSlide().texts.find((t) => t.id === id); }

/* ---------- Deck laden / neu ---------- */
export async function initDeck() {
  const id = localStorage.getItem("wonderdeck:currentDeckId");
  let deck = id ? await db.getDeck(id) : null;
  if (!deck) {
    const all = await db.getAllDecks();
    deck = all && all.length ? all[all.length - 1] : null;
  }
  if (!deck) {
    const { buildSeedDeck } = await import("./seed.js");
    deck = await buildSeedDeck();
  }
  state.deck = deck;
  state.images = await db.loadImagesForDeck(deck);
  state.current = 0;
  state.sel = { type: null, id: null };
  emit();
  autosave();
}

/** Ein fertig gebautes Deck (Bilder bereits in IDB) übernehmen & anzeigen. */
export async function loadDeckObject(deck) {
  state.deck = deck;
  state.images = await db.loadImagesForDeck(deck);
  state.current = 0;
  state.sel = { type: null, id: null };
  emit();
}

export async function loadExample() {
  const { buildSeedDeck } = await import("./seed.js");
  await loadDeckObject(await buildSeedDeck());
}

export async function newDeck() {
  const deck = createDeck();
  state.deck = deck;
  state.images = {};
  state.current = 0;
  state.sel = { type: null, id: null };
  await db.saveDeck(structuredClone(deck));
  localStorage.setItem("wonderdeck:currentDeckId", deck.id);
  emit();
}

/* ---------- Folien-Mutationen ---------- */
export function addSlide(style = "snap") {
  const s = createSlide({ style });
  state.deck.slides.splice(state.current + 1, 0, s);
  state.current += 1;
  state.sel = { type: null, id: null };
  commit();
}
/** Neue Folie aus einer Layout-Vorlage einfügen. */
export function addSlideFromSpec(spec) {
  const s = createSlide({ style: spec.style || "snap" });
  if (spec.bg) s.bg = spec.bg;
  s.texts = typeof spec.texts === "function" ? spec.texts() : (spec.texts || []);
  state.deck.slides.splice(state.current + 1, 0, s);
  state.current += 1;
  state.sel = { type: null, id: null };
  commit();
}

export function deleteSlide(index) {
  if (state.deck.slides.length <= 1) return;
  state.deck.slides.splice(index, 1);
  state.current = Math.max(0, Math.min(state.current, state.deck.slides.length - 1));
  state.sel = { type: null, id: null };
  commit();
}
export function selectSlide(index) {
  state.current = index;
  state.sel = { type: null, id: null };
  commit({ save: false });
}
export function moveSlide(from, to) {
  const arr = state.deck.slides;
  if (to < 0 || to >= arr.length) return;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
  state.current = to;
  commit();
}
export function setSlideStyle(style) { curSlide().style = style; commit(); }
export function setSlideBg(color) { curSlide().bg = color; commit(); }
export function setDeckTitle(title) { state.deck.title = title; commit(); }

/* ---------- Ebenen-Mutationen ---------- */
export async function addImageLayer(dataURL, name = "Bild") {
  const imageId = uid();
  await db.putImage(imageId, dataURL);
  state.images[imageId] = dataURL;
  const layer = createLayer({ imageId, name });
  curSlide().layers.push(layer);
  state.sel = { type: "layer", id: layer.id };
  commit();
}
export async function replaceLayerImage(layerId, dataURL, name) {
  const layer = findLayer(layerId);
  if (!layer) return;
  const imageId = uid();
  await db.putImage(imageId, dataURL);
  state.images[imageId] = dataURL;
  layer.imageId = imageId;
  layer.src = null;
  if (name) layer.name = name;
  commit();
}
export function updateLayer(id, patch) { Object.assign(findLayer(id), patch); commit(); }
export function reorderLayer(id, dir) {
  const arr = curSlide().layers;
  const i = arr.findIndex((l) => l.id === id);
  const j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  commit();
}

/* ---------- Text-Mutationen ---------- */
export function addText(role = "body") {
  const t = createText(role);
  curSlide().texts.push(t);
  state.sel = { type: "text", id: t.id };
  commit();
}
export function updateText(id, patch) { Object.assign(findText(id), patch); commit(); }

/* ---------- Auswahl ---------- */
export function select(type, id) { state.sel = { type, id }; commit({ save: false }); }
export function clearSelection() { state.sel = { type: null, id: null }; commit({ save: false }); }
export function deleteSelected() {
  const { type, id } = state.sel;
  if (!type) return;
  const s = curSlide();
  if (type === "layer") s.layers = s.layers.filter((l) => l.id !== id);
  if (type === "text") s.texts = s.texts.filter((t) => t.id !== id);
  state.sel = { type: null, id: null };
  commit();
}

/* ---------- Backup Export / Import ---------- */
export async function exportDeck() {
  const deck = structuredClone(state.deck);
  const images = {};
  for (const slide of deck.slides)
    for (const layer of slide.layers)
      if (layer.imageId && state.images[layer.imageId]) images[layer.imageId] = state.images[layer.imageId];
  return { format: "wonderdeck", version: 1, deck, images };
}
export async function importDeck(bundle) {
  if (!bundle || bundle.format !== "wonderdeck" || !bundle.deck) throw new Error("Ungültige Datei");
  const deck = bundle.deck;
  deck.id = uid(); // neue id, um Kollisionen zu vermeiden
  for (const [id, data] of Object.entries(bundle.images || {})) {
    await db.putImage(id, data);
    state.images[id] = data;
  }
  state.deck = deck;
  state.current = 0;
  state.sel = { type: null, id: null };
  await db.saveDeck(structuredClone(deck));
  localStorage.setItem("wonderdeck:currentDeckId", deck.id);
  emit();
}
