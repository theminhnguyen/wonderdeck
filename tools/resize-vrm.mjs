// VRM-schonender Textur-Verkleinerer: verkleinert nur die eingebetteten Bilder
// (via macOS `sips`), lässt JSON inkl. VRM-Extension unangetastet. glb rein/raus.
// Nutzung: node _resize-vrm.mjs <in.vrm> <out.vrm> [maxSize=1024]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os"; import path from "node:path";

const [, , inPath, outPath, maxArg] = process.argv;
const MAX = parseInt(maxArg || "1024", 10);
const buf = fs.readFileSync(inPath);
if (buf.toString("ascii", 0, 4) !== "glTF") throw new Error("kein glb: " + inPath);
const jsonLen = buf.readUInt32LE(12);
const json = JSON.parse(buf.toString("utf8", 20, 20 + jsonLen));
let off = 20 + jsonLen;
let bin = Buffer.alloc(0);
if (off < buf.length) { const binLen = buf.readUInt32LE(off); bin = buf.subarray(off + 8, off + 8 + binLen); }

const bufferViews = json.bufferViews || [];
const images = json.images || [];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vrmimg-"));
const newImg = {}; // bufferViewIndex -> Buffer (resized)
let resized = 0;
for (const img of images) {
  if (img.bufferView == null) continue;
  const bv = bufferViews[img.bufferView];
  const bytes = bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  const ext = (img.mimeType || "image/png").includes("jpeg") ? "jpg" : (img.mimeType || "").includes("webp") ? "webp" : "png";
  const fin = path.join(tmp, "img_" + img.bufferView + "." + ext);
  fs.writeFileSync(fin, bytes);
  try {
    const g = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", fin]).toString();
    const w = +((/pixelWidth: (\d+)/.exec(g) || [])[1] || 0), h = +((/pixelHeight: (\d+)/.exec(g) || [])[1] || 0);
    if (Math.max(w, h) > MAX) { execFileSync("sips", ["-Z", String(MAX), fin]); resized++; }
  } catch (e) { /* Bild unverändert lassen */ }
  newImg[img.bufferView] = fs.readFileSync(fin);
}

// BIN neu packen: alle bufferViews in Index-Reihenfolge, 4-Byte-aligned
const align = (n) => (n + 3) & ~3;
const parts = []; let cursor = 0;
bufferViews.forEach((bv, i) => {
  const data = newImg[i] || bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength);
  const pad = align(cursor) - cursor; if (pad) { parts.push(Buffer.alloc(pad)); cursor += pad; }
  bv.byteOffset = cursor; bv.byteLength = data.length;
  parts.push(data); cursor += data.length;
});
let newBin = Buffer.concat(parts);
const bpad = align(newBin.length) - newBin.length; if (bpad) newBin = Buffer.concat([newBin, Buffer.alloc(bpad)]);
if (json.buffers && json.buffers[0]) json.buffers[0].byteLength = newBin.length;

let jsonBuf = Buffer.from(JSON.stringify(json), "utf8");
const jpad = align(jsonBuf.length) - jsonBuf.length; if (jpad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jpad, 0x20)]);
const header = Buffer.alloc(12); header.write("glTF", 0, "ascii"); header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonBuf.length + 8 + newBin.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(jsonBuf.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(newBin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
fs.writeFileSync(outPath, Buffer.concat([header, jh, jsonBuf, bh, newBin]));
console.log(path.basename(inPath) + " -> " + path.basename(outPath) + " | " + (buf.length / 1048576).toFixed(1) + "MB -> " + (fs.statSync(outPath).size / 1048576).toFixed(1) + "MB | " + resized + " Texturen verkleinert | VRM=" + (json.extensions && json.extensions.VRM ? "erhalten" : "FEHLT"));
