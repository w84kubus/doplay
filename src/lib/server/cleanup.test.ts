import { describe, expect, it } from "vitest";
import {
  cronAutoryzowany,
  KARENCJA_AKTYWNOSCI_MS,
  LIMIT_PARTII,
  ostatniaAktywnosc,
  wybierzDoUsuniecia,
  wybierzSieroty,
  LIMIT_SIEROT,
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

describe("sprzątanie — zamiatarka sierot", () => {
  const ODCZYT = 1_000_000;
  const zyje = new Set(["ZYWY"]);
  const dok = (sciezka: string, kodPokoju: string, zapisanyMs: number) => ({
    sciezka,
    kodPokoju,
    zapisanyMs,
  });

  it("nie rusza dokumentu istniejącego pokoju", () => {
    const d = dok("rooms/ZYWY/secret/state", "ZYWY", ODCZYT - 5000);
    expect(wybierzSieroty([d], zyje, ODCZYT)).toEqual([]);
  });

  it("zamiata dokument po skasowanym pokoju", () => {
    const d = dok("rooms/TRUP/secret/state", "TRUP", ODCZYT - 5000);
    expect(wybierzSieroty([d], zyje, ODCZYT)).toEqual(["rooms/TRUP/secret/state"]);
  });

  it("NIE rusza dokumentu zapisanego po zdjęciu listy pokoi", () => {
    // Wyścig: pokój powstał już po naszym odczycie listy, więc nie ma go na liście,
    // choć żyje. Skasowanie zabrałoby role z trwającej gry.
    const nowy = dok("rooms/NOWY/private/u1", "NOWY", ODCZYT + 2000);
    expect(wybierzSieroty([nowy], zyje, ODCZYT)).toEqual([]);
  });

  it("granica: dokument zapisany dokładnie w chwili odczytu zostaje", () => {
    const d = dok("rooms/GRAN/private/u1", "GRAN", ODCZYT);
    expect(wybierzSieroty([d], zyje, ODCZYT)).toEqual([]);
  });

  it("tnie do limitu", () => {
    const duzo = Array.from({ length: LIMIT_SIEROT + 10 }, (_, i) =>
      dok(`rooms/T${i}/private/u`, `T${i}`, ODCZYT - 1),
    );
    expect(wybierzSieroty(duzo, zyje, ODCZYT)).toHaveLength(LIMIT_SIEROT);
  });

  it("pusta baza nie wywołuje kasowania", () => {
    expect(wybierzSieroty([], zyje, ODCZYT)).toEqual([]);
  });
});
