import { z } from "zod";
import type { PlayerMap } from "@/lib/types/room";
import {
  GameError,
  type GameEngine,
  type GameEvent,
  type InitContext,
  type WithEvents,
} from "@/games/types";
import {
  anteFor,
  SPIN_MS,
  doubleColourOf,
  DOUBLE_PAYOUT,
  DOUBLE_SLOTS,
  slotPayout,
  SLOT_SYMBOLS,
  WHEEL_SEGMENTS,
  weightedPick,
  type DoubleColour,
} from "./tables";
import type { KasynoSettings } from "./manifest";

// Kasyno. Silnik jest CZYSTĄ funkcją: zero Date.now/Math.random — czas i losowość z ctx.
//
// Wynik NIE jest utajniany. Zakłady zamykają się PRZED losowaniem, więc wcześniejsza
// znajomość rozstrzygnięcia nie daje przewagi — nie da się już zmienić zakładu. To inaczej
// niż w Impostorze czy Odcieniu, gdzie podejrzenie wprost pozwalało wygrać. Utajnianie
// dokładałoby tu złożoności, nie chroniąc niczego.

/**
 * „gra" to faza wyłączna dla slotów: nie ma rund ani wspólnego okna zakładów,
 * każdy kręci własną maszynę kiedy chce. Zegar fazy odmierza wtedy tylko
 * kolejne pobranie wpisowego — bez niego gracz, który przestanie kręcić,
 * nigdy nie zbankrutuje i partia „do ostatniego stojącego" nie miałaby końca.
 */
type Phase = "zaklady" | "losowanie" | "wynik" | "gra" | "koniec";

interface Bet {
  amount: number;
  /** Double: kolor. Wheel: mnożnik jako tekst. Jackpot i sloty: brak. */
  pick?: string;
}

interface Outcome {
  /** Double: wylosowane pole 0–14. */
  number?: number;
  colour?: DoubleColour;
  /** Wheel: wylosowany mnożnik. */
  multiplier?: number;
  /** Jackpot: kto wziął pulę. */
  winnerUid?: string;
  /** Sloty: bębny każdego gracza. */
  reels?: Record<string, string[]>;
}

export interface KasynoState extends WithEvents {
  settings: KasynoSettings;
  hostUid: string;
  playerUids: string[];
  round: number;
  phase: Phase;
  phaseEndsAt: number | null;
  chips: Record<string, number>;
  /** Wyeliminowani — zostali bez żetonów. Nie obstawiają, ale patrzą. */
  out: string[];
  bets: Record<string, Bet>;
  outcome: Outcome | null;
  /** Zmiana salda w tej rundzie (z wpisowym włącznie), do pokazania na ekranie wyników. */
  delta: Record<string, number>;
  /** Ostatnie wyniki do paska historii, jak w oryginałach. */
  history: string[];
  winnerUid: string | null;
  /** Sloty: ostatni obrót każdego gracza — widoczny dla wszystkich. */
  lastSpin: Record<string, { reels: string[]; bet: number; win: number }>;
  /**
   * Salda i lista odpadniętych SPRZED rozliczenia. Rozliczamy w chwili zamknięcia
   * zakładów (atomowo, żeby nic nie zginęło przy przerwaniu), ale animacja trwa
   * jeszcze kilka sekund — bez tej migawki gracze widzieliby skok żetonów
   * zwycięzcy, zanim pasek zdąży wyhamować, i wynik byłby znany z góry.
   */
  snapshot: { chips: Record<string, number>; out: string[] } | null;
  /** Jackpot: pula faktycznie wypłacona (stawki + wpisowe). Do pokazania po zamknięciu. */
  potPaid: number | null;
}

const pickSchema = z.string().max(10).optional();

