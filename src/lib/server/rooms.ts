import {
  DISCONNECT_AFTER_MS,
  ROOM_TTL_MS,
  type Player,
  type PlayerMap,
  type Room,
} from "@/lib/types/room";

export function isConnected(player: Player, now: number): boolean {
  if (player.bot) return true; // bot nie pinguje, ale nigdzie się nie wybiera
  return now - player.lastSeenAt < DISCONNECT_AFTER_MS;
}

/** Czy w pokoju został jeszcze ktokolwiek żywy. Pokój z samymi botami jest pusty. */
export function samiLudzie(players: PlayerMap): Player[] {
  return Object.values(players).filter((p) => !p.bot);
}

/**
 * Bot jako wpis w `players`. Ma własny uid z prefiksem, żeby nigdy nie zderzył się
 * z uid-em z Firebase Auth i żeby dało się go rozpoznać w logach.
 */
export function newBot(nick: string, avatar: string, now: number): Player {
  return {
    uid: `bot_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    nick,
    avatar,
    joinedAt: now,
    isHost: false,
    connected: true,
    lastSeenAt: now,
    totalScore: 0,
    bot: true,
  };
}

export function newPlayer(
  uid: string,
  nick: string,
  avatar: string,
  now: number,
  isHost: boolean,
): Player {
  return {
    uid,
    nick,
    avatar,
    joinedAt: now,
    isHost,
    connected: true,
    lastSeenAt: now,
    totalScore: 0,
  };
}

export function newRoom(code: string, host: Player, now: number): Room {
  return {
    code,
    createdAt: now,
    expiresAt: now + ROOM_TTL_MS,
    hostUid: host.uid,
    narratorUid: null,
    status: "lobby",
    public: false, // pokój zaczyna prywatnie; host otwiera go świadomie
    gameId: null,
    settings: {},
    players: { [host.uid]: host },
    observers: {},
    seatOrder: [],
    round: 0,
    phase: "lobby",
    phaseStartedAt: null,
    phaseEndsAt: null,
    publicState: {},
    version: 0,
  };
}

/**
 * Wybiera nowego hosta po wyjściu obecnego (SPEC §3.7).
 * Priorytet: kolejność z seatOrder → potem połączeni wg joinedAt → potem ktokolwiek wg joinedAt.
 * Zwraca uid nowego hosta albo null, jeśli pokój został pusty.
 */
export function pickNewHost(
  players: PlayerMap,
  seatOrder: string[],
  leavingUid: string,
  now: number,
): string | null {
  // Bot nie może zostać hostem: host odpala ticki i przełącza fazy, a bot nie ma
  // przeglądarki. Pokój z botem jako hostem stanąłby na pierwszej fazie z terminem.
  const candidates = Object.values(players).filter((p) => p.uid !== leavingUid && !p.bot);
  if (candidates.length === 0) return null;

  for (const uid of seatOrder) {
    const p = players[uid];
    if (p && p.uid !== leavingUid && !p.bot) return uid;
  }

  const byJoined = [...candidates].sort((a, b) => a.joinedAt - b.joinedAt);
  const connected = byJoined.find((p) => isConnected(p, now));
  return (connected ?? byJoined[0]).uid;
}
