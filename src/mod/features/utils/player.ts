import { searchProperty } from "./react-fiber-search.js";
import { z } from "zod";
import { ok, err, Result } from "neverthrow";
import * as Sentry from "@sentry/react";

const PLAYER_SELECTOR =
  'section[data-test-id="PLAYERBAR_DESKTOP"], [class*="PlayerBarDesktop"], [class*="VibeDesktopPlayer"], [class*="PlayerBar"]';
const PLAY_BUTTON_SELECTOR = 'button[data-test-id="PLAY_BUTTON"]';
const PAUSE_BUTTON_SELECTOR = 'button[data-test-id="PAUSE_BUTTON"]';

let hasAdsInPlayer = false;

export function isPlaying(): Result<boolean, string> {
  const player = document.querySelector(PLAYER_SELECTOR);
  if (!player) {
    return err("Player element not found in DOM");
  }

  const playButton = player.querySelector(PLAY_BUTTON_SELECTOR);
  const pauseButton = player.querySelector(PAUSE_BUTTON_SELECTOR);

  if (!pauseButton && !playButton) {
    return err("Neither pause nor play button found in player");
  }

  // If pause button exists, the player is currently playing
  return ok(!!pauseButton);
}

export function getProgress(): Result<{ duration: number; progress: number; position: number }, string> {
  const player = document.querySelector(PLAYER_SELECTOR);
  if (!player) {
    return err("Player element not found in DOM");
  }

  const fiber = searchProperty(player, "timecodeClassName") || searchProperty(player, "currentTimecodeClassName");
  if (!fiber) {
    return err("Fiber not found");
  }

  const validatedFiber = z
    .object({
      duration: z.float64(),
      position: z.float64(),
      progress: z.float64(),
    })
    .safeParse(fiber);

  if (validatedFiber.error) {
    return err(`Validation error: ${validatedFiber.error.message}`);
  }

  return ok({
    duration: validatedFiber.data.duration,
    position: validatedFiber.data.position,
    progress: validatedFiber.data.progress,
  });
}

export function getTrackMeta(): Result<any, string> {
  const players = document.querySelectorAll(PLAYER_SELECTOR);
  if (!players.length) {
    return err("Player element not found in DOM");
  }

  let lastError = "entityMeta not found";

  for (const player of Array.from(players)) {
    let fiber: any = null;
    try {
      fiber = searchProperty(player, "entityMeta");
    } catch (error) {
      lastError = String(error);
      continue;
    }

    const meta = fiber?.entityMeta;
    if (!meta || !(meta.id || meta.realId) || !meta.title) {
      lastError = "entityMeta not found";
      continue;
    }

    if (meta.title === "Промокод Upgrade") {
      if (!hasAdsInPlayer) {
        console.warn("[getTrackMeta] Обнаружена реклама в плеере");
        Sentry.captureMessage("upgrade_promocode", {
          extra: {
            track: meta,
          },
        });
      }
      hasAdsInPlayer = true;
      return err("upgrade_promocode");
    }

    // Radio / «Моя волна» tracks omit fields the album player always has
    // (genre, albumId, …). Requiring them made every vibe track look missing.
    const entitySchema = z
      .object({
        id: z.union([z.string(), z.number()]).optional(),
        realId: z.union([z.string(), z.number()]).optional(),
        title: z.string(),
      })
      .passthrough();

    const validatedFiber = entitySchema.safeParse(meta);
    if (validatedFiber.error) {
      lastError = `Validation error: ${validatedFiber.error.message}`;
      continue;
    }

    const value = JSON.parse(JSON.stringify({ ...meta }));
    value.id = String(value.id || value.realId);
    return ok(value);
  }

  return err(lastError);
}

export interface TrackMeta {
  id: string;
  title: string;
  durationMs: number;
  albumId: number;
  type: string;
  genre: string;
  isAvailable: boolean;
  artists: Array<{ id: string; name: string }>;
  albums?: Array<{
    id: number;
    title: string;
    year?: number;
    isAvailable: boolean;
    genre?: string;
    trackCount: number;
  }>;
  coverUri?: string;
  [key: string]: any;
}

/**
 * Subscribe to track changes. Polls the player's current track meta and invokes
 * `cb(prev, next)` whenever the track id changes (and once on first detection).
 * Returns an unsubscribe function. Several mod features (ambient theme, Last.fm,
 * stats, ...) need this, so it lives here next to the other player helpers.
 */
export function subscribeToTrackChanges(
  cb: (prev: TrackMeta | null, next: TrackMeta) => void,
  intervalMs = 2000,
): () => void {
  let lastId: string | null = null;
  let lastMeta: TrackMeta | null = null;
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    const res = getTrackMeta();
    if (res.isOk()) {
      const meta = res.value as TrackMeta;
      if (meta.id !== lastId) {
        cb(lastMeta, meta);
        lastMeta = meta;
        lastId = meta.id;
      }
    }
  };

  tick();
  const handle = setInterval(tick, intervalMs);
  return () => {
    stopped = true;
    clearInterval(handle);
  };
}
