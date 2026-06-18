/* ===================================================================
   themes.js — Deck-weite Farb-/Schrift-Themes.
   Setzt CSS-Variablen (--accent, --font-title, --font-body, --ink),
   die von .wd-text gelesen werden. Gilt für Editor, Präsentation & Export.
   =================================================================== */

export const THEMES = [
  { key: "aurum",     name: "Aurum",     accent: "#c9a25b", fontTitle: '"Playfair Display",Georgia,serif',   fontBody: '"Inter",sans-serif',   ink: "#f6efe6" },
  { key: "coral",     name: "Coral",     accent: "#ff6f61", fontTitle: '"Playfair Display",Georgia,serif',   fontBody: '"Inter",sans-serif',   ink: "#fbeee9" },
  { key: "sky",       name: "Sky",       accent: "#5aa6ff", fontTitle: '"Space Grotesk",sans-serif',         fontBody: '"Inter",sans-serif',   ink: "#eef4ff" },
  { key: "mint",      name: "Mint",      accent: "#3fd6a0", fontTitle: '"Space Grotesk",sans-serif',         fontBody: '"Inter",sans-serif',   ink: "#eafff6" },
  { key: "editorial", name: "Editorial", accent: "#e6c068", fontTitle: '"Cormorant Garamond",Georgia,serif', fontBody: '"Inter",sans-serif',   ink: "#f4efe6" },
  { key: "mono",      name: "Mono",      accent: "#ffffff", fontTitle: '"Space Grotesk",sans-serif',         fontBody: '"DM Sans",sans-serif', ink: "#f4f6f8" },
  { key: "swiss",     name: "Swiss",     accent: "#d6452f", fontTitle: '"Bricolage Grotesque","Inter",sans-serif', fontBody: '"Inter",sans-serif', ink: "#f4f1ea" },
  // E.ON Expert Services — Markenfarben aus dem .potx-Master.
  // "EON Brix Sans" zuerst (rendert echt auf E.ON-Geräten), sonst DM Sans.
  { key: "eon",         name: "E.ON Rot",     accent: "#ea1b0a", fontTitle: '"EON Brix Sans","DM Sans",sans-serif', fontBody: '"EON Brix Sans","DM Sans",sans-serif', ink: "#ffffff" },
  { key: "eon-magenta", name: "E.ON Magenta", accent: "#ab3f98", fontTitle: '"EON Brix Sans","DM Sans",sans-serif', fontBody: '"EON Brix Sans","DM Sans",sans-serif', ink: "#ffffff" },
];

export function themeVars(key) {
  const t = THEMES.find((x) => x.key === key) || THEMES[0];
  return { "--accent": t.accent, "--font-title": t.fontTitle, "--font-body": t.fontBody, "--ink": t.ink };
}

/** Theme-Variablen auf ein Element setzen (vererbt sich an alle .wd-text). */
export function applyTheme(elm, key) {
  const v = themeVars(key);
  for (const k in v) elm.style.setProperty(k, v[k]);
}
