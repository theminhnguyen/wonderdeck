# 3D-Figuren (3D-Welt-Modus)

Auswählbare Figuren für die begehbare 3D-Welt. Alle im **VRM**-Format
(geladen via [`@pixiv/three-vrm`](https://github.com/pixiv/three-vrm)),
cel-shaded (MToon). Auswahl **pro Präsentation** im Editor-Inspektor
(3D-Welt-Modus → „Figur"), gespeichert in `deck.hero`. Registry: [`js/heroes.js`](../../js/heroes.js).

## Lizenzen (kommerzielle Nutzung geprüft ✅)

Die Lizenz ist bei VRM **in der Datei selbst hinterlegt** (`extensions.VRM.meta`).
Stand der Prüfung: 2026-06-24, per Auslesen der eingebetteten Metadaten.

| Datei | Figur | Lizenz | Kommerziell | Weitergabe | Nachweis |
|---|---|---|---|---|---|
| `avatar-c.vrm` | AvatarSample_C (VRoid Project) | VRoid-Lizenz | ✅ erlaubt (auch Firmen) | ✅ erlaubt | [Lizenz-URL](https://hub.vroid.com/license?allowed_to_use_user=everyone&characterization_allowed_user=everyone&corporate_commercial_use=allow&credit=unnecessary&modification=allow&personal_commercial_use=profit&redistribution=allow&sexual_expression=allow&version=1&violent_expression=allow) |
| `shino.vrm` | Sendagaya Shino | **CC0** | ✅ | ✅ | Meta: `licenseName: CC0`, `commercialUssageName: Allow` |
| `vita.vrm` | Vita | **CC0** | ✅ | ✅ | Meta: `licenseName: CC0`, `commercialUssageName: Allow` |
| `shibu.vrm` *(ausgeblendet)* | Sendagaya Shibu | **CC0** | ✅ | ✅ | Meta: CC0 / Allow |
| `avatar-a.vrm` *(ausgeblendet)* | AvatarSample_A (VRoid Project) | VRoid-Lizenz | ✅ erlaubt (auch Firmen) | ✅ erlaubt | wie AvatarSample_C |

**Entfernt (2026-06-24):** „Rainy Devil" und „Judgeman" (Autor: Mujo Moroyuki) —
deren VRoid-Lizenz verbietet kommerzielle Nutzung **und** Weitergabe
(`corporate_commercial_use=disallow`, `redistribution=disallow`). Sie wurden aus
App und Repo entfernt; bestehende Decks fallen automatisch auf Avatar C zurück.

Quellen: [madjin/vrm-samples](https://github.com/madjin/vrm-samples) (VRoid-Beta-Samples).

## Technisches

- Texturen auf max. 1024 px verkleinert (Ladezeit) — **VRM-schonend** via
  [`tools/resize-vrm.mjs`](../../tools/resize-vrm.mjs) (Standard-Tools wie
  gltf-transform verwerfen die VRM-Extension!).
  Nutzung: `node tools/resize-vrm.mjs eingang.vrm ausgang.vrm 1024`
- Lizenz-Metadaten einer VRM prüfen:
  die Datei ist ein glb — JSON-Chunk lesen, `extensions.VRM.meta.commercialUssageName`
  muss `Allow` sein, `redistribution` in der `otherPermissionUrl` beachten.

**Eigene Figur ergänzen:** in [VRoid Studio](https://vroid.com/studio) (gratis)
bauen, als `.vrm` exportieren (eigene Figuren gehören dir), optional verkleinern,
hier ablegen + Eintrag in `js/heroes.js` — erscheint automatisch im Dropdown.
