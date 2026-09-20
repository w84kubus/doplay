"use client";
import { useT } from "@/lib/i18n/provider";
import { GameIcon } from "@/components/GameIcon";
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { GAME_COMPONENTS } from "@/games/components";
import { GAME_MANIFESTS } from "@/games/manifests";
import { usePrivate } from "@/hooks/usePrivate";
import { useGameTick } from "@/hooks/useGameTick";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { apiPost } from "@/lib/client/api";
import { newActionId } from "@/lib/action-id";
import { isMuted, setMuted, unlockAudio, sfx } from "@/lib/sound";
import { celebrate } from "@/lib/confetti";
import { RoomCodeNeon } from "@/components/RoomCodeNeon";
import { claimBottom } from "@/lib/client/notices";
import type { Room } from "@/lib/types/room";

// Harness kliencki gry: podpina private/{uid}, tick fazy, dispatch akcji i renderuje PlayerView.
// Rdzeń nie zna konkretnej gry — bierze komponent z GAME_COMPONENTS wg room.gameId.
export function GameShell({
  room,
  meUid,
  serverNow,
}: {
  room: Room;
  meUid: string;
  serverNow: () => number;
}) {
  const t = useT();
  const gameId = room.gameId!;
  const manifest = GAME_MANIFESTS[gameId];
  const comps = GAME_COMPONENTS[gameId];
  const isHost = room.hostUid === meUid;
  const accent = manifest?.accentColor ?? "#f5f3ff";

  const privateState = usePrivate(room.code, meUid, true);
  const { supported: wakeSupported } = useWakeLock(true); // ekran nie gaśnie w grze
  useVisualViewport(); // --vvh, --vv-offset dla klawiatury na mobile
  // Dolna krawędź należy teraz do sterowania grą — pasek instalacji ma poczekać
  // do lobby, zamiast wchodzić na „Przerwij i wróć do lobby".
  useEffect(() => claimBottom(), []);
  const [muted, setMutedState] = useState(false);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  /** Serwer odrzucił ostatnią akcję — gracz musi się o tym dowiedzieć. */
  const [odrzucona, setOdrzucona] = useState(false);

  // Komunikat gaśnie sam. To podpowiedź „kliknięcie nie weszło", nie błąd do zamykania,
  // a w grze na czas nie ma czasu na zamykanie okienek.
  useEffect(() => {
    if (!odrzucona) return;
    const id = setTimeout(() => setOdrzucona(false), 5000);
    return () => clearTimeout(id);
  }, [odrzucona]);

  useEffect(() => {
    unlockAudio();
    setMutedState(isMuted());
  }, []);

  // Konfetti + fanfara na koniec gry (SPEC §6.4).
  const celebrated = useRef(false);
  useEffect(() => {
    if (room.status === "finished" && !celebrated.current) {
      celebrated.current = true;
      celebrate([accent, "#F5F3FF", "#FFB627"]);
      sfx.fanfara();
    }
  }, [room.status, accent]);

  useGameTick(room.code, room.phaseEndsAt, room.status === "playing", serverNow, isHost);

  if (!manifest || !comps) {
    return <p className="p-6 text-center font-semibold text-ink-muted">{t("game.unknown", { id: gameId })}</p>;
  }
  const { PlayerView } = comps;

  // C2: actionId generowany raz per kliknięcie — serwer odrzuca duplikaty.
  //
  // Odrzucona akcja MUSI dojść do gracza, a wcześniej nie docierała w ŻADNEJ grze:
  // część widoków gasiła błąd przez `.catch(() => {})`, reszta zostawiała nieobsłużone
  // odrzucenie w konsoli. Z perspektywy grającego kliknięcie po prostu nic nie robiło —
  // stąd zgłoszenie „wypadła szóstka, a nie dało się wystawić pionka".
  //
  // Najczęstsza przyczyna to rozjazd: ekran pokazuje stan sprzed kilku sekund, więc gracz
  // klika pionek, którym po stronie serwera nie ma już czym ruszyć. Komunikat mówi o tym
  // wprost, zamiast powtarzać techniczną treść z serwera — ta jest wyłącznie po polsku
  // i nie przeszłaby przez dwujęzyczność interfejsu (zasada 5).
  const dispatch = (action: unknown): Promise<void> =>
    apiPost(`/api/rooms/${room.code}/action`, { action, actionId: newActionId() })
      .then(() => setOdrzucona(false))
      .catch(() => setOdrzucona(true));
  const finished = room.status === "finished";
  // Gra zgłasza, że w tej fazie sama oferuje zakończenie rozgrywki (patrz niżej).
  const canFinish = (room.publicState as { canFinish?: boolean } | undefined)?.canFinish === true;
  // Gra o kolorze prosi o neutralne tło — patrz .neutral-bg w globals.css.
  const neutralBg = (room.publicState as { neutralBg?: boolean } | undefined)?.neutralBg === true;

  return (
    <main
      className={`${neutralBg ? "neutral-bg" : "arcade-bg"} screen relative items-center gap-5 overflow-hidden`}
      style={{ ["--accent" as string]: accent }}
    >
      {!neutralBg && <div className="halftone pointer-events-none absolute inset-0" aria-hidden />}

      <header className="relative flex w-full max-w-3xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GameIcon gameId={gameId} size={32} color={accent} />
          <RoomCodeNeon code={room.code} size="1.1rem" accent={accent} />
        </div>
        <button
          type="button"
          aria-label={muted ? t("game.unmute") : t("game.mute")}
          onClick={() => {
            const m = !muted;
            setMuted(m);
            setMutedState(m);
            if (!m) unlockAudio();
          }}
          className="flex size-11 flex-none items-center justify-center rounded-[14px] border-[3px] border-stroke bg-panel text-lg shadow-[0_3px_0_rgb(0_0_0/0.35)] transition-transform duration-75 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-mint active:translate-y-[3px] active:shadow-none"
        >
          {muted ? <VolumeX size={20} strokeWidth={2.5} aria-hidden /> : <Volume2 size={20} strokeWidth={2.5} aria-hidden />}
        </button>
      </header>

      <div className="relative w-full max-w-3xl flex-1">
        <PlayerView
          room={room}
          publicState={room.publicState}
          privateState={privateState}
          meUid={meUid}
          isHost={isHost}
          serverNow={serverNow}
          dispatch={dispatch}
          accent={accent}
        />
      </div>

      {/* Odrzucona akcja. Nad sterowaniem, nie na nim — dolna krawędź należy do
          „Przerwij i wróć do lobby" (patrz notices.ts: jeden komunikat naraz). */}
      {odrzucona && (
        <p
          role="status"
          className="relative w-full max-w-3xl rounded-[14px] border-[3px] border-bursztyn bg-panel px-4 py-2 text-center text-sm font-bold text-ink animate-[fadeIn_0.2s_ease]"
        >
          {t("game.actionRejected")}
        </p>
      )}

      {!wakeSupported && (
        <p className="relative w-full max-w-3xl text-center text-xs font-semibold text-ink-muted">
          {t("game.wakeHint")}
        </p>
      )}

      {finished && isHost && (
        <button
          type="button"
          className="btn relative w-full max-w-3xl"
          onClick={() => apiPost(`/api/rooms/${room.code}/reset`).catch(() => {})}
        >
          {t("game.again")}
        </button>
      )}

      {/* Porządne zakończenie gry — jedna implementacja dla wszystkich gier. Gra zgłasza
          przez publicState.canFinish, że jest w fazie, z której wypada skończyć (zwykle
          ekran wyników rundy). Pokazuje podium i zapisuje rekordy — inaczej niż przerwanie. */}
      {!finished && isHost && canFinish && (
        <button
          type="button"
          className="btn btn-ghost relative w-full max-w-3xl"
          onClick={() => {
            if (!confirmFinish) {
              setConfirmFinish(true);
              return;
            }
            setConfirmFinish(false);
            dispatch({ type: "FINISH" }).catch(() => {});
          }}
          onBlur={() => setConfirmFinish(false)}
        >
          {confirmFinish ? t("game.finishConfirm") : t("game.finish")}
        </button>
      )}

      {/* Awaryjne wyjście dla hosta. Zostaje tylko tam, gdzie gra nie oferuje własnego
          zakończenia — czyli w środku rundy. Kasuje partię bez podium i bez rekordów,
          więc jest gorsze i nie powinno konkurować z „Zakończ grę". Dwa kroki, bo
          przerywa grę wszystkim. */}
      {!finished && isHost && !canFinish && (
        <button
          type="button"
          className="btn btn-ghost relative w-full max-w-3xl text-sm"
          onClick={() => {
            if (!confirmAbort) {
              setConfirmAbort(true);
              return;
            }
            setConfirmAbort(false);
            apiPost(`/api/rooms/${room.code}/reset`).catch(() => {});
          }}
          onBlur={() => setConfirmAbort(false)}
        >
          {confirmAbort ? t("game.abortConfirm") : t("game.abort")}
        </button>
      )}
    </main>
  );
}
