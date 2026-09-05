const electron = require("electron");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const process = require("process");
const sanitize = require("sanitize-filename");
const axios = require("axios");
const { execFile } = require("child_process");

// ffmpeg-static (либа которая бандлит бинарники ffmpeg)
const pathToFfmpeg = require("ffmpeg-static").replaceAll("app.asar", "app.asar.unpacked");
const { exec } = require("child_process");
console.log("bundled ffmpeg binary path:", pathToFfmpeg);

const appFolder = electron.app.getPath("userData");
const settingsFilePath = path.join(appFolder, "mod_settings.json");
const defaultDownloadPath = path.join(appFolder, "Downloads");

// Создание папки для хранения настроек пользователя
fs.mkdirSync(appFolder, { recursive: true });
console.log("mod_settings directory created successfully!");

// Создание папки для загрузки треков
fs.mkdirSync(defaultDownloadPath, { recursive: true });
console.log("Default download directory created successfully!");

if (!fs.existsSync(settingsFilePath)) {
  // Initialize settings with default download path on first run
  const initialSettings = {
    downloadFolderPath: defaultDownloadPath,
    "custom-themes/enabled": true,
    "custom-themes/accent": "#A78BFA",
    "custom-themes/playerColorsReplace": true,
  };
  fs.writeFileSync(settingsFilePath, JSON.stringify(initialSettings, null, 2));
} else {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    // Set default download path if not already set
    if (!settings.downloadFolderPath) {
      settings.downloadFolderPath = defaultDownloadPath;
      fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    }
  } catch (e) {
    // If settings file is corrupted, recreate with defaults
    const initialSettings = {
      downloadFolderPath: defaultDownloadPath,
    };
    fs.writeFileSync(settingsFilePath, JSON.stringify(initialSettings, null, 2));
  }
}

// window API - запрос настроек пользователя
electron.ipcMain.handle("yandexMusicMod.getStorageValue", (_ev, key) => {
  const settings = fs.readFileSync(settingsFilePath, "utf8") || "{}";
  const parsed = JSON.parse(settings);
  return parsed[key] !== undefined ? parsed[key] : null;
});

// window API - установка настроек пользователя
electron.ipcMain.on("yandexMusicMod.setStorageValue", (_ev, key, value) => {
  const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
  settings[key] = value;
  fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));

  electron.BrowserWindow.getAllWindows().forEach((window) =>
    window.webContents.send("yandexMusicMod.storageValueUpdated", key, value),
  );
});

// window API - выбор папки для загрузки треков
electron.ipcMain.handle("yandexMusicMod.selectDownloadFolder", async (_ev) => {
  const result = await electron.dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Выберите папку для загрузки треков",
  });

  if (result.canceled || !result.filePaths.length) {
    return { success: false, path: null };
  }

  return { success: true, path: result.filePaths[0] };
});

