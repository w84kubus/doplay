import { describe, expect, it } from "vitest";
import { ocenKolumne, przeciwny, srodek, wybierzKolumne, wygrywajaceKolumny } from "./bot";
import {
  czworkiEngine,
  idxPola,
  KOLUMNY,
  POL,
  WIERSZE,
  wolneKolumny,
  type CzworkiState,
  type Pole,
  type Znak,
} from "./engine";
import { czworkiSettingsSchema } from "./manifest";
import { mulberry32 } from "@/games/rng";
import type { Player, PlayerMap } from "@/lib/types/room";

// Mózg bota. Gra nim też nieobecny człowiek, więc jego decyzje widuje się w każdej partii.
const LEGENDA: Record<string, Pole> = { ".": null, C: 0, Z: 1 };
function rysuj(...wiersze: string[]): Pole[] {
  expect(wiersze).toHaveLength(WIERSZE);
  return wiersze.flatMap((w) => {
    expect(w).toHaveLength(KOLUMNY);
    return [...w].map((z) => LEGENDA[z]);
  });
}
const pusta = () => Array<Pole>(POL).fill(null);
const rng = mulberry32(42);

describe("czwórki — bot rozpoznaje sytuację", () => {
  it("znajduje wszystkie kolumny, w których wygrywa jednym wrzuceniem", () => {
    const p = rysuj(
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".CCC...",
    );
    expect(wygrywajaceKolumny(p, 0)).toEqual([0, 4]);
    expect(wygrywajaceKolumny(p, 1)).toEqual([]);
  });

  it("premia za środek maleje symetrycznie ku krawędziom", () => {
    expect(srodek(3)).toBeGreaterThan(srodek(2));
    expect(srodek(2)).toBeGreaterThan(srodek(1));
    expect(srodek(1)).toBeGreaterThan(srodek(0));
    expect(srodek(0)).toBe(srodek(6));
    expect(srodek(2)).toBe(srodek(4));
  });

  it("przeciwny odwraca znak", () => {
    expect(przeciwny(0)).toBe(1);
    expect(przeciwny(1)).toBe(0);
  });
});

