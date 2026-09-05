import { subscribeToTrackChanges, type TrackMeta } from "~/mod/features/utils/player";

/**
 * Ambient theme: extracts the dominant color from the current track's cover
 * art and feeds it into the custom-themes accent + palette CSS variables, so
 * the whole UI gently shifts to match the playing track (à la Spotify).
 *
 * Reuses the same CSS variables that custom-themes.ts sets
 * (--yandexMusicModAccent + --yandexMusicModPalette-*), so it composes with
 * the existing theming system instead of fighting it.
 *
 * Toggle: storage key "ambient-theme/enabled".
 */

const STYLE_ID = "yandex-music-mod-ambient-theme-style";
const POLL_FOR_COVER_MS = 1500;
const MAX_POLL_ATTEMPTS = 20; // give up after ~30s if the cover never loads

let enabled = false;
let currentAccent = "#4A9EFF";
let unsub: (() => void) | null = null;

window.yandexMusicMod?.onStorageChanged((key: string, value: any) => {
  if (key === "ambient-theme/enabled") {
    enabled = value === true;
    if (enabled) start();
    else stop();
  }
});

(async () => {
  enabled = (await window.yandexMusicMod.getStorageValue("ambient-theme/enabled")) === true;
  if (enabled) start();
})();

function start() {
  if (unsub) return;
  unsub = subscribeToTrackChanges((_prev, next) => {
    applyCoverColor(next).catch((e) => console.warn("[ambient-theme] cover color failed", e));
  });
}

function stop() {
  if (unsub) {
    unsub();
    unsub = null;
  }
  document.getElementById(STYLE_ID)?.remove();
}

function coverUrlFor(meta: TrackMeta): string | null {
  const uri = meta.coverUri || meta.albums?.[0]?.coverUri || (meta as any).ogImage;
  if (!uri || typeof uri !== "string") return null;
  return `https://${uri.replaceAll("%%", "orig")}`;
}

async function applyCoverColor(meta: TrackMeta) {
  const url = coverUrlFor(meta);
  if (!url) return;

  const color = await extractDominantColor(url);
  if (!color) return;

  currentAccent = color;
  applyAccent(color);
}

/** Load the cover into an offscreen canvas and pick the most saturated, well-lit pixel bucket. */
async function extractDominantColor(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    const loaded = await new Promise<boolean>((resolve) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        if (img.complete && img.naturalWidth > 0) return resolve(true);
        if (attempts > MAX_POLL_ATTEMPTS) return resolve(false);
        setTimeout(check, POLL_FOR_COVER_MS / 3);
      };
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      check();
    });
    if (!loaded) return null;

    const size = 32; // downscale for speed
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);

    // Bucket colors by quantizing to 4 bits per channel, weighting toward
    // saturated & mid-luminance pixels (avoids washed-out whites / pure black).
    const buckets = new Map<number, { count: number; r: number; g: number; b: number; weight: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      if (a < 128) continue;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = (max + min) / 2;
      const sat = max === 0 ? 0 : (max - min) / max;
      // skip near-white / near-black
      if (lum > 235 || lum < 18) continue;
      // weight = saturation * (1 - |lum-128|/128), squared for emphasis
      const lumWeight = 1 - Math.abs(lum - 128) / 128;
      const weight = (sat * 0.7 + lumWeight * 0.3) ** 2 + 0.01;

      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const entry = buckets.get(key);
      if (entry) {
        entry.count++;
        entry.weight += weight;
        entry.r += r * weight;
        entry.g += g * weight;
        entry.b += b * weight;
      } else {
        buckets.set(key, { count: 1, r: r * weight, g: g * weight, b: b * weight, weight });
      }
    }

    if (buckets.size === 0) return null;

    let best: { weight: number; r: number; g: number; b: number } | null = null;
    for (const e of buckets.values()) {
      if (!best || e.weight > best.weight) {
        best = { weight: e.weight, r: e.r / e.weight, g: e.g / e.weight, b: e.b / e.weight };
      }
    }
    if (!best) return null;

    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return rgbToHex(clamp(best.r), clamp(best.g), clamp(best.b));
  } catch (e) {
    console.warn("[ambient-theme] extractDominantColor error", e);
    return null;
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Build a small palette from the accent (lighter/darker shades) and inject as CSS vars. */
function applyAccent(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const palette = {
    50: shade(r, g, b, 0.92),
    100: shade(r, g, b, 0.8),
    200: shade(r, g, b, 0.66),
    300: shade(r, g, b, 0.5),
    400: shade(r, g, b, 0.34),
    500: hex,
    600: shade(r, g, b, -0.1),
    700: shade(r, g, b, -0.25),
    light: shade(r, g, b, 0.85),
    "light-300": shade(r, g, b, 0.7),
  };

  let css = `:root { --yandexMusicModAccent: ${hex};`;
  for (const [k, v] of Object.entries(palette)) {
    css += ` --yandexMusicModPalette-${k}: ${v};`;
  }
  css += `}`;

  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.innerHTML = css;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

/** amt > 0 lightens toward white, amt < 0 darkens toward black. */
function shade(r: number, g: number, b: number, amt: number): string {
  const mix = (c: number) => {
    if (amt >= 0) return Math.round(c + (255 - c) * amt);
    return Math.round(c * (1 + amt));
  };
  return rgbToHex(mix(r), mix(g), mix(b));
}
