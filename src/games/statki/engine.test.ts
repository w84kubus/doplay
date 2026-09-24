import { describe, expect, it } from "vitest";
import { statkiEngine, type StatkiState } from "./engine";
import { statkiSettingsSchema, type StatkiSettings } from "./manifest";
import { obwodka, polaFloty, polaStatku, type Statek } from "./plansza";
import { mulberry32 } from "@/games/rng";
import type { Player, PlayerMap } from "@/lib/types/room";

const uids = ["host", "a", "b", "c"];
const gracz = (u: string, bot = false): Player => ({
  uid: u, nick: u, avatar: "cat", joinedAt: 0, isHost: u === "host", connected: true, lastSeenAt: 0, totalScore: 0,
  ...(bot ? { bot: true } : {}),
});
const players: PlayerMap = Object.fromEntries(uids.map((u) => [u, gracz(u)]));
const ctx = (uid: string, now = 2000, seed = 3) => ({ uid, now, rng: mulberry32(seed) });

function gra(over: Partial<StatkiSettings> = {}, seatOrder = uids, kto: PlayerMap = players): StatkiState {
  const settings = { ...statkiSettingsSchema.parse({}), ...over } as StatkiSettings;
  return statkiEngine.init({ players: kto, seatOrder, settings, now: 1000, rng: mulberry32(1), seed: 1 });
}

/** Stan z narzuconymi flotami — dzięki temu strzały w testach trafiają tam, gdzie chcemy. */
function zFlotami(flotaHost: Statek[], flotaA: Statek[], over: Partial<StatkiState> = {}): StatkiState {
  // `rounds: 0` świadomie: te testy sprawdzają MECHANIKĘ jednej partii, a przy domyślnym
  // limicie jednej rundy każda wygrana od razu kończy całą grę i faza „wynik" nie zdąży
  // się pojawić. Limit rund ma własny test niżej.
  const s = gra({ rounds: 0 });
  return {
    ...s,
    floty: { host: flotaHost, a: flotaA },
    gotowi: ["host", "a"],
    phase: "strzal",
    strzaly: { host: [], a: [] },
    tura: 0,
    ...over,
  };
}

const statek = (dlugosc: number, pole: number, poziomo = true): Statek => ({ dlugosc, pole, poziomo });

