import { useEffect, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Button } from "@ui/components/ui/button";
import { Alert, AlertDescription } from "@ui/components/ui/alert";
import { If } from "@ui/components/ui/if";

import { BarChart3, Trash2 } from "lucide-react";

interface PlayEvent {
  id: string;
  title: string;
  artist: string;
  ts: number;
}

type Range = "week" | "month" | "all";

const RANGES: Array<{ value: Range; label: string; ms: number }> = [
  { value: "week", label: "Неделя", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "month", label: "Месяц", ms: 30 * 24 * 60 * 60 * 1000 },
  { value: "all", label: "Всё время", ms: Infinity },
];

function aggregate(events: PlayEvent[], key: (e: PlayEvent) => string, label: (e: PlayEvent) => string) {
  const counts = new Map<string, { label: string; count: number }>();
  for (const e of events) {
    const k = key(e);
    const entry = counts.get(k);
    if (entry) entry.count++;
    else counts.set(k, { label: label(e), count: 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 8);
}

export function ListeningStats() {
  const [events, setEvents] = useState<PlayEvent[]>([]);
  const [range, setRange] = useState<Range>("week");

  useEffect(() => {
    (async () => {
      setEvents(((await window.yandexMusicMod.getStorageValue("stats/plays")) || []) as PlayEvent[]);
    })();
    const unsub = window.yandexMusicMod.onStorageChanged((key: string) => {
      if (key === "stats/plays") {
        (async () => setEvents(((await window.yandexMusicMod.getStorageValue("stats/plays")) || []) as PlayEvent[]))();
      }
    });
    return () => unsub();
  }, []);

  const rangeMs = RANGES.find((r) => r.value === range)!.ms;
  const cutoff = Date.now() - rangeMs;
  const filtered = events.filter((e) => e.ts >= cutoff);

  const topTracks = aggregate(filtered, (e) => e.id, (e) => `${e.artist} — ${e.title}`);
  const topArtists = aggregate(filtered, (e) => e.artist, (e) => e.artist);

  const maxCount = topTracks[0]?.count ?? 1;

  const clearStats = async () => {
    window.yandexMusicMod.setStorageValue("stats/plays", []);
    window.yandexMusicMod.setStorageValue("stats/pending", {});
    setEvents([]);
  };

  return (
    <ExpandableCard title="Статистика прослушиваний" icon={<BarChart3 className="h-4 w-4" />} opened={false}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              variant={range === r.value ? "default" : "outline"}
              size="sm"
              className="text-foreground flex-1"
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>

        <If condition={filtered.length === 0}>
          <Alert variant="default" className="cursor-default">
            <BarChart3 className="h-4 w-4" />
            <AlertDescription className="text-sm text-muted-foreground">
              Пока пусто. Послушайте музыку немного — статистика появится здесь.
            </AlertDescription>
          </Alert>
        </If>

        <If condition={filtered.length > 0}>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-foreground">Топ треков</span>
            {topTracks.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{t.label}</div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(t.count / maxCount) * 100}%`, background: "var(--yandexMusicModAccent, #4A9EFF)" }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">{t.count}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-foreground">Топ артистов</span>
            {topArtists.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                <span className="text-xs flex-1 truncate">{a.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{a.count}</span>
              </div>
            ))}
          </div>
        </If>

        <If condition={events.length > 0}>
          <Button variant="outline" size="sm" className="text-foreground" onClick={clearStats}>
            <Trash2 className="h-4 w-4 mr-1" /> Очистить статистику
          </Button>
        </If>
      </div>
    </ExpandableCard>
  );
}
