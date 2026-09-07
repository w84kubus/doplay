"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dices, Play, RotateCcw, Square, Target, Trash2, Trophy } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { sfx, unlockAudio, vibrate } from "@/lib/sound";
import { celebrateGold } from "@/lib/confetti";
import { diagnoza, policz, progDobrej, type Proba } from "@/lib/trening-stats";

// Trening Stopera solo (SPEC §5.2, ostatni punkt „Wspólne").
//
// Świadomie BEZ pokoju, bez Firebase i bez silnika gry: to ma być coś, co odpalasz
// w kolejce do kasy. Stan serii żyje w komponencie, rekord w localStorage.
//
// Pomiar jak w trybie wieloosobowym: performance.now() przy starcie i stopie.
// setInterval służyłby tu wyłącznie do rysowania i i tak nie wolno go używać
// do liczenia czasu (zasada 6) — a że cyfry są zamaskowane, nie rysujemy nic.
//
// Losowanie celu przez Math.random jest tu w porządku: to nie silnik gry, nie ma
// serwera ani powtarzalności do utrzymania (zasada 3 dotyczy engine.ts).

// Bez 30 s: przy takim celu jedna próba trwa pół minuty patrzenia w zamaskowane
// cyfry, a seria pięciu — ponad dwie minuty. Gra przestaje być ćwiczeniem,
// a staje się czekaniem.
const SZYBKIE_CELE = [2, 3, 5, 10] as const;
const CEL_MIN_MS = 1000;
const CEL_MAX_MS = 60000; // górna granica własnego celu
/**
 * Dolna granica losowania jako UŁAMEK maksimum, nie stała. Przy stałej 3 s
 * i ustawieniu „losuj do 3 s" zakres schodził do zera i tryb losowy po cichu
 * zwracał zawsze tę samą liczbę.
 */
const LOSOWY_UDZIAL_MIN = 0.3;
const IDEALNE_MS = 50; // < 0,05 s to „idealne trafienie" (SPEC §5.2)
const HISTORIA_MAX = 12;
const KLUCZ_REKORDU = "stoper-trening-rekord";

type Faza = "gotowy" | "mierzy" | "wynik" | "uniewazniona";

const fmt = (ms: number) => (ms / 1000).toFixed(2).replace(".", ",");
const zeZnakiem = (ms: number) => (ms >= 0 ? "+" : "−") + fmt(Math.abs(ms));

function odczytajRekord(): number | null {
  try {
    const v = localStorage.getItem(KLUCZ_REKORDU);
    return v == null ? null : Number(v);
  } catch {
    return null; // prywatne okno — trening działa, tylko bez rekordu
  }
}

