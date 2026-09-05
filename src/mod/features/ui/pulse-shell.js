(function () {
  if (window.__pulseShellReady) return;
  window.__pulseShellReady = true;

  var BRAND = "PULSE";
  var EDITION = "V3";
  var GITHUB_URL = "https://github.com/Slesari690/PULSE";
  var TELEGRAM_URL = "https://t.me/freeadvertising19";
  var SECRET_KEY = "kzqU4XhfCaY6B6JTHODeq5";
  var API = "https://api.music.yandex.net";

  var lastModuleError = null;
  window.addEventListener("error", function (event) {
    if (event && event.message) lastModuleError = event.message;
  });

  /* ---------- Плюс: правим ответы Яндекса до того, как их увидит приложение ---------- */

  var PERMISSIONS = [
    "landing-play",
    "feed-play",
    "mix-play",
    "full-track-play",
    "high-quality",
    "lossless-quality",
    "no-ads",
    "offline",
    "artist-play",
    "album-play",
    "playlist-play",
    "search-play",
    "custom-lyrics",
  ];

  // Everything the app checks before deciding the user is a paying one.
  function unlockNode(node) {
    if ("hasPlus" in node || ("uid" in node && ("login" in node || "avatarId" in node))) node.hasPlus = true;
    if ("isPaywallBlocking" in node) node.isPaywallBlocking = false;
    if ("availableForPremiumUsers" in node) node.availableForPremiumUsers = true;
    if ("availableFullWithoutPermission" in node) node.availableFullWithoutPermission = true;
    if ("canPlay" in node) node.canPlay = true;
    if ("advertisement" in node) node.advertisement = null;
    if ("isAd" in node) node.isAd = false;
    if ("adsDisabled" in node) node.adsDisabled = true;

    if (node.plus && typeof node.plus === "object") node.plus.hasPlus = true;

    if (node.subscription && typeof node.subscription === "object") {
      node.subscription.canStartTrial = false;
      if (!node.subscription.autoRenewable || !node.subscription.autoRenewable.length) {
        node.subscription.nonAutoRenewableRemainder = { days: 3650 };
      }
    }

    if (node.permissions && typeof node.permissions === "object") {
      ["values", "default"].forEach(function (field) {
        if (!Array.isArray(node.permissions[field])) return;
        PERMISSIONS.forEach(function (permission) {
          if (node.permissions[field].indexOf(permission) === -1) node.permissions[field].push(permission);
        });
      });
    }
  }

  function forcePlus(data, depth) {
    depth = depth || 0;
    if (!data || typeof data !== "object" || depth > 8) return data;
    if (Array.isArray(data)) {
      if (depth > 4) return data;
      for (var i = 0; i < data.length; i++) forcePlus(data[i], depth + 1);
      return data;
    }
    try {
      unlockNode(data);
    } catch (e) {}
    if (data.result) forcePlus(data.result, depth + 1);
    if (data.data) forcePlus(data.data, depth + 1);
    if (data.account) forcePlus(data.account, depth + 1);
    return data;
  }

  try {
    var nativeParse = JSON.parse;
    JSON.parse = function (text, reviver) {
      var parsed = nativeParse.call(this, text, reviver);
      try {
        forcePlus(parsed);
      } catch (e) {}
      return parsed;
    };
  } catch (e) {}

  // fetch() never goes through JSON.parse, so the body has to be patched too.
  try {
    var nativeResponseJson = Response.prototype.json;
    Response.prototype.json = async function () {
      var data = await nativeResponseJson.call(this);
      try {
        forcePlus(data);
      } catch (e) {}
      return data;
    };
  } catch (e) {}

  /* ---------- Темы оформления ---------- */

  // "pulse" repeats the palette the mod shipped with, so an untouched install
  // looks exactly as before.
  var THEMES = [
    {
      id: "pulse",
      name: "PULSE — стандартная",
      base: "#09090f",
      content: "#101018",
      popover: "#16161f",
      player: "#12121a",
      navbar: "#0c0c14",
      accent: "#a78bfa",
      hover: "#c4b5fd",
      press: "#7c5cfc",
      onAccent: "#0b0b14",
      second: "#22d3ee",
    },
    {
      id: "neon",
      name: "Неон — розовый на чёрном",
      base: "#07060b",
      content: "#100b16",
      popover: "#180f20",
      player: "#130c1a",
      navbar: "#0c0812",
      accent: "#f472b6",
      hover: "#f9a8d4",
      press: "#db2777",
      onAccent: "#12060d",
      second: "#a855f7",
    },
    {
      id: "ocean",
      name: "Океан — синий и бирюза",
      base: "#050b14",
      content: "#0a141f",
      popover: "#0e1b29",
      player: "#0b1723",
      navbar: "#071019",
      accent: "#38bdf8",
      hover: "#7dd3fc",
      press: "#0284c7",
      onAccent: "#04121c",
      second: "#2dd4bf",
    },
    {
      id: "sunset",
      name: "Закат — тёплый оранжевый",
      base: "#120a07",
      content: "#1b0f0a",
      popover: "#24150e",
      player: "#1d110b",
      navbar: "#150c08",
      accent: "#fb923c",
      hover: "#fdba74",
      press: "#ea580c",
      onAccent: "#1a0c04",
      second: "#f43f5e",
    },
    {
      id: "matrix",
      name: "Матрица — зелёный терминал",
      base: "#030805",
      content: "#06120c",
      popover: "#081a10",
      player: "#07160e",
      navbar: "#040e09",
      accent: "#4ade80",
      hover: "#86efac",
      press: "#16a34a",
      onAccent: "#03130a",
      second: "#22d3ee",
    },
    {
      id: "sakura",
      name: "Сакура — слива и пудра",
      base: "#0f0912",
      content: "#180f1d",
      popover: "#211526",
      player: "#1a1020",
      navbar: "#130b17",
      accent: "#e9a5c7",
      hover: "#f6c9dd",
      press: "#c76b9b",
      onAccent: "#16070f",
      second: "#c4b5fd",
    },
    {
      id: "graphite",
      name: "Графит — строгий серый",
      base: "#0d0d0f",
      content: "#151518",
      popover: "#1d1d21",
      player: "#17171b",
      navbar: "#111113",
      accent: "#d4d4d8",
      hover: "#fafafa",
      press: "#a1a1aa",
      onAccent: "#0d0d0f",
      second: "#8b8b96",
    },
  ];

  var activeTheme = THEMES[0];

  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === id) return THEMES[i];
    }
    return THEMES[0];
  }

  // Custom properties are written straight onto <html>: an inline !important
  // declaration outranks any stylesheet, so the skin cannot fight back.
  function applyTheme(id) {
    activeTheme = themeById(id);
    var vars = {
      "--ym-background-color-primary-enabled-basic": activeTheme.base,
      "--ym-background-color-primary-enabled-content": activeTheme.content,
      "--ym-background-color-primary-enabled-popover": activeTheme.popover,
      "--ym-background-color-primary-enabled-player": activeTheme.player,
      "--ym-background-color-primary-enabled-header": activeTheme.base + "b8",
      "--ym-logo-color-primary-variant": activeTheme.hover,
      "--ym-logo-color-primary-player": activeTheme.hover,
      "--ym-logo-color-primary-text": activeTheme.hover,
      "--ym-controls-color-primary-default-enabled": activeTheme.accent,
      "--ym-controls-color-primary-default-hovered": activeTheme.hover,
      "--ym-controls-color-primary-default-pressed": activeTheme.press,
      "--ym-controls-color-primary-on_default-enabled": activeTheme.onAccent,
      "--ym-controls-color-primary-text-hovered": activeTheme.hover,
      "--pulse-accent": activeTheme.accent,
      "--pulse-accent-2": activeTheme.second,
      "--pulse-on-accent": activeTheme.onAccent,
    };
    Object.keys(vars).forEach(function (name) {
      document.documentElement.style.setProperty(name, vars[name], "important");
    });

    var style = document.getElementById("pulse-theme");
    if (!style) {
      style = document.createElement("style");
      style.id = "pulse-theme";
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent =
      "html,body{background-color:" +
      activeTheme.base +
      "!important}" +
      'aside[data-test-id="NAVBAR"],[class*="NavbarDesktop_root__"]{background:' +
      activeTheme.navbar +
      "!important}";

    restyleOwnUi();
  }

  // The mod's own button and menu follow the chosen palette too.
  function restyleOwnUi() {
    var gradient = "linear-gradient(135deg," + activeTheme.press + "," + activeTheme.second + ")";
    var btn = document.getElementById("pulse-open-btn");
    if (btn) {
      btn.style.background = gradient;
      btn.style.color = activeTheme.onAccent;
    }
    document.querySelectorAll("#pulse-menu [data-pulse-primary]").forEach(function (node) {
      node.style.background = gradient;
      node.style.color = activeTheme.onAccent;
    });
  }

  // The bridge to the main process appears a moment after the page does, so the
  // default palette goes up immediately and the saved one replaces it later.
  function initTheme(attempt) {
    applyTheme(activeTheme.id);
    if (!window.yandexMusicMod || !window.yandexMusicMod.getStorageValue) {
      if ((attempt || 0) < 40) setTimeout(function () {
        initTheme((attempt || 0) + 1);
      }, 250);
      return;
    }
    window.yandexMusicMod
      .getStorageValue("pulse/theme")
      .then(function (id) {
        applyTheme(id || "pulse");
      })
      .catch(function () {});
  }

  /* ---------- Экономия ресурсов, пока окно не в фокусе ---------- */

  // Yandex keeps animating the Vibe background and the player chrome even when
  // the window is behind a game, which costs real GPU time.
  function initIdleSaver() {
    try {
      var idleStyle = document.createElement("style");
      idleStyle.textContent =
        "html.pulse-idle *,html.pulse-idle *::before,html.pulse-idle *::after" +
        "{animation-play-state:paused!important;transition:none!important}" +
        "html.pulse-idle canvas,html.pulse-idle video{display:none!important}";
      (document.head || document.documentElement).appendChild(idleStyle);

      var syncIdle = function () {
        document.documentElement.classList.toggle("pulse-idle", !document.hasFocus());
      };
      window.addEventListener("blur", syncIdle);
      window.addEventListener("focus", syncIdle);
      syncIdle();
    } catch (e) {}
  }

  /* ---------- Слепок собственных запросов приложения ---------- */

  // Yandex signs /get-file-info with a secret that changes between app releases.
  // Instead of hardcoding it, grab whatever key the app itself imports.
  var secrets = [SECRET_KEY];

  function rememberSecret(keyData) {
    try {
      var view = keyData instanceof ArrayBuffer ? new Uint8Array(keyData) : new Uint8Array(keyData.buffer || keyData);
      var text = new TextDecoder().decode(view);
      if (!/^[\x21-\x7e]{16,64}$/.test(text)) return;
      if (secrets.indexOf(text) === -1) secrets.unshift(text);
    } catch (e) {}
  }

  try {
    var nativeImportKey = crypto.subtle.importKey.bind(crypto.subtle);
    crypto.subtle.importKey = function (format, keyData, algorithm) {
      var name = (algorithm && (algorithm.name || algorithm)) || "";
      if (format === "raw" && String(name).toUpperCase() === "HMAC") rememberSecret(keyData);
      return nativeImportKey.apply(null, arguments);
    };
  } catch (e) {}

  // The app asks for a download link of every track it plays. Reuse that answer
  // instead of trying to reproduce the request.
  var apiHeaderTemplate = null;
  var fileInfoQuery = null;
  var fileInfoByTrack = {};
  var lastFileInfo = null;

  function isApiUrl(url) {
    return String(url || "").indexOf("api.music.yandex.net") !== -1;
  }

  function isFileInfoUrl(url) {
    return String(url || "").indexOf("get-file-info") !== -1;
  }

  // Yandex checks far more than the OAuth token: the device id, the icookie and
  // the blackbox user ticket all take part in deciding whether a link is given
  // out. Copying the header set of a request the app just made is the only way
  // to look exactly like the app.
  function rememberApiHeaders(headers) {
    if (!headers) return;
    var kept = {};
    Object.keys(headers).forEach(function (name) {
      var lower = String(name).toLowerCase();
      // Per-request values: replaying a stale trace or deadline gets the request
      // rejected outright.
      if (
        [
          "content-type",
          "content-length",
          "accept-encoding",
          "x-request-id",
          "x-request-deadline-ms",
          "traceparent",
          "tracestate",
        ].indexOf(lower) !== -1
      ) {
        return;
      }
      if (headers[name]) kept[lower] = headers[name];
    });
    if (Object.keys(kept).length) apiHeaderTemplate = kept;
  }

  function rememberFileInfoQuery(url) {
    try {
      var query = new URLSearchParams(String(url).split("?")[1] || "");
      if (!query.get("codecs")) return;
      fileInfoQuery = { codecs: query.get("codecs"), transports: query.get("transports") };
    } catch (e) {}
  }

  // Depending on the endpoint Yandex answers with a single url or a list of
  // mirrors; the main process only knows about downloadInfo.url.
  function normalizeInfo(info) {
    if (!info || info.error || !info.trackId) return null;
    if (!info.url && Array.isArray(info.urls) && info.urls.length) info.url = info.urls[0];
    return info.url ? info : null;
  }

  function rememberDownloadInfo(info) {
    var normalized = normalizeInfo(info);
    if (!normalized) return;
    fileInfoByTrack[String(normalized.trackId)] = normalized;
    lastFileInfo = normalized;
  }

  // Radio pages prefetch the whole upcoming queue through /get-file-info/batch,
  // whose answer carries downloadInfos[] instead of a single downloadInfo. That
  // is why "Моя волна" used to yield nothing to reuse.
  function rememberFileInfoResponse(data, depth) {
    if (!data || typeof data !== "object" || (depth || 0) > 3) return;
    rememberDownloadInfo(data.downloadInfo);
    if (Array.isArray(data.downloadInfos)) data.downloadInfos.forEach(rememberDownloadInfo);
    if (data.result) rememberFileInfoResponse(data.result, (depth || 0) + 1);
  }

  try {
    var nativeOpen = XMLHttpRequest.prototype.open;
    var nativeSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    var nativeSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__pulseUrl = String(url || "");
      this.__pulseHeaders = {};
      return nativeOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      try {
        if (!this.__pulseHeaders) this.__pulseHeaders = {};
        this.__pulseHeaders[name] = value;
      } catch (e) {}
      return nativeSetHeader.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      var self = this;
      if (isApiUrl(this.__pulseUrl) && !this.__pulseMine) rememberApiHeaders(this.__pulseHeaders);

      if (isFileInfoUrl(this.__pulseUrl)) {
        rememberFileInfoQuery(this.__pulseUrl);
        this.addEventListener("load", function () {
          try {
            rememberFileInfoResponse(JSON.parse(self.responseText));
          } catch (e) {}
        });
      }

      if (isApiUrl(this.__pulseUrl)) {
        this.addEventListener("readystatechange", function () {
          if (self.readyState !== 4) return;
          if (self.responseType !== "" && self.responseType !== "text") return;
          try {
            var patched = JSON.stringify(forcePlus(JSON.parse(self.responseText)));
            Object.defineProperty(self, "responseText", {
              configurable: true,
              get: function () {
                return patched;
              },
            });
            Object.defineProperty(self, "response", {
              configurable: true,
              get: function () {
                return patched;
              },
            });
          } catch (e) {}
        });
      }

      return nativeSend.apply(this, arguments);
    };
  } catch (e) {}

  try {
    var nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var promise = nativeFetch.apply(this, arguments);
      if (isApiUrl(url)) {
        var headers = {};
        try {
          var source = (init && init.headers) || (input && input.headers);
          if (source && typeof source.forEach === "function") {
            source.forEach(function (value, name) {
              headers[name] = value;
            });
          } else if (source) {
            Object.keys(source).forEach(function (name) {
              headers[name] = source[name];
            });
          }
        } catch (e) {}
        rememberApiHeaders(headers);
      }
      if (isFileInfoUrl(url)) {
        rememberFileInfoQuery(url);
        promise
          .then(function (response) {
            return response.clone().json();
          })
          .then(function (data) {
            rememberFileInfoResponse(data);
          })
          .catch(function () {});
      }
      return promise;
    };
  } catch (e) {}

  /* ---------- Работа с API Яндекса ---------- */

  var lastApiStatus = null;
  var lastApiDetail = "";

  // The refusal reason hides in a different field depending on the endpoint.
  function describeApiError(res) {
    var data = res && res.data;
    var node = (data && (data.error || data.invocationInfo || data.result)) || data;

    if (node && typeof node === "object") {
      var parts = [];
      ["name", "message", "reason", "detail", "description"].forEach(function (field) {
        if (typeof node[field] === "string" && node[field] && parts.indexOf(node[field]) === -1) {
          parts.push(node[field]);
        }
      });
      if (parts.length) return parts.join(": ");
    }
    if (typeof node === "string" && node) return node;

    var text = String((res && res.text) || "").trim();
    return text ? text.slice(0, 200) : "";
  }

  function oauthToken() {
    try {
      if (localStorage.oauth) {
        var stored = JSON.parse(localStorage.oauth);
        if (stored && stored.value) return "OAuth " + stored.value;
      }
    } catch (e) {}

    // The app has moved this key around between releases, so as a last resort
    // look for anything in localStorage that looks like a Yandex token.
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var raw = localStorage.getItem(localStorage.key(i)) || "";
        var match = raw.match(/y0_[A-Za-z0-9_\-.]{20,}/);
        if (match) return "OAuth " + match[0];
      }
    } catch (e) {}

    return null;
  }

  function apiHeaders(skipAuth) {
    var headers = {
      "x-yandex-music-client": "YandexMusicDesktopAppWindows/" + (window.VERSION || "5.118.1"),
      "x-yandex-music-frontend": "new",
      "x-yandex-music-without-invocation-info": "1",
    };

    // Whatever the app sent last wins: it carries the device id, the icookie and
    // the blackbox ticket, and without those Yandex answers 451.
    if (apiHeaderTemplate) {
      Object.keys(apiHeaderTemplate).forEach(function (name) {
        headers[name] = apiHeaderTemplate[name];
      });
    }

    // A token lifted from a real request beats one dug out of localStorage.
    var token = oauthToken();
    if (skipAuth) delete headers.authorization;
    else if (!headers.authorization && token) headers.authorization = token;

    return headers;
  }

  // Must run inside the renderer: Yandex answers 451 to the very same request
  // when it comes from the main process instead of the app window.
  function xhrJson(url, headers) {
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.__pulseMine = true;
      xhr.withCredentials = true;
      Object.keys(headers).forEach(function (name) {
        if (headers[name]) xhr.setRequestHeader(name, headers[name]);
      });
      xhr.onload = function () {
        var data = null;
        var text = "";
        try {
          text = xhr.responseText || "";
        } catch (e) {}
        try {
          data = JSON.parse(text);
        } catch (e) {}
        resolve({ status: xhr.status, data: data, text: text });
      };
      xhr.onerror = function () {
        resolve({ status: 0, data: null, text: "" });
      };
      xhr.send();
    });
  }

  async function apiGet(path, skipAuth, extraHeaders) {
    var headers = apiHeaders(skipAuth);
    if (extraHeaders) {
      Object.keys(extraHeaders).forEach(function (name) {
        if (extraHeaders[name]) headers[name] = extraHeaders[name];
      });
    }
    var res = await xhrJson(API + path, headers);

    // Fall back to the main process only for transport errors — a real HTTP
    // status from Yandex has to be reported as is.
    if (res.status === 0 && window.yandexMusicMod && window.yandexMusicMod.axios) {
      var viaMain = await window.yandexMusicMod.axios({ url: API + path, method: "GET", headers: headers });
      res = { status: (viaMain && viaMain.status) || 0, data: viaMain && viaMain.data };
    }

    lastApiStatus = res.status;
    if (res.status !== 200) {
      // Yandex says why it refused in the body; throwing only the status code
      // away made every failure look identical.
      var detail = describeApiError(res);
      lastApiDetail = detail;
      var error = new Error("HTTP " + res.status + (detail ? " — " + detail : ""));
      error.status = res.status;
      error.detail = detail;
      throw error;
    }
    lastApiDetail = "";
    return forcePlus(res.data);
  }

  async function hmacSign(secret, data) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
      "sign",
    ]);
    var sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(sig)))).slice(0, -1);
  }

  // Taken from the client itself: its own downloader asks for these four codecs
  // and skips the mp4 containers the streaming path uses.
  var CODECS = "flac,aac,he-aac,mp3";
  // "raw" hands back a plain file, "encraw" an encrypted one that has to be run
  // through the key from downloadInfo, so plain is tried first.
  var TRANSPORTS = ["raw", "encraw"];
  var QUALITIES = ["lossless", "hq", "nq", "lq"];

  // Same string the app signs: ts, id, quality, codecs and transports glued
  // together with no separators.
  async function requestDownloadInfo(trackId, quality, transport, secret, batch) {
    var codecs = CODECS;
    var ts = Math.floor(Date.now() / 1000);
    var sign = await hmacSign(secret, ts + trackId + quality + codecs.split(",").join("") + transport);
    var path =
      "/get-file-info" +
      (batch ? "/batch?ts=" : "?ts=") +
      ts +
      (batch ? "&trackIds=" : "&trackId=") +
      encodeURIComponent(trackId) +
      "&quality=" +
      encodeURIComponent(quality) +
      "&codecs=" +
      encodeURIComponent(codecs) +
      "&transports=" +
      encodeURIComponent(transport) +
      "&sign=" +
      encodeURIComponent(sign);

    var data = await apiGet(path);
    rememberFileInfoResponse(data);

    var candidates = [];
    if (data && data.downloadInfo) candidates.push(data.downloadInfo);
    if (data && Array.isArray(data.downloadInfos)) candidates = candidates.concat(data.downloadInfos);

    for (var i = 0; i < candidates.length; i++) {
      var info = normalizeInfo(candidates[i]);
      if (info && String(info.trackId) === String(trackId)) return info;
    }
    return null;
  }

  // Chromium hands the main process the exact URL and headers of every request
  // the app makes. A /get-file-info URL already carries a signature Yandex
  // accepts, and signatures stay valid for a while, so re-sending one is the
  // most dependable way to get a link.
  var replayCache = {};

  async function replayAppFileInfo(trackId) {
    var mod = window.yandexMusicMod;
    if (!mod || !mod.fileInfoRequests) return null;

    var requests;
    try {
      requests = await mod.fileInfoRequests();
    } catch (e) {
      return null;
    }
    if (!Array.isArray(requests)) return null;

    for (var i = 0; i < requests.length; i++) {
      var request = requests[i];
      if (!request || !request.url || replayCache[request.url]) continue;
      if (request.url.indexOf(encodeURIComponent(trackId)) === -1 && request.url.indexOf(trackId) === -1) continue;

      replayCache[request.url] = true;
      rememberApiHeaders(request.headers);

      var res = await xhrJson(request.url, apiHeaders());
      lastApiStatus = res.status;
      if (res.status !== 200) continue;

      rememberFileInfoResponse(res.data);
      if (fileInfoByTrack[trackId]) return fileInfoByTrack[trackId];
    }
    return null;
  }

  async function getDownloadInfo(trackId, quality, waitForApp) {
    trackId = String(trackId);
    if (cachedInfoFor(trackId)) return cachedInfoFor(trackId);

    var qualities = [quality].concat(
      QUALITIES.filter(function (q) {
        return q !== quality;
      }),
    );

    var lastStatus = 0;
    var lastDetail = "";
    for (var s = 0; s < secrets.length; s++) {
      for (var q = 0; q < qualities.length; q++) {
        for (var t = 0; t < TRANSPORTS.length; t++) {
          for (var b = 0; b < 2; b++) {
            if (fileInfoByTrack[trackId]) return fileInfoByTrack[trackId];
            try {
              var info = await requestDownloadInfo(trackId, qualities[q], TRANSPORTS[t], secrets[s], b === 1);
              if (info) return info;
            } catch (e) {
              lastStatus = e.status || 0;
              lastDetail = e.detail || "";
              // Anything other than a refusal means retrying is pointless.
              if (lastStatus !== 451 && lastStatus !== 403 && lastStatus !== 404) throw e;
            }
          }
        }
      }
    }

    // Replay the app's own signed request, captured by the main process at the
    // network level. Its signature is already accepted by Yandex, so this works
    // even when the mod cannot produce a valid one itself.
    var replayed = await replayAppFileInfo(trackId);
    if (replayed) return replayed;

    // Last resort for a single track: the app fetches the link itself while the
    // track plays, so give it a few seconds to do the work for us.
    if (waitForApp) {
      for (var wait = 0; wait < 24; wait++) {
        if (fileInfoByTrack[trackId]) return fileInfoByTrack[trackId];
        if (wait === 8 || wait === 16) {
          var late = await replayAppFileInfo(trackId);
          if (late) return late;
        }
        await sleep(250);
      }
    }

    var refused = new Error("HTTP " + lastStatus);
    refused.status = lastStatus;
    refused.detail = lastDetail;
    refused.trackId = trackId;
    throw refused;
  }

  // Yandex refuses anonymous reads of /tracks with 451, while an authorized read
  // marks Plus-only tracks as unavailable. So: ask as ourselves first, and only
  // fall back to an anonymous read if that is refused. forcePlus repairs the
  // availability flags either way.
  async function getTracksInfo(ids) {
    var path = "/tracks?trackIds=" + ids.join(",") + "&removeDuplicates=false&withProgress=true";
    var data;
    try {
      data = await apiGet(path);
    } catch (error) {
      try {
        data = await apiGet(path, true);
      } catch (anonymous) {
        anonymous.stage = "список треков";
        throw anonymous;
      }
    }
    if (data && !Array.isArray(data) && Array.isArray(data.result)) return data.result;
    return Array.isArray(data) ? data : [];
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /* ---------- Определение текущего трека и текущей страницы ---------- */

  function findCurrentTrackId() {
    var roots = document.querySelectorAll(
      'section[data-test-id="PLAYERBAR_DESKTOP"], [class*="PlayerBar"], [class*="VibeDesktopPlayer"]',
    );
    for (var r = 0; r < roots.length; r++) {
      var nodes = [roots[r]].concat(Array.prototype.slice.call(roots[r].querySelectorAll("*")));
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        for (var key in el) {
          if (key.indexOf("__reactFiber") !== 0 && key.indexOf("__reactInternalInstance") !== 0) continue;
          var fiber = el[key];
          for (var hop = 0; hop < 60 && fiber; hop++, fiber = fiber.return) {
            var props = fiber.memoizedProps || fiber.pendingProps || {};
            var meta = props.entityMeta || (props.entity && props.entity.meta) || props.track;
            if (meta && (meta.id || meta.realId) && meta.title) return String(meta.id || meta.realId);
          }
        }
      }
    }
    return null;
  }

  function currentPage() {
    var href = window.location.href;
    var params = new URLSearchParams(window.location.search);
    if (href.indexOf("/artist") !== -1 && params.get("artistId")) {
      return { type: "artist", id: params.get("artistId"), label: "артиста" };
    }
    if (href.indexOf("/album") !== -1 && params.get("albumId")) {
      return { type: "album", id: params.get("albumId"), label: "альбом" };
    }
    if (href.indexOf("/playlists") !== -1 && params.get("playlistUuid")) {
      return { type: "playlist", id: params.get("playlistUuid"), label: "плейлист" };
    }
    return null;
  }

  async function collectPageTrackIds(page) {
    if (page.type === "album") {
      var album = await apiGet(
        "/albums/" + page.id + "/with-tracks?resumeStream=false&richTracks=false&withListeningFinished=false",
      );
      var ids = [];
      (album.volumes || []).forEach(function (volume) {
        volume.forEach(function (track) {
          ids.push(track.id);
        });
      });
      return ids;
    }
    if (page.type === "playlist") {
      var playlist = await apiGet("/playlist/" + page.id + "?resumeStream=false&richTracks=false");
      return (playlist.tracks || []).map(function (track) {
        return track.id;
      });
    }
    var artistTracks = await apiGet("/artists/" + page.id + "/track-ids?");
    return Array.isArray(artistTracks) ? artistTracks : [];
  }

  /* ---------- Скачивание ---------- */

  var busy = false;

  function explain(error) {
    var status = error && error.status;
    if (status === 451 || status === 403) {
      if (!oauthToken()) return "Нет авторизации: PULSE не видит твой аккаунт. Войди в Яндекс Музыку внутри PULSE и повтори.";
      if (!apiHeaderTemplate) {
        return (
          "Яндекс отказал (" +
          status +
          "). PULSE ещё не подсмотрел заголовки клиента: включи любой трек, дай ему проиграть пару секунд и повтори."
        );
      }
      return (
        "Яндекс отказал (" +
        status +
        ") на шаге «" +
        (error.stage || (error.trackId ? "ссылка на файл" : "неизвестен")) +
        "»" +
        (error.trackId ? ", трек " + error.trackId : "") +
        ". Ответ сервера: " +
        (error.detail || "пустой") +
        ". Нажми «Диагностика» и пришли отчёт."
      );
    }
    if (status === 404) return "Трек недоступен для скачивания.";
    if (status === 0) return "Нет связи с api.music.yandex.net.";
    return String((error && error.message) || error);
  }

  function stubTrack(id) {
    var metadata = null;
    try {
      metadata = navigator.mediaSession && navigator.mediaSession.metadata;
    } catch (e) {}
    var fromPlayer = null;
    try {
      var state = typeof window.__getPlayerState === "function" ? window.__getPlayerState() : null;
      fromPlayer = state && state.data && state.data.trackMeta;
    } catch (e) {}
    return {
      id: id,
      title: (fromPlayer && fromPlayer.title) || (metadata && metadata.title) || "Track " + id,
      artists:
        (fromPlayer && fromPlayer.artists) ||
        [{ name: (metadata && metadata.artist) || "Unknown" }],
      albums:
        (fromPlayer && fromPlayer.albums) ||
        (metadata && metadata.album ? [{ title: metadata.album }] : []),
      coverUri: fromPlayer && fromPlayer.coverUri,
    };
  }

  function cachedInfoFor(id) {
    var raw = String(id || "");
    if (fileInfoByTrack[raw]) return fileInfoByTrack[raw];
    var bare = raw.split(":")[0];
    return fileInfoByTrack[bare] || null;
  }

  async function downloadByIds(ids) {
    var mod = window.yandexMusicMod;
    var quality = (await mod.getStorageValue("downloader/quality")) || "lossless";
    var folder = (await mod.getStorageValue("downloadFolderPath")) || "";
    var done = 0;
    var failed = 0;
    var refusedInARow = 0;
    var lastError = "";

    for (var start = 0; start < ids.length; start += 50) {
      var chunk = ids.slice(start, start + 50);
      var listed = [];
      try {
        listed = await getTracksInfo(chunk);
      } catch (error) {
        // /tracks is only needed for the file name. A 451 here used to abort
        // the whole download even when the link was already in memory.
      }

      var byId = {};
      listed.forEach(function (track) {
        if (!track) return;
        byId[String(track.id)] = track;
        if (track.realId) byId[String(track.realId)] = track;
      });

      for (var i = 0; i < chunk.length; i++) {
        var id = String(chunk[i]);
        var track = byId[id] || byId[id.split(":")[0]] || stubTrack(id);
        var name = (track.artists || []).map(function (a) {
          return a.name;
        });
        var title = (name.join(", ") || "?") + " — " + (track.title || id);
        setStatus("Скачиваю " + (done + failed + 1) + " из " + ids.length + ": " + title);

        try {
          var info = cachedInfoFor(id) || cachedInfoFor(track.id);
          if (!info) info = await getDownloadInfo(id, quality, ids.length === 1);
          if (!info) {
            failed++;
            lastError = "Яндекс не отдал ссылку на файл.";
            continue;
          }
          var result = await mod.downloadTrack(info, track, folder);
          if (result && result.error) {
            failed++;
            lastError = result.error;
          } else {
            done++;
            refusedInARow = 0;
          }
        } catch (e) {
          failed++;
          refusedInARow++;
          lastError = explain(e);
          // No point in walking a 500-track playlist if Yandex refuses every link.
          if (!done && refusedInARow >= 3) return setStatus(lastError);
        }
      }
    }

    if (!done) {
      setStatus("Не скачалось ни одного трека. " + (lastError || ""));
      return;
    }
    setStatus(
      "Готово. Скачано: " +
        done +
        (failed ? ", не удалось: " + failed + ". " + lastError : ". Файлы в папке загрузок."),
    );
  }

  // The mod's own renderer already reads the player state straight out of the
  // app's store — the same source Discord RPC and the scrobbler use. That is
  // authoritative, unlike scraping the DOM.
  function playerStateTrackId() {
    try {
      if (typeof window.__getPlayerState !== "function") return null;
      var state = window.__getPlayerState();
      var meta = state && state.data && state.data.trackMeta;
      return meta && meta.id ? String(meta.id) : null;
    } catch (e) {
      return null;
    }
  }

  function simplifyTitle(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[\s\u2010-\u2015_.,!?"'`()\[\]]/g, "");
  }

  // The app feeds the Windows media overlay, so mediaSession always holds the
  // title that is actually playing. Matching it against the tracks whose links
  // were captured tells us which of them is the current one — radio prefetches
  // the next track, so the newest link is not a safe answer.
  async function trackIdFromMediaSession() {
    try {
      var metadata = navigator.mediaSession && navigator.mediaSession.metadata;
      if (!metadata || !metadata.title) return null;

      var ids = Object.keys(fileInfoByTrack);
      if (!ids.length) return null;
      if (ids.length === 1) return ids[0];

      var wanted = simplifyTitle(metadata.title);
      var tracks = await getTracksInfo(ids);
      for (var i = 0; i < tracks.length; i++) {
        if (tracks[i] && simplifyTitle(tracks[i].title) === wanted) return String(tracks[i].id);
      }
    } catch (e) {}
    return null;
  }

  function resolveCurrentTrackId() {
    return playerStateTrackId() || findCurrentTrackId();
  }

  // On radio pages neither the player store nor the markup gives up the id, so
  // the media overlay is asked before falling back to the newest captured link.
  async function resolveCurrentTrackIdAsync() {
    var known = resolveCurrentTrackId();
    if (known) return known;

    var matched = await trackIdFromMediaSession();
    if (matched) return matched;

    return lastFileInfo && lastFileInfo.trackId ? String(lastFileInfo.trackId) : null;
  }

  async function downloadCurrentTrack() {
    if (!window.yandexMusicMod) return setStatus("API мода недоступен. Перезапусти PULSE.");
    var trackId = await resolveCurrentTrackIdAsync();
    if (!trackId) return setStatus("Трек не найден. Включи воспроизведение и нажми ещё раз.");
    await downloadByIds([trackId]);
  }

  async function downloadCurrentPage() {
    if (!window.yandexMusicMod) return setStatus("API мода недоступен. Перезапусти PULSE.");
    var page = currentPage();
    if (!page) return setStatus("Открой страницу альбома, плейлиста или артиста и нажми ещё раз.");
    setStatus("Получаю список треков…");
    var ids = await collectPageTrackIds(page);
    if (!ids.length) return setStatus("В этом разделе не нашлось треков.");
    await downloadByIds(ids);
  }

  // Walks the whole download chain and writes down what each step answered, so
  // a failure can be read instead of guessed at.
  async function buildReport() {
    var lines = [];
    var add = function (label, value) {
      lines.push(label + ": " + value);
    };

    add("версия мода", "3.1.5");
    add("версия клиента", window.VERSION || "неизвестна");
    add("страница", window.location.pathname + window.location.search);
    add("токен", oauthToken() ? "есть" : "нет");
    add("ключей подписи", secrets.length + (secrets.length > 1 ? " (перехвачен)" : " (только встроенный)"));
    add("заголовки клиента", apiHeaderTemplate ? Object.keys(apiHeaderTemplate).sort().join(", ") : "не перехвачены");

    var cachedIds = Object.keys(fileInfoByTrack);
    add("ссылок в памяти", cachedIds.length + (cachedIds.length ? " [" + cachedIds.slice(0, 10).join(", ") + "]" : ""));

    var media = null;
    try {
      media = navigator.mediaSession && navigator.mediaSession.metadata;
    } catch (e) {}

    add("трек из плеера", playerStateTrackId() || "не найден");
    add("трек со страницы", findCurrentTrackId() || "не найден");
    add("медиа-оверлей", media && media.title ? media.title + " — " + (media.artist || "?") : "пусто");
    add("трек из последней ссылки", lastFileInfo ? lastFileInfo.trackId : "нет");

    // Probe the metadata request separately: it runs before any link is asked
    // for, so a refusal here stops the download before it starts.
    try {
      var listed = await getTracksInfo(Object.keys(fileInfoByTrack).slice(0, 2));
      add("список треков", "получен, треков " + listed.length);
    } catch (e) {
      add("список треков", "HTTP " + (e.status || 0) + " — " + (e.detail || "тело пустое"));
    }

    var chosen = await resolveCurrentTrackIdAsync();
    add("выбран трек", chosen || "нет");

    var requests = [];
    try {
      if (window.yandexMusicMod && window.yandexMusicMod.fileInfoRequests) {
        requests = (await window.yandexMusicMod.fileInfoRequests()) || [];
      }
    } catch (e) {}
    add("запросов клиента видно", requests.length);
    if (requests.length) {
      add("последний запрос клиента", String(requests[0].url).slice(0, 220));
      add("его заголовки", Object.keys(requests[0].headers || {}).sort().join(", "));
    }

    // One live probe per quality so the report carries real server answers.
    var probeId = chosen;
    if (probeId) {
      for (var q = 0; q < QUALITIES.length; q++) {
        try {
          var info = await requestDownloadInfo(probeId, QUALITIES[q], "raw", secrets[0], false);
          add("проба " + QUALITIES[q], info ? "ссылка получена" : "200, но без ссылки");
        } catch (e) {
          add("проба " + QUALITIES[q], "HTTP " + (e.status || 0) + " — " + (e.detail || "тело пустое"));
        }
      }
    }

    // Deliberately routed through the main process: in the renderer both
    // JSON.parse and apiGet already force hasPlus to true, so the real answer
    // is only visible from outside the page.
    try {
      var raw = await window.yandexMusicMod.axios({
        url: API + "/account/status",
        method: "GET",
        headers: apiHeaders(),
      });
      var account = (raw && raw.data && (raw.data.result || raw.data)) || {};
      add(
        "подписка по данным сервера",
        (account.plus && account.plus.hasPlus ? "есть" : "нет") +
          (account.subscription && account.subscription.autoRenewable && account.subscription.autoRenewable.length
            ? ", автопродление"
            : ""),
      );
    } catch (e) {
      add("подписка по данным сервера", "не удалось: " + e.message);
    }

    add("последний ответ API", lastApiStatus === null ? "запросов не было" : lastApiStatus + " " + lastApiDetail);

    return lines.join("\n");
  }

  async function showReport() {
    setStatus("Собираю отчёт, это займёт несколько секунд…");
    var report = await buildReport();
    try {
      await navigator.clipboard.writeText(report);
      setStatus("Отчёт скопирован в буфер обмена — вставь его в переписку.");
    } catch (e) {
      setStatus("Скопируй отчёт из окна ниже.");
    }

    var box = document.createElement("textarea");
    box.value = report;
    box.setAttribute(
      "style",
      "position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;width:min(680px,92vw);" +
        "height:min(420px,70vh);padding:14px;border-radius:14px;border:1px solid rgba(167,139,250,.35);" +
        "background:#0b0b12;color:#e8e6f5;font:400 12px/1.5 Consolas,monospace;resize:none",
    );
    box.readOnly = true;
    box.onblur = function () {
      box.remove();
    };
    document.documentElement.appendChild(box);
    box.focus();
    box.select();
  }

  function guard(fn) {
    return function () {
      if (busy) return setStatus("Подожди, предыдущая операция ещё идёт.");
      busy = true;
      Promise.resolve()
        .then(fn)
        .catch(function (e) {
          setStatus("Ошибка: " + explain(e));
        })
        .finally(function () {
          busy = false;
        });
    };
  }

  /* ---------- Интерфейс ---------- */

  function setStatus(text) {
    var el = document.getElementById("pulse-status");
    if (el) el.textContent = text;
  }

  function el(tag, style, text) {
    var node = document.createElement(tag);
    if (style) node.setAttribute("style", style);
    if (text != null) node.textContent = text;
    return node;
  }

  function button(label, primary) {
    var base =
      "height:40px;padding:0 14px;border-radius:12px;cursor:pointer;font:600 13px/40px Segoe UI,Arial,sans-serif;text-align:center;";
    var skin = primary
      ? "border:0;background:linear-gradient(135deg," +
        activeTheme.press +
        "," +
        activeTheme.second +
        ");color:" +
        activeTheme.onAccent +
        ";font-weight:800;"
      : "border:1px solid rgba(255,255,255,.16);background:#1a1a26;color:#f4f1ff;";
    var node = el("button", base + skin, label);
    node.type = "button";
    if (primary) node.setAttribute("data-pulse-primary", "1");
    return node;
  }

  function sectionTitle(text) {
    return el("div", "margin-top:6px;font:700 11px/1 Segoe UI,Arial,sans-serif;letter-spacing:.18em;color:#8b8ba7", text);
  }

  function toggleRow(label, storageKey, defaultOn) {
    var row = el(
      "label",
      "display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;font:400 13px/1.3 Segoe UI,Arial,sans-serif;color:#e8e6f5",
    );
    row.appendChild(el("span", null, label));

    var input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("style", "width:38px;height:20px;cursor:pointer;accent-color:#7c5cfc");
    row.appendChild(input);

    window.yandexMusicMod.getStorageValue(storageKey).then(function (value) {
      input.checked = value === null || value === undefined ? !!defaultOn : !!value;
    });
    input.addEventListener("change", function () {
      window.yandexMusicMod.setStorageValue(storageKey, input.checked);
      applyPlayerSetting(storageKey, input.checked);
      setStatus("Сохранено: " + label + (input.checked ? " — вкл" : " — выкл"));
    });
    return row;
  }

  function sliderRow(label, storageKey, min, max, step, fallback, suffix) {
    var wrap = el("div", "display:flex;flex-direction:column;gap:6px");
    var head = el("div", "display:flex;justify-content:space-between;font:400 13px/1.3 Segoe UI,Arial,sans-serif;color:#e8e6f5");
    head.appendChild(el("span", null, label));
    var value = el("span", "color:#c4b5fd", "—");
    head.appendChild(value);
    wrap.appendChild(head);

    var input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.setAttribute("style", "width:100%;accent-color:#7c5cfc;cursor:pointer");
    wrap.appendChild(input);

    window.yandexMusicMod.getStorageValue(storageKey).then(function (stored) {
      var current = typeof stored === "number" ? stored : fallback;
      input.value = String(current);
      value.textContent = current + (suffix || "");
    });
    input.addEventListener("input", function () {
      value.textContent = input.value + (suffix || "");
      applyPlayerSetting(storageKey, parseFloat(input.value));
    });
    input.addEventListener("change", function () {
      window.yandexMusicMod.setStorageValue(storageKey, parseFloat(input.value));
      applyPlayerSetting(storageKey, parseFloat(input.value));
      setStatus("Сохранено: " + label + " — " + input.value + (suffix || ""));
    });
    return wrap;
  }

  function selectRow(label, options, current, onPick) {
    var row = el("div", "display:flex;align-items:center;justify-content:space-between;gap:12px");
    row.appendChild(el("span", "font:400 13px/1.3 Segoe UI,Arial,sans-serif;color:#e8e6f5", label));

    var select = document.createElement("select");
    select.setAttribute(
      "style",
      "flex:1;max-width:200px;height:34px;border-radius:10px;background:#1a1a26;color:#fff;" +
        "border:1px solid rgba(255,255,255,.16);padding:0 8px;cursor:pointer",
    );
    options.forEach(function (pair) {
      var option = document.createElement("option");
      option.value = pair[0];
      option.textContent = pair[1];
      select.appendChild(option);
    });
    select.value = current;
    select.addEventListener("change", function () {
      onPick(select.value, select.options[select.selectedIndex].textContent);
    });
    row.appendChild(select);
    return row;
  }

  function closeMenu() {
    var root = document.getElementById("pulse-menu");
    if (root) root.remove();
  }

  function openMenu() {
    if (document.getElementById("pulse-menu")) return;

    var overlay = el(
      "div",
      "position:fixed;inset:0;z-index:2147483646;font-family:Segoe UI,Arial,sans-serif;-webkit-app-region:no-drag",
    );
    overlay.id = "pulse-menu";

    var backdrop = el("div", "position:absolute;inset:0;background:rgba(4,4,10,.6)");
    backdrop.onclick = closeMenu;
    overlay.appendChild(backdrop);

    var panel = el(
      "div",
      "position:absolute;left:0;top:0;bottom:0;width:min(420px,100%);display:flex;flex-direction:column;" +
        "background:linear-gradient(180deg,#15151f 0%,#09090f 100%);border-right:1px solid rgba(167,139,250,.22);" +
        "box-shadow:18px 0 48px rgba(0,0,0,.55);color:#fff",
    );
    overlay.appendChild(panel);

    var header = el("div", "padding:18px 18px 12px;border-bottom:1px solid rgba(255,255,255,.07)");
    header.appendChild(
      el("div", "font:800 20px/1 Segoe UI,Arial,sans-serif;letter-spacing:.3em", BRAND + " " + EDITION),
    );
    var cached = Object.keys(fileInfoByTrack).length;
    var diagnostics = [
      oauthToken() ? "аккаунт найден" : "аккаунт не найден",
      window.__PULSE_BOOTED ? "модули загружены" : lastModuleError ? "ошибка: " + lastModuleError : "модули грузятся",
      secrets.length > 1 ? "ключ перехвачен" : "ключ по умолчанию",
      apiHeaderTemplate ? "заголовки клиента есть" : "заголовки не перехвачены",
      "ссылок в памяти: " + cached,
      lastApiStatus === null ? "запросов не было" : "последний ответ API: " + lastApiStatus,
    ];
    var diagnosticsLine = el(
      "div",
      "margin-top:6px;font:400 12px/1.4 Segoe UI,Arial,sans-serif;color:#9a97b8",
      diagnostics.join(" · "),
    );
    header.appendChild(diagnosticsLine);
    panel.appendChild(header);

    if (window.yandexMusicMod && window.yandexMusicMod.fileInfoRequests) {
      window.yandexMusicMod
        .fileInfoRequests()
        .then(function (requests) {
          var count = Array.isArray(requests) ? requests.length : 0;
          diagnosticsLine.textContent = diagnostics.concat("запросов клиента видно: " + count).join(" · ");
        })
        .catch(function () {});
    }

    var body = el("div", "flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:10px");
    panel.appendChild(body);

    body.appendChild(sectionTitle("СКАЧИВАНИЕ"));

    var qualityRow = el("div", "display:flex;align-items:center;justify-content:space-between;gap:12px");
    qualityRow.appendChild(
      el("span", "font:400 13px/1.3 Segoe UI,Arial,sans-serif;color:#e8e6f5", "Качество"),
    );
    var quality = document.createElement("select");
    quality.setAttribute(
      "style",
      "flex:1;max-width:190px;height:34px;border-radius:10px;background:#1a1a26;color:#fff;border:1px solid rgba(255,255,255,.16);padding:0 8px;cursor:pointer",
    );
    [
      ["lossless", "Максимальное (FLAC)"],
      ["nq", "Среднее"],
      ["lq", "Низкое"],
    ].forEach(function (pair) {
      var option = document.createElement("option");
      option.value = pair[0];
      option.textContent = pair[1];
      quality.appendChild(option);
    });
    window.yandexMusicMod.getStorageValue("downloader/quality").then(function (value) {
      quality.value = value || "lossless";
    });
    quality.addEventListener("change", function () {
      window.yandexMusicMod.setStorageValue("downloader/quality", quality.value);
      setStatus("Качество: " + quality.options[quality.selectedIndex].textContent);
    });
    qualityRow.appendChild(quality);
    body.appendChild(qualityRow);

    var trackBtn = button("Скачать текущий трек", true);
    trackBtn.onclick = guard(downloadCurrentTrack);
    body.appendChild(trackBtn);

    var page = currentPage();
    var pageBtn = button(page ? "Скачать весь " + page.label : "Скачать альбом / плейлист целиком");
    pageBtn.onclick = guard(downloadCurrentPage);
    body.appendChild(pageBtn);

    var folderBtn = button("Выбрать папку для загрузок");
    folderBtn.onclick = guard(async function () {
      var result = await window.yandexMusicMod.selectDownloadFolder();
      if (result && result.success && result.path) {
        window.yandexMusicMod.setStorageValue("downloadFolderPath", result.path);
        setStatus("Папка: " + result.path);
      }
    });
    body.appendChild(folderBtn);

    var openBtn = button("Открыть папку загрузок");
    openBtn.onclick = function () {
      window.yandexMusicMod.openDownloadDirectory();
      setStatus("Открываю папку загрузок…");
    };
    body.appendChild(openBtn);

    var reportBtn = button("Диагностика");
    reportBtn.onclick = guard(showReport);
    body.appendChild(reportBtn);

    body.appendChild(sectionTitle("ТЕМА ПЛЕЕРА"));
    body.appendChild(
      selectRow(
        "Тема",
        THEMES.map(function (theme) {
          return [theme.id, theme.name];
        }),
        activeTheme.id,
        function (id, name) {
          applyTheme(id);
          window.yandexMusicMod.setStorageValue("pulse/theme", id);
          setStatus("Тема: " + name);
        },
      ),
    );

    var swatches = el("div", "display:flex;gap:6px;flex-wrap:wrap");
    THEMES.forEach(function (theme) {
      var dot = el(
        "button",
        "width:34px;height:34px;border-radius:10px;cursor:pointer;padding:0;" +
          "border:2px solid " +
          (theme.id === activeTheme.id ? theme.accent : "rgba(255,255,255,.12)") +
          ";background:linear-gradient(135deg," +
          theme.press +
          "," +
          theme.second +
          ")",
      );
      dot.type = "button";
      dot.title = theme.name;
      dot.onclick = function () {
        applyTheme(theme.id);
        window.yandexMusicMod.setStorageValue("pulse/theme", theme.id);
        setStatus("Тема: " + theme.name);
        closeMenu();
        openMenu();
      };
      swatches.appendChild(dot);
    });
    body.appendChild(swatches);

    body.appendChild(sectionTitle("НАСТРОЙКИ"));
    body.appendChild(toggleRow("Авто-выбор лучшего качества", "autoBestQuality/enabled", true));
    body.appendChild(toggleRow("Ambient-тема из обложки", "ambient-theme/enabled", false));
    body.appendChild(toggleRow("Аудио-визуализатор", "audio-visualizer/enabled", false));
    body.appendChild(toggleRow("Глобальные горячие клавиши", "global-hotkeys/enabled", true));
    body.appendChild(toggleRow("Discord RPC", "discordRPC/enabled", true));
    body.appendChild(sliderRow("Скорость воспроизведения", "playback-speed/rate", 0.5, 2, 0.05, 1, "x"));
    body.appendChild(sliderRow("Масштаб интерфейса", "scale-changer/savedScale", 0.7, 1.5, 0.05, 1, "x"));

    if (typeof window.__pulseOpenAdvanced === "function") {
      var advanced = button("Расширенные настройки");
      advanced.onclick = function () {
        closeMenu();
        window.__pulseOpenAdvanced();
      };
      body.appendChild(advanced);
    }

    body.appendChild(sectionTitle("ГОРЯЧИЕ КЛАВИШИ"));
    [
      "Media Play / Pause — пауза",
      "Media Next / Prev — переключение",
      "Ctrl+Shift+L — лайк",
      "Ctrl+Shift+D — скачать трек",
    ].forEach(function (line) {
      body.appendChild(el("div", "font:400 12px/1.5 Segoe UI,Arial,sans-serif;color:#9a97b8", line));
    });

    body.appendChild(sectionTitle("ССЫЛКИ"));
    var links = el("div", "display:flex;gap:8px");
    var telegram = button("Telegram");
    telegram.onclick = function () {
      window.open(TELEGRAM_URL, "_blank", "noreferrer");
    };
    var github = button("GitHub");
    github.onclick = function () {
      window.open(GITHUB_URL, "_blank", "noreferrer");
    };
    telegram.style.flex = "1";
    github.style.flex = "1";
    links.appendChild(telegram);
    links.appendChild(github);
    body.appendChild(links);

    var footer = el("div", "padding:12px 18px 16px;border-top:1px solid rgba(255,255,255,.07)");
    var status = el(
      "div",
      "min-height:34px;font:400 12px/1.45 Segoe UI,Arial,sans-serif;color:#c4b5fd",
      "Включи трек и нажми «Скачать текущий трек».",
    );
    status.id = "pulse-status";
    footer.appendChild(status);
    var closeBtn = button("Закрыть");
    closeBtn.style.width = "100%";
    closeBtn.onclick = closeMenu;
    footer.appendChild(closeBtn);
    panel.appendChild(footer);

    document.documentElement.appendChild(overlay);
  }

  window.__pulseOpenMenu = openMenu;
  window.__pulseCloseMenu = closeMenu;
  window.__pulseSetMenu = function (open) {
    if (open) openMenu();
    else closeMenu();
  };
  window.addEventListener("ym-mod-open-menu", function () {
    openMenu();
  });
  window.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });

  /* ---------- Кнопка запуска меню ---------- */

  function bind(node) {
    if (!node || node.dataset.pulseBound === "1") return;
    node.dataset.pulseBound = "1";
    node.addEventListener(
      "click",
      function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        openMenu();
      },
      true,
    );
  }

  function ensureButton() {
    // Preferred entry point is the React button in the left navbar. The floating
    // button is only a fallback for when that button is not on screen.
    var navbarButton = document.querySelector("#mod-sheet-container .trigger-text");
    document.querySelectorAll("#mod-sheet-container .trigger-text, #pulse-fab, #ym-mod-open-btn").forEach(bind);

    var btn = document.getElementById("pulse-open-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "pulse-open-btn";
      btn.type = "button";
      btn.textContent = "Меню " + BRAND;
      btn.setAttribute(
        "style",
        "position:fixed;left:12px;bottom:86px;z-index:2147483645;height:40px;padding:0 18px;border:0;border-radius:12px;" +
          "background:linear-gradient(135deg,#7c5cfc,#22d3ee);color:#0b0b14;font:800 13px/40px Segoe UI,Arial,sans-serif;" +
          "letter-spacing:.06em;cursor:pointer;-webkit-app-region:no-drag;box-shadow:0 10px 26px rgba(0,0,0,.45)",
      );
      document.documentElement.appendChild(btn);
      restyleOwnUi();
    }
    btn.style.display = navbarButton ? "none" : "block";
    bind(btn);

    var legacy = document.getElementById("pulse-canary");
    if (legacy) legacy.remove();

    // Next.js can swap the whole <head> during navigation and take the theme
    // stylesheet with it.
    if (!document.getElementById("pulse-theme")) applyTheme(activeTheme.id);
  }

  var playbackRate = 1;

  function applyScale(scale) {
    scale = Number(scale);
    if (!scale || scale === 1) {
      var stale = document.getElementById("pulse-scale");
      if (stale) stale.remove();
      try {
        document.documentElement.style.removeProperty("zoom");
      } catch (e) {}
      return;
    }
    var style = document.getElementById("pulse-scale");
    if (!style) {
      style = document.createElement("style");
      style.id = "pulse-scale";
      (document.head || document.documentElement).appendChild(style);
    }
    // Chromium honours zoom on the document element. Targeting one Yandex
    // layout class used to do nothing after they renamed it.
    style.textContent = "html{zoom:" + scale + "}";
  }

  function applyPlaybackRate(rate) {
    playbackRate = Number(rate) || 1;
    document.querySelectorAll("audio,video").forEach(function (media) {
      try {
        media.playbackRate = playbackRate;
      } catch (e) {}
    });
  }

  function applyPlayerSetting(key, value) {
    if (key === "scale-changer/savedScale") applyScale(value);
    if (key === "playback-speed/rate") applyPlaybackRate(value);
    if (key === "global-hotkeys/enabled" && window.yandexMusicMod && window.yandexMusicMod.setHotkeysEnabled) {
      window.yandexMusicMod.setHotkeysEnabled(value !== false);
    }
  }

  function clickPlayerButton(selector) {
    var roots = document.querySelectorAll(
      'section[data-test-id="PLAYERBAR_DESKTOP"], [class*="PlayerBar"], [class*="VibeDesktopPlayer"], body',
    );
    for (var i = 0; i < roots.length; i++) {
      var btn = roots[i].querySelector(selector);
      if (btn) {
        btn.click();
        return true;
      }
    }
    return false;
  }

  function handleHotkey(action) {
    if (action === "downloadCurrent") {
      guard(downloadCurrentTrack)();
      return;
    }
    var selectors = {
      playPause: 'button[data-test-id="PLAY_BUTTON"], button[data-test-id="PAUSE_BUTTON"]',
      next: 'button[data-test-id="NEXT_BUTTON"]',
      prev: 'button[data-test-id="PREVIOUS_BUTTON"]',
      like: 'button[data-test-id="LIKE_BUTTON"], button[aria-label*="лайк"], button[aria-label*="Like"]',
    };
    if (selectors[action]) clickPlayerButton(selectors[action]);
  }

  function pulseGetPlayerState() {
    var audio = document.querySelector("audio");
    var media = null;
    try {
      media = navigator.mediaSession && navigator.mediaSession.metadata;
    } catch (e) {}
    var id = findCurrentTrackId() || (lastFileInfo && lastFileInfo.trackId) || "";
    var title = (media && media.title) || "";
    if (!id && !title) return { enabled: true, showModButton: true, data: null };
    return {
      enabled: true,
      showModButton: true,
      data: {
        trackMeta: {
          id: String(id || ""),
          title: title || "Track " + id,
          artists: [{ name: (media && media.artist) || "?" }],
          coverUri: null,
        },
        playback: {
          duration: audio && isFinite(audio.duration) ? audio.duration : 0,
          position: audio ? audio.currentTime : 0,
          progress: 0,
        },
        isPlaying: audio ? !audio.paused : true,
      },
    };
  }

  window.__getPlayerState = window.__getPlayerState || pulseGetPlayerState;

  function bootPlayerControls(attempt) {
    var mod = window.yandexMusicMod;
    if (!mod || !mod.getStorageValue) {
      if ((attempt || 0) < 40) {
        setTimeout(function () {
          bootPlayerControls((attempt || 0) + 1);
        }, 250);
      }
      return;
    }

    if (!window.__getPlayerState) window.__getPlayerState = pulseGetPlayerState;

    mod.getStorageValue("scale-changer/savedScale").then(function (value) {
      if (value) applyScale(value);
    });
    mod.getStorageValue("playback-speed/rate").then(function (value) {
      if (typeof value === "number") applyPlaybackRate(value);
    });
    if (mod.setHotkeysEnabled) {
      mod.getStorageValue("global-hotkeys/enabled").then(function (value) {
        mod.setHotkeysEnabled(value !== false);
      });
    }
    if (mod.onStorageChanged) {
      mod.onStorageChanged(function (key, value) {
        applyPlayerSetting(key, value);
      });
    }
    if (mod.onMediaKey) {
      mod.onMediaKey(function (action) {
        handleHotkey(action);
      });
    }
    setInterval(function () {
      if (playbackRate !== 1) applyPlaybackRate(playbackRate);
    }, 1500);
  }

  // The network hooks above have to be in place before the app builds its HTTP
  // client, so this file runs from the preload — long before there is a DOM.
  function startUi() {
    initIdleSaver();
    initTheme();
    bootPlayerControls();
    ensureButton();
    setInterval(ensureButton, 1500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startUi);
  else startUi();
})();
