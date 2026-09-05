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

  // Progress and play/pause are missing on radio pages. That must not hide the
  // track itself: downloads and Discord only need the id and title.
  return {
    enabled: isRpcEnabled,
    showModButton: showModButton,
    data: {
      trackMeta: trackMetaRequest.value,
      playback: playbackRequest.isOk()
        ? playbackRequest.value
        : { duration: 0, progress: 0, position: 0 },
      isPlaying: isPlayingRequest.isOk() ? isPlayingRequest.value : false,
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
