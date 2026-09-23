import { z } from "zod";
import { GameError, type GameEngine, type InitContext, type WithEvents } from "@/games/types";
import type { PlayerMap } from "@/lib/types/room";
import { wybierzStrzal } from "./bot";
import type { StatkiSettings } from "./manifest";
import {
  FLOTY,
  flotaStartowa,
  obwodka,
  polaFloty,
  polaStatku,
  polaZatopionych,
  poprawnaFlota,
  zatopiony,
  type Statek,
} from "./plansza";

// Statki. PIERWSZA gra w rejestrze z trwałą, ukrytą planszą gracza.
//
// Impostor i Mafia chowają rolę, Państwa-miasta odpowiedzi jednej rundy — tutaj przez
// całą partię żyje osobny, prywatny układ floty, który przeciwnik ODKRYWA strzałami.
// Dlatego jedna rzecz jest ważniejsza niż wszystko inne w tym pliku:
//
//   `publicView` NIE MOŻE wystawić `floty` ani niczego, z czego da się je odtworzyć.
//
// Wystawiamy wyłącznie SKUTKI oddanych strzałów: trafienia, pudła i pola zatopionych
// statków. Reszta floty zostaje w `secret/state` (reguła: `allow read: if false`)
// i wychodzi tylko przez `privateView` do właściciela. Pilnuje tego `tajnosc.test.ts`.

type Faza = "ustawianie" | "strzal" | "wynik" | "koniec";

export interface StatkiState extends WithEvents {
  settings: StatkiSettings;
  hostUid: string;
  playerUids: string[];
  botUidy: string[];
  kolejka: string[];
  /** Aktualna para: [uid pierwszego strzelającego, uid drugiego]. */
  para: [string, string];
  bok: number;
  /** TAJNE. Flota każdego z pary, po uid. */
  floty: Record<string, Statek[]>;
  /** Kto zatwierdził ustawienie floty. */
  gotowi: string[];
  /** Pola, w które strzelał dany gracz — czyli na planszy PRZECIWNIKA. */
  strzaly: Record<string, number[]>;
  tura: 0 | 1;
  ostatni: { uid: string; pole: number; trafiony: boolean; zatopiony: boolean } | null;
  phase: Faza;
  phaseEndsAt: number | null;
  round: number;
  totalRounds: number;
  ostatnia: { zwyciezca: string | null } | null;
  scores: Record<string, number>;
}

export const statkiActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("LOSUJ") }),
  z.object({
    type: z.literal("PRZESTAW"),
    statek: z.number().int().min(0).max(15),
    pole: z.number().int().min(0).max(99),
    poziomo: z.boolean(),
  }),
  z.object({ type: z.literal("GOTOWY") }),
  z.object({ type: z.literal("STRZEL"), pole: z.number().int().min(0).max(99) }),
  z.object({ type: z.literal("NEXT") }),
  z.object({ type: z.literal("FINISH") }),
]);
export type StatkiAction = z.infer<typeof statkiActionSchema>;

/** Ile „myśli" bot, zanim strzeli. Zarazem jego termin — własnego napędu nie ma. */
const MYSLENIE_MS = 1300;

const przeciwnikUid = (s: StatkiState, uid: string) => (s.para[0] === uid ? s.para[1] : s.para[0]);
const botGra = (s: StatkiState, uid: string) => s.botUidy.includes(uid);

/** Termin dla gracza, który WŁAŚNIE PRZEJMUJE ruch — nie dla kończącego. */
function terminStrzalu(s: StatkiState, tura: 0 | 1, now: number): number | null {
  if (botGra(s, s.para[tura])) return now + MYSLENIE_MS;
  return s.settings.strzalMs ? now + s.settings.strzalMs : null;
}

function nowaPartia(s: StatkiState, para: [string, string], now: number, round: number, rng: () => number): StatkiState {
  const floty: Record<string, Statek[]> = {
    [para[0]]: flotaStartowa(s.bok, rng),
    [para[1]]: flotaStartowa(s.bok, rng),
  };
  return {
    ...s,
    para,
    floty,
    // Bot nigdy nie wyśle GOTOWY, więc jest gotowy od razu — inaczej faza ustawiania
    // czekałaby na niego do wygaśnięcia terminu przy każdej partii.
    gotowi: para.filter((u) => botGra(s, u)),
    strzaly: { [para[0]]: [], [para[1]]: [] },
    tura: 0,
    ostatni: null,
    phase: "ustawianie",
    // Faza czeka na akcję konkretnych ludzi, więc MUSI mieć termin (CLAUDE.md).
    phaseEndsAt: now + s.settings.ustawianieMs,
    round,
    ostatnia: null,
    pendingEvents: [{ type: "runda", text: `Partia ${round}`, key: "statki.event.round", params: { round } }],
  };
}

