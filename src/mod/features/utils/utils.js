const YandexApiOnRequestHandlers = [];
const YandexApiOnResponseHandlers = [];
const originalFetch = window.fetch;
const originalJsonParse = JSON.parse;
const originalXhrOpen = XMLHttpRequest.prototype.open;
const originalXhrSend = XMLHttpRequest.prototype.send;
const originalResponseJson = Response.prototype.json;

function getFetchUrl(input) {
  if (!input) return "";
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (typeof input.url === "string") return input.url;
  return "";
}

export function forcePlus(data, depth = 0) {
  if (!data || typeof data !== "object" || depth > 8) return data;

  if (Array.isArray(data)) {
    if (depth > 4) return data;
    for (const item of data) forcePlus(item, depth + 1);
    return data;
  }

  try {
    if ("hasPlus" in data || ("uid" in data && ("login" in data || "avatarId" in data))) {
      data.hasPlus = true;
    }
    if ("isPaywallBlocking" in data) data.isPaywallBlocking = false;
  } catch {
    // frozen objects
  }

  if (data.result && typeof data.result === "object") forcePlus(data.result, depth + 1);
  if (data.data && typeof data.data === "object") forcePlus(data.data, depth + 1);
  if (data.account && typeof data.account === "object") forcePlus(data.account, depth + 1);

  return data;
}

function jsonResponse(body, original) {
  const headers = new Headers(original?.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(body), {
    status: original?.status || 200,
    statusText: original?.statusText || "OK",
    headers,
  });
}

navigator.sendBeacon = function () {
  return true;
};

(function () {
  try {
    if (!document.head || !document.head.appendChild) return;
    const originalAppendChild = document.head.appendChild.bind(document.head);
    document.head.appendChild = function (element) {
      if (element instanceof HTMLScriptElement) {
        const src = element.src || "";
        if (src.includes("https://yandex.ru/ads/system/adsdk.js") || src.includes("https://mc.yandex.ru/metrika/tag.js")) {
          return element;
        }
      }
      return originalAppendChild(element);
    };
  } catch {
    // head may be missing if this runs too early
  }
})();

let interceptorInstalled = false;

export function initFetchInterceptor() {
  if (interceptorInstalled) return;
  interceptorInstalled = true;
  JSON.parse = function (text, reviver) {
    const parsed = originalJsonParse.call(this, text, reviver);
    try {
      forcePlus(parsed);
    } catch {
      // ignore
    }
    return parsed;
  };

  Response.prototype.json = async function () {
    const data = await originalResponseJson.call(this);
    try {
      forcePlus(data);
    } catch {
      // ignore
    }
    return data;
  };

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__pulseUrl = String(url || "");
    return originalXhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("readystatechange", function () {
      if (this.readyState !== 4) return;
      const url = this.__pulseUrl || "";
      if (!url.includes("api.music.yandex.net")) return;
      try {
        const data = forcePlus(originalJsonParse(this.responseText));
        const raw = JSON.stringify(data);
        Object.defineProperty(this, "responseText", { configurable: true, get: () => raw });
        Object.defineProperty(this, "response", { configurable: true, get: () => raw });
      } catch {
        // ignore
      }
    });
    return originalXhrSend.apply(this, args);
  };

  window.fetch = function (...args) {
    const url = getFetchUrl(args[0]);

    if (
      url.includes("log.strm.yandex.ru") ||
      url.includes("api.music.yandex.net/dynamic-pages/trigger/polling")
    ) {
      return Promise.resolve(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    }

    if (url.includes("api.music.yandex.net") || url.includes("/account/about")) {
      return yandexApiFetch(url, args);
    }

    try {
      return originalFetch.apply(this, args);
    } catch {
      return originalFetch.apply(window, args);
    }
  };
}

const yandexApiFetch = async function (url, args) {
  let resource = args[0];

  if (YandexApiOnRequestHandlers.find((x) => url.includes(x.url))) {
    for (let i = 0; i < YandexApiOnRequestHandlers.length; i++) {
      if (!url.includes(YandexApiOnRequestHandlers[i].url)) continue;
      const requestOverride = await YandexApiOnRequestHandlers[i].handler(resource);
      if (!requestOverride) continue;
      args[0] = requestOverride;
      resource = requestOverride;
    }
  }

  const response = await originalFetch.apply(window, args);

  if (!YandexApiOnResponseHandlers.find((x) => url.includes(x.url))) {
    return response;
  }

  let data;
  try {
    data = forcePlus(await response.clone().json());
  } catch {
    return response;
  }

  let resp = data;
  for (let i = 0; i < YandexApiOnResponseHandlers.length; i++) {
    if (!url.includes(YandexApiOnResponseHandlers[i].url)) continue;
    try {
      const next = await YandexApiOnResponseHandlers[i].handler({
        url,
        data: resp,
      });
      if (next !== undefined) resp = next;
    } catch (error) {
      console.warn("[YandexApiFetch] handler failed", YandexApiOnResponseHandlers[i].url, error);
    }
  }

  forcePlus(resp || data);
  return jsonResponse(resp || data, response);
};

export const onYandexApiRequest = function (urlMatch, handler) {
  YandexApiOnRequestHandlers.push({
    url: urlMatch,
    handler: handler,
  });
};

export const onYandexApiResponse = function (urlMatch, handler) {
  YandexApiOnResponseHandlers.push({
    url: urlMatch,
    handler: handler,
  });
};

initFetchInterceptor();
