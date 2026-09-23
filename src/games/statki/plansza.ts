// Geometria planszy Statków. Czyste funkcje na liczbach — bez stanu silnika, bez Reacta.
// Korzysta z nich silnik, bot, widoki i testy, więc nikt nie liczy pól po swojemu.
//
// Pole to JEDNA liczba: `wiersz * bok + kolumna`. Plansza nie jest tablicą tablic,
// bo Firestore nie przyjmuje tablicy w tablicy (patrz CLAUDE.md) — a tu dochodzi drugi
// powód: przy dwóch bokach do wyboru (8 i 10) indeks liczony funkcją nie daje się pomylić.

export interface Statek {
  dlugosc: number;
  /** Pole dziobu — najmniejszy indeks zajmowany przez statek. */
  pole: number;
  poziomo: boolean;
}

/** Floty dla obu rozmiarów planszy. Klucz to bok. */
export const FLOTY: Record<number, readonly number[]> = {
  8: [4, 3, 3, 2, 2],
  10: [4, 3, 3, 2, 2, 2, 1, 1, 1, 1],
};

export const wierszPola = (pole: number, bok: number) => Math.floor(pole / bok);
export const kolumnaPola = (pole: number, bok: number) => pole % bok;
export const idxPola = (wiersz: number, kolumna: number, bok: number) => wiersz * bok + kolumna;
export const naPlanszy = (wiersz: number, kolumna: number, bok: number) =>
  wiersz >= 0 && wiersz < bok && kolumna >= 0 && kolumna < bok;

/** Pola zajmowane przez statek, albo null, gdy wystaje poza planszę. */
export function polaStatku(s: Statek, bok: number): number[] | null {
  const w = wierszPola(s.pole, bok);
  const k = kolumnaPola(s.pole, bok);
  const pola: number[] = [];
  for (let i = 0; i < s.dlugosc; i++) {
    const ww = s.poziomo ? w : w + i;
    const kk = s.poziomo ? k + i : k;
    if (!naPlanszy(ww, kk, bok)) return null;
    pola.push(idxPola(ww, kk, bok));
  }
  return pola;
}

/**
 * Pola stykające się z podanymi, łącznie z rogami, bez nich samych.
 *
 * Statki nie mogą się dotykać nawet rogiem — to reguła z polskiego podwórka i ma
 * praktyczny skutek: po zatopieniu wiadomo, że całe obramowanie to woda, więc silnik
 * odsłania je sam i nikt nie marnuje strzałów na pola, które i tak są puste.
 */
export function obwodka(pola: readonly number[], bok: number): number[] {
  const wlasne = new Set(pola);
  const wynik = new Set<number>();
  for (const pole of pola) {
    const w = wierszPola(pole, bok);
    const k = kolumnaPola(pole, bok);
    for (let dw = -1; dw <= 1; dw++) {
      for (let dk = -1; dk <= 1; dk++) {
        if (!naPlanszy(w + dw, k + dk, bok)) continue;
        const sasiad = idxPola(w + dw, k + dk, bok);
        if (!wlasne.has(sasiad)) wynik.add(sasiad);
      }
    }
  }
  return [...wynik].sort((a, b) => a - b);
}

/** Czy flota mieści się na planszy, nie nachodzi na siebie i nigdzie się nie styka. */
export function poprawnaFlota(flota: readonly Statek[], bok: number): boolean {
  const zajete = new Set<number>();
  const zakazane = new Set<number>();
  for (const s of flota) {
    const pola = polaStatku(s, bok);
    if (!pola) return false;
    for (const p of pola) {
      if (zajete.has(p) || zakazane.has(p)) return false;
    }
    for (const p of pola) zajete.add(p);
    for (const p of obwodka(pola, bok)) zakazane.add(p);
  }
  return true;
}

/** Wszystkie pola floty. */
export function polaFloty(flota: readonly Statek[], bok: number): number[] {
  return flota.flatMap((s) => polaStatku(s, bok) ?? []);
}

