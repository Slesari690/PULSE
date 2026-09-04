// `electron` is provided by the host preload scope (the original Yandex Music
// preload.js defines it before this appended code runs), so we declare it as an
// ambient global rather than importing it.
declare const electron: typeof import("electron");

electron.contextBridge.exposeInMainWorld("yandexMusicMod", {
  getStorageValue: (key: string) => electron.ipcRenderer.invoke("yandexMusicMod.getStorageValue", key),
  setStorageValue: (key: string, value: any) => electron.ipcRenderer.send("yandexMusicMod.setStorageValue", key, value),
  onStorageChanged: (cb: Function) => {
    const listener = (_e: unknown, key: string, value: any) => cb(key, value);
    electron.ipcRenderer.on("yandexMusicMod.storageValueUpdated", listener);
    return () => electron.ipcRenderer.removeListener("yandexMusicMod.storageValueUpdated", listener);
  },
  downloadTrack: (downloadInfo: any, trackMeta: any, customDownloadPath?: string) =>
    electron.ipcRenderer.invoke("yandexMusicMod.downloadTrack", downloadInfo, trackMeta, customDownloadPath),
  openDownloadDirectory: () => electron.ipcRenderer.send("yandexMusicMod.openDownloadDirectory"),
  selectDownloadFolder: () => electron.ipcRenderer.invoke("yandexMusicMod.selectDownloadFolder"),
  openFolder: (folderPath: string) => electron.ipcRenderer.invoke("yandexMusicMod.openFolder", folderPath),
  downloadCover: (coverUri: string, fileName: string) =>
    electron.ipcRenderer.invoke("yandexMusicMod.downloadCover", coverUri, fileName),
  axios: (config: any) => electron.ipcRenderer.invoke("yandexMusicMod.axios", config),
  onMediaKey: (cb: (action: string) => void) => {
    const listener = (_e: unknown, action: string) => cb(action);
    electron.ipcRenderer.on("yandexMusicMod.mediaKey", listener);
    return () => electron.ipcRenderer.removeListener("yandexMusicMod.mediaKey", listener);
  },
  setHotkeysEnabled: (enabled: boolean) => electron.ipcRenderer.send("yandexMusicMod.hotkeysState", enabled),
});

// Register Ctrl+Shift+I to open DevTools
electron.globalShortcut.register("CommandOrControl+Shift+I", () => {
  const focusedWindow = electron.BrowserWindow.getFocusedWindow();
  if (focusedWindow) {
    focusedWindow.webContents.toggleDevTools();
  }
});
