import { describe, expect, it } from "vitest";
import { CISZA_PORZUCENIA_MS, LIMIT_LISTY, wybierzPubliczne, type Kandydat } from "./publiczne";
import { newPlayer } from "./rooms";
import { MAX_W_POKOJU } from "@/games/manifests";

const TERAZ = 1_700_000_000_000;

function pokoj(over: Partial<Kandydat> & { ilu?: number; cisza?: number } = {}): Kandydat {
  const { ilu = 2, cisza = 0, ...reszta } = over;
  const players = Object.fromEntries(
    Array.from({ length: ilu }, (_, i) => {
      const g = newPlayer(`u${i}`, `Gracz${i}`, "cat", TERAZ - 60_000, i === 0);
      return [g.uid, { ...g, lastSeenAt: TERAZ - cisza }];
    }),
  );
  return {
    code: "AAAA",
    public: true,
    status: "lobby",
    gameId: null,
    createdAt: TERAZ - 60_000,
    players,
    ...reszta,
  };
}

describe("publiczne pokoje — co trafia na listę", () => {
  it("pokój otwarty, w lobby i żywy", () => {
    expect(wybierzPubliczne([pokoj()], TERAZ).map((p) => p.code)).toEqual(["AAAA"]);
  });

  it("pomija pokój nieoznaczony jako publiczny", () => {
    expect(wybierzPubliczne([pokoj({ public: false })], TERAZ)).toEqual([]);
    expect(wybierzPubliczne([{ ...pokoj(), public: undefined as unknown as boolean }], TERAZ)).toEqual([]);
  });

  it("pomija pokój w trakcie gry — obcy dołączyłby w środku partii", () => {
    expect(wybierzPubliczne([pokoj({ status: "playing" })], TERAZ)).toEqual([]);
    expect(wybierzPubliczne([pokoj({ status: "finished" })], TERAZ)).toEqual([]);
  });

  it("pomija pokój pełny — obcy odbiłby się od limitu przy dołączaniu", () => {
    expect(wybierzPubliczne([pokoj({ ilu: MAX_W_POKOJU })], TERAZ)).toEqual([]);
    expect(wybierzPubliczne([pokoj({ ilu: MAX_W_POKOJU - 1 })], TERAZ)).toHaveLength(1);
  });

  it("pomija pokój pusty i porzucony — obcy czekałby na nikogo", () => {
    expect(wybierzPubliczne([pokoj({ ilu: 0 })], TERAZ)).toEqual([]);
    expect(wybierzPubliczne([pokoj({ cisza: CISZA_PORZUCENIA_MS })], TERAZ)).toEqual([]);
  });

  it("chwilowy brak zasięgu NIE zrzuca pokoju z listy", () => {
    // Próg jest hojniejszy niż kropka „online", żeby pozycje nie migotały.
    expect(wybierzPubliczne([pokoj({ cisza: CISZA_PORZUCENIA_MS - 1000 })], TERAZ)).toHaveLength(1);
  });

  it("najmłodsze pierwsze", () => {
    const stary = pokoj({ code: "STAR", createdAt: TERAZ - 3_600_000 });
    const nowy = pokoj({ code: "NOWY", createdAt: TERAZ - 1000 });
    expect(wybierzPubliczne([stary, nowy], TERAZ).map((p) => p.code)).toEqual(["NOWY", "STAR"]);
  });

  it("tnie do limitu listy", () => {
    const duzo = Array.from({ length: LIMIT_LISTY + 12 }, (_, i) =>
      pokoj({ code: `P${i}`, createdAt: TERAZ - i * 1000 }),
    );
    expect(wybierzPubliczne(duzo, TERAZ)).toHaveLength(LIMIT_LISTY);
  });
});

describe("publiczne pokoje — nic wpisanego przez gracza nie wychodzi na listę", () => {
  it("kafelek NIE zawiera nicków", () => {
    const p = pokoj({ ilu: 3 });
    const [kafelek] = wybierzPubliczne([p], TERAZ);
    expect(JSON.stringify(kafelek)).not.toContain("Gracz");
    expect(kafelek).not.toHaveProperty("players");
    expect(kafelek).not.toHaveProperty("nick");
  });

  it("nick ze znacznikami HTML nie ma jak wyciec", () => {
    // Ktoś już wpisał u nas nick <b>TEST. Lista jest jedynym ekranem widocznym
    // bez wejścia do pokoju, więc to tutaj by zaszkodziło.
    const p = pokoj();
    p.players.u0 = { ...p.players.u0, nick: "<b>TEST</b>" };
    expect(JSON.stringify(wybierzPubliczne([p], TERAZ))).not.toContain("<b>");
  });

  it("wypuszcza wyłącznie znane, bezpieczne pola", () => {
    const [kafelek] = wybierzPubliczne([pokoj()], TERAZ);
    expect(Object.keys(kafelek).sort()).toEqual(["avatars", "code", "createdAt", "ilu"]);
  });
});
