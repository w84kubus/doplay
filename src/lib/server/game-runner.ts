import "server-only";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { ApiError } from "./auth";
import { logger } from "./logger";
import { GAMES } from "@/games/registry";
import { mulberry32, randomSeed, shuffle } from "@/games/rng";
import { GameError, type GameEngine } from "@/games/types";
import type { Room } from "@/lib/types/room";
import { buildHighlights, winnersOf } from "./records";

// Runner gier (SPEC §3.1): JEDYNE miejsce, gdzie zapisuje się stan gry. Klient nigdy nie pisze.
// Każda akcja: zweryfikuj → uruchom czysty reducer → zapisz public/private/secret/events.

interface SecretState {
  fullState: unknown;
  seed: number;
  // C2: lista ostatnich actionId do odrzucania duplikatów.
  recentActionIds?: string[];
}

// Ile ostatnich actionId trzymamy w secret state (reszta się rotuje).
const MAX_RECENT_ACTION_IDS = 50;

function getGame(gameId: string) {
  const g = GAMES[gameId];
  if (!g) throw new ApiError(400, "Nieznana gra.");
  return g;
}

/**
 * Zapisuje nowy stan silnika do Firestore w ramach transakcji:
 * publicState (dla wszystkich), private/{uid} (tajemnice), secret/state (pełny stan + seed),
 * events (feed), oraz metadane fazy i wersję (optimistic lock).
 */
function persist(
  t: Transaction,
  ref: FirebaseFirestore.DocumentReference,
  room: Room,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  engine: GameEngine<any, any, any>,
  state: unknown,
  seed: number,
  now: number,
  recentActionIds?: string[],
  /** Poprzedni stan silnika — jeśli podany, private docs piszemy tylko gdy się zmieniły. */
  prevState?: unknown,
) {
  const players = room.players;
  const phase = engine.phase(state);
  const events = engine.drainEvents(state);
  const finished = engine.isFinished(state);
  const scores = engine.scores(state);

  // Bufor zdarzeń nie może zostać w trwałym stanie — czyścimy przed zapisem (SPEC §3.4).
  const cleanState =
    state && typeof state === "object"
      ? { ...(state as Record<string, unknown>), pendingEvents: [] }
      : state;

  const phaseChanged = phase.name !== room.phase;

  const update: Record<string, unknown> = {
    publicState: engine.publicView(state, players),
    phase: phase.name,
    phaseEndsAt: phase.endsAt,
    phaseStartedAt: phaseChanged ? now : (room.phaseStartedAt ?? now),
    status: finished ? "finished" : "playing",
    version: room.version + 1,
  };

  t.set(ref.collection("secret").doc("state"), {
    fullState: cleanState,
    seed,
    ...(recentActionIds ? { recentActionIds } : {}),
  });

  // E1: selektywny zapis private docs — piszemy tylko te, które się zmieniły (UPGRADE.md §E).
  // Zmniejsza snapshot reads na kliencie (każdy zapis = 1 read per listener).
  for (const uid of Object.keys(players)) {
    const next = engine.privateView(state, uid) ?? null;
    if (prevState) {
      const prev = engine.privateView(prevState, uid) ?? null;
      if (JSON.stringify(prev) === JSON.stringify(next)) continue;
    }
    t.set(ref.collection("private").doc(uid), { payload: next });
  }

  for (const ev of events) {
    t.set(ref.collection("events").doc(), {
      at: FieldValue.serverTimestamp(),
      type: ev.type,
      text: ev.text,
      meta: ev.meta ?? {},
    });
  }

  // Na koniec gry doliczamy wynik do totalScore (SPEC §3.2).
  if (finished) {
    for (const [uid, score] of Object.entries(scores)) {
      if (players[uid]) update[`players.${uid}.totalScore`] = FieldValue.increment(score);
    }
  }

  // —— Rekordy pokoju (UPGRADE.md §8) ——
  // Rdzeń nie zna żadnej konkretnej gry: wygrane liczy z engine.scores(), a wyróżnienia
  // bierze z tych zdarzeń, które silnik SAM oznaczył jako meta.rekord === true.
  // Gra, która tego nie robi, po prostu nie ma wyróżnień — bez zmian w rdzeniu (CLAUDE.md §4).
  if (finished) {
    update["records.gamesPlayed"] = FieldValue.increment(1);
    for (const uid of winnersOf(scores)) {
      if (players[uid]) update[`records.wins.${uid}`] = FieldValue.increment(1);
    }
  }

  const highlights = buildHighlights(events, room.gameId ?? "", now, room.records?.highlights);
  if (highlights) update["records.highlights"] = highlights;

  t.update(ref, update);
}

