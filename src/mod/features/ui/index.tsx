import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import App from "./App.tsx";

try {
  Sentry.init({
    dsn: "",
    sendDefaultPii: true,
    integrations: [Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] })],
    enableLogs: true,
    tracesSampleRate: 1.0,
    sampleRate: 1.0,
    tracePropagationTargets: [/^\//, /^https:\/\/api.music.yandex.net\//],
    beforeSend: (event) => {
      // @ts-ignore
      if (!window.__yandexMusicModAnalyticsEnabled) return null;
      return event;
    },
  });
} catch {
  // ignore
}

const queryClient = new QueryClient();

function mountModUi() {
  // @ts-ignore
  if (window.__PULSE_UI_MOUNTED || document.getElementById("yandex-music-mod-sidebar")) {
    // @ts-ignore
    window.__PULSE_UI_MOUNTED = true;
    return;
  }

  // @ts-ignore
  window.__PULSE_UI_MOUNTED = true;

  const sidebar = document.createElement("div");
  sidebar.id = "yandex-music-mod-sidebar";
  sidebar.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483645;";
  document.documentElement.appendChild(sidebar);

  createRoot(sidebar).render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

function bootModUi() {
  // @ts-ignore
  if (window.__PULSE_UI_BOOTED) return;
  // @ts-ignore
  window.__PULSE_UI_BOOTED = true;
  mountModUi();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootModUi);
} else {
  bootModUi();
}
