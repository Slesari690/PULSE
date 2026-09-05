import { getTrackMeta } from "~/mod/features/utils/player";
import { getTrackUrl, QualityEnum } from "~/mod/features/utils/api";

/**
 * Global hotkeys — renderer side.
 *
 * The main process registers OS-level shortcuts (see main.js) and forwards
 * the action here via IPC. This module translates each action into the right
 * DOM click on the Yandex Music player, so we don't need any private player API.
 *
 * "downloadCurrent" reuses the existing downloadTrack IPC by fetching the
 * current track's download URL and saving it to the configured folder.
 */

const PLAYER_SELECTOR = 'section[data-test-id="PLAYERBAR_DESKTOP"]';
const LIKE_BUTTON_SELECTOR = 'button[data-test-id="LIKE_BUTTON"], button[aria-label*="лайк"], button[aria-label*="Like"]';

let enabled = false;

window.yandexMusicMod?.onStorageChanged((key: string, value: any) => {
  if (key === "global-hotkeys/enabled") {
    enabled = value !== false;
    window.yandexMusicMod.setHotkeysEnabled(enabled);
  }
});

(async () => {
  enabled = (await window.yandexMusicMod.getStorageValue("global-hotkeys/enabled")) !== false;
  // tell main process our initial state
  window.yandexMusicMod.setHotkeysEnabled(enabled);

  window.yandexMusicMod.onMediaKey((action) => {
    if (!enabled) return;
    handleAction(action).catch((e) => console.warn("[global-hotkeys] action failed", action, e));
  });
})();

async function handleAction(action: string) {
  switch (action) {
    case "playPause":
      clickInPlayer('button[data-test-id="PLAY_BUTTON"], button[data-test-id="PAUSE_BUTTON"]');
      break;
    case "next":
      clickInPlayer('button[data-test-id="NEXT_BUTTON"]');
      break;
    case "prev":
      clickInPlayer('button[data-test-id="PREVIOUS_BUTTON"]');
      break;
    case "like":
      clickInPlayer(LIKE_BUTTON_SELECTOR);
      break;
    case "downloadCurrent":
      await downloadCurrent();
      break;
  }
}

function clickInPlayer(selector: string) {
  const player = document.querySelector(PLAYER_SELECTOR);
  if (!player) return;
  const btn = player.querySelector<HTMLButtonElement>(selector);
  if (!btn) {
    console.warn("[global-hotkeys] button not found:", selector);
    return;
  }
  btn.click();
}

async function downloadCurrent() {
  const meta = getTrackMeta();
  if (meta.isErr()) return;
  const track = meta.value as any;
  if (!track?.id) return;

  const quality = (await window.yandexMusicMod.getStorageValue("downloader/quality")) as QualityEnum;
  const dl = await getTrackUrl(track.id, quality || QualityEnum.LOSSLESS);
  if (dl.isErr()) return;

  const folder = (await window.yandexMusicMod.getStorageValue("downloadFolderPath")) || "";
  const result = await window.yandexMusicMod.downloadTrack(dl.value, track, folder);
  if (result?.error) console.error("[global-hotkeys] download failed", result.error);
}
