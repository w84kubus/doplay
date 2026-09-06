import { z } from "zod";
import type { PlayerMap } from "@/lib/types/room";
import {
  GameError,
  type GameEngine,
  type GameEvent,
  type InitContext,
  type WithEvents,
} from "@/games/types";
import { BASE_LETTERS, CATEGORY_SETS, HARDCORE_LETTERS } from "./data/categories";
import type { PmSettings } from "./manifest";

// Państwa-miasta (SPEC §5.3). Czysta funkcja. Odpowiedzi w fazie pisania są TAJNE
// (nie trafiają do publicView) — inaczej przeciwnik podejrzy je w Firestore.

const COUNTDOWN_MS = 4000; // animacja 3-2-1 + litera
const CHALLENGE_MS = 20000; // okno uzasadnienia + głosowania
const REVEAL_MS = 14000;

type Phase = "losowanie" | "pisanie" | "weryfikacja" | "wyniki" | "koniec";

interface ActiveChallenge {
  targetUid: string;
  cat: number;
  by: string;
  justification: string;
  votes: Record<string, "uznaje" | "odrzucam">;
}

export interface PmState extends WithEvents {
  settings: PmSettings;
  hostUid: string;
  playerUids: string[];
  categories: string[];
  letterPool: string[];
  usedLetters: string[];
  round: number;
  phase: Phase;
  phaseEndsAt: number | null;
  letter: string;
  answers: Record<string, string[]>; // uid -> odpowiedź per indeks kategorii
  stoppedBy: string | null;
  verifyCat: number;
  rejected: Record<string, Record<number, true>>; // uid -> cat -> odrzucone w głosowaniu
  active: ActiveChallenge | null;
  roundScores: Record<string, number>;
  scores: Record<string, number>;
  breakdown: CatResult[] | null;
}

interface AnswerResult {
  uid: string;
  answer: string;
  points: number;
  status: "p15" | "p10" | "p5" | "empty" | "letter" | "rejected";
}
interface CatResult {
  category: string;
  answers: AnswerResult[];
}

export const pmActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SUBMIT_ANSWERS"), answers: z.array(z.string().max(60)).max(12) }),
  z.object({ type: z.literal("STOP") }),
  z.object({ type: z.literal("CHALLENGE"), targetUid: z.string(), cat: z.number().int().nonnegative() }),
  z.object({ type: z.literal("JUSTIFY"), text: z.string().max(200) }),
  z.object({ type: z.literal("VOTE"), verdict: z.enum(["uznaje", "odrzucam"]) }),
  z.object({ type: z.literal("NEXT") }),
  z.object({ type: z.literal("FINISH") }), // host: zakończ grę (tryb rund „∞")
]);
export type PmAction = z.infer<typeof pmActionSchema>;

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/\s+/g, " ")
    .trim();
}
function firstLetterOk(answer: string, letter: string): boolean {
  const a = answer.trim();
  if (!a) return false;
  return a.charAt(0).toLocaleUpperCase("pl") === letter;
}
function pickLetter(state: PmState, rng: () => number): { letter: string; used: string[] } {
  let pool = state.letterPool.filter((l) => !state.usedLetters.includes(l));
  let used = state.usedLetters;
  if (pool.length === 0) {
    pool = [...state.letterPool];
    used = [];
  }
  const letter = pool[Math.floor(rng() * pool.length)];
  return { letter, used: [...used, letter] };
}
function filledCount(arr: string[] | undefined, n: number): number {
  if (!arr) return 0;
  let c = 0;
  for (let i = 0; i < n; i++) if ((arr[i] ?? "").trim() !== "") c++;
  return c;
}

function beginRound(state: PmState, round: number, now: number, rng: () => number): PmState {
  const { letter, used } = pickLetter(state, rng);
  return {
    ...state,
    round,
    phase: "losowanie",
    letter,
    usedLetters: used,
    phaseEndsAt: now + COUNTDOWN_MS,
    answers: {},
    stoppedBy: null,
    verifyCat: 0,
    rejected: {},
    active: null,
    roundScores: {},
    breakdown: null,
    pendingEvents: [{ type: "runda", text: `Runda ${round} - litera ${letter}` }],
  };
}

