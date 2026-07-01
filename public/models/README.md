# 3D-Figuren (3D-Welt-Modus)

Auswählbare Figuren für die begehbare 3D-Welt. Alle im **VRM**-Format
(geladen via [`@pixiv/three-vrm`](https://github.com/pixiv/three-vrm)),
cel-shaded (MToon). Die Auswahl erfolgt **pro Präsentation** im Editor-Inspektor
(3D-Welt-Modus → Feld „Figur") und wird in `deck.hero` gespeichert.

Registry: [`js/heroes.js`](../../js/heroes.js). Geladen in `js/world.js` (App,
relativer Pfad) und gespiegelt in `js/export.js` (Standalone-Export, absolute
GitHub-Pages-URL). Bei Ladefehler greift die prozedurale Ersatz-Figur (`makeHero`).

| Datei | Figur | Stil | Lizenz |
|---|---|---|---|
| `shibu.vrm` | Sendagaya Shibu | dunkler Bob, Schul-Weste, oranger Akzent (abeto-nah) | CC0 |
| `avatar-a.vrm` | AvatarSample_A | casual: Cardigan, Top, Shorts | VRoid-Sample |
| `avatar-c.vrm` | AvatarSample_C | Junge: Sportjacke, Cargo-Hose | VRoid-Sample |
| `rainy-devil.vrm` | レイニーデビル (Rainy Devil) | gelber Regenmantel, leuchtende Augen | siehe Modell |
| `judgeman.vrm` | ジャッジマン (Judgeman) | schwarze Robe, weiße Maske | siehe Modell |

- **shibu.vrm**: CC0 (gemeinfrei), Quelle [github.com/madjin/vrm-samples](https://github.com/madjin/vrm-samples).
- **avatar-a / avatar-c**: offizielle VRoid-Sample-Avatare.
- **rainy-devil / judgeman**: vom Nutzer bereitgestellt — Nutzungsrechte gemäß
  der jeweils im Modell hinterlegten Lizenz.

**Optimiert:** Die Texturen sind auf max. 1024 px verkleinert (Ladezeit) — die
VRM-Struktur bleibt dabei erhalten. Standard-Tools wie `gltf-transform` verwerfen
die VRM-Extension; deshalb liegt ein VRM-schonender Verkleinerer bei:
`tools/resize-vrm.mjs` (macOS/`sips`). Nutzung:
`node tools/resize-vrm.mjs eingang.vrm ausgang.vrm 1024`.

**Eigene Figur ergänzen:** in [VRoid Studio](https://vroid.com/studio) (gratis)
bauen, als `.vrm` exportieren, (optional mit dem Resizer verkleinern), hier
ablegen und einen Eintrag in `js/heroes.js` (`{ id, label, file }`) hinzufügen —
erscheint automatisch im Dropdown.