// window API - открытие папки для загрузки треков
electron.ipcMain.handle("yandexMusicMod.openFolder", async (_ev, folderPath) => {
  try {
    const errorMessage = await electron.shell.openPath(folderPath);
    if (errorMessage) {
      console.error("Failed to open folder:", errorMessage);
      return { success: false, error: errorMessage };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to open folder:", error);
    return { success: false, error: error.message };
  }
});

// window API - загрузка трека
electron.ipcMain.handle(
  "yandexMusicMod.downloadTrack",
  async (_ev, downloadInfo, trackMeta, customDownloadPath = null) => {
    console.log("Backend get download request: ", downloadInfo.url);

    let saveFolder;
    if (customDownloadPath) {
      saveFolder = customDownloadPath;
    } else {
      // Use saved download path from settings or fall back to legacy default
      try {
        const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
        saveFolder = settings.downloadFolderPath || process.env.USERPROFILE + "\\YandexMod Download";
      } catch (e) {
        saveFolder = process.env.USERPROFILE + "\\YandexMod Download";
      }
    }
    if (!fs.existsSync(saveFolder)) {
      fs.mkdirSync(saveFolder, { recursive: true });
    }

    // Generate filename from trackMeta or use default
    const fileExtension = String(downloadInfo.codec || "").includes("flac") ? "flac" : "mp3";
    const trackFileName = sanitize(
      `${trackMeta.artists.map((a) => a.name).join(", ")} - ${trackMeta.title} ${trackMeta.version || ""}`,
    )
      .trim()
      .substring(0, 250);
    const trackFilePath = path.join(saveFolder, `${trackFileName}.${fileExtension}`);
    const trackTempFilePath = path.join(saveFolder, `${Math.random().toString(36).substring(2, 7)}.${fileExtension}`);
    const trackCoverPath = path.join(saveFolder, `${trackFileName}.jpg`);

    try {
      // Download file using axios with arraybuffer response type
      const response = await axios.get(downloadInfo.url, {
        responseType: "arraybuffer",
        validateStatus: () => true, // Following neverthrow integration pattern
      });

      if (response.status !== 200) {
        console.error(`Download failed with status: ${response.status}`);
        return { ok: false, error: "Download failed" };
      }

      // Links captured from the app itself can use the plain "raw" transport,
      // which has no encryption key.
      const decryptedData = downloadInfo.key
        ? await decryptYandexAudio(response.data, downloadInfo.key)
        : response.data;

      // Write decrypted data to file (awaited so errors propagate to the caller)
      await fsp.writeFile(trackFilePath, Buffer.from(decryptedData));
      console.log("Download and Decryption Completed");

      // 2. Copy/reencode audio using direct ffmpeg command
      await new Promise((resolve, reject) => {
        execFile(pathToFfmpeg, ["-i", trackFilePath, "-y", trackTempFilePath], (error, _stdout, stderr) => {
          if (error) {
            console.error("FFmpeg stderr:", stderr);
            console.error("FFmpeg error:", error);
            reject(new Error(`FFmpeg process failed: ${error.message}`));
          } else {
            resolve();
          }
        });
      });

      // Build ffmpeg arguments for adding metadata and cover
      const ffmpegArgs = ["-i", trackTempFilePath];

      // === Download cover art ===
      if (trackMeta.coverUri) {
        try {
          const url = `https://${trackMeta.coverUri.replaceAll("%%", "orig")}`;
          const coverResponse = await axios.get(url, { responseType: "arraybuffer" });
          fs.writeFileSync(trackCoverPath, coverResponse.data);

          ffmpegArgs.push("-i", trackCoverPath);
          ffmpegArgs.push("-map", "0:a", "-map", "1:v", "-y");
        } catch (err) {
          console.warn("Failed to download cover art:", err);
        }
      }

      // Add metadata
      ffmpegArgs.push("-c", "copy");
      ffmpegArgs.push("-id3v2_version", "3");

      if (trackMeta.title) {
        ffmpegArgs.push("-metadata", `title=${trackMeta.title}`);
      }
      if (trackMeta.version) {
        ffmpegArgs.push("-metadata", `subtitle=${trackMeta.version}`);
      }
      if (trackMeta.artists && trackMeta.artists.length > 0) {
        ffmpegArgs.push("-metadata", `artist=${trackMeta.artists.map((a) => a.name).join("/")}`);
      }
      if (trackMeta.albums?.[0]?.title) {
        ffmpegArgs.push("-metadata", `album=${trackMeta.albums[0].title}`);
      }
      if (trackMeta.albums?.[0]?.genre) {
        ffmpegArgs.push("-metadata", `genre=${trackMeta.albums[0].genre}`);
      }
      if (trackMeta.albums?.[0]?.trackPosition?.index) {
        ffmpegArgs.push("-metadata", `track=${trackMeta.albums[0].trackPosition.index}`);
      }
      if (trackMeta.albums?.[0]?.year) {
        ffmpegArgs.push("-metadata", `date=${trackMeta.albums[0].year}`);
      }
      if (trackMeta.albums?.[0]?.releaseDate) {
        ffmpegArgs.push("-metadata", `releaseDate=${trackMeta.albums[0].releaseDate}`);
      }
      ffmpegArgs.push("-metadata", "encoded_by=yandexMusicMod");

      ffmpegArgs.push("-y", trackFilePath);

      console.log("ffmpegArgs", ffmpegArgs);

      // Execute ffmpeg command to add metadata and cover
      await new Promise((resolve, reject) => {
        execFile(pathToFfmpeg, ffmpegArgs, (error, _stdout, stderr) => {
          if (error) {
            console.error("FFmpeg metadata stderr:", stderr);
            console.error("FFmpeg metadata error:", error);
            reject(new Error(`FFmpeg metadata process failed: ${error.message}`));
          } else {
            // Clean up temporary files
            if (fs.existsSync(trackTempFilePath)) {
              fs.unlinkSync(trackTempFilePath);
            }
            resolve();
          }
        });

        console.log("Download completed.");
      });
    } catch (err) {
      console.error("Download or decryption failed:", err);
      return { ok: false, error: "Download or decryption failed: " + err };
    }

    return { ok: true };
  },
);

// window API - открытие папки для загрузки треков
electron.ipcMain.on("yandexMusicMod.openDownloadDirectory", async (_ev) => {
  let saveFolder;
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
    saveFolder = settings.downloadFolderPath || process.env.USERPROFILE + "\\YandexMod Download";
  } catch (e) {
    saveFolder = process.env.USERPROFILE + "\\YandexMod Download";
  }
  const errorMessage = await electron.shell.openPath(saveFolder);
  if (errorMessage) {
    console.error("Failed to open download directory:", errorMessage);
  }
});

