const { BrowserWindow, app } = require("electron");
const fs = require("fs");
const path = require("path");
const { Client } = require("@xhayper/discord-rpc");

const CLIENT_ID = "1283109459463377011";
const POLL_MS = 2000;
const HEARTBEAT_MS = 15 * 1000;
const SETTINGS_PATH = path.join(app.getPath("userData"), "mod_settings.json");

let lastActivityChanged = 0;
let lastTrackKey = "";
let lastPlaying = null;
let lastSeekPos = 0;
let lastSeekAt = 0;
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
    lastActivityChanged = 0;
    lastTrackKey = "";
  });

  client.on("disconnected", () => {
    console.log("[DISCORD RPC] Disconnected");
    setTimeout(initRpc, 8000);
  });

  client.on("error", (error) => {
    console.log("[DISCORD RPC] Error", error);
  });
}

function clip(text, max) {
  const value = String(text || "").trim();
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + "…";
}

function resolveCover(coverUri) {
  if (!coverUri) return undefined;
  let url = String(coverUri).trim().replace(/%%/g, "400x400");
  url = url.replace(/^https?:\/\/https?:\/\//i, "https://");
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

function asSeconds(value) {
  const n = Number(value) || 0;
  if (n <= 0) return 0;
  return n > 10000 ? n / 1000 : n;
}

function shouldUpdate(trackKey, playing, position) {
  if (trackKey !== lastTrackKey) return true;
  if (playing !== lastPlaying) return true;
  const expected = lastSeekPos + (Date.now() - lastSeekAt) / 1000;
  if (Math.abs(position - expected) > 2.5) return true;
  return Date.now() - lastActivityChanged >= HEARTBEAT_MS;
}

async function GetAppPlayerState() {
  const [win] = BrowserWindow.getAllWindows();
  if (!win || win.isDestroyed()) return { enabled: isRpcEnabled(), showModButton: true, data: null };

  try {
    return await win.webContents.executeJavaScript(`
      (function () {
        function cover(meta, media) {
          try {
            var art = media && media.artwork;
            if (art && art.length) {
              var best = art[art.length - 1];
              if (best && best.src) return best.src;
            }
          } catch (e) {}
          var raw = "";
          if (meta) {
            raw = meta.coverUri || meta.ogImage || "";
            if (!raw && meta.albums && meta.albums[0]) raw = meta.albums[0].coverUri || "";
          }
          if (!raw) return null;
          raw = String(raw).replace(/%%/g, "400x400");
          return raw.indexOf("http") === 0 ? raw : "https://" + raw;
        }

        function activeMedia() {
          var nodes = Array.prototype.slice.call(document.querySelectorAll("audio,video"));
          var live = null;
          var clock = null;
          for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (el && !el.paused && !el.ended) { live = el; break; }
          }
          for (var j = 0; j < nodes.length; j++) {
            var node = nodes[j];
            if (node && isFinite(node.duration) && node.duration > 0) {
              if (!clock || (node.currentTime || 0) > (clock.currentTime || 0)) clock = node;
            }
          }
          return live || clock || null;
        }

        var audio = activeMedia();
        var media = null;
        var sessionState = "";
        try {
          media = navigator.mediaSession && navigator.mediaSession.metadata;
          sessionState = (navigator.mediaSession && navigator.mediaSession.playbackState) || "";
        } catch (e) {}

        var fromFn = null;
        try {
          if (typeof window.__getPlayerState === "function") fromFn = window.__getPlayerState();
        } catch (e) {}

        var meta = fromFn && fromFn.data && fromFn.data.trackMeta;
        var title = (meta && meta.title) || (media && media.title) || "";
        var artists = (meta && meta.artists && meta.artists.length)
          ? meta.artists
          : (media && media.artist ? [{ name: media.artist }] : []);
        var id = (meta && (meta.id || meta.realId)) || "";

        if (!title && !id) return { enabled: true, showModButton: true, data: null };

        var duration = 0;
        var position = 0;
        if (audio && isFinite(audio.duration) && audio.duration > 0) {
          duration = audio.duration;
          position = audio.currentTime || 0;
        } else if (fromFn && fromFn.data && fromFn.data.playback && fromFn.data.playback.duration) {
          duration = fromFn.data.playback.duration;
          position = fromFn.data.playback.position || 0;
          if (duration > 10000) { duration = duration / 1000; position = position / 1000; }
        } else if (meta && meta.durationMs) {
          duration = meta.durationMs / 1000;
        }

        var live = audio && !audio.paused && !audio.ended;
        var playing = sessionState === "playing" || !!live;
        if (!playing && sessionState !== "paused" && media && media.title) playing = true;

        return {
          enabled: fromFn && fromFn.enabled === false ? false : true,
          showModButton: true,
          data: {
            trackMeta: {
              id: String(id || ""),
              title: title || ("Track " + id),
              version: meta && meta.version,
              artists: artists,
              coverUri: cover(meta, media),
              album: (media && media.album) || (meta && meta.album) || (meta && meta.albums && meta.albums[0] && meta.albums[0].title) || ""
            },
            playback: {
              duration: duration,
              position: position,
              progress: duration ? position / duration : 0
            },
            isPlaying: playing
          }
        };
      })()
    `);
  } catch (error) {
    return { enabled: isRpcEnabled(), showModButton: true, data: null };
  }
}

async function updateActivity() {
  setTimeout(updateActivity, POLL_MS);
  if (!client || !client.user) return;

  try {
    if (!isRpcEnabled()) {
      if (lastTrackKey !== "__off") {
        await client.user.clearActivity();
        lastTrackKey = "__off";
        lastActivityChanged = Date.now();
      }
      return;
    }

    const playerState = await GetAppPlayerState();
    const data = playerState && playerState.data;

    if (!data || !data.trackMeta || !data.trackMeta.title || playerState.enabled === false) {
      if (lastTrackKey && lastTrackKey !== "__empty") {
        await client.user.clearActivity();
        lastTrackKey = "__empty";
        lastActivityChanged = Date.now();
      }
      return;
    }

    const meta = data.trackMeta;
    const duration = asSeconds(data.playback && data.playback.duration);
    const position = Math.max(0, Math.min(asSeconds(data.playback && data.playback.position), duration || 1e9));
    const playing = data.isPlaying !== false;
    const trackKey = String(meta.id || "") + "|" + String(meta.title || "");

    if (!shouldUpdate(trackKey, playing, position)) return;

    const artists = Array.isArray(meta.artists)
      ? meta.artists.map((artist) => artist && artist.name).filter(Boolean).join(", ")
      : "";
    const cover = resolveCover(meta.coverUri);
    const title = meta.version ? `${meta.title} ${meta.version}` : meta.title;

    const activity = {
      type: 2,
      details: clip(title, 128),
      state: clip(playing ? artists || "PULSE" : (artists ? artists + " · пауза" : "пауза"), 128),
      largeImageKey: cover,
      largeImageText: clip(meta.album || title || "PULSE", 128),
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

    if (playing) {
      const start = Date.now() - position * 1000;
      activity.startTimestamp = Math.round(start);
      if (duration > position) {
        activity.endTimestamp = Math.round(start + duration * 1000);
      }
    }

    await client.user.setActivity(activity);
    lastTrackKey = trackKey;
    lastPlaying = playing;
    lastSeekPos = position;
    lastSeekAt = Date.now();
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
