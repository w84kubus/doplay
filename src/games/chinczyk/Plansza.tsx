"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { BAZY, BOK, KORYTARZE, poleStartowe, polePostepu, SRODEK, TRASA } from "./geometria";
import { BEZPIECZNE, idxPionka, META, pionkiKoloru, W_BAZIE } from "./engine";
import { klatkiPrzejazdu } from "./przejazd";

// Plansza na DOM-ie i Tailwindzie, nie w SVG — tak jak plansza Kółka i krzyżyka
// (`kolko/ui.tsx`). To nie jest kwestia techniki, tylko wyglądu: cała aplikacja stoi na
// PRZEŚWITUJĄCYCH białych panelach na fioletowym tle (`--color-panel` to biel 12%),
// a plansza rysowana jako ciemna płyta z włosowatymi kreskami wyglądała jak wklejka
// z innego programu. Tu wszystko idzie tymi samymi tokenami co `.card` i `.btn`.
//
// Siatka 15x15 skaluje się procentowo, więc ten sam komponent obsługuje telefon i ekran
// TV bez żadnych progów. Rysowanie jest CZYSTE: komponent dostaje pozycje i oddaje obrazek.

export const BARWY = ["#E4002B", "#34D399", "#FFB627", "#3B82F6"] as const;

/** Nazwy kolorów w kolejności slotów — do plików pionków i do etykiet dla czytnika. */
const NAZWY = ["czerwony", "zielony", "zolty", "niebieski"] as const;

/**
 * Pionki to gotowe grafiki, nie kolorowe krążki.
 *
 * Wszystkie cztery mają WSPÓLNE płótno 156x256 i są wyrównane do dołu, więc podstawa
 * wypada w każdym pliku w tym samym miejscu. Dzięki temu pionek da się ustawić „na"
 * kratce jednym wzorem, bez korekt per kolor.
 */
const PROPORCJA = 156 / 256;
/** Wysokość pionka w kratkach. Wyższy niż pole, tak jak prawdziwa figurka na planszy. */
const WYSOKOSC = 1.3;
/** O ile podstawa pionka schodzi poniżej środka kratki, żeby na niej stał, a nie w niej pływał. */
const OSADZENIE = 0.34;

/** Kąt bazy w siatce: [kolumna startowa, wiersz startowy] liczone od zera. */
const ROG_BAZY = [
  [0, 9],
  [0, 0],
  [9, 0],
  [9, 9],
] as const;

interface Props {
  /** Płaska tablica 16 pozycji, tak jak w stanie silnika (Firestore nie zna tablic w tablicach). */
  pionki: number[];
  /** Kolory obsadzone w tej partii; puste sloty rysujemy przygaszone. */
  sloty: (string | null)[];
  /** Indeks koloru, którego jest tura. */
  tura: number;
  /** Pionki, którymi wolno się teraz ruszyć — podświetlane i klikalne. */
  ruchy?: number[];
  /** Kolor gracza patrzącego na planszę; null na ekranie TV. */
  mojKolor?: number | null;
  onPionek?: (pionek: number) => void;
}

/** Procent boku planszy przypadający na jedną kratkę. */
const KRATKA = 100 / BOK;

/** Rozsuwa pionki stojące na jednym polu, żeby było widać, że jest ich kilka. */
function rozsun(ile: number, i: number): { dx: number; dy: number } {
  if (ile <= 1) return { dx: 0, dy: 0 };
  const rozrzut = 0.16;
  return { dx: (i - (ile - 1) / 2) * rozrzut, dy: (i % 2 === 0 ? -1 : 1) * rozrzut * 0.6 };
}

/**
 * Środek planszy: cztery miejsca w ćwiartce danego koloru, ustawione 2x2.
 *
 * Rządek czterech pionków wzdłuż jednej krawędzi nie mieścił się w trójkącie — przy
 * czterech ukończonych wychodziły poza swoje pole i wchodziły na sąsiednie kolory.
 * Kwadrat 2x2 przy zewnętrznej części trójkąta trzyma je w obrębie własnej ćwiartki.
 */
