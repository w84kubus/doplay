import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { handleApiError } from "@/lib/server/http";
import { LIMIT_LISTY, wybierzPubliczne, type Kandydat } from "@/lib/server/publiczne";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // lista żyje, nigdy z cache

// GET /api/rooms/publiczne — pokoje otwarte dla obcych.
//
// Bez uwierzytelnienia: to jest zawartość zakładki, którą widzi każdy, kto wszedł na
// stronę, jeszcze zanim aplikacja zaloguje go anonimowo. Nie ma tu nic prywatnego,
// bo `wybierzPubliczne` przepuszcza wyłącznie kod, grę, awatary i liczbę osób.
export async function GET() {
  try {
    const db = getAdminDb();
    // Jeden warunek równościowy, żeby nie wymuszać indeksu złożonego. Resztę odsiewa
    // czysta funkcja, którą da się przetestować bez bazy.
    const snap = await db
      .collection("rooms")
      .where("public", "==", true)
      .limit(LIMIT_LISTY * 4)
      .get();

    const pokoje = wybierzPubliczne(
      snap.docs.map((d) => d.data() as Kandydat),
      Date.now(),
    );
    // Krótki cache na krawędzi. Od kiedy zachęta na stronie głównej odpytuje tę
    // trasę przy każdym wejściu, bez tego każdy gość kosztowałby odczyt Firestore.
    // 10 s zgadza się z tempem odświeżania listy w zakładce, więc nikt nie zobaczy
    // nic bardziej nieaktualnego, niż zobaczyłby i tak.
    return NextResponse.json(
      { pokoje },
      { headers: { "cache-control": "public, s-maxage=10, stale-while-revalidate=20" } },
    );
  } catch (err) {
    return handleApiError(err);
  }
}
