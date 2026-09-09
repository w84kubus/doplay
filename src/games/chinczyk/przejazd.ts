import { W_BAZIE } from "./engine";

// Plan przejazdu pionka. Wydzielone z komponentu, bo to czysta arytmetyka na tablicy
// i tak daje się przetestować bez Reacta i bez DOM-u.

/**
 * Klatki pośrednie przejazdu: pionek ma OBEJŚĆ pola po kolei, a nie przelecieć
 * po przekątnej przez pół planszy. Silnik przysyła tylko stan końcowy, więc drogę
 * odtwarzamy tutaj - postęp rośnie o jeden aż do celu.
 *
 * Zwraca pustą listę, gdy nie ma czego animować: przy starcie, przy resecie i wtedy,
 * gdy zmieniło się więcej niż jedno pole naraz (nie da się wtedy powiedzieć, kto szedł).
 *
 * Zbicie ląduje w OSTATNIEJ klatce, czyli dopiero gdy zbijający dojdzie na miejsce.
 * Gdyby zbity wracał do bazy od razu, znikałby, zanim cokolwiek go dotknęło.
 */
export function klatkiPrzejazdu(stare: readonly number[], nowe: readonly number[]): number[][] {
  const ruszone = stare
    .map((p, i) => (p === nowe[i] ? -1 : i))
    .filter((i) => i >= 0);
  // Ruch to jeden pionek do przodu; reszta różnic (zbicia) to jego SKUTEK.
  const idacy = ruszone.filter((i) => nowe[i] > stare[i] && nowe[i] !== W_BAZIE);
  if (idacy.length !== 1) return [];

  const kto = idacy[0];
  const od = stare[kto] === W_BAZIE ? 0 : stare[kto] + 1;
  const doCelu = nowe[kto];
  if (doCelu < od) return [];

  const klatki: number[][] = [];
  for (let p = od; p <= doCelu; p++) {
    const klatka = [...stare];
    klatka[kto] = p;
    klatki.push(klatka);
  }
  // Ostatnia klatka to pełny stan z serwera - razem ze zbiciami.
  klatki[klatki.length - 1] = [...nowe];
  return klatki;
}
