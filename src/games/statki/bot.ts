import { idxPola, kolumnaPola, naPlanszy, wierszPola } from "./plansza";

// Mózg bota. Czysta funkcja na liczbach — i, co ważniejsze, na tym samym obrazie planszy,
// który widzi człowiek. Bot NIE dostaje floty przeciwnika, tylko własne strzały i to, co
// z nich wynikło. Gdyby zaglądał w `state.floty`, grałby bezbłędnie i nie byłby botem,
// tylko oszustem — a przy okazji wyciek mógłby się kiedyś przelać do widoku.
//
// Gra nim także gracz, któremu minął termin, więc jego decyzje widuje się w każdej partii.
// Poziom jest JEDEN i celowo „rozsądny": dobija zaczęty statek wzdłuż linii, szuka
// w szachownicę, ale nie liczy prawdopodobieństw pól ani nie zgaduje, czego jeszcze
// brakuje we flocie.

/** Cztery kierunki. Skos odpada — statki są proste, a stykać się nie mogą. */
const KIERUNKI: readonly (readonly [number, number])[] = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];

/** Sąsiad pola w danym kierunku albo null, gdy wypada poza planszę. */
export function sasiad(pole: number, bok: number, dw: number, dk: number): number | null {
  const w = wierszPola(pole, bok) + dw;
  const k = kolumnaPola(pole, bok) + dk;
  return naPlanszy(w, k, bok) ? idxPola(w, k, bok) : null;
}

function losowe(pula: readonly number[], rng: () => number): number {
  return pula[Math.floor(rng() * pula.length)] ?? pula[0];
}

/**
 * Pole, w które strzeli bot, albo null, gdy nie ma już gdzie.
 *
 * Kolejność decyzji jest czytelna i sprawdzalna po kolei:
 *   przedłużenie zaczętej linii > sąsiad pojedynczego trafienia > szachownica > cokolwiek
 *
 * `trafienia` i `zatopione` to DOKŁADNIE te tablice, które silnik wystawia w `publicView`
 * dla planszy celu — czyli wiedza dostępna każdemu przy stole.
 */
export function wybierzStrzal(
  bok: number,
  mojeStrzaly: readonly number[],
  trafienia: readonly number[],
  zatopione: readonly number[],
  rng: () => number,
): number | null {
  const oddane = new Set(mojeStrzaly);
  const poszly = new Set(zatopione);
  // Trafienia w statki, które JESZCZE pływają. Zatopione nie niosą już informacji —
  // silnik odsłonił wokół nich wodę, więc szukanie przy nich to strata tury.
  const aktywne = new Set(trafienia.filter((p) => !poszly.has(p)));

  if (aktywne.size > 0) {
    // 1. Dwa trafienia w jednej linii wyznaczają kierunek statku. Strzelamy na jego koniec.
    const konce = new Set<number>();
    for (const trafione of aktywne) {
      for (const [dw, dk] of KIERUNKI) {
        const obok = sasiad(trafione, bok, dw, dk);
        if (obok === null || !aktywne.has(obok)) continue;
        let biezace: number | null = obok;
        while (biezace !== null) {
          const nastepne: number | null = sasiad(biezace, bok, dw, dk);
          if (nastepne === null) break;
          if (aktywne.has(nastepne)) {
            biezace = nastepne;
            continue;
          }
          if (!oddane.has(nastepne)) konce.add(nastepne);
          break;
        }
      }
    }
    if (konce.size > 0) return losowe([...konce], rng);

    // 2. Pojedyncze trafienie: statek idzie w którąś z czterech stron, nie wiadomo w którą.
    const wokol = new Set<number>();
    for (const trafione of aktywne) {
      for (const [dw, dk] of KIERUNKI) {
        const p = sasiad(trafione, bok, dw, dk);
        if (p !== null && !oddane.has(p)) wokol.add(p);
      }
    }
    if (wokol.size > 0) return losowe([...wokol], rng);
  }

  // 3. Polowanie w szachownicę. Każdy statek dłuższy niż jedno pole musi leżeć na
  //    polu o parzystej sumie współrzędnych, więc połowa planszy wystarczy, żeby go
  //    znaleźć — i to dwa razy szybciej niż strzelanie na oślep.
  const wolne: number[] = [];
  const szachownica: number[] = [];
  for (let pole = 0; pole < bok * bok; pole++) {
    if (oddane.has(pole)) continue;
    wolne.push(pole);
    if ((wierszPola(pole, bok) + kolumnaPola(pole, bok)) % 2 === 0) szachownica.push(pole);
  }
  // Gdy szachownica się wyczerpie, zostają jednomasztowce — wtedy liczy się każde pole.
  const pula = szachownica.length > 0 ? szachownica : wolne;
  return pula.length > 0 ? losowe(pula, rng) : null;
}