// window API - универсальный axios запрос
electron.ipcMain.handle("yandexMusicMod.axios", async (_ev, config) => {
  const client = axios.create({
    validateStatus: () => true,
  });

  const response = await client(config);

  return {
    success: true,
    data: response.data,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  };
});

// window API - скачивание обложки трека
electron.ipcMain.handle("yandexMusicMod.downloadCover", async (_ev, coverUri, fileName) => {
  try {
    let saveFolder;
    try {
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
      saveFolder = settings.downloadFolderPath || process.env.USERPROFILE + "\\YandexMod Download";
    } catch (e) {
      saveFolder = process.env.USERPROFILE + "\\YandexMod Download";
    }
    if (!fs.existsSync(saveFolder)) {
      fs.mkdirSync(saveFolder, { recursive: true });
    }

    const safeName = sanitize(fileName).trim().substring(0, 250) || "cover";
    const coverPath = path.join(saveFolder, `${safeName}.jpg`);
    const url = `https://${coverUri.replaceAll("%%", "orig")}`;

    const response = await axios.get(url, { responseType: "arraybuffer", validateStatus: () => true });
    if (response.status !== 200) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    await fsp.writeFile(coverPath, response.data);
    console.log("[downloadCover] saved", coverPath);
    return { ok: true, path: coverPath };
  } catch (error) {
    console.error("[downloadCover] failed", error);
    return { ok: false, error: String(error?.message || error) };
  }
});

