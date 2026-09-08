import { describe, expect, it } from "vitest";
import {
  BEZPIECZNE,
  chinczykEngine,
  DOM_OD,
  legalneRuchy,
  META,
  poleBezwzgledne,
  START,
  W_BAZIE,
  type ChinczykState,
} from "./engine";
import { chinczykSettingsSchema, type ChinczykSettings } from "./manifest";
import { mulberry32 } from "@/games/rng";
import type { Player, PlayerMap } from "@/lib/types/room";

const UIDS = ["a", "b", "c", "d"];
function gracz(uid: string, isHost = false): Player {
  return { uid, nick: uid.toUpperCase(), avatar: "cat", joinedAt: 0, isHost, connected: true, lastSeenAt: 0, totalScore: 0 };
}
const ctx = (uid: string, now = 2000, rng = mulberry32(1)) => ({ uid, now, rng });

/** Rzut kontrolowany: rng tak dobrane, by `1 + floor(rng*6)` dało zadane oczka. */
const kostka = (n: number) => () => (n - 1) / 6 + 0.001;

function nowaGra(ilu = 2, over: Partial<ChinczykSettings> = {}): ChinczykState {
  const uids = UIDS.slice(0, ilu);
  const players: PlayerMap = Object.fromEntries(uids.map((u, i) => [u, gracz(u, i === 0)]));
  const settings = { ...chinczykSettingsSchema.parse({}), ...over } as ChinczykSettings;
  let s = chinczykEngine.init({ players, seatOrder: uids, settings, now: 1000, rng: mulberry32(1), seed: 1 });
  uids.forEach((u, i) => {
    s = chinczykEngine.reduce(s, { type: "WYBIERZ", kolor: s.doWyboru[i] }, ctx(u));
  });
  return s;
}

const rzuc = (s: ChinczykState, uid: string, oczka: number) =>
  chinczykEngine.reduce(s, { type: "RZUC" }, { uid, now: 2000, rng: kostka(oczka) });
const rusz = (s: ChinczykState, uid: string, pionek: number) =>
  chinczykEngine.reduce(s, { type: "RUSZ", pionek }, ctx(uid));

describe("chińczyk — plansza i geometria", () => {
  it("każdy kolor startuje 13 pól dalej", () => {
    expect([...START]).toEqual([0, 13, 26, 39]);
  });

  it("postęp liczony jest względem własnego startu", () => {
    expect(poleBezwzgledne(0, 0)).toBe(0);
    expect(poleBezwzgledne(1, 0)).toBe(13);
    // zielony po 45 krokach owija się przez zero
    expect(poleBezwzgledne(1, 45)).toBe(6);
  });

  it("baza, korytarz i meta nie leżą na wspólnej trasie", () => {
    expect(poleBezwzgledne(0, W_BAZIE)).toBeNull();
    expect(poleBezwzgledne(0, DOM_OD)).toBeNull();
    expect(poleBezwzgledne(0, META)).toBeNull();
  });

  it("osiem pól bezpiecznych: cztery starty i cztery globusy", () => {
    expect([...BEZPIECZNE].sort((a, b) => a - b)).toEqual([0, 8, 13, 21, 26, 34, 39, 47]);
    for (const s of START) expect(BEZPIECZNE.has(s)).toBe(true);
    for (const s of START) expect(BEZPIECZNE.has((s + 8) % 52)).toBe(true);
  });
});

describe("chińczyk — legalne ruchy", () => {
  it("z bazy wychodzi się WYŁĄCZNIE szóstką", () => {
    const wBazie = [W_BAZIE, W_BAZIE, W_BAZIE, W_BAZIE];
    for (let o = 1; o <= 5; o++) expect(legalneRuchy(wBazie, o)).toEqual([]);
    expect(legalneRuchy(wBazie, 6)).toEqual([0, 1, 2, 3]);
  });

  it("na metę trzeba trafić dokładnie, nadmiar nie przechodzi", () => {
    expect(legalneRuchy([META - 2, W_BAZIE, W_BAZIE, W_BAZIE], 2)).toEqual([0]);
    expect(legalneRuchy([META - 2, W_BAZIE, W_BAZIE, W_BAZIE], 3)).toEqual([]);
  });

  it("pionek w środku już się nie rusza", () => {
    expect(legalneRuchy([META, META, META, 10], 3)).toEqual([3]);
  });

  it("z ostatniego pola trasy szóstka wchodzi prosto do środka", () => {
    expect(legalneRuchy([DOM_OD - 1, META, META, META], 6)).toEqual([0]);
  });
});

