/* ===================================================================
   main.js — Startpunkt: Deck laden (oder Demo erzeugen), Editor starten.
   =================================================================== */
import { initDeck } from "./state.js";
import { init as initEditor } from "./editor.js";

async function boot() {
  try {
    await initDeck();
    initEditor();
    // Deep-Link: direkt in die Präsentation starten
    if (location.hash.includes("present") || new URLSearchParams(location.search).has("present")) {
      const [{ openPresent }, S] = await Promise.all([import("./present.js"), import("./state.js")]);
      openPresent(S.state.deck, S.srcOf, 0);
    }
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