describe("statki — ustawianie floty", () => {
  it("obaj gracze z pary dostają gotową, poprawną flotę od pierwszej sekundy", () => {
    // Nikt nie zaczyna od pustej planszy: gdyby ktoś nie zdążył ustawić, i tak ma czym grać.
    const s = gra();
    expect(s.phase).toBe("ustawianie");
    expect(Object.keys(s.floty).sort()).toEqual(["a", "host"]);
    for (const uid of s.para) expect(polaFloty(s.floty[uid], s.bok).length).toBeGreaterThan(0);
  });

  it("faza ustawiania MA termin", () => {
    // Faza, która czeka na akcję konkretnych ludzi, bez terminu jest zakleszczeniem
    // (CLAUDE.md) — jeden gracz z padniętym telefonem zawieszałby partię reszcie.
    const s = gra({ ustawianieMs: 45000 });
    expect(s.phaseEndsAt).toBe(1000 + 45000);
  });

  it("LOSUJ zmienia MOJĄ flotę i nie rusza cudzej", () => {
    const s = gra();
    const po = statkiEngine.reduce(s, { type: "LOSUJ" }, ctx("host", 2000, 77));
    expect(po.floty.host).not.toEqual(s.floty.host);
    expect(po.floty.a).toEqual(s.floty.a);
  });

  it("PRZESTAW przesuwa wskazany statek", () => {
    const s = zFlotami([statek(3, 0), statek(2, 47, false)], [statek(2, 0)], { phase: "ustawianie", gotowi: [] });
    const po = statkiEngine.reduce(s, { type: "PRZESTAW", statek: 0, pole: 16, poziomo: false }, ctx("host"));
    expect(po.floty.host[0]).toEqual({ dlugosc: 3, pole: 16, poziomo: false });
    expect(po.floty.host[1]).toEqual(statek(2, 47, false));
  });

  it("serwer odrzuca ustawienie, które łamie reguły", () => {
    // Drugi statek stoi pionowo na polach 47 i 55 (prawa krawędź, dwa dolne wiersze).
    const s = zFlotami([statek(3, 0), statek(2, 47, false)], [statek(2, 0)], { phase: "ustawianie", gotowi: [] });
    const nielegalne: [string, number, boolean][] = [
      ["wychodzi poza prawą krawędź", 6, true],
      ["wchodzi na drugi statek", 39, false],
      ["styka się z drugim statkiem bokiem", 30, false],
      ["styka się z drugim statkiem rogiem", 22, false],
    ];
    for (const [opis, pole, poziomo] of nielegalne) {
      expect(
        () => statkiEngine.reduce(s, { type: "PRZESTAW", statek: 0, pole, poziomo }, ctx("host")),
        `serwer przyjął ustawienie, które ${opis}`,
      ).toThrow();
    }
    // I nic z tego nie zostaje w stanie.
    expect(s.floty.host[0]).toEqual(statek(3, 0));
  });

  it("nie da się przestawiać floty po zatwierdzeniu", () => {
    const s = zFlotami([statek(3, 0)], [statek(2, 40)], { phase: "ustawianie", gotowi: ["host"] });
    expect(() => statkiEngine.reduce(s, { type: "LOSUJ" }, ctx("host"))).toThrow();
    expect(() => statkiEngine.reduce(s, { type: "GOTOWY" }, ctx("host"))).toThrow();
  });

  it("kto nie gra w tej partii, nie rusza niczyjej floty", () => {
    const s = gra();
    expect(() => statkiEngine.reduce(s, { type: "LOSUJ" }, ctx("b"))).toThrow();
  });

  it("gdy obaj są gotowi, zaczyna się strzelanie", () => {
    let s = gra();
    s = statkiEngine.reduce(s, { type: "GOTOWY" }, ctx("host", 2000));
    expect(s.phase).toBe("ustawianie");
    s = statkiEngine.reduce(s, { type: "GOTOWY" }, ctx("a", 3000));
    expect(s.phase).toBe("strzal");
    expect(s.tura).toBe(0);
  });

  it("po terminie gra rusza z tym, co kto ma — nikt nie wypada", () => {
    const s = statkiEngine.reduce(gra(), { type: "PHASE_TIMEOUT" }, ctx("host", 50000));
    expect(s.phase).toBe("strzal");
    expect(s.gotowi.sort()).toEqual(["a", "host"]);
    for (const uid of s.para) expect(polaFloty(s.floty[uid], s.bok).length).toBeGreaterThan(0);
  });

  it("bot jest gotowy od razu — inaczej każda partia czekałaby na niego do terminu", () => {
    const zBotem: PlayerMap = { ...players, a: gracz("a", true) };
    const s = gra({}, uids, zBotem);
    expect(s.gotowi).toEqual(["a"]);
    const po = statkiEngine.reduce(s, { type: "GOTOWY" }, ctx("host", 2000));
    expect(po.phase).toBe("strzal");
  });
});

