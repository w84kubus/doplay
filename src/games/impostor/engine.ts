import { z } from "zod";
import type { PlayerMap } from "@/lib/types/room";
import { GameError, type GameEngine, type GameEvent, type InitContext, type WithEvents } from "@/games/types";
import { shuffle } from "@/games/rng";
import { WORDS } from "./data/words";
import type { ImpostorSettings } from "./manifest";

// Impostor (SPEC §5.5). Czysta funkcja. BEZPIECZEŃSTWO: słowo, impostorzy i słowo-zamiennik
// żyją WYŁĄCZNIE w secret/state i private/{uid}. publicView nie może ich ujawnić do fazy wyniku.

const REVEAL_MS = 12000;
const GUESS_MS = 30000;

// Fazy, które czekają na konkretnych ludzi, muszą mieć termin — inaczej jeden gracz,
// któremu padł telefon, zawiesza partię reszty na zawsze. Limity są celowo hojne:
// mają łapać wyłącznie tych, którzy odeszli od stołu, a nie poganiać grających.
const ROZDANIE_MS = 90000;
// Tura podpowiedzi rośnie z liczbą graczy: w trybie „na głos" mówią po kolei,
// więc stały limit ucinałby normalną partię przy pełnym stole.
const PODPOWIEDZI_BAZA_MS = 30000;
const PODPOWIEDZI_NA_GRACZA_MS = 15000;

function turaKonczySie(state: ImpostorState, now: number): number {
  return now + PODPOWIEDZI_BAZA_MS + PODPOWIEDZI_NA_GRACZA_MS * state.playerUids.length;
}

type Phase = "rozdanie" | "podpowiedzi" | "dyskusja" | "glosowanie" | "zgadywanie" | "wynik" | "koniec";

export interface ImpostorState extends WithEvents {
  settings: ImpostorSettings;
  hostUid: string;
  playerUids: string[];
  round: number;
  phase: Phase;
  phaseEndsAt: number | null;
  word: string;
  category: string;
  podpowiedz: string;
  impostorWord: string;
  impostors: string[];
  confirmed: string[];
  speakingOrder: string[];
  clueRound: number;
  clues: { uid: string; round: number; word: string }[];
  votes: Record<string, string>;
  ejected: string | null;
  result: "gramy" | "cywile" | "impostorzy";
  byGuess: boolean;
  scores: Record<string, number>;
  roundScores: Record<string, number>;
}

export const impostorActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CONFIRM") }),
  z.object({ type: z.literal("CLUE"), word: z.string().min(1).max(30) }),
  z.object({ type: z.literal("NEXT_SPEAKER") }),
  z.object({ type: z.literal("VOTE"), targetUid: z.string() }),
  z.object({ type: z.literal("GUESS_WORD"), word: z.string().min(1).max(40) }),
  z.object({ type: z.literal("NEXT") }),
  z.object({ type: z.literal("FINISH") }), // host: zakończ grę (tryb rund „∞")
]);
export type ImpostorAction = z.infer<typeof impostorActionSchema>;

const DIA = new RegExp("[\\u0300-\\u036f]", "g");
function norm(s: string): string {
  return s.toLocaleLowerCase("pl").replace(/ł/g, "l").normalize("NFD").replace(DIA, "").replace(/\s+/g, "").trim();
}
// Dopasowanie z ignorowaniem końcówki fleksyjnej (plaża = plaza = plaze) — SPEC §5.5.
function wordMatch(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (x === y) return true;
  const stem = (w: string) => w.slice(0, Math.max(3, w.length - 2));
  return x.startsWith(stem(y)) || y.startsWith(stem(x));
}

