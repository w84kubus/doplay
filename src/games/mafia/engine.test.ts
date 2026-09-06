import { describe, expect, it } from "vitest";
import { chainDeaths, mafiaEngine, resolveNight, type MafiaState, type Role } from "./engine";
import { mafiaSettingsSchema, type MafiaSettings } from "./manifest";
import { mulberry32 } from "@/games/rng";
import type { Player, PlayerMap } from "@/lib/types/room";

const uids = ["host", "a", "b", "c", "d"];
const players: PlayerMap = Object.fromEntries(
  uids.map((u) => [u, { uid: u, nick: u, avatar: "🦊", joinedAt: 0, isHost: u === "host", connected: true, lastSeenAt: 0, totalScore: 0 } as Player]),
);
// stałe role do testów: host=mafia, a=detektyw, b=lekarz, c,d=mieszkańcy
const ROLES: Record<string, Role> = { host: "mafia", a: "detektyw", b: "lekarz", c: "mieszkaniec", d: "mieszkaniec" };

function game(over: Partial<MafiaSettings> = {}): MafiaState {
  const settings = { ...mafiaSettingsSchema.parse({}), ...over } as MafiaSettings;
  const s = mafiaEngine.init({ players, seatOrder: uids, settings, now: 1000, rng: mulberry32(1), seed: 1 });
  return { ...s, roles: ROLES };
}
const ctx = (uid: string, now = 2000) => ({ uid, now, rng: mulberry32(now) });
const confirmAll = (s: MafiaState) => uids.reduce((st, u) => mafiaEngine.reduce(st, { type: "CONFIRM" }, ctx(u)), s);
function noc(votes: Record<string, string>, extra: Partial<MafiaState> = {}): MafiaState {
  const s = confirmAll(game());
  return { ...s, mafiaVotes: votes, ...extra };
}

describe("mafia — rozliczenie nocy (resolveNight)", () => {
  it("mafia zabija cel", () => {
    expect(resolveNight(noc({ host: "c" })).deaths).toEqual(["c"]);
  });
  it("LEKARZ RATUJE: obrona celu anuluje zabójstwo", () => {
    expect(resolveNight(noc({ host: "c" }, { doctorSave: "c" })).deaths).toEqual([]);
  });
  it("lekarz chroni kogoś innego → cel i tak ginie", () => {
    expect(resolveNight(noc({ host: "c" }, { doctorSave: "d" })).deaths).toEqual(["c"]);
  });
  it("brak głosu mafii → nikt nie ginie", () => {
    expect(resolveNight(noc({})).deaths).toEqual([]);
  });
  it("detektyw poznaje frakcję celu", () => {
    expect(resolveNight(noc({ host: "c" }, { detectiveCheck: "host" })).detective).toEqual({ target: "host", isMafia: true });
    expect(resolveNight(noc({ host: "c" }, { detectiveCheck: "c" })).detective).toEqual({ target: "c", isMafia: false });
  });
});

describe("mafia — bezpieczeństwo", () => {
  it("publicView NIE ujawnia ról żywych graczy w trakcie gry", () => {
    const s = confirmAll(game()); // noc
    const v = mafiaEngine.publicView(s, players) as { players: { uid: string; role: string | null }[] };
    for (const p of v.players) expect(p.role).toBeNull();

    // Szeroki bezpiecznik: NIGDZIE w publicView nie może paść słowo „mafia" jako rola.
    // Wyjątkiem są pola narratora — narratorKey to klucz tłumaczenia z przedrostkiem nazwy
    // gry ("mafia.narrator.noc.5"), identyczny dla wszystkich graczy niezależnie od roli,
    // więc nic nie zdradza. Reszta widoku (gracze, głosy, liczniki) nadal jest sprawdzana
    // dosłownie — to jest regresja na najważniejszą zasadę projektu (SPEC §3.1).
    const { narrator: _n, narratorKey: _k, ...bezNarratora } = v as Record<string, unknown>;
    expect(JSON.stringify(bezNarratora)).not.toContain("mafia");
    // detektyw widzi swoją rolę tylko w private
    expect((mafiaEngine.privateView(s, "host") as { role: string }).role).toBe("mafia");
    expect((mafiaEngine.privateView(s, "host") as { mafia: string[] }).mafia).toContain("host");
  });
});

