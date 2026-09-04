/**
 * Playback speed & pitch control.
 *
 * Finds the Yandex Music <audio> element and applies the chosen playbackRate.
 * preservesPitch is toggled by the "preserve pitch" setting — when off, higher
 * speeds raise the pitch (chipmunk effect) and lower speeds deepen it.
 *
 * Storage:
 *   "playback-speed/rate"     — number 0.5..2.0 (default 1.0)
 *   "playback-speed/preserve" — boolean (default true)
 *
 * The audio element can be recreated by Yandex, so we re-apply on a poll and
 * whenever a new <audio> appears.
 */

let rate = 1.0;
let preserve = true;
let pollHandle: ReturnType<typeof setInterval> | null = null;
let lastAudio: HTMLAudioElement | null = null;

window.yandexMusicMod.onStorageChanged((key: string, value: any) => {
  if (key === "playback-speed/rate") {
    rate = typeof value === "number" ? value : 1.0;
    applyToCurrent();
  }
  if (key === "playback-speed/preserve") {
    preserve = value !== false;
    applyToCurrent();
  }
});

(async () => {
  rate = (await window.yandexMusicMod.getStorageValue("playback-speed/rate")) ?? 1.0;
  preserve = (await window.yandexMusicMod.getStorageValue("playback-speed/preserve")) !== false;
  pollHandle = setInterval(applyToCurrent, 1500);
  applyToCurrent();
})();

function applyToCurrent() {
  const audio = document.querySelector<HTMLAudioElement>("audio");
  if (!audio) return;
  if (audio !== lastAudio) {
    lastAudio = audio;
  }
  applyTo(audio);
}

function applyTo(audio: HTMLAudioElement) {
  // Only touch the rate if the user actually wants something other than 1.0,
  // to avoid interfering with normal playback when the feature is unused.
  if (rate !== 1.0) {
    audio.playbackRate = rate;
  }
  // preservesPitch is widely supported on desktop Chromium (Electron).
  try {
    (audio as any).preservesPitch = preserve;
  } catch {
    /* ignore */
  }
}
