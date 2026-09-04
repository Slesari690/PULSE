import axios from "axios";
import { Md5 } from "ts-md5";
import { Result, ok, err } from "neverthrow";

/**
 * Minimal Last.fm API client used by the scrobbling feature.
 *
 * Auth flow (desktop, out-of-band):
 *   1. user enters their own api key + secret (from https://www.last.fm/api)
 *   2. auth.getToken()  -> token
 *   3. user opens authUrl(apiKey, token) in a browser and approves
 *   4. auth.getSession(apiKey, secret, token) -> sessionKey (stored long-term)
 *
 * After that, scrobble/updateNowPlaying only need apiKey + sessionKey.
 */

const BASE = "https://ws.audioscrobbler.com/2.0/";

const client = axios.create({ baseURL: BASE, validateStatus: () => true });

/** Sorted-query signature: md5(params + secret). */
function sign(params: Record<string, string | number>, secret: string): string {
  const sorted = Object.keys(params).sort();
  const raw = sorted.map((k) => `${k}${params[k]}`).join("") + secret;
  return Md5.hashStr(raw) as string;
}

function buildParams(method: string, apiKey: string, extra: Record<string, string | number>) {
  return { method, api_key: apiKey, format: "json", ...extra };
}

async function call(
  method: string,
  apiKey: string,
  secret: string | null,
  extra: Record<string, string | number>,
  signed: boolean,
): Promise<Result<any, string>> {
  const params = buildParams(method, apiKey, extra);
  if (signed && secret) {
    params.api_sig = sign(params, secret);
  }
  // Last.fm accepts POST for everything; signed calls must be POST.
  const response = await client.post("", new URLSearchParams(params as any).toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (response.status !== 200) {
    return err(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = response.data;
  if (data?.error) {
    return err(`Last.fm ${data.error}: ${data.message ?? ""}`);
  }
  return ok(data);
}

export const lastfm = {
  authUrl(apiKey: string, token: string): string {
    return `https://www.last.fm/api/auth/?api_key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(token)}`;
  },

  getToken(apiKey: string, secret: string): Promise<Result<string, string>> {
    return call("auth.getToken", apiKey, secret, {}, true).then((r) =>
      r.isErr() ? err(r.error) : ok(r.data?.token as string),
    );
  },

  getSession(apiKey: string, secret: string, token: string): Promise<Result<string, string>> {
    return call("auth.getSession", apiKey, secret, { token }, true).then((r) =>
      r.isErr() ? err(r.error) : ok(r.data?.session?.key as string),
    );
  },

  updateNowPlaying(
    apiKey: string,
    sessionKey: string,
    track: { artist: string; track: string; album?: string; durationMs?: number },
  ): Promise<Result<any, string>> {
    const extra: Record<string, string | number> = {
      sk: sessionKey,
      artist: track.artist,
      track: track.track,
    };
    if (track.album) extra.album = track.album;
    if (track.durationMs) extra.duration = Math.round(track.durationMs / 1000);
    return call("track.updateNowPlaying", apiKey, null, extra, true);
  },

  scrobble(
    apiKey: string,
    sessionKey: string,
    track: { artist: string; track: string; album?: string; timestamp: number; durationMs?: number },
  ): Promise<Result<any, string>> {
    const extra: Record<string, string | number> = {
      sk: sessionKey,
      artist: track.artist,
      track: track.track,
      timestamp: track.timestamp,
    };
    if (track.album) extra.album = track.album;
    if (track.durationMs) extra.duration = Math.round(track.durationMs / 1000);
    return call("track.scrobble", apiKey, null, extra, true);
  },
};
