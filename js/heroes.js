/* ===================================================================
   heroes.js — Registry der auswählbaren 3D-Welt-Figuren (alle VRM).
   Leichtgewichtig (nur Daten), damit der Editor sie laden kann, ohne
   Three.js/three-vrm mitzuziehen. Dateien liegen in public/models/<file>.
   Pro Präsentation via deck.hero gewählt (Inspektor-Dropdown).
   =================================================================== */
// Shibu + Avatar A sind vorerst ausgeblendet (Dateien liegen weiter in
// public/models — zum Zurückholen einfach wieder eintragen):
//   { id: "shibu",   label: "Shibu (abeto-nah)", file: "shibu.vrm" },
//   { id: "avatarA", label: "Avatar A (casual)",  file: "avatar-a.vrm" },
export const HEROES = [
  { id: "avatarC", label: "Avatar C (Junge)", file: "avatar-c.vrm" },
  { id: "rainy",   label: "Rainy Devil",      file: "rainy-devil.vrm" },
  { id: "judge",   label: "Judgeman",         file: "judgeman.vrm" },
];

export const heroFile = (id) => (HEROES.find((h) => h.id === id) || HEROES[0]).file;
