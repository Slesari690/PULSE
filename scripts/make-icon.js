/**
 * Writes a Windows ICO with 16/32/48/256 BMP images.
 * Violet rounded mark + letter P — no external deps.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function drawIcon(size) {
  const data = Buffer.alloc(size * size * 4, 0);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  };
  const s = size;
  const cx = (s - 1) / 2;
  const cy = (s - 1) / 2;
  const radius = s * 0.42;
  const inner = s * 0.34;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= radius + 0.5) {
        const t = Math.min(1, (d / radius) * 0.35);
        const r = Math.round(124 + (34 - 124) * t);
        const g = Math.round(92 + (211 - 92) * t);
        const b = Math.round(252 + (238 - 252) * t);
        const edge = Math.max(0, Math.min(1, radius + 0.7 - d));
        set(x, y, r, g, b, Math.round(255 * edge));
      }
    }
  }

  // Letter P as a simple block glyph
  const ox = Math.round(s * 0.32);
  const oy = Math.round(s * 0.22);
  const stemW = Math.max(2, Math.round(s * 0.14));
  const stemH = Math.round(s * 0.56);
  const bowlH = Math.round(s * 0.28);
  const bowlW = Math.round(s * 0.28);
  for (let y = oy; y < oy + stemH; y++) {
    for (let x = ox; x < ox + stemW; x++) set(x, y, 11, 11, 20, 255);
  }
  for (let y = oy; y < oy + stemW; y++) {
    for (let x = ox; x < ox + bowlW; x++) set(x, y, 11, 11, 20, 255);
  }
  for (let y = oy + bowlH - stemW; y < oy + bowlH; y++) {
    for (let x = ox; x < ox + bowlW; x++) set(x, y, 11, 11, 20, 255);
  }
  for (let y = oy; y < oy + bowlH; y++) {
    for (let x = ox + bowlW - stemW; x < ox + bowlW; x++) set(x, y, 11, 11, 20, 255);
  }

  void inner;
  return data;
}

function rgbaToIcoBmp(rgba, size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(0, 16);
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const srcY = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const si = (srcY * size + x) * 4;
      const di = (y * size + x) * 4;
      xor[di] = rgba[si + 2];
      xor[di + 1] = rgba[si + 1];
      xor[di + 2] = rgba[si];
      xor[di + 3] = rgba[si + 3];
    }
  }
  const maskRow = Math.ceil(size / 32) * 4;
  const mask = Buffer.alloc(maskRow * size, 0);
  return Buffer.concat([header, xor, mask]);
}

function buildIco(sizes) {
  const images = sizes.map((size) => ({ size, bmp: rgbaToIcoBmp(drawIcon(size), size) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = [];
  const blobs = [];
  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 0);
    entry.writeUInt8(img.size >= 256 ? 0 : img.size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.bmp.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += img.bmp.length;
    entries.push(entry);
    blobs.push(img.bmp);
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}

const outDir = path.resolve(__dirname, "..", "branding");
fs.mkdirSync(outDir, { recursive: true });
const ico = buildIco([16, 32, 48, 256]);
const icoPath = path.join(outDir, "pulse-icon.ico");
fs.writeFileSync(icoPath, ico);
console.log("wrote", icoPath, ico.length);