describe("statki — strzelanie", () => {
  it("pudło oddaje turę", () => {
    const s = zFlotami([statek(2, 0)], [statek(2, 40)]);
    const po = statkiEngine.reduce(s, { type: "STRZEL", pole: 63 }, ctx("host"));
    expect(po.ostatni).toMatchObject({ uid: "host", pole: 63, trafiony: false, zatopiony: false });
    expect(po.tura).toBe(1);
    expect(po.strzaly.host).toEqual([63]);
  });

  it("trafienie daje kolejny strzał, gdy opcja włączona", () => {
    const s = zFlotami([statek(2, 0)], [statek(2, 40)], { settings: { ...gra().settings, dodatkowyStrzal: true } });
    const po = statkiEngine.reduce(s, { type: "STRZEL", pole: 40 }, ctx("host"));
    expect(po.ostatni?.trafiony).toBe(true);
    expect(po.tura).toBe(0);
  });

  it("z wyłączoną opcją trafienie też oddaje turę", () => {
    const s = zFlotami([statek(2, 0)], [statek(2, 40)], { settings: { ...gra().settings, dodatkowyStrzal: false } });
    const po = statkiEngine.reduce(s, { type: "STRZEL", pole: 40 }, ctx("host"));
    expect(po.ostatni?.trafiony).toBe(true);
    expect(po.tura).toBe(1);
  });

  it("nie da się strzelić dwa razy w to samo pole", () => {
    const s = zFlotami([statek(2, 0)], [statek(2, 40)], { strzaly: { host: [63], a: [] } });
    expect(() => statkiEngine.reduce(s, { type: "STRZEL", pole: 63 }, ctx("host"))).toThrow();
  });

  it("nie da się strzelać poza swoją turą ani poza planszę", () => {
    const s = zFlotami([statek(2, 0)], [statek(2, 40)]);
    expect(() => statkiEngine.reduce(s, { type: "STRZEL", pole: 5 }, ctx("a"))).toThrow();
    expect(() => statkiEngine.reduce(s, { type: "STRZEL", pole: 64 }, ctx("host"))).toThrow();
  });

  it("zatopienie odsłania całą wodę wokół statku", () => {
    // Statki nie mogą się stykać, więc obwódka zatopionego to pewna woda. Bez tego
    // obie strony marnowałyby strzały na pola, o których reguły gry i tak mówią wszystko.
    const cel = statek(2, 9);
    const s = zFlotami([statek(2, 40)], [cel], { settings: { ...gra().settings, dodatkowyStrzal: true } });
    let po = statkiEngine.reduce(s, { type: "STRZEL", pole: 9 }, ctx("host"));
    expect(po.ostatni?.zatopiony).toBe(false);
    po = statkiEngine.reduce(po, { type: "STRZEL", pole: 10 }, ctx("host"));

    expect(po.ostatni?.zatopiony).toBe(true);
    const wokol = obwodka(polaStatku(cel, s.bok)!, s.bok);
    for (const pole of wokol) expect(po.strzaly.host, `pole ${pole} powinno być odsłonięte`).toContain(pole);
  });

  it("zatopienie ostatniego statku kończy partię i daje punkt", () => {
    const s = zFlotami([statek(2, 40)], [statek(2, 9)], { settings: { ...gra().settings, dodatkowyStrzal: true } });
    let po = statkiEngine.reduce(s, { type: "STRZEL", pole: 9 }, ctx("host"));
    po = statkiEngine.reduce(po, { type: "STRZEL", pole: 10 }, ctx("host"));
    expect(po.phase).toBe("wynik");
    expect(po.ostatnia?.zwyciezca).toBe("host");
    expect(po.scores.host).toBe(1);
    expect(po.scores.a).toBe(0);
  });

  it("wygrana bez straty statku zgłasza rekord", () => {
    // Opt-in silnika: rdzeń nie zna gier, dopisuje do wyróżnień zdarzenia z meta.rekord.
    const s = zFlotami([statek(2, 40)], [statek(2, 9)], { settings: { ...gra().settings, dodatkowyStrzal: true } });
    let po = statkiEngine.reduce(s, { type: "STRZEL", pole: 9 }, ctx("host"));
    po = statkiEngine.reduce(po, { type: "STRZEL", pole: 10 }, ctx("host"));
    const rekordy = statkiEngine.drainEvents(po).filter((e) => e.meta?.rekord === true);
    expect(rekordy).toHaveLength(1);
    expect(rekordy[0].meta?.uid).toBe("host");
  });

  it("wygrana po stracie własnego statku rekordu NIE zgłasza", () => {
    const s = zFlotami([statek(2, 40)], [statek(2, 9)], {
      settings: { ...gra().settings, dodatkowyStrzal: true },
      strzaly: { host: [], a: [40, 41] }, // przeciwnik zdążył zatopić mój dwumasztowiec
    });
    let po = statkiEngine.reduce(s, { type: "STRZEL", pole: 9 }, ctx("host"));
    po = statkiEngine.reduce(po, { type: "STRZEL", pole: 10 }, ctx("host"));
    expect(po.ostatnia?.zwyciezca).toBe("host");
    expect(statkiEngine.drainEvents(po).filter((e) => e.meta?.rekord === true)).toHaveLength(0);
  });
});

