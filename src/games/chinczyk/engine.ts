import { z } from "zod";
import { GameError, type GameEngine, type InitContext, type WithEvents } from "@/games/types";
import type { PlayerMap } from "@/lib/types/room";
import type { ChinczykSettings } from "./manifest";
import { wybierzRuch } from "./bot";

// Chińczyk (Ludo). Gra bez tajemnic: pozycje pionków, rzuty i kolejka są jawne dla
// wszystkich, więc publicView pokazuje po prostu cały stan i `secret/state` nie niesie
// tu nic ponad ziarno PRNG. Druga taka gra po Kółku i krzyżyku.
//
// Wariant zasad przepisany z foony.com/pl/games/ludo, bez odstępstw.

/** Kolory w kolejności ruchu wokół planszy. Indeks koloru = indeks slotu. */
export const KOLORY = ["czerwony", "zielony", "zolty", "niebieski"] as const;
export type Kolor = (typeof KOLORY)[number];

/** Długość trasy wokół planszy. */
export const POLA = 52;
/** Pole, na którym pionek danego koloru wchodzi na trasę. */
export const START = [0, 13, 26, 39] as const;

/**
 * Postęp pionka mierzymy WZGLĘDEM jego własnego startu, nie w polach bezwzględnych.
 * Dzięki temu warunek wejścia do domu jest ten sam dla każdego koloru, a pole
 * bezwzględne wyliczamy dopiero przy sprawdzaniu zbić.
 */
export const W_BAZIE = -1;
/** 51..55 to pięć pól korytarza domowego; 56 to środek. */
export const DOM_OD = 51;
/** Środek planszy. Trzeba trafić DOKŁADNIE, nadmiar nie przechodzi. */
export const META = 56;

/**
 * Osiem pól bezpiecznych: cztery startowe i cztery „globusy" osiem pól za każdym startem.
 * Pionek stojący na takim polu nie może zostać zbity, więc dwa kolory mogą tam koegzystować.
 */
export const BEZPIECZNE: ReadonlySet<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** Ile pionków ma każdy kolor. */
export const PIONKOW = 4;

/**
 * Pozycje pionków trzymamy w JEDNEJ płaskiej tablicy 16 pól, nie w tablicy tablic.
 *
 * Powód jest twardy: Firestore NIE przyjmuje tablicy wewnątrz tablicy. `number[][]`
 * w `publicState` kończy się błędem 500 „Property publicState contains an invalid
 * nested entity" dopiero przy starcie partii, więc typy tego nie złapią.
 */
export function idxPionka(kolor: number, pionek: number): number {
  return kolor * PIONKOW + pionek;
}

/** Cztery pozycje jednego koloru, do odczytu. */
export function pionkiKoloru(pionki: readonly number[], kolor: number): number[] {
  return pionki.slice(kolor * PIONKOW, kolor * PIONKOW + PIONKOW);
}

/** Trzecia szóstka pod rząd przepada i kończy turę. */
const LIMIT_SZOSTEK = 3;

/**
 * Ile „myśli" bot, zanim wykona ruch.
 *
 * Bot nie ma przeglądarki, więc nie klika — jego turę wykonuje ten sam mechanizm,
 * który gra za nieobecnego człowieka: termin fazy mija, host ponagla `/tick`, silnik
 * dostaje PHASE_TIMEOUT. Termin jest zatem jednocześnie pauzą na przemyślenie: krócej
 * i bot gra szybciej, niż da się to zobaczyć (kostka nie zdąży się doturlać).
 */
const MYSLENIE_MS = 1200;

/**
 * „wynik" to ekran po wygranej, „koniec" to stan po hostowym FINISH. To NIE jest ta sama
 * faza: kontrakt rdzenia (`finish.test.ts`) wymaga, żeby `canFinish` gasło po zakończeniu,
 * a podium i rekordy zapisuje dopiero przejście do „koniec".
 */
type Faza = "kolory" | "rzut" | "ruch" | "wynik" | "koniec";

