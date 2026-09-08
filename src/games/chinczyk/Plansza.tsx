"use client";
import { useT } from "@/lib/i18n/provider";
import { BAZY, BOK, KORYTARZE, poleStartowe, polePostepu, SRODEK, TRASA } from "./geometria";
import { BEZPIECZNE, idxPionka, META, pionkiKoloru, W_BAZIE } from "./engine";

// Plansza rysowana jako SVG w układzie 15x15. Skaluje się do szerokości rodzica, więc
// ten sam komponent obsługuje telefon i ekran TV bez żadnych progów.
//
// Rysowanie jest CZYSTE: komponent dostaje pozycje i oddaje obrazek. Cała wiedza o tym,
// gdzie pionek stoi, siedzi w silniku (postęp) i w geometria.ts (współrzędne).
//
// Wszystkie 16 pionków renderujemy ZAWSZE, w stałej kolejności i pod stałym kluczem —
// także te w bazie i te w środku. Dzięki temu React nie odmontowuje elementu przy zmianie
// pola, a przejazd pionka da się oddać zwykłą tranzycją `transform`. Grupowanie po polach
// (naturalne, bo trzeba je rozsunąć) liczymy osobno i tylko po to, żeby wyliczyć przesunięcie.

export const BARWY = ["#E4002B", "#34D399", "#FFB627", "#3B82F6"] as const;
/** Przygaszone wersje na wypełnienia baz i korytarzy, żeby pionki się nie zlewały z tłem. */
const BARWY_TLA = ["#5A1220", "#12483A", "#4A3610", "#16325E"] as const;

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

/** Rozsuwa pionki stojące na jednym polu, żeby było widać, że jest ich kilka. */
function rozsun(ile: number, i: number): { dx: number; dy: number } {
  if (ile <= 1) return { dx: 0, dy: 0 };
  const rozrzut = 0.16;
  return { dx: (i - (ile - 1) / 2) * rozrzut, dy: (i % 2 === 0 ? -1 : 1) * rozrzut * 0.6 };
}

/** Środek planszy, ćwiartka danego koloru: cztery miejsca w rzędzie od strony korytarza. */
function miejsceWDomu(kolor: number, i: number): { x: number; y: number } {
  const srodek = SRODEK.od + 1.5; // 7.5
  const odsun = 0.85; // jak daleko od środka stoi rządek
  const wzdluz = (i - 1.5) * 0.42;
  if (kolor === 0) return { x: srodek + wzdluz, y: srodek + odsun };
  if (kolor === 1) return { x: srodek - odsun, y: srodek + wzdluz };
  if (kolor === 2) return { x: srodek + wzdluz, y: srodek - odsun };
  return { x: srodek + odsun, y: srodek + wzdluz };
}

