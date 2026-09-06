import { z } from "zod";
import type { PlayerMap } from "@/lib/types/room";
import {
  GameError,
  type GameEngine,
  type GameEvent,
  type InitContext,
  type WithEvents,
} from "@/games/types";
import { accuracyOf, deltaE, hexOf, randomColor, type Rgb } from "./color";
import type { OdcienSettings } from "./manifest";

// Odcień (gra na pamięć kolorów). Silnik jest CZYSTĄ funkcją: zero Date.now/Math.random,
// czas i losowość wyłącznie z ctx.

const PERFECT_DE = 3; // poniżej tej różnicy oko praktycznie nie widzi rozbieżności

type Phase = "pokaz" | "zgadywanie" | "wynik" | "koniec";

interface Result {
  guess: Rgb;
  deltaE: number;
  accuracy: number; // 0–100
}

export interface OdcienState extends WithEvents {
  settings: OdcienSettings;
  hostUid: string;
  playerUids: string[];
  round: number;
  phase: Phase;
  phaseEndsAt: number | null;
  /**
   * Kolor do odtworzenia. TAJNY w fazie „zgadywanie" — publicView go wtedy NIE oddaje.
   * Gdyby został, każdy odczytałby go z DevToolsów i trafiał idealnie co rundę (SPEC §3.1).
   */
  target: Rgb;
  /** Typy graczy — też tajne do odsłonięcia, żeby nie podglądać się nawzajem. */
  guesses: Record<string, Rgb>;
  results: Record<string, Result>;
  scores: Record<string, number>;
  perfect: string[];
}

const rgbSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});

export const odcienActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SUBMIT"), color: rgbSchema }),
  z.object({ type: z.literal("NEXT") }),
  z.object({ type: z.literal("FINISH") }),
]);
export type OdcienAction = z.infer<typeof odcienActionSchema>;

function requireHost(state: OdcienState, uid: string) {
  if (uid !== state.hostUid) throw new GameError("Tylko host może to zrobić.", 403);
}

function beginRound(state: OdcienState, round: number, now: number, rng: () => number): OdcienState {
  return {
    ...state,
    round,
    phase: "pokaz",
    target: randomColor(rng),
    phaseEndsAt: now + state.settings.showMs,
    guesses: {},
    results: {},
    perfect: [],
    pendingEvents: [{ type: "runda", text: `Runda ${round}: zapamiętaj kolor`, key: "odcien.event.round", params: { round } }],
  };
}

function toReveal(state: OdcienState, now: number): OdcienState {
  const results: Record<string, Result> = {};
  for (const [uid, guess] of Object.entries(state.guesses)) {
    const dE = deltaE(state.target, guess);
    results[uid] = { guess, deltaE: dE, accuracy: accuracyOf(dE) };
  }
  const perfect = Object.keys(results).filter((uid) => results[uid].deltaE < PERFECT_DE);

  const scores = { ...state.scores };
  const events: GameEvent[] = [];
  const ranked = Object.entries(results).sort((a, b) => a[1].deltaE - b[1].deltaE);

  if (state.settings.scoring === "zwyciestwa") {
    // Remis daje punkt każdemu z najlepszym wynikiem — to gra imprezowa, nie ranking.
    const best = ranked[0]?.[1].deltaE;
    if (best != null) {
      for (const [uid, r] of ranked) if (r.deltaE === best) scores[uid] = (scores[uid] ?? 0) + 1;
    }
  } else {
    for (const [uid, r] of ranked) scores[uid] = (scores[uid] ?? 0) + r.accuracy;
  }

  for (const uid of perfect) {
    events.push({
      type: "idealnie",
      text: `Trafiony odcień - ${hexOf(results[uid].guess)}`,
      key: "feat.odcien.perfect",
      params: { hex: hexOf(results[uid].guess) },
      meta: { uid, rekord: true },
    });
  }

  return {
    ...state,
    phase: "wynik",
    phaseEndsAt: state.settings.revealMs > 0 ? now + state.settings.revealMs : null,
    results,
    perfect,
    scores,
    pendingEvents: events,
  };
}

function advanceOrFinish(state: OdcienState, now: number, rng: () => number): OdcienState {
  const total = state.settings.rounds;
  if (total !== 0 && state.round >= total) {
    return { ...state, phase: "koniec", phaseEndsAt: null, pendingEvents: [{ type: "koniec", text: "Koniec gry!" }] };
  }
  return beginRound(state, state.round + 1, now, rng);
}