// Функция для расшифровки зашифрованного трека
async function decryptYandexAudio(encryptedData, secretKey) {
  const hexChars = secretKey.match(/.{1,2}/g);
  if (!hexChars || hexChars.some((b) => Number.isNaN(parseInt(b, 16)))) {
    throw new Error("Invalid secret key: not a valid hex string");
  }
  const hexToUint8Array = (hexString) => new Uint8Array(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  const cryptoKey = await crypto.subtle.importKey("raw", hexToUint8Array(secretKey), { name: "AES-CTR" }, false, [
    "encrypt",
    "decrypt",
  ]);

  let counter = new Uint8Array(16);
  return crypto.subtle.decrypt({ name: "AES-CTR", counter, length: 128 }, cryptoKey, encryptedData);
}

// === Глобальные горячие клавиши (медиа-кнопки + кастомные) ===
// Регистрируются в main-процессе через electron.globalShortcut, чтобы работали
// даже когда окно Я.Музыки не в фокусе. При нажатии отправляют IPC-сообщение
// в renderer, который кликает соответствующие кнопки плеера.
const globalHotkeysEnabled = () => {
  try {
    return JSON.parse(fs.readFileSync(settingsFilePath, "utf8"))["global-hotkeys/enabled"] !== false;
  } catch {
    return true;
  }
};

const sendMediaKey = (action) => {
  for (const win of electron.BrowserWindow.getAllWindows()) {
    win.webContents.send("yandexMusicMod.mediaKey", action);
  }
};

const HOTKEY_ACTIONS = [
  { key: "MediaPlayPause", action: "playPause" },
  { key: "MediaNextTrack", action: "next" },
  { key: "MediaPreviousTrack", action: "prev" },
  { key: "CommandOrControl+Shift+L", action: "like" },
  { key: "CommandOrControl+Shift+D", action: "downloadCurrent" },
];

let hotkeysRegistered = false;
function registerHotkeys() {
  if (hotkeysRegistered) return;
  if (!globalHotkeysEnabled()) return;
  for (const { key, action } of HOTKEY_ACTIONS) {
    try {
      electron.globalShortcut.register(key, () => sendMediaKey(action));
    } catch (e) {
      console.warn(`[global-hotkeys] failed to register ${key}`, e);
    }
  }
  hotkeysRegistered = true;
}

function unregisterHotkeys() {
  if (!hotkeysRegistered) return;
  for (const { key } of HOTKEY_ACTIONS) {
    try {
      electron.globalShortcut.unregister(key);
    } catch {}
  }
  hotkeysRegistered = false;
}

electron.ipcMain.on("yandexMusicMod.hotkeysState", (_ev, enabled) => {
  if (enabled) registerHotkeys();
  else unregisterHotkeys();
});

// Re-register on focus regain (some systems unregister media keys when blurred)
electron.app.on("browser-window-focus", registerHotkeys);

try {
  // Independent of any JavaScript hook in the page: Chromium reports every
  // request the app sends, headers included. That gives the mod the app's own
  // signed /get-file-info URLs and its exact header set even if the renderer
  // side interception ever breaks again.
  const fileInfoRequests = [];

  const rememberFileInfoRequest = (details) => {
    try {
      if (!details.url || details.url.indexOf("get-file-info") === -1) return;
      fileInfoRequests.unshift({ url: details.url, headers: details.requestHeaders || {}, at: Date.now() });
      if (fileInfoRequests.length > 60) fileInfoRequests.length = 60;
    } catch {}
  };

  const watchSession = (session) => {
    try {
      session.webRequest.onSendHeaders({ urls: ["*://api.music.yandex.net/*"] }, rememberFileInfoRequest);
    } catch {}
  };

  electron.ipcMain.handle("yandexMusicMod.fileInfoRequests", () => fileInfoRequests);

  // Read synchronously so the preload can hand the source to the page before the
  // app's own scripts start running.
  electron.ipcMain.on("yandexMusicMod.shellSource", (event) => {
    try {
      const shellPath = path.join(electron.app.getAppPath(), "app", "yandexMusicMod", "pulse-shell.js");
      event.returnValue = fs.existsSync(shellPath) ? fs.readFileSync(shellPath, "utf8") : "";
    } catch {
      event.returnValue = "";
    }
  });

  if (electron.app.isReady()) watchSession(electron.session.defaultSession);
  else electron.app.whenReady().then(() => watchSession(electron.session.defaultSession));

  electron.app.on("browser-window-created", (_e, win) => {
    // Yandex may put the window on its own partition, which has its own session.
    try {
      watchSession(win.webContents.session);
    } catch {}

    const inject = () => {
      try {
        const rendererPath = path.join(electron.app.getAppPath(), "app", "yandexMusicMod", "renderer.js");
        const cssPath = path.join(electron.app.getAppPath(), "app", "yandexMusicMod", "renderer.css");
        if (fs.existsSync(cssPath)) {
          win.webContents.insertCSS(fs.readFileSync(cssPath, "utf8")).catch(() => {});
        }
        const shellPath = path.join(electron.app.getAppPath(), "app", "yandexMusicMod", "pulse-shell.js");
        if (fs.existsSync(shellPath)) {
          win.webContents.executeJavaScript(fs.readFileSync(shellPath, "utf8")).catch(() => {});
        }
        if (fs.existsSync(rendererPath)) {
          win.webContents.executeJavaScript(fs.readFileSync(rendererPath, "utf8")).catch(() => {});
        }
      } catch (err) {
        console.error("PULSE renderer inject failed", err);
      }
    };
    win.webContents.on("did-finish-load", inject);
    win.webContents.on("dom-ready", inject);
  });
} catch {}

// Let Chromium throttle the window while it sits behind a game. Pages that play
// audio keep their audio pipeline, only rendering and timers are slowed down.
try {
  electron.app.on("browser-window-created", (_e, win) => {
    try {
      win.webContents.setBackgroundThrottling(true);
    } catch {}
    try {
      win.setIcon(path.join(process.resourcesPath, "assets", "icon.ico"));
    } catch {}
  });
} catch {}

try {
  electron.app.setName("PULSE");
  electron.app.setAppUserModelId("com.slesari690.pulse");
  const lockPulseTitle = (win) => {
    try {
      win.setTitle("PULSE");
      win.on("page-title-updated", (event) => {
        event.preventDefault();
        win.setTitle("PULSE");
      });
    } catch {}
  };
  electron.app.on("browser-window-created", (_e, win) => lockPulseTitle(win));
  const applyExisting = () => electron.BrowserWindow.getAllWindows().forEach(lockPulseTitle);
  if (electron.app.isReady()) applyExisting();
  else electron.app.whenReady().then(applyExisting);
} catch {}

// Discord RPC (из-за того, что main.js не бандлится а просто добавляется в оригинальный index.js, все импорты приходится делать вручную. Строчка ниже просто заменится на содержимое файла src\mod\features\utils\discordRPC.js)
mod_require("discordRPC");
