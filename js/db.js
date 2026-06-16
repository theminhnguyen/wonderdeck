/* ===================================================================
   db.js — IndexedDB-Schicht
   Zwei Stores:
     - "decks"  : Folien-Daten (ohne Bilddaten, nur imageId-Verweise)
     - "images" : Bilder als Data-URL, per id referenziert
   So bleibt das Auto-Speichern der Folien klein & schnell.
   =================================================================== */

const DB_NAME = "wonderdeck";
const DB_VERSION = 1;
let _db = null;

function open() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("decks")) db.createObjectStore("decks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("images")) db.createObjectStore("images");
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let result;
        Promise.resolve(fn(s)).then((r) => (result = r));
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function reqP(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ---------- Decks ---------- */
export const saveDeck = (deck) => tx("decks", "readwrite", (s) => s.put(deck));
export const getDeck = (id) => tx("decks", "readonly", (s) => reqP(s.get(id)));
export const getAllDecks = () => tx("decks", "readonly", (s) => reqP(s.getAll()));

/* ---------- Images ---------- */
export const putImage = (id, dataURL) => tx("images", "readwrite", (s) => s.put(dataURL, id));
export const getImage = (id) => tx("images", "readonly", (s) => reqP(s.get(id)));
export const deleteImage = (id) => tx("images", "readwrite", (s) => s.delete(id));

/** Lädt alle Bilder, die in einem Deck referenziert sind, als { id: dataURL }. */
export async function loadImagesForDeck(deck) {
  const ids = new Set();
  for (const slide of deck.slides || [])
    for (const layer of slide.layers || []) if (layer.imageId) ids.add(layer.imageId);
  const map = {};
  await Promise.all(
    [...ids].map(async (id) => {
      const data = await getImage(id);
      if (data) map[id] = data;
    })
  );
  return map;
}

/** Räumt Bilder weg, die kein Deck mehr referenziert (einfacher GC). */
export async function pruneImages(deck) {
  const used = new Set();
  for (const slide of deck.slides || [])
    for (const layer of slide.layers || []) if (layer.imageId) used.add(layer.imageId);
  const all = await tx("images", "readonly", (s) => reqP(s.getAllKeys()));
  await Promise.all(all.filter((k) => !used.has(k)).map((k) => deleteImage(k)));
}
