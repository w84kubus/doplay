"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { sfx } from "@/lib/sound";

// Kostka jako sześcian CSS. Bez three.js: przy tym rozmiarze różnicy nie widać, a paczka
// z silnikiem 3D ważyłaby więcej niż cała reszta gry.
//
// NAJWAŻNIEJSZE: animacja niczego nie losuje. Wynik przychodzi z serwera (zasada 1 i 3),
// a sześcian tylko dokręca się do właściwej ścianki. Gdyby kostka losowała u siebie,
// wystarczyłby DevTools, żeby zawsze wyrzucać szóstkę.
//
// Rzut ma dwie części, bo tyle realnie trwa. `kreci` (żądanie w locie) daje zamach: sześcian
// robi jeden pełny obrót od razu po kliknięciu, więc gracz widzi reakcję, zanim serwer
// odpowie. Przyjście wartości dokłada kolejny obrót i zatrzymuje kostkę na jej ściance.
//
// Kąty liczymy zawsze od licznika obrotów, nigdy względem bieżącego stanu — dzięki temu
// każdy krok jest DO PRZODU. Gdyby cel wypadł „za" aktualnym kątem, kostka cofnęłaby się
// w połowie rzutu, co wygląda jak zacięcie.

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
/** Ile trwa dojazd do wyniku. Krócej wygląda jak przeskok, dłużej nudzi przy każdej turze. */
const LADOWANIE_MS = 850;
const ODBICIE_MS = 220;
const ZAMACH_MS = 700;
/** Pozycja spoczynkowa: lekko przekręcona, żeby było widać, że to sześcian, a nie kwadrat. */
const SPOCZYNEK = { x: -20, y: 25 };

function bezRuchu(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}

/** Grzechot: kilka klików coraz rzadziej, na końcu niższy - jak kostka gasnąca na stole. */
function grzechot(): number[] {
  const id = [0, 90, 200, 330, 480].map((ms) => window.setTimeout(() => sfx.tick(), ms));
  id.push(window.setTimeout(() => sfx.stop(), 640));
  return id;
}

export function Kostka({
  wartosc,
  kolor,
  kreci = false,
}: {
  wartosc: number | null;
  kolor: string;
  /** Rzut jest w drodze do serwera - wiruj, dopóki nie wróci wynik. */
  kreci?: boolean;
}) {
  const t = useT();
  const [obrot, setObrot] = useState(SPOCZYNEK);
  const [tranzycja, setTranzycja] = useState("transform 0.25s ease");
  const [odbicie, setOdbicie] = useState(false);
  const obroty = useRef(0);
  const poprzednia = useRef<number | null>(null);
  /** Pierwsze wejście komponentu. Wynik zastany po odświeżeniu strony ma się NIE turlać. */
  const pierwszy = useRef(true);

  // Zamach: klik już poleciał na serwer, wynik jeszcze nie wrócił.
  useEffect(() => {
    if (!kreci || bezRuchu()) return;
    obroty.current += 1;
    setTranzycja(`transform ${ZAMACH_MS}ms linear`);
    setObrot({ x: SPOCZYNEK.x - 360 * obroty.current, y: SPOCZYNEK.y + 360 * obroty.current });
  }, [kreci]);

  useEffect(() => {
    const zastane = pierwszy.current;
    pierwszy.current = false;
    if (wartosc == null || wartosc === poprzednia.current) {
      poprzednia.current = wartosc;
      return;
    }
    poprzednia.current = wartosc;

    // Wejście do trwającej partii to nie jest rzut. Turlanie i grzechot przy każdym
    // odświeżeniu strony udawałyby zdarzenie, którego nie było.
    const cicho = zastane || bezRuchu();
    const cel = SCIANKI[wartosc];
    // Pełne obroty doliczamy do docelowego kąta, więc sześcian kręci się kilka razy
    // i zatrzymuje DOKŁADNIE na właściwej ściance. Licznik rośnie, żeby kolejny rzut
    // tej samej liczby też był widoczny jako obrót, a nie jako bezruch.
    obroty.current += cicho ? 0 : 1;
    setTranzycja(cicho ? "transform 0.25s ease" : `transform ${LADOWANIE_MS}ms cubic-bezier(0.16, 0.9, 0.2, 1)`);
    setObrot({ x: cel.x - 360 * obroty.current, y: cel.y + 360 * obroty.current });

    if (cicho) return;
    const dzwieki = grzechot();
    const stop = window.setTimeout(() => setOdbicie(true), LADOWANIE_MS);
    const koniec = window.setTimeout(() => setOdbicie(false), LADOWANIE_MS + ODBICIE_MS);
    return () => [...dzwieki, stop, koniec].forEach(clearTimeout);
  }, [wartosc]);

  return (
    <div
      style={{ perspective: 600, width: BOK, height: BOK }}
      role="img"
      aria-label={wartosc ? t("chinczyk.diceValue", { n: wartosc }) : t("chinczyk.dice")}
    >
      <div
        style={{
          width: BOK,
          height: BOK,
          transformStyle: "preserve-3d",
          // Odbicie: kostka „dosiada" po zatrzymaniu, więc wygląda, jakby miała masę.
          transform: odbicie ? "scale(1.12)" : "scale(1)",
          transition: `transform ${ODBICIE_MS}ms cubic-bezier(0.34, 1.6, 0.5, 1)`,
        }}
      >
        <div
          style={{
            position: "relative",
            width: BOK,
            height: BOK,
            transformStyle: "preserve-3d",
            transform: `rotateX(${obrot.x}deg) rotateY(${obrot.y}deg)`,
            transition: tranzycja,
          }}
        >
          {[1, 2, 3, 4, 5, 6].map((n) => {
            const { x, y } = SCIANKI[n];
            // Ścianki ustawiamy odwrotnością obrotu, który je pokazuje.
            return (
              <div
                key={n}
                aria-hidden
                style={{
                  position: "absolute",
                  width: BOK,
                  height: BOK,
                  transform: `rotateX(${-x}deg) rotateY(${-y}deg) translateZ(${PROMIEN}px)`,
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
          })}
        </div>
      </div>
    </div>
  );
}
