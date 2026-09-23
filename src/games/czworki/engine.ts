import { z } from "zod";
import { GameError, type GameEngine, type InitContext, type WithEvents } from "@/games/types";
import type { PlayerMap } from "@/lib/types/room";
import { wybierzKolumne } from "./bot";
import type { CzworkiSettings } from "./manifest";

// Czwórki. Plansza jest jawna dla wszystkich — jak w Kółku i krzyżyku nie ma tu czego
// ukrywać, więc publicView pokazuje po prostu cały stan.
//
// Plansza jest JEDNĄ płaską tablicą 42 pól, nie tablicą wierszy. Powód jest twardy:
// Firestore nie przyjmuje tablicy w tablicy (patrz CLAUDE.md) i `Pole[][]` przeszłoby
// typy, testy i build, a wywaliłoby się dopiero przy starcie partii.

export type Znak = 0 | 1; // 0 = gracz czerwony (para[0]), 1 = żółty (para[1])
export type Pole = Znak | null;
type Phase = "gra" | "wynik" | "koniec";

export const KOLUMNY = 7;
export const WIERSZE = 6;
export const POL = KOLUMNY * WIERSZE;
/** Ile żetonów w rzędzie wygrywa. */
export const DO_WYGRANEJ = 4;

/** Indeks pola. Wiersz 0 to GÓRA planszy — żetony spadają w stronę rosnących wierszy. */
export const idxPola = (wiersz: number, kolumna: number) => wiersz * KOLUMNY + kolumna;
export const wierszPola = (i: number) => Math.floor(i / KOLUMNY);
export const kolumnaPola = (i: number) => i % KOLUMNY;

/** Kierunki linii wygrywającej: [przyrost wiersza, przyrost kolumny]. */
const KIERUNKI: readonly (readonly [number, number])[] = [
  [0, 1], // poziomo
  [1, 0], // pionowo
  [1, 1], // skos w dół w prawo
  [1, -1], // skos w dół w lewo
];

export interface CzworkiState extends WithEvents {
  settings: CzworkiSettings;
  hostUid: string;
  playerUids: string[];
  /** Kto gra botem — z `players[uid].bot` przy starcie partii. */
  botUidy: string[];
  /** Czeka na swoją kolej, w kolejności miejsc. */
  kolejka: string[];
  /** Aktualna para: [uid czerwonego, uid żółtego]. */
  para: [string, string];
  plansza: Pole[];
  /** Czyj ruch: indeks w `para`. */
  tura: Znak;
  /** Pole ostatnio wrzuconego żetonu — widok animuje nim spadanie. */
  ostatni: number | null;
  phase: Phase;
  phaseEndsAt: number | null;
  round: number;
  totalRounds: number;
  /** Wynik ostatniej rundy — null w zwycięzcy oznacza remis. */
  ostatnia: { zwyciezca: string | null; linia: readonly number[] | null } | null;
  scores: Record<string, number>;
}

export const czworkiActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("WRZUC"), kolumna: z.number().int().min(0).max(KOLUMNY - 1) }),
  z.object({ type: z.literal("NEXT") }),
  z.object({ type: z.literal("FINISH") }),
]);
export type CzworkiAction = z.infer<typeof czworkiActionSchema>;

/**
 * Gdzie wyląduje żeton wrzucony do kolumny, albo null, gdy kolumna jest pełna.
 * Czysta funkcja na liczbach — używa jej i silnik, i bot, i testy.
 */
export function ladowanie(plansza: readonly Pole[], kolumna: number): number | null {
  if (!Number.isInteger(kolumna) || kolumna < 0 || kolumna >= KOLUMNY) return null;
  for (let w = WIERSZE - 1; w >= 0; w--) {
    const i = idxPola(w, kolumna);
    if (plansza[i] === null) return i;
  }
  return null;
}

/** Kolumny, do których da się jeszcze wrzucić żeton. */
export function wolneKolumny(plansza: readonly Pole[]): number[] {
  const wolne: number[] = [];
  for (let k = 0; k < KOLUMNY; k++) if (ladowanie(plansza, k) !== null) wolne.push(k);
  return wolne;
}

