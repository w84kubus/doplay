import { z } from "zod";
import type { PlayerMap } from "@/lib/types/room";
import { GameError, type GameEngine, type GameEvent, type InitContext, type WithEvents } from "@/games/types";
import { WORD_SETS } from "./data/words";
import type { WisielecSettings } from "./manifest";

// Wisielec (SPEC §5.4), trzy tryby. Czysta funkcja. Hasło jest TAJNE (w secret/state);
// publicView pokazuje tylko maskę z trafionych liter — do fazy wyniku.

const TURN_MS_ZADAJACY = 20000;
const TURN_MS_KOOP = 15000;
const REVEAL_MS = 9000;

type Mode = "zadajacy" | "wyscig" | "kooperacja";
type Phase = "ustawianie" | "zgadywanie" | "wynik" | "koniec";

interface PerPlayer {
  guessed: string[];
  wrong: number;
  solved: boolean;
  order: number; // kolejność ukończenia (wyścig)
}

export interface WisielecState extends WithEvents {
  settings: WisielecSettings;
  hostUid: string;
  playerUids: string[];
  mode: Mode;
  round: number;
  phase: Phase;
  phaseEndsAt: number | null;
  category: string;
  password: string; // TAJNE
  guessed: string[]; // wspólne (zadający, kooperacja)
  wrong: number;
  guessers: string[];
  turn: number;
  setterUid: string | null;
  per: Record<string, PerPlayer>; // wyścig
  result: "gramy" | "wygrana" | "przegrana";
  winners: string[];
  scores: Record<string, number>;
  roundScores: Record<string, number>;
  solveCounter: number;
}

export const wisielecActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SET_PASSWORD"), password: z.string().min(1).max(40), category: z.string().min(1).max(40) }),
  z.object({ type: z.literal("GUESS"), letter: z.string().min(1).max(2) }),
  z.object({ type: z.literal("SOLVE"), word: z.string().min(1).max(60) }),
  z.object({ type: z.literal("NEXT") }),
  z.object({ type: z.literal("FINISH") }), // host: zakończ grę (tryb rund „∞")
]);
export type WisielecAction = z.infer<typeof wisielecActionSchema>;

