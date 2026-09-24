import { z } from "zod";
import { GameError, type GameEngine, type InitContext, type WithEvents } from "@/games/types";
import type { PlayerMap } from "@/lib/types/room";
import type { KolkoSettings } from "./manifest";

// Kółko i krzyżyk. Gra bez żadnych tajemnic — plansza jest jawna dla wszystkich,
// więc publicView pokazuje po prostu cały stan. To jedyna taka gra w rejestrze
// i dobrze sprawdza, czy kontrakt nie wymusza sekretów tam, gdzie ich nie ma.
//
// Pary rotują: przy dwóch graczach to zwykłe kółko i krzyżyk, przy większej liczbie
// reszta pokoju czeka w kolejce i ogląda planszę na żywo.

type Znak = 0 | 1; // 0 = X (gracze[0]), 1 = O (gracze[1])
type Pole = Znak | null;
type Phase = "gra" | "wynik" | "koniec";

/** Osiem linii wygrywających — indeksy pól planszy 3×3. */
export const LINIE: readonly (readonly [number, number, number])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // wiersze
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // kolumny
  [0, 4, 8], [2, 4, 6], // przekątne
];

export interface KolkoState extends WithEvents {
  settings: KolkoSettings;
  hostUid: string;
  playerUids: string[];
  /** Czeka na swoją kolej, w kolejności miejsc. */
  kolejka: string[];
  /** Aktualna para: [uid grającego X, uid grającego O]. */
  para: [string, string];
  plansza: Pole[];
  /** Czyj ruch: indeks w `para`. */
  tura: Znak;
  phase: Phase;
  phaseEndsAt: number | null;
  round: number;
  totalRounds: number;
  /** Wynik ostatniej rundy — null w zwycięzcy oznacza remis. */
  ostatnia: { zwyciezca: string | null; linia: readonly number[] | null } | null;
  scores: Record<string, number>;
}

export const kolkoActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("MARK"), pole: z.number().int().min(0).max(8) }),
  z.object({ type: z.literal("NEXT") }),
  z.object({ type: z.literal("FINISH") }),
]);
export type KolkoAction = z.infer<typeof kolkoActionSchema>;

/** Zwraca linię wygrywającą dla znaku albo null. Czysta — używana też w testach. */
export function znajdzLinie(plansza: Pole[], znak: Znak): readonly number[] | null {
  for (const linia of LINIE) {
    if (linia.every((i) => plansza[i] === znak)) return linia;
  }
  return null;
}

const planszaPelna = (p: Pole[]) => p.every((x) => x !== null);
const wolnePola = (p: Pole[]) => p.map((x, i) => (x === null ? i : -1)).filter((i) => i >= 0);

function nowaRunda(s: KolkoState, para: [string, string], now: number, round: number): KolkoState {
  return {
    ...s,
    para,
    plansza: Array<Pole>(9).fill(null),
    tura: 0,
    phase: "gra",
    round,
    phaseEndsAt: s.settings.moveMs ? now + s.settings.moveMs : null,
    ostatnia: null,
    pendingEvents: [
      { type: "runda", text: `Runda ${round}`, key: "kolko.event.round", params: { round } },
    ],
  };
}

/**
 * Układa parę na następną rundę. „Wygrany zostaje" tylko wtedy, gdy ktoś wygrał —
 * po remisie obaj idą na koniec kolejki, inaczej dwoje równych graczy mogłoby
 * zablokować stolik na całą partię.
 */