function miejsceWDomu(kolor: number, i: number): { x: number; y: number } {
  const srodek = SRODEK.od + 1.5; // 7.5
  /** Jak daleko od punktu zbiegu trójkątów stoi grupa. */
  const odsun = 0.85;
  const dx = (i % 2 === 0 ? -1 : 1) * 0.24;
  const dy = (i < 2 ? -1 : 1) * 0.24;
  if (kolor === 0) return { x: srodek + dx, y: srodek + odsun + dy };
  if (kolor === 1) return { x: srodek - odsun + dx, y: srodek + dy };
  if (kolor === 2) return { x: srodek + dx, y: srodek - odsun + dy };
  return { x: srodek + odsun + dx, y: srodek + dy };
}

/** Ile trwa jeden przeskok pionka na sąsiednie pole. */
const SKOK_MS = 115;

function bezRuchu(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}

/** Kratka siatki: pozycja w procentach boku. `span` w kratkach. */
function kratka(x: number, y: number, span = 1) {
  return {
    left: `${x * KRATKA}%`,
    top: `${y * KRATKA}%`,
    width: `${span * KRATKA}%`,
    height: `${span * KRATKA}%`,
  } as const;
}

export function Plansza({ pionki, sloty, tura, ruchy = [], mojKolor = null, onPionek }: Props) {
  const t = useT();

  // Plansza pokazuje WŁASNY stan, nie ten z serwera: przy ruchu przechodzi przez pola
  // pośrednie, zanim dojdzie do stanu docelowego. Klucz ze złączenia, bo `pionki`
  // to za każdym renderem nowa tablica i porównanie po referencji nic by nie dało.
  const klucz = pionki.join(",");
  const [widoczne, setWidoczne] = useState<number[]>(pionki);
  const pokazany = useRef<number[]>(pionki);
  const timery = useRef<number[]>([]);

  useEffect(() => {
    timery.current.forEach(clearTimeout);
    timery.current = [];

    const cel = klucz.split(",").map(Number);
    const klatki = bezRuchu() ? [] : klatkiPrzejazdu(pokazany.current, cel);
    if (klatki.length <= 1) {
      pokazany.current = cel;
      setWidoczne(cel);
      return;
    }

    klatki.forEach((klatka, i) => {
      timery.current.push(
        window.setTimeout(() => {
          pokazany.current = klatka;
          setWidoczne(klatka);
        }, i * SKOK_MS),
      );
    });
    return () => {
      timery.current.forEach(clearTimeout);
      timery.current = [];
    };
  }, [klucz]);

  // Gdzie stoi każdy z 16 pionków. Najpierw grupujemy po polach (żeby rozsunąć te,
  // które dzielą pole), potem dopiero wyliczamy współrzędne.
  const naPolu = new Map<string, number[]>();
  for (let kolor = 0; kolor < 4; kolor++) {
    if (!sloty[kolor]) continue;
    pionkiKoloru(widoczne, kolor).forEach((postep, i) => {
      if (postep === W_BAZIE || postep === META) return;
      const p = polePostepu(kolor, postep);
      if (!p) return;
      const klucz = `${p.x},${p.y}`;
      naPolu.set(klucz, [...(naPolu.get(klucz) ?? []), idxPionka(kolor, i)]);
    });
  }

  const gdzie = (kolor: number, i: number): { x: number; y: number; skala: number } | null => {
    if (!sloty[kolor]) return null;
    const postep = widoczne[idxPionka(kolor, i)];
    if (postep === W_BAZIE) return { ...BAZY[kolor][i], skala: 1 };
    // Pionek „w domu" jest wyraźnie mniejszy: cztery muszą zmieścić się w jednym trójkącie.
    if (postep === META) return { ...miejsceWDomu(kolor, i), skala: 0.36 };
    const p = polePostepu(kolor, postep);
    if (!p) return null;
    const lista = naPolu.get(`${p.x},${p.y}`) ?? [];
    const { dx, dy } = rozsun(lista.length, Math.max(0, lista.indexOf(idxPionka(kolor, i))));
    return { x: p.x + 0.5 + dx, y: p.y + 0.5 + dy, skala: 0.82 };
  };

  return (
    // Panel z marginesem, a siatka dopiero w środku: pionek jest wyższy niż kratka,
    // więc ten z górnego rzędu musi mieć gdzie wystawać. Bez marginesu wychodził poza
    // ramkę planszy i wyglądał na doklejony z zewnątrz.
    <div
      className="aspect-square w-full rounded-[20px] border-[3px] border-stroke bg-panel p-[3.5%] shadow-[0_4px_0_rgb(0_0_0/0.35)]"
      role="img"
      aria-label={t("chinczyk.board")}
    >
      <div className="relative size-full">
      {/* Bazy: pełne 6x6 kratek w kącie. Wcześniej rysowałem je z przesunięciem 0,4
          jednostki do środka, więc nachodziły na pierwszą kolumnę trasy i zostawiały
          szparę przy krawędzi — plansza wyglądała na krzywo osadzoną, bo była. */}
      {ROG_BAZY.map(([kx, ky], kolor) => {
        // Kolor bez gracza NIE dostaje bazy. Przygaszona wersja i tak zajmowała całą
        // ćwiartkę, więc przy dwóch graczach połowa planszy była martwym, szarym slabem
        // ciągnącym wzrok. Puste miejsce czyta się jako „tu nikt nie gra" od razu.
        if (!sloty[kolor]) return null;
        return (
        <div
          key={`baza-${kolor}`}
          className="absolute rounded-[16px] border-[3px]"
          style={{
            ...kratka(kx, ky, 6),
            borderColor: BARWY[kolor],
            background: `color-mix(in srgb, ${BARWY[kolor]} 72%, transparent)`,
          }}
        >
          {BAZY[kolor].map((m, i) => (
            <span
              key={i}
              className="absolute rounded-full border-2"
              style={{
                // Gniazdo liczymy względem bazy, nie całej planszy.
                left: `${((m.x - kx) / 6) * 100}%`,
                top: `${((m.y - ky) / 6) * 100}%`,
                width: `${(1.15 / 6) * 100}%`,
                height: `${(1.15 / 6) * 100}%`,
                transform: "translate(-50%, -50%)",
                borderColor: BARWY[kolor],
                background: "rgb(20 10 36 / 0.45)",
              }}
            />
          ))}
        </div>
        );
      })}

      {/* Trasa. Pole startowe dostaje barwę właściciela, „globus" jaśniejszą obwódkę. */}
      {TRASA.map((p, i) => {
        const wl = [0, 1, 2, 3].find((k) => poleStartowe(k).x === p.x && poleStartowe(k).y === p.y);
        // Pole startowe koloru, którym nikt nie gra, jest zwykłym polem trasy.
        const wlasciciel = wl !== undefined && sloty[wl] ? wl : undefined;
        const bezpieczne = BEZPIECZNE.has(i);
        return (
          <div
            key={`t-${i}`}
            className="absolute rounded-[28%] border-2"
            style={{
              ...kratka(p.x, p.y),
              borderColor:
                wlasciciel !== undefined ? BARWY[wlasciciel] : bezpieczne ? "rgb(255 255 255 / 0.7)" : "rgb(255 255 255 / 0.24)",
              background:
                wlasciciel !== undefined
                  ? `color-mix(in srgb, ${BARWY[wlasciciel]} 55%, transparent)`
                  : bezpieczne
                    ? "rgb(255 255 255 / 0.42)"
                    : "rgb(255 255 255 / 0.20)",
            }}
          />
        );
      })}

      {/* Korytarze domowe. */}
      {KORYTARZE.map((korytarz, kolor) =>
        korytarz.map((p, i) => (
          <div
            key={`k-${kolor}-${i}`}
            className="absolute rounded-[28%] border-2"
            style={{
              ...kratka(p.x, p.y),
              // Korytarz bez gracza to zwykłe pole planszy, nie przygaszona kolorowa smuga.
              borderColor: sloty[kolor] ? BARWY[kolor] : "rgb(255 255 255 / 0.24)",
              background: sloty[kolor]
                ? `color-mix(in srgb, ${BARWY[kolor]} 88%, transparent)`
                : "rgb(255 255 255 / 0.20)",
            }}
          />
        )),
      )}

      {/* Środek: cztery trójkaty zbiegające się w punkcie, jak na prawdziwej planszy.
          Pusty kwadrat nie mówił nic o tym, że to cel czterech korytarzy. */}
      <div
        className="absolute overflow-hidden rounded-[14px] border-[3px] border-stroke bg-panel-hi"
        style={kratka(SRODEK.od, SRODEK.od, 3)}
      >
        {[
          "polygon(0% 100%, 100% 100%, 50% 50%)", // czerwony wchodzi od dołu
          "polygon(0% 0%, 0% 100%, 50% 50%)", // zielony od lewej
          "polygon(0% 0%, 100% 0%, 50% 50%)", // żółty od góry
          "polygon(100% 0%, 100% 100%, 50% 50%)", // niebieski od prawej
        ].map((ksztalt, kolor) => (
          <span
            key={kolor}
            className="absolute inset-0"
            style={{
              clipPath: ksztalt,
              background: BARWY[kolor],
              opacity: sloty[kolor] ? 0.75 : 0,
            }}
          />
        ))}
      </div>

      {/* Pionki. Stała kolejność i stały klucz — element żyje przez całą partię,
          więc zmiana pola to płynny przejazd, a nie skok. Wygląd jak pionek widziany
          z góry: ciemny kontur, twardy cień i połysk w lewym górnym rogu. */}
      {[0, 1, 2, 3].map((kolor) =>
        [0, 1, 2, 3].map((i) => {
          const poz = gdzie(kolor, i);
          if (!poz) return null;
          const klikalny = kolor === mojKolor && kolor === tura && ruchy.includes(i);
          const wys = KRATKA * WYSOKOSC * poz.skala;
          return (
            <button
              key={`p-${kolor}-${i}`}
              type="button"
              disabled={!klikalny}
              onClick={klikalny ? () => onPionek?.(i) : undefined}
              aria-label={t(`chinczyk.colour.${NAZWY[kolor]}` as never) + ` ${i + 1}`}
              // Globalna reguła `prefers-reduced-motion` wyłącza tę tranzycję sama
              // (`transition-duration: 0.01ms !important` na `*` w globals.css).
              className="absolute disabled:cursor-default"
              style={{
                left: `${poz.x * KRATKA}%`,
                // Kotwicą jest PODSTAWA pionka, nie jego środek: figurka ma stać na kratce.
                top: `${(poz.y + OSADZENIE * poz.skala) * KRATKA}%`,
                width: `${wys * PROPORCJA}%`,
                transform: "translate(-50%, -100%)",
                transformOrigin: "bottom center",
                cursor: klikalny ? "pointer" : "default",
                // Poświata zamiast obwódki: kontur pionka nie jest kołem, więc ring
                // z `box-shadow` obrysowałby prostokąt obrazka zamiast figurki.
                filter: klikalny
                  ? "drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px #fff) drop-shadow(0 2px 2px rgb(0 0 0 / 0.5))"
                  : "drop-shadow(0 2px 3px rgb(0 0 0 / 0.65))",
                // Krócej niż odstęp między skokami, inaczej kolejny skok przerywałby
                // poprzedni w połowie i ruch znów wyglądałby jak płynny ślizg.
                transition: `left ${SKOK_MS - 20}ms cubic-bezier(0.3, 0.9, 0.4, 1), top ${SKOK_MS - 20}ms cubic-bezier(0.3, 0.9, 0.4, 1), width 0.3s ease`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/chinczyk/pionek-${NAZWY[kolor]}.webp`}
                alt=""
                width={156}
                height={256}
                className="block h-auto w-full"
                aria-hidden
              />
            </button>
          );
        }),
      )}
      </div>
    </div>
  );
}
