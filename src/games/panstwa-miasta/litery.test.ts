import { describe, expect, it } from "vitest";
import { pmEngine, type PmState } from "./engine";
import { pmSettingsSchema, type PmSettings } from "./manifest";
import { BASE_LETTERS, HARDCORE_LETTERS } from "./data/categories";
import { mulberry32 } from "@/games/rng";
import type { Player, PlayerMap } from "@/lib/types/room";

// Losowanie liter i brudnopis odpowiedzi. Oba zgłoszone razem („mało liter, te same
// się powtarzają" + „zostają hasła z poprzedniej rundy") i oba wynikają z tego samego:
// nowa partia w tym samym pokoju zaczyna od zera, a to, co zostało po poprzedniej,
// wraca albo jako powtórzona litera, albo jako wpisany wcześniej tekst.

const gracz = (uid: string, isHost = false): Player => ({
  uid, nick: uid, avatar: "cat", joinedAt: 0, isHost, connected: true, lastSeenAt: 0, totalScore: 0,
});

/** Rozgrywa partię terminami faz i zwraca litery kolejnych rund. */
function literyPartii(ile: number, over: Partial<PmSettings> = {}, seed = 12345): string[] {
  const players: PlayerMap = { a: gracz("a", true), b: gracz("b") };
  let wersja = 0;
  const rng = () => mulberry32((seed + wersja++) >>> 0);
  let s: PmState = pmEngine.init({
    players,
    seatOrder: ["a", "b"],
    settings: pmSettingsSchema.parse({ rounds: 0, endMode: "czas", ...over }),
    now: 1000,
    rng: rng(),
    seed,
  });

  const litery = [s.letter];
  let czas = 2000;
  for (let krok = 0; krok < 900 && litery.length < ile; krok++) {
    const przed = s.round;
    wersja += 2;
    czas += 1000;
    // Weryfikacja i wyniki czekają na hosta, reszta faz schodzi terminem.
    const akcja =
      s.phase === "wyniki" || s.phase === "weryfikacja"
        ? ({ type: "NEXT" } as const)
        : ({ type: "PHASE_TIMEOUT" } as const);
    s = pmEngine.reduce(s, akcja, { uid: "a", now: czas, rng: rng() });
    if (s.round > przed) litery.push(s.letter);
  }
  return litery;
}

describe("państwa-miasta — pula liter", () => {
  it("Ł jest w puli podstawowej, nie w hardcore", () => {
    // Od Ł zaczyna się mnóstwo zwykłych słów (Łódź, łoś, łyżka), więc trzymanie go
    // razem z ogonkami niepotrzebnie zwężało pulę o jedną z sensowniejszych liter.
    expect(BASE_LETTERS).toContain("Ł");
    expect(HARDCORE_LETTERS).not.toContain("Ł");
  });

  it("pula podstawowa nie zawiera liter, od których nic się nie zaczyna", () => {
    for (const martwa of ["Q", "V", "X", "Y"]) expect(BASE_LETTERS).not.toContain(martwa);
  });

  it("żadna litera nie powtarza się w obrębie jednej partii", () => {
    const litery = literyPartii(BASE_LETTERS.length);
    expect(litery).toHaveLength(BASE_LETTERS.length);
    expect(new Set(litery).size).toBe(litery.length);
  });

  it("po wyczerpaniu puli losowanie rusza od nowa, zamiast stanąć", () => {
    const litery = literyPartii(BASE_LETTERS.length + 4);
    expect(litery).toHaveLength(BASE_LETTERS.length + 4);
    expect(litery.every((l) => BASE_LETTERS.includes(l))).toBe(true);
  });

  it("hardcore poszerza pulę o ogonki", () => {
    const litery = literyPartii(BASE_LETTERS.length + HARDCORE_LETTERS.length, { hardcore: true });
    expect(new Set(litery).size).toBe(litery.length);
    expect(litery.some((l) => HARDCORE_LETTERS.includes(l))).toBe(true);
  });
});

describe("państwa-miasta — pamięć liter między partiami", () => {
  const players: PlayerMap = { a: gracz("a", true), b: gracz("b") };
  const partia = (pamiec?: unknown, now = 1000) =>
    pmEngine.init({
      players, seatOrder: ["a", "b"], settings: pmSettingsSchema.parse({}),
      now, rng: mulberry32(7), seed: 7, pamiec,
    });

  it("bez pamięci partia zaczyna z pełną pulą", () => {
    // `init` od razu rozgrywa pierwszą rundę, więc na liście zużytych jest już
    // wylosowana litera - i tylko ona.
    expect(partia().usedLetters).toHaveLength(1);
  });

  it("nowa partia nie powtarza liter z poprzedniej", () => {
    const pierwsza = partia();
    const zuzyte = ["A", "B", "C", "D", "E"];
    const druga = partia(pmEngine.pamiec!({ ...pierwsza, usedLetters: zuzyte }));
    // Zapamiętane zostają, a na koniec dochodzi litera wylosowana w tej partii.
    expect(druga.usedLetters.slice(0, zuzyte.length)).toEqual(zuzyte);
    expect(druga.usedLetters).toHaveLength(zuzyte.length + 1);
    // Litera tej partii musi wypaść POZA tym, co już było.
    expect(zuzyte).not.toContain(druga.letter);
  });

  it("pamięć z bazy o nieoczekiwanym kształcie nie wywraca partii", () => {
    // Wartość wraca z Firestore, więc może być czymkolwiek - stara wersja dokumentu,
    // ręczna edycja w konsoli, cokolwiek. Ma wtedy znaczyć „brak pamięci", nie wyjątek.
    for (const smiec of [null, undefined, 42, "ABC", {}, { usedLetters: "ABC" }, { usedLetters: [1, 2] }]) {
      // Zostaje sama litera tej partii - czyli dokładnie tyle, co przy braku pamięci.
      expect(partia(smiec).usedLetters).toHaveLength(1);
    }
  });

  it("gdy poprzednie partie zużyły całą pulę, losowanie rusza od nowa", () => {
    const wszystkie = [...BASE_LETTERS];
    const s = partia({ usedLetters: wszystkie });
    // `pickLetter` resetuje pulę, gdy nie ma z czego wybierać - inaczej nie byłoby litery.
    expect(BASE_LETTERS).toContain(s.letter);
  });

  it("pamięć jest mała i niesie tylko litery", () => {
    const s = partia();
    // `pamiec` z kontraktu zwraca `unknown` - rdzeń świadomie nie zna kształtu.
    expect(Object.keys(pmEngine.pamiec!(s) as Record<string, unknown>)).toEqual(["usedLetters"]);
  });
});

describe("państwa-miasta — znacznik partii", () => {
  it("każda partia dostaje własny startedAt i widać go w publicView", () => {
    const players: PlayerMap = { a: gracz("a", true), b: gracz("b") };
    const zrob = (now: number) =>
      pmEngine.init({
        players, seatOrder: ["a", "b"], settings: pmSettingsSchema.parse({}), now, rng: mulberry32(1), seed: 1,
      });

    const pierwsza = zrob(1000);
    const druga = zrob(999000);
    expect(pierwsza.startedAt).toBe(1000);
    expect(druga.startedAt).toBe(999000);
    // Na tym stoi klucz brudnopisu w przeglądarce: numer rundy startuje od 1 w każdej
    // partii, więc bez tego pola druga gra w tym samym pokoju wczytywała do pól
    // odpowiedzi wpisane w pierwszej.
    expect((pmEngine.publicView(druga, players) as { startedAt: number }).startedAt).toBe(999000);
  });
});