function zakoncz(s: StatkiState): StatkiState {
  if (s.phase === "koniec") return s; // FINISH musi być idempotentny (kontrakt rdzenia)
  return {
    ...s,
    phase: "koniec",
    phaseEndsAt: null,
    pendingEvents: [{ type: "koniec", text: "Koniec gry!", key: "statki.event.gameOver", params: {} }],
  };
}

/** Ile statków gracza jest zatopionych. */
function ileZatopionych(s: StatkiState, uid: string): number {
  const trafione = new Set(s.strzaly[przeciwnikUid(s, uid)] ?? []);
  return (s.floty[uid] ?? []).filter((st) => zatopiony(st, s.bok, trafione)).length;
}

function rozstrzygnij(s: StatkiState, zwyciezca: string): StatkiState {
  const scores = { ...s.scores };
  scores[zwyciezca] = (scores[zwyciezca] ?? 0) + 1;

  // Sucha wygrana: przeciwnik nie zatopił ani jednego statku. Rdzeń nie wie, co to
  // znaczy — dopisuje do wyróżnień wszystko, co silnik sam oznaczy `meta.rekord`.
  const bezStrat = ileZatopionych(s, zwyciezca) === 0;
  const koniecPartii = s.totalRounds > 0 && s.round >= s.totalRounds;

  const stan: StatkiState = {
    ...s,
    scores,
    phase: "wynik",
    phaseEndsAt: null,
    ostatnia: { zwyciezca },
    pendingEvents: [
      { type: "wynik", text: "Cała flota zatopiona!", key: "statki.event.win", params: {}, meta: { uid: zwyciezca } },
      ...(bezStrat
        ? [{
            type: "rekord",
            text: "Wygrana bez straty statku!",
            key: "statki.event.dry",
            params: {},
            meta: { uid: zwyciezca, rekord: true },
          }]
        : []),
    ],
  };
  if (!koniecPartii) return stan;

  // Zdarzenia rundy DOKLEJAMY do zdarzenia końca gry, zamiast pozwolić `zakoncz`
  // podmienić bufor. Przy domyślnym ustawieniu (jedna partia) wygrana ZAWSZE wypada
  // w ostatniej rundzie, więc podmiana kasowałaby i „Cała flota zatopiona!", i rekord
  // za suchą wygraną — czyli akurat te zdarzenia, dla których rekordy istnieją.
  const zakonczona = zakoncz(stan);
  return {
    ...zakonczona,
    ostatnia: stan.ostatnia,
    scores,
    pendingEvents: [...stan.pendingEvents, ...zakonczona.pendingEvents],
  };
}

/** Przejście z ustawiania do strzelania. Wspólne dla „obaj gotowi" i dla terminu. */
function zacznijStrzelanie(s: StatkiState, now: number): StatkiState {
  const stan: StatkiState = {
    ...s,
    phase: "strzal",
    gotowi: [...s.para],
    tura: 0,
    pendingEvents: [{ type: "faza", text: "Ognia!", key: "statki.event.fire", params: {} }],
  };
  return { ...stan, phaseEndsAt: terminStrzalu(stan, 0, now) };
}

/** Oddaje strzał w pole na planszy przeciwnika. Wspólne dla gracza i dla terminu. */
function strzel(s: StatkiState, uid: string, pole: number, now: number): StatkiState {
  if (pole < 0 || pole >= s.bok * s.bok) throw new GameError("Pole poza planszą.");
  const oddane = new Set(s.strzaly[uid] ?? []);
  if (oddane.has(pole)) throw new GameError("Tam już strzelałeś.");

  const cel = przeciwnikUid(s, uid);
  const flota = s.floty[cel] ?? [];
  const trafiony = polaFloty(flota, s.bok).includes(pole);
  oddane.add(pole);

  // Zatopiony statek odsłania całą swoją obwódkę: statki nie mogą się stykać, więc
  // to pewna woda. Bez tego obie strony marnowałyby strzały na pola znane z reguł gry.
  let poszedlNaDno = false;
  if (trafiony) {
    const statek = flota.find((st) => (polaStatku(st, s.bok) ?? []).includes(pole));
    if (statek && zatopiony(statek, s.bok, oddane)) {
      poszedlNaDno = true;
      for (const p of obwodka(polaStatku(statek, s.bok) ?? [], s.bok)) oddane.add(p);
    }
  }

  const strzaly = { ...s.strzaly, [uid]: [...oddane].sort((a, b) => a - b) };
  const zZmiana: StatkiState = {
    ...s,
    strzaly,
    ostatni: { uid, pole, trafiony, zatopiony: poszedlNaDno },
    pendingEvents: [
      poszedlNaDno
        ? { type: "strzal", text: "Trafiony, zatopiony!", key: "statki.event.sunk", params: {}, meta: { uid } }
        : trafiony
          ? { type: "strzal", text: "Trafiony!", key: "statki.event.hit", params: {}, meta: { uid } }
          : { type: "strzal", text: "Pudło.", key: "statki.event.miss", params: {}, meta: { uid } },
    ],
  };

  const wszystkie = flota.every((st) => zatopiony(st, s.bok, new Set(strzaly[uid])));
  if (flota.length > 0 && wszystkie) return rozstrzygnij(zZmiana, uid);

  // Trafienie daje kolejny strzał (opcja). Tura zostaje, ale termin liczy się od nowa —
  // odziedziczony byłby już w połowie zużyty.
  const tura: 0 | 1 = trafiony && s.settings.dodatkowyStrzal ? s.tura : s.tura === 0 ? 1 : 0;
  return { ...zZmiana, tura, phaseEndsAt: terminStrzalu(zZmiana, tura, now) };
}

