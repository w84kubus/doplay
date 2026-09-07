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
    // Bufor na krawędzi zostaje, bo zachęta na stronie głównej odpytuje tę trasę przy
    // każdym wejściu i bez niego każdy gość kosztowałby odczyt Firestore. Ale 2 s,
    // nie 10, i BEZ `stale-while-revalidate`.
    //
    // Zmierzone na produkcji przy poprzednich ustawieniach: pokój zamknięty przez hosta
    // znikał z odpowiedzi API dopiero po 10 s, a `stale-while-revalidate=20` pozwalał
    // podawać nieaktualną listę jeszcze dłużej, gdy ruch był rzadki. Do tego dochodziło
    // odpytywanie u klienta, więc na drugim komputerze pokój wisiał do 20 s po zamknięciu.
    //
    // Dwie sekundy nadal odcinają liczbę oglądających od kosztu zapytań: przy stu osobach
    // baza dostaje pytanie co 2 s, a nie sto razy.
    return NextResponse.json({ pokoje }, { headers: { "cache-control": "public, s-maxage=2" } });
  } catch (err) {
    return handleApiError(err);
  }
}
