import { getTrackMeta, getProgress, isPlaying } from "~/mod/features/utils/player";
import * as Sentry from "@sentry/react";

let isRpcEnabled = true;
let showModButton = true;

// Функция для получения состояния плеера из окна приложения. Её вызывает main процесс - src\mod\main.js
window.__getPlayerState = () => {
  const trackMetaRequest = getTrackMeta();
  const playbackRequest = getProgress();
  const isPlayingRequest = isPlaying();

  if (trackMetaRequest.isErr()) {
    if (trackMetaRequest.error !== "upgrade_promocode") {
      Sentry.captureException("Error getting track meta:", { extra: { trackMetaRequest: trackMetaRequest.error } });
      console.error("Error getting track meta:", trackMetaRequest.error);
    }
    return {
      enabled: isRpcEnabled,
      showModButton: showModButton,
      data: null,
    };
  }

  const meta = trackMetaRequest.value;
  const nodes = Array.from(document.querySelectorAll("audio,video"));
  const live = nodes.find((el) => el && !el.paused && !el.ended) || null;
  const audio =
    live ||
    nodes
      .filter((el) => el && Number.isFinite(el.duration) && el.duration > 0)
      .sort((a, b) => (b.currentTime || 0) - (a.currentTime || 0))[0] ||
    null;
  let playback = playbackRequest.isOk()
    ? playbackRequest.value
    : { duration: 0, progress: 0, position: 0 };

  // The <audio> clock is the one Discord should follow. The player chrome is
  // missing on radio pages and its units sometimes come in milliseconds.
  if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
    playback = {
      duration: audio.duration,
      position: audio.currentTime || 0,
      progress: audio.currentTime / audio.duration,
    };
  } else if (playback.duration > 10_000) {
    playback = {
      duration: playback.duration / 1000,
      position: (playback.position || 0) / 1000,
      progress: playback.progress || 0,
    };
  } else if ((!playback.duration || playback.duration <= 0) && meta.durationMs) {
    playback = { duration: meta.durationMs / 1000, position: playback.position || 0, progress: 0 };
  }

  if (!meta.coverUri) {
    try {
      const art = navigator.mediaSession?.metadata?.artwork;
      if (art && art.length) meta.coverUri = art[art.length - 1]?.src;
    } catch {
      /* ignore */
    }
  }

  const sessionState = (() => {
    try {
      return navigator.mediaSession?.playbackState || "";
    } catch {
      return "";
    }
  })();
  const playing =
    sessionState === "playing" ||
    !!live ||
    (sessionState !== "paused" && !!navigator.mediaSession?.metadata?.title) ||
    (isPlayingRequest.isOk() ? isPlayingRequest.value : false);

  return {
    enabled: isRpcEnabled,
    showModButton: showModButton,
    data: {
      trackMeta: meta,
      playback,
      isPlaying: playing,
    },
  };
};

window.yandexMusicMod?.onStorageChanged((key: string, value: any) => {
  if (key === "discordRPC/enabled" && value !== isRpcEnabled) isRpcEnabled = value;
  if (key === "discordRPC/showModButton" && value !== showModButton) showModButton = value;
});

(async () => {
  isRpcEnabled = (await window.yandexMusicMod.getStorageValue("discordRPC/enabled")) === false ? false : true;
  showModButton = (await window.yandexMusicMod.getStorageValue("discordRPC/showModButton")) === false ? false : true;
})();