function startWriting(state: PmState, now: number): PmState {
  const timed = state.settings.endMode === "czas";
  return {
    ...state,
    phase: "pisanie",
    phaseEndsAt: timed ? now + state.settings.timeLimitMs : null,
    pendingEvents: [],
  };
}

function toVerify(state: PmState): PmState {
  return {
    ...state,
    phase: "weryfikacja",
    verifyCat: 0,
    active: null,
    phaseEndsAt: null,
    pendingEvents: [{ type: "weryfikacja", text: "Weryfikacja odpowiedzi" }],
  };
}

function computeScores(state: PmState): { roundScores: Record<string, number>; breakdown: CatResult[] } {
  const roundScores: Record<string, number> = {};
  for (const uid of state.playerUids) roundScores[uid] = 0;
  const breakdown: CatResult[] = [];

  state.categories.forEach((category, c) => {
    const entries = state.playerUids.map((uid) => ({ uid, answer: (state.answers[uid]?.[c] ?? "").trim() }));
    const valid = entries.filter(
      (e) => e.answer !== "" && firstLetterOk(e.answer, state.letter) && !state.rejected[e.uid]?.[c],
    );
    // grupy po znormalizowanej odpowiedzi (dedup: Łódź = lodz = Lodz)
    const groups: Record<string, number> = {};
    for (const e of valid) groups[norm(e.answer)] = (groups[norm(e.answer)] ?? 0) + 1;

    const results: AnswerResult[] = entries.map((e) => {
      if (e.answer === "") return { ...e, points: 0, status: "empty" as const };
      if (!firstLetterOk(e.answer, state.letter)) return { ...e, points: 0, status: "letter" as const };
      if (state.rejected[e.uid]?.[c]) return { ...e, points: 0, status: "rejected" as const };
      let points: number, status: AnswerResult["status"];
      if (valid.length === 1) {
        points = 15;
        status = "p15";
      } else if (groups[norm(e.answer)] === 1) {
        points = 10;
        status = "p10";
      } else {
        points = 5;
        status = "p5";
      }
      roundScores[e.uid] += points;
      return { ...e, points, status };
    });
    breakdown.push({ category, answers: results });
  });
  return { roundScores, breakdown };
}

function toResults(state: PmState, now: number): PmState {
  const { roundScores, breakdown } = computeScores(state);
  const scores = { ...state.scores };
  for (const uid of state.playerUids) scores[uid] = (scores[uid] ?? 0) + roundScores[uid];
  return {
    ...state,
    phase: "wyniki",
    phaseEndsAt: now + REVEAL_MS,
    roundScores,
    breakdown,
    scores,
    pendingEvents: [{ type: "wyniki", text: `Runda ${state.round} rozliczona` }],
  };
}

function advance(state: PmState, now: number, rng: () => number): PmState {
  const total = state.settings.rounds;
  if (total !== 0 && state.round >= total) {
    return { ...state, phase: "koniec", phaseEndsAt: null, pendingEvents: [{ type: "koniec", text: "Koniec gry!" }] };
  }
  return beginRound(state, state.round + 1, now, rng);
}

function resolveChallenge(state: PmState): PmState {
  const a = state.active;
  if (!a) return state;
  const odrzucam = Object.values(a.votes).filter((v) => v === "odrzucam").length;
  const uznaje = Object.values(a.votes).filter((v) => v === "uznaje").length;
  const rejected = odrzucam > uznaje; // remis = uznana (SPEC §5.3)
  const nextRejected = rejected
    ? { ...state.rejected, [a.targetUid]: { ...(state.rejected[a.targetUid] ?? {}), [a.cat]: true as const } }
    : state.rejected;
  return {
    ...state,
    rejected: nextRejected,
    active: null,
    phaseEndsAt: null,
    pendingEvents: [{ type: "werdykt", text: rejected ? "Odpowiedź odrzucona" : "Odpowiedź uznana" }],
  };
}

function requireHost(state: PmState, uid: string) {
  if (uid !== state.hostUid) throw new GameError("Tylko host może przejść dalej.", 403);
}

