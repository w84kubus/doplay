"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";

// Kostka jako sześcian CSS. Bez three.js: przy tym rozmiarze różnicy nie widać, a paczka
// z silnikiem 3D ważyłaby więcej niż cała reszta gry.
//
// NAJWAŻNIEJSZE: animacja niczego nie losuje. Wynik przychodzi z serwera (zasada 1 i 3),
// a sześcian tylko dokręca się do właściwej ścianki. Gdyby kostka losowała u siebie,
// wystarczyłby DevTools, żeby zawsze wyrzucać szóstkę.

/** Obrót, przy którym dana ścianka patrzy na gracza. */
const SCIANKI: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 },
};

/** Układ oczek na ściance, w siatce 3x3. */
const OCZKA: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const BOK = 64; // px
const PROMIEN = BOK / 2;

export function Kostka({ wartosc, kolor }: { wartosc: number | null; kolor: string }) {
  const t = useT();
  const [obrot, setObrot] = useState({ x: -20, y: 25 });
  const [kreci, setKreci] = useState(false);
  const obroty = useRef(0);
  const poprzednia = useRef<number | null>(null);

  useEffect(() => {
    if (wartosc == null || wartosc === poprzednia.current) {
      poprzednia.current = wartosc;
      return;
    }
    poprzednia.current = wartosc;

    const bezRuchu = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const cel = SCIANKI[wartosc];
    // Pełne obroty doliczamy do docelowego kąta, więc sześcian kręci się kilka razy
    // i zatrzymuje DOKŁADNIE na właściwej ściance. Licznik rośnie, żeby kolejny rzut
    // tej samej liczby też był widoczny jako obrót, a nie jako bezruch.
    obroty.current += bezRuchu ? 0 : 2;
    setKreci(!bezRuchu);
    setObrot({ x: cel.x - 360 * obroty.current, y: cel.y + 360 * obroty.current });

    if (bezRuchu) return;
    const id = setTimeout(() => setKreci(false), 900);
    return () => clearTimeout(id);
  }, [wartosc]);

  const sciana = (n: number) => {
    const { x, y } = SCIANKI[n];
    // Ścianki ustawiamy odwrotnością obrotu, który je pokazuje.
    const transform = `rotateX(${-x}deg) rotateY(${-y}deg) translateZ(${PROMIEN}px)`;
    return (
      <div
        key={n}
        aria-hidden
        style={{
          position: "absolute",
          width: BOK,
          height: BOK,
          transform,
          background: "#FFFFFF",
          borderRadius: 12,
          border: "2px solid #2A1758",
          display: "grid",
          gridTemplate: "repeat(3, 1fr) / repeat(3, 1fr)",
          padding: 7,
          boxSizing: "border-box",
        }}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: OCZKA[n].includes(i) ? kolor : "transparent",
              justifySelf: "center",
              alignSelf: "center",
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div style={{ perspective: 600, width: BOK, height: BOK }} role="img"
      aria-label={wartosc ? t("chinczyk.diceValue", { n: wartosc }) : t("chinczyk.dice")}>
      <div
        style={{
          position: "relative",
          width: BOK,
          height: BOK,
          transformStyle: "preserve-3d",
          transform: `rotateX(${obrot.x}deg) rotateY(${obrot.y}deg)`,
          transition: kreci ? "transform 0.9s cubic-bezier(0.2, 0.8, 0.2, 1)" : "transform 0.25s ease",
        }}
      >
        {[1, 2, 3, 4, 5, 6].map(sciana)}
      </div>
    </div>
  );
}