describe("mafia — akcje i przebieg", () => {
  it("rozdanie → wszyscy CONFIRM → noc 1", () => {
    const s = confirmAll(game());
    expect(s.phase).toBe("noc");
    expect(s.night).toBe(1);
  });

  it("noc kończy się gdy wszyscy aktywni zadziałali", () => {
    let s = confirmAll(game());
    s = mafiaEngine.reduce(s, { type: "MAFIA_KILL", target: "c" }, ctx("host"));
    s = mafiaEngine.reduce(s, { type: "INVESTIGATE", target: "host" }, ctx("a"));
    expect(s.phase).toBe("noc");
    s = mafiaEngine.reduce(s, { type: "PROTECT", target: "d" }, ctx("b")); // wszyscy zadziałali
    expect(s.phase).toBe("switt");
    expect(s.deaths).toEqual(["c"]);
    expect(s.alive.c).toBe(false);
  });

  it("lekarz nie może ratować dwa razy z rzędu tej samej osoby", () => {
    let s = confirmAll(game({ doctorNoRepeat: true }));
    s = { ...s, lastDoctorSave: "d" };
    expect(() => mafiaEngine.reduce(s, { type: "PROTECT", target: "d" }, ctx("b"))).toThrow();
  });

  it("MIASTO wygrywa po wygłosowaniu jedynego mafiozy", () => {
    let s = confirmAll(game({ discussionMs: 0 }));
    // przejdź noc (mafia pudłuje — chroniony), dzień, głosowanie
    s = mafiaEngine.reduce(s, { type: "MAFIA_KILL", target: "d" }, ctx("host"));
    s = mafiaEngine.reduce(s, { type: "INVESTIGATE", target: "host" }, ctx("a"));
    s = mafiaEngine.reduce(s, { type: "PROTECT", target: "d" }, ctx("b")); // ratuje d
    expect(s.phase).toBe("switt");
    s = mafiaEngine.reduce(s, { type: "NEXT" }, ctx("host")); // → dzień
    s = mafiaEngine.reduce(s, { type: "NEXT" }, ctx("host")); // → głosowanie
    for (const u of ["a", "b", "c", "d"]) s = mafiaEngine.reduce(s, { type: "VOTE", target: "host" }, ctx(u));
    s = mafiaEngine.reduce(s, { type: "VOTE", target: "nikt" }, ctx("host"));
    expect(s.phase).toBe("koniec");
    expect(s.winner).toBe("miasto");
    expect(mafiaEngine.scores(s).a).toBe(1); // mieszkańcy wygrali
    expect(mafiaEngine.scores(s).host ?? 0).toBe(0);
  });

  it("MAFIA wygrywa, gdy liczba mafiozów ≥ pozostali żywi", () => {
    // 4 graczy: 1 mafia. Po śmierci 2 mieszkańców zostają mafia + 1 → mafia ≥ inni.
    const roles4: Record<string, Role> = { host: "mafia", a: "mieszkaniec", b: "mieszkaniec", c: "detektyw" };
    const p4: PlayerMap = Object.fromEntries(["host", "a", "b", "c"].map((u) => [u, players[u]]));
    let s = mafiaEngine.init({ players: p4, seatOrder: ["host", "a", "b", "c"], settings: mafiaSettingsSchema.parse({ mafiaCount: 1 }), now: 1, rng: mulberry32(2), seed: 2 });
    s = { ...s, roles: roles4 };
    s = ["host", "a", "b", "c"].reduce((st, u) => mafiaEngine.reduce(st, { type: "CONFIRM" }, ctx(u)), s);
    // noc 1: zabij a (lekarza brak → ginie)
    s = mafiaEngine.reduce(s, { type: "MAFIA_KILL", target: "a" }, ctx("host"));
    s = mafiaEngine.reduce(s, { type: "INVESTIGATE", target: "b" }, ctx("c"));
    expect(s.phase).toBe("switt"); // a nie żyje; żywi: host,b,c (mafia 1 vs inni 2)
    expect(s.winner).toBeNull();
    s = mafiaEngine.reduce(s, { type: "NEXT" }, ctx("host")); // dzień
    s = mafiaEngine.reduce(s, { type: "NEXT" }, ctx("host")); // głosowanie
    // remis/nikt → nikt nie ginie → wraca noc
    for (const u of ["host", "b", "c"]) s = mafiaEngine.reduce(s, { type: "VOTE", target: "nikt" }, ctx(u));
    expect(s.phase).toBe("noc");
    // noc 2: zabij b → żywi host,c (mafia 1 = inni 1) → mafia wygrywa
    s = mafiaEngine.reduce(s, { type: "MAFIA_KILL", target: "b" }, ctx("host"));
    s = mafiaEngine.reduce(s, { type: "INVESTIGATE", target: "host" }, ctx("c"));
    expect(s.phase).toBe("koniec");
    expect(s.winner).toBe("mafia");
  });
});

