import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  cronAutoryzowany,
  LIMIT_PARTII,
  wybierzDoUsuniecia,
  type Kandydat,
} from "@/lib/server/cleanup";
import { handleApiError } from "@/lib/server/http";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs"; // firebase-admin (SPEC §8)
export const dynamic = "force-dynamic"; // nigdy z cache — to jest zadanie, nie strona
export const maxDuration = 60;

// GET /api/cron/cleanup — kasuje wygasłe pokoje razem z ich podkolekcjami.
// Woła to harmonogram Vercela raz na dobę (vercel.json). Decyzję „który pokój"
// podejmuje `lib/server/cleanup.ts`; tutaj zostaje samo wykonanie.
export async function GET(req: Request) {
  try {
    if (!cronAutoryzowany(req.headers.get("authorization"), process.env.CRON_SECRET)) {
      // Świadomie bez szczegółów: obcy nie musi wiedzieć, czy chodzi o brak sekretu,
      // czy o zły sekret.
      return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
    }

    const db = getAdminDb();
    const teraz = Date.now();

    // Bierzemy z zapasem — część kandydatów odpadnie na karencji aktywności.
    const snap = await db
      .collection("rooms")
      .where("expiresAt", "<", teraz)
      .limit(LIMIT_PARTII * 2)
      .get();

    const doUsuniecia = wybierzDoUsuniecia(
      snap.docs.map((d) => d.data() as Kandydat),
      teraz,
    );

    // Wspólny BulkWriter: kasowanie idzie równolegle i mieści się w limicie czasu.
    // recursiveDelete zdejmuje też `secret/state` i `private/{uid}` — bez tego
    // role graczy zostałyby w bazie po zniknięciu pokoju (zasada 2).
    const writer = db.bulkWriter();
    await Promise.all(
      doUsuniecia.map((code) => db.recursiveDelete(db.doc(`rooms/${code}`), writer)),
    );
    await writer.close();

    logger.info(
      `sprzątanie: usunięto ${doUsuniecia.length} z ${snap.size} pokoi po terminie`,
      { action: "cron-cleanup" },
    );
    return NextResponse.json({
      sprawdzone: snap.size,
      usuniete: doUsuniecia.length,
      pominiete: snap.size - doUsuniecia.length,
    });
  } catch (err) {
    logger.error("sprzątanie nie powiodło się", { action: "cron-cleanup" }, err);
    return handleApiError(err);
  }
}