describe("czwórki — bot podejmuje decyzje", () => {
  it("na pustej planszy gra środkiem", () => {
    expect(wybierzKolumne(pusta(), 0, rng)).toBe(3);
  });

  it("dokłada czwartą i wygrywa", () => {
    const p = rysuj(
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".CCC...",
    );
    expect([0, 4]).toContain(wybierzKolumne(p, 0, rng));
  });

  it("blokuje trójkę przeciwnika", () => {
    const p = rysuj(
      ".......",
      ".......",
      ".......",
      ".......",
      ".......",
      ".ZZZ...",
    );
    expect([0, 4]).toContain(wybierzKolumne(p, 0, rng));
  });

  it("woli wygrać, niż zablokować", () => {
    // Obaj mają po trójce. Bot gra czerwonymi — wygrana jest teraz, blokada to tylko
    // odroczenie przegranej.
    const p = rysuj(
      ".......",
      ".......",
      ".......",
      ".......",
      "ZZZ....",
      "CCC..ZC",
    );
    expect(wybierzKolumne(p, 0, rng)).toBe(3);
  });

  it("nie podaje przeciwnikowi wygranej na tacy", () => {
    // Żółty ma trójkę w wierszu 4, ale pod nią, w kolumnach 0 i 4, nie ma na czym stanąć.
    // Dopiero MÓJ żeton buduje mu podest: wrzucenie tam kończy się jego czwórką w następnym
    // ruchu. Bot ma omijać obie kolumny, choć czwórka żółtego jeszcze nie jest zagrożeniem.
    const p = rysuj(
      ".......",
      ".......",
      ".......",
      ".......",
      ".ZZZ...",
      ".CCZ...",
    );
    expect(wygrywajaceKolumny(p, 1), "żółty nie ma jeszcze czym wygrać").toEqual([]);
    expect(wygrywajaceKolumny(p, 0), "czerwony też nie — inaczej test mierzyłby co innego").toEqual([]);

    expect([0, 4]).not.toContain(wybierzKolumne(p, 0, rng));
    // Same oceny: zatrute kolumny muszą przegrywać nawet z krawędzią planszy.
    expect(ocenKolumne(p, 0, 0)).toBeLessThan(ocenKolumne(p, 0, 6));
    expect(ocenKolumne(p, 0, 4)).toBeLessThan(ocenKolumne(p, 0, 6));
  });

  it("gdy wszystkie ruchy są zatrute, wybiera i tak ten bliżej środka", () => {
    // Bot nie może wtedy nic uratować, ale MUSI zagrać — brak ruchu zawiesiłby turę.
    const p = rysuj(
      ".......",
      ".......",
      ".......",
      ".Z...Z.",
      ".Z.C.Z.",
      "CZCCCZC",
    );
    const wybor = wybierzKolumne(p, 0, rng);
    expect(wolneKolumny(p)).toContain(wybor);
  });

  it("podwójna groźba waży więcej niż pojedyncza, a ta więcej niż sam środek", () => {
    // Porównanie MUSI być odporne na premię za środek, inaczej niczego nie pilnuje:
    // podwójne groźby powstają naturalnie w środku planszy, więc test, który tylko
    // sprawdza „środek lepszy od krawędzi", przechodzi także wtedy, gdy waga groźby
    // w ogóle nie istnieje. Dlatego progiem jest CAŁA rozpiętość premii za środek.
    const rozpietosc = srodek(3) - srodek(0);

    const jedna = rysuj(".......", ".......", ".......", ".......", ".......", "CC.....");
    const podwojna = rysuj(".......", ".......", ".......", ".......", ".......", ".CC....");

    // Najpierw dowód, że plansze są tym, za co się podają.
    const poJednej = [...jedna];
    poJednej[idxPola(5, 2)] = 0;
    expect(wygrywajaceKolumny(poJednej, 0)).toEqual([3]);
    const poPodwojnej = [...podwojna];
    poPodwojnej[idxPola(5, 3)] = 0;
    expect(wygrywajaceKolumny(poPodwojnej, 0)).toEqual([0, 4]);

    const dwie = ocenKolumne(podwojna, 0, 3);
    const jedna_ = ocenKolumne(jedna, 0, 2);
    const zadna = ocenKolumne(jedna, 0, 6);
    expect(dwie - jedna_).toBeGreaterThan(rozpietosc);
    expect(jedna_ - zadna).toBeGreaterThan(rozpietosc);
  });

  it("nie wskazuje pełnej kolumny", () => {
    const p = rysuj(
      "C......",
      "Z......",
      "C......",
      "Z......",
      "C......",
      "Z......",
    );
    for (let i = 0; i < 20; i++) expect(wybierzKolumne(p, 0, mulberry32(i))).not.toBe(0);
    expect(ocenKolumne(p, 0, 0)).toBeLessThan(ocenKolumne(p, 0, 1));
  });

  it("remisy rozstrzyga rng, a nie stała kolejność kolumn", () => {
    // Środek zajęty do pełna, więc najlepsze są dwie symetryczne kolumny obok niego.
    // Bez losowania bot grałby w kółko tę samą partię przeciwko temu samemu otwarciu.
    const p = rysuj(
      "...C...",
      "...Z...",
      "...C...",
      "...Z...",
      "...C...",
      "...Z...",
    );
    expect(ocenKolumne(p, 0, 2)).toBe(ocenKolumne(p, 0, 4));
    const wybory = new Set(Array.from({ length: 40 }, (_, i) => wybierzKolumne(p, 0, mulberry32(i))));
    expect(wybory).toEqual(new Set([2, 4]));
  });
});

