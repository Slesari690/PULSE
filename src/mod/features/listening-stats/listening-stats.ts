import { subscribeToTrackChanges, isPlaying, getTrackMeta, type TrackMeta } from "~/mod/features/utils/player";

/**
 * Local listening statistics.
 *
 * Records a "play event" whenever a track has been listened to for at least 30
 * seconds (Last.fm's minimum scrobble threshold). Events are stored under
 * "stats/plays" as an array, capped at the most recent 2000 entries to keep
 * mod_settings.json from growing forever.
 *
 * The dashboard component (listening-stats.tsx) reads the same key and
 * aggregates it into "top this week".
 */

const MIN_LISTEN_SECONDS = 30;
const MAX_EVENTS = 2000;

interface PlayEvent {
  id: string;
  title: string;
  artist: string;
  ts: number; // epoch ms
}

let currentId: string | null = null;
let currentStartTs: number | null = null;
let pollHandle: ReturnType<typeof setInterval> | null = null;
let unsubTrack: (() => void) | null = null;

(async () => {
  unsubTrack = subscribeToTrackChanges((_prev, next) => onTrackChange(next));
  pollHandle = setInterval(checkCurrent, 5000);
})();

function onTrackChange(meta: TrackMeta) {
  // finalize previous track if it qualified
  if (currentId && currentStartTs !== null) {
    maybeRecord(currentId, currentStartTs, Date.now());
  }
  currentId = meta.id;
  currentStartTs = Date.now();
}

async function checkCurrent() {
  if (!currentId || currentStartTs === null) return;
  const playing = isPlaying();
  if (playing.isErr() || !playing.value) {
    // paused — keep start ts so resuming continues counting
    return;
  }
  // If the track has been playing long enough, record it now (once per track
  // is handled by recording only at the 30s boundary — but to avoid recording
  // multiple times, we record here only if not already recorded for this play.
  // Simpler: we record at track-change of the *next* track. Here we just make
  // sure we capture the duration if the user closes the app mid-track by
  // periodically persisting a "pending" record.
  const elapsed = (Date.now() - currentStartTs) / 1000;
  if (elapsed >= MIN_LISTEN_SECONDS) {
    // mark as listened by writing a pending event; dedup at record time
    await markPending(currentId, currentStartTs);
  }
}

async function markPending(id: string, startTs: number) {
  // We only want one event per (id, startTs) pair. Use a small pending set in storage.
  const pending = (await window.yandexMusicMod.getStorageValue("stats/pending")) || {};
  pending[id + ":" + startTs] = true;
  window.yandexMusicMod.setStorageValue("stats/pending", pending);
}

async function maybeRecord(id: string, startTs: number, endTs: number) {
  const elapsed = (endTs - startTs) / 1000;
  if (elapsed < MIN_LISTEN_SECONDS) return;

  const pending = (await window.yandexMusicMod.getStorageValue("stats/pending")) || {};
  const key = id + ":" + startTs;
  if (!pending[key]) {
    // not actually listened long enough (e.g. user skipped before 30s mark)
    return;
  }
  delete pending[key];
  window.yandexMusicMod.setStorageValue("stats/pending", pending);

  const meta = await getMetaById(id);
  const event: PlayEvent = {
    id,
    title: meta?.title ?? "Unknown",
    artist: meta?.artists?.[0]?.name ?? "Unknown",
    ts: startTs,
  };

  const events = ((await window.yandexMusicMod.getStorageValue("stats/plays")) || []) as PlayEvent[];
  events.push(event);
  // cap
  const trimmed = events.length > MAX_EVENTS ? events.slice(events.length - MAX_EVENTS) : events;
  window.yandexMusicMod.setStorageValue("stats/plays", trimmed);
}

async function getMetaById(id: string): Promise<TrackMeta | null> {
  const r = getTrackMeta();
  if (r.isOk() && (r.value as any).id === id) return r.value as TrackMeta;
  return null;
}