/**
 * Linia wygrywająca przechodząca przez pole `i`, albo null.
 *
 * Liczona OD OSTATNIEGO RUCHU, nie przez skanowanie całej planszy: wygrana zawsze
 * przechodzi przez świeżo wrzucony żeton, więc to jest i szybsze, i krótsze. Zwracana
 * linia bywa dłuższa niż cztery pola (pięć w rzędzie zdarza się naturalnie) i wtedy
 * podświetla się cała — obcinanie do czterech wyglądałoby jak błąd rysowania.
 */
export function znajdzLinie(plansza: readonly Pole[], i: number): readonly number[] | null {
  const znak = plansza[i];
  if (znak === null || znak === undefined) return null;
  const w0 = wierszPola(i);
  const k0 = kolumnaPola(i);

  for (const [dw, dk] of KIERUNKI) {
    const linia = [i];
    for (const zwrot of [1, -1]) {
      for (let krok = 1; krok < DO_WYGRANEJ; krok++) {
        const w = w0 + dw * krok * zwrot;
        const k = k0 + dk * krok * zwrot;
        if (w < 0 || w >= WIERSZE || k < 0 || k >= KOLUMNY) break;
        const j = idxPola(w, k);
        if (plansza[j] !== znak) break;
        linia.push(j);
      }
    }
    if (linia.length >= DO_WYGRANEJ) return linia.sort((a, b) => a - b);
  }
  return null;
}

const pustaPlansza = () => Array<Pole>(POL).fill(null);
const planszaPelna = (p: readonly Pole[]) => wolneKolumny(p).length === 0;

/**
 * Ile czasu ma gracz, który WŁAŚNIE PRZEJMUJE ruch.
 *
 * Bot dostaje krótką pauzę zamiast pełnego limitu — to jednocześnie jego „myślenie"
 * i termin, którym wykonuje ruch (bot nie ma własnego napędu, patrz CLAUDE.md).
 * Liczone dla przejmującego, nie dla kończącego turę: inaczej człowiek grający po
 * bocie dostawałby 1,1 s, a bot po człowieku pełne trzydzieści.
 */
const MYSLENIE_MS = 1100;

function botGra(s: CzworkiState, znak: Znak): boolean {
  return s.botUidy.includes(s.para[znak]);
}

function termin(s: CzworkiState, tura: Znak, now: number): number | null {
  if (botGra(s, tura)) return now + MYSLENIE_MS;
  return s.settings.moveMs ? now + s.settings.moveMs : null;
}

function nowaRunda(s: CzworkiState, para: [string, string], now: number, round: number): CzworkiState {
  const stan: CzworkiState = {
    ...s,
    para,
    plansza: pustaPlansza(),
    tura: 0,
    ostatni: null,
    phase: "gra",
    round,
    phaseEndsAt: null,
    ostatnia: null,
    pendingEvents: [
      { type: "runda", text: `Runda ${round}`, key: "czworki.event.round", params: { round } },
    ],
  };
  return { ...stan, phaseEndsAt: termin(stan, 0, now) };
}

/**
 * Układa parę na następną rundę. „Wygrany zostaje" tylko wtedy, gdy ktoś wygrał —
 * po remisie obaj idą na koniec kolejki, inaczej dwoje równych graczy mogłoby
 * zablokować stolik na całą partię.
 *
 * Bot nigdy nie zostaje przy stole, gdy ktoś czeka. Sam z niego nie wstanie, a dobry
 * bot potrafi wygrać kilka rund z rzędu — wtedy połowa pokoju patrzyłaby, jak maszyna
 * gra z maszyną. Przy partii we dwoje kolejka jest pusta i reguła nic nie zmienia.
 */