describe("chińczyk — wybór koloru", () => {
  it("przy dwóch graczach kolory są NAPRZECIW siebie", () => {
    const uids = UIDS.slice(0, 2);
    const players: PlayerMap = Object.fromEntries(uids.map((u, i) => [u, gracz(u, i === 0)]));
    const s = chinczykEngine.init({
      players, seatOrder: uids, settings: chinczykSettingsSchema.parse({}), now: 1000, rng: mulberry32(1), seed: 1,
    });
    // 0 i 2 to przeciwne rogi planszy: dystans do domu jest wtedy równy
    expect(s.doWyboru).toEqual([0, 2]);
  });

  it("przy trzech i czterech graczach wybór jest wolny", () => {
    for (const ilu of [3, 4]) {
      const uids = UIDS.slice(0, ilu);
      const players: PlayerMap = Object.fromEntries(uids.map((u, i) => [u, gracz(u, i === 0)]));
      const s = chinczykEngine.init({
        players, seatOrder: uids, settings: chinczykSettingsSchema.parse({}), now: 1000, rng: mulberry32(1), seed: 1,
      });
      expect(s.doWyboru).toEqual([0, 1, 2, 3]);
    }
  });

  it("zajętego koloru nie da się podebrać", () => {
    const uids = UIDS.slice(0, 2);
    const players: PlayerMap = Object.fromEntries(uids.map((u, i) => [u, gracz(u, i === 0)]));
    let s = chinczykEngine.init({
      players, seatOrder: uids, settings: chinczykSettingsSchema.parse({}), now: 1000, rng: mulberry32(1), seed: 1,
    });
    s = chinczykEngine.reduce(s, { type: "WYBIERZ", kolor: 0 }, ctx("a"));
    expect(() => chinczykEngine.reduce(s, { type: "WYBIERZ", kolor: 0 }, ctx("b"))).toThrow();
  });

  it("gracz może zmienić zdanie, zwalniając poprzedni kolor", () => {
    const uids = UIDS.slice(0, 4);
    const players: PlayerMap = Object.fromEntries(uids.map((u, i) => [u, gracz(u, i === 0)]));
    let s = chinczykEngine.init({
      players, seatOrder: uids, settings: chinczykSettingsSchema.parse({}), now: 1000, rng: mulberry32(1), seed: 1,
    });
    s = chinczykEngine.reduce(s, { type: "WYBIERZ", kolor: 0 }, ctx("a"));
    s = chinczykEngine.reduce(s, { type: "WYBIERZ", kolor: 1 }, ctx("a"));
    expect(s.sloty[0]).toBeNull();
    expect(s.sloty[1]).toBe("a");
  });

  it("gra rusza dopiero, gdy WSZYSCY mają kolor", () => {
    const uids = UIDS.slice(0, 3);
    const players: PlayerMap = Object.fromEntries(uids.map((u, i) => [u, gracz(u, i === 0)]));
    let s = chinczykEngine.init({
      players, seatOrder: uids, settings: chinczykSettingsSchema.parse({}), now: 1000, rng: mulberry32(1), seed: 1,
    });
    s = chinczykEngine.reduce(s, { type: "WYBIERZ", kolor: 0 }, ctx("a"));
    s = chinczykEngine.reduce(s, { type: "WYBIERZ", kolor: 1 }, ctx("b"));
    expect(s.phase).toBe("kolory");
    s = chinczykEngine.reduce(s, { type: "WYBIERZ", kolor: 3 }, ctx("c"));
    expect(s.phase).toBe("rzut");
  });

  it("termin wyboru rozdaje resztę i rusza z grą", () => {
    const uids = UIDS.slice(0, 3);
    const players: PlayerMap = Object.fromEntries(uids.map((u, i) => [u, gracz(u, i === 0)]));
    let s = chinczykEngine.init({
      players, seatOrder: uids, settings: chinczykSettingsSchema.parse({}), now: 1000, rng: mulberry32(1), seed: 1,
    });
    s = chinczykEngine.reduce(s, { type: "WYBIERZ", kolor: 2 }, ctx("a"));
    s = chinczykEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx("a", 99999));
    expect(s.phase).toBe("rzut");
    expect(s.sloty.filter(Boolean)).toHaveLength(3);
    expect(s.sloty[2]).toBe("a"); // wybrany kolor zostaje przy graczu
  });
});

