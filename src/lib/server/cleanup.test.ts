import { describe, expect, it } from "vitest";
import {
  cronAutoryzowany,
  KARENCJA_AKTYWNOSCI_MS,
  LIMIT_PARTII,
  ostatniaAktywnosc,
  wybierzDoUsuniecia,
  type Kandydat,
} from "./cleanup";
import { newPlayer } from "./rooms";

const TERAZ = 1_700_000_000_000;
const GODZINA = 60 * 60 * 1000;

function pokoj(code: string, wygaslPrzed: number, cichyOd: number): Kandydat {
  const gracz = newPlayer("a", "Ala", "cat", TERAZ - 9 * GODZINA, true);
  return {
    code,
    expiresAt: TERAZ - wygaslPrzed,
    players: { a: { ...gracz, lastSeenAt: TERAZ - cichyOd } },
  };
}

describe("sprzątanie — ostatnia aktywność", () => {
  it("bierze najświeższy ping z całego stołu", () => {
    const p = pokoj("AAAA", GODZINA, 5 * GODZINA);
    p.players.b = { ...newPlayer("b", "Bob", "dog", TERAZ, false), lastSeenAt: TERAZ - 60_000 };
    expect(ostatniaAktywnosc(p)).toBe(TERAZ - 60_000);
  });

  it("pusty pokój liczy się jako dawno nieaktywny", () => {
    expect(ostatniaAktywnosc({ code: "BBBB", expiresAt: 0, players: {} })).toBe(0);
  });
});

describe("sprzątanie — wybór pokoi", () => {
  it("nie rusza pokoju, któremu termin jeszcze nie minął", () => {
    const zywy: Kandydat = { ...pokoj("LIVE", 0, 10 * GODZINA), expiresAt: TERAZ + GODZINA };
    expect(wybierzDoUsuniecia([zywy], TERAZ)).toEqual([]);
  });

  it("kasuje pokój wygasły i cichy", () => {
    expect(wybierzDoUsuniecia([pokoj("DEAD", GODZINA, 10 * GODZINA)], TERAZ)).toEqual(["DEAD"]);
  });

  it("NIE kasuje wygasłego pokoju, w którym ktoś nadal pinguje", () => {
    // Partia dłuższa niż TTL: termin minął, ale przy stole ktoś siedzi.
    // Skasowanie takiego pokoju wywaliłoby ludzi z trwającej gry.
    expect(wybierzDoUsuniecia([pokoj("GRA", GODZINA, 30_000)], TERAZ)).toEqual([]);
  });

  it("granica karencji: sekunda za wcześnie zostawia pokój w spokoju", () => {
    const tuzPrzed = pokoj("TUZ", GODZINA, KARENCJA_AKTYWNOSCI_MS - 1000);
    const rowno = pokoj("ROWN", GODZINA, KARENCJA_AKTYWNOSCI_MS);
    expect(wybierzDoUsuniecia([tuzPrzed, rowno], TERAZ)).toEqual(["ROWN"]);
  });

  it("tnie partię do limitu, reszta poczeka do następnego przebiegu", () => {
    const duzo = Array.from({ length: LIMIT_PARTII + 25 }, (_, i) =>
      pokoj(`P${i}`, GODZINA, 10 * GODZINA),
    );
    expect(wybierzDoUsuniecia(duzo, TERAZ)).toHaveLength(LIMIT_PARTII);
  });
});

describe("sprzątanie — bramka crona", () => {
  const SEKRET = "s3kret-crona";

  it("przepuszcza poprawny nagłówek", () => {
    expect(cronAutoryzowany(`Bearer ${SEKRET}`, SEKRET)).toBe(true);
  });

  it("brak sekretu w środowisku ZAMYKA trasę, nie otwiera jej", () => {
    expect(cronAutoryzowany(`Bearer ${SEKRET}`, undefined)).toBe(false);
    expect(cronAutoryzowany(null, undefined)).toBe(false);
    expect(cronAutoryzowany("Bearer ", "")).toBe(false);
  });

  it("odrzuca zły sekret, brak nagłówka i inny schemat", () => {
    expect(cronAutoryzowany(`Bearer ${SEKRET}x`, SEKRET)).toBe(false);
    expect(cronAutoryzowany("Bearer nie-ten", SEKRET)).toBe(false);
    expect(cronAutoryzowany(null, SEKRET)).toBe(false);
    expect(cronAutoryzowany(`Basic ${SEKRET}`, SEKRET)).toBe(false);
  });

  it("nie wywraca się na sekrecie innej długości", () => {
    // timingSafeEqual rzuca przy różnych długościach buforów
    expect(() => cronAutoryzowany("Bearer krotki", SEKRET)).not.toThrow();
    expect(cronAutoryzowany("Bearer krotki", SEKRET)).toBe(false);
  });
});
