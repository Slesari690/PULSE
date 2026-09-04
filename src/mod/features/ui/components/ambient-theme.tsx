import { useEffect, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { If } from "@ui/components/ui/if";
import { Alert, AlertDescription } from "@ui/components/ui/alert";

import { Sparkles } from "lucide-react";

export function AmbientTheme() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      setEnabled((await window.yandexMusicMod.getStorageValue("ambient-theme/enabled")) === true);
    })();
  }, []);

  return (
    <ExpandableCard title="Ambient-тема из обложки" icon={<Sparkles className="h-4 w-4" />} opened={false}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <div className="flex items-center gap-3">
          <Switch
            id="ambient-theme-toggle"
            checked={enabled}
            onCheckedChange={(value) => {
              setEnabled(value);
              window.yandexMusicMod.setStorageValue("ambient-theme/enabled", value);
            }}
          />
          <Label htmlFor="ambient-theme-toggle" className="cursor-pointer">
            Подстраивать цвет интерфейса под обложку трека
          </Label>
        </div>

        <If condition={enabled}>
          <Alert variant="default" className="cursor-default">
            <Sparkles className="h-4 w-4" />
            <AlertDescription className="text-sm text-muted-foreground">
              Цвет акцента и палитра автоматически меняются под текущий трек. Работает поверх собственной темы —
              включите «Собственную тему» в разделе выше для лучшего эффекта.
            </AlertDescription>
          </Alert>
        </If>
      </div>
    </ExpandableCard>
  );
}
