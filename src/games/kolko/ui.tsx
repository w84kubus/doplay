"use client";
import { Circle, X as Krzyzyk } from "lucide-react";

// Wspólna plansza dla widoku gracza i ekranu TV — różni je tylko rozmiar.
// Znak rysujemy ikoną, nie literą: „O" i „0" w foncie display są mylnie podobne,
// a z trzech metrów na telewizorze różnicy nie widać wcale.

export type Pole = 0 | 1 | null;

export function Plansza({
  plansza,
  linia,
  rozmiar,
  onPole,
  aktywne,
  accent,
}: {
  plansza: Pole[];
  linia?: readonly number[] | null;
  /** Bok pojedynczego pola w px. */
  rozmiar: number;
  onPole?: (i: number) => void;
  /** Czy pola reagują na dotyk (tylko we własnej turze). */
  aktywne?: boolean;
  accent: string;
}) {
  const ikona = Math.round(rozmiar * 0.62);
  return (
    <div
      className="grid grid-cols-3 gap-2"
      style={{ ["--accent" as string]: accent }}
      role="grid"
      aria-label="Plansza"
    >
      {plansza.map((pole, i) => {
        const wygrywajace = !!linia?.includes(i);
        const puste = pole === null;
        const klikalne = !!aktywne && puste && !!onPole;
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            aria-label={`Pole ${i + 1}${pole === 0 ? " - krzyżyk" : pole === 1 ? " - kółko" : " - puste"}`}
            disabled={!klikalne}
            onClick={() => klikalne && onPole?.(i)}
            className="flex items-center justify-center rounded-[14px] border-[3px] transition-transform duration-75 active:translate-y-[3px] disabled:active:translate-y-0"
            style={{
              width: rozmiar,
              height: rozmiar,
              borderColor: wygrywajace ? accent : "var(--color-stroke)",
              background: wygrywajace ? `color-mix(in srgb, ${accent} 22%, transparent)` : "var(--color-panel)",
              boxShadow: klikalne ? "0 3px 0 rgb(0 0 0 / 0.35)" : "none",
              cursor: klikalne ? "pointer" : "default",
            }}
          >
            {pole === 0 && <Krzyzyk size={ikona} strokeWidth={3} style={{ color: accent }} aria-hidden />}
            {pole === 1 && <Circle size={ikona} strokeWidth={3} className="text-ink" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** Znak gracza jako ikona — używany przy nickach, żeby było wiadomo kto czym gra. */
export function Znak({ znak, size = 16, accent }: { znak: 0 | 1; size?: number; accent: string }) {
  return znak === 0 ? (
    <Krzyzyk size={size} strokeWidth={3} style={{ color: accent }} aria-hidden />
  ) : (
    <Circle size={size} strokeWidth={3} className="text-ink" aria-hidden />
  );
}