function assignRoles(state: ImpostorState, now: number, rng: () => number): ImpostorState {
  const entry = WORDS[Math.floor(rng() * WORDS.length)];
  const impostors = shuffle(state.playerUids, rng).slice(0, Math.min(state.settings.impostorCount, state.playerUids.length - 1));
  const impostorWord = state.settings.hintType === "SLOWO_POWIAZANE"
    ? entry.powiazane[Math.floor(rng() * entry.powiazane.length)]
    : "";
  const order = shuffle(state.playerUids, rng);
  if (state.settings.impostorNeverStarts && impostors.includes(order[0])) {
    const j = order.findIndex((u) => !impostors.includes(u));
    if (j > 0) [order[0], order[j]] = [order[j], order[0]];
  }
  return {
    ...state,
    phase: "rozdanie",
    phaseEndsAt: now + ROZDANIE_MS,
    word: entry.slowo,
    category: entry.kategoria,
    podpowiedz: entry.podpowiedz,
    impostorWord,
    impostors,
    confirmed: [],
    speakingOrder: order,
    clueRound: 1,
    clues: [],
    votes: {},
    ejected: null,
    result: "gramy",
    byGuess: false,
    roundScores: {},
    pendingEvents: [{ type: "runda", text: `Runda ${state.round}: rozdanie ról` }],
  };
}

function beginRound(state: ImpostorState, round: number, now: number, rng: () => number): ImpostorState {
  return assignRoles({ ...state, round }, now, rng);
}

function startClues(state: ImpostorState, now: number): ImpostorState {
  return { ...state, phase: "podpowiedzi", clueRound: 1, clues: [], phaseEndsAt: turaKonczySie(state, now), pendingEvents: [{ type: "podpowiedzi", text: "Podpowiedzi - po jednym słowie" }] };
}

/** Tura podpowiedzi domknięta: albo kolejna tura, albo dyskusja. */
function poTurze(state: ImpostorState, clues: ImpostorState["clues"], now: number): ImpostorState {
  if (state.clueRound >= state.settings.clueRounds) return startDiscussion({ ...state, clues }, now);
  return {
    ...state,
    clues,
    clueRound: state.clueRound + 1,
    phaseEndsAt: turaKonczySie(state, now), // bez tego kolejna tura dziedziczyłaby minięty termin
    pendingEvents: [{ type: "tura", text: `Tura podpowiedzi ${state.clueRound + 1}` }],
  };
}

/** Termin tury minął: kto nie zdążył, pasuje z pustym słowem. */
function domknijTurePoCzasie(state: ImpostorState, now: number): ImpostorState {
  const mowili = new Set(state.clues.filter((c) => c.round === state.clueRound).map((c) => c.uid));
  const pasy = state.playerUids.filter((u) => !mowili.has(u)).map((u) => ({ uid: u, round: state.clueRound, word: "" }));
  return poTurze(state, [...state.clues, ...pasy], now);
}
function startDiscussion(state: ImpostorState, now: number): ImpostorState {
  const ms = state.settings.discussionMs;
  return { ...state, phase: "dyskusja", phaseEndsAt: ms ? now + ms : null, pendingEvents: [{ type: "dyskusja", text: "Dyskusja!" }] };
}
function startVoting(state: ImpostorState, now: number): ImpostorState {
  return { ...state, phase: "glosowanie", votes: {}, phaseEndsAt: now + 60000, pendingEvents: [{ type: "glosowanie", text: "Głosowanie - kto jest impostorem?" }] };
}

