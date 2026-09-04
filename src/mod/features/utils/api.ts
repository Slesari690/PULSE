import axios from "axios";
import type { AxiosInstance } from "axios";
import { Result, ok, err } from "neverthrow";

const SECRET_KEY = "kzqU4XhfCaY6B6JTHODeq5";

export enum QualityEnum {
  LOSSLESS = "lossless",
  NQ = "nq",
  LQ = "lq",
}

/**
 * Reads the OAuth token from localStorage on every call. The token can change
 * at runtime (e.g. user logs in after the mod is loaded), so we must not cache it
 * at module load time.
 */
function getOAuthToken(): string | null {
  try {
    return localStorage.oauth ? "OAuth " + JSON.parse(localStorage.oauth).value : null;
  } catch {
    return null;
  }
}

function buildHeaders(skipAuth = false): Record<string, string | undefined> {
  return {
    "X-Yandex-Music-Client": "YandexMusicDesktopAppWindows/" + window.VERSION,
    "X-Yandex-Music-Frontend": "new",
    "X-Yandex-Music-Without-Invocation-Info": "1",
    Authorization: skipAuth ? undefined : getOAuthToken(),
  };
}

// Create axios client. Headers (including the current OAuth token) are attached
// per-request via buildHeaders() so the token stays fresh if the user logs in
// after the mod is loaded.
const yandexMusicClient: AxiosInstance = axios.create({
  baseURL: "https://api.music.yandex.net",
  // Prevent axios from throwing on HTTP error status codes
  validateStatus: () => true,
});

// HMAC sign function
export async function getSign(params: { secretKey: string; data: string }): Promise<Result<string, string>> {
  try {
    const { secretKey, data } = params;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      {
        name: "HMAC",
        hash: {
          name: "SHA-256",
        },
      },
      true,
      ["sign", "verify"],
    );

    const messageData = encoder.encode(data);
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const base64Signature = btoa(String.fromCharCode(...new Uint8Array(signature))).slice(0, -1);

    return ok(base64Signature);
  } catch (error) {
    return err(`Failed to generate HMAC signature: ${error}`);
  }
}

// Получить прямую ссылку на трек
export async function getTrackUrl(trackId: string, quality: QualityEnum): Promise<Result<any, string>> {
  try {
    const ts = Math.floor(Date.now() / 1000);
    const audioCodecs = ["flac", "aac", "he-aac", "mp3", "flac-mp4", "aac-mp4", "he-aac-mp4"];
    const transports = "encraw";

    const signResult = await getSign({
      data: `${ts}${trackId}${quality}${audioCodecs.join("")}${transports}`,
      secretKey: SECRET_KEY,
    });

    if (signResult.isErr()) {
      return err(signResult.error);
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await yandexMusicClient.get(
        `/get-file-info?ts=${ts}&trackId=${trackId}&quality=${quality}&codecs=${encodeURIComponent(audioCodecs.join(","))}&transports=${transports}&sign=${encodeURIComponent(signResult.value)}`,
        { headers: buildHeaders() },
      );

      if (response.status !== 200) {
        return err(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (response.data.downloadInfo.trackId !== trackId) {
        console.warn("[downloader] Track id mismatch :", response.data.downloadInfo.trackId, trackId);
        await new Promise((resolve) => setTimeout(resolve, 150));
        continue;
      }

      return ok(response.data.downloadInfo);
    }

    return err(`Failed to get track URL: too many requests`);
  } catch (error) {
    return err(`Failed to get track URL: ${error}`);
  }
}

// Получить треки из альбома
export async function getAlbumTracks(id: string): Promise<Result<string[], string>> {
  try {
    const response = await yandexMusicClient.get(
      `/albums/${id}/with-tracks?resumeStream=false&richTracks=false&withListeningFinished=false`,
      { headers: buildHeaders() },
    );

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data?.volumes) {
      return err("Invalid response format: missing volumes");
    }

    const trackIds = response.data.volumes.flatMap((volume: any[]) => volume.map((track: any) => track.id));

    return ok(trackIds);
  } catch (error) {
    return err(`Failed to get album tracks: ${error}`);
  }
}

// Получить треки из плейлиста
export async function getPlaylistTracks(id: string): Promise<Result<string[], string>> {
  try {
    const response = await yandexMusicClient.get(`/playlist/${id}?resumeStream=false&richTracks=false`, {
      headers: buildHeaders(),
    });

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data?.tracks) {
      return err("Invalid response format: missing tracks");
    }

    const trackIds = response.data.tracks.map((track: any) => track.id);

    return ok(trackIds);
  } catch (error) {
    return err(`Failed to get playlist tracks: ${error}`);
  }
}

// Получить треки артиста
export async function getArtistTracks(id: string): Promise<Result<string[], string>> {
  try {
    const response = await yandexMusicClient.get(`/artists/${id}/track-ids?`, { headers: buildHeaders() });

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data || !Array.isArray(response.data)) {
      return err("Invalid response format: missing tracks");
    }

    const trackIds = response.data;

    return ok(trackIds);
  } catch (error) {
    return err(`Failed to get artist tracks: ${error}`);
  }
}

