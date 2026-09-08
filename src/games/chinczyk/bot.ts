import {
  BEZPIECZNE,
  DOM_OD,
  legalneRuchy,
  META,
  PIONKOW,
  pionkiKoloru,
  POLA,
  poleBezwzgledne,
  W_BAZIE,
} from "./engine";

// Mózg bota. Czysta funkcja na liczbach — bez stanu silnika, bez Firestore, bez losowości.
// Dzięki temu da się ją testować jak kalkulator i wykorzystać w dowolnym miejscu:
// dziś gra nią bot, a także nieobecny gracz, któremu wygasła tura.
//
// Poziom jest JEDEN i celowo „rozsądny", nie mistrzowski. Bot ma być partnerem do gry,
// a nie ścianą: bije, gdy może, chowa się na pola bezpieczne i pilnuje, żeby mieć pionki
// w grze — ale nie liczy wariantów w głąb i nie zna prawdopodobieństw.

/** Ile pól do przodu sięga kostka. Tyle wynosi zasięg zagrożenia od cudzego pionka. */
const ZASIEG = 6;

interface Kandydat {
  pionek: number;
  /** Postęp po ruchu, w skali własnego koloru. */
  cel: number;
}

/** Pola na trasie zajęte przez przeciwników — do liczenia zbić i zagrożeń. */
function poleWrogow(pionki: readonly number[], sloty: readonly (string | null)[], moj: number) {
  const wrogowie: { kolor: number; pole: number; postep: number }[] = [];
  for (let kolor = 0; kolor < sloty.length; kolor++) {
    if (kolor === moj || !sloty[kolor]) continue;
    pionkiKoloru(pionki, kolor).forEach((postep) => {
      const pole = poleBezwzgledne(kolor, postep);
      if (pole !== null) wrogowie.push({ kolor, pole, postep });
    });
  }
  return wrogowie;
}

/** Czy z pola `skad` da się dosięgnąć pola `dokad` jednym rzutem, jadąc do przodu. */
function wZasiegu(skad: number, dokad: number): boolean {
  const dystans = (dokad - skad + POLA) % POLA;
  return dystans >= 1 && dystans <= ZASIEG;
}

/**
 * Ocena jednego ruchu. Wyższa = lepsza. Wagi są tak dobrane, żeby kolejność decyzji
 * była czytelna i przewidywalna:
 *
 *   zbicie > wejście na metę > wyjście z bazy szóstką > wjazd do korytarza > pole bezpieczne
 *
 * a na końcu, przy remisie, wygrywa pionek najbliżej domu — bot kończy zaczęte pionki
 * zamiast rozgrzebywać cztery naraz.
 */
export function ocenRuch(
  pionki: readonly number[],
  sloty: readonly (string | null)[],
  kolor: number,
  { pionek, cel }: Kandydat,
): number {
  const teraz = pionki[kolor * PIONKOW + pionek];
  const wrogowie = poleWrogow(pionki, sloty, kolor);
  const polePoRuchu = poleBezwzgledne(kolor, cel);
  const poleTeraz = poleBezwzgledne(kolor, teraz);

  let punkty = 0;

  // 1. Zbicie. Im dalej zaszedł zbijany pionek, tym boleśniejsza strata dla przeciwnika.
  const zbijane =
    polePoRuchu !== null && !BEZPIECZNE.has(polePoRuchu)
      ? wrogowie.filter((w) => w.pole === polePoRuchu)
      : [];
  for (const w of zbijane) punkty += 1000 + w.postep * 4;

  // 2. Meta. Pionek w środku jest już nie do ruszenia.
  if (cel === META) punkty += 800;

  // 3. Wyjście z bazy. Bot z jednym pionkiem na planszy nie ma czym grać przy niskich rzutach.
  if (teraz === W_BAZIE) punkty += 600;

  // 4. WEJŚCIE do korytarza domowego. Premia należy się za wjazd, nie za przesuwanie się
  //    w środku: pionek już w korytarzu jest bezpieczny niezależnie od tego, co zrobi.
  if (cel >= DOM_OD && cel !== META && teraz < DOM_OD) punkty += 400;

  // 5. Pole bezpieczne.
  if (polePoRuchu !== null && BEZPIECZNE.has(polePoRuchu)) punkty += 200;

  // 6. Ucieczka i wystawianie się. Liczymy zagrożenie PRZED i PO, żeby ruch, który tylko
  //    przesuwa pionek z jednego celownika pod drugi, nie wyglądał na ucieczkę.
  //    Pionek, którego właśnie zbijamy, wraca do bazy — nie może już nam zagrozić.
  const groza = wrogowie.filter((w) => !zbijane.includes(w));
  const zagrozonyTeraz =
    poleTeraz !== null && !BEZPIECZNE.has(poleTeraz) && groza.some((w) => wZasiegu(w.pole, poleTeraz));
  const zagrozonyPo =
    polePoRuchu !== null && !BEZPIECZNE.has(polePoRuchu) && groza.some((w) => wZasiegu(w.pole, polePoRuchu));
  if (zagrozonyTeraz) punkty += 120;
  if (zagrozonyPo) punkty -= 150;

  // 7. Rozstrzygnięcie remisów: najdalszy pionek do przodu.
  return punkty + cel;
}

/**
 * Którym pionkiem zagrać przy takim rzucie. Zwraca indeks pionka albo null, gdy nie ma
 * żadnego legalnego ruchu. Przy równej ocenie wygrywa niższy indeks — decyzja musi być
 * deterministyczna, bo silnik jest czystą funkcją i partia ma się odtwarzać z ziarna.
 */
export function wybierzRuch(
  pionki: readonly number[],
  sloty: readonly (string | null)[],
  kolor: number,
  oczka: number,
): number | null {
  const moje = pionkiKoloru(pionki, kolor);
  const legalne = legalneRuchy(moje, oczka);
  if (!legalne.length) return null;

  let najlepszy = legalne[0];
  let najwyzsza = -Infinity;
  for (const pionek of legalne) {
    const teraz = moje[pionek];
    const cel = teraz === W_BAZIE ? 0 : teraz + oczka;
    const punkty = ocenRuch(pionki, sloty, kolor, { pionek, cel });
    if (punkty > najwyzsza) {
      najwyzsza = punkty;
      najlepszy = pionek;
    }
  }
  return najlepszy;
}
