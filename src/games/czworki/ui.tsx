"use client";
import { useEffect, useRef, useState } from "react";
import { idxPola, KOLUMNY, ladowanie, WIERSZE, type Pole } from "./engine";

// Plansza Czwórek na DOM-ie i Tailwindzie — tak samo jak plansze Kółka i Chińczyka.
// To nie jest kwestia techniki, tylko wyglądu: cała aplikacja stoi na PRZEŚWITUJĄCYCH
// białych panelach na fioletowym tle, więc ciemna plastikowa płyta z prawdziwych Czwórek
// wyglądałaby jak wklejka z innego programu. Rama idzie tymi samymi tokenami co `.card`,
// a otwory są ciemnymi przetarciami w panelu, nie dziurami w bryle.
//
// NIC W TEJ PLANSZY NIE JEST W PIKSELACH.
//
// To jest główna decyzja tego pliku i kosztowała dwie pomyłki, zanim stała się zasadą.
// Komponent zna tylko PUŁAP rozmiaru pola (`rozmiar`) — realny rozmiar wychodzi dopiero
// z szerokości ekranu albo z limitu wysokości i bywa o połowę mniejszy. Każda wartość
// policzona z pułapu w pikselach rozjeżdża się wtedy z tym, co widać:
//
//   - obwódka żetonu 0,16 × 110 px na polu, które wyszło 65 px, zamieniała zwycięską
//     czwórkę w cztery obwarzanki z punkcikiem w środku,
//   - odstęp 6 px przy polu 38 px na telefonie to 16 %, a nie zaplanowane 13 %.
//
// Dlatego promienie idą w procentach promienia pola, odstępy w procentach szerokości,
// a spadanie w procentach własnej wysokości. Ten sam komponent obsługuje telefon
// i ekran TV, a wygląda na nich identycznie.

/**
 * Barwy żetonów. Czerwony i żółty to klasyk gry, ale wybór ma też drugie dno:
 * różnią się nie samym odcieniem, lecz i JASNOŚCIĄ, więc przy daltonizmie protan/deutan
 * nadal da się je rozróżnić. Dwa równie jasne kolory (np. czerwony i zielony) wyglądałyby
 * przy takim wzroku identycznie, a cała gra polega na odróżnianiu swoich od cudzych.
 */
export const ZETONY = ["#FF3B5C", "#FFC93C"] as const;
const OBWODKA = "#2A1758";

/** Od tego promienia zaczyna się ciemny kant żetonu (w % promienia pola). */
const KANT = 86;
/** Od tego promienia zaczyna się obwódka zwycięskiej czwórki. */
const OBRECZ = 62;
/**
 * Obwódka zwycięskiej czwórki jest BIAŁA, nie w kolorze gry.
 *
 * Akcent Czwórek to fiolet — ten sam, na którym stoi całe tło aplikacji, i bardzo
 * bliski czerwieni żetonu. Na żółtych żetonach fioletowa obwódka była czytelna,
 * na czerwonych ginęła zupełnie, więc zwycięska czwórka wyglądała jak cztery zwykłe
 * żetony. Biel odcina się od obu barw jednakowo.
 */
const OBRECZ_BARWA = "#FFFFFF";

/** Odstęp między polami, w procentach szerokości POLA. */
const ODSTEP = 13;
/**
 * Wyściółka kolumny w procentach szerokości rzędu — połowa odstępu po każdej stronie.
 *
 * Wzór: przy K kolumnach i wyściółce x % rzędu odstęp wychodzi 2xK/(100−2xK) pola.
 * Dla siedmiu kolumn i 13 % daje to 0,82 %. Odstępy robi wyłącznie wyściółka, nie `gap`,
 * dzięki czemu podświetlenie kolumny pod palcem sięga do połowy przerwy i sąsiednie
 * pola nie „mrugają" przy przesuwaniu palca.
 */
const WYSCIOLKA = ((ODSTEP / (1 + ODSTEP / 100)) / (2 * KOLUMNY)).toFixed(3);

/** Ile trwa spadanie żetonu. Tyle, żeby dało się je zobaczyć, i nie dłużej. */
const SPADANIE_MS = 340;