export interface ChinczykState extends WithEvents {
  settings: ChinczykSettings;
  hostUid: string;
  playerUids: string[];
  /** Indeks = kolor, wartość = uid gracza albo null dla wolnego miejsca. */
  sloty: (string | null)[];
  /** Kolory, które wolno wybrać w tej partii. Przy dwóch graczach tylko para naprzeciw siebie. */
  doWyboru: number[];
  /** Płaska tablica 16 pozycji: `idxPionka(kolor, pionek)` → postęp (W_BAZIE, 0..56). */
  pionki: number[];
  /** Indeks koloru, którego jest tura. */
  tura: number;
  kostka: number | null;
  /** Ile szóstek pod rząd w bieżącej turze. */
  szostki: number;
  /** Ile razy każdy kolor wrócił do bazy. Potrzebne tylko do wyróżnienia „bez strat". */
  zbicia: number[];
  /** uid-y graczy sterowanych przez komputer. Kolory są im przydzielane jak ludziom. */
  botUidy: string[];
  phase: Faza;
  phaseEndsAt: number | null;
  zwyciezca: number | null;
  scores: Record<string, number>;
}

export const chinczykActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("WYBIERZ"), kolor: z.number().int().min(0).max(3) }),
  z.object({ type: z.literal("RZUC") }),
  z.object({ type: z.literal("RUSZ"), pionek: z.number().int().min(0).max(3) }),
  z.object({ type: z.literal("FINISH") }),
]);
export type ChinczykAction = z.infer<typeof chinczykActionSchema>;

/** Pole bezwzględne na trasie albo null, gdy pionek jest w bazie, korytarzu lub na mecie. */
export function poleBezwzgledne(kolor: number, postep: number): number | null {
  if (postep === W_BAZIE || postep >= DOM_OD) return null;
  return (START[kolor] + postep) % POLA;
}

/**
 * Którymi pionkami wolno się ruszyć przy takim rzucie.
 *
 * Trzy warunki: z bazy wychodzi się wyłącznie szóstką, na metę trzeba trafić dokładnie,
 * a pionek już w środku nie rusza się wcale. Własne pionki mogą stać na jednym polu —
 * foony nie zna blokad, więc i my ich nie wprowadzamy.
 */
export function legalneRuchy(pionki: number[], oczka: number): number[] {
  const wynik: number[] = [];
  for (let i = 0; i < pionki.length; i++) {
    const p = pionki[i];
    if (p === META) continue;
    if (p === W_BAZIE) {
      if (oczka === 6) wynik.push(i);
      continue;
    }
    if (p + oczka <= META) wynik.push(i);
  }
  return wynik;
}

/** Zajęte sloty w kolejności kolorów. */
function aktywne(s: ChinczykState): number[] {
  return s.sloty.map((u, i) => (u ? i : -1)).filter((i) => i >= 0);
}

function nastepnaTura(s: ChinczykState): number {
  const kolejka = aktywne(s);
  const gdzie = kolejka.indexOf(s.tura);
  return kolejka[(gdzie + 1) % kolejka.length];
}

/** Czy kolorem gra bot. */
function botGra(s: ChinczykState, kolor: number): boolean {
  const uid = s.sloty[kolor];
  return uid !== null && s.botUidy.includes(uid);
}

/**
 * Termin bieżącej tury. Bot dostaje swój krótki zawsze, także przy ustawieniu „bez
 * limitu" — inaczej jego tura nie skończyłaby się nigdy i partia stanęłaby na dobre.
 */
function terminTury(s: ChinczykState, now: number): number | null {
  if (botGra(s, s.tura)) return now + MYSLENIE_MS;
  return s.settings.turaMs > 0 ? now + s.settings.turaMs : null;
}

/** Oddaje ruch następnemu kolorowi i zeruje licznik szóstek. */
function oddajTure(s: ChinczykState, now: number): ChinczykState {
  // Termin liczymy dla NASTĘPNEGO koloru, nie dla tego, który właśnie skończył —
  // inaczej człowiek po bocie dostawałby 1,2 s, a bot po człowieku pełny limit.
  const po = { ...s, tura: nastepnaTura(s) };
  return {
    ...po,
    kostka: null,
    szostki: 0,
    phase: "rzut",
    phaseEndsAt: terminTury(po, now),
  };
}

