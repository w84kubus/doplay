import { describe, expect, it } from "vitest";
import {
  czworkiEngine,
  idxPola,
  ladowanie,
  KOLUMNY,
  POL,
  WIERSZE,
  wolneKolumny,
  znajdzLinie,
  type CzworkiState,
  type Pole,
  type Znak,
} from "./engine";
import { czworkiSettingsSchema, type CzworkiSettings } from "./manifest";
import { mulberry32 } from "@/games/rng";
import type { Player, PlayerMap } from "@/lib/types/room";

const uids = ["host", "a", "b", "c"];
const gracz = (u: string, bot = false): Player => ({
  uid: u, nick: u, avatar: "cat", joinedAt: 0, isHost: u === "host", connected: true, lastSeenAt: 0, totalScore: 0,
  ...(bot ? { bot: true } : {}),
});
const players: PlayerMap = Object.fromEntries(uids.map((u) => [u, gracz(u)]));
const ctx = (uid: string, now = 2000) => ({ uid, now, rng: mulberry32(now) });

function gra(over: Partial<CzworkiSettings> = {}, seatOrder = uids, kto: PlayerMap = players): CzworkiState {
  const settings = { ...czworkiSettingsSchema.parse({}), ...over } as CzworkiSettings;
  return czworkiEngine.init({ players: kto, seatOrder, settings, now: 1000, rng: mulberry32(1), seed: 1 });
}

/** Wrzuca po kolei do podanych kolumn, zawsze graczem, który jest na turze. */
function wrzuty(s: CzworkiState, kolumny: number[], now = 2000): CzworkiState {
  return kolumny.reduce(
    (st, kolumna) => czworkiEngine.reduce(st, { type: "WRZUC", kolumna }, ctx(st.para[st.tura], now)),
    s,
  );
}

// Plansza z rysunku: sześć wierszy po siedem znaków, od GÓRY.
// C = czerwony (znak 0), Z = żółty (znak 1), kropka = pusto.
const LEGENDA: Record<string, Pole> = { ".": null, C: 0, Z: 1 };
function rysuj(...wiersze: string[]): Pole[] {
  expect(wiersze).toHaveLength(WIERSZE);
  const pola: Pole[] = [];
  for (const w of wiersze) {
    expect(w).toHaveLength(KOLUMNY);
    for (const znak of w) {
      expect(LEGENDA[znak], `nieznany znak „${znak}" w rysunku planszy`).not.toBeUndefined();
      pola.push(LEGENDA[znak]);
    }
  }
  return pola;
}

describe("czwórki — wykrywanie czwórki", () => {
  it("znajduje czwórkę w poziomie", () => {
    const p = rysuj(
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      "..CCCC.",
    );
    expect(znajdzLinie(p, idxPola(5, 2))).toEqual([37, 38, 39, 40]);
  });

  it("znajduje czwórkę w pionie", () => {
    const p = rysuj(
      ".......",
      ".......",
      "...Z...",
      "...Z...",
      "...Z...",
      "...Z...",
    );
    expect(znajdzLinie(p, idxPola(2, 3))).toEqual([17, 24, 31, 38]);
  });

  it("znajduje skos w dół w prawo", () => {
    const p = rysuj(
      ".......",
      ".......",
      "C......",
      ".C.....",
      "..C....",
      "...C...",
    );
    expect(znajdzLinie(p, idxPola(5, 3))).toEqual([14, 22, 30, 38]);
  });

  it("znajduje skos w dół w lewo", () => {
    const p = rysuj(
      ".......",
      ".......",
      "...C...",
      "..C....",
      ".C.....",
      "C......",
    );
    expect(znajdzLinie(p, idxPola(2, 3))).toEqual([17, 23, 29, 35]);
  });

  it("trzy w rzędzie to jeszcze nie czwórka", () => {
    const p = rysuj(
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      "..CCC..",
    );
    expect(znajdzLinie(p, idxPola(5, 2))).toBeNull();
  });

  it("nie łączy żetonów dwóch graczy", () => {
    const p = rysuj(
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      "..CCZC.",
    );
    expect(znajdzLinie(p, idxPola(5, 2))).toBeNull();
  });

  it("piątka w rzędzie podświetla się cała, nie przycięta do czterech", () => {
    // Zdarza się naturalnie: żeton wpada w lukę między dwiema trójkami.
    const p = rysuj(
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      "CCCCC..",
    );
    expect(znajdzLinie(p, idxPola(5, 2))).toEqual([35, 36, 37, 38, 39]);
  });

  it("puste pole nie tworzy linii", () => {
    expect(znajdzLinie(Array<Pole>(POL).fill(null), 0)).toBeNull();
  });
});

