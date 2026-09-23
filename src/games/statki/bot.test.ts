import { describe, expect, it } from "vitest";
import { sasiad, wybierzStrzal } from "./bot";
import { idxPola, kolumnaPola, wierszPola } from "./plansza";
import { mulberry32 } from "@/games/rng";

const BOK = 8;
const rng = mulberry32(7);
const parzyste = (pole: number) => (wierszPola(pole, BOK) + kolumnaPola(pole, BOK)) % 2 === 0;

describe("statki — bot szuka floty", () => {
  it("pierwszy strzał pada na szachownicę", () => {
    // Każdy statek dłuższy niż jedno pole leży na co najmniej jednym polu o parzystej
    // sumie współrzędnych, więc połowa planszy wystarczy, żeby go znaleźć.
    for (let seed = 1; seed <= 40; seed++) {
      const pole = wybierzStrzal(BOK, [], [], [], mulberry32(seed));
      expect(pole).not.toBeNull();
      expect(parzyste(pole!), `seed ${seed}: strzał w ${pole} poza szachownicą`).toBe(true);
    }
  });

  it("nigdy nie strzela dwa razy w to samo pole", () => {
    const oddane: number[] = [];
    for (let i = 0; i < BOK * BOK; i++) {
      const pole = wybierzStrzal(BOK, oddane, [], [], mulberry32(i + 1));
      expect(pole, `po ${i} strzałach zabrakło pól`).not.toBeNull();
      expect(oddane, `powtórzony strzał w ${pole}`).not.toContain(pole);
      oddane.push(pole!);
    }
    expect(oddane).toHaveLength(BOK * BOK);
  });

  it("gdy plansza jest wystrzelana, oddaje null zamiast zgadywać", () => {
    const wszystkie = Array.from({ length: BOK * BOK }, (_, i) => i);
    expect(wybierzStrzal(BOK, wszystkie, [], [], rng)).toBeNull();
  });

  it("po wyczerpaniu szachownicy dobiera z pozostałych pól", () => {
    // Na dużej planszy zostają jednomasztowce, które mogą stać poza szachownicą.
    const szachownica = Array.from({ length: BOK * BOK }, (_, i) => i).filter(parzyste);
    const pole = wybierzStrzal(BOK, szachownica, [], [], rng);
    expect(pole).not.toBeNull();
    expect(parzyste(pole!)).toBe(false);
  });
});