function bezRuchu(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  );
}

/** Tło żetonu: barwa gracza, ciemny kant, a przy wygranej dodatkowa biała obręcz. */
function tloZetonu(znak: 0 | 1, wygrywa: boolean): string {
  const barwa = ZETONY[znak];
  // Jednoprocentowe przejście na każdym progu: twarde stopnie w gradiencie radialnym
  // potrafią schodkować, a okrąg to najgorszy możliwy przypadek dla schodków.
  return wygrywa
    ? `radial-gradient(circle at 50% 50%, ${barwa} 0 ${OBRECZ - 1}%, ${OBRECZ_BARWA} ${OBRECZ}% ${KANT - 1}%, ${OBWODKA} ${KANT}% 100%)`
    : `radial-gradient(circle at 50% 50%, ${barwa} 0 ${KANT - 1}%, ${OBWODKA} ${KANT}% 100%)`;
}

/**
 * Podgląd lądowania: sama obwódka w barwie gracza, otwór zostaje widoczny.
 *
 * Wcześniej był to zwykły żeton z `opacity`, ale przezroczysta barwa miesza się
 * z ciemnym otworem pod spodem i żółty wychodził beżowy — czyli tak, jak nie wygląda
 * żaden żeton w tej grze. Obwódka trzyma czystą barwę.
 */
function tloPodgladu(znak: 0 | 1): string {
  return `radial-gradient(circle at 50% 50%, transparent 0 73%, ${ZETONY[znak]} 76% 100%), rgb(0 0 0 / 0.22)`;
}

export function Zeton({ znak, size = 18 }: { znak: 0 | 1; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block flex-none rounded-full"
      style={{ width: size, height: size, background: tloZetonu(znak, false) }}
    />
  );
}

