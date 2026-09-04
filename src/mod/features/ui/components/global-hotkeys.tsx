import { useEffect, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Alert, AlertDescription } from "@ui/components/ui/alert";

import { Keyboard } from "lucide-react";

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: "Media ▶ / ⏸", action: "Play / Pause" },
  { keys: "Media ⏭", action: "Следующий трек" },
  { keys: "Media ⏮", action: "Предыдущий трек" },
  { keys: "Ctrl+Shift+L", action: "Лайк текущего трека" },
  { keys: "Ctrl+Shift+D", action: "Скачать текущий трек" },
];

export function GlobalHotkeys() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    (async () => {
      setEnabled((await window.yandexMusicMod.getStorageValue("global-hotkeys/enabled")) !== false);
    })();
  }, []);

  return (
    <ExpandableCard title="Глобальные горячие клавиши" icon={<Keyboard className="h-4 w-4" />} opened={false}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <div className="flex items-center gap-3">
          <Switch
            id="hotkeys-toggle"
            checked={enabled}
            onCheckedChange={(value) => {
              setEnabled(value);
              window.yandexMusicMod.setStorageValue("global-hotkeys/enabled", value);
            }}
          />
          <Label htmlFor="hotkeys-toggle" className="cursor-pointer">
            Управление плеером горячими клавишами (работает вне фокуса)
          </Label>
        </div>

        <Alert variant="default" className="cursor-default">
          <Keyboard className="h-4 w-4" />
          <AlertDescription className="text-sm text-muted-foreground">
            <div className="flex flex-col gap-1 mt-1">
              {SHORTCUTS.map((s) => (
                <div key={s.action} className="flex justify-between gap-3">
                  <span>{s.action}</span>
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.keys}</code>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </ExpandableCard>
  );
}
