import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { ApiError, requireUid } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { codeParamSchema } from "@/lib/schemas/room";
import type { Room } from "@/lib/types/room";

export const runtime = "nodejs";

// POST /api/rooms/[code]/publiczny — host otwiera pokój dla obcych albo go zamyka.
// Body: { public: boolean }.
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const uid = await requireUid(req);
    const code = codeParamSchema.parse((await ctx.params).code);
    const body = await req.json().catch(() => ({}));
    if (typeof body?.public !== "boolean") {
      return NextResponse.json({ error: "Brak wartości public." }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.doc(`rooms/${code}`);

    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) throw new ApiError(404, "Nie ma pokoju o tym kodzie.");
      const room = snap.data() as Room;
      if (room.hostUid !== uid) throw new ApiError(403, "Tylko host może otworzyć pokój.");
      // W trakcie gry otwieranie nie ma sensu: lista i tak pokazuje wyłącznie lobby,
      // a obcy odbiłby się od „gra już trwa". Lepiej odmówić tu niż tam.
      if (room.status !== "lobby" && body.public === true) {
        throw new ApiError(409, "Otwórz pokój przed startem gry.");
      }
      t.update(ref, { public: body.public, version: room.version + 1 });
    });

    return NextResponse.json({ public: body.public });
  } catch (err) {
    return handleApiError(err);
  }
}
