// Model danych pokoju (SPEC §3.2). players i observers to MAPY (nie tablice) —
// łatwiejsze reguły Firestore i bezpieczne równoległe update'y (SPEC §8, pkt 4).

export type RoomStatus = "lobby" | "playing" | "finished";

export interface Player {
  uid: string;
  nick: string;
  avatar: string; // emoji
  joinedAt: number; // ms epoch (czas serwera)
  isHost: boolean;
  connected: boolean; // wyliczane lokalnie z lastSeenAt; w dokumencie trzymamy ostatnią znaną wartość
  lastSeenAt: number; // ms epoch, aktualizowane pingiem co 5 s (SPEC §3.7)
  totalScore: number;
  /**
   * Gracz sterowany przez komputer. Pole opcjonalne, więc stare dokumenty pokoi
   * pozostają poprawne bez migracji.
   *
   * Bot nie pinguje i nie ma tokenu, więc rdzeń musi go traktować inaczej w trzech
   * miejscach: obecność (bot jest zawsze „online"), migracja hosta (bot nie może zostać
   * hostem, bo nie odpala ticków) i kasowanie pokoju (pokój z samymi botami jest pusty).
   * Ruchy wykonuje silnik gry przy PHASE_TIMEOUT — patrz `boty` w silniku chińczyka.
   */
  bot?: true;
}

export type PlayerMap = Record<string, Player>;

/** Wyróżnienie zgłoszone przez silnik gry (zdarzenie z meta.rekord === true). */
export interface RoomHighlight {
  gameId: string;
  uid: string;
  /** Polski tekst — używany, gdy silnik nie podał klucza tłumaczenia. */
  text: string;
  key?: string;
  params?: Record<string, string | number>;
  at: number;
}

/**
 * Rekordy pokoju (UPGRADE.md §8) — trwałe przez cały czas życia pokoju (TTL 8 h).
 * Pisane WYŁĄCZNIE przez serwer w game-runnerze, jak każdy inny stan gry.
 */
export interface RoomRecords {
  wins: Record<string, number>; // uid -> ile gier wygrał
  gamesPlayed: number;
  highlights: RoomHighlight[]; // ostatnie wyróżnienia, od najnowszego
}

export const MAX_HIGHLIGHTS = 20;

export interface Room {
  code: string;
  createdAt: number;
  expiresAt: number; // TTL 8h (SPEC §3.7)
  hostUid: string;
  narratorUid: string | null;
  status: RoomStatus;
  /**
   * Czy pokój jest na publicznej liście. Host przełącza to w lobby, w obie strony:
   * otwiera, gdy nie ma z kim grać, i zamyka, gdy skład się skompletuje.
   */
  public: boolean;
  gameId: string | null;
  settings: Record<string, unknown>;
  players: PlayerMap;
  observers: Record<string, true>; // ekrany hosta (SPEC §3.9) — mają prawo czytać pokój
  seatOrder: string[]; // losowana raz przy starcie gry
  round: number;
  phase: string;
  phaseStartedAt: number | null;
  phaseEndsAt: number | null;
  publicState: Record<string, unknown>;
  version: number; // optimistic lock (SPEC §8, pkt 11)
  records?: RoomRecords;
}

// Ile ms bez pinga oznacza „rozłączony" (SPEC §3.7).
export const DISCONNECT_AFTER_MS = 20_000;
// Jak często klient pinguje (SPEC §3.7).
export const PING_INTERVAL_MS = 5_000;
// Żywotność pokoju (SPEC §3.7).
export const ROOM_TTL_MS = 8 * 60 * 60 * 1000;