// —— role dodatkowe (SPEC §5.6, DoD §10) ——
// Kolejność kroków rozliczenia jest tu całą trudnością, więc każdy krok ma
// osobny przypadek, a nie jeden test „wszystko naraz".
describe("mafia — szeryf, barman, snajper", () => {
  // host=mafia, a=detektyw, b=lekarz, c=snajper, d=barman/szeryf wg testu
  const ROLE_X: Record<string, Role> = { host: "mafia", a: "detektyw", b: "lekarz", c: "snajper", d: "barman" };
  const nocX = (over: Partial<MafiaState>, role = ROLE_X): MafiaState => {
    const s = confirmAll(game());
    return { ...s, roles: role, ...over };
  };

  it("SZERYF BLOKUJE: zablokowany mafioso nie oddaje głosu, nikt nie ginie", () => {
    const s = nocX(
      { mafiaVotes: { host: "c" }, sheriffTarget: "host" },
      { host: "mafia", a: "detektyw", b: "lekarz", c: "mieszkaniec", d: "szeryf" },
    );
    expect(resolveNight(s).deaths).toEqual([]);
  });

  it("SZERYF BLOKUJE lekarza: ochrona nie działa, cel ginie", () => {
    const s = nocX(
      { mafiaVotes: { host: "c" }, doctorSave: "c", sheriffTarget: "b" },
      { host: "mafia", a: "detektyw", b: "lekarz", c: "mieszkaniec", d: "szeryf" },
    );
    expect(resolveNight(s).deaths).toEqual(["c"]);
  });

  it("BARMAN PRZEKIEROWUJE: upity mafioso → cios spada na sąsiada z lewej ofiary", () => {
    // seatOrder: host,a,b,c,d — sąsiad z lewej „c" to „b"
    const s = nocX({ mafiaVotes: { host: "c" }, barmanTarget: "host" });
    expect(resolveNight(s).deaths).toEqual(["b"]);
  });

  it("BARMAN nie przekierowuje, gdy upił nie-mafioza", () => {
    const s = nocX({ mafiaVotes: { host: "c" }, barmanTarget: "a" });
    expect(resolveNight(s).deaths).toEqual(["c"]);
  });

  it("SNAJPER TRAFIA mafioza: ginie tylko mafioso", () => {
    const s = nocX({ mafiaVotes: {}, sniperTarget: "host", sniperActed: true });
    expect(resolveNight(s).deaths).toEqual(["host"]);
  });

  it("SNAJPER PUDŁUJE: trafił niewinnego → giną obaj", () => {
    const s = nocX({ mafiaVotes: {}, sniperTarget: "d", sniperActed: true });
    expect(new Set(resolveNight(s).deaths)).toEqual(new Set(["d", "c"]));
  });

  it("SNAJPER się wstrzymuje: nikt nie ginie od strzału", () => {
    const s = nocX({ mafiaVotes: {}, sniperTarget: null, sniperActed: true });
    expect(resolveNight(s).deaths).toEqual([]);
  });

  it("LEKARZ ratuje ofiarę snajpera, ale kara za pudło zostaje", () => {
    const s = nocX({ mafiaVotes: {}, sniperTarget: "d", sniperActed: true, doctorSave: "d" });
    expect(resolveNight(s).deaths).toEqual(["c"]);
  });

  it("blokada szeryfa unieważnia strzał snajpera", () => {
    const s = nocX(
      { mafiaVotes: {}, sniperTarget: "host", sniperActed: true, sheriffTarget: "c" },
      { host: "mafia", a: "detektyw", b: "lekarz", c: "snajper", d: "szeryf" },
    );
    expect(resolveNight(s).deaths).toEqual([]);
  });

  it("rozdanie honoruje extraRoles: snajper trafia do gry", () => {
    const s = mafiaEngine.init({
      players, seatOrder: uids,
      settings: { ...mafiaSettingsSchema.parse({}), extraRoles: ["snajper"] } as MafiaSettings,
      now: 1000, rng: mulberry32(7), seed: 7,
    });
    expect(Object.values(s.roles)).toContain("snajper");
  });

  it("bez extraRoles rozdanie zostaje na rdzeniu", () => {
    const s = mafiaEngine.init({ players, seatOrder: uids, settings: mafiaSettingsSchema.parse({}), now: 1000, rng: mulberry32(7), seed: 7 });
    expect(Object.values(s.roles).some((r) => ["snajper", "barman", "szeryf"].includes(r))).toBe(false);
  });
});

