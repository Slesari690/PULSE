import { useEffect, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Slider } from "@ui/components/ui/slider";

import { Gauge } from "lucide-react";

const MIN = 0.5;
const MAX = 2.0;
const STEP = 0.05;

export function PlaybackSpeed() {
  const [rate, setRate] = useState(1.0);
  const [preserve, setPreserve] = useState(true);

  useEffect(() => {
    (async () => {
      const r = await window.yandexMusicMod.getStorageValue("playback-speed/rate");
      setRate(typeof r === "number" ? r : 1.0);
      setPreserve((await window.yandexMusicMod.getStorageValue("playback-speed/preserve")) !== false);
    })();
  }, []);

  return (
    <ExpandableCard title="Скорость и pitch" icon={<Gauge className="h-4 w-4" />} opened={false}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="cursor-pointer">Скорость воспроизведения</Label>
            <span className="text-sm text-muted-foreground tabular-nums">{rate.toFixed(2)}x</span>
          </div>
          <Slider
            value={[rate]}
            min={MIN}
            max={MAX}
            step={STEP}
            onValueChange={(value) => {
              const v = value[0] ?? 1.0;
              setRate(v);
              window.yandexMusicMod.setStorageValue("playback-speed/rate", v);
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.5x</span>
            <button
              className="hover:text-foreground cursor-pointer"
              onClick={() => {
                setRate(1.0);
                window.yandexMusicMod.setStorageValue("playback-speed/rate", 1.0);
              }}
            >
              сбросить 1.0x
            </button>
            <span>2.0x</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            id="preserve-pitch-toggle"
            checked={preserve}
            onCheckedChange={(value) => {
              setPreserve(value);
              window.yandexMusicMod.setStorageValue("playback-speed/preserve", value);
            }}
          />
          <Label htmlFor="preserve-pitch-toggle" className="cursor-pointer">
            Сохранять высоту тона (иначе «chipmunk» эффект)
          </Label>
        </div>
      </div>
    </ExpandableCard>
  );
}