export const kasynoActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("BET"), amount: z.number().int().positive(), pick: pickSchema }),
  z.object({ type: z.literal("CLEAR_BET") }),
  z.object({ type: z.literal("SPIN"), amount: z.number().int().positive() }),
  z.object({ type: z.literal("NEXT") }),
  z.object({ type: z.literal("FINISH") }),
]);
export type KasynoAction = z.infer<typeof kasynoActionSchema>;

const alive = (s: KasynoState) => s.playerUids.filter((u) => !s.out.includes(u));

function requireHost(state: KasynoState, uid: string) {
  if (uid !== state.hostUid) throw new GameError("Tylko host może to zrobić.", 403);
}

function beginRound(state: KasynoState, round: number, now: number): KasynoState {
  return {
    ...state,
    round,
    phase: "zaklady",
    phaseEndsAt: now + state.settings.betMs,
    bets: {},
    outcome: null,
    delta: {},
    snapshot: null,
    potPaid: null,
    pendingEvents: [{ type: "runda", text: `Runda ${round}: obstawiajcie`, key: "kasyno.event.bets", params: { round } }],
  };
}

/** Zamyka zakłady, losuje wynik i rozlicza salda. */
function resolve(state: KasynoState, now: number, rng: () => number): KasynoState {
  const { mode } = state.settings;
  const snapshot = { chips: { ...state.chips }, out: [...state.out] };
  let potWyplacona: number | null = null;
  const chips = { ...state.chips };
  const delta: Record<string, number> = {};
  const events: GameEvent[] = [];
  const outcome: Outcome = {};

  const stakeOf = (uid: string) => state.bets[uid]?.amount ?? 0;

  // Wpisowe — od każdego, kto jeszcze gra, niezależnie od tego, czy obstawił.
  const ante = anteFor(state.settings.ante, state.round);
  let anteZebrane = 0;
  for (const uid of alive(state)) {
    const paid = Math.min(ante, chips[uid] ?? 0);
    chips[uid] = (chips[uid] ?? 0) - paid;
    anteZebrane += paid;
    // Stawka zeszła z salda już przy BET, ale odeszła w TEJ rundzie — musi być
    // w bilansie, inaczej przegrany widzi samo wpisowe i liczby się nie zgadzają.
    delta[uid] = -paid - stakeOf(uid);
  }

  const pay = (uid: string, amount: number) => {
    chips[uid] = (chips[uid] ?? 0) + amount;
    delta[uid] = (delta[uid] ?? 0) - 0 + amount;
  };

  if (mode === "jackpot") {
    // Szansa proporcjonalna do wkładu — kto wrzucił 60 ze 100, ma 60%.
    const players = Object.keys(state.bets).filter((u) => stakeOf(u) > 0);
    // Wpisowe WPADA DO PULI, zamiast wyparować. Jackpot jest w całości zero-sum:
    // żetony tylko krążą między graczami, nikt nie oddaje prowizji „kasynu".
    // Wpisowe nadal spełnia swoje zadanie — bierny gracz traci żetony na rzecz
    // grających, więc partia „do ostatniego stojącego" ma jak się skończyć.
    // W Double i Wheel wpisowe przepada, bo tam z założenia gra się przeciwko
    // szansom z marżą, a puli, do której można je dorzucić, po prostu nie ma.
    const pot = players.reduce((a, u) => a + stakeOf(u), 0) + anteZebrane;
    potWyplacona = pot;
    if (players.length && pot > 0) {
      const idx = weightedPick(players.map(stakeOf), rng);
      const winner = players[idx];
      outcome.winnerUid = winner;
      pay(winner, pot);
      events.push({
        type: "wynik",
        text: `Pula ${pot} dla zwycięzcy`,
        key: "kasyno.event.jackpot",
        params: { pot },
        meta: { uid: winner, rekord: pot >= state.settings.startChips * 2 },
      });
    }
  }

  if (mode === "double") {
    const n = Math.floor(rng() * DOUBLE_SLOTS);
    const colour = doubleColourOf(n);
    outcome.number = n;
    outcome.colour = colour;
    for (const [uid, bet] of Object.entries(state.bets)) {
      if (bet.pick === colour) pay(uid, bet.amount * DOUBLE_PAYOUT[colour]);
    }
  }

  if (mode === "wheel") {
    const idx = weightedPick(WHEEL_SEGMENTS.map((s) => s.weight), rng);
    const mult = WHEEL_SEGMENTS[idx].multiplier;
    outcome.multiplier = mult;
    for (const [uid, bet] of Object.entries(state.bets)) {
      if (Number(bet.pick) === mult) pay(uid, bet.amount * mult);
    }
  }

  // Sloty NIE przechodzą przez resolve() — mają własną fazę „gra" i akcję SPIN,
  // bo każdy kręci osobno, kiedy chce.

  // Eliminacja: bez żetonów wypadasz. Gdyby wszyscy padli w tej samej rundzie,
  // nie eliminujemy nikogo — inaczej partia kończyłaby się bez zwycięzcy.
  const stillIn = alive(state).filter((u) => (chips[u] ?? 0) > 0);
  const out = [...state.out];
  if (stillIn.length > 0) {
    for (const uid of alive(state)) {
      if ((chips[uid] ?? 0) <= 0 && !out.includes(uid)) {
        out.push(uid);
        events.push({ type: "bankrut", text: "Bankructwo!", key: "kasyno.event.bust", params: {}, meta: { uid } });
      }
    }
  }

  const historyEntry =
    mode === "double" ? String(outcome.number)
    : mode === "wheel" ? `x${outcome.multiplier}`
    : mode === "jackpot" ? (outcome.winnerUid ?? "-")
    : "-";

  // Nikt nie obstawił → nie ma czego losować. Bez tego pasek kręci się pusty,
  // bo nie ma z czego zbudować kafelków (zgłoszenie z rozgrywki).
  const ktokolwiekObstawil = Object.keys(state.bets).length > 0;

  return {
    ...state,
    phase: ktokolwiekObstawil ? "losowanie" : "wynik",
    // Animacja paska. Wynik jest już znany i jawny — patrz komentarz na górze pliku.
    phaseEndsAt: now + (ktokolwiekObstawil ? SPIN_MS[mode] + 900 : 2500),
    chips,
    out,
    delta,
    outcome,
    snapshot,
    potPaid: potWyplacona,
    history: [historyEntry, ...state.history].slice(0, 12),
    pendingEvents: events,
  };
}

