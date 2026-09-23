import { KOLUMNY, ladowanie, wolneKolumny, znajdzLinie, type Pole, type Znak } from "./engine";

// Mózg bota. Czysta funkcja na tablicy pól — bez stanu silnika, bez Firestore, bez
// losowości poza wstrzykniętym `rng`. Dzięki temu da się ją testować jak kalkulator
// i użyć w dwóch miejscach: gra nią bot, a także gracz, któremu minął termin ruchu.
//
// Poziom jest JEDEN i celowo „rozsądny", nie mistrzowski — tak jak w Chińczyku. Bot
// patrzy dokładnie jeden ruch w przód: wygrywa, gdy może, blokuje, gdy musi, nie podaje
// przeciwnikowi wygranej na tacy i trzyma się środka. Nie przeszukuje drzewa wariantów,
// więc da się go ograć, i o to chodzi.
//
// Czwórki mają rozwiązanie doskonałe (zaczynający wygrywa przy idealnej grze od środka),
// więc bot z pełnym przeszukiwaniem nie przegrałby NIGDY. To byłby zły partner do gry.

/** Znak przeciwnika. */
export const przeciwny = (znak: Znak): Znak => (znak === 0 ? 1 : 0);

/** Ruch, po którym przeciwnik wygrywa jednym wrzuceniem. Zawsze najgorszy z możliwych. */
const TRUCIZNA = -500;
/** Ustawienie sobie dwóch wygrywających kolumn naraz — przeciwnik zablokuje tylko jedną. */
const PODWOJNA_GROZBA = 300;
/** Pojedyncza groźba: przeciwnik ją zablokuje, ale zmusza go do odpowiedzi. */
const GROZBA = 60;

/**
 * Premia za bliskość środka. W Czwórkach kolumna środkowa leży na największej liczbie
 * możliwych czwórek (poziomych, pionowych i obu skosach), więc jest po prostu warta
 * najwięcej — to najprostsza heurystyka tej gry i sama z siebie daje sensowną grę.
 */
export function srodek(kolumna: number): number {
  const os = (KOLUMNY - 1) / 2;
  return Math.round((os - Math.abs(kolumna - os)) * 10);
}

/** Kolumny, w których `znak` wygrywa NATYCHMIAST po jednym wrzuceniu. */
export function wygrywajaceKolumny(plansza: readonly Pole[], znak: Znak): number[] {
  const trafienia: number[] = [];
  for (const k of wolneKolumny(plansza)) {
    const pole = ladowanie(plansza, k);
    if (pole === null) continue;
    const proba = [...plansza];
    proba[pole] = znak;
    if (znajdzLinie(proba, pole)) trafienia.push(k);
  }
  return trafienia;
}

/**
 * Ocena jednej kolumny. Wyższa = lepsza. Kolejność decyzji jest czytelna i przewidywalna:
 *
 *   nie podaj wygranej > podwójna groźba > pojedyncza groźba > bliżej środka
 *
 * Wygrana i blokada nie mają tu wag, bo rozstrzygają się wcześniej, w `wybierzKolumne` —
 * są zerojedynkowe i mieszanie ich z punktacją tylko zaciemniałoby próg.
 */
export function ocenKolumne(plansza: readonly Pole[], ja: Znak, kolumna: number): number {
  const pole = ladowanie(plansza, kolumna);
  if (pole === null) return TRUCIZNA * 2; // kolumna pełna — nie do zagrania

  const po = [...plansza];
  po[pole] = ja;

  // Mój żeton odsłania pole NAD sobą. Jeśli przeciwnik wygrywa tam jednym wrzuceniem,
  // ten ruch przegrywa partię — niezależnie od tego, jak dobrze wygląda poza tym.
  // (Gdyby przeciwnik miał wygraną gdzie indziej, zablokowalibyśmy ją wcześniej.)
  if (wygrywajaceKolumny(po, przeciwny(ja)).length > 0) return TRUCIZNA + srodek(kolumna);

  const grozby = wygrywajaceKolumny(po, ja).length;
  const premia = grozby >= 2 ? PODWOJNA_GROZBA : grozby === 1 ? GROZBA : 0;
  return srodek(kolumna) + premia;
}

/** Z kilku równorzędnych kolumn bierze tę bliżej środka. */
function najblizszaSrodka(kolumny: readonly number[]): number {
  return [...kolumny].sort((a, b) => srodek(b) - srodek(a))[0];
}

/**
 * Kolumna, którą zagra bot. `rng` rozstrzyga remisy — bez tego bot grałby w kółko tę samą
 * partię przeciw temu samemu otwarciu, a losowość MUSI wejść z zewnątrz (zasada 3).
 */
export function wybierzKolumne(plansza: readonly Pole[], ja: Znak, rng: () => number): number {
  const wolne = wolneKolumny(plansza);
  if (wolne.length === 0) return 0; // silnik sprawdza to wcześniej; tu tylko dla spokoju

  // 1. Wygrywam teraz.
  const moje = wygrywajaceKolumny(plansza, ja);
  if (moje.length > 0) return najblizszaSrodka(moje);

  // 2. Przeciwnik wygrałby w następnym ruchu — blokuję. Przy dwóch jego groźbach
  //    naraz partia jest już przegrana, ale blokada i tak jest najlepszym, co mamy.
  const cudze = wygrywajaceKolumny(plansza, przeciwny(ja));
  if (cudze.length > 0) return najblizszaSrodka(cudze);

  // 3. Reszta idzie przez punktację.
  const oceny = wolne.map((k) => ({ k, ocena: ocenKolumne(plansza, ja, k) }));
  const najlepsza = Math.max(...oceny.map((o) => o.ocena));
  const remis = oceny.filter((o) => o.ocena === najlepsza).map((o) => o.k);
  return remis[Math.floor(rng() * remis.length)] ?? remis[0];
}