describe("czwórki — grawitacja", () => {
  it("żeton z pustej kolumny spada na sam dół", () => {
    expect(ladowanie(Array<Pole>(POL).fill(null), 3)).toBe(idxPola(5, 3));
  });

  it("kolejne żetony układają się na stosie", () => {
    const p = rysuj(
      ".......",
      ".......",
      ".......",
      ".......",
      "...C...",
      "...Z...",
    );
    expect(ladowanie(p, 3)).toBe(idxPola(3, 3));
  });

  it("pełna kolumna nie przyjmuje żetonu i wypada z listy wolnych", () => {
    const p = rysuj(
      "C......",
      "Z......",
      "C......",
      "Z......",
      "C......",
      "Z......",
    );
    expect(ladowanie(p, 0)).toBeNull();
    expect(wolneKolumny(p)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("kolumna spoza planszy nie istnieje", () => {
    const pusta = Array<Pole>(POL).fill(null);
    for (const zla of [-1, KOLUMNY, 1.5, Number.NaN]) expect(ladowanie(pusta, zla)).toBeNull();
  });
});

describe("czwórki — rozgrywka", () => {
  it("czerwony wygrywa pionem, dostaje punkt i linię do podświetlenia", () => {
    // C: 0,0,0,0   Z: 1,1,1
    const s = wrzuty(gra(), [0, 1, 0, 1, 0, 1, 0]);
    expect(s.phase).toBe("wynik");
    expect(s.ostatnia?.zwyciezca).toBe("host");
    expect(s.ostatnia?.linia).toHaveLength(4);
    expect(s.scores.host).toBe(1);
    expect(s.scores.a).toBe(0);
  });

  it("żeton ląduje tam, gdzie każe grawitacja, a nie tam, gdzie się kliknęło", () => {
    const s = wrzuty(gra(), [3]);
    expect(s.plansza[idxPola(5, 3)]).toBe(0);
    expect(s.ostatni).toBe(idxPola(5, 3));
    expect(s.plansza.filter((p) => p !== null)).toHaveLength(1);
  });

  it("pełna plansza bez czwórki to remis i nikt nie dostaje punktu", () => {
    // Układ z maksymalnym ciągiem dwóch w każdym kierunku: kolor = (floor(wiersz/2) + kolumna) % 2.
    // Stan budujemy wprost, bo ten układ nie powstaje z naprzemiennych ruchów — sprawdzamy
    // gałąź „plansza pełna", nie drogę dojścia do niej.
    const plansza: Pole[] = [];
    for (let w = 0; w < WIERSZE; w++) {
      for (let k = 0; k < KOLUMNY; k++) plansza.push(((Math.floor(w / 2) + k) % 2) as Znak);
    }
    plansza[idxPola(0, 0)] = null; // ostatnie wolne pole
    const s: CzworkiState = { ...gra(), plansza, tura: 0 };
    const po = czworkiEngine.reduce(s, { type: "WRZUC", kolumna: 0 }, ctx("host"));

    expect(wolneKolumny(po.plansza)).toEqual([]);
    expect(po.phase).toBe("wynik");
    expect(po.ostatnia?.zwyciezca).toBeNull();
    expect(Object.values(po.scores).every((v) => v === 0)).toBe(true);
  });

  it("nie można wrzucać poza swoją turą", () => {
    expect(() => czworkiEngine.reduce(gra(), { type: "WRZUC", kolumna: 0 }, ctx("a"))).toThrow();
  });

  it("nie można wrzucić do pełnej kolumny", () => {
    const s = wrzuty(gra({ rounds: 0 }), [0, 0, 0, 0, 0, 0]);
    expect(() => czworkiEngine.reduce(s, { type: "WRZUC", kolumna: 0 }, ctx(s.para[s.tura]))).toThrow();
  });

  it("nie można wrzucać po rozstrzygnięciu rundy", () => {
    const s = wrzuty(gra(), [0, 1, 0, 1, 0, 1, 0]);
    expect(s.phase).toBe("wynik");
    expect(() => czworkiEngine.reduce(s, { type: "WRZUC", kolumna: 2 }, ctx(s.para[0]))).toThrow();
  });

  it("schemat akcji odrzuca kolumnę spoza planszy", () => {
    expect(czworkiEngine.actionSchema.safeParse({ type: "WRZUC", kolumna: 3 }).success).toBe(true);
    for (const zla of [-1, KOLUMNY, 2.5])
      expect(czworkiEngine.actionSchema.safeParse({ type: "WRZUC", kolumna: zla }).success).toBe(false);
  });
});

describe("czwórki — rundy i rotacja pary", () => {
  it("partia kończy się po ustalonej liczbie rund", () => {
    const pionem = [0, 1, 0, 1, 0, 1, 0]; // czerwony bierze rundę czterema w kolumnie 0
    let s = gra({ rounds: 3 });

    s = wrzuty(s, pionem);
    expect(s.round).toBe(1);
    expect(s.phase).toBe("wynik");

    s = wrzuty(czworkiEngine.reduce(s, { type: "NEXT" }, ctx("host")), pionem);
    expect(s.round).toBe(2);
    expect(s.phase, "druga runda nie może kończyć partii z limitem trzech").toBe("wynik");

    s = wrzuty(czworkiEngine.reduce(s, { type: "NEXT" }, ctx("host")), pionem);
    expect(s.round).toBe(3);
    expect(s.phase).toBe("koniec");
    expect(czworkiEngine.isFinished(s)).toBe(true);
  });

  it("wygrany zostaje przy stole, przegrany idzie na koniec kolejki", () => {
    const s = wrzuty(gra({ rounds: 0, winnerStays: true }), [0, 1, 0, 1, 0, 1, 0]);
    const po = czworkiEngine.reduce(s, { type: "NEXT" }, ctx("host"));
    expect(po.para[0]).toBe("host"); // wygrany
    expect(po.para[1]).toBe("b"); // pierwszy z kolejki
    expect(po.kolejka).toEqual(["c", "a"]); // przegrany na końcu
    expect(po.plansza.every((p) => p === null)).toBe(true);
    expect(po.round).toBe(2);
  });

  it("przy rotacji bez zostawania wygranego schodzą obaj", () => {
    const s = wrzuty(gra({ rounds: 0, winnerStays: false }), [0, 1, 0, 1, 0, 1, 0]);
    const po = czworkiEngine.reduce(s, { type: "NEXT" }, ctx("host"));
    expect(po.para).toEqual(["b", "c"]);
    expect(po.kolejka).toEqual(["host", "a"]);
  });

  it("bot nie zostaje przy stole, gdy ktoś czeka w kolejce", () => {
    // Inaczej dobry bot trzymałby stolik przez całą partię, a pokój by się przyglądał.
    const zBotem: PlayerMap = { ...players, host: gracz("host", true) };
    const s = wrzuty(gra({ rounds: 0, winnerStays: true }, uids, zBotem), [0, 1, 0, 1, 0, 1, 0]);
    expect(s.ostatnia?.zwyciezca).toBe("host");
    const po = czworkiEngine.reduce(s, { type: "NEXT" }, ctx("host"));
    expect(po.para).toEqual(["b", "c"]);
    expect(po.kolejka).toContain("host");
  });

  it("we dwoje wygrany gra dalej z tym samym przeciwnikiem", () => {
    const s = wrzuty(gra({ rounds: 0 }, ["host", "a"]), [0, 1, 0, 1, 0, 1, 0]);
    const po = czworkiEngine.reduce(s, { type: "NEXT" }, ctx("host"));
    expect(po.para).toEqual(["host", "a"]);
    expect(po.kolejka).toEqual([]);
  });

  it("NEXT należy do hosta i tylko do fazy wyniku", () => {
    const s = wrzuty(gra({ rounds: 0 }), [0, 1, 0, 1, 0, 1, 0]);
    expect(() => czworkiEngine.reduce(s, { type: "NEXT" }, ctx("a"))).toThrow();
    expect(() => czworkiEngine.reduce(gra(), { type: "NEXT" }, ctx("host"))).toThrow();
  });
});

describe("czwórki — terminy tury", () => {
  it("termin liczy się dla gracza PRZEJMUJĄCEGO ruch, nie kończącego", () => {
    // Pułapka z Chińczyka: odziedziczony termin dawałby człowiekowi po bocie 1,1 s.
    const zBotem: PlayerMap = { ...players, a: gracz("a", true) };
    const s = gra({ moveMs: 30000 }, uids, zBotem);
    expect(s.tura).toBe(0);
    expect(s.phaseEndsAt).toBe(1000 + 30000); // rusza człowiek

    const po = czworkiEngine.reduce(s, { type: "WRZUC", kolumna: 0 }, ctx("host", 2000));
    expect(po.tura).toBe(1); // rusza bot
    expect(po.phaseEndsAt).toBe(2000 + 1100);

    const znowu = czworkiEngine.reduce(po, { type: "PHASE_TIMEOUT" }, ctx("a", 3000));
    expect(znowu.tura).toBe(0); // znowu człowiek
    expect(znowu.phaseEndsAt).toBe(3000 + 30000);
  });

  it("bez limitu czasu człowiek gra bez terminu, ale bot nadal go ma", () => {
    // Bez terminu bot nigdy by się nie ruszył — nie ma własnego napędu (CLAUDE.md).
    const zBotem: PlayerMap = { ...players, a: gracz("a", true) };
    const s = gra({ moveMs: 0 }, uids, zBotem);
    expect(s.phaseEndsAt).toBeNull();
    const po = czworkiEngine.reduce(s, { type: "WRZUC", kolumna: 0 }, ctx("host", 2000));
    expect(po.phaseEndsAt).toBe(2000 + 1100);
  });

  it("nowa runda dostaje ŚWIEŻY termin, nie odziedziczony", () => {
    const s = wrzuty(gra({ rounds: 0, moveMs: 30000 }), [0, 1, 0, 1, 0, 1, 0], 2000);
    const po = czworkiEngine.reduce(s, { type: "NEXT" }, ctx("host", 90000));
    expect(po.phaseEndsAt).toBe(90000 + 30000);
  });
});

describe("czwórki — PHASE_TIMEOUT gra za nieobecnego", () => {
  it("po upływie terminu pada realny ruch, nie przewinięcie fazy", () => {
    const s = gra();
    const po = czworkiEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx("host", 5000));
    expect(po.plansza.filter((p) => p !== null)).toHaveLength(1);
    expect(po.tura).toBe(1);
  });

  it("ruch za nieobecnego jest sensowny: blokuje cudzą czwórkę", () => {
    // To jest cała obietnica `wspieraBoty`. Losowa kolumna oddawałaby rundę.
    const s: CzworkiState = {
      ...gra(),
      tura: 0,
      plansza: rysuj(
        ".......",
        ".......",
        ".......",
        ".......",
        ".......",
        ".ZZZ...",
      ),
    };
    const po = czworkiEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx("host", 5000));
    const zablokowane = [idxPola(5, 0), idxPola(5, 4)];
    expect(zablokowane).toContain(po.ostatni);
  });

  it("termin poza fazą gry nic nie zmienia", () => {
    const s = wrzuty(gra({ rounds: 0 }), [0, 1, 0, 1, 0, 1, 0]);
    expect(czworkiEngine.reduce(s, { type: "PHASE_TIMEOUT" }, ctx("host", 5000))).toBe(s);
  });
});

describe("czwórki — pełne partie", () => {
  /** Wszystko, co musi być prawdą po KAŻDYM ruchu, niezależnie od drogi dojścia. */
  function niezmienniki(s: CzworkiState, skad: string) {
    const w = czworkiEngine.publicView(s, players) as { canFinish: boolean; turaUid: string | null };

    // Żeton nigdy nie wisi w powietrzu. Idąc od GÓRY kolumny: po pierwszym żetonie
    // nie może już trafić się dziura, bo pod spodem jest albo dno, albo inny żeton.
    for (let k = 0; k < KOLUMNY; k++) {
      let stos = false;
      for (let wiersz = 0; wiersz < WIERSZE; wiersz++) {
        const pole = s.plansza[idxPola(wiersz, k)];
        if (pole !== null) stos = true;
        else expect(stos, `${skad}: dziura pod żetonem w kolumnie ${k}`).toBe(false);
      }
    }

    // Liczba żetonów obu graczy różni się najwyżej o jeden — inaczej ktoś grał dwa razy.
    const czerwone = s.plansza.filter((p) => p === 0).length;
    const zolte = s.plansza.filter((p) => p === 1).length;
    expect(Math.abs(czerwone - zolte), `${skad}: rozjechała się kolejność ruchów`).toBeLessThanOrEqual(1);

    if (s.phase === "gra") {
      expect(w.turaUid, `${skad}: brak gracza na turze`).toBe(s.para[s.tura]);
      // Skoro gra trwa, na planszy nie może już być czwórki — runda powinna się zamknąć.
      for (let i = 0; i < POL; i++) {
        if (s.plansza[i] !== null) expect(znajdzLinie(s.plansza, i), `${skad}: czwórka bez rozstrzygnięcia`).toBeNull();
      }
    }
    expect(w.canFinish, `${skad}: canFinish poza ekranem wyniku`).toBe(s.phase === "wynik");
  }

  it("losowe partie zawsze kończą się wynikiem i nigdy nie łamią reguł", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = mulberry32(seed * 7919 + 13);
      let s = gra({ rounds: 0 }, ["host", "a"]);
      let ruch = 0;
      for (; ruch < POL + 2 && s.phase === "gra"; ruch++) {
        const wolne = wolneKolumny(s.plansza);
        const kolumna = wolne[Math.floor(rng() * wolne.length)];
        s = czworkiEngine.reduce(s, { type: "WRZUC", kolumna }, ctx(s.para[s.tura], 3000 + ruch));
        niezmienniki(s, `seed ${seed}, ruch ${ruch}`);
      }
      expect(s.phase, `seed ${seed}: partia nie zamknęła się w ${ruch} ruchach`).toBe("wynik");
      expect(s.plansza.filter((p) => p !== null).length).toBeLessThanOrEqual(POL);
    }
  });

  it("partia samymi terminami też dochodzi do końca", () => {
    // Tą samą drogą chodzi bot, więc zakleszczenie tutaj to zakleszczenie gry z botem.
    for (let seed = 1; seed <= 10; seed++) {
      let s = gra({ rounds: 0 }, ["host", "a"]);
      for (let i = 0; i < POL + 2 && s.phase === "gra"; i++) {
        s = czworkiEngine.reduce(s, { type: "PHASE_TIMEOUT" }, { uid: "host", now: 5000 + i, rng: mulberry32(seed + i) });
        niezmienniki(s, `timeout seed ${seed}, krok ${i}`);
      }
      expect(s.phase, `seed ${seed}: same terminy nie doprowadziły do wyniku`).toBe("wynik");
    }
  });
});

describe("czwórki — zdarzenia ostatniej rundy", () => {
  it("wynik ostatniej rundy nie ginie pod zdarzeniem końca gry", () => {
    // Ten sam błąd co w Kółku i w Statkach: `zakoncz` podmieniał bufor zdarzeń zamiast
    // do niego dopisać, więc runda kończąca partię nie miała w feedzie zwycięzcy.
    const pionem = [0, 1, 0, 1, 0, 1, 0];
    let s = wrzuty(gra({ rounds: 3 }), pionem);
    s = wrzuty(czworkiEngine.reduce(s, { type: "NEXT" }, ctx("host")), pionem);
    s = wrzuty(czworkiEngine.reduce(s, { type: "NEXT" }, ctx("host")), pionem);

    expect(s.phase).toBe("koniec");
    const klucze = czworkiEngine.drainEvents(s).map((e) => e.key);
    expect(klucze).toContain("czworki.event.win");
    expect(klucze).toContain("czworki.event.gameOver");
  });
});