/**
 * Układa parę na następną partię. Bot nie zostaje przy stole, gdy ktoś czeka —
 * ta sama zasada co w Czwórkach i z tego samego powodu.
 */
function nastepnaPara(s: StatkiState, zwyciezca: string | null): { para: [string, string]; kolejka: string[] } {
  const botBlokuje = zwyciezca !== null && botGra(s, zwyciezca) && s.kolejka.length > 0;
  const zostaje = s.settings.winnerStays && !botBlokuje ? zwyciezca : null;
  const schodzi = s.para.filter((u) => u !== zostaje);
  const kolejka = [...s.kolejka, ...schodzi];

  if (zostaje) {
    const wyzwanie = kolejka.shift();
    if (!wyzwanie) return { para: s.para, kolejka: [] };
    return { para: [zostaje, wyzwanie], kolejka };
  }
  const a = kolejka.shift();
  const b = kolejka.shift();
  if (!a || !b) return { para: s.para, kolejka: s.kolejka };
  return { para: [a, b], kolejka };
}

/** Publiczny obraz JEDNEJ planszy: wyłącznie skutki strzałów, nigdy sama flota. */
function planszaPubliczna(s: StatkiState, uid: string) {
  const flota = s.floty[uid] ?? [];
  const oddane = s.strzaly[przeciwnikUid(s, uid)] ?? [];
  const pola = new Set(polaFloty(flota, s.bok));
  const zatopione = polaZatopionych(flota, s.bok, new Set(oddane));
  return {
    trafienia: oddane.filter((p) => pola.has(p)),
    pudla: oddane.filter((p) => !pola.has(p)),
    zatopione,
    statkow: flota.length,
    zatopionych: flota.filter((st) => zatopiony(st, s.bok, new Set(oddane))).length,
  };
}

