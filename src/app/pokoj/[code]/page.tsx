"use client";
import { useT } from "@/lib/i18n/provider";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RoomCodeNeon } from "@/components/RoomCodeNeon";
import { RoomQr } from "@/components/RoomQr";
import { PlayerList } from "@/components/PlayerList";
import { Illustration } from "@/components/Illustration";
import { PublicRoomToggle } from "@/components/PublicRoomToggle";
import { RoomRecords } from "@/components/RoomRecords";
import { GameShell } from "@/components/game/GameShell";
import { LobbyGames } from "@/components/game/LobbyGames";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ShareButton } from "@/components/ShareButton";
import { useAnonAuth } from "@/hooks/useAnonAuth";
import { useServerClock } from "@/hooks/useServerClock";
import { useRoom } from "@/hooks/useRoom";
import { usePresence } from "@/hooks/usePresence";
import { LobbySkeleton } from "@/components/LobbySkeleton";
import { SpectatorRoom } from "@/components/SpectatorRoom";
import { apiPost } from "@/lib/client/api";
import { normalizeRoomCode } from "@/lib/room-code";
import { useSession } from "@/lib/store/session";
import { GAME_LIST } from "@/games/manifests";

export default function LobbyPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = normalizeRoomCode(params.code ?? "");

  // Wybrana gra żyje tutaj, nie w LobbyGames: lobby musi wiedzieć, ilu graczy
  // wymaga, żeby nie namawiać do zapraszania kogokolwiek przy grze jednoosobowej.
  const [gameId, setGameId] = useState(GAME_LIST[0]?.id ?? "");

  const { uid, loading: authLoading } = useAnonAuth();
  const { serverNow } = useServerClock();
  const { room, loading, error, notFound } = useRoom(code, !authLoading && !!uid);
  const setActiveRoom = useSession((s) => s.setActiveRoom);

  // Widz wchodzi z ?widz=1. Flaga musi być jawna, bo „nie jestem w players" znaczy
  // też „zostałem wyrzucony" — a te dwa przypadki kończą się zupełnie inaczej.
  const chceOgladac = useSearchParams().get("widz") === "1";
  const amMember = !!(uid && room?.players[uid]);
  const jestWidzem = chceOgladac && !amMember;
  usePresence(code, amMember);

  // Bez wpisu w observers reguły Firestore nie pozwolą widzowi czytać pokoju.
  useEffect(() => {
    if (!chceOgladac || authLoading || !uid) return;
    apiPost(`/api/rooms/${code}/observe`).catch(() => {
      /* i tak spróbujemy czytać — brak wpisu objawi się błędem subskrypcji */
    });
  }, [chceOgladac, authLoading, uid, code]);

  // C1: Zapamiętaj aktywny pokój, żeby dało się wrócić po odświeżeniu.
  useEffect(() => {
    if (amMember && room) {
      const nick = room.players[uid!]?.nick ?? "";
      setActiveRoom({ code: room.code, nick });
    }
  }, [amMember, room, uid, code, setActiveRoom]);

  // Rozróżniamy „nigdy nie dołączył" (→ ekran dołączania) od „wyrzucony/wyszedł" (→ start).
  const wasMemberRef = useRef(false);
  useEffect(() => {
    if (amMember) wasMemberRef.current = true;
  }, [amMember]);

  useEffect(() => {
    if (loading || authLoading) return;
    if (notFound) return;
    if (room && uid && !room.players[uid] && !chceOgladac) {
      setActiveRoom(null); // C1: wyrzucony/wyszedł — czyść sesję
      router.replace(wasMemberRef.current ? "/" : `/p/${code}`);
    }
    // Utrata dostępu do odczytu po wyrzuceniu objawia się błędem reguł.
    if (error && wasMemberRef.current) {
      setActiveRoom(null);
      router.replace("/");
    }
  }, [room, uid, loading, authLoading, notFound, error, code, router, setActiveRoom, chceOgladac]);

  const leave = async () => {
    try {
      await apiPost(`/api/rooms/${code}/leave`);
    } catch {
      /* i tak wychodzimy */
    }
    setActiveRoom(null); // C1: czyścimy sesję przy wyjściu
    router.push("/");
  };

  const kick = async (targetUid: string) => {
    try {
      await apiPost(`/api/rooms/${code}/leave`, { targetUid });
    } catch {
      /* ignoruj — snapshot pokaże aktualny stan */
    }
  };

  if (notFound) {
    return (
      <main className="arcade-bg screen relative items-center justify-center gap-6 overflow-hidden text-center">
        <div className="halftone pointer-events-none absolute inset-0" aria-hidden />
        <Illustration id="postacie/ziomek-zagubiony" priority className="relative h-40 w-auto sm:h-48" />
        <p className="font-display relative text-2xl font-bold uppercase text-ink">
          Nie ma takiego pokoju
        </p>
        <RoomCodeNeon code={code} accent="var(--color-czerwien)" />
        <Link href="/dolacz" className="btn relative">
          Spróbuj innego kodu
        </Link>
      </main>
    );
  }

  // Subskrypcja ostatecznie padła (po ponowieniach) — pokaż odzysk zamiast wisieć w nieskończoność.
  if (error && !wasMemberRef.current) {
    return (
      <main className="arcade-bg screen relative items-center justify-center gap-5 overflow-hidden text-center">
        <div className="halftone pointer-events-none absolute inset-0" aria-hidden />
        <Illustration id="postacie/ziomek-zagubiony" priority className="relative h-40 w-auto sm:h-48" />
        <p className="font-display relative text-2xl font-bold uppercase text-ink">
          Nie udało się wejść
        </p>
        <p className="relative max-w-xs text-base font-semibold text-ink-muted">
          Sprawdź połączenie i spróbuj ponownie.
        </p>
        <button type="button" className="btn relative" onClick={() => window.location.reload()}>
          Spróbuj ponownie
        </button>
        <Link
          href="/dolacz"
          className="font-display relative text-sm font-bold uppercase tracking-[0.06em] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
        >
          ← wróć
        </Link>
      </main>
    );
  }

  if (loading || authLoading || !room) {
    return <LobbySkeleton />;
  }

  if (jestWidzem) {
    return <SpectatorRoom room={room} serverNow={serverNow} />;
  }

  // Gra w toku (lub zakończona) → oddajemy ekran harnessowi gry.
  if (room.status !== "lobby" && uid) {
    return (
      <ErrorBoundary context={`game:${room.gameId} room:${code}`}>
        <GameShell room={room} meUid={uid} serverNow={serverNow} />
      </ErrorBoundary>
    );
  }

  const isHost = uid === room.hostUid;
  const playerCount = Object.keys(room.players).length;

  // Zachęta do zapraszania ma sens tylko wtedy, gdy wybrana gra NIE ruszy w tylu
  // osobach. Stoper i Odcień idą od jednego gracza — tam „Zaproś znajomych" było
  // po prostu nieprawdą i wyglądało jak blokada, której nie ma.
  const wybrana = GAME_LIST.find((g) => g.id === gameId);
  const zaMaloGraczy = wybrana ? playerCount < wybrana.minPlayers : false;

  return (
    <main className="arcade-bg screen relative items-center gap-5 overflow-hidden">
      <div className="halftone pointer-events-none absolute inset-0" aria-hidden />

      {/* Nagłówek: wielki tytuł „POKÓJ XXXX" + QR w rogu (mockup) */}
      <header className="relative flex w-full max-w-3xl items-start justify-between gap-4 sm:items-center sm:justify-center">
        <h1 className="font-display text-outline min-w-0 flex-1 text-[2.75rem] font-bold uppercase leading-[1.05] tracking-wide text-ink sm:flex-none">
          {t("lobby.room")}{" "}
          <span className="text-limonka">{room.code}</span>
        </h1>
        <div className="flex flex-none flex-col items-center gap-1 rounded-[20px] border-[3px] border-stroke bg-panel p-2 shadow-[0_4px_0_rgb(0_0_0/0.35)]">
          <RoomQr code={room.code} size={92} />
          <ShareButton code={room.code} compact />
        </div>
      </header>

      {/* Pasek gracza */}
      <section className="relative flex w-full max-w-3xl flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold uppercase tracking-[0.06em] text-mint">
            {t("lobby.playersCount", { count: playerCount })}
          </h2>
          <Link
            href={`/pokoj/${room.code}/ekran`}
            target="_blank"
            className="font-display text-xs font-bold uppercase tracking-[0.06em] text-mint underline-offset-4 hover:underline"
          >
            {t("lobby.tvScreen")}
          </Link>
        </div>
        {/* Gdy host jest sam, puste sloty się nie pojawiają: rolę „tu jest miejsce"
            przejmuje karta z ziomkiem pod spodem i dwa komunikaty o tym samym tylko
            spychałyby listę gier pod zgięcie. Od dwóch graczy w górę jest odwrotnie —
            karta znika, a wolne miejsca pokazują, że można kogoś jeszcze dorzucić. */}
        <PlayerList
          players={room.players}
          hostUid={room.hostUid}
          myUid={uid}
          serverNow={serverNow}
          onKick={isHost ? kick : undefined}
          minSlots={zaMaloGraczy ? 0 : 4}
        />

        {/* Otwarcie pokoju dla obcych. Tylko host i tylko w lobby: lista publiczna
            pokazuje wyłącznie pokoje przed startem, więc w trakcie gry ten przełącznik
            nie miałby czego zmienić. */}
        {isHost && room.status === "lobby" && (
          <PublicRoomToggle code={room.code} isPublic={room.public === true} />
        )}

        {/* Czekamy na ludzi. To jest ekran, na który host patrzy najdłużej ze wszystkich —
            zaraz po założeniu pokoju. Wcześniej była tu jedna linijka tekstu i pustka;
            warunek `playerCount === 0` nie odpalał się nigdy, bo host zawsze jest w pokoju. */}
        {zaMaloGraczy && (
          <div className="card flex items-center gap-4 animate-[fadeIn_0.3s_ease]">
            <Illustration id="postacie/ziomek-czeka" className="h-24 w-auto flex-none sm:h-28" />
            <p className="text-base font-semibold leading-relaxed text-ink-muted">
              {t("lobby.noPlayers")}
            </p>
          </div>
        )}
      </section>

      <section className="relative flex w-full max-w-3xl flex-col gap-3">
        <LobbyGames
          code={room.code}
          isHost={isHost}
          playerCount={playerCount}
          gameId={gameId}
          onGameChange={setGameId}
        />
      </section>

      <RoomRecords records={room.records} players={room.players} />

      <section className="relative mt-auto w-full max-w-3xl pt-2">
        <button type="button" onClick={leave} className="btn btn-ghost w-full">
          {t("lobby.leave")}
        </button>
      </section>
    </main>
  );
}
