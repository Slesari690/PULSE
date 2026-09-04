import { useEffect, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Button } from "@ui/components/ui/button";
import { If } from "@ui/components/ui/if";

import { Moon, X } from "lucide-react";

const PRESETS: Array<{ label: string; minutes: number }> = [
  { label: "15 мин", minutes: 15 },
  { label: "30 мин", minutes: 30 },
  { label: "45 мин", minutes: 45 },
  { label: "60 мин", minutes: 60 },
];

export function SleepTimer() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    (async () => {
      const d = await window.yandexMusicMod.getStorageValue("sleep-timer/deadline");
      setDeadline(typeof d === "number" ? d : null);
    })();

    const unsub = window.yandexMusicMod.onStorageChanged((key: string, value: any) => {
      if (key === "sleep-timer/deadline") setDeadline(typeof value === "number" ? value : null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (deadline === null || deadline === -1) {
      setRemaining(0);
      return;
    }
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [deadline]);

  const setMinutes = (minutes: number) => {
    const d = Date.now() + minutes * 60 * 1000;
    setDeadline(d);
    window.yandexMusicMod.setStorageValue("sleep-timer/deadline", d);
  };

  const setEndOfTrack = () => {
    setDeadline(-1);
    window.yandexMusicMod.setStorageValue("sleep-timer/deadline", -1);
  };

  const cancel = () => {
    setDeadline(null);
    window.yandexMusicMod.setStorageValue("sleep-timer/deadline", null);
  };

  const fmt = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  };

  return (
    <ExpandableCard title="Таймер сна" icon={<Moon className="h-4 w-4" />} opened={false}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <If condition={deadline !== null}>
          <div className="flex flex-col items-center gap-2 py-2">
            <span className="text-3xl font-semibold tabular-nums text-foreground">
              {deadline === -1 ? "до конца трека" : fmt(remaining)}
            </span>
            <Button variant="outline" size="sm" onClick={cancel} className="text-foreground">
              <X className="h-4 w-4 mr-1" /> Отменить
            </Button>
          </div>
        </If>

        <If condition={deadline === null}>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <Button key={p.minutes} variant="outline" className="text-foreground" onClick={() => setMinutes(p.minutes)}>
                {p.label}
              </Button>
            ))}
            <Button variant="outline" className="text-foreground col-span-2" onClick={setEndOfTrack}>
              До конца текущего трека
            </Button>
          </div>
        </If>
      </div>
    </ExpandableCard>
  );
}
