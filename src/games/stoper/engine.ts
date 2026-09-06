import { z } from "zod";
import type { PlayerMap } from "@/lib/types/room";
import {
  GameError,
  type GameEngine,
  type GameEvent,
  type InitContext,
  type WithEvents,
} from "@/games/types";
import { type StoperSettings } from "./manifest";

// Stoper, tryb A „CEL" (SPEC §5.2). Silnik jest CZYSTĄ funkcją: zero Date.now/Math.random,
// czas i losowość z ctx. Pomiar dzieje się na kliencie (performance.now), tu przychodzi wynik.

const MIN_TARGET_MS = 2000;
const MIN_VALID_MS = 50; // < 50 ms = przypadkowy klik (SPEC §5.2)
const PERFECT_MS = 50; // błąd < 0,05 s = idealne trafienie

type Phase =
  | "pomiar" // tryb A: każdy mierzy u siebie
  | "oczekiwanie" // tryb B: czekamy aż Biegacz ruszy
  | "bieg" // tryb B: Biegacz biegnie, reszta słucha
  | "typowanie" // tryb B: wszyscy wpisują typ
  | "odsloniecie"
  | "koniec";

interface Result {
  valueMs: number; // zmierzony czas gracza
  errorMs: number; // |valueMs - target|
  signedMs: number; // valueMs - target (dodatni = za późno)
  suspicious: boolean; // fizycznie niemożliwy wg zegara serwera
}

export interface StoperState extends WithEvents {
  settings: StoperSettings;
  hostUid: string;
  playerUids: string[];
  round: number;
  phase: Phase;
  phaseEndsAt: number | null;
  roundStartedAt: number;
  target: number; // cel bieżącej rundy (ms)
  results: Record<string, Result>;
  scores: Record<string, number>;
  perfectHits: string[]; // uid z idealnym trafieniem w tej rundzie

  // --- tryb B „ZGADNIJ CZAS" ---
  runnerUid: string | null; // czyja kolej biec (rotacja wg seatOrder)
  runStartedAt: number | null; // czas serwera startu biegu — do sanity checku
  /**
   * Zmierzony czas biegu. TAJNY do odsłonięcia — publicView go nie oddaje,
   * inaczej każdy odczytałby odpowiedź z DevToolsów (SPEC §3.1).
   */
  actualMs: number | null;
  guesses: Record<string, number>; // typy graczy, też tajne do odsłonięcia
}

export const stoperActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SUBMIT"), valueMs: z.number().finite() }),
  z.object({ type: z.literal("NEXT") }), // host: dalej z odsłonięcia
  z.object({ type: z.literal("FINISH") }), // host: zakończ grę (potrzebne przy rundach bez limitu)
  // tryb B
  z.object({ type: z.literal("RUN_START") }), // Biegacz rusza
  z.object({ type: z.literal("RUN_STOP"), valueMs: z.number().finite() }), // Biegacz staje
  z.object({ type: z.literal("GUESS"), valueMs: z.number().finite() }), // typ gracza
]);
export type StoperAction = z.infer<typeof stoperActionSchema>;

function generateTarget(settings: StoperSettings, rng: () => number): number {
  if (settings.targetMode === "staly") return settings.fixedTargetMs;
  const span = settings.targetMaxMs - MIN_TARGET_MS;
  // zaokrąglenie do 10 ms — ładny cel typu 7,43 s
  return Math.round((MIN_TARGET_MS + rng() * span) / 10) * 10;
}

/** Limit rundy = 3× cel (SPEC §5.2): kto nie zdąży, przepada. */
function roundLimitMs(target: number): number {
  return 3 * target;
}

function beginRound(state: StoperState, round: number, now: number, rng: () => number): StoperState {
  const target = generateTarget(state.settings, rng);
  // Termin rundy (SPEC §5.2). Przy 0 runda trwa aż wszyscy klikną STOP albo host ją zamknie —
  // tak działało to zawsze i taka jest wartość domyślna. Ustawiony termin domyka rundę sam,
  // więc pojedynczy gracz, który odłożył telefon, nie blokuje reszty w nieskończoność.
  const limit = state.settings.roundTimeoutMs;

  // Tryb B: Biegacz rotuje wg seatOrder, nikt nie zna czasu z góry — cel dopiero powstanie.
  if (state.settings.mode === "zgadnij") {
    const runnerUid = state.playerUids[(round - 1) % state.playerUids.length];
    return {
      ...state,
      round,
      phase: "oczekiwanie",
      target: 0,
      roundStartedAt: now,
      phaseEndsAt: null,
      results: {},
      perfectHits: [],
      runnerUid,
      runStartedAt: null,
      actualMs: null,
      guesses: {},
      pendingEvents: [{ type: "runda", text: `Runda ${round}: biegnie kolejna osoba` }],
    };
  }

  return {
    ...state,
    round,
    phase: "pomiar",
    target,
    roundStartedAt: now,
    phaseEndsAt: limit > 0 ? now + limit : null,
    results: {},
    perfectHits: [],
    runnerUid: null,
    runStartedAt: null,
    actualMs: null,
    guesses: {},
    pendingEvents: [{ type: "runda", text: `Runda ${round}: cel ${fmt(target)}` }],
  };
}