/** Sloty: kolejne okno do pobrania wpisowego. Rund jako takich tu nie ma. */
function beginAnteTick(state: KasynoState, round: number, now: number): KasynoState {
  return {
    ...state,
    round,
    phase: "gra",
    phaseEndsAt: now + state.settings.betMs,
    pendingEvents: [],
  };
}

/** Sloty: pobiera wpisowe od wszystkich grających i eliminuje tych bez żetonów. */
function anteTick(state: KasynoState, now: number): KasynoState {
  const chips = { ...state.chips };
  const out = [...state.out];
  const events: GameEvent[] = [];
  const ante = anteFor(state.settings.ante, state.round);

  for (const uid of alive(state)) {
    chips[uid] = Math.max(0, (chips[uid] ?? 0) - ante);
  }
  const stillIn = alive(state).filter((u) => (chips[u] ?? 0) > 0);
  if (stillIn.length > 0) {
    for (const uid of alive(state)) {
      if ((chips[uid] ?? 0) <= 0 && !out.includes(uid)) {
        out.push(uid);
        events.push({ type: "bankrut", text: "Bankructwo!", key: "kasyno.event.bust", params: {}, meta: { uid } });
      }
    }
  }
  const next: KasynoState = { ...state, chips, out, pendingEvents: events };
  return endIfLastStanding(next) ?? beginAnteTick(next, state.round + 1, now);
}

