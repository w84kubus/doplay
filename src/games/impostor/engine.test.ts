import { describe, expect, it } from "vitest";
import { impostorEngine, type ImpostorState } from "./engine";
import { impostorSettingsSchema, type ImpostorSettings } from "./manifest";
import { mulberry32 } from "@/games/rng";
import type { Player, PlayerMap } from "@/lib/types/room";

function player(uid: string, isHost = false): Player {
  return { uid, nick: uid, avatar: "🦊", joinedAt: 0, isHost, connected: true, lastSeenAt: 0, totalScore: 0 };
}
const players: PlayerMap = { host: player("host", true), a: player("a"), b: player("b"), c: player("c") };
const seat = ["host", "a", "b", "c"];

function init(overrides: Partial<ImpostorSettings> = {}, seed = 3): ImpostorState {
  const settings = { ...impostorSettingsSchema.parse({}), rounds: 1, ...overrides } as ImpostorSettings;
  return impostorEngine.init({ players, seatOrder: seat, settings, now: 1000, rng: mulberry32(seed), seed });
}
const ctx = (uid: string, now = 2000) => ({ uid, now, rng: mulberry32(now) });
const confirmAll = (s: ImpostorState) => seat.reduce((st, u) => impostorEngine.reduce(st, { type: "CONFIRM" }, ctx(u)), s);
const clueAll = (s: ImpostorState) => seat.reduce((st, u) => impostorEngine.reduce(st, { type: "CLUE", word: "x" + u }, ctx(u)), s);

describe("impostor — bezpieczeństwo", () => {
  it("publicView NIE ujawnia słowa ani impostorów przed wynikiem", () => {
    let s = init();
    const word = s.word;
    const check = (st: ImpostorState) => {
      const v = impostorEngine.publicView(st, players) as { word: unknown; impostors: string[] };
      expect(v.word).toBeNull();
      expect(v.impostors).toEqual([]);
      expect(JSON.stringify(v)).not.toContain(word);
      // żaden uid impostora nie może być oznaczony w publicView
      for (const imp of st.impostors) expect(JSON.stringify(v).includes(`"impostors":["${imp}"`)).toBe(false);
    };
    check(s); // rozdanie
    s = confirmAll(s); // podpowiedzi
    check(s);
    s = clueAll(s); // dyskusja
    check(s);
    s = impostorEngine.reduce(s, { type: "NEXT" }, ctx("host")); // glosowanie
    check(s);
  });

  it("słowo ujawnia się dopiero w fazie wynik", () => {
    let s = init();
    s = confirmAll(s);
    s = clueAll(s);
    s = impostorEngine.reduce(s, { type: "NEXT" }, ctx("host")); // glosowanie
    const imp = s.impostors[0];
    for (const u of seat) if (u !== imp) s = impostorEngine.reduce(s, { type: "VOTE", targetUid: imp }, ctx(u));
    s = impostorEngine.reduce(s, { type: "VOTE", targetUid: seat.find((u) => u !== imp)! }, ctx(imp));
    // impostor złapany → zgadywanie; niech spudłuje
    if (s.phase === "zgadywanie") s = impostorEngine.reduce(s, { type: "GUESS_WORD", word: "zzz" }, ctx(imp));
    const v = impostorEngine.publicView(s, players) as { word: string };
    expect(v.word).toBe(s.word);
  });
});

describe("impostor — role i podpowiedzi", () => {
  it("cywil dostaje słowo, impostor nie", () => {
    const s = init();
    const imp = s.impostors[0];
    const civ = seat.find((u) => u !== imp)!;
    expect((impostorEngine.privateView(s, civ) as { word: string }).word).toBe(s.word);
    expect((impostorEngine.privateView(s, imp) as { word: string | null }).word).toBeNull();
  });

  it("hintType KATEGORIA → impostor zna kategorię", () => {
    const s = init({ hintType: "KATEGORIA" });
    const imp = s.impostors[0];
    expect((impostorEngine.privateView(s, imp) as { hint: string }).hint).toBe(s.category);
  });

  it("hintType PIERWSZA_LITERA → impostor zna pierwszą literę", () => {
    const s = init({ hintType: "PIERWSZA_LITERA" });
    const imp = s.impostors[0];
    expect((impostorEngine.privateView(s, imp) as { hint: string }).hint).toBe(s.word.charAt(0).toLocaleUpperCase("pl"));
  });

  it("wariant: impostor NIE wie, że jest impostorem (słowo powiązane)", () => {
    const s = init({ hintType: "SLOWO_POWIAZANE", impostorKnows: false });
    const imp = s.impostors[0];
    const pv = impostorEngine.privateView(s, imp) as { role: string; word: string };
    expect(pv.role).toBe("cywil"); // nie wie!
    expect(pv.word).toBe(s.impostorWord);
    expect(pv.word).not.toBe(s.word);
  });
});