/**
 * Losowa poprawna flota.
 *
 * Statki idą od najdłuższego: krótkie mieszczą się prawie wszędzie, więc odwrotna
 * kolejność potrafi zastawić planszę tak, że czteromasztowiec nie ma już gdzie stanąć.
 * Gdyby mimo to zabrakło miejsca, cała próba startuje od nowa — zwracamy `null` dopiero
 * po wyczerpaniu wszystkich podejść, a wywołujący musi to obsłużyć.
 */
export function losujFlote(
  dlugosci: readonly number[],
  bok: number,
  rng: () => number,
  podejsc = 60,
): Statek[] | null {
  const posortowane = [...dlugosci].sort((a, b) => b - a);
  for (let podejscie = 0; podejscie < podejsc; podejscie++) {
    const flota: Statek[] = [];
    let komplet = true;

    for (const dlugosc of posortowane) {
      let postawiony = false;
      for (let proba = 0; proba < 300 && !postawiony; proba++) {
        const poziomo = rng() < 0.5;
        const w = Math.floor(rng() * bok);
        const k = Math.floor(rng() * bok);
        const statek: Statek = { dlugosc, pole: idxPola(w, k, bok), poziomo };
        if (poprawnaFlota([...flota, statek], bok)) {
          flota.push(statek);
          postawiony = true;
        }
      }
      if (!postawiony) {
        komplet = false;
        break;
      }
    }
    if (komplet) return flota;
  }
  return null;
}

/** Które pola floty są już trafione. */
export function trafioneStatku(s: Statek, bok: number, strzaly: ReadonlySet<number>): number {
  const pola = polaStatku(s, bok) ?? [];
  return pola.filter((p) => strzaly.has(p)).length;
}

export const zatopiony = (s: Statek, bok: number, strzaly: ReadonlySet<number>) =>
  trafioneStatku(s, bok, strzaly) === s.dlugosc;

/** Pola wszystkich zatopionych statków — do odsłonięcia na planszy przeciwnika. */
export function polaZatopionych(flota: readonly Statek[], bok: number, strzaly: ReadonlySet<number>): number[] {
  return flota.filter((s) => zatopiony(s, bok, strzaly)).flatMap((s) => polaStatku(s, bok) ?? []);
}

/**
 * Flota ustawiona zachłannie, bez losowości — awaryjne wyjście, gdy losowanie odpadnie.
 *
 * Nie jest ładna (statki idą rzędami od góry), ale jest PEWNA: skanuje pola po kolei
 * i stawia każdy statek na pierwszym pasującym miejscu, więc znajdzie ustawienie zawsze,
 * gdy jakiekolwiek istnieje. Losowanie zawodzi na naszych flotach mniej więcej nigdy,
 * ale „mniej więcej nigdy" w grze sieciowej znaczy „u kogoś raz na tysiąc partii",
 * a pusta flota to przegrana bez jednego strzału.
 */
export function flotaZachlanna(dlugosci: readonly number[], bok: number): Statek[] | null {
  const flota: Statek[] = [];
  for (const dlugosc of [...dlugosci].sort((a, b) => b - a)) {
    let postawiony = false;
    for (let pole = 0; pole < bok * bok && !postawiony; pole++) {
      for (const poziomo of [true, false]) {
        const statek: Statek = { dlugosc, pole, poziomo };
        if (poprawnaFlota([...flota, statek], bok)) {
          flota.push(statek);
          postawiony = true;
          break;
        }
      }
    }
    if (!postawiony) return null;
  }
  return flota;
}

/** Flota na start partii: losowa, a gdyby losowanie odpadło — zachłanna. */
export function flotaStartowa(bok: number, rng: () => number): Statek[] {
  const dlugosci = FLOTY[bok] ?? FLOTY[8];
  return losujFlote(dlugosci, bok, rng) ?? flotaZachlanna(dlugosci, bok) ?? [];
}