// Получить треки по айди
export async function getTracksInfo(trackIds: string[], skipAuth = false): Promise<Result<Array<any>, string>> {
  try {
    const queryTracks = trackIds.join(",");

    const response = await yandexMusicClient.get(
      `/tracks?trackIds=${queryTracks}&removeDuplicates=false&withProgress=true`,
      {
        headers: buildHeaders(skipAuth),
      },
    );

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!Array.isArray(response.data)) {
      return err("Invalid response format: expected array");
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to get tracks info: ${error}`);
  }
}

// Добавить трек в лайки пользователя
export async function likeTrack(userId: number, trackId: string): Promise<Result<any, string>> {
  try {
    const response = await yandexMusicClient.post(
      `/users/${userId}/likes/tracks/add?trackId=${trackId}`,
      {},
      {
        headers: {
          ...buildHeaders(),
          "Content-Type": "application/json",
        },
      },
    );

    if (response.status !== 200 && response.status !== 201) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to add track to likes: ${error}`);
  }
}

// Получить информацию об аккаунте
export async function getAccountInfo(): Promise<Result<{ uid: number }, string>> {
  try {
    const response = await yandexMusicClient.get("/account/about", { headers: buildHeaders() });

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data) {
      return err("Invalid response format: missing data");
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to get account info: ${error}`);
  }
}

export async function getLikesAndHistory(): Promise<
  Result<{ favorites: { playlistUuid: string }; count: number }, string>
> {
  try {
    const response = await yandexMusicClient.get("/landing-blocks/likes-and-history", {
      headers: buildHeaders(),
    });

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data) {
      return err("Invalid response format: missing data");
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to get likes and history: ${error}`);
  }
}

// Получить настройки аккаунта
export async function getAccountSettings(): Promise<
  Result<{ adsDisabled: boolean; userMusicVisibility: string }, string>
> {
  try {
    const response = await yandexMusicClient.get("/account/settings", { headers: buildHeaders() });

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.data) {
      return err("Invalid response format: missing data");
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to get account settings: ${error}`);
  }
}

// Обновить настройки аккаунта (по ключу и значению)
export async function updateAccountSettings(
  key: string,
  value: string | number | boolean,
): Promise<Result<any, string>> {
  try {
    const response = await yandexMusicClient.post(
      `/account/settings?${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
      {},
      { headers: buildHeaders() },
    );

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to update account settings: ${error}`);
  }
}

// Получить настройки аккаунта
export async function getAccountExperiments(): Promise<Result<any, string>> {
  try {
    const response = await yandexMusicClient.get("/account/experiments/details", { headers: buildHeaders() });

    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }

    return ok(response.data);
  } catch (error) {
    return err(`Failed to get account experiments: ${error}`);
  }
}

// === Перенос библиотеки / копирование плейлистов ===

// Получить плейлисты текущего пользователя
export async function getUserPlaylists(uid: number): Promise<Result<any[], string>> {
  try {
    const response = await yandexMusicClient.get(`/users/${uid}/playlists`, { headers: buildHeaders() });
    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = response.data;
    return ok(Array.isArray(data) ? data : data?.playlists ?? []);
  } catch (error) {
    return err(`Failed to get user playlists: ${error}`);
  }
}

// Создать пустой плейлист на текущем аккаунте. Возвращает {kind, revision, ...}.
export async function createPlaylist(title: string, visibility = "private"): Promise<Result<any, string>> {
  try {
    const response = await yandexMusicClient.post(
      "/playlists/create",
      { title, visibility },
      { headers: { ...buildHeaders(), "Content-Type": "application/json" } },
    );
    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }
    return ok(response.data?.playlist ?? response.data);
  } catch (error) {
    return err(`Failed to create playlist: ${error}`);
  }
}

// Добавить треки в плейлист (по kind). Треки: [{id, albumId}].
// Использует эндпоинт change с diff-операцией insert.
export async function addTracksToPlaylist(
  playlist: { kind: number; revision: number },
  tracks: Array<{ id: string; albumId: number }>,
): Promise<Result<any, string>> {
  try {
    const account = await getAccountInfo();
    if (account.isErr()) return err(account.error);
    const uid = account.value.uid;

    const diff = [
      {
        op: "insert",
        at: 0,
        tracks: tracks.map((t) => ({ id: t.id, albumId: t.albumId })),
      },
    ];

    const response = await yandexMusicClient.post(
      `/users/${uid}/playlists/${playlist.kind}/change`,
      { revision: playlist.revision, diff: JSON.stringify(diff) },
      { headers: { ...buildHeaders(), "Content-Type": "application/json" } },
    );
    if (response.status !== 200) {
      return err(`HTTP ${response.status}: ${response.statusText}`);
    }
    return ok(response.data);
  } catch (error) {
    return err(`Failed to add tracks to playlist: ${error}`);
  }
}
