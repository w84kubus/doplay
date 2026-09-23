import { describe, expect, it } from "vitest";
import {
  flotaZachlanna,
  FLOTY,
  losujFlote,
  obwodka,
  polaFloty,
  polaStatku,
  polaZatopionych,
  poprawnaFlota,
  zatopiony,
  type Statek,
} from "./plansza";
import { mulberry32 } from "@/games/rng";

const BOK = 8;
const suma = (t: readonly number[]) => t.reduce((a, b) => a + b, 0);

describe("statki — geometria statku", () => {
  it("statek poziomy zajmuje kolejne pola w wierszu", () => {
    expect(polaStatku({ dlugosc: 3, pole: 9, poziomo: true }, BOK)).toEqual([9, 10, 11]);
  });

  it("statek pionowy zajmuje kolejne pola w kolumnie", () => {
    expect(polaStatku({ dlugosc: 3, pole: 9, poziomo: false }, BOK)).toEqual([9, 17, 25]);
  });

  it("statek wystający za prawą krawędź nie istnieje, a nie zawija się do następnego wiersza", () => {
    // Pole to jedna liczba, więc „kolumna + 1" na krawędzi milcząco przeskoczyłoby
    // do początku następnego wiersza. Statek stałby wtedy w dwóch kawałkach.
    expect(polaStatku({ dlugosc: 3, pole: 6, poziomo: true }, BOK)).toBeNull();
    expect(polaStatku({ dlugosc: 2, pole: 7, poziomo: true }, BOK)).toBeNull();
  });

  it("statek wystający za dolną krawędź nie istnieje", () => {
    expect(polaStatku({ dlugosc: 3, pole: 56, poziomo: false }, BOK)).toBeNull();
  });
});

describe("statki — obwódka", () => {
  it("obejmuje także rogi", () => {
    // Pole 9 to wiersz 1, kolumna 1 — pełne otoczenie ośmiu pól.
    expect(obwodka([9], BOK)).toEqual([0, 1, 2, 8, 10, 16, 17, 18]);
  });

  it("nie wychodzi poza planszę", () => {
    expect(obwodka([0], BOK)).toEqual([1, 8, 9]);
  });

  it("nie zawiera pól samego statku", () => {
    const pola = polaStatku({ dlugosc: 3, pole: 9, poziomo: true }, BOK)!;
    const wokol = obwodka(pola, BOK);
    for (const p of pola) expect(wokol).not.toContain(p);
  });
});

describe("statki — poprawność floty", () => {
  const statek = (dlugosc: number, pole: number, poziomo = true): Statek => ({ dlugosc, pole, poziomo });

  it("dwa statki na tym samym polu to błąd", () => {
    expect(poprawnaFlota([statek(2, 9), statek(2, 9)], BOK)).toBe(false);
  });

  it("statki stykające się BOKIEM to błąd", () => {
    expect(poprawnaFlota([statek(2, 9), statek(2, 17)], BOK)).toBe(false);
  });

  it("statki stykające się ROGIEM to też błąd", () => {
    // Reguła z podwórka, na której stoi odsłanianie wody po zatopieniu.
    expect(poprawnaFlota([statek(2, 9), statek(2, 19)], BOK)).toBe(false);
  });

  it("statki z jednym polem przerwy są w porządku", () => {
    expect(poprawnaFlota([statek(2, 9), statek(2, 25)], BOK)).toBe(true);
    expect(poprawnaFlota([statek(2, 9), statek(2, 12)], BOK)).toBe(true);
  });

  it("statek poza planszą to błąd", () => {
    expect(poprawnaFlota([statek(3, 6)], BOK)).toBe(false);
  });
});

describe("statki — losowanie floty", () => {
  it("dla obu rozmiarów planszy losuje poprawną, kompletną flotę", () => {
    for (const bok of [8, 10]) {
      for (let seed = 1; seed <= 200; seed++) {
        const flota = losujFlote(FLOTY[bok], bok, mulberry32(seed));
        expect(flota, `bok ${bok}, seed ${seed}: brak floty`).not.toBeNull();
        expect(poprawnaFlota(flota!, bok)).toBe(true);
        expect(polaFloty(flota!, bok)).toHaveLength(suma(FLOTY[bok]));
        expect(flota!.map((s) => s.dlugosc).sort()).toEqual([...FLOTY[bok]].sort());
      }
    }
  });

  it("to samo ziarno daje tę samą flotę", () => {
    // Zasada 3: losowość wchodzi przez ctx.rng, więc partia musi być odtwarzalna.
    expect(losujFlote(FLOTY[8], 8, mulberry32(42))).toEqual(losujFlote(FLOTY[8], 8, mulberry32(42)));
  });

  it("różne ziarna dają różne floty", () => {
    const rozne = new Set(
      Array.from({ length: 20 }, (_, i) => JSON.stringify(losujFlote(FLOTY[8], 8, mulberry32(i + 1)))),
    );
    expect(rozne.size).toBeGreaterThan(15);
  });

  it("ustawienie zachłanne jest awaryjne, ale zawsze się udaje", () => {
    for (const bok of [8, 10]) {
      const flota = flotaZachlanna(FLOTY[bok], bok);
      expect(flota, `bok ${bok}`).not.toBeNull();
      expect(poprawnaFlota(flota!, bok)).toBe(true);
      expect(polaFloty(flota!, bok)).toHaveLength(suma(FLOTY[bok]));
    }
  });
});

describe("statki — zatapianie", () => {
  const trojmasztowiec: Statek = { dlugosc: 3, pole: 9, poziomo: true };

  it("statek tonie dopiero po trafieniu we WSZYSTKIE pola", () => {
    expect(zatopiony(trojmasztowiec, BOK, new Set([9, 10]))).toBe(false);
    expect(zatopiony(trojmasztowiec, BOK, new Set([9, 10, 11]))).toBe(true);
  });

  it("trafienia obok statku go nie zatapiają", () => {
    expect(zatopiony(trojmasztowiec, BOK, new Set([8, 12, 1, 2, 3]))).toBe(false);
  });

  it("polaZatopionych zwraca tylko statki, które faktycznie poszły na dno", () => {
    const flota: Statek[] = [trojmasztowiec, { dlugosc: 2, pole: 30, poziomo: false }];
    expect(polaZatopionych(flota, BOK, new Set([9, 10, 11, 30]))).toEqual([9, 10, 11]);
  });
});
