import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { ApiError, requireUid } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { MAX_W_POKOJU } from "@/games/manifests";
import { newBot } from "@/lib/server/rooms";
import { codeParamSchema, dedupeAvatar, dedupeNick } from "@/lib/schemas/room";
import { FieldValue } from "firebase-admin/firestore";
import type { Room } from "@/lib/types/room";

export const runtime = "nodejs";

/** Awatar bota. Jeden na wszystkie, dedupe podmieni kolejnym, gdy będzie zajęty. */
const AWATAR_BOTA = "bot";
const NICK_BOTA = "Bot";

// POST /api/rooms/[code]/bot — host dosadza bota do lobby.
// DELETE /api/rooms/[code]/bot — host zabiera ostatnio dosadzonego.
//
// Bot NIE dołącza sam przez /join: nie ma tokenu z Firebase Auth i nigdy go mieć nie
// będzie. Wpis w `players` robi tu serwer, a ruchy wykonuje silnik gry przy wygaśnięciu
// tury, więc zasada 1 (klient nigdy nie zapisuje stanu gry) zostaje nienaruszona.
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const uid = await requireUid(req);
    const code = codeParamSchema.parse((await ctx.params).code);
    const db = getAdminDb();
    const ref = db.doc(`rooms/${code}`);
    const now = Date.now();

    let dodany = "";
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new ApiError(404, "Nie ma pokoju o tym kodzie.");
      const room = snap.data() as Room;
      if (room.hostUid !== uid) throw new ApiError(403, "Tylko host może dosadzić bota.");
      if (room.status !== "lobby") throw new ApiError(409, "Bota dosadzasz przed startem gry.");
      if (Object.keys(room.players).length >= MAX_W_POKOJU) {
        throw new ApiError(409, "Pokój jest pełny.");
      }

      const zajeteNicki = Object.values(room.players).map((p) => p.nick);
      const zajeteAwatary = Object.values(room.players).map((p) => p.avatar);
      const bot = newBot(
        dedupeNick(NICK_BOTA, zajeteNicki),
        dedupeAvatar(AWATAR_BOTA, zajeteAwatary),
        now,
      );
      dodany = bot.uid;
      t.update(ref, { [`players.${bot.uid}`]: bot, version: room.version + 1 });
    });

    return NextResponse.json({ uid: dodany });
  } catch (err) {
    return handleApiError(err);
  }
}

// Body: { wszystkie?: boolean }. Bez tego pola wychodzi jeden bot — ostatnio dosadzony,
// czyli odwrotność kliknięcia „dodaj". Z `wszystkie` wychodzą wszystkie naraz, jednym
// zapisem: tak lobby sprząta stół po przełączeniu na grę, która botów nie obsługuje.
export async function DELETE(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const uid = await requireUid(req);
    const code = codeParamSchema.parse((await ctx.params).code);
    const body = await req.json().catch(() => ({}));
    const wszystkie = body?.wszystkie === true;
    const db = getAdminDb();
    const ref = db.doc(`rooms/${code}`);

    let zabrany = "";
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new ApiError(404, "Nie ma pokoju o tym kodzie.");
      const room = snap.data() as Room;
      if (room.hostUid !== uid) throw new ApiError(403, "Tylko host może zabrać bota.");
      if (room.status !== "lobby") throw new ApiError(409, "Bota zabierasz przed startem gry.");

      // Ostatni dosadzony wychodzi pierwszy — to jest odwrotność kliknięcia „dodaj",
      // więc host cofa dokładnie to, co przed chwilą zrobił.
      const boty = Object.values(room.players)
        .filter((p) => p.bot)
        .sort((a, b) => b.joinedAt - a.joinedAt);
      // Sprzątanie po zmianie gry ma być IDEMPOTENTNE: pusty pokój nie jest błędem,
      // bo lobby wysyła to żądanie samo i nie ma komu pokazać komunikatu.
      if (!boty.length) {
        if (wszystkie) return;
        throw new ApiError(409, "W tym pokoju nie ma botów.");
      }

      const doZabrania = wszystkie ? boty : [boty[0]];
      zabrany = doZabrania.map((b) => b.uid).join(",");
      const update: Record<string, unknown> = { version: room.version + 1 };
      for (const b of doZabrania) update[`players.${b.uid}`] = FieldValue.delete();
      t.update(ref, update);
    });

    return NextResponse.json({ uid: zabrany });
  } catch (err) {
    return handleApiError(err);
  }
}