function nastepnaPara(s: CzworkiState, zwyciezca: string | null): { para: [string, string]; kolejka: string[] } {
  const botZablokowalbyStolik = zwyciezca !== null && s.botUidy.includes(zwyciezca) && s.kolejka.length > 0;
  const zostaje = s.settings.winnerStays && !botZablokowalbyStolik ? zwyciezca : null;
  const schodzi = s.para.filter((u) => u !== zostaje);
  const kolejka = [...s.kolejka, ...schodzi];

  if (zostaje) {
    const wyzwanie = kolejka.shift();
    // Nikt nie czeka (partia we dwoje) — gramy dalej tą samą parą.
    if (!wyzwanie) return { para: s.para, kolejka: [] };
    return { para: [zostaje, wyzwanie], kolejka };
  }
  const a = kolejka.shift();
  const b = kolejka.shift();
  if (!a || !b) return { para: s.para, kolejka: s.kolejka };
  return { para: [a, b], kolejka };
}

function zakoncz(s: CzworkiState): CzworkiState {
  if (s.phase === "koniec") return s; // FINISH musi być idempotentny (kontrakt rdzenia)
  return {
    ...s,
    phase: "koniec",
    phaseEndsAt: null,
    pendingEvents: [{ type: "koniec", text: "Koniec gry!", key: "czworki.event.gameOver", params: {} }],
  };
}

/** Zamyka rundę: przyznaje punkt, wystawia zdarzenie, przechodzi w fazę wyniku. */
function rozstrzygnij(s: CzworkiState, zwyciezca: string | null, linia: readonly number[] | null): CzworkiState {
  const scores = { ...s.scores };
  if (zwyciezca) scores[zwyciezca] = (scores[zwyciezca] ?? 0) + 1;

  const koniecPartii = s.totalRounds > 0 && s.round >= s.totalRounds;
  const stan: CzworkiState = {
    ...s,
    scores,
    phase: "wynik",
    phaseEndsAt: null,
    ostatnia: { zwyciezca, linia },
    pendingEvents: [
      zwyciezca
        ? { type: "wynik", text: "Cztery w rzędzie!", key: "czworki.event.win", params: {}, meta: { uid: zwyciezca } }
        : { type: "wynik", text: "Remis.", key: "czworki.event.draw", params: {} },
    ],
  };
  if (!koniecPartii) return stan;

  // Zdarzenie rundy doklejamy do zdarzenia końca gry, zamiast pozwolić `zakoncz`
  // podmienić bufor — inaczej ostatnia runda partii nigdy nie trafiałaby do feedu
  // z informacją, KTO ją wygrał.
  const zakonczona = zakoncz(stan);
  return {
    ...zakonczona,
    ostatnia: stan.ostatnia,
    scores,
    pendingEvents: [...stan.pendingEvents, ...zakonczona.pendingEvents],
  };
}

/** Wrzuca żeton do kolumny i rozlicza planszę. Wspólne dla ruchu gracza i timeoutu. */
function wrzuc(s: CzworkiState, kolumna: number, now: number): CzworkiState {
  const pole = ladowanie(s.plansza, kolumna);
  if (pole === null) throw new GameError("Ta kolumna jest pełna.");

  const plansza = [...s.plansza];
  plansza[pole] = s.tura;
  const zZetonem: CzworkiState = { ...s, plansza, ostatni: pole };

  const linia = znajdzLinie(plansza, pole);
  if (linia) return rozstrzygnij(zZetonem, s.para[s.tura], linia);
  if (planszaPelna(plansza)) return rozstrzygnij(zZetonem, null, null);

  const tura: Znak = s.tura === 0 ? 1 : 0;
  return { ...zZetonem, tura, phaseEndsAt: termin(zZetonem, tura, now), pendingEvents: [] };
}

