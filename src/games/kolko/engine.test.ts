import { describe, expect, it } from "vitest";
import { kolkoEngine, znajdzLinie, type KolkoState } from "./engine";
import { kolkoSettingsSchema, type KolkoSettings } from "./manifest";
import { mulberry32 } from "@/games/rng";
import type { Player, PlayerMap } from "@/lib/types/room";

const uids = ["host", "a", "b", "c"];
const players: PlayerMap = Object.fromEntries(
  uids.map((u) => [u, { uid: u, nick: u, avatar: "cat", joinedAt: 0, isHost: u === "host", connected: true, lastSeenAt: 0, totalScore: 0 } as Player]),
);
const ctx = (uid: string, now = 2000) => ({ uid, now, rng: mulberry32(now) });

function gra(over: Partial<KolkoSettings> = {}, seatOrder = uids): KolkoState {
  const settings = { ...kolkoSettingsSchema.parse({}), ...over } as KolkoSettings;
  return kolkoEngine.init({ players, seatOrder, settings, now: 1000, rng: mulberry32(1), seed: 1 });
}
/** Kolejno stawia znaki, na przemian bieżącym graczem. */
function ruchy(s: KolkoState, pola: number[]): KolkoState {
  return pola.reduce((st, pole) => kolkoEngine.reduce(st, { type: "MARK", pole }, ctx(st.para[st.tura])), s);
}

describe("kolko — wykrywanie wygranej", () => {
  it("znajduje wiersz", () => {
    expect(znajdzLinie([0, 0, 0, null, null, null, null, null, null], 0)).toEqual([0, 1, 2]);
  });
  it("znajduje przekątną", () => {
    expect(znajdzLinie([0, null, null, null, 0, null, null, null, 0], 0)).toEqual([0, 4, 8]);
  });
  it("nie myli znaków", () => {
    expect(znajdzLinie([0, 0, 0, null, null, null, null, null, null], 1)).toBeNull();
  });
});