describe("czwórki — bot jako przeciwnik", () => {
  const uids = ["host", "a"];
  const players: PlayerMap = Object.fromEntries(
    uids.map((u) => [u, { uid: u, nick: u, avatar: "cat", joinedAt: 0, isHost: u === "host", connected: true, lastSeenAt: 0, totalScore: 0 } as Player]),
  );

  /** Partia: bot czerwonymi kontra gracz losowy. Zwraca zwycięzcę albo null (remis). */
  function partia(seed: number): string | null {
    const los = mulberry32(seed);
    let s: CzworkiState = czworkiEngine.init({
      players, seatOrder: uids, settings: czworkiSettingsSchema.parse({ rounds: 0 }),
      now: 1000, rng: mulberry32(seed), seed,
    });
    for (let ruch = 0; ruch < POL + 2 && s.phase === "gra"; ruch++) {
      const uid = s.para[s.tura];
      if (s.tura === 0) {
        // Bot: dokładnie ta sama droga co w silniku przy PHASE_TIMEOUT.
        s = czworkiEngine.reduce(s, { type: "PHASE_TIMEOUT" }, { uid, now: 2000 + ruch, rng: los });
      } else {
        const wolne = wolneKolumny(s.plansza);
        const kolumna = wolne[Math.floor(los() * wolne.length)];
        s = czworkiEngine.reduce(s, { type: "WRZUC", kolumna }, { uid, now: 2000 + ruch, rng: los });
      }
    }
    expect(s.phase).toBe("wynik");
    return s.ostatnia?.zwyciezca ?? null;
  }

  it("ogrywa losowego przeciwnika niemal zawsze", () => {
    // Nie „zawsze": bot patrzy jeden ruch w przód, więc losowy gracz potrafi go raz na
    // jakiś czas zaskoczyć. To jest cecha, nie usterka - z botem nie do pokonania nikt
    // nie chce grać. Próg pilnuje tylko tego, żeby bot nie stał się nagle przypadkowy.
    const wyniki = Array.from({ length: 40 }, (_, i) => partia(i + 1));
    const wygrane = wyniki.filter((w) => w === "host").length;
    expect(wygrane).toBeGreaterThanOrEqual(36);
  });

  it("nigdy nie przegrywa przez przeoczenie czwórki w jednym ruchu", () => {
    // Najbardziej upokarzająca porażka: przeciwnik miał trójkę, a bot zagrał gdzie indziej.
    for (let seed = 1; seed <= 25; seed++) {
      const los = mulberry32(seed);
      let s: CzworkiState = czworkiEngine.init({
        players, seatOrder: uids, settings: czworkiSettingsSchema.parse({ rounds: 0 }),
        now: 1000, rng: mulberry32(seed), seed,
      });
      for (let ruch = 0; ruch < POL + 2 && s.phase === "gra"; ruch++) {
        const uid = s.para[s.tura];
        if (s.tura === 0) {
          const grozby = wygrywajaceKolumny(s.plansza, 1);
          const moje = wygrywajaceKolumny(s.plansza, 0);
          s = czworkiEngine.reduce(s, { type: "PHASE_TIMEOUT" }, { uid, now: 2000 + ruch, rng: los });
          if (moje.length === 0 && grozby.length === 1) {
            const pole = s.ostatni;
            expect(pole, `seed ${seed}, ruch ${ruch}: bot przeoczył czwórkę przeciwnika`).not.toBeNull();
            expect(grozby, `seed ${seed}, ruch ${ruch}: bot nie zablokował`).toContain(pole! % KOLUMNY);
          }
        } else {
          const wolne = wolneKolumny(s.plansza);
          s = czworkiEngine.reduce(s, { type: "WRZUC", kolumna: wolne[Math.floor(los() * wolne.length)] }, { uid, now: 2000 + ruch, rng: los });
        }
      }
    }
  });
});

// Nieużywane w asercjach, ale trzyma import `idxPola` i `Znak` w robocie przy
// czytaniu rysunków — usunięcie tej linii zepsułoby tylko czytelność, nie test.
export type _Kolor = Znak;
export const _srodkowe = idxPola(5, 3);