/** Ten sam gracz rzuca ponownie (po szóstce). */
function rzucaPonownie(s: ChinczykState, now: number): ChinczykState {
  return { ...s, kostka: null, phase: "rzut", phaseEndsAt: terminTury(s, now) };
}

function nickOf(s: ChinczykState, kolor: number, players?: PlayerMap): string {
  const uid = s.sloty[kolor];
  return (uid && players?.[uid]?.nick) || KOLORY[kolor];
}

/** Rozdaje wolne kolory graczom, którzy nie zdążyli wybrać, i rusza z grą. */
function rozdajResztę(s: ChinczykState, now: number): ChinczykState {
  const sloty = [...s.sloty];
  const bezKoloru = s.playerUids.filter((u) => !sloty.includes(u));
  for (const uid of bezKoloru) {
    const wolny = s.doWyboru.find((k) => sloty[k] === null);
    if (wolny === undefined) break;
    sloty[wolny] = uid;
  }
  return zacznijGre({ ...s, sloty }, now);
}

function zacznijGre(s: ChinczykState, now: number): ChinczykState {
  const kolejka = s.sloty.map((u, i) => (u ? i : -1)).filter((i) => i >= 0);
  const po = { ...s, tura: kolejka[0] };
  return {
    ...po,
    kostka: null,
    szostki: 0,
    phase: "rzut",
    phaseEndsAt: terminTury(po, now),
    pendingEvents: [{ type: "start", text: "Kolory rozdane. Zaczynamy!", key: "chinczyk.event.start" }],
  };
}

/** Wykonuje rzut: aktualizuje kostkę, licznik szóstek i fazę. */
function rzut(s: ChinczykState, oczka: number, now: number): ChinczykState {
  const szostki = oczka === 6 ? s.szostki + 1 : 0;

  // Trzecia szóstka pod rząd przepada razem z turą (zasada foony).
  if (szostki >= LIMIT_SZOSTEK) {
    return {
      ...oddajTure({ ...s, szostki }, now),
      pendingEvents: [
        { type: "szostki", text: `${KOLORY[s.tura]}: trzy szóstki, tura przepada`, key: "chinczyk.event.threeSixes" },
      ],
    };
  }

  const ruchy = legalneRuchy(pionkiKoloru(s.pionki, s.tura), oczka);
  if (ruchy.length === 0) {
    // Brak ruchu kończy turę także po szóstce. Inaczej gracz, który nie ma czym się
    // ruszyć, rzucałby w kółko i partia stałaby w miejscu.
    // Wynik ZOSTAJE na kostce, choć tura przechodzi dalej. Bez tego naciśnięcie „rzuć"
    // przy wszystkich pionkach w bazie wyglądało jak brak reakcji: kostka gasła w tej
    // samej klatce, w której się zapaliła, i gracz nie wiedział, co wyrzucił.
    return {
      ...oddajTure({ ...s, szostki }, now),
      kostka: oczka,
      pendingEvents: [
        { type: "pas", text: `${KOLORY[s.tura]}: brak ruchu przy ${oczka}`, key: "chinczyk.event.noMove", params: { oczka } },
      ],
    };
  }

  return { ...s, kostka: oczka, szostki, phase: "ruch", phaseEndsAt: terminTury(s, now), pendingEvents: [] };
}

