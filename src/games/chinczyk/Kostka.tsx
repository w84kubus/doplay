"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { sfx } from "@/lib/sound";

// Kostka płaska, nie sześcian w 3D.
//
// Poprzednia wersja obracała sześcian w perspektywie i wyglądała źle z dwóch powodów.
// Po pierwsze `perspective: 600` przy boku 64 px daje przesadną zbieżność, więc górna
// ścianka wychodziła jako przekrzywiony równoległobok — kostka „leżała krzywo". Po drugie
// każda ścianka miała własny promień i własną obwódkę, więc krawędzie sześcianu się nie
// schodziły i na rogach było widać podwójne kontury. Do tego nic innego na tej stronie
// nie ma perspektywy 3D, więc i tak odstawała.
//
// Teraz to zwykły kafelek w stylu reszty interfejsu: biała karta, gruby kontur, twardy
// cień. Rzut oddajemy potrząśnięciem i przeskakiwaniem ścianek, a nie obrotem bryły.
//
// NAJWAŻNIEJSZE zostaje bez zmian: animacja niczego nie losuje. Wynik przychodzi
// z serwera (zasada 1 i 3), a kostka tylko go pokazuje. Gdyby losowała u siebie,
// wystarczyłby DevTools, żeby zawsze wyrzucać szóstkę.

/** Układ oczek na ściance, w siatce 3x3. */
const OCZKA: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

/** Ile trwa potrząsanie, zanim kostka pokaże wynik. */
const TURLANIE_MS = 700;
/**
 * Twardy sufit potrząsania.
 *
 * Poprzednia poprawka gasiła animację w efekcie od `wartosc` - ale ten efekt URUCHAMIA SIĘ
 * TYLKO WTEDY, GDY WARTOŚĆ SIĘ ZMIENI. A ona potrafi się nie zmienić: rzut bez legalnego
 * ruchu ZOSTAWIA wynik na kostce i oddaje turę, więc kolejny gracz, który wyrzuci tę samą
 * liczbę, dostaje `wartosc` identyczną jak przed kliknięciem. Efekt nie startował, nic nie
 * gasiło potrząsania i kostka kręciła się aż do wygaśnięcia tury.
 *
 * Dlatego animacja ma teraz własny termin, niezależny od tego, czy cokolwiek się zmieniło.
 */
const SUFIT_TURLANIA_MS = 1500;
const ODBICIE_MS = 220;
/** Jak szybko przeskakują ścianki w trakcie potrząsania. */
const PRZESKOK_MS = 70;

function bezRuchu(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}

/** Grzechot: kilka klików coraz rzadziej, na końcu niższy - jak kostka gasnąca na stole. */
function grzechot(): number[] {
  const id = [0, 90, 200, 330, 480].map((ms) => window.setTimeout(() => sfx.tick(), ms));
  id.push(window.setTimeout(() => sfx.stop(), 620));
  return id;
}