describe("statki — terminy tury", () => {
  it("termin liczy się dla gracza PRZEJMUJĄCEGO strzał, nie kończącego", () => {
    const zBotem: PlayerMap = { ...players, a: gracz("a", true) };
    const s: StatkiState = {
      ...gra({ strzalMs: 40000 }, uids, zBotem),
      floty: { host: [statek(2, 0)], a: [statek(2, 40)] },
      gotowi: ["host", "a"], phase: "strzal", strzaly: { host: [], a: [] }, tura: 0,
    };
    const poPudle = statkiEngine.reduce(s, { type: "STRZEL", pole: 63 }, ctx("host", 5000));
    expect(poPudle.tura).toBe(1); // rusza bot
    expect(poPudle.phaseEndsAt).toBe(5000 + 1300);

    const poBocie = statkiEngine.reduce(poPudle, { type: "PHASE_TIMEOUT" }, ctx("a", 7000));
    if (poBocie.tura === 0) expect(poBocie.phaseEndsAt).toBe(7000 + 40000); // znowu człowiek
  });

  it("dodatkowy strzał dostaje ŚWIEŻY termin, nie resztkę poprzedniego", () => {
    const s = zFlotami([statek(2, 0)], [statek(2, 40)], {
      settings: { ...gra().settings, dodatkowyStrzal: true, strzalMs: 40000 },
      phaseEndsAt: 9999,
    });
    const po = statkiEngine.reduce(s, { type: "STRZEL", pole: 40 }, ctx("host", 20000));
    expect(po.tura).toBe(0);
    expect(po.phaseEndsAt).toBe(20000 + 40000);
  });

  it("bez limitu czasu człowiek gra bez terminu, ale bot nadal go ma", () => {
    const zBotem: PlayerMap = { ...players, a: gracz("a", true) };
    const s: StatkiState = {
      ...gra({ strzalMs: 0 }, uids, zBotem),
      floty: { host: [statek(2, 0)], a: [statek(2, 40)] },
      gotowi: ["host", "a"], phase: "strzal", strzaly: { host: [], a: [] }, tura: 1,
    };
    const naCzlowieka: StatkiState = { ...s, tura: 0 };
    const po = statkiEngine.reduce(naCzlowieka, { type: "STRZEL", pole: 63 }, ctx("host", 5000));
    expect(po.tura).toBe(1);
    expect(po.phaseEndsAt).toBe(5000 + 1300); // rusza bot
  });
});