export const czworkiEngine: GameEngine<CzworkiState, CzworkiAction, CzworkiSettings> = {
  id: "czworki",
  actionSchema: czworkiActionSchema,

  init(ctx: InitContext<CzworkiSettings>): CzworkiState {
    const hostUid = Object.values(ctx.players).find((p) => p.isHost)?.uid ?? ctx.seatOrder[0];
    const playerUids = ctx.seatOrder.length ? ctx.seatOrder : Object.keys(ctx.players);
    const [czerwony, zolty, ...reszta] = playerUids;
    const scores: Record<string, number> = {};
    for (const u of playerUids) scores[u] = 0;

    const stan: CzworkiState = {
      settings: ctx.settings,
      hostUid,
      playerUids,
      botUidy: playerUids.filter((u) => ctx.players[u]?.bot === true),
      kolejka: reszta,
      para: [czerwony, zolty],
      plansza: pustaPlansza(),
      tura: 0,
      ostatni: null,
      phase: "gra",
      phaseEndsAt: null,
      round: 1,
      totalRounds: ctx.settings.rounds,
      ostatnia: null,
      scores,
      pendingEvents: [{ type: "start", text: "Runda 1", key: "czworki.event.round", params: { round: 1 } }],
    };
    return { ...stan, phaseEndsAt: termin(stan, 0, ctx.now) };
  },

  reduce(state, action, ctx) {
    if (action.type === "FINISH") {
      if (ctx.uid !== state.hostUid) throw new GameError("Tylko host.", 403);
      return zakoncz(state);
    }

    if (action.type === "PHASE_TIMEOUT") {
      if (state.phase !== "gra") return state;
      if (!wolneKolumny(state.plansza).length) return state;
      // Tędy chodzi bot (jego „termin" to MYSLENIE_MS) i nieobecny człowiek, któremu
      // padł telefon. Obaj grają tym samym mózgiem: losowa kolumna byłaby dla bota
      // żartem, a nieobecnemu potrafiłaby oddać rundę w trzech ruchach.
      const kolumna = wybierzKolumne(state.plansza, state.tura, ctx.rng);
      return wrzuc(state, kolumna, ctx.now);
    }

    if (action.type === "WRZUC") {
      if (state.phase !== "gra") throw new GameError("Nie ta faza.");
      if (state.para[state.tura] !== ctx.uid) throw new GameError("Nie twoja tura.", 403);
      return wrzuc(state, action.kolumna, ctx.now);
    }

    if (action.type === "NEXT") {
      if (state.phase !== "wynik") throw new GameError("Nie ta faza.");
      if (ctx.uid !== state.hostUid) throw new GameError("Tylko host.", 403);
      const { para, kolejka } = nastepnaPara(state, state.ostatnia?.zwyciezca ?? null);
      return nowaRunda({ ...state, kolejka }, para, ctx.now, state.round + 1);
    }

    return state;
  },

  publicView(state, players: PlayerMap) {
    const nick = (uid: string) => players[uid]?.nick ?? "?";
    return {
      phase: state.phase,
      round: state.round,
      totalRounds: state.totalRounds,
      plansza: state.plansza,
      tura: state.tura,
      para: state.para,
      turaUid: state.phase === "gra" ? state.para[state.tura] : null,
      ostatni: state.ostatni,
      kolejka: state.kolejka,
      ostatnia: state.ostatnia,
      // Plansza jest jawna z natury gry — nie ma tu czego ukrywać przed nikim.
      players: state.playerUids.map((uid) => ({
        uid,
        nick: nick(uid),
        avatar: players[uid]?.avatar ?? "",
        score: state.scores[uid] ?? 0,
        gra: state.para.includes(uid),
      })),
      canFinish: state.phase === "wynik",
    };
  },

  privateView(state, uid: string) {
    const i = state.para.indexOf(uid);
    return {
      gram: i >= 0,
      znak: i >= 0 ? (i as Znak) : null,
      mojaTura: state.phase === "gra" && state.para[state.tura] === uid,
    };
  },

  phase(state) {
    return { name: state.phase, endsAt: state.phaseEndsAt };
  },
  isFinished(state) {
    return state.phase === "koniec";
  },
  scores(state) {
    return state.scores;
  },
  drainEvents(state) {
    const e = state.pendingEvents ?? [];
    state.pendingEvents = [];
    return e;
  },
};