export function Kostka({
  wartosc,
  kolor,
  kreci = false,
  bok = 64,
}: {
  wartosc: number | null;
  kolor: string;
  /** Rzut jest w drodze do serwera - potrząsaj, dopóki nie wróci wynik. */
  kreci?: boolean;
  /** Bok kostki w px. Ekran TV podaje większy. */
  bok?: number;
}) {
  const t = useT();
  const [pokazywana, setPokazywana] = useState(wartosc ?? 1);
  const [turla, setTurla] = useState(false);
  const [odbicie, setOdbicie] = useState(false);
  const poprzednia = useRef<number | null>(null);
  /** Pierwsze wejście komponentu. Wynik zastany po odświeżeniu strony ma się NIE turlać. */
  const pierwszy = useRef(true);

  // Klik już poleciał na serwer, wynik jeszcze nie wrócił — potrząsamy od razu,
  // żeby gracz widział reakcję, zanim przyjdzie odpowiedź.
  useEffect(() => {
    if (bezRuchu()) return;
    if (kreci) setTurla(true);
  }, [kreci]);

  // Bezpiecznik: potrząsanie ZAWSZE ma koniec, choćby wynik nigdy nie przyszedł albo
  // przyszedł identyczny jak poprzedni. Termin liczy się od zapalenia animacji i odnawia
  // przy zmianie wartości, więc normalny rzut i tak gasi się wcześniej, po TURLANIE_MS.
  useEffect(() => {
    if (!turla) return;
    const id = window.setTimeout(() => {
      setTurla(false);
      if (wartosc != null) setPokazywana(wartosc);
    }, SUFIT_TURLANIA_MS);
    return () => clearTimeout(id);
  }, [turla, wartosc]);

  useEffect(() => {
    const zastane = pierwszy.current;
    pierwszy.current = false;
    const poprz = poprzednia.current;
    poprzednia.current = wartosc;

    // Kostka zgaszona albo ta sama liczba co poprzednio: nie ma czego turlać. Ale
    // TRZEBA zgasić potrząsanie — wcześniej ta ścieżka tylko wychodziła, więc kostka
    // trzęsła się w nieskończoność po każdym ruchu pionkiem.
    if (wartosc == null || wartosc === poprz) {
      setTurla(false);
      if (wartosc != null) setPokazywana(wartosc);
      return;
    }

    // Wejście do trwającej partii to nie jest rzut. Turlanie i grzechot przy każdym
    // odświeżeniu strony udawałyby zdarzenie, którego nie było.
    if (zastane || bezRuchu()) {
      setTurla(false);
      setPokazywana(wartosc);
      return;
    }

    setTurla(true);
    const dzwieki = grzechot();
    const stop = window.setTimeout(() => {
      setTurla(false);
      setPokazywana(wartosc);
      setOdbicie(true);
    }, TURLANIE_MS);
    const koniec = window.setTimeout(() => setOdbicie(false), TURLANIE_MS + ODBICIE_MS);
    return () => [...dzwieki, stop, koniec].forEach(clearTimeout);
  }, [wartosc]);

  // Przeskakiwanie ścianek w trakcie potrząsania. Kolejność jest cykliczna, nie losowa:
  // to tylko ozdoba, a losowanie czegokolwiek po stronie kostki prosi się o nieporozumienie.
  useEffect(() => {
    if (!turla) return;
    const id = setInterval(() => setPokazywana((n) => (n % 6) + 1), PRZESKOK_MS);
    return () => clearInterval(id);
  }, [turla]);

  const oczko = Math.max(6, Math.round(bok * 0.16));

  return (
    <div
      role="img"
      aria-label={wartosc ? t("chinczyk.diceValue", { n: wartosc }) : t("chinczyk.dice")}
      className="grid rounded-[22%] border-[3px] border-[#2A1758] bg-sheet"
      style={{
        width: bok,
        height: bok,
        gridTemplate: "repeat(3, 1fr) / repeat(3, 1fr)",
        padding: bok * 0.13,
        boxSizing: "border-box",
        // Obwódka w barwie tury mówi, czyj to rzut, bez malowania samej kostki na kolor.
        boxShadow: `0 0 0 3px ${kolor}, 0 4px 0 rgb(0 0 0 / 0.35)`,
        // Potrząsanie bierze się z tego samego licznika co przeskok ścianek: co zmianę
        // oczek kostka przechyla się w drugą stronę. Bez własnych `@keyframes`, których
        // i tak nie ma gdzie postawić — `globals.css` nie zna poszczególnych gier.
        transform: odbicie
          ? "scale(1.14)"
          : turla
            ? `rotate(${pokazywana % 2 ? -7 : 7}deg)`
            : "rotate(0deg)",
        transition: turla
          ? `transform ${PRZESKOK_MS}ms ease-in-out`
          : `transform ${ODBICIE_MS}ms cubic-bezier(0.34, 1.6, 0.5, 1)`,
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="self-center justify-self-center rounded-full"
          style={{
            width: oczko,
            height: oczko,
            background: OCZKA[pokazywana]?.includes(i) ? "#2A1758" : "transparent",
          }}
        />
      ))}
    </div>
  );
}
