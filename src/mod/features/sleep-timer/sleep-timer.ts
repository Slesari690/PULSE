/**
 * Sleep timer.
 *
 * The UI writes an absolute deadline (ms epoch) to "sleep-timer/deadline".
 * This background module ticks every second; when the deadline passes it
 * clicks the player's pause button and clears the deadline.
 *
 * Special value: a deadline of -1 means "stop at the end of the current track".
 * We detect that by watching for the track id to change, then pausing.
 */

const PLAYER_SELECTOR = 'section[data-test-id="PLAYERBAR_DESKTOP"]';
const PAUSE_SELECTOR = 'button[data-test-id="PAUSE_BUTTON"], button[data-test-id="PLAY_BUTTON"]';

let deadline: number | null = null; // epoch ms, or -1 for end-of-track
let pollHandle: ReturnType<typeof setInterval> | null = null;
let lastTrackId: string | null = null;

window.yandexMusicMod?.onStorageChanged((key: string, value: any) => {
  if (key === "sleep-timer/deadline") {
    deadline = typeof value === "number" ? value : null;
    if (deadline !== null && !pollHandle) startPolling();
    if (deadline === null && pollHandle) stopPolling();
  }
});

(async () => {
  const d = await window.yandexMusicMod.getStorageValue("sleep-timer/deadline");
  deadline = typeof d === "number" ? d : null;
  if (deadline !== null) startPolling();
})();

function startPolling() {
  if (pollHandle) return;
  pollHandle = setInterval(tick, 1000);
  tick();
}

function stopPolling() {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
}

function tick() {
  if (deadline === null) return;

  if (deadline === -1) {
    // end-of-current-track mode: pause when the player advances to a new track
    checkEndOfTrack();
    return;
  }

  if (Date.now() >= deadline) {
    pausePlayer();
    window.yandexMusicMod.setStorageValue("sleep-timer/deadline", null);
    deadline = null;
    stopPolling();
  }
}

async function checkEndOfTrack() {
  const { getTrackMeta } = await import("~/mod/features/utils/player");
  const meta = getTrackMeta();
  if (meta.isErr()) return;
  const id = (meta.value as any).id;
  if (lastTrackId === null) {
    lastTrackId = id;
    return;
  }
  if (id !== lastTrackId) {
    // a new track started — we wanted to stop at the end of the previous one
    pausePlayer();
    window.yandexMusicMod.setStorageValue("sleep-timer/deadline", null);
    deadline = null;
    lastTrackId = null;
    stopPolling();
  }
}

function pausePlayer() {
  const player = document.querySelector(PLAYER_SELECTOR);
  const btn = player?.querySelector<HTMLButtonElement>(PAUSE_SELECTOR);
  // Only click if currently playing (PAUSE button present)
  const pauseBtn = player?.querySelector<HTMLButtonElement>('button[data-test-id="PAUSE_BUTTON"]');
  if (pauseBtn) pauseBtn.click();
  else btn?.click();
}