export const odcienEngine: GameEngine<OdcienState, OdcienAction, OdcienSettings> = {
  id: "odcien",
  actionSchema: odcienActionSchema,

  init(ctx: InitContext<OdcienSettings>): OdcienState {
    const hostUid = Object.values(ctx.players).find((p) => p.isHost)?.uid ?? ctx.seatOrder[0];
    const base: OdcienState = {
      settings: ctx.settings,
      hostUid,
      playerUids: ctx.seatOrder.length ? ctx.seatOrder : Object.keys(ctx.players),
      round: 0,
      phase: "pokaz",
      phaseEndsAt: null,
      target: { r: 0, g: 0, b: 0 },
      guesses: {},
      results: {},
      scores: {},
      perfect: [],
      pendingEvents: [],
    };
    return beginRound(base, 1, ctx.now, ctx.rng);
  },

  reduce(state, action, ctx): OdcienState {
    if (action.type === "PHASE_TIMEOUT") {
      // Koniec pokazu → chowamy kolor i wpuszczamy suwaki.
      if (state.phase === "pokaz") {
        return {
          ...state,
          phase: "zgadywanie",
          phaseEndsAt: null,
          pendingEvents: [{ type: "zgadywanie", text: "Odtwórz kolor!", key: "odcien.event.guess" }],
        };
      }
      if (state.phase === "wynik") return advanceOrFinish(state, ctx.now, ctx.rng);
      return state;
    }

    if (action.type === "FINISH") {
      requireHost(state, ctx.uid);
      if (state.phase === "koniec") return state;
      // Ze zgadywania najpierw rozliczamy to, co gracze zdążyli wysłać.
      const settled = state.phase === "zgadywanie" ? toReveal(state, ctx.now) : state;
      return {
        ...settled,
        phase: "koniec",
        phaseEndsAt: null,
        pendingEvents: [...(settled.pendingEvents ?? []), { type: "koniec", text: "Koniec gry!" }],
      };
    }

    if (action.type === "NEXT") {
      requireHost(state, ctx.uid);
      if (state.phase === "wynik") return advanceOrFinish(state, ctx.now, ctx.rng);
      if (state.phase === "zgadywanie") return toReveal(state, ctx.now); // host zamyka wcześniej
      if (state.phase === "pokaz") {
        return { ...state, phase: "zgadywanie", phaseEndsAt: null, pendingEvents: [] };
      }
      return state;
    }

    // SUBMIT
    if (state.phase !== "zgadywanie") throw new GameError("Nie teraz.");
    if (!state.playerUids.includes(ctx.uid)) throw new GameError("Nie jesteś w tej rundzie.", 403);
    if (state.guesses[ctx.uid]) throw new GameError("Już wysłałeś swój kolor.");

    const guesses = { ...state.guesses, [ctx.uid]: action.color };
    const next: OdcienState = { ...state, guesses, pendingEvents: [] };
    const allIn = state.playerUids.every((uid) => guesses[uid]);
    return allIn ? toReveal(next, ctx.now) : next;
  },

  publicView(state, players: PlayerMap) {
    const reveal = state.phase === "wynik" || state.phase === "koniec";
    const view: Record<string, unknown> = {
      phase: state.phase,
      round: state.round,
      totalRounds: state.settings.rounds,
      space: state.settings.space,
      scoring: state.settings.scoring,
      // Rdzeń pokazuje „Zakończ grę" zamiast awaryjnego przerwania (patrz GameShell).
      canFinish: state.phase === "wynik",
      // Konwencja dla rdzenia: ta gra wymaga neutralnego tła do oceny koloru.
      // Kolorowy gradient przesuwa postrzeganą barwę i psuje sedno rozgrywki.
      // Gra bez tej flagi dostaje zwykłe tło Arcade — zero zmian w rdzeniu (CLAUDE.md §4).
      neutralBg: true,
      // Kto już wysłał — same uid, BEZ kolorów, żeby nikt się nie podpatrywał.
      submitted: Object.keys(state.guesses),
      players: state.playerUids.map((uid) => ({
        uid,
        nick: players[uid]?.nick ?? "?",
        avatar: players[uid]?.avatar ?? "",
        score: state.scores[uid] ?? 0,
      })),
    };

    // Kolor jest jawny TYLKO gdy go pokazujemy i po odsłonięciu. W fazie „zgadywanie"
    // musi zniknąć z publicState — inaczej wystarczy DevTools, żeby wygrywać co rundę.
    if (state.phase === "pokaz" || reveal) view.target = hexOf(state.target);

    if (reveal) {
      view.results = Object.entries(state.results)
        .map(([uid, r]) => ({ uid, hex: hexOf(r.guess), deltaE: Math.round(r.deltaE * 10) / 10, accuracy: r.accuracy }))
        .sort((a, b) => a.deltaE - b.deltaE);
      view.perfect = state.perfect;
    }
    return view;
  },

  privateView(state, uid: string) {
    // Własny typ widzisz zawsze — cudzych nie, dopóki nie ma odsłonięcia.
    const mine = state.guesses[uid];
    return { myGuess: mine ? hexOf(mine) : null, submitted: !!mine };
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