export function Plansza({ pionki, sloty, tura, ruchy = [], mojKolor = null, onPionek }: Props) {
  const t = useT();
  // Gdzie stoi każdy z 16 pionków. Najpierw grupujemy po polach (żeby rozsunąć te,
  // które dzielą pole), potem dopiero wyliczamy współrzędne.
  const naPolu = new Map<string, number[]>();
  for (let kolor = 0; kolor < 4; kolor++) {
    if (!sloty[kolor]) continue;
    pionkiKoloru(pionki, kolor).forEach((postep, i) => {
      if (postep === W_BAZIE || postep === META) return;
      const p = polePostepu(kolor, postep);
      if (!p) return;
      const klucz = `${p.x},${p.y}`;
      naPolu.set(klucz, [...(naPolu.get(klucz) ?? []), idxPionka(kolor, i)]);
    });
  }

  // Rozmiar zmieniamy SKALĄ grupy, nie promieniem koła: jedna tranzycja `transform`
  // obsługuje wtedy i przejazd, i zmianę wielkości. Promień w atrybucie nie animuje się
  // w każdej przeglądarce, a pionek wjeżdżający do środka musi się zmniejszyć płynnie.
  const gdzie = (kolor: number, i: number): { x: number; y: number; skala: number } | null => {
    if (!sloty[kolor]) return null;
    const postep = pionki[idxPionka(kolor, i)];
    if (postep === W_BAZIE) return { ...BAZY[kolor][i], skala: 1 };
    if (postep === META) return { ...miejsceWDomu(kolor, i), skala: 0.42 };
    const p = polePostepu(kolor, postep);
    if (!p) return null;
    const lista = naPolu.get(`${p.x},${p.y}`) ?? [];
    const { dx, dy } = rozsun(lista.length, Math.max(0, lista.indexOf(idxPionka(kolor, i))));
    return { x: p.x + 0.5 + dx, y: p.y + 0.5 + dy, skala: 0.76 };
  };

  return (
    <svg viewBox={`0 0 ${BOK} ${BOK}`} className="w-full" role="img" aria-label={t("chinczyk.board")}>
      <rect x={0} y={0} width={BOK} height={BOK} rx={0.6} fill="#2A1758" />

      {/* Bazy: kwadrat 6x6 w każdym kącie. */}
      {BAZY.map((baza, kolor) => {
        const x = kolor === 0 || kolor === 1 ? 0.4 : 8.6;
        const y = kolor === 1 || kolor === 2 ? 0.4 : 8.6;
        const czynny = Boolean(sloty[kolor]);
        return (
          <g key={`baza-${kolor}`} opacity={czynny ? 1 : 0.28}>
            <rect x={x} y={y} width={6} height={6} rx={0.7} fill={BARWY_TLA[kolor]} stroke={BARWY[kolor]} strokeWidth={0.14} />
            {baza.map((m, i) => (
              <circle key={i} cx={m.x} cy={m.y} r={0.62} fill="#1B1030" stroke={BARWY[kolor]} strokeWidth={0.09} />
            ))}
          </g>
        );
      })}

      {/* Trasa. Pola startowe i globusy dostają obwódkę koloru — to są pola bezpieczne. */}
      {TRASA.map((p, i) => {
        const bezpieczne = BEZPIECZNE.has(i);
        const wlasciciel = [0, 1, 2, 3].find((k) => poleStartowe(k).x === p.x && poleStartowe(k).y === p.y);
        return (
          <rect
            key={`t-${i}`}
            x={p.x + 0.06}
            y={p.y + 0.06}
            width={0.88}
            height={0.88}
            rx={0.18}
            fill={wlasciciel !== undefined ? BARWY_TLA[wlasciciel] : "#3A2470"}
            stroke={bezpieczne ? (wlasciciel !== undefined ? BARWY[wlasciciel] : "#E3D4F7") : "#241553"}
            strokeWidth={bezpieczne ? 0.1 : 0.05}
          />
        );
      })}

      {/* Korytarze domowe. */}
      {KORYTARZE.map((korytarz, kolor) => (
        <g key={`k-${kolor}`} opacity={sloty[kolor] ? 1 : 0.28}>
          {korytarz.map((p, i) => (
            <rect key={i} x={p.x + 0.06} y={p.y + 0.06} width={0.88} height={0.88} rx={0.18}
              fill={BARWY[kolor]} opacity={0.55} />
          ))}
        </g>
      ))}

      {/* Środek: cel wszystkich czterech korytarzy. */}
      <rect x={SRODEK.od} y={SRODEK.od} width={3} height={3} rx={0.4} fill="#1B1030" stroke="#E3D4F7" strokeWidth={0.08} />

      {/* Pionki. Stała kolejność i stały klucz — element żyje przez całą partię,
          więc zmiana pola to płynny przejazd, a nie skok. */}
      {[0, 1, 2, 3].map((kolor) =>
        [0, 1, 2, 3].map((i) => {
          const poz = gdzie(kolor, i);
          if (!poz) return null;
          const klikalny = kolor === mojKolor && kolor === tura && ruchy.includes(i);
          return (
            <g
              key={`p-${kolor}-${i}`}
              // Globalna reguła `prefers-reduced-motion` wyłącza tę tranzycję sama
              // (`transition-duration: 0.01ms !important` na `*` w globals.css).
              style={{
                transform: `translate(${poz.x}px, ${poz.y}px) scale(${poz.skala})`,
                transition: "transform 0.4s cubic-bezier(0.34, 1.1, 0.5, 1)",
              }}
            >
              <circle
                cx={0}
                cy={0}
                r={0.5}
                fill={BARWY[kolor]}
                stroke={klikalny ? "#FFFFFF" : "#1B1030"}
                strokeWidth={klikalny ? 0.14 : 0.07}
                className={klikalny ? "cursor-pointer" : undefined}
                onClick={klikalny ? () => onPionek?.(i) : undefined}
              />
            </g>
          );
        }),
      )}
    </svg>
  );
}
