import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { ApiError, requireUid } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { MAX_W_POKOJU } from "@/games/manifests";
import { newPlayer } from "@/lib/server/rooms";
import { codeParamSchema, dedupeAvatar, dedupeNick, joinRoomSchema } from "@/lib/schemas/room";
import type { Player, Room } from "@/lib/types/room";

export const runtime = "nodejs";

// POST /api/rooms/[code]/join — dołącza gracza. Idempotentne: powrót tego samego uid = update.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  try {
    const uid = await requireUid(req);
    const code = codeParamSchema.parse((await ctx.params).code);
    const body = await req.json().catch(() => ({}));
    const { nick, avatar } = joinRoomSchema.parse(body);

    const db = getAdminDb();
    const ref = db.doc(`rooms/${code}`);
    const now = Date.now();

    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new ApiError(404, "Nie ma pokoju o tym kodzie.");
      const room = snap.data() as Room;

      const existing = room.players[uid];
      if (existing) {
        // Powrót gracza (np. odświeżenie): odśwież obecność, zostaw nick/awatar z powrotu.
        const updated: Player = {
          ...existing,
          nick: dedupeNick(nick, nicksExcept(room, uid)),
          avatar: dedupeAvatar(avatar, avatarsExcept(room, uid)),
          connected: true,
          lastSeenAt: now,
        };
        t.update(ref, {
          [`players.${uid}`]: updated,
          version: room.version + 1,
        });
        return;
      }

      if (room.status !== "lobby") {
        throw new ApiError(409, "Gra już trwa - poczekaj na koniec rundy.");
      }

      // Sprawdzane tylko dla NOWEGO gracza: wracający po odświeżeniu ma już swoje
      // miejsce i nie może się od tego odbić. Bez tego limitu publiczny pokój zbierałby
      // ludzi ponad pojemność każdej gry, a błąd zobaczyłby dopiero host przy starcie.
      if (Object.keys(room.players).length >= MAX_W_POKOJU) {
        throw new ApiError(409, "Pokój jest pełny.");
      }

      const finalNick = dedupeNick(nick, nicksExcept(room, uid));
      const finalAvatar = dedupeAvatar(avatar, avatarsExcept(room, uid));
      const player = newPlayer(uid, finalNick, finalAvatar, now, false);
      t.update(ref, {
        [`players.${uid}`]: player,
        version: room.version + 1,
      });
    });

    return NextResponse.json({ code });
  } catch (err) {
    return handleApiError(err);
  }
}

function avatarsExcept(room: Room, uid: string): string[] {
  return Object.values(room.players)
    .filter((p) => p.uid !== uid)
    .map((p) => p.avatar);
}

function nicksExcept(room: Room, uid: string): string[] {
  return Object.values(room.players)
    .filter((p) => p.uid !== uid)
    .map((p) => p.nick);
}
