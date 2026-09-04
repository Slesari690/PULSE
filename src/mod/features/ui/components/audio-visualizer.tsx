import { useEffect, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { If } from "@ui/components/ui/if";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/components/ui/select";

import { AudioLines } from "lucide-react";

const STYLES: Array<{ value: "bars" | "wave" | "mirror"; label: string }> = [
  { value: "bars", label: "Полосы" },
  { value: "wave", label: "Волна" },
  { value: "mirror", label: "Зеркало" },
];

export function AudioVisualizer() {
  const [enabled, setEnabled] = useState(false);
  const [style, setStyle] = useState<"bars" | "wave" | "mirror">("bars");

  useEffect(() => {
    (async () => {
      setEnabled((await window.yandexMusicMod.getStorageValue("audio-visualizer/enabled")) === true);
      const saved = (await window.yandexMusicMod.getStorageValue("audio-visualizer/style")) as
        | "bars"
        | "wave"
        | "mirror"
        | undefined;
      if (saved) setStyle(saved);
    })();
  }, []);

  return (
    <ExpandableCard title="Аудио-визуализатор" icon={<AudioLines className="h-4 w-4" />} opened={false}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <div className="flex items-center gap-3">
          <Switch
            id="visualizer-toggle"
            checked={enabled}
            onCheckedChange={(value) => {
              setEnabled(value);
              window.yandexMusicMod.setStorageValue("audio-visualizer/enabled", value);
            }}
          />
          <Label htmlFor="visualizer-toggle" className="cursor-pointer">
            Показывать визуализатор частот над плеером
          </Label>
        </div>

        <If condition={enabled}>
          <div className="flex gap-4 items-center justify-center">
            <span className="text-sm text-foreground">Стиль</span>
            <Select
              value={style}
              onValueChange={(value) => {
                setStyle(value as typeof style);
                window.yandexMusicMod.setStorageValue("audio-visualizer/style", value);
              }}
            >
              <SelectTrigger className="text-foreground w-full">
                <SelectValue className="text-foreground" />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </If>
      </div>
    </ExpandableCard>
  );
}
