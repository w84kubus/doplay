"use client";
import { useT } from "@/lib/i18n/provider";
import { BAZY, BOK, KORYTARZE, poleStartowe, polePostepu, SRODEK, TRASA } from "./geometria";
import { BEZPIECZNE, META, pionkiKoloru, W_BAZIE } from "./engine";

// Plansza rysowana jako SVG w układzie 15x15. Skaluje się do szerokości rodzica, więc
// ten sam komponent obsługuje telefon i ekran TV bez żadnych progów.
//
// Rysowanie jest CZYSTE: komponent dostaje pozycje i oddaje obrazek. Cała wiedza o tym,
// gdzie pionek stoi, siedzi w silniku (postęp) i w plansza.ts (współrzędne).

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

export function Plansza({ pionki, sloty, tura, ruchy = [], mojKolor = null, onPionek }: Props) {
  const t = useT();
  // Ile pionków stoi na każdym polu — potrzebne, żeby je rozsunąć.
  const naPolu = new Map<string, { kolor: number; pionek: number }[]>();
  [0, 1, 2, 3].forEach((kolor) => {
    if (!sloty[kolor]) return; // kolor bez gracza nie ma czego pokazywać na trasie
    pionkiKoloru(pionki, kolor).forEach((postep, pionek) => {
      if (postep === W_BAZIE || postep === META) return;
      const p = polePostepu(kolor, postep);
      if (!p) return;
      const k = `${p.x},${p.y}`;
      naPolu.set(k, [...(naPolu.get(k) ?? []), { kolor, pionek }]);
    });
  });

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

      {/* Pionki w środku: licznik przy każdym kolorze, żeby było widać postęp partii. */}
      {[0, 1, 2, 3].map((kolor) => {
        const wDomu = pionkiKoloru(pionki, kolor).filter((p) => p === META).length;
        if (!wDomu || !sloty[kolor]) return null;
        const poz = [{ x: 7.5, y: 8.4 }, { x: 6.6, y: 7.5 }, { x: 7.5, y: 6.6 }, { x: 8.4, y: 7.5 }][kolor];
        return (
          <g key={`d-${kolor}`}>
            <circle cx={poz.x} cy={poz.y} r={0.42} fill={BARWY[kolor]} />
            <text x={poz.x} y={poz.y + 0.2} textAnchor="middle" fontSize={0.55} fontWeight="bold" fill="#1B1030">
              {wDomu}
            </text>
          </g>
        );
      })}

      {/* Pionki w bazach. */}
      {[0, 1, 2, 3].map((kolor) =>
        pionkiKoloru(pionki, kolor).map((postep, i) => {
          if (postep !== W_BAZIE || !sloty[kolor]) return null;
          const m = BAZY[kolor][i];
          const klikalny = kolor === mojKolor && kolor === tura && ruchy.includes(i);
          return (
            <circle
              key={`b-${kolor}-${i}`}
              cx={m.x}
              cy={m.y}
              r={0.5}
              fill={BARWY[kolor]}
              stroke={klikalny ? "#FFFFFF" : "#1B1030"}
              strokeWidth={klikalny ? 0.14 : 0.07}
              className={klikalny ? "cursor-pointer" : undefined}
              onClick={klikalny ? () => onPionek?.(i) : undefined}
            />
          );
        }),
      )}

      {/* Pionki na trasie i w korytarzach. */}
      {[...naPolu.entries()].map(([klucz, lista]) =>
        lista.map(({ kolor, pionek }, idx) => {
          const [x, y] = klucz.split(",").map(Number);
          const { dx, dy } = rozsun(lista.length, idx);
          const klikalny = kolor === mojKolor && kolor === tura && ruchy.includes(pionek);
          return (
            <circle
              key={`p-${kolor}-${pionek}`}
              cx={x + 0.5 + dx}
              cy={y + 0.5 + dy}
              r={0.38}
              fill={BARWY[kolor]}
              stroke={klikalny ? "#FFFFFF" : "#1B1030"}
              strokeWidth={klikalny ? 0.13 : 0.07}
              className={klikalny ? "cursor-pointer" : undefined}
              onClick={klikalny ? () => onPionek?.(pionek) : undefined}
            />
          );
        }),
      )}
    </svg>
  );
}