/** Przesuwa pionek, zbija co trzeba i rozstrzyga, czy partia się kończy. */
function ruch(s: ChinczykState, pionek: number, now: number): ChinczykState {
  const oczka = s.kostka!;
  const kolor = s.tura;
  const pionki = [...s.pionki];
  const teraz = pionki[idxPionka(kolor, pionek)];
  const cel = teraz === W_BAZIE ? 0 : teraz + oczka;
  pionki[idxPionka(kolor, pionek)] = cel;

  const zdarzenia = [];
  const zbicia = [...s.zbicia];
  const pole = poleBezwzgledne(kolor, cel);
  if (pole !== null && !BEZPIECZNE.has(pole)) {
    for (let k = 0; k < s.sloty.length; k++) {
      if (k === kolor || !s.sloty[k]) continue;
      for (let j = 0; j < PIONKOW; j++) {
        if (poleBezwzgledne(k, pionki[idxPionka(k, j)]) === pole) {
          pionki[idxPionka(k, j)] = W_BAZIE;
          zbicia[k] += 1;
          zdarzenia.push({
            type: "zbicie",
            text: `${KOLORY[kolor]} zbija ${KOLORY[k]}`,
            key: "chinczyk.event.capture",
            params: { kto: KOLORY[kolor], kogo: KOLORY[k] },
          });
        }
      }
    }
  }

  const po = { ...s, pionki, zbicia };

  if (pionkiKoloru(pionki, kolor).every((p) => p === META)) {
    const scores: Record<string, number> = {};
    for (const uid of s.playerUids) scores[uid] = 0;
    const uid = s.sloty[kolor];
    if (uid) scores[uid] = 1;
    return {
      ...po,
      phase: "wynik",
      phaseEndsAt: null,
      zwyciezca: kolor,
      scores,
      pendingEvents: [
        ...zdarzenia,
        { type: "koniec", text: `${KOLORY[kolor]} wygrywa!`, key: "chinczyk.event.win" },
        // Wyróżnienie tylko za coś rzadkiego. Sama wygrana nie jest wyczynem: partię
        // wygrywa ktoś ZAWSZE, a licznik zwycięstw i tak liczy się z wyników silnika.
        // Przejście czterema pionkami bez ani jednego powrotu do bazy jest już wyczynem.
        ...(uid && zbicia[kolor] === 0
          ? [{ type: "rekord", text: "Wygrał chińczyka bez straty pionka", key: "feat.chinczyk.bezStrat",
              meta: { uid, rekord: true } }]
          : []),
      ],
    };
  }

  // Szóstka daje dodatkowy rzut, o ile nie była trzecia z rzędu.
  const dalej = oczka === 6 && s.szostki < LIMIT_SZOSTEK ? rzucaPonownie(po, now) : oddajTure(po, now);
  return { ...dalej, pendingEvents: zdarzenia };
}