describe("impostor — przebieg i punktacja", () => {
  function toVoting(overrides: Partial<ImpostorSettings> = {}) {
    let s = init(overrides);
    s = confirmAll(s);
    expect(s.phase).toBe("podpowiedzi");
    s = clueAll(s);
    expect(s.phase).toBe("dyskusja");
    s = impostorEngine.reduce(s, { type: "NEXT" }, ctx("host"));
    expect(s.phase).toBe("glosowanie");
    return s;
  }

  it("cywile wykrywają impostora → +1 każdy; z pudłem impostora zostaje cywile", () => {
    let s = toVoting({ postEjectGuess: true });
    const imp = s.impostors[0];
    for (const u of seat) if (u !== imp) s = impostorEngine.reduce(s, { type: "VOTE", targetUid: imp }, ctx(u));
    s = impostorEngine.reduce(s, { type: "VOTE", targetUid: seat.find((u) => u !== imp)! }, ctx(imp));
    expect(s.phase).toBe("zgadywanie");
    s = impostorEngine.reduce(s, { type: "GUESS_WORD", word: "kompletnie-zle" }, ctx(imp));
    expect(s.result).toBe("cywile");
    const civ = seat.find((u) => u !== imp)!;
    expect(s.scores[civ]).toBe(1);
    expect(s.scores[imp] ?? 0).toBe(0);
  });

  it("impostor odgaduje hasło po wylocie → impostorzy +3", () => {
    let s = toVoting({ postEjectGuess: true });
    const imp = s.impostors[0];
    for (const u of seat) if (u !== imp) s = impostorEngine.reduce(s, { type: "VOTE", targetUid: imp }, ctx(u));
    s = impostorEngine.reduce(s, { type: "VOTE", targetUid: seat.find((u) => u !== imp)! }, ctx(imp));
    s = impostorEngine.reduce(s, { type: "GUESS_WORD", word: s.word }, ctx(imp));
    expect(s.result).toBe("impostorzy");
    expect(s.byGuess).toBe(true);
    expect(s.scores[imp]).toBe(3);
  });

  it("wyleci cywil → impostorzy +2", () => {
    let s = toVoting();
    const imp = s.impostors[0];
    const civ = seat.find((u) => u !== imp)!;
    // wszyscy głosują na cywila `civ`
    for (const u of seat) if (u !== civ) s = impostorEngine.reduce(s, { type: "VOTE", targetUid: civ }, ctx(u));
    s = impostorEngine.reduce(s, { type: "VOTE", targetUid: imp }, ctx(civ));
    expect(s.result).toBe("impostorzy");
    expect(s.scores[imp]).toBe(2);
  });

  it("pełna partia 1 rundy → koniec", () => {
    let s = toVoting();
    const imp = s.impostors[0];
    for (const u of seat) if (u !== imp) s = impostorEngine.reduce(s, { type: "VOTE", targetUid: imp }, ctx(u));
    s = impostorEngine.reduce(s, { type: "VOTE", targetUid: seat.find((u) => u !== imp)! }, ctx(imp));
    if (s.phase === "zgadywanie") s = impostorEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx("host", 999999));
    expect(s.phase).toBe("wynik");
    s = impostorEngine.reduce(s, { type: "NEXT" }, ctx("host"));
    expect(s.phase).toBe("koniec");
    expect(impostorEngine.isFinished(s)).toBe(true);
  });
});

describe("impostor — nikt nie zawiesza partii", () => {
  const timeout = (s: ImpostorState, now: number) =>
    impostorEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx("host", now));

  it("rozdanie ma termin, a nie czeka w nieskończoność", () => {
    expect(init().phaseEndsAt).not.toBeNull();
  });

  it("rusza z rozdania, choć jeden gracz nigdy nie potwierdził", () => {
    // c wychodzi zaraz po starcie i nigdy nie klika „zapamiętałem"
    let s = init();
    for (const u of ["host", "a", "b"]) s = impostorEngine.reduce(s, { type: "CONFIRM" }, ctx(u));
    expect(s.phase).toBe("rozdanie"); // bez czwartego stoi

    s = timeout(s, 999_999);
    expect(s.phase).toBe("podpowiedzi");
  });

  it("termin tury podpowiedzi domyka ją pasami nieobecnych", () => {
    let s = confirmAll(init({ clueRounds: 2 }));
    s = impostorEngine.reduce(s, { type: "CLUE", word: "kot" }, ctx("host"));
    s = impostorEngine.reduce(s, { type: "CLUE", word: "pies" }, ctx("a"));

    s = timeout(s, 999_999);
    expect(s.clueRound).toBe(2); // tura zamknięta, gra idzie dalej
    const pierwsza = s.clues.filter((c) => c.round === 1);
    expect(pierwsza).toHaveLength(4); // każdy ma ślad
    expect(pierwsza.filter((c) => c.word === "")).toHaveLength(2); // b i c spasowali
  });

  it("kolejna tura dostaje ŚWIEŻY termin, nie odziedziczony", () => {
    // Bez tego druga tura startowałaby z minionym terminem i wygasała natychmiast.
    let s = confirmAll(init({ clueRounds: 2 }));
    const pierwszyTermin = s.phaseEndsAt;
    s = timeout(s, 500_000);
    expect(s.clueRound).toBe(2);
    expect(s.phaseEndsAt).not.toBe(pierwszyTermin);
    expect(s.phaseEndsAt!).toBeGreaterThan(500_000);
  });

  it("termin ostatniej tury prowadzi do dyskusji", () => {
    let s = confirmAll(init({ clueRounds: 1 }));
    s = timeout(s, 999_999);
    expect(s.phase).toBe("dyskusja");
  });

  it("termin tury dłuższy przy większym stole", () => {
    const maly = confirmAll(init());
    const duzyPlayers: PlayerMap = { ...players };
    const duzySeat = [...seat];
    for (const u of ["d", "e", "f", "g"]) { duzyPlayers[u] = player(u); duzySeat.push(u); }
    const settings = { ...impostorSettingsSchema.parse({}), rounds: 1 } as ImpostorSettings;
    let duzy = impostorEngine.init({ players: duzyPlayers, seatOrder: duzySeat, settings, now: 1000, rng: mulberry32(3), seed: 3 });
    duzy = duzySeat.reduce((st, u) => impostorEngine.reduce(st, { type: "CONFIRM" }, ctx(u)), duzy);
    expect(duzy.phaseEndsAt!).toBeGreaterThan(maly.phaseEndsAt!);
  });
});
