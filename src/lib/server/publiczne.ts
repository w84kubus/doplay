import { MAX_W_POKOJU } from "@/games/manifests";
import { DISCONNECT_AFTER_MS, type Room } from "@/lib/types/room";

// Lista publicznych pokoi.
//
// Świadomie NIE luzujemy reguł Firestore. Dopisanie do nich „albo pokój jest publiczny"
// pozwoliłoby każdemu zalogowanemu czytać CAŁY dokument dowolnego publicznego pokoju
// bez wchodzenia do niego. Zamiast tego listę serwuje Route Handler przez Admin SDK
// i zwraca wyłącznie to, co widoczne być musi. Kosztem jest brak realtime na liście.
//
// Tu jest też jedyne miejsce w aplikacji, gdzie coś widzi ktoś, kto nie jest w pokoju,
// więc wpisany przez gracza tekst NIE MOŻE stąd wyjść — patrz `PubliczyPokoj`.

/** Ile pokoi maksymalnie pokazujemy. */
export const LIMIT_LISTY = 30;

/**
 * Ile ciszy od ostatniego pinga oznacza pokój porzucony.
 *
 * Dużo hojniej niż `DISCONNECT_AFTER_MS` (20 s), bo tam chodzi o kropkę „online" przy
 * nicku, a tu o zniknięcie pokoju z listy. Ping milknie już wtedy, gdy host przełączy
 * się na inną aplikację, więc krótki próg kazałby pozycjom migotać.
 *
 * Obie pomyłki nie kosztują tyle samo. Pokazany pokój, z którego wszyscy wyszli, to
 * jedno nieudane dołączenie z czytelnym błędem. Ukryty pokój, w którym ktoś czeka, to
 * gracz, którego nikt nigdy nie znajdzie — a temu właśnie ma służyć cała ta lista.
 */
export const CISZA_PORZUCENIA_MS = 15 * DISCONNECT_AFTER_MS;

/**
 * Kafelek na liście. Zero pól z tekstem wpisanym przez gracza: nicków tu nie ma
 * i nie wolno ich dodać, bo to jedyny ekran widoczny dla każdego bez wejścia do pokoju.
 */
export interface PubliczyPokoj {
  code: string;
  /** Awatary siedzących, do pokazania kto czeka. Awatar to identyfikator z listy, nie tekst. */
  avatars: string[];
  ilu: number;
  createdAt: number;
}

// Nazwy gry tu nie ma świadomie: w lobby `gameId` dokumentu jest ZAWSZE null, bo wybór
// gry to stan klienta do momentu startu, a `reset` zeruje pole z powrotem. Kafelek
// z napisem „gra jeszcze niewybrana" na każdej pozycji nie niósłby żadnej informacji.

/** Tyle z dokumentu pokoju wystarcza do decyzji. */
export type Kandydat = Pick<
  Room,
  "code" | "public" | "status" | "players" | "gameId" | "createdAt"
>;

function ostatniPing(pokoj: Kandydat): number {
  return Object.values(pokoj.players ?? {}).reduce((max, p) => Math.max(max, p.lastSeenAt), 0);
}

/**
 * Które pokoje trafiają na listę i w jakiej postaci.
 *
 * Odsiewamy trzy rzeczy, z których każda dawałaby obcemu ślepy zaułek:
 * pokój w trakcie gry (dołączyłby w środku partii), pokój pełny (odbiłby się od limitu)
 * i pokój porzucony (wszedłby do pustego lobby i czekał na nikogo).
 *
 * Najmłodsze pierwsze: pokój założony przed chwilą ma największą szansę, że ktoś
 * przy nim jeszcze siedzi.
 */
export function wybierzPubliczne(kandydaci: Kandydat[], teraz: number): PubliczyPokoj[] {
  return kandydaci
    .filter((p) => p.public === true)
    .filter((p) => p.status === "lobby")
    .filter((p) => {
      const ilu = Object.keys(p.players ?? {}).length;
      return ilu > 0 && ilu < MAX_W_POKOJU;
    })
    .filter((p) => teraz - ostatniPing(p) < CISZA_PORZUCENIA_MS)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, LIMIT_LISTY)
    .map((p) => ({
      code: p.code,
      avatars: Object.values(p.players).map((g) => g.avatar),
      ilu: Object.keys(p.players).length,
      createdAt: p.createdAt,
    }));
}
