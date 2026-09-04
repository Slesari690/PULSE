import { useState, useRef } from "react";

import { ExpandableCard } from "@ui/components/ui/expandable-card";
import { Button } from "@ui/components/ui/button";
import { Input } from "@ui/components/ui/input";
import { If } from "@ui/components/ui/if";
import { Progress } from "@ui/components/ui/progress";
import { Alert, AlertDescription } from "@ui/components/ui/alert";
import { toast } from "sonner";

import {
  getPlaylistTracks,
  getTracksInfo,
  createPlaylist,
  addTracksToPlaylist,
} from "~/mod/features/utils/api";
import { FolderInput } from "lucide-react";

/**
 * Library migration — copy a playlist from a source URL into the current
 * account. The existing auto-liker transfers likes; this transfers an actual
 * playlist (creates it on the current account and adds all tracks).
 *
 * Usage: paste a Yandex Music playlist URL (the same format auto-liker accepts),
 * pick a name for the new playlist, hit "Копировать".
 */
export function LibraryMigration() {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [inProgress, setInProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const stopRef = useRef(false);

  const handleCopy = async () => {
    const playlistId = playlistUrl.match(/playlists\/([a-z0-9.\-]+)/i)?.[1] || "";
    if (!playlistId) {
      toast.error("Не удалось распознать ссылку на плейлист");
      return;
    }

    stopRef.current = false;
    setInProgress(true);
    setProgress(0);
    setStatusText("Получение треков исходного плейлиста");

    const trackIds = await getPlaylistTracks(playlistId);
    if (trackIds.isErr()) {
      toast.error("Ошибка получения плейлиста", { description: trackIds.error });
      setInProgress(false);
      return;
    }

    setStatusText("Получение информации о треках");
    const tracksInfo = await getTracksInfo(trackIds.value, true);
    if (tracksInfo.isErr()) {
      toast.error("Ошибка получения треков", { description: tracksInfo.error });
      setInProgress(false);
      return;
    }

    const tracks = tracksInfo.value.filter((t: any) => t.available !== false);
    const sourceTitle = (tracksInfo.value[0] as any)?.albums?.[0]?.title;
    const title = newName.trim() || sourceTitle || "Перенесённый плейлист";

    setStatusText("Создание плейлиста");
    const created = await createPlaylist(title);
    if (created.isErr()) {
      toast.error("Не удалось создать плейлист", { description: created.error });
      setInProgress(false);
      return;
    }

    // add in chunks of 20
    const chunkSize = 20;
    let revision = created.value.revision;
    for (let i = 0; i < tracks.length; i += chunkSize) {
      if (stopRef.current) break;
      setProgress((i / tracks.length) * 100);
      setStatusText(`Добавление треков ${i + 1}–${Math.min(i + chunkSize, tracks.length)} / ${tracks.length}`);

      const chunk = tracks.slice(i, i + chunkSize).map((t: any) => ({
        id: t.id,
        albumId: t.albums?.[0]?.id ?? t.albumId,
      }));

      const res = await addTracksToPlaylist({ kind: created.value.kind, revision }, chunk);
      if (res.isErr()) {
        toast.error("Ошибка добавления треков", { description: res.error });
        // continue; revision may be stale — try to keep going
      }
      // bump revision if returned
      if (res.isOk() && res.value?.revision) revision = res.value.revision;
      await new Promise((r) => setTimeout(r, 300));
    }

    setProgress(100);
    setStatusText("");
    setInProgress(false);
    toast.success("Плейлист скопирован", { description: title });
  };

  return (
    <ExpandableCard title="Перенести плейлист" icon={<FolderInput className="h-4 w-4" />} opened={false}>
      <div className="flex flex-col gap-5 pt-2 px-3">
        <Alert variant="default" className="cursor-default">
          <FolderInput className="h-4 w-4" />
          <AlertDescription className="text-sm text-muted-foreground">
            Создаёт копию чужого плейлиста на вашем аккаунте. Лайки переносятся отдельной кнопкой «Перенести треки»
            выше — используйте обе для полной миграции.
          </AlertDescription>
        </Alert>

        <If condition={inProgress}>
          <div className="flex flex-col gap-3">
            <span className="text-sm text-foreground text-center">{statusText}</span>
            <Progress value={progress} />
          </div>
        </If>

        <div className="flex flex-col gap-2">
          <Input
            type="text"
            value={playlistUrl}
            onChange={(e) => setPlaylistUrl(e.target.value)}
            disabled={inProgress}
            className="text-sm"
            placeholder="Ссылка на плейлист (music.yandex.ru/playlists/...)"
          />
          <Input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            disabled={inProgress}
            className="text-sm"
            placeholder="Название нового плейлиста (необязательно)"
          />
        </div>

        <Button variant="default" className="w-full" onClick={handleCopy} disabled={inProgress || playlistUrl.length === 0}>
          {inProgress ? "Стоп" : "Копировать плейлист"}
        </Button>
      </div>
    </ExpandableCard>
  );
}
