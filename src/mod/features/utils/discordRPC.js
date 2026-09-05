const { BrowserWindow, app } = require("electron");
const fs = require("fs");
const path = require("path");
const { Client } = require("@xhayper/discord-rpc");

const CLIENT_ID = "1283109459463377011";
const ACTIVITY_COOLDOWN = 8 * 1000;
const SETTINGS_PATH = path.join(app.getPath("userData"), "mod_settings.json");

let lastActivityChanged = 0;
let client = null;
let started = false;

function isRpcEnabled() {
  try {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    return settings["discordRPC/enabled"] !== false;
  } catch {
    return true;
  }
}

function initRpc() {
  if (client) {
    try {
      client.destroy();
    } catch {}
  }

  client = new Client({ clientId: CLIENT_ID });

  client.login().catch((error) => {
    console.error("[DISCORD RPC] login failed", error);
    setTimeout(initRpc, 8000);
  });

  client.on("ready", () => {
    console.log("[DISCORD RPC] Hooked", client.user?.username);
  });

  client.on("disconnected", () => {
    console.log("[DISCORD RPC] Disconnected");
    setTimeout(initRpc, 8000);
  });

  client.on("error", (error) => {
    console.log("[DISCORD RPC] Error", error);
  });
}

async function GetAppPlayerState() {
  const [win] = BrowserWindow.getAllWindows();
  if (!win || win.isDestroyed()) return { enabled: isRpcEnabled(), showModButton: true, data: null };

  try {
    return await win.webContents.executeJavaScript(`
      (function () {
        if (typeof window.__getPlayerState === "function") {
          try { return window.__getPlayerState(); } catch (e) {}
        }
        var meta = navigator.mediaSession && navigator.mediaSession.metadata;
        var audio = document.querySelector("audio");
        if (!meta || !meta.title) return { enabled: true, showModButton: true, data: null };
        return {
          enabled: true,
          showModButton: true,
          data: {
            trackMeta: {
              id: "",
              title: meta.title,
              artists: [{ name: meta.artist || "?" }],
              coverUri: null
            },
            playback: {
              duration: audio && isFinite(audio.duration) ? audio.duration : 0,
              position: audio ? audio.currentTime : 0,
              progress: 0
            },
            isPlaying: audio ? !audio.paused : true
          }
        };
      })()
    `);
  } catch (error) {
    return { enabled: isRpcEnabled(), showModButton: true, data: null };
  }
}

async function updateActivity() {
  setTimeout(updateActivity, 2000);
  if (Date.now() - lastActivityChanged < ACTIVITY_COOLDOWN) return;
  if (!client || !client.user) return;

  try {
    if (!isRpcEnabled()) {
      await client.user.clearActivity();
      lastActivityChanged = Date.now();
      return;
    }

    const playerState = await GetAppPlayerState();
    const data = playerState && playerState.data;

    if (!data || !data.trackMeta || !data.trackMeta.title) {
      await client.user.clearActivity();
      lastActivityChanged = Date.now();
      return;
    }

    if (playerState.enabled === false) {
      await client.user.clearActivity();
      lastActivityChanged = Date.now();
      return;
    }

    const playing = data.isPlaying !== false;
    if (!playing) {
      await client.user.clearActivity();
      lastActivityChanged = Date.now();
      return;
    }

    const meta = data.trackMeta;
    const playback = data.playback || { duration: 0, position: 0 };
    const artists = Array.isArray(meta.artists)
      ? meta.artists.map((artist) => artist && artist.name).filter(Boolean).join(", ")
      : "";
    const cover = meta.coverUri
      ? `https://${String(meta.coverUri).replaceAll("%%", "300x300")}`
      : undefined;

    const activity = {
      type: 2,
      details: meta.version ? `${meta.title} ${meta.version}` : meta.title,
      state: artists || "PULSE",
      largeImageKey: cover,
      largeImageText: "PULSE",
      startTimestamp: Math.round(Date.now() - (playback.position || 0) * 1000),
      buttons: [
        {
          label: "Открыть в Яндекс Музыке",
          url: meta.id ? `https://music.yandex.ru/track/${meta.id}` : "https://music.yandex.ru",
        },
        {
          label: "PULSE",
          url: "https://github.com/Slesari690/PULSE",
        },
      ],
      instance: false,
    };

    if (playback.duration > playback.position) {
      activity.endTimestamp = Math.round(
        Date.now() + (playback.duration - playback.position) * 1000,
      );
    }

    await client.user.setActivity(activity);
    lastActivityChanged = Date.now();
  } catch (error) {
    console.log("[DISCORD RPC]", error);
  }
}

if (!started) {
  started = true;
  initRpc();
  updateActivity();
}