describe("chińczyk — tura i szóstki", () => {
  it("szóstka daje dodatkowy rzut TEMU SAMEMU graczowi", () => {
    let s = nowaGra(2);
    const kto = s.sloty[s.tura]!;
    s = rzuc(s, kto, 6);
    s = rusz(s, kto, 0);
    expect(s.phase).toBe("rzut");
    expect(s.sloty[s.tura]).toBe(kto); // tura nie zmieniła właściciela
  });

  it("rzut inny niż szóstka przy pustej bazie oddaje turę", () => {
    let s = nowaGra(2);
    const pierwszy = s.sloty[s.tura]!;
    s = rzuc(s, pierwszy, 3); // wszystkie pionki w bazie, brak ruchu
    expect(s.sloty[s.tura]).not.toBe(pierwszy);
  });

  it("trzy szóstki pod rząd kasują trzeci rzut i kończą turę", () => {
    let s = nowaGra(2);
    const kto = s.sloty[s.tura]!;
    s = rzuc(s, kto, 6);
    s = rusz(s, kto, 0);
    s = rzuc(s, kto, 6);
    s = rusz(s, kto, 1);
    const przed = s.pionki[s.tura].filter((p) => p !== W_BAZIE).length;

    s = rzuc(s, kto, 6);
    expect(s.sloty[s.tura]).not.toBe(kto);   // tura przepadła
    expect(s.phase).toBe("rzut");
    // trzecia szóstka NIE wyprowadziła trzeciego pionka
    const kolorKto = [0, 1, 2, 3].find((k) => s.sloty[k] === kto)!;
    expect(s.pionki[kolorKto].filter((p) => p !== W_BAZIE)).toHaveLength(przed);
  });

  it("licznik szóstek zeruje się po zmianie tury", () => {
    let s = nowaGra(2);
    const kto = s.sloty[s.tura]!;
    s = rzuc(s, kto, 6);
    expect(s.szostki).toBe(1);
    s = rusz(s, kto, 0);
    s = rzuc(s, kto, 2); // nie szóstka, tura przechodzi
    s = rusz(s, kto, 0);
    expect(s.szostki).toBe(0);
  });

  it("kolejka pomija puste sloty przy trzech graczach", () => {
    const s = nowaGra(3);
    const zajete = s.sloty.map((u, i) => (u ? i : -1)).filter((i) => i >= 0);
    expect(zajete).toHaveLength(3);
    expect(zajete).toContain(s.tura);
  });
});

describe("chińczyk — zbicia", () => {
  it("wejście na cudzy pionek odsyła go do bazy", () => {
    let s = nowaGra(2);
    const kolorA = 0, kolorB = 2;
    // czerwony stoi 3 pola przed startem żółtego liczonym po trasie
    s = { ...s, tura: kolorA, phase: "ruch", kostka: 3,
          pionki: s.pionki.map((p, k) => (k === kolorA ? [23, W_BAZIE, W_BAZIE, W_BAZIE] : p)) };
    // żółty (start 26) na postępie 1 stoi na polu 27; czerwony z 23 + 3 = 26… ustawmy dokładnie
    s = { ...s, pionki: s.pionki.map((p, k) => (k === kolorB ? [1, W_BAZIE, W_BAZIE, W_BAZIE] : p)) };
    expect(poleBezwzgledne(kolorA, 26)).toBe(26);
    expect(poleBezwzgledne(kolorB, 1)).toBe(27);

    // czerwony 24 + 3 = 27 trafia na żółtego
    s = { ...s, pionki: s.pionki.map((p, k) => (k === kolorA ? [24, W_BAZIE, W_BAZIE, W_BAZIE] : p)) };
    const po = rusz(s, s.sloty[kolorA]!, 0);
    expect(po.pionki[kolorB][0]).toBe(W_BAZIE);
  });

  it("na polu bezpiecznym zbić się NIE da", () => {
    let s = nowaGra(2);
    const kolorA = 0, kolorB = 2;
    // pole 34 to globus (26 + 8), czyli bezpieczne
    expect(BEZPIECZNE.has(34)).toBe(true);
    s = { ...s, tura: kolorA, phase: "ruch", kostka: 4,
          pionki: s.pionki.map((p, k) =>
            k === kolorA ? [30, W_BAZIE, W_BAZIE, W_BAZIE] : k === kolorB ? [8, W_BAZIE, W_BAZIE, W_BAZIE] : p) };
    expect(poleBezwzgledne(kolorA, 34)).toBe(34);
    expect(poleBezwzgledne(kolorB, 8)).toBe(34);

    const po = rusz(s, s.sloty[kolorA]!, 0);
    expect(po.pionki[kolorB][0]).toBe(8); // stoi dalej, oba kolory dzielą pole
  });

  it("własnego pionka się nie zbija", () => {
    let s = nowaGra(2);
    const k = 0;
    s = { ...s, tura: k, phase: "ruch", kostka: 2,
          pionki: s.pionki.map((p, i) => (i === k ? [10, 12, W_BAZIE, W_BAZIE] : p)) };
    const po = rusz(s, s.sloty[k]!, 0);
    expect(po.pionki[k][0]).toBe(12);
    expect(po.pionki[k][1]).toBe(12); // oba stoją na jednym polu, nikt nie wraca
  });

  it("pionek w korytarzu domowym jest poza zasięgiem zbicia", () => {
    let s = nowaGra(2);
    const kolorA = 0, kolorB = 2;
    s = { ...s, tura: kolorA, phase: "ruch", kostka: 1,
          pionki: s.pionki.map((p, k) =>
            k === kolorA ? [25, W_BAZIE, W_BAZIE, W_BAZIE] : k === kolorB ? [DOM_OD, W_BAZIE, W_BAZIE, W_BAZIE] : p) };
    const po = rusz(s, s.sloty[kolorA]!, 0);
    expect(po.pionki[kolorB][0]).toBe(DOM_OD);
  });
});