describe("statki — bot dobija trafiony statek", () => {
  it("po pojedynczym trafieniu strzela w sąsiada, nie gdziekolwiek", () => {
    const trafione = idxPola(3, 3, BOK);
    const sasiedzi = [
      idxPola(2, 3, BOK), idxPola(4, 3, BOK), idxPola(3, 2, BOK), idxPola(3, 4, BOK),
    ];
    for (let seed = 1; seed <= 30; seed++) {
      const pole = wybierzStrzal(BOK, [trafione], [trafione], [], mulberry32(seed));
      expect(sasiedzi, `seed ${seed}: strzał w ${pole} zamiast w sąsiada`).toContain(pole);
    }
  });

  it("dwa trafienia w linii wyznaczają kierunek — strzela na KONIEC linii", () => {
    // To jest cała różnica między botem a strzelaniem na oślep: mając dwa pola statku
    // w poziomie, nie ma sensu sprawdzać pól nad i pod nimi.
    const a = idxPola(3, 3, BOK);
    const b = idxPola(3, 4, BOK);
    const konce = [idxPola(3, 2, BOK), idxPola(3, 5, BOK)];
    for (let seed = 1; seed <= 30; seed++) {
      const pole = wybierzStrzal(BOK, [a, b], [a, b], [], mulberry32(seed));
      expect(konce, `seed ${seed}: strzał w ${pole} zamiast na koniec linii`).toContain(pole);
    }
  });

  it("linia pionowa działa tak samo", () => {
    const a = idxPola(3, 3, BOK);
    const b = idxPola(4, 3, BOK);
    const konce = [idxPola(2, 3, BOK), idxPola(5, 3, BOK)];
    expect(konce).toContain(wybierzStrzal(BOK, [a, b], [a, b], [], rng));
  });

  it("zamknięty koniec linii nie jest brany pod uwagę", () => {
    // Statek dotyka lewej krawędzi, więc jedyne sensowne pole jest z prawej.
    const a = idxPola(3, 0, BOK);
    const b = idxPola(3, 1, BOK);
    expect(wybierzStrzal(BOK, [a, b], [a, b], [], rng)).toBe(idxPola(3, 2, BOK));
  });

  it("trafienia w ZATOPIONY statek nie ciągną już bota w tamtą stronę", () => {
    // Wokół zatopionego silnik odsłonił wodę — szukanie tam to stracona tura.
    const zatopione = [idxPola(0, 0, BOK), idxPola(0, 1, BOK)];
    const wokol = [idxPola(0, 2, BOK), idxPola(1, 0, BOK), idxPola(1, 1, BOK), idxPola(1, 2, BOK)];
    const oddane = [...zatopione, ...wokol];
    for (let seed = 1; seed <= 20; seed++) {
      const pole = wybierzStrzal(BOK, oddane, zatopione, zatopione, mulberry32(seed));
      expect(pole).not.toBeNull();
      expect(parzyste(pole!), `seed ${seed}: bot wrócił do zatopionego zamiast szukać dalej`).toBe(true);
    }
  });

  it("sąsiad liczony jest po współrzędnych, a nie po indeksie", () => {
    // Pole na prawej krawędzi nie ma sąsiada „o jeden w prawo" — dodawanie 1 do indeksu
    // przeskoczyłoby do początku następnego wiersza i bot strzelałby po drugiej stronie.
    expect(sasiad(idxPola(3, 7, BOK), BOK, 0, 1)).toBeNull();
    expect(sasiad(idxPola(3, 0, BOK), BOK, 0, -1)).toBeNull();
    expect(sasiad(idxPola(0, 3, BOK), BOK, -1, 0)).toBeNull();
    expect(sasiad(idxPola(7, 3, BOK), BOK, 1, 0)).toBeNull();
    expect(sasiad(idxPola(3, 3, BOK), BOK, 0, 1)).toBe(idxPola(3, 4, BOK));
  });
});

describe("statki — bot jest wyraźnie lepszy od strzelania na oślep", () => {
  it("topi całą flotę w mniejszej liczbie strzałów niż losowy gracz", () => {
    // Liczby biorą się z symulacji, nie z założenia. Bot ma wygrywać wyścig na strzały,
    // bo inaczej gra z nim nie różni się od gry z generatorem liczb losowych.
    const flota = [
      { dlugosc: 4, pole: idxPola(0, 0, BOK), poziomo: true },
      { dlugosc: 3, pole: idxPola(2, 5, BOK), poziomo: false },
      { dlugosc: 3, pole: idxPola(7, 2, BOK), poziomo: true },
      { dlugosc: 2, pole: idxPola(4, 0, BOK), poziomo: false },
      { dlugosc: 2, pole: idxPola(5, 3, BOK), poziomo: true },
    ];
    const polaFloty = new Set(
      flota.flatMap((s) =>
        Array.from({ length: s.dlugosc }, (_, i) =>
          s.poziomo ? s.pole + i : s.pole + i * BOK,
        ),
      ),
    );

    /** Ile strzałów zajmie zatopienie całej floty. `inteligentny` = mózg bota. */
    function partia(seed: number, inteligentny: boolean): number {
      const rngLok = mulberry32(seed);
      const oddane: number[] = [];
      const trafienia: number[] = [];
      while (trafienia.length < polaFloty.size) {
        const wolne = Array.from({ length: BOK * BOK }, (_, i) => i).filter((p) => !oddane.includes(p));
        const pole = inteligentny
          ? wybierzStrzal(BOK, oddane, trafienia, [], rngLok)
          : wolne[Math.floor(rngLok() * wolne.length)];
        if (pole === null || pole === undefined) break;
        oddane.push(pole);
        if (polaFloty.has(pole)) trafienia.push(pole);
      }
      return oddane.length;
    }

    const srednia = (inteligentny: boolean) =>
      Array.from({ length: 30 }, (_, i) => partia(i + 1, inteligentny)).reduce((a, b) => a + b, 0) / 30;

    const bot = srednia(true);
    const losowy = srednia(false);
    expect(bot, `bot ${bot.toFixed(1)} strzałów, losowy ${losowy.toFixed(1)}`).toBeLessThan(losowy * 0.8);
  });
});
