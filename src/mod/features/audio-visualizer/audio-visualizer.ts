import { isPlaying } from "~/mod/features/utils/player";

/**
 * Audio visualizer: hooks the Yandex Music <audio> element into a Web Audio
 * AnalyserNode and draws a frequency-bar overlay above the player bar.
 *
 * Toggle: storage key "audio-visualizer/enabled".
 * Style:  storage key "audio-visualizer/style" ("bars" | "wave" | "mirror").
 *
 * Notes:
 * - createMediaElementSource() can only be called ONCE per element, so we
 *   cache the source per audio element and reuse it.
 * - The AudioContext must be resumed after a user gesture; we resume it on
 *   the first play event we observe.
 */

const CANVAS_ID = "yandex-music-mod-visualizer-canvas";
const PLAYER_SELECTOR = 'section[data-test-id="PLAYERBAR_DESKTOP"]';

let enabled = false;
let style: "bars" | "wave" | "mirror" = "bars";
let raf = 0;
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let currentAudio: HTMLAudioElement | null = null;
let pollHandle: ReturnType<typeof setInterval> | null = null;

window.yandexMusicMod?.onStorageChanged((key: string, value: any) => {
  if (key === "audio-visualizer/enabled") {
    enabled = value === true;
    if (enabled) start();
    else stop();
  }
  if (key === "audio-visualizer/style") {
    style = (value as typeof style) || "bars";
  }
});

(async () => {
  enabled = (await window.yandexMusicMod.getStorageValue("audio-visualizer/enabled")) === true;
  style = ((await window.yandexMusicMod.getStorageValue("audio-visualizer/style")) as typeof style) || "bars";
  if (enabled) start();
})();

function start() {
  ensureCanvas();
  if (pollHandle) return;
  pollHandle = setInterval(tryHook, 1500);
  tryHook();
  raf = requestAnimationFrame(draw);
}

function stop() {
  cancelAnimationFrame(raf);
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  const canvas = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null;
  if (canvas) canvas.style.display = "none";
}

/** Find the Yandex <audio> element and wire it up (once). */
function tryHook() {
  if (!enabled) return;
  if (sourceNode && currentAudio && !currentAudio.isConnected) {
    // audio element was replaced by Yandex — re-hook
    sourceNode = null;
    analyser = null;
    currentAudio = null;
  }
  if (sourceNode) return;

  const nodes = Array.from(document.querySelectorAll<HTMLMediaElement>("audio,video"));
  const audio = (nodes.find((el) => el && !el.paused && !el.ended) || nodes[0]) as HTMLAudioElement | undefined;
  if (!audio) return;

  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    sourceNode = audioCtx.createMediaElementSource(audio);
    sourceNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    currentAudio = audio;
    console.log("[audio-visualizer] hooked audio element");
  } catch (e) {
    // most likely "already connected" — fine, ignore
    console.warn("[audio-visualizer] hook failed", e);
    sourceNode = null;
    analyser = null;
    currentAudio = null;
  }
}

function ensureCanvas() {
  let canvas = document.getElementById(CANVAS_ID) as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = CANVAS_ID;
    canvas.style.cssText =
      "position:fixed;left:0;bottom:0;width:100%;height:64px;pointer-events:none;z-index:9999;mix-blend-mode:screen;opacity:0.85;";
    document.body.appendChild(canvas);
  }
  canvas.style.display = enabled ? "block" : "none";
  return canvas;
}

function draw() {
  raf = requestAnimationFrame(draw);
  if (!enabled || !analyser) return;

  const canvas = ensureCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // size canvas to device pixels
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = 64;
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.height = cssH + "px";
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const bins = analyser.frequencyBinCount;
  const data = new Uint8Array(bins);
  analyser.getByteFrequencyData(data);

  // resume context if needed (autoplay policy)
  if (audioCtx && audioCtx.state === "suspended" && isPlaying().isOk()) {
    audioCtx.resume().catch(() => {});
  }

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--yandexMusicModAccent").trim() || "#4A9EFF";
  ctx.fillStyle = accent;
  ctx.strokeStyle = accent;

  if (style === "wave") {
    analyser.getByteTimeDomainData(data);
    ctx.lineWidth = 2;
    ctx.beginPath();
    const slice = cssW / bins;
    for (let i = 0; i < bins; i++) {
      const v = data[i]! / 128.0;
      const y = (v * cssH) / 2;
      const x = i * slice;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    return;
  }

  const barCount = style === "mirror" ? 64 : 48;
  const step = Math.floor(bins / barCount);
  const barW = cssW / barCount;
  for (let i = 0; i < barCount; i++) {
    const v = data[i * step]! / 255;
    const h = v * cssH;
    if (style === "mirror") {
      const x = i * barW;
      ctx.fillRect(x, cssH / 2 - h / 2, barW - 1, h);
    } else {
      const x = i * barW;
      ctx.fillRect(x, cssH - h, barW - 1, h);
    }
  }
}

// @ts-ignore
window.__pulseVisualizer = {
  start: () => {
    enabled = true;
    start();
    audioCtx?.resume?.().catch(() => {});
  },
  stop: () => {
    enabled = false;
    stop();
  },
};
