import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { ApiError, requireUid } from "@/lib/server/auth";
import { handleApiError } from "@/lib/server/http";
import { pickNewHost } from "@/lib/server/rooms";
import { codeParamSchema } from "@/lib/schemas/room";
import type { Room } from "@/lib/types/room";

export const runtime = "nodejs";

// POST /api/rooms/[code]/leave — wyjście gracza albo wyrzucenie przez hosta ({ targetUid }).
// Obsługuje migrację hosta (SPEC §3.7) i sprząta pusty pokój.
export async function POST(
  req: Request,
  ctx: { params: Promise<{ code: string }> },
) {
  try {
    const uid = await requireUid(req);
    const code = codeParamSchema.parse((await ctx.params).code);
    const body = await req.json().catch(() => ({}));
    const targetUid: string = typeof body?.targetUid === "string" ? body.targetUid : uid;

    const db = getAdminDb();
    const ref = db.doc(`rooms/${code}`);
    const now = Date.now();

    // Ustawiane w transakcji, czytane po jej zatwierdzeniu — recursiveDelete nie
    // działa wewnątrz transakcji. Zerowane na starcie każdej próby, bo Firestore
    // potrafi powtórzyć callback i flaga z poprzedniego przebiegu byłaby kłamstwem.
    let pokojSkasowany = false;

    await db.runTransaction(async (t) => {
      pokojSkasowany = false;
      const snap = await t.get(ref);
      if (!snap.exists) return; // już nie istnieje — nic do roboty
      const room = snap.data() as Room;

      // Wyrzucać kogoś innego może tylko host (SPEC §4).
      if (targetUid !== uid && room.hostUid !== uid) {
        throw new ApiError(403, "Tylko host może wyrzucić gracza.");
      }
      if (!room.players[targetUid]) return;

      const remaining = Object.keys(room.players).filter((u) => u !== targetUid);
      if (remaining.length === 0) {
        t.delete(ref); // ostatni gracz wyszedł — kasujemy pokój
        pokojSkasowany = true;
        return;
      }

      const update: Record<string, unknown> = {
        [`players.${targetUid}`]: FieldValue.delete(),
        version: room.version + 1,
      };

      // Migracja hosta, jeśli wychodzi obecny host.
      if (room.hostUid === targetUid) {
        const nextHost = pickNewHost(room.players, room.seatOrder, targetUid, now);
        if (nextHost) {
          update.hostUid = nextHost;
          update[`players.${nextHost}.isHost`] = true;
        }
      }

      t.update(ref, update);
    });

    // Samo `t.delete(ref)` zdejmuje wyłącznie dokument pokoju — `secret/state`
    // i `private/{uid}` zostawałyby w bazie jako sieroty, bez rodzica i bez szans
    // na sprzątnięcie (cron szuka po `expiresAt`, a nieistniejący dokument nie ma pól).
    // To właśnie ta droga nazbierała 74 osierocone dokumenty z rolami graczy.
    if (pokojSkasowany) {
      await db.recursiveDelete(ref);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