describe("chińczyk — koniec partii", () => {
  it("wygrywa ten, kto wprowadzi WSZYSTKIE cztery pionki", () => {
    let s = nowaGra(2);
    const k = 0;
    s = { ...s, tura: k, phase: "ruch", kostka: 1,
          pionki: s.pionki.map((p, i) => (i === k ? [META - 1, META, META, META] : p)) };
    const po = rusz(s, s.sloty[k]!, 0);
    expect(po.phase).toBe("koniec");
    expect(po.zwyciezca).toBe(k);
    expect(po.scores[s.sloty[k]!]).toBe(1);
    expect(chinczykEngine.isFinished(po)).toBe(true);
  });

  it("trzy pionki w środku to jeszcze nie koniec", () => {
    let s = nowaGra(2);
    const k = 0;
    s = { ...s, tura: k, phase: "ruch", kostka: 1,
          pionki: s.pionki.map((p, i) => (i === k ? [META - 1, META, META, 5] : p)) };
    const po = rusz(s, s.sloty[k]!, 0);
    expect(po.phase).not.toBe("koniec");
    expect(po.zwyciezca).toBeNull();
  });

  it("przycisk zakonczenia gry pojawia sie dopiero na ekranie koncowym", () => {
    const s = nowaGra(2);
    const wTrakcie = chinczykEngine.publicView(s, {}) as { canFinish: boolean };
    expect(wTrakcie.canFinish).toBe(false);
  });
});

describe("chińczyk — cudze ruchy i terminy", () => {
  it("nie da się rzucić poza swoją turą", () => {
    const s = nowaGra(2);
    const obcy = s.sloty.find((u) => u && u !== s.sloty[s.tura])!;
    expect(() => rzuc(s, obcy, 6)).toThrow();
  });

  it("nie da się ruszyć pionkiem przed rzutem", () => {
    const s = nowaGra(2);
    expect(() => rusz(s, s.sloty[s.tura]!, 0)).toThrow();
  });

  it("nie da się ruszyć pionkiem, który nie ma legalnego ruchu", () => {
    let s = nowaGra(2);
    const kto = s.sloty[s.tura]!;
    s = rzuc(s, kto, 6);
    // pionek 0 wychodzi z bazy legalnie, ale udajemy ruch pionkiem stojącym na mecie
    s = { ...s, pionki: s.pionki.map((p, i) => (i === s.tura ? [W_BAZIE, META, META, META] : p)) };
    expect(() => rusz(s, kto, 1)).toThrow();
  });

  it("termin tury gra ZA gracza, zamiast zawieszać partię", () => {
    let s = nowaGra(2);
    const kto = s.sloty[s.tura]!;
    s = chinczykEngine.reduce(s, { type: "PHASE_TIMEOUT" }, { uid: kto, now: 99999, rng: kostka(6) });
    // rzucone za nieobecnego: albo czeka na ruch, albo tura już przeszła
    expect(["rzut", "ruch"]).toContain(s.phase);
    expect(s.phaseEndsAt).not.toBeNull();
  });

  it("termin w fazie ruchu wybiera pierwszy legalny pionek", () => {
    let s = nowaGra(2);
    const k = s.tura;
    s = { ...s, phase: "ruch", kostka: 3,
          pionki: s.pionki.map((p, i) => (i === k ? [10, 20, W_BAZIE, W_BAZIE] : p)) };
    const po = chinczykEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx(s.sloty[k]!, 99999));
    expect(po.pionki[k][0]).toBe(13); // ruszył się pierwszy z listy
  });

  it("bez limitu czasu faza nie ma terminu", () => {
    const s = nowaGra(2, { turaMs: 0 });
    expect(s.phaseEndsAt).toBeNull();
  });
});

describe("chińczyk — bezpieczeństwo publicView", () => {
  it("privateView nic nie niesie, bo gra nie ma tajemnic", () => {
    const s = nowaGra(2);
    expect(chinczykEngine.privateView(s, "a")).toBeNull();
  });

  it("publicView pokazuje legalne ruchy tylko w fazie ruchu", () => {
    let s = nowaGra(2);
    expect((chinczykEngine.publicView(s, {}) as { ruchy: number[] }).ruchy).toEqual([]);
    const kto = s.sloty[s.tura]!;
    s = rzuc(s, kto, 6);
    expect((chinczykEngine.publicView(s, {}) as { ruchy: number[] }).ruchy).toEqual([0, 1, 2, 3]);
  });
});
