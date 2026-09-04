declare global {
  interface Window {
    yandexMusicMod: {
      getStorageValue: (key: string) => Promise<any>;
      setStorageValue: (key: string, value: any) => void;
      onStorageChanged: (cb: Function) => () => void;
      downloadTrack: (downloadInfo: any, trackMeta: any, customDownloadPath?: string) => Promise<any>;
      downloadCover: (coverUri: string, fileName: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
      openDownloadDirectory: () => void;
      selectDownloadFolder: () => Promise<{ success: boolean; path: string | null }>;
      openFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
      axios: (config: any) => Promise<{
        success: boolean;
        data?: any;
        error?: string;
        status?: number;
        statusText?: string;
        headers?: any;
      }>;
      onMediaKey: (cb: (action: string) => void) => () => void;
      setHotkeysEnabled: (enabled: boolean) => void;
    };
    VERSION: string;
    __getPlayerState: () => any;
  }
}

export {};