export const statkiEngine: GameEngine<StatkiState, StatkiAction, StatkiSettings> = {
  id: "statki",
  actionSchema: statkiActionSchema,

  init(ctx: InitContext<StatkiSettings>): StatkiState {
    const hostUid = Object.values(ctx.players).find((p) => p.isHost)?.uid ?? ctx.seatOrder[0];
    const playerUids = ctx.seatOrder.length ? ctx.seatOrder : Object.keys(ctx.players);
    const [a, b, ...reszta] = playerUids;
    const scores: Record<string, number> = {};
    for (const u of playerUids) scores[u] = 0;

    const szkielet: StatkiState = {
      settings: ctx.settings,
      hostUid,
      playerUids,
      botUidy: playerUids.filter((u) => ctx.players[u]?.bot === true),
      kolejka: reszta,
      para: [a, b],
      bok: ctx.settings.bok,
      floty: {},
      gotowi: [],
      strzaly: {},
      tura: 0,
      ostatni: null,
      phase: "ustawianie",
      phaseEndsAt: null,
      round: 1,
      totalRounds: ctx.settings.rounds,
      ostatnia: null,
      scores,
      pendingEvents: [],
    };
    return nowaPartia(szkielet, [a, b], ctx.now, 1, ctx.rng);
  },

  reduce(state, action, ctx) {
    if (action.type === "FINISH") {
      if (ctx.uid !== state.hostUid) throw new GameError("Tylko host.", 403);
      return zakoncz(state);
    }

    if (action.type === "PHASE_TIMEOUT") {
      // Termin ustawiania: kto nie zdążył, gra tym, co ma. Nikt nie wypada z partii —
      // flota jest wylosowana od pierwszej sekundy, więc zawsze jest czym grać.
      if (state.phase === "ustawianie") return zacznijStrzelanie(state, ctx.now);
      if (state.phase !== "strzal") return state;

      // Tędy chodzi bot i nieobecny człowiek. Obaj strzelają tym samym mózgiem:
      // losowe pole potrafiłoby oddać partię, a bot byłby atrapą.
      const uid = state.para[state.tura];
      const cel = przeciwnikUid(state, uid);
      const widok = planszaPubliczna(state, cel);
      const pole = wybierzStrzal(
        state.bok,
        state.strzaly[uid] ?? [],
        widok.trafienia,
        widok.zatopione,
        ctx.rng,
      );
      if (pole === null) return state;
      return strzel(state, uid, pole, ctx.now);
    }

    if (action.type === "LOSUJ" || action.type === "PRZESTAW" || action.type === "GOTOWY") {
      if (state.phase !== "ustawianie") throw new GameError("Nie ta faza.");
      if (!state.para.includes(ctx.uid)) throw new GameError("Nie grasz w tej partii.", 403);
      if (state.gotowi.includes(ctx.uid)) throw new GameError("Flota już zatwierdzona.");

      if (action.type === "GOTOWY") {
        const gotowi = [...state.gotowi, ctx.uid];
        const stan = { ...state, gotowi, pendingEvents: [] };
        return state.para.every((u) => gotowi.includes(u)) ? zacznijStrzelanie(stan, ctx.now) : stan;
      }

      if (action.type === "LOSUJ") {
        return {
          ...state,
          floty: { ...state.floty, [ctx.uid]: flotaStartowa(state.bok, ctx.rng) },
          pendingEvents: [],
        };
      }

      const moja = state.floty[ctx.uid] ?? [];
      const statek = moja[action.statek];
      if (!statek) throw new GameError("Nie ma takiego statku.");
      const nowa = moja.map((s, i) =>
        i === action.statek ? { dlugosc: s.dlugosc, pole: action.pole, poziomo: action.poziomo } : s,
      );
      // Walidacja po stronie SERWERA, nie tylko w widoku: klient może wysłać cokolwiek,
      // a flota nachodząca na siebie zepsułaby całą partię po cichu.
      if (!poprawnaFlota(nowa, state.bok)) throw new GameError("Statek tam nie stanie.");
      return { ...state, floty: { ...state.floty, [ctx.uid]: nowa }, pendingEvents: [] };
    }

    if (action.type === "STRZEL") {
      if (state.phase !== "strzal") throw new GameError("Nie ta faza.");
      if (state.para[state.tura] !== ctx.uid) throw new GameError("Nie twoja tura.", 403);
      return strzel(state, ctx.uid, action.pole, ctx.now);
    }

    if (action.type === "NEXT") {
      if (state.phase !== "wynik") throw new GameError("Nie ta faza.");
      if (ctx.uid !== state.hostUid) throw new GameError("Tylko host.", 403);
      const { para, kolejka } = nastepnaPara(state, state.ostatnia?.zwyciezca ?? null);
      return nowaPartia({ ...state, kolejka }, para, ctx.now, state.round + 1, ctx.rng);
    }

    return state;
  },

  publicView(state, players: PlayerMap) {
    const nick = (uid: string) => players[uid]?.nick ?? "?";
    return {
      phase: state.phase,
      round: state.round,
      totalRounds: state.totalRounds,
      bok: state.bok,
      // Skład floty jest jawny z natury gry — obie strony wiedzą, czego szukają.
      // Pole nazywa się `sklad`, a nie `flota`, ŚWIADOMIE: `flota` to w tym silniku
      // tajne ustawienie statków i dwa pola o tej samej nazwie prosiłyby się o pomyłkę
      // przy dokładaniu czegokolwiek do widoku.
      sklad: [...(FLOTY[state.bok] ?? FLOTY[8])],
      para: state.para,
      tura: state.tura,
      turaUid: state.phase === "strzal" ? state.para[state.tura] : null,
      gotowi: state.gotowi,
      ostatni: state.ostatni,
      dodatkowyStrzal: state.settings.dodatkowyStrzal,
      // Mapa po uid, nie tablica obiektów z tablicami w środku: Firestore nie przyjmuje
      // tablicy w tablicy, a mapa z tablicami w wartościach jest w porządku (CLAUDE.md).
      plansze: Object.fromEntries(state.para.map((uid) => [uid, planszaPubliczna(state, uid)])),
      kolejka: state.kolejka,
      ostatnia: state.ostatnia,
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
    if (!state.para.includes(uid)) return { gram: false };
    return {
      gram: true,
      // JEDYNE miejsce, w którym flota opuszcza tajny stan — i tylko do właściciela.
      flota: state.floty[uid] ?? [],
      gotowy: state.gotowi.includes(uid),
      mojaTura: state.phase === "strzal" && state.para[state.tura] === uid,
      mojeStrzaly: state.strzaly[uid] ?? [],
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
