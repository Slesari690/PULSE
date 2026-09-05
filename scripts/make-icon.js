/**
 * Draws the PULSE mark and writes branding/pulse-icon.png plus a Windows
 * branding/pulse-icon.ico with 16/24/32/48/64/128/256 frames.
 *
 * Everything is rendered from normalized coordinates, so each icon size is
 * drawn at its own resolution instead of being downscaled from one bitmap.
 * No external dependencies: PNG and ICO are encoded by hand.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BACKGROUND = [12, 14, 23];
const GRADIENT_TOP = [169, 112, 247];
const GRADIENT_BOTTOM = [37, 232, 245];
const CORNER_RADIUS = 0.223;

const LETTER_TOP = 0.18;
const LETTER_BOTTOM = 0.805;
const STEM_LEFT = 0.281;
const STEM_RIGHT = 0.44;
const BOWL_CENTER_X = 0.6;
const BOWL_CENTER_Y = 0.3855;
const BOWL_OUTER = 0.2055;
const BOWL_INNER = 0.12;

function insideRoundedSquare(x, y) {
  const r = CORNER_RADIUS;
  const dx = Math.abs(x - 0.5) - (0.5 - r);
  const dy = Math.abs(y - 0.5) - (0.5 - r);
  if (dx <= 0 && dy <= 0) return true;
  if (dx <= 0) return dy <= r;
  if (dy <= 0) return dx <= r;
  return dx * dx + dy * dy <= r * r;
}

function insideLetter(x, y) {
  if (x >= STEM_LEFT && x <= STEM_RIGHT && y >= LETTER_TOP && y <= LETTER_BOTTOM) return true;

  const bowlTop = LETTER_TOP;
  const bowlBottom = BOWL_CENTER_Y + BOWL_OUTER;
  if (y < bowlTop || y > bowlBottom || x < STEM_RIGHT) return false;

  const holeTop = BOWL_CENTER_Y - BOWL_INNER;
  const holeBottom = BOWL_CENTER_Y + BOWL_INNER;

  if (x <= BOWL_CENTER_X) {
    return !(y > holeTop && y < holeBottom);
  }

  const dx = x - BOWL_CENTER_X;
  const dy = y - BOWL_CENTER_Y;
  const d = Math.sqrt(dx * dx + dy * dy);
  return d <= BOWL_OUTER && d >= BOWL_INNER;
}

function letterColor(y) {
  const t = Math.min(1, Math.max(0, (y - LETTER_TOP) / (LETTER_BOTTOM - LETTER_TOP)));
  // Eased so the violet half stays readable at small sizes.
  const e = t * t * (3 - 2 * t);
  return [
    Math.round(GRADIENT_TOP[0] + (GRADIENT_BOTTOM[0] - GRADIENT_TOP[0]) * e),
    Math.round(GRADIENT_TOP[1] + (GRADIENT_BOTTOM[1] - GRADIENT_TOP[1]) * e),
    Math.round(GRADIENT_TOP[2] + (GRADIENT_BOTTOM[2] - GRADIENT_TOP[2]) * e),
  ];
}

/** Coverage of a shape inside one pixel, sampled on a grid. */
function coverage(shape, px, py, step, samples) {
  let hits = 0;
  for (let sy = 0; sy < samples; sy++) {
    for (let sx = 0; sx < samples; sx++) {
      const x = px + ((sx + 0.5) / samples) * step;
      const y = py + ((sy + 0.5) / samples) * step;
      if (shape(x, y)) hits++;
    }
  }
  return hits / (samples * samples);
}

function blur(mask, size, radius) {
  if (radius < 1) return mask;
  const horizontal = new Float32Array(size * size);
  const output = new Float32Array(size * size);
  const window = radius * 2 + 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.min(size - 1, Math.max(0, x + k));
        sum += mask[y * size + sx];
      }
      horizontal[y * size + x] = sum / window;
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.min(size - 1, Math.max(0, y + k));
        sum += horizontal[sy * size + x];
      }
      output[y * size + x] = sum / window;
    }
  }

  return output;
}

function render(size) {
  const step = 1 / size;
  const samples = size <= 48 ? 6 : 4;

  const plate = new Float32Array(size * size);
  const letter = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x * step;
      const py = y * step;
      const i = y * size + x;
      plate[i] = coverage(insideRoundedSquare, px, py, step, samples);
      letter[i] = plate[i] > 0 ? coverage(insideLetter, px, py, step, samples) : 0;
    }
  }

  const glow = blur(letter, size, Math.max(1, Math.round(size * 0.035)));
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const [lr, lg, lb] = letterColor(y * step);

      // Background plate, lifted slightly by the glow bleeding out of the mark.
      const halo = Math.min(1, glow[i] * 1.35) * 0.55;
      let r = BACKGROUND[0] + (lr - BACKGROUND[0]) * halo * 0.45;
      let g = BACKGROUND[1] + (lg - BACKGROUND[1]) * halo * 0.45;
      let b = BACKGROUND[2] + (lb - BACKGROUND[2]) * halo * 0.45;

      const mark = letter[i];
      r = r + (lr - r) * mark;
      g = g + (lg - g) * mark;
      b = b + (lb - b) * mark;

      const o = i * 4;
      rgba[o] = Math.round(Math.min(255, r));
      rgba[o + 1] = Math.round(Math.min(255, g));
      rgba[o + 2] = Math.round(Math.min(255, b));
      rgba[o + 3] = Math.round(plate[i] * 255);
    }
  }

  return rgba;
}

/* ---------- PNG ---------- */

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgba, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------- ICO ---------- */

function icoFrame(rgba, size) {
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // colour data + mask
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);

  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const source = size - 1 - y; // ICO stores rows bottom-up
    for (let x = 0; x < size; x++) {
      const si = (source * size + x) * 4;
      const di = (y * size + x) * 4;
      pixels[di] = rgba[si + 2];
      pixels[di + 1] = rgba[si + 1];
      pixels[di + 2] = rgba[si];
      pixels[di + 3] = rgba[si + 3];
    }
  }

  const maskStride = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, pixels, Buffer.alloc(maskStride * size, 0)]);
}

function encodeIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);

  let offset = 6 + frames.length * 16;
  const entries = [];
  const blobs = [];

  for (const frame of frames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(frame.size >= 256 ? 0 : frame.size, 0);
    entry.writeUInt8(frame.size >= 256 ? 0 : frame.size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(frame.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += frame.data.length;
    entries.push(entry);
    blobs.push(frame.data);
  }

  return Buffer.concat([header, ...entries, ...blobs]);
}

/* ---------- Вывод ---------- */

const outDir = path.resolve(__dirname, "..", "branding");
fs.mkdirSync(outDir, { recursive: true });

const pngPath = path.join(outDir, "pulse-icon.png");
fs.writeFileSync(pngPath, encodePng(render(512), 512));
console.log("wrote", pngPath);

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const frames = icoSizes.map((size) => ({ size, data: icoFrame(render(size), size) }));
const icoPath = path.join(outDir, "pulse-icon.ico");
fs.writeFileSync(icoPath, encodeIco(frames));
console.log("wrote", icoPath, icoSizes.join("/"));
