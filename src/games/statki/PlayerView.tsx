"use client";
import { useEffect, useMemo, useState } from "react";
import { Check, Dices, RotateCw, Trophy, Users } from "lucide-react";
import type { GameViewProps } from "@/games/view";
import { useT } from "@/lib/i18n/provider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { sfx, vibrate } from "@/lib/sound";
import { Flota, Krata, type StanPola } from "./ui";
import { polaStatku, poprawnaFlota, type Statek } from "./plansza";

interface PlanszaPub {
  trafienia: number[];
  pudla: number[];
  zatopione: number[];
  statkow: number;
  zatopionych: number;
}
interface Pub {
  phase: "ustawianie" | "strzal" | "wynik" | "koniec";
  round: number;
  totalRounds: number;
  bok: number;
  sklad: number[];
  para: [string, string];
  turaUid: string | null;
  gotowi: string[];
  ostatni: { uid: string; pole: number; trafiony: boolean; zatopiony: boolean } | null;
  dodatkowyStrzal: boolean;
  plansze: Record<string, PlanszaPub>;
  kolejka: string[];
  ostatnia: { zwyciezca: string | null } | null;
  players: { uid: string; nick: string; avatar: string; score: number; gra: boolean }[];
  canFinish: boolean;
}
interface Priv {
  gram?: boolean;
  flota?: Statek[];
  gotowy?: boolean;
  mojaTura?: boolean;
  mojeStrzaly?: number[];
}

function useTicker(ms = 400) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}
const secLeft = (e: number | null, now: number) => (e == null ? null : Math.max(0, Math.ceil((e - now) / 1000)));

/**
 * Stany pól jednej kraty.
 *
 * `flota` podajemy WYŁĄCZNIE dla własnej planszy — dla planszy przeciwnika jej po prostu
 * nie mamy, bo silnik nigdy jej nie wysyła. To nie jest ostrożność widoku, tylko fakt:
 * `privateView` oddaje flotę jednego gracza, jego właścicielowi.
 */
function stanyPol(bok: number, plansza: PlanszaPub | undefined, flota?: readonly Statek[]): StanPola[] {
  const stany: StanPola[] = Array(bok * bok).fill("woda");
  for (const s of flota ?? []) for (const p of polaStatku(s, bok) ?? []) stany[p] = "statek";
  for (const p of plansza?.pudla ?? []) stany[p] = "pudlo";
  for (const p of plansza?.trafienia ?? []) stany[p] = "trafienie";
  for (const p of plansza?.zatopione ?? []) stany[p] = "zatopiony";
  return stany;
}