function nastepnaPara(s: KolkoState, zwyciezca: string | null): { para: [string, string]; kolejka: string[] } {
  const zostaje = s.settings.winnerStays ? zwyciezca : null;
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

function zakoncz(s: KolkoState): KolkoState {
  if (s.phase === "koniec") return s; // FINISH musi być idempotentny (kontrakt rdzenia)
  return {
    ...s,
    phase: "koniec",
    phaseEndsAt: null,
    pendingEvents: [{ type: "koniec", text: "Koniec gry!", key: "kolko.event.gameOver", params: {} }],
  };
}

/** Zamyka rundę: przyznaje punkt, wystawia zdarzenie, przechodzi w fazę wyniku. */
function rozstrzygnij(s: KolkoState, zwyciezca: string | null, linia: readonly number[] | null): KolkoState {
  const scores = { ...s.scores };
  if (zwyciezca) scores[zwyciezca] = (scores[zwyciezca] ?? 0) + 1;

  const koniecPartii = s.totalRounds > 0 && s.round >= s.totalRounds;
  const stan: KolkoState = {
    ...s,
    scores,
    phase: "wynik",
    phaseEndsAt: null,
    ostatnia: { zwyciezca, linia },
    pendingEvents: [
      zwyciezca
        ? { type: "wynik", text: "Trzy w rzędzie!", key: "kolko.event.win", params: {}, meta: { uid: zwyciezca } }
        : { type: "wynik", text: "Remis.", key: "kolko.event.draw", params: {} },
    ],
  };
  if (!koniecPartii) return stan;

  // Zdarzenie rundy DOKLEJAMY do zdarzenia końca gry, zamiast pozwolić `zakoncz`
  // podmienić bufor. Inaczej ostatnia runda partii — ta, po której zapada wynik —
  // nigdy nie trafiałaby do feedu z informacją, kto ją wygrał.
  const zakonczona = zakoncz(stan);
  return {
    ...zakonczona,
    ostatnia: stan.ostatnia,
    scores,
    pendingEvents: [...stan.pendingEvents, ...zakonczona.pendingEvents],
  };
}

/** Stawia znak i rozlicza planszę. Wspólne dla ruchu gracza i dla timeoutu. */
function postaw(s: KolkoState, pole: number, now: number): KolkoState {
  const plansza = [...s.plansza];
  plansza[pole] = s.tura;

  const linia = znajdzLinie(plansza, s.tura);
  if (linia) return rozstrzygnij({ ...s, plansza }, s.para[s.tura], linia);
  if (planszaPelna(plansza)) return rozstrzygnij({ ...s, plansza }, null, null);

  return {
    ...s,
    plansza,
    tura: (s.tura === 0 ? 1 : 0) as Znak,
    phaseEndsAt: s.settings.moveMs ? now + s.settings.moveMs : null,
    pendingEvents: [],
  };
}

export const kolkoEngine: GameEngine<KolkoState, KolkoAction, KolkoSettings> = {
  id: "kolko",
  actionSchema: kolkoActionSchema,

  init(ctx: InitContext<KolkoSettings>): KolkoState {
    const hostUid = Object.values(ctx.players).find((p) => p.isHost)?.uid ?? ctx.seatOrder[0];
    const playerUids = ctx.seatOrder.length ? ctx.seatOrder : Object.keys(ctx.players);
    const [x, o, ...reszta] = playerUids;
    const scores: Record<string, number> = {};
    for (const u of playerUids) scores[u] = 0;

    return {
      settings: ctx.settings,
      hostUid,
      playerUids,
      kolejka: reszta,
      para: [x, o],
      plansza: Array<Pole>(9).fill(null),
      tura: 0,
      phase: "gra",
      phaseEndsAt: ctx.settings.moveMs ? ctx.now + ctx.settings.moveMs : null,
      round: 1,
      totalRounds: ctx.settings.rounds,
      ostatnia: null,
      scores,
      pendingEvents: [{ type: "start", text: "Runda 1", key: "kolko.event.round", params: { round: 1 } }],
    };
  },

  reduce(state, action, ctx) {
    if (action.type === "FINISH") {
      if (ctx.uid !== state.hostUid) throw new GameError("Tylko host.", 403);
      return zakoncz(state);
    }

    if (action.type === "PHASE_TIMEOUT") {
      if (state.phase !== "gra") return state;
      // Czas minął → stawiamy za gracza na losowym wolnym polu. Oddanie rundy walkowerem
      // byłoby surowsze, a to domówka: gra ma iść dalej, nie karać za odłożony telefon.
      const wolne = wolnePola(state.plansza);
      if (!wolne.length) return state;
      const pole = wolne[Math.floor(ctx.rng() * wolne.length)];
      return postaw(state, pole, ctx.now);
    }

    if (action.type === "MARK") {
      if (state.phase !== "gra") throw new GameError("Nie ta faza.");
      if (state.para[state.tura] !== ctx.uid) throw new GameError("Nie twoja tura.", 403);
      if (state.plansza[action.pole] !== null) throw new GameError("To pole jest zajęte.");
      return postaw(state, action.pole, ctx.now);
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
      znak: i >= 0 ? i : null,
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
