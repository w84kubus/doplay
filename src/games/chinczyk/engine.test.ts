import { describe, expect, it } from "vitest";
import {
  BEZPIECZNE,
  chinczykEngine,
  DOM_OD,
  legalneRuchy,
  META,
  PIONKOW,
  pionkiKoloru,
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

/** Ustawia cztery pozycje jednego koloru w płaskiej tablicy. */
const ustaw = (pionki: number[], kolor: number, cztery: number[]) =>
  pionki.map((p, i) => (Math.floor(i / PIONKOW) === kolor ? cztery[i % PIONKOW] : p));

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
    const przed = pionkiKoloru(s.pionki, s.tura).filter((p) => p !== W_BAZIE).length;

    s = rzuc(s, kto, 6);
    expect(s.sloty[s.tura]).not.toBe(kto);   // tura przepadła
    expect(s.phase).toBe("rzut");
    // trzecia szóstka NIE wyprowadziła trzeciego pionka
    const kolorKto = [0, 1, 2, 3].find((k) => s.sloty[k] === kto)!;
    expect(pionkiKoloru(s.pionki, kolorKto).filter((p) => p !== W_BAZIE)).toHaveLength(przed);
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

describe("chińczyk — widoczność rzutu", () => {
  it("rzut bez legalnego ruchu zostawia wynik na kostce", () => {
    const s = nowaGra(2); // wszystkie pionki w bazie, więc 3 nie daje ruchu
    const po = rzuc(s, s.sloty[s.tura]!, 3);
    expect(po.tura).not.toBe(s.tura); // tura poszła dalej
    expect(po.kostka).toBe(3); // ale gracz widzi, co wyrzucił
  });
});

describe("chińczyk — zbicia", () => {
  it("wejście na cudzy pionek odsyła go do bazy", () => {
    let s = nowaGra(2);
    const kolorA = 0, kolorB = 2;
    // czerwony stoi 3 pola przed startem żółtego liczonym po trasie
    s = { ...s, tura: kolorA, phase: "ruch", kostka: 3,
          pionki: ustaw(s.pionki, kolorA, [23, W_BAZIE, W_BAZIE, W_BAZIE]) };
    // żółty (start 26) na postępie 1 stoi na polu 27; czerwony z 23 + 3 = 26… ustawmy dokładnie
    s = { ...s, pionki: ustaw(s.pionki, kolorB, [1, W_BAZIE, W_BAZIE, W_BAZIE]) };
    expect(poleBezwzgledne(kolorA, 26)).toBe(26);
    expect(poleBezwzgledne(kolorB, 1)).toBe(27);

    // czerwony 24 + 3 = 27 trafia na żółtego
    s = { ...s, pionki: ustaw(s.pionki, kolorA, [24, W_BAZIE, W_BAZIE, W_BAZIE]) };
    const po = rusz(s, s.sloty[kolorA]!, 0);
    expect(pionkiKoloru(po.pionki, kolorB)[0]).toBe(W_BAZIE);
    // Licznik strat: to z niego bierze się wyróżnienie „wygrał bez straty pionka".
    expect(po.zbicia[kolorB]).toBe(1);
    expect(po.zbicia[kolorA]).toBe(0);
  });

  it("na polu bezpiecznym zbić się NIE da", () => {
    let s = nowaGra(2);
    const kolorA = 0, kolorB = 2;
    // pole 34 to globus (26 + 8), czyli bezpieczne
    expect(BEZPIECZNE.has(34)).toBe(true);
    s = { ...s, tura: kolorA, phase: "ruch", kostka: 4,
          pionki: ustaw(ustaw(s.pionki, kolorA, [30, W_BAZIE, W_BAZIE, W_BAZIE]), kolorB, [8, W_BAZIE, W_BAZIE, W_BAZIE]) };
    expect(poleBezwzgledne(kolorA, 34)).toBe(34);
    expect(poleBezwzgledne(kolorB, 8)).toBe(34);

    const po = rusz(s, s.sloty[kolorA]!, 0);
    expect(pionkiKoloru(po.pionki, kolorB)[0]).toBe(8); // stoi dalej, oba kolory dzielą pole
  });

  it("własnego pionka się nie zbija", () => {
    let s = nowaGra(2);
    const k = 0;
    s = { ...s, tura: k, phase: "ruch", kostka: 2,
          pionki: ustaw(s.pionki, k, [10, 12, W_BAZIE, W_BAZIE]) };
    const po = rusz(s, s.sloty[k]!, 0);
    expect(pionkiKoloru(po.pionki, k)[0]).toBe(12);
    expect(pionkiKoloru(po.pionki, k)[1]).toBe(12); // oba stoją na jednym polu, nikt nie wraca
  });

  it("pionek w korytarzu domowym jest poza zasięgiem zbicia", () => {
    let s = nowaGra(2);
    const kolorA = 0, kolorB = 2;
    s = { ...s, tura: kolorA, phase: "ruch", kostka: 1,
          pionki: ustaw(ustaw(s.pionki, kolorA, [25, W_BAZIE, W_BAZIE, W_BAZIE]), kolorB, [DOM_OD, W_BAZIE, W_BAZIE, W_BAZIE]) };
    const po = rusz(s, s.sloty[kolorA]!, 0);
    expect(pionkiKoloru(po.pionki, kolorB)[0]).toBe(DOM_OD);
  });
});

describe("chińczyk — koniec partii", () => {
  it("wygrywa ten, kto wprowadzi WSZYSTKIE cztery pionki", () => {
    let s = nowaGra(2);
    const k = 0;
    s = { ...s, tura: k, phase: "ruch", kostka: 1,
          pionki: ustaw(s.pionki, k, [META - 1, META, META, META]) };
    const po = rusz(s, s.sloty[k]!, 0);
    expect(po.phase).toBe("wynik");
    expect(po.zwyciezca).toBe(k);
    expect(po.scores[s.sloty[k]!]).toBe(1);
  });

  it("ekran wynikow zaprasza do zakonczenia, a hostowy FINISH je gasi", () => {
    let s = nowaGra(2);
    const k = 0;
    s = { ...s, tura: k, phase: "ruch", kostka: 1,
          pionki: ustaw(s.pionki, k, [META - 1, META, META, META]) };
    const wynik = rusz(s, s.sloty[k]!, 0);
    expect((chinczykEngine.publicView(wynik, {}) as { canFinish: boolean }).canFinish).toBe(true);
    expect(chinczykEngine.isFinished(wynik)).toBe(false);

    const po = chinczykEngine.reduce(wynik, { type: "FINISH" }, { uid: wynik.hostUid, now: 9000, rng: () => 0.5 });
    expect(chinczykEngine.isFinished(po)).toBe(true);
    expect((chinczykEngine.publicView(po, {}) as { canFinish: boolean }).canFinish).toBe(false);
  });

  it("trzy pionki w środku to jeszcze nie koniec", () => {
    let s = nowaGra(2);
    const k = 0;
    s = { ...s, tura: k, phase: "ruch", kostka: 1,
          pionki: ustaw(s.pionki, k, [META - 1, META, META, 5]) };
    const po = rusz(s, s.sloty[k]!, 0);
    expect(po.phase).not.toBe("wynik");
    expect(po.zwyciezca).toBeNull();
  });

  it("wyroznienie tylko za wygrana bez ani jednego powrotu do bazy", () => {
    const k = 0;
    const zwycieski = (zbicia: number[]) => {
      const baza = nowaGra(2);
      const s = { ...baza, tura: k, phase: "ruch" as const, kostka: 1, zbicia,
                  pionki: ustaw(baza.pionki, k, [META - 1, META, META, META]) };
      return chinczykEngine.drainEvents(rusz(s, s.sloty[k]!, 0));
    };
    expect(zwycieski([0, 0, 0, 0]).some((e) => e.meta?.rekord === true)).toBe(true);
    expect(zwycieski([1, 0, 0, 0]).some((e) => e.meta?.rekord === true)).toBe(false);
  });

  it("przycisk zakonczenia gry pojawia sie dopiero na ekranie wynikow", () => {
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
    s = { ...s, pionki: ustaw(s.pionki, s.tura, [W_BAZIE, META, META, META]) };
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
          pionki: ustaw(s.pionki, k, [10, 20, W_BAZIE, W_BAZIE]) };
    const po = chinczykEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx(s.sloty[k]!, 99999));
    expect(pionkiKoloru(po.pionki, k)[0]).toBe(13); // ruszył się pierwszy z listy
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

describe("chińczyk — boty", () => {
  /** Partia człowiek + bot. Człowiek wybiera kolor, bot dostaje resztę automatycznie. */
  function zBotem(over: Partial<ChinczykSettings> = {}) {
    const players: PlayerMap = {
      a: gracz("a", true),
      bot_1: { ...gracz("bot_1"), bot: true },
    };
    const settings = { ...chinczykSettingsSchema.parse({}), ...over } as ChinczykSettings;
    const s0 = chinczykEngine.init({ players, seatOrder: ["a", "bot_1"], settings, now: 1000, rng: mulberry32(1), seed: 1 });
    return { s0, po: chinczykEngine.reduce(s0, { type: "WYBIERZ", kolor: s0.doWyboru[0] }, ctx("a", 2000)) };
  }

  it("rozpoznaje bota po fladze w graczach", () => {
    const { s0 } = zBotem();
    expect(s0.botUidy).toEqual(["bot_1"]);
  });

  it("gra rusza, gdy wybrali wszyscy LUDZIE — bot nie klika", () => {
    const { po } = zBotem();
    expect(po.phase).toBe("rzut");
    expect(po.sloty.filter(Boolean)).toHaveLength(2); // bot dostał wolny kolor
  });

  it("bot dostaje krótki termin tury, człowiek pełny limit", () => {
    const { po } = zBotem({ turaMs: 30000 });
    const kolorBota = po.sloty.findIndex((u) => u === "bot_1");
    const kolorCzlowieka = po.sloty.findIndex((u) => u === "a");

    const turaBota = { ...po, tura: kolorBota };
    const dalej = chinczykEngine.reduce(turaBota, { type: "PHASE_TIMEOUT" }, ctx("a", 5000, kostka(1)));
    // Po turze bota ruch wraca do człowieka — i to on ma dostać pełne 30 s.
    expect(dalej.tura).toBe(kolorCzlowieka);
    expect(dalej.phaseEndsAt).toBe(5000 + 30000);
  });

  it("bot ma termin nawet przy ustawieniu „bez limitu”", () => {
    const { po } = zBotem({ turaMs: 0 });
    const kolorBota = po.sloty.findIndex((u) => u === "bot_1");
    const turaBota = { ...po, tura: kolorBota, phase: "rzut" as const };
    // Zaczynamy od tury człowieka: bez limitu ma nie mieć terminu…
    expect(chinczykEngine.phase(po).endsAt).toBeNull();
    // …ale bot musi go mieć, inaczej jego tura nie skończy się nigdy.
    const dalejBot = chinczykEngine.reduce(
      { ...turaBota, tura: kolorBota },
      { type: "PHASE_TIMEOUT" },
      ctx("a", 7000, kostka(3)),
    );
    expect(dalejBot.tura).not.toBe(kolorBota); // bot spasował, tura poszła dalej
    const znowuBot = { ...dalejBot, tura: kolorBota, phase: "rzut" as const };
    const termin = chinczykEngine.reduce(znowuBot, { type: "RZUC" }, { uid: "bot_1", now: 9000, rng: kostka(6) });
    expect(termin.phaseEndsAt).toBe(9000 + 1200);
  });

  it("termin liczy się dla koloru, KTÓRY PRZEJMUJE ruch, nie dla kończącego", () => {
    const { po } = zBotem({ turaMs: 30000 });
    const kolorCzlowieka = po.sloty.findIndex((u) => u === "a");
    const kolorBota = po.sloty.findIndex((u) => u === "bot_1");
    // Człowiek rzuca 3 przy pionkach w bazie: brak ruchu, tura idzie do bota.
    const poTurze = chinczykEngine.reduce(
      { ...po, tura: kolorCzlowieka },
      { type: "RZUC" },
      { uid: "a", now: 4000, rng: kostka(3) },
    );
    expect(poTurze.tura).toBe(kolorBota);
    expect(poTurze.phaseEndsAt).toBe(4000 + 1200); // termin bota, nie 30 s człowieka
  });
});
