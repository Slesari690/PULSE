import { ThemeProvider } from "./contexts/ThemeContext";
import { useQuery } from "@tanstack/react-query";

import { Tooltip, TooltipContent, TooltipTrigger } from "@ui/components/ui/tooltip";
import { ScrollArea } from "@ui/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Toaster } from "@ui/components/ui/sonner";

import { FontChanger } from "@ui/components/font-changer";
import { Devtools } from "@ui/components/devtools";
import { Downloader } from "@ui/components/downloader";
import { AutoBestQuality } from "@ui/components/auto-best-quality";
import { DiscordRPC } from "@ui/components/discord-rpc";
import { Settings } from "@ui/components/settings";
import { AutoLiker } from "@ui/components/auto-liker";
import { ExperimentsToggle } from "@ui/components/experiments-toggle";
import { ScaleChanger } from "@ui/components/scale-changer";
import { CustomThemes } from "@ui/components/custom-themes";
import { NewYearSnowfall, NewYearSnowfallAnimation } from "@ui/components/snowfall-animation";
import { AmbientTheme } from "@ui/components/ambient-theme";
import { AudioVisualizer } from "@ui/components/audio-visualizer";
import { GlobalHotkeys } from "@ui/components/global-hotkeys";
import { PlaybackSpeed } from "@ui/components/playback-speed";
import { SleepTimer } from "@ui/components/sleep-timer";
import { LastFm } from "@ui/components/lastfm";
import { ListeningStats } from "@ui/components/listening-stats";
import { LibraryMigration } from "@ui/components/library-migration";

import { Button } from "./components/ui/button";

import { FaGithub, FaTelegramPlane } from "react-icons/fa";
import { RxUpdate } from "react-icons/rx";

import { BRAND_NAME, BRAND_TAGLINE, BRAND_VERSION } from "~/mod/brand";

const IS_DEV = false;
const GITHUB_REPO_URL = "https://github.com/Slesari690/PULSE";
const META_URL = "https://raw.githubusercontent.com/Slesari690/PULSE/refs/heads/main/.meta/meta.json";