function fmt(ms: number): string {
  return (ms / 1000).toFixed(2).replace(".", ",") + " s";
}

/** W wariancie „bez przekroczenia" przekroczenie celu pali wynik. */
function busted(state: StoperState, uid: string): boolean {
  const r = state.results[uid];
  return !!r && state.settings.mode === "cel" && state.settings.noOvershoot && r.signedMs > 0;
}

/**
 * Ranking rosnąco wg błędu. Kolejność: najpierw ważne wyniki, potem spaleni
 * (przekroczyli cel w wariancie „bez przekroczenia"), na końcu ci bez wyniku.
 */
function ranked(state: StoperState): string[] {
  const rank = (uid: string) => {
    const r = state.results[uid];
    if (!r) return 2;
    return busted(state, uid) ? 1 : 0;
  };
  return [...state.playerUids].sort((a, b) => {
    const ga = rank(a);
    const gb = rank(b);
    if (ga !== gb) return ga - gb;
    return (state.results[a]?.errorMs ?? Infinity) - (state.results[b]?.errorMs ?? Infinity);
  });
}

/** Punktacja rundy dodawana do scores (SPEC §5.2). Spaleni nie punktują. */
function applyScoring(state: StoperState): { scores: Record<string, number>; events: GameEvent[] } {
  const order = ranked(state);
  const withResult = order.filter((uid) => state.results[uid] && !busted(state, uid));
  const scores = { ...state.scores };
  const events: GameEvent[] = [];

  if (state.settings.scoring === "zwyciestwa") {
    const best = withResult.length ? state.results[withResult[0]].errorMs : Infinity;
    for (const uid of withResult) {
      if (state.results[uid].errorMs === best) scores[uid] = (scores[uid] ?? 0) + 1;
    }
  } else {
    const n = withResult.length;
    withResult.forEach((uid, idx) => {
      let pts = 3;
      if (idx === 0) pts = 10;
      else if (idx === 1) pts = 7;
      else if (idx === 2) pts = 5;
      else if (idx === n - 1) pts = 1;
      scores[uid] = (scores[uid] ?? 0) + pts;
    });
  }

  for (const uid of state.perfectHits) {
    // meta.rekord === true → rdzeń dopisuje to do „Rekordów pokoju" (UPGRADE.md §8).
    events.push({
      type: "idealnie",
      text: `Idealne trafienie - ${fmt(state.results[uid].valueMs)}`,
      key: "feat.stoper.perfect",
      params: { time: fmt(state.results[uid].valueMs) },
      meta: { uid, rekord: true },
    });
  }
  return { scores, events };
}

function toReveal(state: StoperState, now: number): StoperState {
  const { scores, events } = applyScoring(state);
  return {
    ...state,
    phase: "odsloniecie",
    // 0 = bez auto-przejścia; wtedy rundę domyka host przyciskiem „Dalej".
    phaseEndsAt: state.settings.revealMs > 0 ? now + state.settings.revealMs : null,
    scores,
    pendingEvents: events,
  };
}

/**
 * Tryb B → odsłonięcie. Typy przeliczamy na `results` w formacie trybu A
 * (valueMs = typ, signedMs = typ − rzeczywisty), a `target` ustawiamy na zmierzony czas.
 * Dzięki temu ranking, punktacja i cały ekran wyników są wspólne dla obu trybów.
 */
function toRevealZgadnij(state: StoperState, now: number): StoperState {
  const actual = state.actualMs ?? 0;
  const results: Record<string, Result> = {};
  for (const [uid, guess] of Object.entries(state.guesses)) {
    const signedMs = guess - actual;
    results[uid] = { valueMs: guess, errorMs: Math.abs(signedMs), signedMs, suspicious: false };
  }
  const perfectHits = Object.keys(results).filter((uid) => results[uid].errorMs < PERFECT_MS);
  const withResults: StoperState = { ...state, target: actual, results, perfectHits };
  const { scores, events } = applyScoring(withResults);
  return {
    ...withResults,
    phase: "odsloniecie",
    phaseEndsAt: state.settings.revealMs > 0 ? now + state.settings.revealMs : null,
    scores,
    pendingEvents: [{ type: "wynik", text: `Rzeczywisty czas: ${fmt(actual)}` }, ...events],
  };
}