/** Koniec partii, gdy zostaje jeden gracz z żetonami. */
function endIfLastStanding(state: KasynoState): KasynoState | null {
  const stillIn = alive(state);
  if (stillIn.length > 1) return null;
  return {
    ...state,
    phase: "koniec",
    phaseEndsAt: null,
    winnerUid: stillIn[0] ?? null,
    pendingEvents: [{ type: "koniec", text: "Koniec gry!", key: "kasyno.event.end" }],
  };
}

function toResult(state: KasynoState, now: number): KasynoState {
  return endIfLastStanding(state) ?? { ...state, phase: "wynik", phaseEndsAt: now + 6000, pendingEvents: [] };
}

export const kasynoEngine: GameEngine<KasynoState, KasynoAction, KasynoSettings> = {
  id: "kasyno",
  actionSchema: kasynoActionSchema,

  init(ctx: InitContext<KasynoSettings>): KasynoState {
    const hostUid = Object.values(ctx.players).find((p) => p.isHost)?.uid ?? ctx.seatOrder[0];
    const playerUids = ctx.seatOrder.length ? ctx.seatOrder : Object.keys(ctx.players);
    const chips: Record<string, number> = {};
    for (const uid of playerUids) chips[uid] = ctx.settings.startChips;
    const base: KasynoState = {
      settings: ctx.settings,
      hostUid,
      playerUids,
      round: 0,
      phase: "zaklady",
      phaseEndsAt: null,
      chips,
      out: [],
      bets: {},
      outcome: null,
      delta: {},
      history: [],
      winnerUid: null,
      lastSpin: {},
      snapshot: null,
      potPaid: null,
      pendingEvents: [],
    };
    if (ctx.settings.mode === "sloty") return beginAnteTick(base, 1, ctx.now);
    return beginRound(base, 1, ctx.now);
  },

  reduce(state, action, ctx): KasynoState {
    if (action.type === "PHASE_TIMEOUT") {
      if (state.phase === "gra") return anteTick(state, ctx.now); // sloty: tylko wpisowe
      if (state.phase === "zaklady") return resolve(state, ctx.now, ctx.rng);
      if (state.phase === "losowanie") return toResult(state, ctx.now);
      if (state.phase === "wynik") return endIfLastStanding(state) ?? beginRound(state, state.round + 1, ctx.now);
      return state;
    }

    if (action.type === "FINISH") {
      requireHost(state, ctx.uid);
      if (state.phase === "koniec") return state;
      // Zwycięzcą zostaje ten, kto ma najwięcej żetonów w chwili przerwania.
      const best = alive(state).sort((a, b) => (state.chips[b] ?? 0) - (state.chips[a] ?? 0))[0] ?? null;
      return {
        ...state,
        phase: "koniec",
        phaseEndsAt: null,
        winnerUid: best,
        pendingEvents: [{ type: "koniec", text: "Koniec gry!", key: "kasyno.event.end" }],
      };
    }

    if (action.type === "NEXT") {
      requireHost(state, ctx.uid);
      if (state.phase === "zaklady") return resolve(state, ctx.now, ctx.rng); // host zamyka wcześniej
      if (state.phase === "losowanie") return toResult(state, ctx.now);
      if (state.phase === "wynik") return endIfLastStanding(state) ?? beginRound(state, state.round + 1, ctx.now);
      return state;
    }

    if (action.type === "SPIN") {
      if (state.settings.mode !== "sloty") throw new GameError("Ten tryb nie ma maszyny.", 400);
      if (state.phase !== "gra") throw new GameError("Nie teraz.");
      if (!state.playerUids.includes(ctx.uid)) throw new GameError("Nie jesteś w tej grze.", 403);
      if (state.out.includes(ctx.uid)) throw new GameError("Odpadłeś - możesz tylko patrzeć.", 403);

      const saldo = state.chips[ctx.uid] ?? 0;
      if (action.amount > saldo) throw new GameError("Nie masz tylu żetonów.");
      if (action.amount < state.settings.minBet && action.amount !== saldo) {
        throw new GameError(`Minimalny zakład to ${state.settings.minBet}.`);
      }

      const reels = [0, 1, 2].map(() => SLOT_SYMBOLS[Math.floor(ctx.rng() * SLOT_SYMBOLS.length)]);
      const win = Math.round(action.amount * slotPayout(reels));
      const chips = { ...state.chips, [ctx.uid]: saldo - action.amount + win };

      // Eliminacja od razu po obrocie — w trybie swobodnym nie ma rundy, w której
      // można by to rozliczyć zbiorczo.
      const out = [...state.out];
      const events: GameEvent[] = [];
      const inniMajaZetony = alive(state).some((u) => u !== ctx.uid && (chips[u] ?? 0) > 0);
      if (chips[ctx.uid] <= 0 && inniMajaZetony && !out.includes(ctx.uid)) {
        out.push(ctx.uid);
        events.push({ type: "bankrut", text: "Bankructwo!", key: "kasyno.event.bust", params: {}, meta: { uid: ctx.uid } });
      }
      if (win >= action.amount * 10) {
        events.push({
          type: "rekord",
          text: `Trójka! ${win} żetonów`,
          key: "feat.kasyno.jackpotSpin",
          params: { win },
          meta: { uid: ctx.uid, rekord: true },
        });
      }

      const next: KasynoState = {
        ...state,
        chips,
        out,
        lastSpin: { ...state.lastSpin, [ctx.uid]: { reels, bet: action.amount, win } },
        pendingEvents: events,
      };
      return endIfLastStanding(next) ?? next;
    }

    if (action.type === "CLEAR_BET") {
      if (state.phase !== "zaklady") throw new GameError("Zakłady zamknięte.");
      const bet = state.bets[ctx.uid];
      if (!bet) return state;
      const bets = { ...state.bets };
      delete bets[ctx.uid];
      return { ...state, bets, chips: { ...state.chips, [ctx.uid]: (state.chips[ctx.uid] ?? 0) + bet.amount }, pendingEvents: [] };
    }

    // BET
    if (state.phase !== "zaklady") throw new GameError("Zakłady zamknięte.");
    if (!state.playerUids.includes(ctx.uid)) throw new GameError("Nie jesteś w tej grze.", 403);
    if (state.out.includes(ctx.uid)) throw new GameError("Odpadłeś - możesz tylko patrzeć.", 403);
    if (state.bets[ctx.uid]) throw new GameError("Zakład już postawiony.");

    const mode = state.settings.mode;
    if (mode === "double" && !["red", "black", "green"].includes(action.pick ?? "")) {
      throw new GameError("Wybierz kolor.");
    }
    if (mode === "wheel" && !WHEEL_SEGMENTS.some((s) => String(s.multiplier) === action.pick)) {
      throw new GameError("Wybierz mnożnik.");
    }

    const saldo = state.chips[ctx.uid] ?? 0;
    if (action.amount > saldo) throw new GameError("Nie masz tylu żetonów.");
    // Poniżej minimum wolno tylko va banque — inaczej gracz z resztówką nie mógłby zagrać.
    if (action.amount < state.settings.minBet && action.amount !== saldo) {
      throw new GameError(`Minimalny zakład to ${state.settings.minBet}.`);
    }

    // `pick` dopisujemy TYLKO gdy istnieje. W Jackpocie i slotach go nie ma, a Firestore
    // odrzuca dokumenty z wartością undefined — { amount, pick: undefined } wywalało
    // zapis stanu i każdy zakład w Jackpocie kończył się błędem serwera.
    const bet: Bet = action.pick != null ? { amount: action.amount, pick: action.pick } : { amount: action.amount };
    const next: KasynoState = {
      ...state,
      bets: { ...state.bets, [ctx.uid]: bet },
      chips: { ...state.chips, [ctx.uid]: saldo - action.amount },
      pendingEvents: [],
    };
    // Wszyscy grający obstawili → zamykamy od razu, zamiast czekać do końca okna.
    // Bez tego po ostatnim zakładzie nic się nie dzieje i wygląda to na zwiechę.
    const wszyscy = alive(next).every((u) => next.bets[u]);
    return wszyscy ? resolve(next, ctx.now, ctx.rng) : next;
  },

  publicView(state, players: PlayerMap) {
    const reveal = state.phase === "losowanie" || state.phase === "wynik" || state.phase === "koniec";
    return {
      mode: state.settings.mode,
      phase: state.phase,
      round: state.round,
      minBet: state.settings.minBet,
      ante: anteFor(state.settings.ante, state.round),
      // Rdzeń pokazuje „Zakończ grę" zamiast awaryjnego przerwania (patrz GameShell).
      canFinish: state.phase === "wynik" || state.phase === "zaklady" || state.phase === "gra",
      // Zakłady są JAWNE od razu — widok, kto ile na co postawił, to połowa zabawy
      // i tak działają oryginały. Tajny jest tylko wynik, i to tylko do losowania.
      bets: Object.entries(state.bets).map(([uid, b]) => ({ uid, amount: b.amount, pick: b.pick ?? null })),
      // Liczba na ekranie musi zgadzać się z tym, co dostanie zwycięzca. Po zamknięciu
      // bierzemy pulę faktycznie wypłaconą; w trakcie zakładów doliczamy zapowiedziane
      // wpisowe, bo ono też do niej wpadnie.
      pot:
        state.potPaid ??
        Object.values(state.bets).reduce((a, b) => a + b.amount, 0) +
          (state.settings.mode === "jackpot"
            ? anteFor(state.settings.ante, state.round) * alive(state).length
            : 0),
      outcome: reveal ? state.outcome : null,
      // Bilans i zwycięzca dopiero PO animacji. Przy „reveal" obejmującym fazę
      // losowania wynik był widoczny pod spodem, zanim pasek zdążył wyhamować.
      delta: state.phase === "wynik" || state.phase === "koniec" ? state.delta : {},
      history: state.history,
      winnerUid: state.winnerUid,
      // Sloty: wyniki wszystkich są jawne — o to chodzi, żeby widzieć, komu idzie.
      lastSpin: state.lastSpin,
      // W trakcie animacji oddajemy salda SPRZED rozliczenia — inaczej skok żetonów
      // zwycięzcy zdradzałby wynik, zanim pasek stanie.
      players: state.playerUids.map((uid) => {
        const przed = state.phase === "losowanie" ? state.snapshot : null;
        return {
          uid,
          nick: players[uid]?.nick ?? "?",
          avatar: players[uid]?.avatar ?? "",
          chips: (przed ? przed.chips[uid] : state.chips[uid]) ?? 0,
          out: (przed ? przed.out : state.out).includes(uid),
        };
      }),
    };
  },

  privateView(state, uid: string) {
    // Także tutaj migawka w trakcie animacji. Bez tego własne saldo na górze ekranu
    // skakało od razu po rozliczeniu i gracz wiedział, że wygrał, zanim pasek stanął —
    // dokładnie ten sam wyciek co w widoku publicznym, tylko innym kanałem.
    const przed = state.phase === "losowanie" ? state.snapshot : null;
    return {
      chips: (przed ? przed.chips[uid] : state.chips[uid]) ?? 0,
      bet: state.bets[uid] ?? null,
      out: (przed ? przed.out : state.out).includes(uid),
    };
  },

  phase(state) {
    return { name: state.phase, endsAt: state.phaseEndsAt };
  },
  isFinished(state) {
    return state.phase === "koniec";
  },
  scores(state) {
    return state.chips;
  },
  drainEvents(state): GameEvent[] {
    return state.pendingEvents;
  },
};
