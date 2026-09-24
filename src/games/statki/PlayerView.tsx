"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Dices, RotateCw, Trophy, Users } from "lucide-react";
import type { GameViewProps } from "@/games/view";
import { useT } from "@/lib/i18n/provider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { sfx, vibrate } from "@/lib/sound";
import { Flota, Krata, type StanPola } from "./ui";
import { dziobWPlanszy, kolumnaPola, polaStatku, poprawnaFlota, wierszPola, type Statek } from "./plansza";

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
  /** Statek trzymany palcem: który, w którym miejscu chwycony i nad czym wisi. */
  const [ciagniety, setCiagniety] = useState<{ statek: number; offset: number; cel: number } | null>(null);
  /**
   * Flota pokazywana OD RAZU po ruchu, zanim wróci z serwera.
   *
   * Klient nie zapisuje stanu gry (zasada 1) i to się nie zmienia — to jest wyłącznie
   * podgląd. Bez niego każde przestawienie wyglądało na zawieszone: statek stał w starym
   * miejscu przez całą podróż do Firestore'a i z powrotem, a potem przeskakiwał. Przy
   * przeciąganiu palcem taka zwłoka psuje cały gest, bo ręka jest już gdzie indziej.
   */
  const [optymistyczna, setOptymistyczna] = useState<Statek[] | null>(null);

  const flotaSerwera = useMemo(() => priv?.flota ?? [], [priv?.flota]);
  const flota = optymistyczna ?? flotaSerwera;

  // Podgląd znika, gdy serwer przyśle to samo ustawienie — czyli gdy potwierdzi ruch.
  useEffect(() => {
    if (optymistyczna && JSON.stringify(flotaSerwera) === JSON.stringify(optymistyczna)) setOptymistyczna(null);
  }, [flotaSerwera, optymistyczna]);

  // Bezpiecznik na wypadek ODRZUCENIA ruchu: wtedy nie przyjdzie żaden nowy stan, bo nic
  // się nie zmieniło, a podgląd pokazywałby ustawienie, którego nie ma. Widok sam sprawdza
  // poprawność przed wysłaniem, więc to ścieżka awaryjna, nie codzienna.
  useEffect(() => {
    if (!optymistyczna) return;
    const id = setTimeout(() => setOptymistyczna(null), 2500);
    return () => clearTimeout(id);
  }, [optymistyczna]);

  /**
   * Nowe położenie jednego statku. Zwraca false, gdy ustawienie łamie reguły.
   *
   * Walidacja jest TUTAJ, mimo że serwer i tak waliduje (klient może wysłać cokolwiek).
   * Bez niej każde muśnięcie zajętego pola kończyłoby się paskiem „akcja odrzucona",
   * a przy przeciąganiu palec przechodzi nad cudzymi statkami bez przerwy.
   */
  const ustaw = useCallback(
    (statek: number, pole: number, poziomo: boolean): boolean => {
      const stary = flota[statek];
      if (!stary) return false;
      const nowa = flota.map((s, i) => (i === statek ? { ...s, pole, poziomo } : s));
      if (!poprawnaFlota(nowa, pub.bok)) return false;
      if (stary.pole === pole && stary.poziomo === poziomo) return true; // nic się nie zmieniło
      setOptymistyczna(nowa);
      vibrate(15);
      dispatch({ type: "PRZESTAW", statek, pole, poziomo });
      return true;
    },
    [flota, pub.bok, dispatch],
  );

  /**
   * Gdzie stanie przeciągany statek. Trzyma CHWYCONY kawałek pod palcem, a nie dziób —
   * inaczej złapanie czteromasztowca za rufę przerzucałoby go o trzy pola w bok.
   * Przy krawędzi położenie jest DOCISKANE do planszy, zamiast robić się nielegalne:
   * palec i tak celuje w statek, a nie w jego dziób.
   */
  const kandydat = useCallback(
    (c: { statek: number; offset: number; cel: number }): Statek[] | null => {
      const s = flota[c.statek];
      if (!s) return null;
      const w = wierszPola(c.cel, pub.bok);
      const k = kolumnaPola(c.cel, pub.bok);
      // Chwycony kawałek zostaje pod palcem: odejmujemy offset od tej współrzędnej,
      // wzdłuż której statek leży, a dociskanie do planszy załatwia `dziobWPlanszy`.
      const dziob = s.poziomo
        ? dziobWPlanszy(s.dlugosc, w, k - c.offset, true, pub.bok)
        : dziobWPlanszy(s.dlugosc, w - c.offset, k, false, pub.bok);
      return flota.map((x, i) => (i === c.statek ? { ...x, pole: dziob } : x));
    },
    [flota, pub.bok],
  );

  // Dźwięk wyniku strzału. Jeden na zmianę pola `ostatni`, więc słychać go u wszystkich
  // przy stole — także u tych, którzy akurat patrzą na cudzy telefon.
  useEffect(() => {
    if (!pub.ostatni) return;
    if (pub.ostatni.zatopiony) sfx.defeat();
    else if (pub.ostatni.trafiony) sfx.stop();
    else sfx.tick();
  }, [pub.ostatni]);

  const mojeStany = useMemo(
    () => stanyPol(pub.bok, pub.plansze[ja], gram ? flota : undefined),
    [pub.bok, pub.plansze, ja, gram, flota],
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
    const gotowy = !!priv?.gotowy;
    const polaWybranego = wybrany != null && flota[wybrany] ? (polaStatku(flota[wybrany], pub.bok) ?? []) : [];

    // Podgląd przeciągania: statek rysuje się TAM, GDZIE WYLĄDUJE, a nie tam, skąd go wzięto.
    // Czerwień znaczy „tu nie stanie" i jest jedyną informacją zwrotną, jakiej ten gest
    // potrzebuje — puszczenie w czerwonym miejscu po prostu nic nie robi.
    const stanyPlanszy = (): StanPola[] => {
      const kand = ciagniety ? kandydat(ciagniety) : null;
      if (!ciagniety || !kand) return mojeStany;
      const legalne = poprawnaFlota(kand, pub.bok);
      const stany: StanPola[] = Array(pub.bok * pub.bok).fill("woda");
      kand.forEach((statek, i) => {
        const zly = i === ciagniety.statek && !legalne;
        for (const pole of polaStatku(statek, pub.bok) ?? []) stany[pole] = zly ? "zly" : "statek";
      });
      return stany;
    };

    const chwyt = (pole: number) => {
      if (gotowy) return;
      const i = flota.findIndex((s) => (polaStatku(s, pub.bok) ?? []).includes(pole));
      if (i < 0) return;
      setWybrany(i);
      setCiagniety({ statek: i, offset: (polaStatku(flota[i], pub.bok) ?? []).indexOf(pole), cel: pole });
    };

    const pusc = (przesuniety: boolean) => {
      const c = ciagniety;
      setCiagniety(null);
      if (!c || !przesuniety) return; // zwykłe dotknięcie obsłuży `onClick`
      const kand = kandydat(c);
      if (kand) ustaw(c.statek, kand[c.statek].pole, kand[c.statek].poziomo);
    };

    // Obrót DOCISKA statek do planszy, zamiast po cichu nie robić nic. Wcześniej obrót
    // czteromasztowca przy prawej krawędzi wyprowadzał go poza planszę, więc walidacja
    // odrzucała ruch i przycisk wyglądał na zepsuty.
    const obroc = () => {
      if (wybrany == null || gotowy) return;
      const s = flota[wybrany];
      if (!s) return;
      const poziomo = !s.poziomo;
      const w = wierszPola(s.pole, pub.bok);
      const k = kolumnaPola(s.pole, pub.bok);
      ustaw(wybrany, dziobWPlanszy(s.dlugosc, w, k, poziomo, pub.bok), poziomo);
    };

    // Dotknięcie zostaje jako druga droga do tego samego: przeciąganie jest wygodniejsze,
    // ale nie da się go obsłużyć klawiaturą ani czytnikiem ekranu.
    const dotknij = (pole: number) => {
      if (gotowy) return;
      const trafiony = flota.findIndex((s) => (polaStatku(s, pub.bok) ?? []).includes(pole));
      if (trafiony >= 0) {
        setWybrany(trafiony === wybrany ? null : trafiony);
        return;
      }
      if (wybrany != null) ustaw(wybrany, pole, flota[wybrany].poziomo);
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
              stany={stanyPlanszy()}
              rozmiar={44}
              maxWys={46}
              accent={accent}
              etykieta={t("statki.myBoard")}
              wybrane={ciagniety ? [] : polaWybranego}
              aktywne={() => !gotowy}
              onPole={dotknij}
              onChwyt={gotowy ? undefined : chwyt}
              onCel={(pole) => setCiagniety((c) => (c ? { ...c, cel: pole } : c))}
              onPusc={pusc}
            />
            <p className="text-center text-xs font-semibold text-ink-muted">
              {wybrany == null ? t("statki.dragShip") : t("statki.tapTarget")}
            </p>

            <div className="flex w-full max-w-md flex-wrap justify-center gap-2">
              <button
                type="button"
                className="btn btn-ghost flex-1 text-sm"
                disabled={gotowy || wybrany == null}
                onClick={obroc}
              >
                <RotateCw size={18} strokeWidth={2.5} aria-hidden /> {t("statki.rotate")}
              </button>
              <button
                type="button"
                className="btn btn-ghost flex-1 text-sm"
                disabled={gotowy}
                onClick={() => {
                  setWybrany(null);
                  setOptymistyczna(null);
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