function score(state: ImpostorState, result: "cywile" | "impostorzy", byGuess: boolean): Record<string, number> {
  const rs: Record<string, number> = {};
  if (result === "cywile") {
    for (const uid of state.playerUids) if (!state.impostors.includes(uid)) rs[uid] = 1;
  } else {
    for (const uid of state.impostors) rs[uid] = byGuess ? 3 : 2;
  }
  return rs;
}
function toResult(state: ImpostorState, now: number, result: "cywile" | "impostorzy", byGuess: boolean): ImpostorState {
  const roundScores = score(state, result, byGuess);
  const scores = { ...state.scores };
  for (const [uid, pts] of Object.entries(roundScores)) scores[uid] = (scores[uid] ?? 0) + pts;
  return {
    ...state,
    phase: "wynik",
    phaseEndsAt: now + REVEAL_MS,
    result,
    byGuess,
    roundScores,
    scores,
    pendingEvents: [
      { type: "wynik", text: result === "cywile" ? "Cywile wykryli impostora!" : byGuess ? "Impostor odgadł hasło!" : "Impostorzy wygrywają!" },
      // Wylot i mimo to trafione hasło — to jest wyczyn, nie zwykła wygrana.
      // meta.rekord === true → rdzeń dopisuje do „Rekordów pokoju" (UPGRADE.md §8).
      ...(byGuess
        ? state.impostors.map((uid) => ({
            type: "rekord",
            text: "Wyleciał i i tak odgadł hasło",
            key: "feat.impostor.guessed",
            meta: { uid, rekord: true },
          }))
        : []),
    ],
  };
}

function resolveVote(state: ImpostorState, now: number): ImpostorState {
  // policz głosy
  const tally: Record<string, number> = {};
  for (const t of Object.values(state.votes)) tally[t] = (tally[t] ?? 0) + 1;
  let top: string | null = null, max = 0, tie = false;
  for (const [uid, n] of Object.entries(tally)) {
    if (n > max) { max = n; top = uid; tie = false; }
    else if (n === max) tie = true;
  }
  if (!top || tie) {
    // remis → nikt nie wylatuje → impostorzy przetrwali
    return toResult({ ...state, ejected: null }, now, "impostorzy", false);
  }
  const ejectedImpostor = state.impostors.includes(top);
  const s2 = { ...state, ejected: top };
  if (ejectedImpostor) {
    // złapany; jeśli włączone — dostaje szansę odgadnięcia hasła
    if (state.settings.postEjectGuess) {
      return { ...s2, phase: "zgadywanie", phaseEndsAt: now + GUESS_MS, pendingEvents: [{ type: "wylot", text: "Impostor wyleciał - ma 30 s na hasło!" }] };
    }
    return toResult(s2, now, "cywile", false);
  }
  // wyleciał cywil → impostorzy wygrywają
  return toResult(s2, now, "impostorzy", false);
}

function advance(state: ImpostorState, now: number, rng: () => number): ImpostorState {
  const total = state.settings.rounds;
  if (total !== 0 && state.round >= total) {
    return { ...state, phase: "koniec", phaseEndsAt: null, pendingEvents: [{ type: "koniec", text: "Koniec gry!" }] };
  }
  return beginRound(state, state.round + 1, now, rng);
}

function requireHost(state: ImpostorState, uid: string) {
  if (uid !== state.hostUid) throw new GameError("Tylko host.", 403);
}