function advanceOrFinish(state: StoperState, now: number, rng: () => number): StoperState {
  const total = state.settings.rounds;
  const isLast = total !== 0 && state.round >= total;
  if (isLast) {
    return {
      ...state,
      phase: "koniec",
      phaseEndsAt: null,
      pendingEvents: [{ type: "koniec", text: "Koniec gry!" }],
    };
  }
  return beginRound(state, state.round + 1, now, rng);
}

export const stoperEngine: GameEngine<StoperState, StoperAction, StoperSettings> = {
  id: "stoper",
  actionSchema: stoperActionSchema,

  init(ctx: InitContext<StoperSettings>): StoperState {
    const hostUid = Object.values(ctx.players).find((p) => p.isHost)?.uid ?? ctx.seatOrder[0];
    const base: StoperState = {
      settings: ctx.settings,
      hostUid,
      playerUids: ctx.seatOrder.length ? ctx.seatOrder : Object.keys(ctx.players),
      round: 0,
      phase: "pomiar",
      phaseEndsAt: null,
      roundStartedAt: ctx.now,
      target: 0,
      results: {},
      scores: {},
      perfectHits: [],
      pendingEvents: [],
      runnerUid: null,
      runStartedAt: null,
      actualMs: null,
      guesses: {},
    };
    return beginRound(base, 1, ctx.now, ctx.rng);
  },

  reduce(state, action, ctx): StoperState {
    if (action.type === "PHASE_TIMEOUT") {
      if (state.phase === "pomiar") return toReveal(state, ctx.now);
      if (state.phase === "odsloniecie") return advanceOrFinish(state, ctx.now, ctx.rng);
      return state;
    }

    if (action.type === "FINISH") {
      // Bez tego przy rundach „∞" gry nie da się skończyć inaczej niż wyjściem z pokoju.
      if (ctx.uid !== state.hostUid) throw new GameError("Tylko host może zakończyć grę.", 403);
      if (state.phase === "koniec") return state;
      // Z pomiaru najpierw rozliczamy to, co gracze zdążyli zgłosić.
      const settled = state.phase === "pomiar" ? toReveal(state, ctx.now) : state;
      return {
        ...settled,
        phase: "koniec",
        phaseEndsAt: null,
        pendingEvents: [...(settled.pendingEvents ?? []), { type: "koniec", text: "Koniec gry!" }],
      };
    }

    if (action.type === "NEXT") {
      if (ctx.uid !== state.hostUid) throw new GameError("Tylko host może przejść dalej.", 403);
      if (state.phase === "odsloniecie") return advanceOrFinish(state, ctx.now, ctx.rng);
      if (state.phase === "pomiar") return toReveal(state, ctx.now); // host zamyka rundę wcześniej
      return state;
    }

    // ——— TRYB B „ZGADNIJ CZAS" ———
    if (action.type === "RUN_START") {
      if (state.phase !== "oczekiwanie") throw new GameError("Nie teraz.");
      if (ctx.uid !== state.runnerUid) throw new GameError("Teraz biegnie kto inny.", 403);
      return {
        ...state,
        phase: "bieg",
        runStartedAt: ctx.now,
        phaseEndsAt: null,
        pendingEvents: [{ type: "start", text: "Start!" }],
      };
    }

    if (action.type === "RUN_STOP") {
      if (state.phase !== "bieg") throw new GameError("Nie teraz.");
      if (ctx.uid !== state.runnerUid) throw new GameError("Teraz biegnie kto inny.", 403);
      if (action.valueMs < MIN_VALID_MS) throw new GameError("Za szybko - to był przypadkowy klik?");
      return {
        ...state,
        phase: "typowanie",
        actualMs: action.valueMs,
        phaseEndsAt: null,
        pendingEvents: [{ type: "stop", text: "Stop! Zgadujcie." }],
      };
    }

    if (action.type === "GUESS") {
      if (state.phase !== "typowanie") throw new GameError("Nie ma czego zgadywać.");
      if (!state.playerUids.includes(ctx.uid)) throw new GameError("Nie jesteś w tej rundzie.", 403);
      if (state.guesses[ctx.uid] != null) throw new GameError("Już podałeś swój typ.");
      if (action.valueMs < 0) throw new GameError("Czas nie może być ujemny.");

      const guesses = { ...state.guesses, [ctx.uid]: action.valueMs };
      const next: StoperState = { ...state, guesses, pendingEvents: [] };
      // Wszyscy wpisali → odsłonięcie. Biegacz też typuje (SPEC §5.2).
      const allIn = state.playerUids.every((uid) => guesses[uid] != null);
      return allIn ? toRevealZgadnij(next, ctx.now) : next;
    }

    // SUBMIT (tryb A)
    if (state.phase !== "pomiar") throw new GameError("Runda już zamknięta.");
    if (!state.playerUids.includes(ctx.uid)) throw new GameError("Nie jesteś w tej rundzie.", 403);
    if (state.results[ctx.uid]) throw new GameError("Już zatrzymałeś stoper w tej rundzie.");
    if (action.valueMs < MIN_VALID_MS) throw new GameError("Za szybko - to był przypadkowy klik?");

    const value = Math.min(action.valueMs, roundLimitMs(state.target));
    const signedMs = value - state.target;
    const errorMs = Math.abs(signedMs);
    // Sanity wg zegara serwera (SPEC §5.2): claim większy niż realny czas od startu rundy.
    const wallClock = ctx.now - state.roundStartedAt;
    const suspicious = value > wallClock + 800;

    const results = { ...state.results, [ctx.uid]: { valueMs: value, errorMs, signedMs, suspicious } };
    const isBust = state.settings.noOvershoot && signedMs > 0;
    const perfectHits =
      errorMs < PERFECT_MS && !isBust ? [...state.perfectHits, ctx.uid] : state.perfectHits;

    const next: StoperState = {
      ...state,
      results,
      perfectHits,
      pendingEvents: [],
    };

    // Wszyscy zatrzymali → od razu odsłonięcie (nie czekamy na limit).
    const allIn = state.playerUids.every((uid) => results[uid]);
    return allIn ? toReveal(next, ctx.now) : next;
  },

  publicView(state, players: PlayerMap) {
    const reveal = state.phase === "odsloniecie" || state.phase === "koniec";
    return {
      mode: state.settings.mode,
      runnerUid: state.runnerUid,
      // Konwencja dla rdzenia: gra sama oferuje hostowi porządne „Zakończ grę" w tej fazie,
      // więc GameShell ma schować swoje awaryjne „Przerwij i wróć do lobby" (dublowałoby się,
      // a jest gorsze — kasuje partię bez podium i bez zapisania rekordów).
      canFinish: state.phase === "odsloniecie",
      // Kto już podał typ — same uid, BEZ wartości (analogicznie do `submitted` w trybie A).
      guessed: Object.keys(state.guesses),
      // actualMs wychodzi na zewnątrz DOPIERO przy odsłonięciu. Wcześniej byłby
      // odpowiedzią leżącą w publicState do odczytania z DevToolsów (SPEC §3.1).
      actualMs: reveal ? state.actualMs : null,
      round: state.round,
      totalRounds: state.settings.rounds,
      scoring: state.settings.scoring,
      phase: state.phase,
      target: state.settings.mode === "zgadnij" && !reveal ? 0 : state.target,
      // W pomiarze pokazujemy TYLKO kto już zatrzymał (bez wartości) — wyniki tajne do końca.
      submitted: state.playerUids.filter((uid) => state.results[uid]),
      players: state.playerUids.map((uid) => ({
        uid,
        nick: players[uid]?.nick ?? "?",
        avatar: players[uid]?.avatar ?? "❓",
        score: state.scores[uid] ?? 0,
      })),
      // Odsłonięcie: pełny ranking z wartościami i znakiem błędu.
      reveal: reveal
        ? ranked(state).map((uid) => ({
            uid,
            valueMs: state.results[uid]?.valueMs ?? null,
            errorMs: state.results[uid]?.errorMs ?? null,
            signedMs: state.results[uid]?.signedMs ?? null,
            suspicious: state.results[uid]?.suspicious ?? false,
            perfect: state.perfectHits.includes(uid),
            busted: busted(state, uid),
          }))
        : null,
      perfectHits: reveal ? state.perfectHits : [],
    };
  },

  privateView(state, uid: string) {
    const r = state.results[uid];
    return {
      submitted: !!r,
      myValueMs: r?.valueMs ?? null,
      myGuessMs: state.guesses[uid] ?? null,
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
    return state.pendingEvents;
  },
};
