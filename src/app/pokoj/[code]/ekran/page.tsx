"use client";
import { GameIcon } from "@/components/GameIcon";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { RoomCodeNeon } from "@/components/RoomCodeNeon";
import { RoomQr } from "@/components/RoomQr";
import { useAnonAuth } from "@/hooks/useAnonAuth";
import { useServerClock } from "@/hooks/useServerClock";
import { useRoom } from "@/hooks/useRoom";
import { useWakeLock } from "@/hooks/useWakeLock";
import { apiPost } from "@/lib/client/api";
import { normalizeRoomCode } from "@/lib/room-code";
import { DISCONNECT_AFTER_MS } from "@/lib/types/room";
import { GAME_MANIFESTS } from "@/games/manifests";
import { GAME_COMPONENTS } from "@/games/components";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AvatarIcon } from "@/components/AvatarIcon";

// Ekran hosta (SPEC §3.9): wspólny ekran na TV/laptop.
// Duża typografia czytelna z 3 metrów, osobny layout — nie skalowany telefon.
// Język wizualny Arcade Party — ten sam gradient i halftone co reszta aplikacji.
// Scanlines CRT zdjęte: DESIGN.md §0 wyklucza cienkie kreski jako element stylu.
export default function EkranPage() {
  const t = useT();
  const params = useParams<{ code: string }>();
  const code = normalizeRoomCode(params.code ?? "");
  const { uid, loading: authLoading } = useAnonAuth();
  const { serverNow } = useServerClock();
  useWakeLock(true); // ekran hosta (TV) nie gaśnie

  const [observing, setObserving] = useState(false);
  useEffect(() => {
    if (authLoading || !uid) return;
    let active = true;
    apiPost(`/api/rooms/${code}/observe`)
      .then(() => active && setObserving(true))
      .catch(() => active && setObserving(true)); // i tak spróbuj czytać
    return () => {
      active = false;
    };
  }, [uid, authLoading, code]);

  const { room, notFound } = useRoom(code, observing);

  if (notFound) {
    return (
      <main className="arcade-bg relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden">
        <div className="halftone pointer-events-none absolute inset-0" aria-hidden />
        <p className="font-display relative text-4xl font-bold uppercase text-ink-muted">
          {t("tv.noRoom")}
        </p>
      </main>
    );
  }

  const now = serverNow();
  const players = room ? Object.values(room.players).sort((a, b) => a.joinedAt - b.joinedAt) : [];

  // Gra w toku → ekran hosta pokazuje HostView danej gry (dramaturgia, SPEC §3.9).
  if (room && room.status !== "lobby" && room.gameId) {
    const manifest = GAME_MANIFESTS[room.gameId];
    const HostView = GAME_COMPONENTS[room.gameId]?.HostView;
    const accent = manifest?.accentColor ?? "#22d3ee";
    // Gra o kolorze prosi o neutralne tło (patrz .neutral-bg). Na TV to nawet ważniejsze
    // niż na telefonie — tam wszyscy patrzą na TĘ SAMĄ próbkę i porównują ją między sobą.
    const neutralBg = (room.publicState as { neutralBg?: boolean } | undefined)?.neutralBg === true;
    return (
      <ErrorBoundary context={`ekran:${room.gameId} room:${code}`}>
        <main
          className={`${neutralBg ? "neutral-bg" : "arcade-bg"} relative flex min-h-[100dvh] flex-col items-center justify-center gap-8 overflow-hidden p-8 text-center`}
        >
          {!neutralBg && <div className="halftone pointer-events-none absolute inset-0" aria-hidden />}
          <div className="relative flex items-center gap-4">
            <GameIcon gameId={room.gameId} size={64} color={accent} />
            <RoomCodeNeon code={code} size="3rem" accent={accent} />
          </div>
          <div className="relative w-full">
            {HostView && <HostView room={room} publicState={room.publicState} serverNow={serverNow} accent={accent} />}
          </div>
        </main>
      </ErrorBoundary>
    );
  }

  // Lobby hosta — duży kod, QR, lista graczy czytelna z dystansu.
  return (
    <main className="arcade-bg relative flex h-[100dvh] flex-col overflow-hidden p-6 text-center">
      <div className="halftone pointer-events-none absolute inset-0" aria-hidden />

      {/* Układ poziomy: TV jest szeroki i nikt go nie przewija — wszystko musi
          zmieścić się na jednym ekranie. Lewa kolumna: jak dołączyć. Prawa: kto już jest. */}
      <div className="relative flex min-h-0 flex-1 items-center gap-8 xl:gap-12">
        {/* Lewa: kod + QR */}
        <section className="flex flex-none flex-col items-center gap-4">
          <span className="font-display text-xl font-bold uppercase tracking-[0.3em] text-mint">
            {t("tv.joinRoom")}
          </span>
          <RoomCodeNeon code={code} size="clamp(3.5rem, 9vh, 7rem)" />
          <div className="rounded-[20px] border-[3px] border-stroke bg-panel p-3 shadow-[0_5px_0_rgb(0_0_0/0.35)]">
            <RoomQr code={code} size={180} />
          </div>
          <span className="font-display text-base font-bold uppercase tracking-[0.06em] text-ink-muted">
            doplay.pl
          </span>
        </section>

        {/* Prawa: gracze */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <h2 className="font-display flex-none text-left text-2xl font-bold uppercase tracking-widest text-mint">
            {t("tv.players", { count: players.length })}
          </h2>
          {players.length === 0 ? (
            <p className="flex flex-1 items-center justify-center text-2xl font-semibold text-ink-muted">
              {t("lobby.noPlayers")}
            </p>
          ) : (
            <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(150px,1fr))] content-start gap-4 overflow-y-auto">
              {players.map((p) => {
                const connected = p.bot === true || now - p.lastSeenAt < DISCONNECT_AFTER_MS;
                return (
                  <li
                    key={p.uid}
                    className="flex flex-col items-center gap-2 rounded-[20px] border-[3px] border-stroke bg-panel px-4 py-4 shadow-[0_4px_0_rgb(0_0_0/0.35)] animate-[slideIn_0.3s_ease]"
                    style={{ opacity: connected ? 1 : 0.35 }}
                  >
                    <span className="flex size-20 items-center justify-center rounded-full border-[5px] border-white bg-panel-hi text-5xl">
                      <AvatarIcon avatar={p.avatar} size={40} />
                    </span>
                    <span className="font-display max-w-full truncate text-lg font-bold text-ink">
                      {p.nick}
                    </span>
                    {p.uid === room?.hostUid && (
                      <span className="font-display rounded-md bg-mint px-2 py-0.5 text-xs font-bold uppercase text-sheet-ink">
                        <Star size={13} strokeWidth={3} className="inline-block align-[-0.1em]" fill="currentColor" aria-hidden /> host
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

    </main>
  );
}