export const pmEngine: GameEngine<PmState, PmAction, PmSettings> = {
  id: "panstwa-miasta",
  actionSchema: pmActionSchema,

  init(ctx: InitContext<PmSettings>): PmState {
    const hostUid = Object.values(ctx.players).find((p) => p.isHost)?.uid ?? ctx.seatOrder[0];
    const categories =
      ctx.settings.customCategories && ctx.settings.customCategories.length > 0
        ? ctx.settings.customCategories
        : CATEGORY_SETS[ctx.settings.categorySet].categories;
    const letterPool = [...BASE_LETTERS, ...(ctx.settings.hardcore ? HARDCORE_LETTERS : [])];
    const base: PmState = {
      settings: ctx.settings,
      hostUid,
      playerUids: ctx.seatOrder.length ? ctx.seatOrder : Object.keys(ctx.players),
      categories,
      letterPool,
      usedLetters: [],
      round: 0,
      phase: "losowanie",
      phaseEndsAt: null,
      letter: "",
      answers: {},
      stoppedBy: null,
      verifyCat: 0,
      rejected: {},
      active: null,
      roundScores: {},
      scores: {},
      breakdown: null,
      pendingEvents: [],
    };
    return beginRound(base, 1, ctx.now, ctx.rng);
  },

  reduce(state, action, ctx): PmState {
    if (action.type === "PHASE_TIMEOUT") {
      if (state.phase === "losowanie") return startWriting(state, ctx.now);
      if (state.phase === "pisanie") return toVerify(state);
      if (state.phase === "weryfikacja") return state.active ? resolveChallenge(state) : state;
      if (state.phase === "wyniki") return advance(state, ctx.now, ctx.rng);
      return state;
    }

    if (action.type === "FINISH") {
      requireHost(state, ctx.uid);
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
      requireHost(state, ctx.uid);
      if (state.phase === "losowanie") return startWriting(state, ctx.now);
      if (state.phase === "pisanie") return toVerify(state);
      if (state.phase === "wyniki") return advance(state, ctx.now, ctx.rng);
      if (state.phase === "weryfikacja") {
        if (state.active) return resolveChallenge(state); // domknij trwające głosowanie
        return toResults(state, ctx.now); // wszystkie odpowiedzi widoczne od razu → host podlicza
      }
      return state;
    }

    if (action.type === "SUBMIT_ANSWERS") {
      if (state.phase !== "pisanie") throw new GameError("Nie ta faza.");
      if (!state.playerUids.includes(ctx.uid)) throw new GameError("Nie jesteś w grze.", 403);
      const arr = state.categories.map((_, i) => (action.answers[i] ?? "").slice(0, 60));
      return { ...state, answers: { ...state.answers, [ctx.uid]: arr }, pendingEvents: [] };
    }

    if (action.type === "STOP") {
      if (state.phase !== "pisanie") throw new GameError("Nie ta faza.");
      if (state.settings.endMode !== "stop") throw new GameError("STOP niedostępny w tym trybie.");
      if (state.stoppedBy) throw new GameError("Ktoś już zakończył rundę.");
      const mine = state.answers[ctx.uid];
      if (filledCount(mine, state.categories.length) < state.categories.length)
        throw new GameError("Najpierw wypełnij wszystkie pola.");
      const nick = ctx.uid;
      return {
        ...state,
        stoppedBy: ctx.uid,
        phaseEndsAt: ctx.now + state.settings.graceMs,
        pendingEvents: [
          { type: "stop", text: `${nick} skończył! Reszta ma ${Math.round(state.settings.graceMs / 1000)} s`, meta: { uid: ctx.uid } },
        ],
      };
    }

    if (action.type === "CHALLENGE") {
      if (state.phase !== "weryfikacja") throw new GameError("Nie ta faza.");
      if (state.active) throw new GameError("Trwa już głosowanie.");
      if (action.cat < 0 || action.cat >= state.categories.length) throw new GameError("Nie ma takiej kategorii.");
      if (action.targetUid === ctx.uid) throw new GameError("Nie kwestionujesz własnej odpowiedzi.");
      if (!state.playerUids.includes(action.targetUid)) throw new GameError("Nie ma takiego gracza.");
      const ans = (state.answers[action.targetUid]?.[action.cat] ?? "").trim();
      if (!ans) throw new GameError("Nie ma czego kwestionować.");
      if (state.rejected[action.targetUid]?.[action.cat]) throw new GameError("Już odrzucona.");
      return {
        ...state,
        active: { targetUid: action.targetUid, cat: action.cat, by: ctx.uid, justification: "", votes: {} },
        phaseEndsAt: ctx.now + CHALLENGE_MS,
        pendingEvents: [{ type: "kwestia", text: "Odpowiedź zakwestionowana - głosujcie" }],
      };
    }

    if (action.type === "JUSTIFY") {
      if (!state.active) throw new GameError("Nie ma czego uzasadniać.");
      if (ctx.uid !== state.active.targetUid) throw new GameError("Tylko autor może się bronić.", 403);
      return { ...state, active: { ...state.active, justification: action.text.trim().slice(0, 200) }, pendingEvents: [] };
    }

    if (action.type === "VOTE") {
      if (!state.active) throw new GameError("Nie ma głosowania.");
      if (ctx.uid === state.active.targetUid) throw new GameError("Autor nie głosuje nad sobą.");
      if (!state.playerUids.includes(ctx.uid)) throw new GameError("Nie jesteś w grze.", 403);
      const votes = { ...state.active.votes, [ctx.uid]: action.verdict };
      const next = { ...state, active: { ...state.active, votes } };
      // wszyscy oprócz autora zagłosowali → rozstrzygamy
      const eligible = state.playerUids.filter((u) => u !== state.active!.targetUid);
      if (eligible.every((u) => votes[u])) return resolveChallenge(next);
      return { ...next, pendingEvents: [] };
    }

    return state;
  },

  publicView(state, players: PlayerMap) {
    const playersView = state.playerUids.map((uid) => ({
      uid,
      nick: players[uid]?.nick ?? "?",
      avatar: players[uid]?.avatar ?? "❓",
      score: state.scores[uid] ?? 0,
      roundDelta: state.roundScores[uid] ?? 0,
    }));

    const base = {
      round: state.round,
      totalRounds: state.settings.rounds,
      phase: state.phase,
      letter: state.letter,
      categories: state.categories,
      players: playersView,
      // Rdzeń pokazuje „Zakończ grę" zamiast awaryjnego przerwania (patrz GameShell).
      canFinish: state.phase === "wyniki",
    };

    if (state.phase === "pisanie") {
      return {
        ...base,
        stoppedBy: state.stoppedBy,
        // TYLKO ile pól wypełnione (nie treść) — odpowiedzi tajne do końca pisania.
        progress: state.playerUids.map((uid) => ({ uid, filled: filledCount(state.answers[uid], state.categories.length) })),
      };
    }

    if (state.phase === "weryfikacja") {
      // Cała plansza jawna od razu — każdy przegląda wszystkie kategorie i flaguje w swoim tempie.
      const board = state.categories.map((category, c) => ({
        cat: c,
        category,
        entries: state.playerUids.map((uid) => {
          const answer = (state.answers[uid]?.[c] ?? "").trim();
          return {
            uid,
            answer,
            autoZero: answer !== "" && !firstLetterOk(answer, state.letter),
            rejected: !!state.rejected[uid]?.[c],
          };
        }),
      }));
      return {
        ...base,
        board,
        active: state.active
          ? {
              targetUid: state.active.targetUid,
              by: state.active.by,
              justification: state.active.justification,
              voted: Object.keys(state.active.votes),
              tally: {
                uznaje: Object.values(state.active.votes).filter((v) => v === "uznaje").length,
                odrzucam: Object.values(state.active.votes).filter((v) => v === "odrzucam").length,
              },
            }
          : null,
      };
    }

    if (state.phase === "wyniki" || state.phase === "koniec") {
      return { ...base, breakdown: state.breakdown };
    }

    return base; // losowanie
  },

  privateView(state, uid: string) {
    if (state.phase === "pisanie") {
      return { answers: state.answers[uid] ?? state.categories.map(() => "") };
    }
    if (state.phase === "weryfikacja" && state.active) {
      return { myVote: state.active.votes[uid] ?? null, amTarget: state.active.targetUid === uid };
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
