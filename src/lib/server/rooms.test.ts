import { describe, expect, it } from "vitest";
import { isConnected, maBota, newPlayer, pickNewHost, samiLudzie } from "./rooms";
import { DISCONNECT_AFTER_MS, type Player, type PlayerMap } from "@/lib/types/room";

function mkPlayers(now: number): PlayerMap {
  return {
    a: { ...newPlayer("a", "Ala", "🦊", now - 3000, true), lastSeenAt: now },
    b: { ...newPlayer("b", "Bob", "🐼", now - 2000, false), lastSeenAt: now },
    c: { ...newPlayer("c", "Cez", "🐧", now - 1000, false), lastSeenAt: now },
  };
}

describe("pickNewHost", () => {
  const now = 1_000_000;

  it("null gdy pokój pusty po wyjściu", () => {
    const players = { a: newPlayer("a", "Ala", "🦊", now, true) };
    expect(pickNewHost(players, [], "a", now)).toBeNull();
  });

  it("respektuje seatOrder", () => {
    const players = mkPlayers(now);
    expect(pickNewHost(players, ["c", "b", "a"], "a", now)).toBe("c");
  });

  it("bez seatOrder: najwcześniej dołączony połączony gracz", () => {
    const players = mkPlayers(now);
    // host a wychodzi; b dołączył przed c → b
    expect(pickNewHost(players, [], "a", now)).toBe("b");
  });

  it("pomija rozłączonych, jeśli jest ktoś połączony", () => {
    const players = mkPlayers(now);
    players.b.lastSeenAt = now - DISCONNECT_AFTER_MS - 1; // b rozłączony
    expect(pickNewHost(players, [], "a", now)).toBe("c");
  });
});

describe("boty w pokoju", () => {
  const bot = (uid: string, joinedAt = 0): Player => ({
    uid, nick: "Bot", avatar: "bot", joinedAt, isHost: false,
    connected: true, lastSeenAt: 0, totalScore: 0, bot: true,
  });

  it("bot jest zawsze online — nie pinguje, ale nigdzie się nie wybiera", () => {
    expect(isConnected(bot("bot_1"), 999_999)).toBe(true);
  });

  it("bot NIE zostaje hostem, nawet gdy stoi pierwszy w seatOrder", () => {
    const players: PlayerMap = {
      host: { uid: "host", nick: "H", avatar: "cat", joinedAt: 0, isHost: true, connected: true, lastSeenAt: 0, totalScore: 0 },
      bot_1: bot("bot_1", 1),
      ludzik: { uid: "ludzik", nick: "L", avatar: "dog", joinedAt: 2, isHost: false, connected: true, lastSeenAt: 0, totalScore: 0 },
    };
    // Bot pierwszy w kolejce — mimo to host ma trafić na człowieka: to host odpala ticki.
    expect(pickNewHost(players, ["bot_1", "ludzik", "host"], "host", 100)).toBe("ludzik");
  });

  it("pokój z samymi botami nie ma już nikogo żywego", () => {
    const players: PlayerMap = { bot_1: bot("bot_1"), bot_2: bot("bot_2", 1) };
    expect(samiLudzie(players)).toHaveLength(0);
    expect(pickNewHost(players, ["bot_1"], "kto-inny", 100)).toBeNull();
  });
});

describe("wykrywanie botów w składzie", () => {
  const czlowiek = (uid: string): Player => ({
    uid, nick: uid, avatar: "cat", joinedAt: 0, isHost: false,
    connected: true, lastSeenAt: 0, totalScore: 0,
  });
  const bot = (uid: string): Player => ({ ...czlowiek(uid), bot: true });

  it("pusty pokój i sami ludzie to brak botów", () => {
    expect(maBota({})).toBe(false);
    expect(maBota({ a: czlowiek("a"), b: czlowiek("b") })).toBe(false);
  });

  it("jeden bot wśród ludzi wystarczy", () => {
    // Na tym stoi bramka w `startGame`: gra bez `wspieraBoty` nie ruszy, gdy w pokoju
    // został bot z poprzedniej partii. Inaczej dostałby rolę i nigdy nic nie zrobił.
    expect(maBota({ a: czlowiek("a"), bot_1: bot("bot_1") })).toBe(true);
  });
});