export function StatkiPlayerView({ room, publicState, privateState, meUid, isHost, dispatch, serverNow, accent }: GameViewProps) {
  const t = useT();
  const pub = publicState as Pub;
  const priv = privateState as Priv | null;
  useTicker();
  const left = secLeft(room.phaseEndsAt ?? null, serverNow());
  const nickOf = (uid: string) => pub.players.find((p) => p.uid === uid)?.nick ?? "?";

  const gram = !!priv?.gram;
  const przeciwnik = gram ? (pub.para[0] === meUid ? pub.para[1] : pub.para[0]) : pub.para[1];
  const ja = gram ? meUid : pub.para[0];

  const [wybrany, setWybrany] = useState<number | null>(null);

  // Dźwięk wyniku strzału. Jeden na zmianę pola `ostatni`, więc słychać go u wszystkich
  // przy stole — także u tych, którzy akurat patrzą na cudzy telefon.
  useEffect(() => {
    if (!pub.ostatni) return;
    if (pub.ostatni.zatopiony) sfx.defeat();
    else if (pub.ostatni.trafiony) sfx.stop();
    else sfx.tick();
  }, [pub.ostatni]);

  const mojeStany = useMemo(
    () => stanyPol(pub.bok, pub.plansze[ja], gram ? priv?.flota : undefined),
    [pub.bok, pub.plansze, ja, gram, priv?.flota],
  );
  const cudzeStany = useMemo(() => stanyPol(pub.bok, pub.plansze[przeciwnik]), [pub.bok, pub.plansze, przeciwnik]);

  const tabela = (
    <ul className="flex w-full max-w-md flex-col gap-1">
      {[...pub.players].sort((a, b) => b.score - a.score).map((p) => (
        <li
          key={p.uid}
          className="flex items-center gap-2 rounded-[12px] border-2 px-3 py-2 text-sm"
          style={{ borderColor: p.gra ? accent : "var(--color-stroke)", background: "var(--color-panel)" }}
        >
          <AvatarIcon avatar={p.avatar} size={20} />
          <span className="flex-1 truncate font-bold text-ink">
            {p.nick}
            {p.uid === meUid && <> {t("common.you")}</>}
          </span>
          <span className="tabular font-bold" style={{ color: accent }}>{p.score}</span>
        </li>
      ))}
    </ul>
  );

  const naglowek = (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-ink-muted">
        {t("statki.round", { round: pub.round })}
        {pub.totalRounds ? ` / ${pub.totalRounds}` : ""}
      </p>
      <p className="text-base font-bold text-ink">
        {nickOf(pub.para[0])} <span className="text-ink-muted">vs</span> {nickOf(pub.para[1])}
      </p>
    </div>
  );

  // —— USTAWIANIE FLOTY ——
  if (pub.phase === "ustawianie") {
    const flota = priv?.flota ?? [];
    const gotowy = !!priv?.gotowy;
    const polaWybranego = wybrany != null ? (polaStatku(flota[wybrany], pub.bok) ?? []) : [];

    /**
     * Ruch statku sprawdzamy TU, zanim poleci na serwer — nie zamiast serwera.
     * Serwer i tak waliduje (klient może wysłać cokolwiek), ale bez tej bramki każde
     * dotknięcie zajętego pola kończyłoby się komunikatem o odrzuconej akcji.
     */
    const sprobuj = (zmiana: (s: Statek) => Statek) => {
      if (wybrany == null || gotowy) return;
      const nowa = flota.map((s, i) => (i === wybrany ? zmiana(s) : s));
      if (!poprawnaFlota(nowa, pub.bok)) return;
      vibrate(15);
      dispatch({ type: "PRZESTAW", statek: wybrany, pole: nowa[wybrany].pole, poziomo: nowa[wybrany].poziomo });
    };

    const dotknij = (pole: number) => {
      if (gotowy) return;
      const trafiony = flota.findIndex((s) => (polaStatku(s, pub.bok) ?? []).includes(pole));
      if (trafiony >= 0) {
        setWybrany(trafiony === wybrany ? null : trafiony);
        return;
      }
      sprobuj((s) => ({ ...s, pole }));
    };

    return (
      <div className="flex flex-col items-center gap-4" style={{ ["--accent" as string]: accent }}>
        {naglowek}
        {gram ? (
          <p className="font-display text-sm font-bold uppercase tracking-[0.06em]" style={{ color: accent }}>
            {gotowy ? t("statki.waitingForRival") : t("statki.placeFleet")}
            {left != null ? ` · ${left}s` : ""}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
            <Users size={16} strokeWidth={2.5} aria-hidden />
            {t("statki.spectatingSetup")}
          </p>
        )}

        {gram && (
          <>
            <Krata
              bok={pub.bok}
              stany={mojeStany}
              rozmiar={44}
              maxWys={46}
              accent={accent}
              etykieta={t("statki.myBoard")}
              wybrane={polaWybranego}
              aktywne={() => !gotowy}
              onPole={dotknij}
            />
            <p className="text-center text-xs font-semibold text-ink-muted">
              {wybrany == null ? t("statki.tapShip") : t("statki.tapTarget")}
            </p>

            <div className="flex w-full max-w-md flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn btn-ghost flex-1 text-sm"
                disabled={gotowy || wybrany == null}
                onClick={() => sprobuj((s) => ({ ...s, poziomo: !s.poziomo }))}
              >
                <RotateCw size={18} strokeWidth={2.5} aria-hidden /> {t("statki.rotate")}
              </button>
              <button
                type="button"
                className="btn btn-ghost flex-1 text-sm"
                disabled={gotowy}
                onClick={() => {
                  setWybrany(null);
                  dispatch({ type: "LOSUJ" });
                }}
              >
                <Dices size={18} strokeWidth={2.5} aria-hidden /> {t("statki.shuffle")}
              </button>
            </div>

            <button
              type="button"
              className="btn btn-accent w-full max-w-md"
              style={{ ["--accent" as string]: accent }}
              disabled={gotowy}
              onClick={() => {
                setWybrany(null);
                dispatch({ type: "GOTOWY" });
              }}
            >
              <Check size={20} strokeWidth={3} aria-hidden /> {gotowy ? t("statki.ready") : t("statki.confirmFleet")}
            </button>
          </>
        )}

        <p className="text-xs font-semibold text-ink-muted">
          {t("statki.readyCount", { ile: pub.gotowi.length, z: 2 })}
        </p>
      </div>
    );
  }

  // —— WYNIK / KONIEC ——
  if (pub.phase !== "strzal") {
    const zw = pub.ostatnia?.zwyciezca;
    return (
      <div className="flex flex-col items-center gap-5" style={{ ["--accent" as string]: accent }}>
        {naglowek}
        <p className="font-display text-2xl font-bold uppercase" style={{ color: accent }}>
          {pub.phase === "koniec" && !zw ? t("statki.gameOver") : t("statki.winner", { nick: nickOf(zw ?? "") })}
        </p>
        <Krata
          bok={pub.bok}
          stany={cudzeStany}
          rozmiar={36}
          maxWys={38}
          accent={accent}
          etykieta={t("statki.rivalBoard")}
        />
        {tabela}
        {isHost && pub.phase === "wynik" && (
          <button
            type="button"
            className="btn btn-accent"
            style={{ ["--accent" as string]: accent }}
            onClick={() => dispatch({ type: "NEXT" })}
          >
            {t("common.next")}
          </button>
        )}
      </div>
    );
  }

  // —— STRZELANIE ——
  const mojaTura = !!priv?.mojaTura;
  const oddane = new Set(priv?.mojeStrzaly ?? []);
  const wynikStrzalu = pub.ostatni
    ? pub.ostatni.zatopiony
      ? t("statki.sunk")
      : pub.ostatni.trafiony
        ? t("statki.hit")
        : t("statki.miss")
    : null;

  return (
    <div className="flex flex-col items-center gap-3" style={{ ["--accent" as string]: accent }}>
      {naglowek}

      <p className="font-display text-sm font-bold uppercase tracking-[0.06em]" style={{ color: accent }}>
        {gram
          ? mojaTura
            ? t("statki.yourShot")
            : t("statki.waitShot", { nick: nickOf(pub.turaUid ?? "") })
          : t("statki.spectating", { nick: nickOf(pub.turaUid ?? "") })}
        {left != null ? ` · ${left}s` : ""}
      </p>

      {wynikStrzalu && (
        <p className="text-sm font-bold text-ink">
          {t("statki.lastShot", { nick: nickOf(pub.ostatni!.uid), wynik: wynikStrzalu })}
        </p>
      )}

      <div className="flex w-full flex-col items-center gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
          {gram ? t("statki.rivalBoardOf", { nick: nickOf(przeciwnik) }) : nickOf(przeciwnik)}
        </p>
        <Krata
          bok={pub.bok}
          stany={cudzeStany}
          rozmiar={46}
          maxWys={36}
          accent={accent}
          etykieta={t("statki.rivalBoard")}
          aktywne={(pole) => mojaTura && !oddane.has(pole)}
          onPole={(pole) => {
            vibrate(20);
            dispatch({ type: "STRZEL", pole });
          }}
        />
        <Flota sklad={pub.sklad} zatopionych={pub.plansze[przeciwnik]?.zatopionych ?? 0} accent={accent} />
      </div>

      <div className="flex w-full flex-col items-center gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted">
          {gram ? t("statki.myBoard") : nickOf(ja)}
        </p>
        <Krata
          bok={pub.bok}
          stany={mojeStany}
          rozmiar={26}
          maxWys={20}
          accent={accent}
          etykieta={t("statki.myBoard")}
        />
        <Flota sklad={pub.sklad} zatopionych={pub.plansze[ja]?.zatopionych ?? 0} accent={accent} />
      </div>

      {pub.kolejka.length > 0 && (
        <p className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
          <Trophy size={14} strokeWidth={2.5} aria-hidden />
          {t("statki.queue", { nicks: pub.kolejka.map(nickOf).join(", ") })}
        </p>
      )}
    </div>
  );
}
