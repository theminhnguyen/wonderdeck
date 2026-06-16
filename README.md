# WonderDeck ✦

Ein cinematisches **Präsentations-Tool** als PowerPoint-Alternative — komplett im
Browser, ohne Server, ohne Konto, gratis. Erstelle Folien im **Wonder**-Stil
(maus-reaktiver Hero) oder **Snap**-Stil (Szene), zieh Bilder per Drag-and-drop
in volle Ebenen-Kontrolle und präsentiere im Vollbild mit gleitenden Übergängen.

## Lokal starten

```bash
cd ~/Desktop/wonderdeck
python3 -m http.server 8081
```

Dann im Browser öffnen: **http://localhost:8081**
(Wichtig: über den Server öffnen, nicht per Doppelklick — sonst blockiert der
Browser Module & Speicher.)

## Bedienung

- **Folie hinzufügen:** Knopf oben oder „+ Folie hinzufügen" links.
- **Bild einfügen:** Bild einfach **auf die Bühne ziehen** (oder „+ Bild-Ebene").
  Jede Ebene hat Parallax, reaktiv-Schalter, langsamen Zoom (Ken-Burns), Größe,
  Deckkraft und Reihenfolge.
- **Text:** Auf der Bühne **direkt klicken und tippen**. Rechts Art (Kicker/Titel/
  Untertitel/Fließtext), Ausrichtung und Position einstellen.
- **Stil pro Folie:** rechts „Wonder" (Maus-Effekt, starker Zoom) oder „Snap" (Szene).
- **Präsentieren:** Knopf „▶ Präsentieren". Weiter mit **Scrollen, Pfeiltasten,
  Leertaste, Klick auf die Punkte** oder Wischen. **Esc** beendet.
  Direkt-Start: `…/index.html#present`.
- **Speichern:** passiert **automatisch im Browser** (IndexedDB).
- **Backup:** Menü „Backup" → „Als Datei sichern" / „Datei laden" (eine `.wdeck.json`
  inkl. Bilder, zum Sichern & Weitergeben).

## Aufbau (kein Build-Schritt, reine ES-Module)

```
wonderdeck/
├── index.html            Editor-Oberfläche
├── css/{stage,editor}.css
└── js/
    ├── main.js           Start
    ├── db.js             IndexedDB (Folien + Bilder)
    ├── state.js          Datenmodell + Auto-Speichern
    ├── seed.js           Demo-Präsentation beim ersten Start
    ├── stage.js          rendert eine Folie (geteilt)
    ├── effects.js        Parallax, Intro, Ken-Burns, Snap-Übergang
    ├── present.js        Vollbild-Präsentationsmodus
    └── editor.js         Editor-Logik (Leiste, Inspektor, Drag-and-drop)
```