export const chinczykEngine: GameEngine<ChinczykState, ChinczykAction, ChinczykSettings> = {
  id: "chinczyk",
  actionSchema: chinczykActionSchema,

  init(ctx: InitContext<ChinczykSettings>): ChinczykState {
    const hostUid = Object.values(ctx.players).find((p) => p.isHost)?.uid ?? ctx.seatOrder[0];
    const playerUids = ctx.seatOrder.length ? ctx.seatOrder : Object.keys(ctx.players);
    // Przy dwóch uczestnikach sadzamy ich NAPRZECIW siebie: dystans do domu jest wtedy
    // taki sam dla obu. Przy trzech i czterech symetrii i tak nie ma, więc wybór jest wolny.
    const doWyboru = playerUids.length === 2 ? [0, 2] : [0, 1, 2, 3];
    return {
      settings: ctx.settings,
      hostUid,
      playerUids,
      sloty: [null, null, null, null],
      doWyboru,
      pionki: Array<number>(4 * PIONKOW).fill(W_BAZIE),
      botUidy: playerUids.filter((u) => ctx.players[u]?.bot === true),
      tura: doWyboru[0],
      kostka: null,
      szostki: 0,
      zbicia: [0, 0, 0, 0],
      phase: "kolory",
      phaseEndsAt: ctx.now + ctx.settings.wyborMs,
      zwyciezca: null,
      scores: Object.fromEntries(playerUids.map((u) => [u, 0])),
      pendingEvents: [{ type: "kolory", text: "Wybierzcie kolory", key: "chinczyk.event.pickColours" }],
    };
  },

  reduce(state, action, ctx): ChinczykState {
    if (action.type === "PHASE_TIMEOUT") {
      if (state.phase === "kolory") return rozdajResztę(state, ctx.now);
      // Termin tury nie oddaje ruchu za darmo, tylko GRA za gracza. Tą samą drogą
      // chodzi bot (jego „termin" to 1,2 s) i nieobecny człowiek, któremu padł telefon.
      // Pominięcie tury byłoby dla nieobecnego łagodniejsze niż dla reszty, która czeka.
      if (state.phase === "rzut") return rzut(state, 1 + Math.floor(ctx.rng() * 6), ctx.now);
      if (state.phase === "ruch") {
        // Ruch wybiera mózg bota — także dla nieobecnego człowieka. Granie za kogoś
        // byle jak jest gorsze niż granie za niego rozsądnie: pionki i tak są jego.
        const pionek = wybierzRuch(state.pionki, state.sloty, state.tura, state.kostka!);
        return pionek === null ? oddajTure(state, ctx.now) : ruch(state, pionek, ctx.now);
      }
      return state;
    }

    if (action.type === "FINISH") {
      if (ctx.uid !== state.hostUid) throw new GameError("Tylko host może zakończyć grę.", 403);
      if (state.phase === "koniec") return state; // FINISH musi być idempotentny (kontrakt rdzenia)
      return { ...state, phase: "koniec", phaseEndsAt: null, pendingEvents: [] };
    }

    if (action.type === "WYBIERZ") {
      if (state.phase !== "kolory") throw new GameError("Kolory są już rozdane.");
      if (!state.playerUids.includes(ctx.uid)) throw new GameError("Nie jesteś w tej grze.", 403);
      if (!state.doWyboru.includes(action.kolor)) throw new GameError("Ten kolor nie gra w tej partii.");
      if (state.sloty[action.kolor]) throw new GameError("Ten kolor jest już zajęty.");

      const sloty = state.sloty.map((u) => (u === ctx.uid ? null : u)); // zmiana zdania
      sloty[action.kolor] = ctx.uid;
      const po = { ...state, sloty, pendingEvents: [] };

      // Czekamy wyłącznie na LUDZI. Bot niczego nie klika, więc gdyby wliczał się do
      // tej sumy, partia z botem stałaby w wyborze kolorów aż do wygaśnięcia terminu.
      // Kolory botów rozdaje `rozdajResztę` — ta sama droga co dla nieobecnych.
      const ludzie = state.playerUids.filter((u) => !state.botUidy.includes(u));
      const wybraliLudzie = ludzie.filter((u) => sloty.includes(u)).length;
      return wybraliLudzie >= ludzie.length ? rozdajResztę(po, ctx.now) : po;
    }

    if (action.type === "RZUC") {
      if (state.phase !== "rzut") throw new GameError("Nie ta faza.");
      if (state.sloty[state.tura] !== ctx.uid) throw new GameError("To nie twoja tura.");
      return rzut(state, 1 + Math.floor(ctx.rng() * 6), ctx.now);
    }

    if (action.type === "RUSZ") {
      if (state.phase !== "ruch") throw new GameError("Najpierw rzuć kostką.");
      if (state.sloty[state.tura] !== ctx.uid) throw new GameError("To nie twoja tura.");
      if (!legalneRuchy(pionkiKoloru(state.pionki, state.tura), state.kostka!).includes(action.pionek)) {
        throw new GameError("Tym pionkiem nie możesz się teraz ruszyć.");
      }
      return ruch(state, action.pionek, ctx.now);
    }

    return state;
  },

  publicView(state, players) {
    return {
      phase: state.phase,
      sloty: state.sloty.map((uid, kolor) => ({
        kolor: KOLORY[kolor],
        uid,
        nick: uid ? (players[uid]?.nick ?? nickOf(state, kolor, players)) : null,
      })),
      doWyboru: state.doWyboru,
      pionki: state.pionki,
      tura: state.tura,
      turaUid: state.phase === "rzut" || state.phase === "ruch" ? state.sloty[state.tura] : null,
      kostka: state.kostka,
      szostki: state.szostki,
      ruchy: state.phase === "ruch" && state.kostka ? legalneRuchy(pionkiKoloru(state.pionki, state.tura), state.kostka) : [],
      zwyciezca: state.zwyciezca,
      scores: state.scores,
      // „Zakończ grę" pokazujemy dopiero na ekranie wyników (opt-in z konwencji rdzenia).
      canFinish: state.phase === "wynik",
    };
  },

  privateView() {
    // Chińczyk nie ma tajemnic — cały stan jest w publicView.
    return null;
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
    return state.pendingEvents;
  },
};