export default function TreningStoperaPage() {
  const t = useT();
  // `celMs` to cel, w który REALNIE celujesz i który widzisz. W trybie losowym
  // jest losowany przed każdą próbą z zakresu do `limitMs` — cel zostaje jawny,
  // bo bez niego nie ma w co trafiać. Losowość ma tylko zapobiec wyuczeniu się
  // jednej liczby (SPEC §5.2: „cel losowany z zakresu", ale widoczny dla wszystkich).
  const [celMs, setCelMs] = useState(10000);
  const [limitMs, setLimitMs] = useState(10000);
  const [losowy, setLosowy] = useState(false);
  const [wpis, setWpis] = useState("10");
  const [faza, setFaza] = useState<Faza>("gotowy");
  const [bladMs, setBladMs] = useState<number | null>(null);
  const [proby, setProby] = useState<Proba[]>([]);
  const [rekord, setRekord] = useState<number | null>(null);
  const t0 = useRef(0);
  // Cel, na którym NAPRAWDĘ mierzyliśmy — potrzebny, bo po „Jeszcze raz" losuje się
  // nowy i błąd musiałby się liczyć względem niego zamiast względem właściwego.
  const celProby = useRef(10000);

  useEffect(() => setRekord(odczytajRekord()), []);

  /**
   * Zmiana ustawień zamyka poprzedni wynik. Bez tego ekran pokazywał cel sprzed
   * zmiany — najbrzydziej po włączeniu trybu losowego, gdzie nagłówek mówił
   * „poznasz go po stopie", a obok stała konkretna liczba z poprzedniej próby.
   */
  const wyczyscWynik = useCallback(() => {
    setBladMs(null);
    setFaza((f) => (f === "mierzy" ? f : "gotowy"));
  }, []);

  const ustawCel = useCallback((ms: number) => {
    const dociety = Math.min(CEL_MAX_MS, Math.max(CEL_MIN_MS, ms));
    setCelMs(dociety);
    setLimitMs(dociety);
    setWpis((dociety / 1000).toString().replace(".", ","));
    setLosowy(false);
    wyczyscWynik();
  }, [wyczyscWynik]);

  /** Losuje cel z zakresu do `limitMs`. Dolna granica jako ułamek, żeby zakres
      nigdy nie schodził do zera przy małych limitach. */
  const losujCel = useCallback((limit: number) => {
    const dol = Math.max(CEL_MIN_MS, Math.round(limit * LOSOWY_UDZIAL_MIN));
    return Math.round(dol + Math.random() * (limit - dol));
  }, []);

  /**
   * Powrót do gotowości po wyniku. Świadomie NIE startuje pomiaru: start ma być
   * osobnym, świadomym kliknięciem, inaczej „Jeszcze raz" zabiera moment na
   * przygotowanie się — a w grze o wyczucie czasu to właśnie ten moment się liczy.
   */
  const nowaProba = useCallback(() => {
    if (losowy) setCelMs(losujCel(limitMs));
    setBladMs(null);
    setFaza("gotowy");
  }, [losowy, limitMs, losujCel]);

  const start = useCallback(() => {
    unlockAudio();
    celProby.current = celMs;
    t0.current = performance.now();
    setBladMs(null);
    setFaza("mierzy");
    sfx.start();
    vibrate(30);
  }, [celMs]);

  const stop = useCallback(() => {
    const zmierzone = performance.now() - t0.current;
    const cel = celProby.current;
    const blad = zmierzone - cel;
    setBladMs(blad);
    setFaza("wynik");
    setProby((p) => [...p, { bladMs: blad, celMs: cel }].slice(-HISTORIA_MAX));
    sfx.stop();
    vibrate(30);

    const bezwzgledny = Math.abs(blad);
    // Idealne trafienie ma własny dźwięk i złote konfetti (SPEC §5.2) — te same,
    // których używa tryb wieloosobowy, żeby nagroda była rozpoznawalna.
    if (bezwzgledny < IDEALNE_MS) {
      sfx.perfect();
      celebrateGold();
    }
    setRekord((poprzedni) => {
      if (poprzedni != null && poprzedni <= bezwzgledny) return poprzedni;
      try {
        localStorage.setItem(KLUCZ_REKORDU, String(Math.round(bezwzgledny)));
      } catch {
        /* brak localStorage — rekord przeżyje tylko tę sesję */
      }
      return Math.round(bezwzgledny);
    });
  }, []);

  // Zmiana karty w trakcie pomiaru unieważnia próbę — ta sama zasada co w grze
  // wieloosobowej, choć tu nie ma kogo oszukiwać poza sobą. Próba NIE trafia
  // do historii, żeby nie psuła statystyk serii.
  useEffect(() => {
    if (faza !== "mierzy") return;
    const onHide = () => {
      if (document.visibilityState === "hidden") setFaza("uniewazniona");
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [faza]);

  // Spacja jak w trybie wieloosobowym — na laptopie to naturalny odruch.
  // Pomijamy, gdy kursor siedzi w polu celu: tam spacja ma znaczyć spację.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if ((e.target as HTMLElement | null)?.tagName === "INPUT") return;
      e.preventDefault();
      if (faza === "mierzy") stop();
      else if (faza === "gotowy") start();
      else nowaProba(); // po wyniku spacja przygotowuje kolejną próbę, nie startuje jej
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [faza, start, stop, nowaProba]);

  const stat = policz(proby);
  const diag = diagnoza(stat);
  const idealne = bladMs != null && Math.abs(bladMs) < IDEALNE_MS;
  const dobra = bladMs != null && Math.abs(bladMs) <= progDobrej(celProby.current);

  return (
    <main className="arcade-bg screen relative items-center gap-5 overflow-hidden text-center">
      <div className="halftone pointer-events-none absolute inset-0" aria-hidden />

      <h1 className="font-display relative text-3xl font-bold uppercase tracking-wide text-ink drop-shadow-[0_4px_0_rgb(0_0_0/0.35)]">
        {t("trening.title")}
      </h1>

      {/* —— CEL —— */}
      <div className="relative flex w-full max-w-md flex-col items-center gap-3">
        <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-ink-muted">
          {losowy ? t("trening.randomTarget") : t("stoper.target")}
        </span>
        {/* Cel jest widoczny ZAWSZE, także w trybie losowym. Ukrywanie go zamieniało
            grę o wyczucie czasu w zgadywankę bez zadania — nie ma w co celować. */}
        <span className="tabular text-5xl font-bold text-bursztyn">
          {fmt(faza === "wynik" ? celProby.current : celMs)} s
        </span>

        {/* Ustawienia widoczne także PO wyniku, nie tylko przed pierwszą próbą.
            Inaczej „Jeszcze raz" od razu startuje pomiar i celu nie da się już
            zmienić bez przeładowania strony — a cały sens treningu to próbowanie
            różnych czasów. */}
        {/* Ustawienia ZOSTAJĄ w układzie także podczas pomiaru, tylko znikają z widoku.
            Odmontowanie ich zabierało 106 px wysokości w trybie stałym i 151 px
            w losowym (dochodzi podpowiedź), więc STOP pojawiał się wyżej, niż stał
            START. Przy celu rzędu sekundy to wystarczy, żeby chybić przycisk. */}
        <div
          className={`flex flex-col items-center gap-3 ${faza === "mierzy" ? "invisible" : ""}`}
          aria-hidden={faza === "mierzy"}
        >
          {
            <>
            <div className="flex flex-wrap justify-center gap-2">
              {SZYBKIE_CELE.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ustawCel(s * 1000)}
                  aria-pressed={!losowy && celMs === s * 1000}
                  className={`font-display rounded-[14px] border-[3px] px-4 py-2 text-sm font-bold uppercase tracking-[0.04em] ${
                    !losowy && celMs === s * 1000
                      ? "border-mint bg-mint/20 text-ink"
                      : "border-stroke bg-panel text-ink-muted"
                  }`}
                >
                  {s} s
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const wlaczam = !losowy;
                  setLosowy(wlaczam);
                  if (wlaczam) setCelMs(losujCel(limitMs));
                  else setCelMs(limitMs);
                  wyczyscWynik();
                }}
                aria-pressed={losowy}
                className={`font-display inline-flex items-center gap-1.5 rounded-[14px] border-[3px] px-4 py-2 text-sm font-bold uppercase tracking-[0.04em] ${
                  losowy ? "border-mint bg-mint/20 text-ink" : "border-stroke bg-panel text-ink-muted"
                }`}
              >
                <Dices size={16} strokeWidth={2.5} aria-hidden /> {t("trening.random")}
              </button>
            </div>

            {/* Dowolny cel. Pole akceptuje przecinek i kropkę — na polskiej klawiaturze
                telefonu przecinek jest tym, co wpada pod palec. */}
            <label className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
              <Target size={16} strokeWidth={2.5} aria-hidden />
              <span>{losowy ? t("trening.maxTarget") : t("trening.ownTarget")}</span>
              <input
                type="text"
                inputMode="decimal"
                value={wpis}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d.,]/g, "");
                  setWpis(v);
                  const liczba = Number(v.replace(",", "."));
                  if (Number.isFinite(liczba) && liczba > 0) {
                    const ms = Math.min(CEL_MAX_MS, Math.max(CEL_MIN_MS, Math.round(liczba * 1000)));
                    setLimitMs(ms);
                    setCelMs(losowy ? losujCel(ms) : ms);
                    wyczyscWynik();
                  }
                }}
                aria-label={t("trening.ownTarget")}
                className="tabular w-20 rounded-[12px] border-[3px] border-stroke bg-panel px-2 py-2 text-center text-lg font-bold text-ink"
              />
              <span>s</span>
            </label>
            {losowy && (
              <p className="max-w-xs text-xs font-semibold leading-snug text-ink-muted">
                {t("trening.randomHint")}
              </p>
            )}
            </>
          }
        </div>
      </div>

      {/* —— POMIAR ——
          „gotowy" i „mierzy" mają IDENTYCZNY układ: cyfry nad przyciskiem i podpowiedź
          pod nim są ZAWSZE wyrenderowane, tylko jedna z nich jest niewidoczna. Wysokość
          zgadza się wtedy z definicji, bez wpisywania jej na sztywno — a podpowiedź
          zawija się na różną liczbę linii zależnie od języka i szerokości ekranu.
          Sam przycisk to jeden element zmieniający rolę, więc React go nie przemontowuje. */}
      {faza === "uniewazniona" ? (
        <>
          <p className="relative max-w-xs text-base font-semibold text-czerwien">{t("stoper.busted")}</p>
          <button type="button" onClick={nowaProba} className="btn relative">
            <RotateCcw size={18} strokeWidth={2.5} aria-hidden /> {t("trening.again")}
          </button>
        </>
      ) : faza === "wynik" && bladMs != null ? (
        <>
          <p className={`tabular relative text-5xl font-bold ${idealne ? "text-mint" : dobra ? "text-ink" : "text-ink-muted"}`}>
            {zeZnakiem(bladMs)} s
          </p>
          <p className="font-display relative text-sm font-bold uppercase tracking-[0.06em] text-ink-muted">
            {idealne ? t("stoper.perfect") : bladMs >= 0 ? t("trening.late") : t("trening.early")}
          </p>
          <button type="button" onClick={nowaProba} className="btn relative">
            <RotateCcw size={18} strokeWidth={2.5} aria-hidden /> {t("trening.again")}
          </button>
        </>
      ) : (
        <>
          <p className={`tabular relative text-4xl text-ink-muted ${faza === "mierzy" ? "" : "invisible"}`}>
            ●●:●●.●●
          </p>
          <button
            type="button"
            onClick={faza === "mierzy" ? stop : start}
            className={`font-display relative flex size-40 items-center justify-center gap-2 rounded-full border-[5px] text-3xl font-bold uppercase tracking-[0.06em] transition-transform duration-75 active:translate-y-[6px] active:shadow-none ${
              faza === "mierzy"
                ? "border-bursztyn bg-panel-hi text-bursztyn shadow-[0_6px_0_color-mix(in_srgb,var(--color-bursztyn)_45%,black)]"
                : "border-white bg-bursztyn text-black shadow-[0_6px_0_color-mix(in_srgb,var(--color-bursztyn)_55%,black)]"
            }`}
          >
            {faza === "mierzy" ? (
              <>
                <Square size={28} strokeWidth={3} aria-hidden /> {t("stoper.stop")}
              </>
            ) : (
              <>
                <Play size={30} strokeWidth={3} aria-hidden /> {t("stoper.start")}
              </>
            )}
          </button>
          <p
            className={`relative max-w-xs text-sm font-semibold text-ink-muted ${faza === "mierzy" ? "invisible" : ""}`}
            aria-hidden={faza === "mierzy"}
          >
            {t("stoper.hint")}
          </p>
        </>
      )}

      {/* —— SERIA —— */}
      {stat && (
        <section className="relative flex w-full max-w-md flex-col gap-3 rounded-[18px] border-[3px] border-stroke bg-panel p-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-bold uppercase tracking-[0.06em] text-ink-muted">
              {t("trening.session", { n: stat.prob })}
            </span>
            <button
              type="button"
              onClick={() => setProby([])}
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            >
              <Trash2 size={13} strokeWidth={2.5} aria-hidden /> {t("trening.clear")}
            </button>
          </div>

          {/* Pasek prób: wysokość słupka = błąd, strona = znak. Jeden rzut oka
              wystarcza, żeby zobaczyć, czy mylisz się zawsze w tę samą stronę. */}
          <div className="flex h-14 items-center gap-1" aria-hidden>
            {proby.map((pr, i) => {
              const skala = Math.min(1, Math.abs(pr.bladMs) / Math.max(500, progDobrej(pr.celMs) * 4));
              const ok = Math.abs(pr.bladMs) <= progDobrej(pr.celMs);
              return (
                <div key={i} className="flex h-full flex-1 flex-col justify-center">
                  <div className="flex h-1/2 items-end">
                    {pr.bladMs > 0 && (
                      <div className="w-full rounded-t-[3px]" style={{ height: `${skala * 100}%`, background: ok ? "var(--color-mint)" : "var(--color-czerwien)" }} />
                    )}
                  </div>
                  <div className="h-px w-full bg-stroke" />
                  <div className="flex h-1/2 items-start">
                    {pr.bladMs <= 0 && (
                      <div className="w-full rounded-b-[3px]" style={{ height: `${skala * 100}%`, background: ok ? "var(--color-mint)" : "var(--color-czerwien)" }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              { k: t("trening.stat.avg"), v: fmt(stat.sredniBlad) },
              { k: t("trening.stat.bias"), v: zeZnakiem(stat.odchylenie) },
              { k: t("trening.stat.spread"), v: "±" + fmt(stat.rozrzut) },
            ].map((x) => (
              <div key={x.k} className="rounded-[12px] border-2 border-stroke bg-panel-hi px-2 py-2">
                <dt className="font-display text-[0.65rem] font-bold uppercase tracking-[0.06em] text-ink-muted">{x.k}</dt>
                <dd className="tabular text-lg font-bold text-ink">{x.v}</dd>
              </div>
            ))}
          </dl>

          <p className="text-sm font-semibold leading-snug text-ink-muted">
            {t(`trening.diag.${diag}` as "trening.diag.rowno")}
          </p>

          {stat.seria >= 2 && (
            <p className="font-display text-xs font-bold uppercase tracking-[0.06em] text-mint">
              {t("trening.streak", { n: stat.seria })}
            </p>
          )}
        </section>
      )}

      {rekord != null && (
        <p className="font-display relative inline-flex items-center gap-2 rounded-[14px] border-[3px] border-stroke bg-panel px-3 py-2 text-xs font-bold uppercase tracking-[0.06em] text-ink-muted">
          <Trophy size={15} strokeWidth={2.5} aria-hidden /> {t("trening.best", { time: fmt(rekord) })}
        </p>
      )}

      <Link
        href="/"
        className="font-display relative mt-auto text-sm font-bold uppercase tracking-[0.06em] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {t("common.back")}
      </Link>
    </main>
  );
}