export function Plansza({
  plansza,
  linia,
  ostatni,
  rozmiar,
  onKolumna,
  aktywne,
  mojZnak,
  maxWys,
  accent,
}: {
  plansza: Pole[];
  /** Pola zwycięskiej linii — podświetlane po rozstrzygnięciu rundy. */
  linia?: readonly number[] | null;
  /** Pole ostatnio wrzuconego żetonu — to ono spada. */
  ostatni?: number | null;
  /** GÓRNA GRANICA średnicy otworu w px. Węższy ekran zmniejsza planszę proporcjonalnie. */
  rozmiar: number;
  onKolumna?: (kolumna: number) => void;
  /** Czy kolumny reagują na dotyk (tylko we własnej turze). */
  aktywne?: boolean;
  /** Znak gracza — barwa podglądu lądowania. Null u widza. */
  mojZnak?: 0 | 1 | null;
  /**
   * Ile wysokości ekranu (w dvh) plansza może najwyżej zająć.
   *
   * Sama szerokość NIE wystarcza. Sześć rzędów jest znacznie wyższe niż plansza Kółka,
   * więc na telewizorze 1280x720 plansza dobrana do szerokości schodziła poniżej ekranu
   * i widać było trzy rzędy z sześciu. Ograniczenie idzie przez `maxWidth`, bo to
   * szerokość rządzi rozmiarem pola, a proporcje planszy są stałe.
   */
  maxWys?: number;
  accent: string;
}) {
  const szerokoscMax = rozmiar * (KOLUMNY + (KOLUMNY + 1) * (ODSTEP / 100));
  const wysokoscMax = rozmiar * (WIERSZE + (WIERSZE + 1) * (ODSTEP / 100));
  const ograniczenie = maxWys
    ? `min(${Math.round(szerokoscMax)}px, ${((maxWys * szerokoscMax) / wysokoscMax).toFixed(1)}dvh)`
    : `${Math.round(szerokoscMax)}px`;

  // Spadanie. Żeton pojawia się przesunięty NAD swoim polem, a w następnej klatce wraca
  // na miejsce z przejściem — dzięki temu animacja nie potrzebuje własnych @keyframes,
  // których i tak nie ma gdzie postawić (globals.css nie zna poszczególnych gier).
  const [spada, setSpada] = useState<number | null>(null);
  const poprzedni = useRef<number | null>(null);
  const pierwszy = useRef(true);

  useEffect(() => {
    const zastane = pierwszy.current;
    pierwszy.current = false;
    const poprz = poprzedni.current;
    poprzedni.current = ostatni ?? null;

    // Wejście do trwającej partii to nie jest ruch. Spadający żeton przy każdym
    // odświeżeniu strony udawałby zdarzenie, którego nie było.
    if (ostatni == null || ostatni === poprz || zastane || bezRuchu()) return;

    setSpada(ostatni);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setSpada(null)));
    return () => cancelAnimationFrame(id);
  }, [ostatni]);

  const [podglad, setPodglad] = useState<number | null>(null);
  const kolumny = Array.from({ length: KOLUMNY }, (_, k) => k);

  return (
    <div
      // `overflow-hidden` NIE jest kosmetyką: bez niego spadający żeton leci nad ramą
      // planszy i wchodzi na nagłówek z nickami. Obcięcie do ramy daje przy okazji to,
      // co widać w prawdziwej grze — żeton wpada do planszy górną krawędzią.
      className="w-full overflow-hidden rounded-[18px] border-[3px] border-stroke bg-panel"
      style={{ maxWidth: ograniczenie, ["--accent" as string]: accent }}
      role="grid"
      aria-label="Plansza"
    >
      <div className="flex w-full" style={{ padding: `${WYSCIOLKA}%` }}>
        {kolumny.map((k) => {
          const cel = ladowanie(plansza, k);
          const klikalna = !!aktywne && cel !== null && !!onKolumna;
          return (
            <button
              key={k}
              type="button"
              role="gridcell"
              aria-label={`Kolumna ${k + 1}${cel === null ? " - pełna" : ""}`}
              disabled={!klikalna}
              onClick={() => klikalna && onKolumna?.(k)}
              onPointerEnter={() => setPodglad(k)}
              onPointerLeave={() => setPodglad((p) => (p === k ? null : p))}
              className="flex min-w-0 flex-1 flex-col rounded-[12px] transition-colors"
              style={{
                padding: `${WYSCIOLKA}%`,
                cursor: klikalna ? "pointer" : "default",
                background: klikalna && podglad === k ? "rgb(255 255 255 / 0.10)" : "transparent",
              }}
            >
              {Array.from({ length: WIERSZE }, (_, w) => {
                const i = idxPola(w, k);
                const znak = plansza[i];
                const wygrywa = !!linia?.includes(i);
                const leci = spada === i;
                // Podgląd: gdzie wyląduje żeton, gdy dotknę tej kolumny.
                const duch = klikalna && podglad === k && i === cel && mojZnak != null;

                return (
                  <span
                    key={w}
                    className="block w-full rounded-full"
                    style={{
                      aspectRatio: "1",
                      // Margines, nie `gap`: procent marginesu liczy się od szerokości
                      // pola, a procent odstępu w kolumnie od jej wysokości — czyli od
                      // wartości, którą same pola dopiero wyznaczają.
                      marginBottom: w === WIERSZE - 1 ? 0 : `${ODSTEP}%`,
                      // Otwór: ciemne przetarcie w panelu. Żeton: pełna barwa z kantem.
                      background: znak === null ? "rgb(0 0 0 / 0.22)" : tloZetonu(znak, wygrywa),
                      ...(duch ? { background: tloPodgladu(mojZnak) } : null),
                      // Głębia otworu zostaje w pikselach: kilka pikseli cienia wygląda
                      // tak samo przy każdym rozmiarze, w odróżnieniu od obwódki.
                      boxShadow: znak === null ? "inset 0 2px 4px rgb(0 0 0 / 0.35)" : "none",
                      // Pole jest kwadratowe, więc odstęp liczony od szerokości jest
                      // zarazem odstępem w pionie — i cała droga żetonu mieści się w %.
                      transform: leci ? `translateY(${-(w + 1) * (100 + ODSTEP)}%)` : "translateY(0)",
                      transition: leci ? "none" : `transform ${SPADANIE_MS}ms cubic-bezier(0.45, 0, 0.6, 1.25)`,
                    }}
                  />
                );
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