export default function App() {
  const [isSheetOpen, setIsSheetOpen] = useState(IS_DEV);
  const [devtoolsEnabled, setDevtoolsEnabled] = useState(false);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  const appMetaQuery = useQuery({
    queryKey: ["appMeta"],
    queryFn: async () => {
      const data = await fetch(META_URL);
      if (data.status !== 200) {
        throw new Error("Failed to fetch app meta");
      }
      return data.json();
    },
    enabled: true,
    retry: true,
  });

  useEffect(() => {
    (async () => {
      try {
        setDevtoolsEnabled((await window.yandexMusicMod?.getStorageValue("devtools/enabled")) || false);
      } catch {
        setDevtoolsEnabled(false);
      }
    })();

    const unsub = window.yandexMusicMod?.onStorageChanged?.((key: string, value: any) => {
      if (key.includes("devtools/enabled")) setDevtoolsEnabled(value);
    });
    return () => unsub?.();
  }, []);

  // The always-available vanilla menu (pulse-shell.js) owns the main panel and
  // opens this sheet as "расширенные настройки".
  useEffect(() => {
    // @ts-ignore
    window.__pulseOpenAdvanced = () => setIsSheetOpen(true);
    return () => {
      // @ts-ignore
      delete window.__pulseOpenAdvanced;
    };
  }, []);

  // Same injection point as Stephanzion/YandexMusicBetaMod: a real "Меню мода"
  // button above the user profile in the left navbar.
  useEffect(() => {
    const targetSelector = 'div[class*="NavbarDesktopUserWidget_userProfileContainer"]';
    const containerId = "mod-sheet-container";

    const checkAndPlaceButton = () => {
      const targetElement = IS_DEV ? document.body : document.querySelector(targetSelector);
      let container = document.getElementById(containerId) as HTMLDivElement | null;

      if (targetElement) {
        if (!container) {
          container = document.createElement("div");
          container.id = containerId;
          container.style.display = "flex";
          container.style.justifyContent = "center";
          container.style.width = "100%";
          container.style.padding = "0 8px 10px";
          targetElement.parentNode?.insertBefore(container, targetElement);
        } else if (container.parentNode !== targetElement.parentNode) {
          targetElement.parentNode?.insertBefore(container, targetElement);
        }
        setMountNode(container);
      } else if (container) {
        container.remove();
        setMountNode(null);
      }
    };

    checkAndPlaceButton();

    // The player mutates its DOM several times per second, so this must not run
    // per mutation — it only needs to catch navigation between pages.
    let scheduled = 0;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = window.setTimeout(() => {
        scheduled = 0;
        checkAndPlaceButton();
      }, 500);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(scheduled);
      observer.disconnect();
    };
  }, []);

  const sheetTrigger = (
    <button
      type="button"
      className="trigger-text"
      onClick={() => {
        // @ts-ignore
        if (typeof window.__pulseOpenMenu === "function") window.__pulseOpenMenu();
        else setIsSheetOpen(true);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      style={
        {
          width: "100%",
          height: 36,
          border: "none",
          borderRadius: 10,
          cursor: "pointer",
          color: "#0b0b14",
          font: '800 13px/36px "YS Text", "Segoe UI", sans-serif',
          letterSpacing: "0.06em",
          background: "linear-gradient(135deg, #7c5cfc 0%, #22d3ee 100%)",
          boxShadow: "0 6px 18px rgba(124, 92, 252, 0.4)",
          WebkitAppRegion: "no-drag",
        } as React.CSSProperties
      }
    >
      Меню {BRAND_NAME}
    </button>
  );

  const menu = isSheetOpen
    ? createPortal(
        <div
          id="pulse-menu-root"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483646,
            pointerEvents: "auto",
          }}
        >
          <div
            onClick={() => setIsSheetOpen(false)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }}
          />
          <div
            className="flex h-full flex-col border-r border-violet-400/20"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "min(420px, 100%)",
              background: "linear-gradient(180deg, #12121c 0%, #09090f 100%)",
              boxShadow: "16px 0 40px rgba(0,0,0,0.45)",
              pointerEvents: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              id="header"
              className="flex items-center justify-between px-4"
              style={{
                height: "var(--ym-spacer-size-xxxl)",
                background: "linear-gradient(90deg, rgba(167,139,250,0.2), transparent)",
              }}
            ></div>

            <div
              className="m-3 mb-0 flex justify-between rounded-xl border px-4 py-3 shadow-sm"
              style={{
                borderColor: "rgba(167,139,250,0.35)",
                background: "linear-gradient(135deg, rgba(167,139,250,0.16), rgba(34,211,238,0.08))",
              }}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-base font-extrabold tracking-[0.28em] text-white">{BRAND_NAME}</span>
                <span className="text-xs text-violet-200/80">
                  {BRAND_TAGLINE} · v{import.meta.env.VITE_MOD_VERSION || BRAND_VERSION}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open("https://t.me/freeadvertising19", "_blank", "noreferrer")}
                    >
                      <FaTelegramPlane className="text-sky-500 h-[1.3rem]! w-[1.3rem]!" fill="currentColor" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Telegram автора</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(GITHUB_REPO_URL, "_blank", "noreferrer")}
                    >
                      <FaGithub className="text-foreground h-[1.3rem]! w-[1.3rem]!" fill="currentColor" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Исходный код на Github</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <ScrollArea
              className="flex h-full flex-col p-1 pt-0 overflow-hidden overflow-x-auto overflow-y-auto rounded-md"
              viewportClassName="gap-2"
            >
              {appMetaQuery.isSuccess &&
                appMetaQuery.data &&
                appMetaQuery.data.modStable !== import.meta.env.VITE_MOD_VERSION && (
                  <div
                    className="m-4 py-4 px-5 flex flex-row justify-center items-center gap-3 bg-secondary border-border rounded-xl hover:scale-105 transition-all cursor-pointer"
                    onClick={() => window.open(appMetaQuery.data.downloadUrl, "_blank", "noreferrer")}
                  >
                    <RxUpdate className="text-foreground h-[2.5rem]! w-[2.5rem]!" fill="currentColor" />
                    <div className="flex flex-col gap-1 justify-center items-start">
                      <span className="text-foreground text-base font-semibold">
                        Доступно обновление v{appMetaQuery.data.modStable}
                      </span>
                      <span className="text-muted-foreground text-sm">Нажмите, чтобы скачать новую версию мода</span>
                    </div>
                  </div>
                )}

              <Downloader />
              <NewYearSnowfall />
              <DiscordRPC />
              <AutoLiker />
              <LibraryMigration />
              <CustomThemes />
              <AmbientTheme />
              <AudioVisualizer />
              <PlaybackSpeed />
              <SleepTimer />
              <LastFm />
              <ListeningStats />
              <FontChanger />
              <ScaleChanger />
              <AutoBestQuality />

              <Settings />
              <Devtools />
              <GlobalHotkeys />

              {devtoolsEnabled && <ExperimentsToggle />}

              <div className="flex flex-col gap-4 justify-center items-center m-6 ">
                <div
                  className="py-3 px-4 w-full flex flex-row justify-center items-center gap-4 rounded-xl hover:scale-105 transition-all cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg, #229ED9 0%, #2AABEE 50%, #3A8EE6 100%)",
                    boxShadow: "0 4px 20px rgba(34,158,217,0.35)",
                    zoom: ".9",
                  }}
                  onClick={() => window.open("https://t.me/freeadvertising19", "_blank", "noreferrer")}
                >
                  <div className="flex items-center justify-center h-[2.5rem] w-[2.5rem] rounded-full bg-white/15">
                    <FaTelegramPlane className="text-white h-[1.6rem]! w-[1.6rem]!" fill="currentColor" />
                  </div>
                  <div className="flex flex-col gap-1 justify-center items-start">
                    <span className="text-white text-lg font-semibold">Telegram автора</span>
                    <span className="text-white/85 text-sm mt-[-3px]">@freeadvertising19 — анонсы, софт, реклама</span>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="m-4 flex flex-row">
              <Button variant="outline" className="text-foreground flex-1" onClick={() => setIsSheetOpen(false)}>
                Назад
              </Button>
            </div>
          </div>
        </div>,
        document.documentElement,
      )
    : null;

  return (
    <ThemeProvider>
      {mountNode && createPortal(sheetTrigger, mountNode)}
      <NewYearSnowfallAnimation />
      <Toaster position="bottom-right" />
      {menu}
    </ThemeProvider>
  );
}