/** Host startuje grę: losuje seatOrder i seed, uruchamia init, zapisuje pełny stan. */
export async function startGame(
  code: string,
  hostUid: string,
  gameId: string,
  rawSettings: unknown,
  now: number,
) {
  const db = getAdminDb();
  const ref = db.doc(`rooms/${code}`);
  const { engine, manifest } = getGame(gameId);

  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) throw new ApiError(404, "Nie ma pokoju.");
    const room = snap.data() as Room;

    if (room.hostUid !== hostUid) throw new ApiError(403, "Tylko host może zacząć grę.");
    if (room.status !== "lobby") throw new ApiError(409, "Gra już trwa.");

    const count = Object.keys(room.players).length;
    if (count < manifest.minPlayers)
      throw new ApiError(409, `Za mało graczy - potrzeba min. ${manifest.minPlayers}.`);
    if (count > manifest.maxPlayers)
      throw new ApiError(409, `Za dużo graczy - max ${manifest.maxPlayers}.`);

    const settings = manifest.settingsSchema.parse(rawSettings ?? manifest.defaultSettings);
    const seed = randomSeed();
    const rng = mulberry32(seed);
    const seatOrder = shuffle(Object.keys(room.players), rng);

    const state = engine.init({ players: room.players, seatOrder, settings, now, rng, seed });

    t.update(ref, { gameId, settings, seatOrder, round: 0, narratorUid: room.narratorUid ?? null });
    persist(t, ref, { ...room, seatOrder, phase: "" }, engine, state, seed, now);
    logger.info("gra wystartowała", { room: code, game: gameId });
  });
}

/** Zwykła akcja gracza z klienta. actionId (C2) — opcjonalny UUID do odrzucania duplikatów. */
export async function applyAction(code: string, uid: string, rawAction: unknown, now: number, actionId?: string) {
  const db = getAdminDb();
  const ref = db.doc(`rooms/${code}`);

  await db.runTransaction(async (t) => {
    const [roomSnap, secretSnap] = await Promise.all([
      t.get(ref),
      t.get(ref.collection("secret").doc("state")),
    ]);
    if (!roomSnap.exists) throw new ApiError(404, "Nie ma pokoju.");
    const room = roomSnap.data() as Room;
    if (room.status !== "playing" || !room.gameId) throw new ApiError(409, "Gra nie trwa.");
    if (!room.players[uid]) throw new ApiError(403, "Nie jesteś w tej grze.");

    const { engine } = getGame(room.gameId);
    const secret = secretSnap.data() as SecretState;

    // C2: odrzucenie duplikatu (ten sam actionId już przetworzony).
    const recentIds = secret.recentActionIds ?? [];
    if (actionId && recentIds.includes(actionId)) {
      throw new ApiError(409, "Duplikat akcji.");
    }

    const action = engine.actionSchema.parse(rawAction);
    // rng odtwarzalne z (seed, version): deterministyczne i różne per akcja (SPEC §3.4).
    const rng = mulberry32((secret.seed + room.version) >>> 0);

    let next: unknown;
    try {
      next = engine.reduce(secret.fullState, action, { uid, now, rng });
    } catch (err) {
      if (err instanceof GameError) throw new ApiError(err.status, err.message);
      throw err;
    }

    // C2: zapamiętaj actionId w secret state (rotuj, żeby nie rósł bez końca).
    const updatedIds = actionId
      ? [...recentIds, actionId].slice(-MAX_RECENT_ACTION_IDS)
      : recentIds;

    const phase = engine.phase(next);
    persist(t, ref, room, engine, next, secret.seed, now, updatedIds, secret.fullState);
    logger.info("akcja", { room: code, game: room.gameId!, phase: phase.name, action: action.type as string });
  });
}

/** Tick fazy (SPEC §3.5): jeśli phaseEndsAt minął wg zegara SERWERA — odpal PHASE_TIMEOUT. */
export async function tickGame(code: string, now: number): Promise<boolean> {
  const db = getAdminDb();
  const ref = db.doc(`rooms/${code}`);

  // Tani odczyt PRZED transakcją: zdecydowana większość ticków trafia w fazę, która
  // jeszcze nie wygasła. Otwieranie dla nich transakcji brało blokady na gorącym
  // dokumencie pokoju i wpychało nas ponad limit ~1 zapisu/s, przez co PRAWDZIWE
  // przejścia faz czekały w kolejce na ponowienia. Zwykły get() blokad nie bierze.
  const peek = await ref.get();
  if (!peek.exists) return false;
  const peeked = peek.data() as Room;
  if (peeked.status !== "playing" || !peeked.gameId) return false;
  if (peeked.phaseEndsAt == null || now < peeked.phaseEndsAt) return false;

  // Faza faktycznie wygasła — dopiero teraz transakcja (stan sprawdzamy w niej ponownie,
  // bo między peekiem a transakcją inny klient mógł już przestawić fazę).
  return db.runTransaction(async (t) => {
    const [roomSnap, secretSnap] = await Promise.all([
      t.get(ref),
      t.get(ref.collection("secret").doc("state")),
    ]);
    if (!roomSnap.exists) return false;
    const room = roomSnap.data() as Room;
    if (room.status !== "playing" || !room.gameId) return false;
    if (room.phaseEndsAt == null || now < room.phaseEndsAt) return false; // jeszcze nie czas

    const { engine } = getGame(room.gameId);
    const secret = secretSnap.data() as SecretState;
    const rng = mulberry32((secret.seed + room.version) >>> 0);
    const next = engine.reduce(secret.fullState, { type: "PHASE_TIMEOUT" }, {
      uid: "__system__",
      now,
      rng,
    });
    persist(t, ref, room, engine, next, secret.seed, now, undefined, secret.fullState);
    const newPhase = engine.phase(next);
    logger.info("tick", { room: code, game: room.gameId!, phase: newPhase.name });
    return true;
  });
}
