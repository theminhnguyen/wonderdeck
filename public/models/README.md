# 3D-Figur (3D-Welt-Modus)

`hero.vrm` — die spielbare Anime-Figur der 3D-Welt.

- **Modell:** „Sendagaya Shibu" (VRoid-Sample-Avatar)
- **Format:** VRM 0.0 (geladen via [`@pixiv/three-vrm`](https://github.com/pixiv/three-vrm))
- **Lizenz:** **CC0** (gemeinfrei – frei nutzbar, auch kommerziell, keine Namensnennung nötig)
- **Quelle:** [github.com/madjin/vrm-samples](https://github.com/madjin/vrm-samples) (`vroid/beta/Sendagaya_Shibu.vrm`)

Geladen in `js/world.js` (App, relativer Pfad) und gespiegelt in `js/export.js`
(Standalone-Export, absolute GitHub-Pages-URL). Bei Ladefehler greift die
prozedurale Ersatz-Figur (`makeHero`).

**Eigene Figur einsetzen:** in [VRoid Studio](https://vroid.com/studio) (gratis)
eine Figur bauen, als `.vrm` exportieren, hier als `hero.vrm` ersetzen — fertig.
