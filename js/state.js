/* ===================================================================
   state.js — zentrale Datenhaltung + Auto-Speichern
   Mutationen laufen über commit(): benachrichtigt Listener und speichert
   debounced in IndexedDB.
   =================================================================== */
import * as db from "./db.js";
import { HEROES } from "./heroes.js";

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
    transition: "snap",    // Übergang ZU dieser Folie (snap|fade|slide|zoom|push)
    bg: "#0a1118",
    layers: [],
    texts: [createText("title")],
  };
}

export function createDeck(title = "Meine Präsentation") {
  return { id: uid(), title, theme: "aurum", nav: [], slides: [createSlide({ style: "wonder" })], createdAt: Date.now() };
}

/** Bestehende Decks um neue Felder ergänzen (Migration alter Stände). */
export function normalizeDeck(deck) {
  if (!deck) return deck;
  if (!deck.theme) deck.theme = "aurum";
  if (!deck.nav) deck.nav = [];
  if (!deck.navPos) deck.navPos = "top";
  if (!deck.mode) deck.mode = "deck"; // "deck" (Folien) | "journey" (durchlaufbare Welt)
  // Figur der 3D-Welt: fehlend ODER nicht (mehr) verfügbar → erste verfügbare
  if (!deck.hero || !HEROES.some((hh) => hh.id === deck.hero)) deck.hero = HEROES[0].id;
  (deck.slides || []).forEach((s) => { if (!s.transition) s.transition = "snap"; });
  return deck;
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

function doSave() {
  if (!state.deck) return;
  db.saveDeck(structuredClone(state.deck))
    .then(() => document.dispatchEvent(new CustomEvent("wd:saved")))
    .catch((e) => console.warn("Speichern fehlgeschlagen", e));
  localStorage.setItem("wonderdeck:currentDeckId", state.deck.id);
}
function autosave() {
  clearTimeout(state._saveTimer);
  state._saveTimer = setTimeout(doSave, 600);
}
/** Sofort speichern (z. B. beim Verlassen der Seite) — kein Warten aufs Debounce. */
export function flushSave() {
  if (!state._saveTimer) return;
  clearTimeout(state._saveTimer);
  state._saveTimer = null;
  doSave();
}

/* ---------- Undo / Redo (Snapshot-Verlauf des Decks) ---------- */
const H = { list: [], idx: -1, timer: null, MAX: 60 };
function snapshotNow() {
  if (!state.deck) return;
  const snap = JSON.stringify(state.deck);
  if (H.idx >= 0 && H.list[H.idx] === snap) return; // nichts geändert
  H.list = H.list.slice(0, H.idx + 1); // Redo-Zweig verwerfen
  H.list.push(snap);
  if (H.list.length > H.MAX) H.list.shift();
  H.idx = H.list.length - 1;
}
function resetHistory() { H.list = []; H.idx = -1; clearTimeout(H.timer); snapshotNow(); }
function restore(snap) {
  state.deck = normalizeDeck(JSON.parse(snap));
  state.current = Math.max(0, Math.min(state.current, state.deck.slides.length - 1));
  state.sel = { type: null, id: null };
  emit();
  autosave();
}
export function undo() {
  clearTimeout(H.timer); snapshotNow(); // laufende Text-Edits erst festhalten
  if (H.idx <= 0) return false;
  H.idx -= 1; restore(H.list[H.idx]); return true;
}
export function redo() {
  if (H.idx >= H.list.length - 1) return false;
  H.idx += 1; restore(H.list[H.idx]); return true;
}

/** Eine Änderung anwenden: neu rendern + speichern. */
export function commit({ save = true } = {}) {
  emit();
  if (save) { autosave(); snapshotNow(); }
}

/** Nur speichern (kein Re-Render) — für Live-Edits (Slider, Texteingabe).
    Verlauf wird gebündelt festgehalten (nach kurzer Tipp-Pause). */
export function touchSave() {
  autosave();
  clearTimeout(H.timer);
  H.timer = setTimeout(snapshotNow, 800);
}

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
  normalizeDeck(deck);
  state.deck = deck;
  state.images = await db.loadImagesForDeck(deck);
  state.current = 0;
  state.sel = { type: null, id: null };
  resetHistory();
  emit();
  autosave();
}

/** Ein fertig gebautes Deck (Bilder bereits in IDB) übernehmen & anzeigen. */
export async function loadDeckObject(deck) {
  normalizeDeck(deck);
  state.deck = deck;
  state.images = await db.loadImagesForDeck(deck);
  state.current = 0;
  state.sel = { type: null, id: null };
  resetHistory();
  emit();
}

export async function loadExample() {
  const { buildSeedDeck } = await import("./seed.js");
  await loadDeckObject(await buildSeedDeck());
}