describe("kolko — rozgrywka", () => {
  it("X wygrywa górnym wierszem i dostaje punkt", () => {
    // X: 0,1,2   O: 3,4
    const s = ruchy(gra(), [0, 3, 1, 4, 2]);
    expect(s.phase).toBe("wynik");
    expect(s.ostatnia?.zwyciezca).toBe("host");
    expect(s.ostatnia?.linia).toEqual([0, 1, 2]);
    expect(s.scores.host).toBe(1);
  });

  it("pełna plansza bez trójki to remis, nikt nie dostaje punktu", () => {
    // X:0 O:1 X:2 O:4 X:3 O:5 X:7 O:6 X:8 → brak trójki
    const s = ruchy(gra(), [0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(s.phase).toBe("wynik");
    expect(s.ostatnia?.zwyciezca).toBeNull();
    expect(Object.values(s.scores).every((v) => v === 0)).toBe(true);
  });

  it("nie można stawiać poza swoją turą", () => {
    const s = gra();
    expect(() => kolkoEngine.reduce(s, { type: "MARK", pole: 0 }, ctx("a"))).toThrow();
  });

  it("nie można stawiać na zajętym polu", () => {
    const s = ruchy(gra(), [4]);
    expect(() => kolkoEngine.reduce(s, { type: "MARK", pole: 4 }, ctx(s.para[s.tura]))).toThrow();
  });

  it("po rozstrzygnięciu rundy nie da się już stawiać", () => {
    const s = ruchy(gra(), [0, 3, 1, 4, 2]);
    expect(() => kolkoEngine.reduce(s, { type: "MARK", pole: 8 }, ctx(s.para[0]))).toThrow();
  });
});

describe("kolko — rotacja par", () => {
  it("WYGRANY ZOSTAJE, przegrany idzie na koniec kolejki", () => {
    // start: para [host, a], kolejka [b, c]
    let s = ruchy(gra({ winnerStays: true }), [0, 3, 1, 4, 2]); // wygrywa host (X)
    s = kolkoEngine.reduce(s, { type: "NEXT" }, ctx("host"));
    expect(s.para[0]).toBe("host"); // został
    expect(s.para[1]).toBe("b"); // wszedł pierwszy z kolejki
    expect(s.kolejka).toEqual(["c", "a"]); // przegrany na końcu
  });

  it("po REMISIE schodzą oboje — inaczej dwoje równych blokowałoby stolik", () => {
    let s = ruchy(gra({ winnerStays: true }), [0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(s.ostatnia?.zwyciezca).toBeNull();
    s = kolkoEngine.reduce(s, { type: "NEXT" }, ctx("host"));
    expect(s.para).toEqual(["b", "c"]);
    expect(s.kolejka).toEqual(["host", "a"]);
  });

  it("przy dwóch graczach para się nie zmienia, bo nie ma kogo wpuścić", () => {
    let s = ruchy(gra({ winnerStays: true }, ["host", "a"]), [0, 3, 1, 4, 2]);
    s = kolkoEngine.reduce(s, { type: "NEXT" }, ctx("host"));
    expect(new Set(s.para)).toEqual(new Set(["host", "a"]));
    expect(s.kolejka).toEqual([]);
  });

  it("z wyłączonym trybem wygrany-zostaje para zmienia się zawsze", () => {
    let s = ruchy(gra({ winnerStays: false }), [0, 3, 1, 4, 2]);
    s = kolkoEngine.reduce(s, { type: "NEXT" }, ctx("host"));
    expect(s.para).toEqual(["b", "c"]);
  });

  it("NEXT tylko dla hosta i tylko w fazie wyniku", () => {
    const s = ruchy(gra(), [0, 3, 1, 4, 2]);
    expect(() => kolkoEngine.reduce(s, { type: "NEXT" }, ctx("a"))).toThrow();
    expect(() => kolkoEngine.reduce(gra(), { type: "NEXT" }, ctx("host"))).toThrow();
  });

  it("nowa runda czyści planszę i wraca na X", () => {
    let s = ruchy(gra(), [0, 3, 1, 4, 2]);
    s = kolkoEngine.reduce(s, { type: "NEXT" }, ctx("host"));
    expect(s.plansza.every((p) => p === null)).toBe(true);
    expect(s.tura).toBe(0);
    expect(s.round).toBe(2);
  });
});

describe("kolko — limit rund i timeout", () => {
  it("ostatnia runda kończy partię bez czekania na NEXT", () => {
    // totalRounds wprost na stanie: „1" nie jest dozwoloną wartością ustawienia,
    // a testujemy zamykanie partii, nie walidację schematu.
    const s = ruchy({ ...gra(), totalRounds: 1 }, [0, 3, 1, 4, 2]);
    expect(kolkoEngine.isFinished(s)).toBe(true);
    expect(s.ostatnia?.zwyciezca).toBe("host"); // wynik rundy nie ginie przy zamknięciu
  });

  it("bez limitu rund partia nie kończy się sama", () => {
    const s = ruchy(gra({ rounds: 0 }), [0, 3, 1, 4, 2]);
    expect(kolkoEngine.isFinished(s)).toBe(false);
  });

  it("PHASE_TIMEOUT stawia za gracza i oddaje turę", () => {
    const s = gra({ moveMs: 10000 });
    const po = kolkoEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx("nikt"));
    expect(po.plansza.filter((p) => p !== null)).toHaveLength(1);
    expect(po.tura).toBe(1);
  });

  it("PHASE_TIMEOUT jest deterministyczny przy tym samym rng", () => {
    const s = gra({ moveMs: 10000 });
    const a = kolkoEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx("x", 7));
    const b = kolkoEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx("x", 7));
    expect(a.plansza).toEqual(b.plansza);
  });
});

describe("kolko — widoki", () => {
  it("publicView pokazuje planszę wszystkim (gra bez tajemnic)", () => {
    const s = ruchy(gra(), [4]);
    const v = kolkoEngine.publicView(s, players) as { plansza: unknown[]; turaUid: string };
    expect(v.plansza[4]).toBe(0);
    expect(v.turaUid).toBe("a");
  });

  it("privateView mówi graczowi, czy i czym gra", () => {
    const s = gra();
    expect(kolkoEngine.privateView(s, "host")).toMatchObject({ gram: true, znak: 0, mojaTura: true });
    expect(kolkoEngine.privateView(s, "a")).toMatchObject({ gram: true, znak: 1, mojaTura: false });
    expect(kolkoEngine.privateView(s, "b")).toMatchObject({ gram: false, znak: null });
  });
});

describe("kolko — zdarzenia ostatniej rundy", () => {
  it("wynik ostatniej rundy nie ginie pod zdarzeniem końca gry", () => {
    // `zakoncz` PODMIENIAŁ bufor zdarzeń, więc rozstrzygnięcie rundy, po której partia
    // się kończy, nie docierało do feedu — a to akurat ta runda, o której wszyscy mówią.
    const wygrana = [0, 3, 1, 4, 2];
    let s = ruchy(gra({ rounds: 3 }), wygrana);
    s = ruchy(kolkoEngine.reduce(s, { type: "NEXT" }, ctx("host")), wygrana);
    s = ruchy(kolkoEngine.reduce(s, { type: "NEXT" }, ctx("host")), wygrana);

    expect(s.phase).toBe("koniec");
    const klucze = kolkoEngine.drainEvents(s).map((e) => e.key);
    expect(klucze).toContain("kolko.event.win");
    expect(klucze).toContain("kolko.event.gameOver");
  });
});
