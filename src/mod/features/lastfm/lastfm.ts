import { subscribeToTrackChanges, getProgress, isPlaying, type TrackMeta } from "~/mod/features/utils/player";
import { lastfm } from "./lastfm-api";

/**
 * Last.fm scrobbling — background logic.
 *
 * Storage keys:
 *   "lastfm/apiKey"
 *   "lastfm/secret"
 *   "lastfm/sessionKey"
 *   "lastfm/enabled"
 *
 * Scrobble rule (Last.fm convention): scrobble when the track has been played
 * for at least half its duration OR 4 minutes, whichever comes first. We poll
 * progress and fire once per track.
 */

let apiKey = "";
let secret = "";
let sessionKey = "";
let enabled = false;

let currentScrobbleId: string | null = null;
let scrobbledThisTrack = false;
let pollHandle: ReturnType<typeof setInterval> | null = null;
let unsubTrack: (() => void) | null = null;

window.yandexMusicMod.onStorageChanged((key: string, value: any) => {
  if (key === "lastfm/enabled") {
    enabled = value === true;
    if (enabled) start();
    else stop();
  }
  if (key === "lastfm/sessionKey") sessionKey = value || "";
  if (key === "lastfm/apiKey") apiKey = value || "";
  if (key === "lastfm/secret") secret = value || "";
});

(async () => {
  enabled = (await window.yandexMusicMod.getStorageValue("lastfm/enabled")) === true;
  apiKey = (await window.yandexMusicMod.getStorageValue("lastfm/apiKey")) || "";
  secret = (await window.yandexMusicMod.getStorageValue("lastfm/secret")) || "";
  sessionKey = (await window.yandexMusicMod.getStorageValue("lastfm/sessionKey")) || "";
  if (enabled) start();
})();

function start() {
  if (unsubTrack) return;
  unsubTrack = subscribeToTrackChanges((_prev, next) => onTrackChange(next));
  pollHandle = setInterval(maybeScrobble, 5000);
}

function stop() {
  if (unsubTrack) {
    unsubTrack();
    unsubTrack = null;
  }
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  currentScrobbleId = null;
  scrobbledThisTrack = false;
}

function onTrackChange(meta: TrackMeta) {
  if (currentScrobbleId === meta.id) return;
  currentScrobbleId = meta.id;
  scrobbledThisTrack = false;

  if (!enabled || !sessionKey || !apiKey) return;

  const artist = meta.artists?.[0]?.name ?? "Unknown";
  const track = meta.title ?? "Unknown";
  const album = meta.albums?.[0]?.title;

  lastfm.updateNowPlaying(apiKey, sessionKey, { artist, track, album, durationMs: meta.durationMs }).then((r) => {
    if (r.isErr()) console.warn("[lastfm] updateNowPlaying failed", r.error);
  });
}

function maybeScrobble() {
  if (!enabled || !sessionKey || !apiKey || !currentScrobbleId || scrobbledThisTrack) return;
  const playing = isPlaying();
  if (playing.isErr() || !playing.value) return;

  const progress = getProgress();
  if (progress.isErr()) return;

  const { duration, position } = progress.value;
  if (!duration || duration <= 0) return;

  const threshold = Math.min(duration / 2, 4 * 60);
  if (position >= threshold) {
    scrobbleCurrent();
  }
}

async function scrobbleCurrent() {
  const meta = await currentMeta();
  if (!meta) return;
  scrobbledThisTrack = true;

  const artist = meta.artists?.[0]?.name ?? "Unknown";
  const track = meta.title ?? "Unknown";
  const album = meta.albums?.[0]?.title;

  const r = await lastfm.scrobble(apiKey, sessionKey, {
    artist,
    track,
    album,
    timestamp: Math.floor(Date.now() / 1000),
    durationMs: meta.durationMs,
  });
  if (r.isErr()) {
    console.warn("[lastfm] scrobble failed", r.error);
    // allow retry on next poll
    scrobbledThisTrack = false;
  } else {
    console.log("[lastfm] scrobbled", artist, "—", track);
  }
}

async function currentMeta(): Promise<TrackMeta | null> {
  const { getTrackMeta } = await import("~/mod/features/utils/player");
  const r = getTrackMeta();
  return r.isOk() ? (r.value as TrackMeta) : null;
}
