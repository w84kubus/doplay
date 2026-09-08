import { DOM_OD, POLA, START } from "./engine";

// Geometria planszy: siatka 15x15 i trasa 52 pól. Współrzędne są potrzebne WYŁĄCZNIE
// do rysowania — silnik zna tylko postęp pionka względem własnego startu i nic o planszy.
//
// Trasa jest wpisana wprost, ale KAŻDĄ jej własność sprawdza plansza.test.ts: długość,
// brak powtórzeń, ciągłość, cztery skosy na rogach i zgodność wejść do korytarzy
// ze stałą START z silnika. Literówka we współrzędnych nie przechodzi przez te testy,
// a bez nich objawiłaby się dopiero na ekranie jako pionek skaczący przez pół planszy.

export const BOK = 15;
/** Środek planszy: 3x3 w samym sercu, tam wchodzą pionki z korytarzy. */
export const SRODEK = { od: 6, do: 8 };

export interface Pole {
  x: number;
  y: number;
}

/**
 * Korytarze domowe: po pięć pól prowadzących do środka, jedno ramię krzyża na kolor.
 * Kolejność w tablicy to kolejność wchodzenia, od trasy w stronę środka.
 */
export const KORYTARZE: readonly (readonly Pole[])[] = [
  [13, 12, 11, 10, 9].map((y) => ({ x: 7, y })), // od dołu w górę
  [1, 2, 3, 4, 5].map((x) => ({ x, y: 7 })), // od lewej w prawo
  [1, 2, 3, 4, 5].map((y) => ({ x: 7, y })), // od góry w dół
  [13, 12, 11, 10, 9].map((x) => ({ x, y: 7 })), // od prawej w lewo
];

/** Pole na trasie, z którego wchodzi się w dany korytarz. */
const WEJSCIA: readonly Pole[] = [
  { x: 7, y: 14 },
  { x: 0, y: 7 },
  { x: 7, y: 0 },
  { x: 14, y: 7 },
];

/** Bazy: cztery kąty planszy, po cztery miejsca na pionki. */
export const BAZY: readonly (readonly Pole[])[] = [
  [{ x: 1.5, y: 10.5 }, { x: 3.5, y: 10.5 }, { x: 1.5, y: 12.5 }, { x: 3.5, y: 12.5 }],
  [{ x: 1.5, y: 1.5 }, { x: 3.5, y: 1.5 }, { x: 1.5, y: 3.5 }, { x: 3.5, y: 3.5 }],
  [{ x: 10.5, y: 1.5 }, { x: 12.5, y: 1.5 }, { x: 10.5, y: 3.5 }, { x: 12.5, y: 3.5 }],
  [{ x: 10.5, y: 10.5 }, { x: 12.5, y: 10.5 }, { x: 10.5, y: 12.5 }, { x: 12.5, y: 12.5 }],
];

/**
 * Trasa 52 pól, w kolejności ruchu. Indeks 0 to pole startowe czerwonego.
 *
 * Lista jest wpisana wprost, bo prawdziwa trasa chińczyka NIE jest spacerem po polach
 * sąsiadujących bokami: na czterech rogach skręca po skosie, na przykład z (6,9) na (5,8).
 * Pierwsze podejście układało ją algorytmicznie i urywało się po pięciu polach właśnie tam.
 * Spójności pilnują testy w plansza.test.ts.
 */
export const TRASA: readonly Pole[] = ([
  [6,13],[6,12],[6,11],[6,10],[6,9],
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
  [0,7],
  [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  [7,0],
  [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
  [14,7],
  [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
  [7,14],
  [6,14],
] as const).map(([x, y]) => ({ x, y }));

/** Współrzędne pola startowego danego koloru. */
export function poleStartowe(kolor: number): Pole {
  return TRASA[START[kolor] % POLA];
}

/**
 * Indeks na trasie pola, z którego dany kolor skręca w swój korytarz.
 *
 * To OSTATNIE pole trasy dla tego koloru, czyli postęp `DOM_OD - 1`. Stąd wynika
 * rozstawienie startów co 13 pól i to jest jedyne miejsce spinające silnik z planszą.
 */
export function indeksWejscia(kolor: number): number {
  return (START[kolor] + DOM_OD - 1) % POLA;
}

/** Współrzędne pola trasy, korytarza albo środka dla danego postępu pionka. */
export function polePostepu(kolor: number, postep: number): Pole | null {
  if (postep < 0) return null;
  if (postep < DOM_OD) return TRASA[(START[kolor] + postep) % POLA];
  const wKorytarzu = postep - DOM_OD;
  return KORYTARZE[kolor][wKorytarzu] ?? { x: 7, y: 7 };
}