export async function newDeck() {
  const deck = normalizeDeck(createDeck());
  state.deck = deck;
  state.images = {};
  state.current = 0;
  state.sel = { type: null, id: null };
  await db.saveDeck(structuredClone(deck));
  localStorage.setItem("wonderdeck:currentDeckId", deck.id);
  resetHistory();
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
  if (spec.ink) s.ink = spec.ink;
  s.texts = typeof spec.texts === "function" ? spec.texts() : (spec.texts || []);
  state.deck.slides.splice(state.current + 1, 0, s);
  state.current += 1;
  state.sel = { type: null, id: null };
  commit();
}

/** Neue Folie aus einem eingefügten/abgelegten Bild — Bild als vollflächige,
    flache Ebene (z. B. kopierte PowerPoint-Folie). Wird nach der aktuellen
    Folie eingefügt. */
export async function addSlideFromImage(dataURL, name = "Eingefügt") {
  const imageId = uid();
  await db.putImage(imageId, dataURL);
  state.images[imageId] = dataURL;
  const s = createSlide({ style: "snap" });
  s.bg = "#0a0e16";
  const layer = createLayer({ imageId, name });
  layer.parallax = 0; // importierte Folie soll flach/originalgetreu wirken
  s.layers = [layer];
  s.texts = [];
  state.deck.slides.splice(state.current + 1, 0, s);
  state.current += 1;
  state.sel = { type: "layer", id: layer.id };
  commit();
  return s;
}

export function deleteSlide(index) {
  if (state.deck.slides.length <= 1) return;
  state.deck.slides.splice(index, 1);
  state.current = Math.max(0, Math.min(state.current, state.deck.slides.length - 1));
  state.sel = { type: null, id: null };
  commit();
}
/** Folie duplizieren (mit frischen IDs; Bilder werden per imageId geteilt). */
export function duplicateSlide(index = state.current) {
  const src = state.deck.slides[index];
  if (!src) return;
  const copy = structuredClone(src);
  copy.id = uid();
  copy.layers.forEach((l) => (l.id = uid()));
  copy.texts.forEach((t) => (t.id = uid()));
  state.deck.slides.splice(index + 1, 0, copy);
  state.current = index + 1;
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
export function setSlideTransition(t) { curSlide().transition = t; commit(); }
export function setSlideBg(color) { curSlide().bg = color; commit(); }
export function setSlideInk(ink) { if (ink) curSlide().ink = ink; else delete curSlide().ink; commit(); }
export function setDeckTitle(title) { state.deck.title = title; commit(); }
export function setDeckTheme(key) { state.deck.theme = key; commit(); }

/* ---------- Navigation (Deck-Kopfzeile, wirkt wie Website-Nav) ---------- */
export function addNavItem() {
  if (!state.deck.nav) state.deck.nav = [];
  const first = state.deck.slides[0];
  state.deck.nav.push({ id: uid(), label: "Seite", type: "slide", target: first ? first.id : "" });
  commit();
}
export function updateNavItem(id, patch) {
  const it = (state.deck.nav || []).find((n) => n.id === id);
  if (it) Object.assign(it, patch);
  commit();
}
export function deleteNavItem(id) {
  state.deck.nav = (state.deck.nav || []).filter((n) => n.id !== id);
  commit();
}
export function setNavPos(pos) { state.deck.navPos = pos; commit(); }
export function setDeckMode(m) { state.deck.mode = m; commit(); }
export function setDeckHero(id) { state.deck.hero = id; commit(); }
export function setDeckBrand(text) { state.deck.brand = text; commit(); }
export async function setBrandImage(dataURL) {
  const imageId = uid();
  await db.putImage(imageId, dataURL);
  state.images[imageId] = dataURL;
  state.deck.brandImageId = imageId;
  commit();
}
export function clearBrandImage() { delete state.deck.brandImageId; commit(); }
export function setSlideHideNav(hide) { if (hide) curSlide().hideNav = true; else delete curSlide().hideNav; commit(); }

/* ---------- Präsentations-Bibliothek (mehrere Decks) ---------- */
export const listDecks = () => db.getAllDecks();
export async function openDeckById(id) {
  const d = await db.getDeck(id);
  if (d) await loadDeckObject(d);
  return d;
}
export async function renameDeckById(id, title) {
  if (state.deck && state.deck.id === id) { state.deck.title = title; commit(); }
  else { const d = await db.getDeck(id); if (d) { d.title = title; await db.saveDeck(d); } }
}
export async function deleteDeckById(id) {
  await db.deleteDeck(id);
  if (state.deck && state.deck.id === id) {
    const all = (await db.getAllDecks()).filter((x) => x.id !== id);
    if (all.length) await loadDeckObject(all[all.length - 1]);
    else await newDeck();
  }
  db.pruneImages().catch(() => {}); // verwaiste Bilder des gelöschten Decks aufräumen
}

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
  normalizeDeck(deck);
  for (const [id, data] of Object.entries(bundle.images || {})) {
    await db.putImage(id, data);
    state.images[id] = data;
  }
  state.deck = deck;
  state.current = 0;
  state.sel = { type: null, id: null };
  await db.saveDeck(structuredClone(deck));
  localStorage.setItem("wonderdeck:currentDeckId", deck.id);
  resetHistory();
  emit();
}
