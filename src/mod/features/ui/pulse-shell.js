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

  /* ---------- Экономия ресурсов, пока окно не в фокусе ---------- */

  // Yandex keeps animating the Vibe background and the player chrome even when
  // the window is behind a game, which costs real GPU time.
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
  var fileInfoTemplate = null;
  var fileInfoByTrack = {};
  var lastFileInfo = null;

  function isFileInfoUrl(url) {
    return String(url || "").indexOf("get-file-info") !== -1;
  }

  function rememberRequest(url, headers) {
    try {
      var query = new URLSearchParams(String(url).split("?")[1] || "");
      fileInfoTemplate = {
        codecs: query.get("codecs"),
        transports: query.get("transports"),
        headers: headers || {},
      };
    } catch (e) {}
  }

  function rememberResponse(data) {
    var info = data && data.downloadInfo;
    if (!info || !info.trackId || !info.url) return;
    fileInfoByTrack[String(info.trackId)] = info;
    lastFileInfo = info;
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
      if (isFileInfoUrl(this.__pulseUrl)) {
        rememberRequest(this.__pulseUrl, this.__pulseHeaders);
        this.addEventListener("load", function () {
          try {
            rememberResponse(JSON.parse(self.responseText));
          } catch (e) {}
        });
      }

      if (String(this.__pulseUrl).indexOf("api.music.yandex.net") !== -1) {
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
      if (isFileInfoUrl(url)) {
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
        rememberRequest(url, headers);
        promise
          .then(function (response) {
            return response.clone().json();
          })
          .then(rememberResponse)
          .catch(function () {});
      }
      return promise;
    };
  } catch (e) {}

  /* ---------- Работа с API Яндекса ---------- */

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
    return {
      Authorization: skipAuth ? undefined : oauthToken(),
      "X-Yandex-Music-Client": "YandexMusicDesktopAppWindows/" + (window.VERSION || "5.118.1"),
      "X-Yandex-Music-Frontend": "new",
      "X-Yandex-Music-Without-Invocation-Info": "1",
    };
  }

  // Must run inside the renderer: Yandex answers 451 to the very same request
  // when it comes from the main process instead of the app window.
  function xhrJson(url, headers) {
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, true);
      xhr.withCredentials = true;
      Object.keys(headers).forEach(function (name) {
        if (headers[name]) xhr.setRequestHeader(name, headers[name]);
      });
      xhr.onload = function () {
        var data = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {}
        resolve({ status: xhr.status, data: data });
      };
      xhr.onerror = function () {
        resolve({ status: 0, data: null });
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

    if (res.status !== 200) {
      var error = new Error("HTTP " + res.status);
      error.status = res.status;
      throw error;
    }
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

  var CODECS = ["flac", "aac", "he-aac", "mp3", "flac-mp4", "aac-mp4", "he-aac-mp4"];
  var TRANSPORTS = "encraw";

  async function requestDownloadInfo(trackId, quality, secret) {
    var codecs = (fileInfoTemplate && fileInfoTemplate.codecs) || CODECS.join(",");
    var transports = (fileInfoTemplate && fileInfoTemplate.transports) || TRANSPORTS;
    var headers = fileInfoTemplate && fileInfoTemplate.headers;
    var ts = Math.floor(Date.now() / 1000);
    var sign = await hmacSign(secret, ts + trackId + quality + codecs.split(",").join("") + transports);
    var path =
      "/get-file-info?ts=" +
      ts +
      "&trackId=" +
      encodeURIComponent(trackId) +
      "&quality=" +
      encodeURIComponent(quality) +
      "&codecs=" +
      encodeURIComponent(codecs) +
      "&transports=" +
      encodeURIComponent(transports) +
      "&sign=" +
      encodeURIComponent(sign);

    // Yandex sometimes answers with a different track for a moment after a skip.
    for (var attempt = 0; attempt < 6; attempt++) {
      var data = await apiGet(path, false, headers);
      var info = data && data.downloadInfo;
      if (info && String(info.trackId) === String(trackId)) return info;
      await sleep(200);
    }
    return null;
  }

  async function getDownloadInfo(trackId, quality, waitForApp) {
    trackId = String(trackId);
    if (fileInfoByTrack[trackId]) return fileInfoByTrack[trackId];

    var qualities = [quality];
    ["lossless", "nq", "lq"].forEach(function (q) {
      if (qualities.indexOf(q) === -1) qualities.push(q);
    });

    var lastStatus = 0;
    for (var s = 0; s < secrets.length; s++) {
      for (var q = 0; q < qualities.length; q++) {
        try {
          var info = await requestDownloadInfo(trackId, qualities[q], secrets[s]);
          if (info) return info;
        } catch (e) {
          lastStatus = e.status || 0;
          if (lastStatus !== 451 && lastStatus !== 403 && lastStatus !== 404) throw e;
        }
        if (fileInfoByTrack[trackId]) return fileInfoByTrack[trackId];
      }
    }

    // Last resort for a single track: the app fetches the link itself while the
    // track plays, so give it a few seconds to do the work for us.
    if (waitForApp) {
      for (var wait = 0; wait < 20; wait++) {
        if (fileInfoByTrack[trackId]) return fileInfoByTrack[trackId];
        await sleep(250);
      }
    }

    var refused = new Error("HTTP " + lastStatus);
    refused.status = lastStatus;
    throw refused;
  }

  // Sent without a token on purpose: an authorized request marks Plus-only
  // tracks as unavailable.
  async function getTracksInfo(ids) {
    return await apiGet("/tracks?trackIds=" + ids.join(",") + "&removeDuplicates=false&withProgress=true", true);
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
      return oauthToken()
        ? "Яндекс не отдал ссылку (" + status + "). Включи трек в плеере, дай ему проиграть пару секунд и нажми снова — PULSE возьмёт ссылку из самого приложения."
        : "Нет авторизации: PULSE не видит твой аккаунт. Войди в Яндекс Музыку внутри PULSE и повтори.";
    }
    if (status === 404) return "Трек недоступен для скачивания.";
    if (status === 0) return "Нет связи с api.music.yandex.net.";
    return String((error && error.message) || error);
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
      var tracks = await getTracksInfo(chunk);

      for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        var name = (track.artists || []).map(function (a) {
          return a.name;
        });
        var title = (name.join(", ") || "?") + " — " + track.title;
        setStatus("Скачиваю " + (done + failed + 1) + " из " + ids.length + ": " + title);

        try {
          var info = await getDownloadInfo(track.id, quality, ids.length === 1);
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

  // On "Моя волна" and other radio pages the player markup differs, so the id
  // scraped from React can be missing or stale. The link the app itself fetched
  // last is a more reliable source than the DOM.
  function resolveCurrentTrackId() {
    var scraped = findCurrentTrackId();
    if (scraped && fileInfoByTrack[scraped]) return scraped;
    if (lastFileInfo && lastFileInfo.trackId) return String(lastFileInfo.trackId);
    return scraped;
  }

  async function downloadCurrentTrack() {
    if (!window.yandexMusicMod) return setStatus("API мода недоступен. Перезапусти PULSE.");
    var trackId = resolveCurrentTrackId();
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
      ? "border:0;background:linear-gradient(135deg,#7c5cfc,#22d3ee);color:#0b0b14;font-weight:800;"
      : "border:1px solid rgba(255,255,255,.16);background:#1a1a26;color:#f4f1ff;";
    var node = el("button", base + skin, label);
    node.type = "button";
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
    });
    input.addEventListener("change", function () {
      window.yandexMusicMod.setStorageValue(storageKey, parseFloat(input.value));
      setStatus("Сохранено: " + label + " — " + input.value + (suffix || ""));
    });
    return wrap;
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
    var diagnostics = [
      oauthToken() ? "аккаунт найден" : "аккаунт не найден",
      window.__PULSE_BOOTED ? "модули загружены" : lastModuleError ? "ошибка: " + lastModuleError : "модули грузятся",
      secrets.length > 1 ? "ключ перехвачен" : "ключ по умолчанию",
    ];
    header.appendChild(
      el(
        "div",
        "margin-top:6px;font:400 12px/1.4 Segoe UI,Arial,sans-serif;color:#9a97b8",
        diagnostics.join(" · "),
      ),
    );
    panel.appendChild(header);

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

    body.appendChild(sectionTitle("НАСТРОЙКИ"));
    body.appendChild(toggleRow("Авто-выбор лучшего качества", "autoBestQuality/enabled", true));
    body.appendChild(toggleRow("Кастомная тема оформления", "custom-themes/enabled", true));
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
          "letter-spacing:.06em;cursor:pointer;-webkit-app-region:no-drag;box-shadow:0 10px 26px rgba(124,92,252,.45)",
      );
      document.documentElement.appendChild(btn);
    }
    btn.style.display = navbarButton ? "none" : "block";
    bind(btn);

    var legacy = document.getElementById("pulse-canary");
    if (legacy) legacy.remove();
  }

  ensureButton();
  setInterval(ensureButton, 1500);
})();