const OGONKI: Record<string, string> = { Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z" };
const fold = (ch: string) => OGONKI[ch] ?? ch;
const up = (ch: string) => ch.toLocaleUpperCase("pl");
const isLetter = (ch: string) => /\p{L}/u.test(ch);

function letterMatch(passChar: string, guessLetter: string, ignore: boolean): boolean {
  const p = up(passChar), g = up(guessLetter);
  return ignore ? fold(p) === fold(g) : p === g;
}
function hasLetter(password: string, letter: string, ignore: boolean): boolean {
  return [...password].some((ch) => isLetter(ch) && letterMatch(ch, letter, ignore));
}
function isSolved(password: string, guessed: string[], ignore: boolean): boolean {
  return [...password].every((ch) => !isLetter(ch) || guessed.some((g) => letterMatch(ch, g, ignore)));
}
function normWord(s: string, ignore: boolean): string {
  let r = s.toLocaleLowerCase("pl").replace(/\s+/g, " ").trim();
  if (ignore) r = [...r].map((c) => fold(up(c)).toLowerCase()).join("");
  return r;
}
function maskWord(password: string, guessed: string[], ignore: boolean, reveal: boolean) {
  return [...password].map((ch) => {
    if (!isLetter(ch)) return { ch, kind: ch === " " ? "space" : "punct" };
    const shown = reveal || guessed.some((g) => letterMatch(ch, g, ignore));
    return { ch: shown ? ch : null, kind: "letter" as const };
  });
}
function classifyLetters(password: string, guessed: string[], ignore: boolean) {
  const hits: string[] = [], misses: string[] = [];
  for (const g of guessed) (hasLetter(password, g, ignore) ? hits : misses).push(up(g));
  return { hits, misses };
}

function pickWord(setId: string, rng: () => number): { password: string; category: string } {
  const set = WORD_SETS[setId] ?? WORD_SETS.zwierzeta;
  return { password: set.words[Math.floor(rng() * set.words.length)], category: set.name };
}

function beginRound(state: WisielecState, round: number, now: number, rng: () => number): WisielecState {
  const base: WisielecState = {
    ...state,
    round,
    guessed: [],
    wrong: 0,
    turn: 0,
    result: "gramy",
    winners: [],
    per: {},
    solveCounter: 0,
    roundScores: {},
    pendingEvents: [],
  };
  if (state.mode === "zadajacy") {
    const setter = state.playerUids[(round - 1) % state.playerUids.length];
    return {
      ...base,
      phase: "ustawianie",
      phaseEndsAt: null,
      setterUid: setter,
      guessers: state.playerUids.filter((u) => u !== setter),
      password: "",
      category: "",
      pendingEvents: [{ type: "runda", text: `Runda ${round}: hasło układa nowy gracz` }],
    };
  }
  const { password, category } = pickWord(state.settings.wordSet, rng);
  if (state.mode === "kooperacja") {
    return {
      ...base,
      phase: "zgadywanie",
      phaseEndsAt: now + TURN_MS_KOOP,
      setterUid: null,
      guessers: [...state.playerUids],
      password,
      category,
      pendingEvents: [{ type: "runda", text: `Runda ${round}: kategoria ${category}` }],
    };
  }
  // wyścig
  const per: Record<string, PerPlayer> = {};
  for (const uid of state.playerUids) per[uid] = { guessed: [], wrong: 0, solved: false, order: 0 };
  return {
    ...base,
    phase: "zgadywanie",
    phaseEndsAt: null,
    setterUid: null,
    guessers: [],
    password,
    category,
    per,
    pendingEvents: [{ type: "runda", text: `Runda ${round}: kategoria ${category} - wyścig!` }],
  };
}

function toResult(state: WisielecState, now: number, result: "wygrana" | "przegrana", winners: string[], extraScores: Record<string, number>): WisielecState {
  const roundScores = { ...state.roundScores };
  for (const [uid, pts] of Object.entries(extraScores)) roundScores[uid] = (roundScores[uid] ?? 0) + pts;
  const scores = { ...state.scores };
  for (const [uid, pts] of Object.entries(roundScores)) scores[uid] = (scores[uid] ?? 0) + pts;
  return {
    ...state,
    phase: "wynik",
    phaseEndsAt: now + REVEAL_MS,
    result,
    winners,
    roundScores,
    scores,
    pendingEvents: [{ type: "wynik", text: result === "wygrana" ? "Hasło odgadnięte!" : "Ludzik zawisł…" }],
  };
}

function advance(state: WisielecState, now: number, rng: () => number): WisielecState {
  const total = state.settings.rounds;
  if (total !== 0 && state.round >= total) {
    return { ...state, phase: "koniec", phaseEndsAt: null, pendingEvents: [{ type: "koniec", text: "Koniec gry!" }] };
  }
  return beginRound(state, state.round + 1, now, rng);
}

function nextTurn(state: WisielecState, now: number, turnMs: number): Partial<WisielecState> {
  return { turn: (state.turn + 1) % Math.max(1, state.guessers.length), phaseEndsAt: now + turnMs };
}

export const wisielecEngine: GameEngine<WisielecState, WisielecAction, WisielecSettings> = {
  id: "wisielec",
  actionSchema: wisielecActionSchema,

  init(ctx: InitContext<WisielecSettings>): WisielecState {
    const hostUid = Object.values(ctx.players).find((p) => p.isHost)?.uid ?? ctx.seatOrder[0];
    const base: WisielecState = {
      settings: ctx.settings,
      hostUid,
      playerUids: ctx.seatOrder.length ? ctx.seatOrder : Object.keys(ctx.players),
      mode: ctx.settings.mode,
      round: 0,
      phase: "zgadywanie",
      phaseEndsAt: null,
      category: "",
      password: "",
      guessed: [],
      wrong: 0,
      guessers: [],
      turn: 0,
      setterUid: null,
      per: {},
      result: "gramy",
      winners: [],
      scores: {},
      roundScores: {},
      solveCounter: 0,
      pendingEvents: [],
    };
    return beginRound(base, 1, ctx.now, ctx.rng);
  },

  reduce(state, action, ctx): WisielecState {
    const S = state.settings;
    const maxWrong = S.lives;
    const turnMs = state.mode === "kooperacja" ? TURN_MS_KOOP : TURN_MS_ZADAJACY;

    if (action.type === "PHASE_TIMEOUT") {
      if (state.phase === "wynik") return advance(state, ctx.now, ctx.rng);
      if (state.phase === "zgadywanie" && state.mode !== "wyscig") {
        // aktualny gracz spasował — kolejna tura, bez kary
        return { ...state, ...nextTurn(state, ctx.now, turnMs), pendingEvents: [] };
      }
      return state;
    }

    if (action.type === "FINISH") {
      if (ctx.uid !== state.hostUid) throw new GameError("Tylko host.", 403);
      // Kończy natychmiast, z dotychczasową punktacją. Bez tego przy rundach „∞"
      // jedynym wyjściem było przerwanie partii, które nie zapisuje rekordów.
      if (state.phase === "koniec") return state;
      return {
        ...state,
        phase: "koniec",
        phaseEndsAt: null,
        pendingEvents: [...(state.pendingEvents ?? []), { type: "koniec", text: "Koniec gry!" }],
      };
    }

    if (action.type === "NEXT") {
      if (ctx.uid !== state.hostUid) throw new GameError("Tylko host.", 403);
      if (state.phase === "wynik") return advance(state, ctx.now, ctx.rng);
      return state;
    }

    if (action.type === "SET_PASSWORD") {
      if (state.mode !== "zadajacy" || state.phase !== "ustawianie") throw new GameError("Nie ta faza.");
      if (ctx.uid !== state.setterUid) throw new GameError("Tylko układający ustawia hasło.", 403);
      if (![...action.password].some(isLetter)) throw new GameError("Hasło musi mieć litery.");
      return {
        ...state,
        password: action.password.trim(),
        category: action.category.trim(),
        phase: "zgadywanie",
        phaseEndsAt: ctx.now + TURN_MS_ZADAJACY,
        pendingEvents: [{ type: "haslo", text: `Hasło gotowe - kategoria: ${action.category.trim()}` }],
      };
    }

    if (state.phase !== "zgadywanie") throw new GameError("Nie ta faza.");

    // ---------- WYŚCIG ----------
    if (state.mode === "wyscig") {
      const me = state.per[ctx.uid];
      if (!me) throw new GameError("Nie jesteś w grze.", 403);
      if (me.solved || me.wrong >= maxWrong) throw new GameError("Już nie grasz w tej rundzie.");

      if (action.type === "SOLVE") {
        const ok = normWord(action.word, S.ignoreOgonki) === normWord(state.password, S.ignoreOgonki);
        if (ok) return finishWyscig(state, ctx.uid, ctx.now);
        const per = { ...state.per, [ctx.uid]: { ...me, wrong: me.wrong + 2 } };
        return checkWyscigEnd({ ...state, per, pendingEvents: [] }, ctx.now, maxWrong);
      }
      // GUESS
      const L = up(action.letter);
      if (me.guessed.includes(L)) throw new GameError("Już próbowałeś tej litery.");
      const guessed = [...me.guessed, L];
      const hit = hasLetter(state.password, L, S.ignoreOgonki);
      const upd: PerPlayer = { ...me, guessed, wrong: me.wrong + (hit ? 0 : 1) };
      const per = { ...state.per, [ctx.uid]: upd };
      if (hit && isSolved(state.password, guessed, S.ignoreOgonki)) return finishWyscig({ ...state, per }, ctx.uid, ctx.now);
      return checkWyscigEnd({ ...state, per, pendingEvents: [] }, ctx.now, maxWrong);
    }

    // ---------- ZADAJĄCY / KOOPERACJA (wspólne, tury) ----------
    const current = state.guessers[state.turn % Math.max(1, state.guessers.length)];
    if (ctx.uid !== current) throw new GameError("Nie twoja tura.");

    if (action.type === "SOLVE") {
      const ok = normWord(action.word, S.ignoreOgonki) === normWord(state.password, S.ignoreOgonki);
      if (ok) {
        const extra = state.mode === "kooperacja"
          ? Object.fromEntries(state.playerUids.map((u) => [u, 3]))
          : { [ctx.uid]: 5 };
        return toResult(state, ctx.now, "wygrana", state.mode === "kooperacja" ? state.playerUids : [ctx.uid], extra);
      }
      const wrong = state.wrong + 2;
      if (wrong >= maxWrong) return loseShared(state, ctx.now, maxWrong);
      return { ...state, wrong, ...nextTurn(state, ctx.now, turnMs), pendingEvents: [{ type: "pudlo", text: "Pudło przy haśle (−2)" }] };
    }

    // GUESS
    const L = up(action.letter);
    if (state.guessed.includes(L)) throw new GameError("Ta litera już padła.");
    const guessed = [...state.guessed, L];
    const hit = hasLetter(state.password, L, S.ignoreOgonki);

    if (hit) {
      const roundScores = state.mode === "zadajacy" ? { ...state.roundScores, [ctx.uid]: (state.roundScores[ctx.uid] ?? 0) + 1 } : state.roundScores;
      const solved = isSolved(state.password, guessed, S.ignoreOgonki);
      if (solved) {
        const extra = state.mode === "kooperacja"
          ? Object.fromEntries(state.playerUids.map((u) => [u, 3]))
          : { [ctx.uid]: 5 };
        return toResult({ ...state, guessed, roundScores }, ctx.now, "wygrana", state.mode === "kooperacja" ? state.playerUids : [ctx.uid], extra);
      }
      // trafienie: zadający+hitContinues → ta sama tura; inaczej następna
      const keepTurn = state.mode === "zadajacy" && S.hitContinues;
      const turnPatch = keepTurn ? { phaseEndsAt: ctx.now + turnMs } : nextTurn(state, ctx.now, turnMs);
      return { ...state, guessed, roundScores, ...turnPatch, pendingEvents: [] };
    }
    // pudło
    const wrong = state.wrong + 1;
    if (wrong >= maxWrong) return loseShared({ ...state, guessed }, ctx.now, maxWrong);
    return { ...state, guessed, wrong, ...nextTurn(state, ctx.now, turnMs), pendingEvents: [] };
  },

  publicView(state, players: PlayerMap) {
    const playersView = state.playerUids.map((uid) => ({
      uid, nick: players[uid]?.nick ?? "?", avatar: players[uid]?.avatar ?? "❓",
      score: state.scores[uid] ?? 0, roundDelta: state.roundScores[uid] ?? 0,
    }));
    const reveal = state.phase === "wynik" || state.phase === "koniec";
    const base = {
      mode: state.mode, round: state.round, totalRounds: state.settings.rounds, phase: state.phase,
      category: state.category, maxWrong: state.settings.lives, result: state.result, winners: state.winners,
      players: playersView, extraLetters: state.settings.extraLetters, ignoreOgonki: state.settings.ignoreOgonki,
      // Rdzeń pokazuje „Zakończ grę" zamiast awaryjnego przerwania (patrz GameShell).
      canFinish: state.phase === "wynik",
    };

    if (state.mode === "wyscig") {
      return {
        ...base,
        // postępy bez ujawniania liter (SPEC §5.4)
        progress: state.playerUids.map((uid) => {
          const p = state.per[uid];
          const total = [...state.password].filter(isLetter).length;
          const done = [...state.password].filter((ch) => isLetter(ch) && p?.guessed.some((g) => letterMatch(ch, g, state.settings.ignoreOgonki))).length;
          return { uid, percent: total ? Math.round((done / total) * 100) : 0, wrong: p?.wrong ?? 0, solved: p?.solved ?? false, order: p?.order ?? 0 };
        }),
        mask: reveal ? maskWord(state.password, [], state.settings.ignoreOgonki, true) : null,
      };
    }

    const { hits, misses } = classifyLetters(state.password, state.guessed, state.settings.ignoreOgonki);
    return {
      ...base,
      mask: maskWord(state.password, state.guessed, state.settings.ignoreOgonki, reveal),
      hits, misses, wrong: state.wrong,
      turnUid: state.guessers[state.turn % Math.max(1, state.guessers.length)] ?? null,
      setterUid: state.setterUid,
    };
  },

  privateView(state, uid: string) {
    if (state.mode === "wyscig") {
      const p = state.per[uid];
      if (!p) return {};
      const { hits, misses } = classifyLetters(state.password, p.guessed, state.settings.ignoreOgonki);
      return {
        mask: maskWord(state.password, p.guessed, state.settings.ignoreOgonki, false),
        hits, misses, wrong: p.wrong, solved: p.solved,
      };
    }
    if (state.mode === "zadajacy" && uid === state.setterUid) {
      // układający zna hasło (sam je wpisał)
      return { amSetter: true, password: state.phase === "ustawianie" ? "" : state.password };
    }
    return {};
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
  drainEvents(state): GameEvent[] {
    return state.pendingEvents;
  },
};

// ---- pomocnicze finalizacje ----
function finishWyscig(state: WisielecState, uid: string, now: number): WisielecState {
  const order = state.solveCounter + 1;
  const per = { ...state.per, [uid]: { ...state.per[uid], solved: true, order } };
  // pierwszy, kto rozwiązał, wygrywa (SPEC §5.4)
  return toResult({ ...state, per, solveCounter: order }, now, "wygrana", [uid], { [uid]: 5 });
}
function checkWyscigEnd(state: WisielecState, now: number, maxWrong: number): WisielecState {
  const alive = state.playerUids.filter((u) => !state.per[u].solved && state.per[u].wrong < maxWrong);
  if (alive.length === 0) return toResult(state, now, "przegrana", [], {});
  return state;
}
function loseShared(state: WisielecState, now: number, maxWrong: number): WisielecState {
  void maxWrong;
  // przegrana wspólna; w trybie zadający układający dostaje +3
  const extra = state.mode === "zadajacy" && state.setterUid ? { [state.setterUid]: 3 } : {};
  return toResult(state, now, "przegrana", [], extra);
}