describe("statki — partie i rotacja pary", () => {
  /** Rozgrywa partię samymi terminami. Zwraca stan końcowy. */
  function terminami(s: StatkiState, limit = 400): StatkiState {
    for (let i = 0; i < limit && (s.phase === "strzal" || s.phase === "ustawianie"); i++) {
      s = statkiEngine.reduce(s, { type: "PHASE_TIMEOUT" }, { uid: s.para[s.tura], now: 5000 + i, rng: mulberry32(i + 1) });
    }
    return s;
  }

  it("partia rozegrana samymi terminami zawsze się kończy", () => {
    // Tą samą drogą chodzi bot, więc zakleszczenie tutaj to zakleszczenie gry z botem.
    for (let seed = 1; seed <= 15; seed++) {
      const s = terminami(gra({ rounds: 0 }, ["host", "a"]));
      expect(s.phase, `seed ${seed}: partia nie doszła do wyniku`).toBe("wynik");
      expect(s.ostatnia?.zwyciezca).not.toBeNull();
      // Zwycięzca musi mieć zatopioną CAŁĄ flotę przeciwnika.
      const przegrany = s.para.find((u) => u !== s.ostatnia!.zwyciezca)!;
      const oddane = new Set(s.strzaly[s.ostatnia!.zwyciezca!]);
      for (const pole of polaFloty(s.floty[przegrany], s.bok)) expect(oddane.has(pole)).toBe(true);
    }
  });

  it("partia kończy się po ustalonej liczbie rund", () => {
    let s = terminami(gra({ rounds: 2 }, ["host", "a"]));
    expect(s.round).toBe(1);
    expect(s.phase).toBe("wynik");
    s = terminami(statkiEngine.reduce(s, { type: "NEXT" }, ctx("host", 90000)));
    expect(s.round).toBe(2);
    expect(s.phase).toBe("koniec");
    expect(statkiEngine.isFinished(s)).toBe(true);
  });

  it("nowa partia losuje floty od nowa i wraca do ustawiania", () => {
    const s = terminami(gra({ rounds: 0 }, ["host", "a"]));
    const po = statkiEngine.reduce(s, { type: "NEXT" }, ctx("host", 90000, 5));
    expect(po.phase).toBe("ustawianie");
    expect(po.phaseEndsAt).toBe(90000 + po.settings.ustawianieMs);
    expect(po.strzaly.host).toEqual([]);
    expect(po.floty[po.para[0]]).not.toEqual(s.floty[s.para[0]]);
  });

  it("wygrany zostaje przy stole, przegrany idzie na koniec kolejki", () => {
    const s = terminami(gra({ rounds: 0, winnerStays: true }));
    const zwyciezca = s.ostatnia!.zwyciezca!;
    const po = statkiEngine.reduce(s, { type: "NEXT" }, ctx("host", 90000));
    expect(po.para[0]).toBe(zwyciezca);
    expect(po.para[1]).toBe("b");
    expect(po.kolejka).toContain("c");
  });

  it("bot nie zostaje przy stole, gdy ktoś czeka w kolejce", () => {
    const zBotem: PlayerMap = { ...players, host: gracz("host", true), a: gracz("a", true) };
    const s = terminami(gra({ rounds: 0, winnerStays: true }, uids, zBotem));
    const po = statkiEngine.reduce(s, { type: "NEXT" }, ctx("host", 90000));
    expect(po.para).toEqual(["b", "c"]);
  });

  it("NEXT należy do hosta i tylko do fazy wyniku", () => {
    const s = terminami(gra({ rounds: 0 }, ["host", "a"]));
    expect(() => statkiEngine.reduce(s, { type: "NEXT" }, ctx("a"))).toThrow();
    expect(() => statkiEngine.reduce(gra(), { type: "NEXT" }, ctx("host"))).toThrow();
  });
});

describe("statki — zdarzenia ostatniej partii", () => {
  it("przy DOMYŚLNEJ jednej partii wygrana i rekord docierają do feedu", () => {
    // Osobny test od tych wyżej, i to jest cała jego racja bytu: pomocnik `zFlotami`
    // gra z `rounds: 0`, więc nigdy nie wchodzi w gałąź końca gry — a przy domyślnym
    // ustawieniu (jedna partia) wygrana wypada w ostatniej rundzie ZAWSZE. Wcześniej
    // `zakoncz` podmieniał wtedy bufor zdarzeń i ginęło jedno i drugie.
    const s: StatkiState = {
      ...gra({ rounds: 1, dodatkowyStrzal: true }),
      floty: { host: [statek(2, 40)], a: [statek(2, 9)] },
      gotowi: ["host", "a"], phase: "strzal", strzaly: { host: [], a: [] }, tura: 0,
    };
    let po = statkiEngine.reduce(s, { type: "STRZEL", pole: 9 }, ctx("host"));
    po = statkiEngine.reduce(po, { type: "STRZEL", pole: 10 }, ctx("host"));

    expect(po.phase, "jedna partia kończy całą grę").toBe("koniec");
    const zdarzenia = statkiEngine.drainEvents(po);
    expect(zdarzenia.map((e) => e.key)).toEqual(
      expect.arrayContaining(["statki.event.win", "statki.event.dry", "statki.event.gameOver"]),
    );
    expect(zdarzenia.filter((e) => e.meta?.rekord === true)).toHaveLength(1);
  });
});
