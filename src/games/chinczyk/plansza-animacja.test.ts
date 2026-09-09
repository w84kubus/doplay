import { describe, expect, it } from "vitest";
import { klatkiPrzejazdu } from "./przejazd";
import { META, PIONKOW, W_BAZIE } from "./engine";

// Silnik przysyła wyłącznie stan końcowy, więc drogę pionka odtwarza plansza.
// Te testy pilnują samego planu przejazdu — bez Reacta, bez DOM-u.

/** Płaska tablica 16 pozycji z podanymi czwórkami. */
function plansza(pary: Record<number, number[]>): number[] {
  const p = Array<number>(4 * PIONKOW).fill(W_BAZIE);
  for (const [kolor, czworka] of Object.entries(pary)) {
    czworka.forEach((v, i) => (p[Number(kolor) * PIONKOW + i] = v));
  }
  return p;
}

describe("chińczyk — przejazd pionka po polach", () => {
  it("rozbija ruch o trzy pola na trzy klatki", () => {
    const stare = plansza({ 0: [10, W_BAZIE, W_BAZIE, W_BAZIE] });
    const nowe = plansza({ 0: [13, W_BAZIE, W_BAZIE, W_BAZIE] });
    const klatki = klatkiPrzejazdu(stare, nowe);
    expect(klatki.map((k) => k[0])).toEqual([11, 12, 13]);
  });

  it("wyjście z bazy to jeden skok, nie skok przez całą trasę", () => {
    const stare = plansza({ 0: [W_BAZIE, W_BAZIE, W_BAZIE, W_BAZIE] });
    const nowe = plansza({ 0: [0, W_BAZIE, W_BAZIE, W_BAZIE] });
    expect(klatkiPrzejazdu(stare, nowe).map((k) => k[0])).toEqual([0]);
  });

  it("zbicie dzieje się dopiero w ostatniej klatce", () => {
    // Czerwony idzie o 2 pola i po dojściu zbija żółtego, który wraca do bazy.
    const stare = plansza({ 0: [10, W_BAZIE, W_BAZIE, W_BAZIE], 2: [5, W_BAZIE, W_BAZIE, W_BAZIE] });
    const nowe = plansza({ 0: [12, W_BAZIE, W_BAZIE, W_BAZIE], 2: [W_BAZIE, W_BAZIE, W_BAZIE, W_BAZIE] });
    const klatki = klatkiPrzejazdu(stare, nowe);
    const zolty = (k: number[]) => k[2 * PIONKOW];

    expect(klatki).toHaveLength(2);
    // W drodze zbity stoi jeszcze na swoim polu — inaczej znikałby, zanim coś go dotknie.
    expect(zolty(klatki[0])).toBe(5);
    expect(zolty(klatki[1])).toBe(W_BAZIE);
  });

  it("wjazd na metę też idzie polami korytarza", () => {
    const stare = plansza({ 0: [META - 3, W_BAZIE, W_BAZIE, W_BAZIE] });
    const nowe = plansza({ 0: [META, W_BAZIE, W_BAZIE, W_BAZIE] });
    expect(klatkiPrzejazdu(stare, nowe).map((k) => k[0])).toEqual([META - 2, META - 1, META]);
  });

  it("bez zmian nie ma czego animować", () => {
    const stan = plansza({ 0: [10, W_BAZIE, W_BAZIE, W_BAZIE] });
    expect(klatkiPrzejazdu(stan, stan)).toEqual([]);
  });

  it("przy niejednoznacznej zmianie odpuszcza zamiast zgadywać", () => {
    // Nowa partia albo reset: do przodu poszło kilka pionków naraz i nie da się
    // powiedzieć, który „szedł". Lepiej pokazać stan wprost niż wymyślić trasę.
    const stare = plansza({ 0: [0, 0, W_BAZIE, W_BAZIE] });
    const nowe = plansza({ 0: [5, 7, W_BAZIE, W_BAZIE] });
    expect(klatkiPrzejazdu(stare, nowe)).toEqual([]);
  });
});
