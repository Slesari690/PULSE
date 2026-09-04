import { useEffect, useState } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Label } from "@ui/components/ui/label";
import { Switch } from "@ui/components/ui/switch";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { If } from "@ui/components/ui/if";
import { Alert, AlertDescription } from "@ui/components/ui/alert";
import { toast } from "sonner";

import { lastfm } from "~/mod/features/lastfm/lastfm-api";
import { Music } from "lucide-react";

export function LastFm() {
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [sessionKey, setSessionKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setEnabled((await window.yandexMusicMod.getStorageValue("lastfm/enabled")) === true);
      setApiKey((await window.yandexMusicMod.getStorageValue("lastfm/apiKey")) || "");
      setSecret((await window.yandexMusicMod.getStorageValue("lastfm/secret")) || "");
      setSessionKey((await window.yandexMusicMod.getStorageValue("lastfm/sessionKey")) || "");
    })();
  }, []);

  const persist = (key: string, value: string) => {
    window.yandexMusicMod.setStorageValue(`lastfm/${key}`, value);
  };

  const startAuth = async () => {
    if (!apiKey || !secret) {
      toast.error("Введите API key и secret");
      return;
    }
    setBusy(true);
    const tokenRes = await lastfm.getToken(apiKey, secret);
    if (tokenRes.isErr()) {
      setBusy(false);
      toast.error("Не удалось получить токен", { description: tokenRes.error });
      return;
    }
    const token = tokenRes.value;
    window.open(lastfm.authUrl(apiKey, token), "_blank", "noreferrer");
    toast.info("Откройте браузер и подтвердите доступ, затем нажмите «Получить сессию»");
    (window as any).__lastfm_pending_token = token;
  };

  const finishAuth = async () => {
    const token = (window as any).__lastfm_pending_token;
    if (!token) {
      toast.error("Сначала нажмите «Авторизоваться»");
      return;
    }
    setBusy(true);
    const res = await lastfm.getSession(apiKey, secret, token);
    setBusy(false);
    if (res.isErr()) {
      toast.error("Сессия не получена", { description: res.error });
      return;
    }
    setSessionKey(res.value);
    persist("sessionKey", res.value);
    toast.success("Last.fm подключён");
  };

  return (
    <ExpandableCard title="Last.fm скробблинг" icon={<Music className="h-4 w-4" />} opened={false}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <Alert variant="default" className="cursor-default">
          <Music className="h-4 w-4" />
          <AlertDescription className="text-sm text-muted-foreground">
            Создайте API-аккаунт на{" "}
            <a href="https://www.last.fm/api/accounts" target="_blank" rel="noreferrer" className="underline">
              last.fm/api/accounts
            </a>{" "}
            и скопируйте API key и secret сюда. Сессия сохраняется один раз.
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-3">
          <Switch
            id="lastfm-toggle"
            checked={enabled}
            onCheckedChange={(value) => {
              setEnabled(value);
              window.yandexMusicMod.setStorageValue("lastfm/enabled", value);
            }}
          />
          <Label htmlFor="lastfm-toggle" className="cursor-pointer">
            Скробблить в Last.fm
          </Label>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">API key</Label>
          <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} onBlur={(e) => persist("apiKey", e.target.value)} placeholder="API key" className="text-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Shared secret</Label>
          <Input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onBlur={(e) => persist("secret", e.target.value)}
            placeholder="secret"
            className="text-sm"
          />
        </div>

        <If condition={sessionKey !== ""}>
          <span className="text-xs text-emerald-500">✓ Сессия получена, скробблинг активен</span>
        </If>

        <div className="flex gap-2">
          <Button variant="outline" className="text-foreground flex-1" onClick={startAuth} disabled={busy}>
            Авторизоваться
          </Button>
          <Button variant="outline" className="text-foreground flex-1" onClick={finishAuth} disabled={busy}>
            Получить сессию
          </Button>
        </div>
      </div>
    </ExpandableCard>
  );
}
