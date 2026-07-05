/* ===================================================================
   main.js — Startpunkt: Deck laden (oder Demo erzeugen), Editor starten.
   Deep-Links: #present / ?present=N (Präsentation), ?slide=N (Folie),
   #help (Hilfe öffnen).
   =================================================================== */
import { initDeck, selectSlide, state, srcOf, loadDeckObject, flushSave } from "./state.js";
import { init as initEditor } from "./editor.js";
import { openPresent } from "./present.js";
import { openJourney } from "./journey.js";
import { EXAMPLES } from "./examples.js";

async function boot() {
  try {
    await initDeck();
    initEditor();

    const params = new URLSearchParams(location.search);
    const exKey = params.get("example");
    if (exKey) {
      const found = EXAMPLES.find((e) => e.key === exKey);
      if (found) await loadDeckObject(await found.build());
    }
    const n = parseInt(params.get("slide") || params.get("present") || "", 10);
    const start = Number.isFinite(n) ? Math.max(0, Math.min(n, state.deck.slides.length - 1)) : 0;
    if (params.has("slide")) selectSlide(start);
    if (location.hash.includes("help")) document.getElementById("help").hidden = false;
    if (location.hash.includes("gallery")) document.getElementById("btnGallery").click();
    if (location.hash.includes("layouts")) document.getElementById("btnAddSlide").click();
    if (location.hash.includes("decks")) document.getElementById("btnDecks").click();
    if (location.hash.includes("present") || params.has("present")) {
      if (state.deck.mode === "world") import("./world.js?v=" + Date.now()).then((m) => m.openWorld(state.deck, srcOf, null));
      else if (state.deck.mode === "journey") openJourney(state.deck, srcOf, null, start);
      else openPresent(state.deck, srcOf, start);
    }
    // Beim Verlassen/Verstecken der Seite ausstehende Änderungen sofort sichern
    // (Autosave ist debounced — ohne das ginge die letzte Änderung ggf. verloren).
    window.addEventListener("pagehide", flushSave);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });
  } catch (err) {
    console.error("WonderDeck-Start fehlgeschlagen:", err);
    document.body.innerHTML =
      '<div style="color:#eef2f7;font-family:sans-serif;padding:40px;max-width:600px;line-height:1.6">' +
      "<h2>Hoppla — Start fehlgeschlagen.</h2><p>Bitte die Seite über einen lokalen Server öffnen " +
      "(nicht per Doppelklick als <code>file://</code>), da der Browser sonst Module &amp; Speicher blockiert.</p>" +
      "<pre style='color:#ff9a8a;white-space:pre-wrap'>" + (err && err.message) + "</pre></div>";
  }
}
boot();
