import { timingSafeEqual } from "node:crypto";
import { type Room } from "@/lib/types/room";

// Sprzątanie wygasłych pokoi (SPEC §3.7 — TTL 8 h).
//
// Dlaczego własna trasa, a nie natywne TTL Firestore: natywne TTL kasuje wyłącznie
// dokument nadrzędny i zostawia podkolekcje. Tajemnice gier żyją właśnie
// w podkolekcjach (`secret/state`, `private/{uid}`), więc pokój zniknąłby z listy,
// a role graczy leżałyby w bazie bez końca. `recursiveDelete` usuwa komplet.
//
// Ten plik świadomie nie importuje ani `server-only`, ani firebase-admin: dzięki temu
// decyzja „który pokój kasujemy" jest czystą funkcją i pokrywają ją testy. Samo
// wykonanie kasowania siedzi w Route Handlerze.

/** Ile pokoi kasujemy w jednym przebiegu — zapora przed limitem czasu funkcji. */
export const LIMIT_PARTII = 200;

/**
 * Ile ciszy musi minąć od ostatniego pinga, zanim ruszymy pokój.
 *
 * Sam miniony `expiresAt` nie wystarcza: partia może trwać dłużej niż 8 h, a skasowanie
 * pokoju w trakcie gry jest nieodwracalne. Godzina bez pinga oznacza, że przy stole
 * nikogo nie ma — a jeśli jednak jest, pokój po prostu poczeka do jutra.
 */
export const KARENCJA_AKTYWNOSCI_MS = 60 * 60 * 1000;

/** Tyle z dokumentu pokoju wystarcza do decyzji. */
export type Kandydat = Pick<Room, "code" | "expiresAt" | "players">;

/** Ostatni ping któregokolwiek gracza. Pusty pokój → 0, czyli „dawno temu". */
export function ostatniaAktywnosc(pokoj: Kandydat): number {
  return Object.values(pokoj.players ?? {}).reduce((max, p) => Math.max(max, p.lastSeenAt), 0);
}

/** Kody pokoi bezpiecznych do skasowania — wygasłe i ciche. */
export function wybierzDoUsuniecia(kandydaci: Kandydat[], teraz: number): string[] {
  return kandydaci
    .filter((p) => p.expiresAt < teraz)
    .filter((p) => teraz - ostatniaAktywnosc(p) >= KARENCJA_AKTYWNOSCI_MS)
    .slice(0, LIMIT_PARTII)
    .map((p) => p.code);
}

/**
 * Bramka crona. Vercel dokłada `Authorization: Bearer $CRON_SECRET` do żądania
 * z harmonogramu, więc sprawdzamy dokładnie ten nagłówek.
 *
 * Brak sekretu w środowisku zamyka trasę, a nie otwiera ją dla wszystkich: bez tego
 * pojedyncza pomyłka w konfiguracji dałaby każdemu przycisk kasujący pokoje.
 */
export function cronAutoryzowany(naglowek: string | null, sekret: string | undefined): boolean {
  if (!sekret) return false;
  const podany = (naglowek ?? "").match(/^Bearer (.+)$/i)?.[1];
  return podany !== undefined && rowneWStalymCzasie(podany, sekret);
}

function rowneWStalymCzasie(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual rzuca przy różnych długościach, więc odsiewamy je wcześniej.
  // Sama długość sekretu nie jest tajemnicą.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