export const impostorEngine: GameEngine<ImpostorState, ImpostorAction, ImpostorSettings> = {
  id: "impostor",
  actionSchema: impostorActionSchema,

  init(ctx: InitContext<ImpostorSettings>): ImpostorState {
    const hostUid = Object.values(ctx.players).find((p) => p.isHost)?.uid ?? ctx.seatOrder[0];
    const base: ImpostorState = {
      settings: ctx.settings, hostUid,
      playerUids: ctx.seatOrder.length ? ctx.seatOrder : Object.keys(ctx.players),
      round: 0, phase: "rozdanie", phaseEndsAt: null,
      word: "", category: "", podpowiedz: "", impostorWord: "", impostors: [],
      confirmed: [], speakingOrder: [], clueRound: 1, clues: [], votes: {}, ejected: null,
      result: "gramy", byGuess: false, scores: {}, roundScores: {}, pendingEvents: [],
    };
    return beginRound(base, 1, ctx.now, ctx.rng);
  },

  reduce(state, action, ctx): ImpostorState {
    const isImpostor = state.impostors.includes(ctx.uid);

    if (action.type === "PHASE_TIMEOUT") {
      if (state.phase === "dyskusja") return startVoting(state, ctx.now);
      if (state.phase === "glosowanie") return resolveVote(state, ctx.now);
      if (state.phase === "zgadywanie") return toResult(state, ctx.now, "cywile", false); // impostor nie zdążył
      if (state.phase === "wynik") return advance(state, ctx.now, ctx.rng);
      // Fazy czekające na ludzi: ruszamy dalej z tym, kto jest. Bez tego jeden
      // gracz, który zniknął przed potwierdzeniem roli, zawiesza partię reszty.
      if (state.phase === "rozdanie") return startClues(state, ctx.now);
      if (state.phase === "podpowiedzi") return domknijTurePoCzasie(state, ctx.now);
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
      if (state.phase === "dyskusja") return startVoting(state, ctx.now);
      if (state.phase === "wynik") return advance(state, ctx.now, ctx.rng);
      if (state.phase === "podpowiedzi") return startDiscussion(state, ctx.now);
      return state;
    }

    // Impostor może zgadnąć w dowolnym momencie (opcja) — pudło = przegrana (SPEC §5.5).
    if (action.type === "GUESS_WORD") {
      const inGuessPhase = state.phase === "zgadywanie" && ctx.uid === state.ejected;
      const anytime = state.settings.impostorCanGuessAnytime && isImpostor && (state.phase === "podpowiedzi" || state.phase === "dyskusja");
      if (!inGuessPhase && !anytime) throw new GameError("Nie możesz teraz zgadywać.");
      const correct = wordMatch(action.word, state.word);
      if (inGuessPhase) return toResult(state, ctx.now, correct ? "impostorzy" : "cywile", correct);
      return toResult(state, ctx.now, correct ? "impostorzy" : "cywile", correct);
    }

    if (action.type === "CONFIRM") {
      if (state.phase !== "rozdanie") throw new GameError("Nie ta faza.");
      if (state.confirmed.includes(ctx.uid)) return state;
      const confirmed = [...state.confirmed, ctx.uid];
      if (confirmed.length >= state.playerUids.length) return startClues({ ...state, confirmed }, ctx.now);
      return { ...state, confirmed, pendingEvents: [] };
    }

    if (action.type === "CLUE") {
      if (state.phase !== "podpowiedzi") throw new GameError("Nie ta faza.");
      if (state.settings.speakMode !== "tekstowy") throw new GameError("Podpowiedzi na głos.");
      if (!state.playerUids.includes(ctx.uid)) throw new GameError("Nie jesteś w grze.", 403);
      if (state.clues.some((c) => c.uid === ctx.uid && c.round === state.clueRound)) throw new GameError("Już podałeś słowo w tej turze.");
      const clues = [...state.clues, { uid: ctx.uid, round: state.clueRound, word: action.word.trim().slice(0, 30) }];
      const thisRound = clues.filter((c) => c.round === state.clueRound).length;
      if (thisRound >= state.playerUids.length) return poTurze(state, clues, ctx.now);
      return { ...state, clues, pendingEvents: [] };
    }

    if (action.type === "NEXT_SPEAKER") {
      if (state.phase !== "podpowiedzi" || state.settings.speakMode !== "na_glos") throw new GameError("Nie ta faza.");
      // prosta kolejka: host lub bieżący mówca posuwa; zapisujemy „pusty" ślad, by liczyć postęp
      const spokenThisRound = state.clues.filter((c) => c.round === state.clueRound).length;
      const speaker = state.speakingOrder[spokenThisRound];
      if (ctx.uid !== speaker && ctx.uid !== state.hostUid) throw new GameError("Nie twoja kolej.");
      const clues = [...state.clues, { uid: speaker, round: state.clueRound, word: "" }];
      const thisRound = clues.filter((c) => c.round === state.clueRound).length;
      if (thisRound >= state.playerUids.length) return poTurze(state, clues, ctx.now);
      return { ...state, clues, pendingEvents: [] };
    }

    if (action.type === "VOTE") {
      if (state.phase !== "glosowanie") throw new GameError("Nie ta faza.");
      if (!state.playerUids.includes(ctx.uid)) throw new GameError("Nie jesteś w grze.", 403);
      if (action.targetUid === ctx.uid) throw new GameError("Nie głosujesz na siebie.");
      if (!state.playerUids.includes(action.targetUid)) throw new GameError("Nie ma takiego gracza.");
      const votes = { ...state.votes, [ctx.uid]: action.targetUid };
      if (Object.keys(votes).length >= state.playerUids.length) return resolveVote({ ...state, votes }, ctx.now);
      return { ...state, votes, pendingEvents: [] };
    }

    return state;
  },

  publicView(state, players: PlayerMap) {
    const reveal = state.phase === "wynik" || state.phase === "koniec";
    const playersView = state.playerUids.map((uid) => ({
      uid, nick: players[uid]?.nick ?? "?", avatar: players[uid]?.avatar ?? "❓",
      score: state.scores[uid] ?? 0, roundDelta: state.roundScores[uid] ?? 0,
      confirmed: state.confirmed.includes(uid), voted: state.votes[uid] != null,
    }));
    return {
      // Rdzeń pokazuje „Zakończ grę" zamiast awaryjnego przerwania (patrz GameShell).
      canFinish: state.phase === "wynik",
      round: state.round, totalRounds: state.settings.rounds, phase: state.phase,
      speakMode: state.settings.speakMode, clueRound: state.clueRound, totalClueRounds: state.settings.clueRounds,
      speakingOrder: state.speakingOrder,
      currentSpeaker: state.settings.speakMode === "na_glos" && state.phase === "podpowiedzi"
        ? state.speakingOrder[state.clues.filter((c) => c.round === state.clueRound).length] ?? null : null,
      // słowa-podpowiedzi są jawne (tekstowy) — to część gry, ALE nie zdradzają hasła
      clues: state.settings.speakMode === "tekstowy" ? state.clues : [],
      cluesThisRound: state.clues.filter((c) => c.round === state.clueRound).map((c) => c.uid),
      ejected: state.ejected,
      votesTally: state.phase === "glosowanie" || reveal
        ? Object.values(state.votes).reduce<Record<string, number>>((a, t) => ((a[t] = (a[t] ?? 0) + 1), a), {})
        : {},
      result: state.result,
      byGuess: state.byGuess,
      players: playersView,
      // TAJNE do wyniku:
      word: reveal ? state.word : null,
      impostors: reveal ? state.impostors : [],
      category: reveal ? state.category : null,
    };
  },

  privateView(state, uid: string) {
    if (!state.playerUids.includes(uid)) return {};
    const isImpostor = state.impostors.includes(uid);
    const S = state.settings;

    // wariant „impostor nie wie, że jest impostorem" — dostaje słowo powiązane jak zwykłe hasło
    if (isImpostor && !S.impostorKnows && S.hintType === "SLOWO_POWIAZANE") {
      return { role: "cywil", word: state.impostorWord, hint: null, coImpostors: [] };
    }
    if (isImpostor) {
      let hint: string | null = null;
      if (S.hintType === "KATEGORIA") hint = state.category;
      else if (S.hintType === "PIERWSZA_LITERA") hint = state.word.charAt(0).toLocaleUpperCase("pl");
      else if (S.hintType === "PODPOWIEDZ") hint = state.podpowiedz;
      else if (S.hintType === "SLOWO_POWIAZANE") hint = state.impostorWord;
      return {
        role: "impostor",
        word: null,
        hint,
        hintType: S.hintType,
        coImpostors: S.impostorsKnow ? state.impostors.filter((u) => u !== uid) : [],
      };
    }
    return { role: "cywil", word: state.word, hint: null, coImpostors: [] };
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