// —— reakcje łańcuchowe na śmierć (SPEC §5.6.4) ——
describe("mafia — kamikadze i zakochani", () => {
  // seatOrder: host, a, b, c, d
  const ustaw = (roles: Record<string, Role>, over: Partial<MafiaSettings> = {}): MafiaState => {
    const s = confirmAll(game(over));
    return { ...s, roles, settings: { ...s.settings, ...over } as MafiaSettings };
  };

  it("KAMIKADZE zabiera sąsiada z lewej", () => {
    const s = ustaw({ host: "mafia", a: "kamikadze", b: "mieszkaniec", c: "mieszkaniec", d: "mieszkaniec" }, { kamikazeSide: "left" });
    expect(new Set(chainDeaths(s, ["a"]))).toEqual(new Set(["a", "host"]));
  });

  it("KAMIKADZE z ustawieniem w prawo zabiera drugą stronę", () => {
    const s = ustaw({ host: "mafia", a: "kamikadze", b: "mieszkaniec", c: "mieszkaniec", d: "mieszkaniec" }, { kamikazeSide: "right" });
    expect(new Set(chainDeaths(s, ["a"]))).toEqual(new Set(["a", "b"]));
  });

  it("ZAKOCHANI: śmierć jednego zabija drugie", () => {
    const s = ustaw({ host: "mafia", a: "zakochani", b: "zakochani", c: "mieszkaniec", d: "mieszkaniec" });
    expect(new Set(chainDeaths(s, ["a"]))).toEqual(new Set(["a", "b"]));
  });

  it("łańcuch się nie zapętla: zakochany kamikadze", () => {
    // a i b zakochani; a jest też sąsiadem host-a. Łańcuch musi się zatrzymać.
    const s = ustaw({ host: "kamikadze", a: "zakochani", b: "zakochani", c: "mieszkaniec", d: "mieszkaniec" }, { kamikazeSide: "right" });
    const wynik = chainDeaths(s, ["host"]);
    expect(new Set(wynik)).toEqual(new Set(["host", "a", "b"]));
    expect(wynik.length).toBe(new Set(wynik).size); // bez duplikatów
  });

  it("kamikadze pomija martwych przy szukaniu sąsiada", () => {
    const s = ustaw({ host: "mafia", a: "kamikadze", b: "mieszkaniec", c: "mieszkaniec", d: "mieszkaniec" }, { kamikazeSide: "left" });
    const zHostemMartwym = { ...s, alive: { ...s.alive, host: false } };
    expect(new Set(chainDeaths(zHostemMartwym, ["a"]))).toEqual(new Set(["a", "d"]));
  });

  it("ZAKOCHANI wygrywają, gdy zostaną tylko oni dwoje", () => {
    let s = ustaw({ host: "mafia", a: "zakochani", b: "zakochani", c: "mieszkaniec", d: "mieszkaniec" }, { loversWin: true });
    // Warunek sprawdza się PRZY ŚMIERCI, więc ktoś musi zginąć: zostaje trójka,
    // wygłosowujemy c i przy stole zostaje sama para.
    s = { ...s, alive: { host: false, a: true, b: true, c: true, d: false }, phase: "glosowanie", votes: {} };
    let po = mafiaEngine.reduce(s, { type: "VOTE", target: "c" }, ctx("a"));
    po = mafiaEngine.reduce(po, { type: "VOTE", target: "c" }, ctx("b"));
    const koniec = mafiaEngine.reduce(po, { type: "VOTE", target: "nikt" }, ctx("c"));
    expect(koniec.winner).toBe("zakochani");
  });

  it("rozdanie daje zakochanych PARĄ, nigdy pojedynczo", () => {
    const s = mafiaEngine.init({
      players, seatOrder: uids,
      settings: { ...mafiaSettingsSchema.parse({}), extraRoles: ["zakochani"] } as MafiaSettings,
      now: 1000, rng: mulberry32(3), seed: 3,
    });
    const ilu = Object.values(s.roles).filter((r) => r === "zakochani").length;
    expect(ilu === 0 || ilu === 2).toBe(true);
    expect(ilu).toBe(2);
  });
});

describe("mafia — nikt nie zawiesza partii", () => {
  it("rozdanie ma termin, a nie czeka w nieskończoność", () => {
    expect(game().phaseEndsAt).not.toBeNull();
  });

  it("rusza do nocy, choć jeden gracz nigdy nie potwierdził roli", () => {
    // d wychodzi zaraz po rozdaniu i nigdy nie klika potwierdzenia
    let s = game();
    for (const u of ["host", "a", "b", "c"]) s = mafiaEngine.reduce(s, { type: "CONFIRM" }, ctx(u));
    expect(s.phase).toBe("rozdanie"); // bez piątego stoi

    s = mafiaEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx("host", 999_999));
    expect(s.phase).toBe("noc");
    expect(s.phaseEndsAt).not.toBeNull();
  });

  it("gracz, na którego nie czekano, NIE wypada z gry", () => {
    // Przestajemy czekać, ale rola zostaje: d wciąż żyje i ma swoją rolę.
    let s = game();
    s = mafiaEngine.reduce(s, { type: "CONFIRM" }, ctx("host"));
    s = mafiaEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx("host", 999_999));
    expect(s.alive.d).toBe(true);
    expect(s.playerUids).toContain("d");
    expect(s.roles.d).toBeTruthy();
  });
});
