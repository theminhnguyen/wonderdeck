# WonderDeck ✦

Ein cinematisches **Präsentations-Tool** als PowerPoint-Alternative — komplett im
Browser, ohne Server, ohne Konto, gratis.

**Live:** https://theminhnguyen.github.io/wonderdeck/ ·
**Landing-Page:** https://theminhnguyen.github.io/wonderdeck/landing.html

Drei Präsentations-Modi pro Deck:

| Modus | Beschreibung |
|---|---|
| **▦ Folien** | Klassisches Deck mit Ebenen-Parallax, Maus-Effekten, Ken-Burns & gleitenden Übergängen |
| **🚶 Journey** | Folien werden Stationen auf einem durchlaufbaren 2.5D-Pfad |
| **🌐 3D-Welt** | Begehbares Open-Air-Museum (Three.js): eine wählbare Anime-Figur (VRM) läuft per Tastatur durch eine Galerie — Folien hängen als Tafeln, E öffnet Details |

## Lokal starten

```bash
cd wonderdeck
python3 -m http.server 8081
```

Dann öffnen: **http://localhost:8081**
(Wichtig: über den Server öffnen, nicht per Doppelklick — sonst blockiert der
Browser Module & Speicher.)

## Bedienung

- **Folie hinzufügen:** „+ Folie" öffnet die Layout-Vorlagen. **Duplizieren:**
  ⧉ an der Miniatur oder **⌘/Strg+D**. Reihenfolge per Drag-and-drop.
- **Rückgängig / Wiederherstellen:** **⌘/Strg+Z** · **Shift+⌘/Strg+Z**.
- **Bild einfügen:** aufs Bühnenfeld ziehen (oder „+ Bild-Ebene"). Kopierte
  PowerPoint-Folien/Bilder mit **⌘/Strg+V** als neue Folie einfügen.
  Jede Ebene: Parallax, Reaktiv, Ken-Burns, Größe, Deckkraft, Reihenfolge.
- **Text:** auf der Bühne direkt klicken und tippen; Art/Ausrichtung/Position rechts.
- **Modus & Theme:** rechts im Inspektor (deck-weit); in der 3D-Welt zusätzlich die **Figur**.
- **Präsentieren:** „▶"-Knopf (Beschriftung folgt dem Modus). Folien: Scrollen/
  Pfeile/Leertaste/Dots, **Esc** beendet. 3D-Welt: **WASD** gehen, **Shift** rennen,
  **Leertaste** springen, **E** Details, 🔊 Ambiente an/aus.
- **Speichern:** automatisch im Browser (IndexedDB), „✓ Gespeichert" bestätigt.
  Mehrere Präsentationen unter „☰ Menü → Meine Präsentationen".
- **Sichern & Teilen:** „☰ Menü" → `.wdeck.json` (Backup inkl. Bilder) oder
  **„Als Webseite exportieren"** — eine einzelne `.html`, die überall läuft
  (auch Journey & 3D-Welt).
- **Beispiele:** „☰ Menü → Beispiele" lädt fertige Decks nach Kategorien.

Deep-Links: `#present`, `?slide=N`, `?present=N`, `?example=KEY`, `#help`,
`#gallery`, `#layouts`, `#decks`.

## Aufbau (kein Build-Schritt, reine ES-Module)

```
wonderdeck/
├── index.html            Editor-Oberfläche (+ Import-Map für Three.js/VRM via CDN)
├── css/{stage,editor}.css
├── js/
│   ├── main.js           Start & Deep-Links
│   ├── db.js             IndexedDB (Decks + Bilder, GC für verwaiste Bilder)
│   ├── state.js          Datenmodell, Auto-Speichern, Undo/Redo-Verlauf
│   ├── stage.js          rendert eine Folie (geteilt: Editor/Thumbs/Präsentation)
│   ├── effects.js        Parallax, Intro, Ken-Burns, Übergänge
│   ├── present.js        Vollbild-Präsentationsmodus (+ Website-Kopfzeile)
│   ├── journey.js        2.5D-Journey-Modus
│   ├── world.js          3D-Welt (Three.js, VRM-Figur, Bloom, Ambiente)
│   ├── heroes.js         Registry der wählbaren 3D-Figuren
│   ├── editor.js         Editor-Logik (Leiste, Inspektor, Drag-and-drop, Shortcuts)
│   ├── export.js         Standalone-HTML-Export (alle 3 Modi)
│   ├── themes.js / layouts.js / examples.js / gfx.js / seed.js
├── public/models/        VRM-Figuren (CC0/Nutzer) + README mit Lizenzen
└── tools/resize-vrm.mjs  VRM-schonender Textur-Verkleinerer
```

Die 3D-Welt lädt Three.js + three-vrm **lazy** via CDN-Import-Map — erst beim
Betreten, der Editor bleibt leichtgewichtig.

## Kommerzielle Nutzung & Verkauf

- **Figuren-Lizenzen sind geprüft** (alle CC0 bzw. VRoid-Lizenz mit erlaubter
  kommerzieller Nutzung) — Nachweise in [`public/models/README.md`](public/models/README.md).
  Nicht-kommerzielle Modelle wurden entfernt.
- **Landing-Page:** [`landing.html`](landing.html) — Produktseite mit Live-Demo-Link
  („3D-Galerie aus deinen Bildern") und vorbereiteter Kauf-Sektion.
- **Kauf anschließen (wenn gewünscht):**
  1. Konto bei [Gumroad](https://gumroad.com) oder [Lemon Squeezy](https://lemonsqueezy.com)
     anlegen (kostenlos, nur prozentuale Gebühr pro Verkauf) und ein Produkt
     „WonderDeck Pro" erstellen.
  2. Die Produkt-URL in `landing.html` bei `const BUY_URL = ""` eintragen — der
     Kauf-Button erscheint automatisch.
  3. Vor dem ersten Verkauf: **Impressum & Datenschutzerklärung** ergänzen
     (Platzhalter im Footer der Landing-Page).
