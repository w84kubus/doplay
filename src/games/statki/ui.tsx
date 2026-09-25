"use client";
import { useRef } from "react";
import { idxPola } from "./plansza";

// Krata Statków. Geometria jest w PROCENTACH, nie w pikselach — dokładnie z tego samego
// powodu co w Czwórkach (patrz CLAUDE.md): komponent zna tylko PUŁAP rozmiaru pola,
// a realny rozmiar wychodzi dopiero z szerokości ekranu albo z limitu wysokości.
// Tu jest nawet ciaśniej: przy boku 10 pole na telefonie schodzi poniżej 30 px, więc
// obwódka policzona od pułapu zjadłaby je w całości.

/** Co widać na polu. Parent wylicza to z publicView — krata sama nic nie wie o grze. */
export type StanPola =
  | "woda" // nic nie wiadomo
  | "pudlo" // ktoś strzelał, pusto
  | "statek" // mój statek, cały (widoczny WYŁĄCZNIE na własnej planszy)
  | "zly" // podgląd przeciąganego statku w miejscu, w którym nie stanie
  | "trafienie" // trafiony, ale statek jeszcze pływa
  | "zatopiony"; // pole statku, który poszedł na dno

const WODA = "rgb(0 0 0 / 0.20)";
const TRAFIENIE = "#FF3B5C";
const ZATOPIONY = "#2A1758";

/** Odstęp między polami, w procentach szerokości POLA. */
const ODSTEP = 12;
/** Wyściółka kolumny w procentach szerokości kraty — połowa odstępu z każdej strony. */
const wyscielka = (bok: number) => ((ODSTEP / (1 + ODSTEP / 100)) / (2 * bok)).toFixed(3);

function tloPola(stan: StanPola, accent: string): string {
  switch (stan) {
    case "pudlo":
      // Biała kropka na wodzie — klasyczny znak pudła z kartki w kratkę.
      return `radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.65) 0 17%, transparent 19%), ${WODA}`;
    case "statek":
      return `linear-gradient(160deg, ${accent} 0%, color-mix(in srgb, ${accent} 72%, #000000) 100%)`;
    case "zly":
      // Podgląd ustawienia, które łamie reguły. Ta sama bryła co statek, tylko w czerwieni —
      // ma się czytać jako „ten statek, ale nie tutaj", a nie jako nowy rodzaj pola.
      return `linear-gradient(160deg, ${TRAFIENIE} 0%, color-mix(in srgb, ${TRAFIENIE} 60%, #000000) 100%)`;
    case "trafienie":
      // Czerwień z ciemnym krzyżykiem — „trafiony" ma być widać kątem oka.
      return `linear-gradient(45deg, transparent 43%, ${ZATOPIONY} 43% 57%, transparent 57%), linear-gradient(-45deg, transparent 43%, ${ZATOPIONY} 43% 57%, transparent 57%), ${TRAFIENIE}`;
    case "zatopiony":
      return `linear-gradient(160deg, ${TRAFIENIE} 0%, color-mix(in srgb, ${TRAFIENIE} 55%, #000000) 100%)`;
    default:
      return WODA;
  }
}

export function Krata({
  bok,
  stany,
  rozmiar,
  maxWys,
  onPole,
  aktywne,
  wybrane,
  accent,
  etykieta,
  onChwyt,
  onCel,
  onPusc,
}: {
  bok: number;
  /** Stan każdego pola, długość bok². Parent liczy to z publicView. */
  stany: StanPola[];
  /** GÓRNA GRANICA boku pola w px. Węższy ekran zmniejsza kratę proporcjonalnie. */
  rozmiar: number;
  /**
   * Ile wysokości ekranu (w dvh) krata może najwyżej zająć — wartość DOMYŚLNA.
   *
   * Nadpisuje ją zmienna `--krata-maxwys` ustawiona gdziekolwiek wyżej w drzewie.
   * Jest tak, bo limit musi być różny na telefonie i na desktopie (tam plansze stoją
   * obok siebie, a nie jedna pod drugą), a zwykły props nie zna punktów łamania.
   * Zmienną ustawia się klasą Tailwinda, czyli w tym samym miejscu co resztę układu.
   */
  maxWys?: number;
  onPole?: (pole: number) => void;
  /** Które pola reagują na dotyk. Null = żadne. */
  aktywne?: (pole: number) => boolean;
  /** Pola podświetlone — wybrany statek w fazie ustawiania. */
  wybrane?: readonly number[];
  accent: string;
  etykieta: string;
  /**
   * Przeciąganie. Krata nie wie nic o statkach — melduje tylko, że palec wszedł na pole
   * `z`, wędruje nad polem `na` i został puszczony. Co z tego wynika, wie widok.
   *
   * Podane razem włączają gest; brak `onChwyt` zostawia kratę na samych dotknięciach.
   */
  onChwyt?: (pole: number) => void;
  onCel?: (pole: number) => void;
  /** `przesuniety` mówi, czy palec w ogóle opuścił pole startowe. */
  onPusc?: (przesuniety: boolean) => void;
}) {
  const bokKraty = rozmiar * (bok + (bok + 1) * (ODSTEP / 100));
  const ograniczenie = `min(${Math.round(bokKraty)}px, var(--krata-maxwys, ${(maxWys ?? 100).toFixed(1)}dvh))`;
  const podswietlone = new Set(wybrane ?? []);

  // Przeciąganie na wskaźnikach (Pointer Events), nie na osobnych obsługach myszy i dotyku.
  // Jedna ścieżka dla palca, myszy i rysika, a `setPointerCapture` sprawia, że gest nie gubi
  // się, gdy palec wyjedzie poza pole, w którym się zaczął — a wyjeżdża zawsze, bo o to chodzi.
  const ciagnie = useRef(false);
  const startowe = useRef<number | null>(null);
  const ostatnie = useRef<number | null>(null);
  /** Czy gest był przeciągnięciem, czy zwykłym dotknięciem. Rozstrzyga ZMIANA POLA, nie piksele. */
  const przesuniety = useRef(false);

  /** Pole pod wskaźnikiem. Liczone z DOM-u, nie z arytmetyki na prostokącie kraty:
   *  odstępy są procentowe, a krata skaluje się do ekranu, więc każdy własny wzór
   *  byłby drugą, milczącą kopią układu — i rozjechałby się przy pierwszej zmianie. */
  const poleZPunktu = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest("[data-pole]");
    const numer = el?.getAttribute("data-pole");
    return numer == null ? null : Number(numer);
  };

  return (
    <div
      className="w-full rounded-[16px] border-[3px] border-stroke bg-panel"
      style={{ maxWidth: ograniczenie, padding: `${wyscielka(bok)}%`, ["--accent" as string]: accent }}
      role="grid"
      aria-label={etykieta}
    >
      {/* Kolumnami, nie wierszami: procent marginesu liczy się od szerokości pojemnika,
          więc w pionowym stosie wychodzi procent POLA — a tego właśnie chcemy. */}
      <div className="flex w-full">
        {Array.from({ length: bok }, (_, k) => (
          <div key={k} className="flex min-w-0 flex-1 flex-col" style={{ padding: `${wyscielka(bok)}%` }}>
            {Array.from({ length: bok }, (_, w) => {
              const pole = idxPola(w, k, bok);
              const stan = stany[pole] ?? "woda";
              const klikalne = !!onPole && !!aktywne?.(pole);
              return (
                <button
                  key={w}
                  type="button"
                  role="gridcell"
                  disabled={!klikalne}
                  aria-label={`${etykieta}, wiersz ${w + 1}, kolumna ${k + 1}`}
                  data-pole={pole}
                  onClick={() => {
                    // Po przeciągnięciu przeglądarka i tak wyśle `click` na pole startowe.
                    // Bez tego jedno pociągnięcie robiłoby dwie rzeczy naraz.
                    if (przesuniety.current) {
                      przesuniety.current = false;
                      return;
                    }
                    if (klikalne) onPole?.(pole);
                  }}
                  onPointerDown={(e) => {
                    if (!onChwyt || !klikalne || stan !== "statek") return;
                    ciagnie.current = true;
                    przesuniety.current = false;
                    startowe.current = pole;
                    ostatnie.current = pole;
                    onChwyt(pole);
                    // Przechwycenie wskaźnika jest UŁATWIENIEM, nie warunkiem: z nim kolejne
                    // zdarzenia wracają do pola startowego, bez niego lecą do pola pod palcem.
                    // Jedno i drugie działa, bo stan gestu jest wspólny dla całej kraty, a pole
                    // liczymy ze współrzędnych. Dlatego wyjątek stąd nie ma prawa przerwać gestu.
                    try {
                      e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // przeglądarka bez przechwytywania albo wskaźnik już zwolniony
                    }
                  }}
                  onPointerMove={(e) => {
                    if (!ciagnie.current) return;
                    const teraz = poleZPunktu(e.clientX, e.clientY);
                    if (teraz == null || teraz === ostatnie.current) return;
                    ostatnie.current = teraz;
                    if (teraz !== startowe.current) przesuniety.current = true;
                    onCel?.(teraz);
                  }}
                  onPointerUp={() => {
                    if (!ciagnie.current) return;
                    ciagnie.current = false;
                    onPusc?.(przesuniety.current);
                  }}
                  onPointerCancel={() => {
                    if (!ciagnie.current) return;
                    ciagnie.current = false;
                    przesuniety.current = false;
                    onPusc?.(false);
                  }}
                  className="block w-full rounded-[18%] transition-transform duration-75 active:translate-y-[2px] disabled:active:translate-y-0"
                  style={{
                    aspectRatio: "1",
                    marginBottom: w === bok - 1 ? 0 : `${ODSTEP}%`,
                    background: tloPola(stan, accent),
                    boxShadow: podswietlone.has(pole)
                      ? `inset 0 0 0 2px #FFFFFF`
                      : stan === "woda" || stan === "pudlo"
                        ? "inset 0 2px 3px rgb(0 0 0 / 0.30)"
                        : "none",
                    cursor: klikalne ? (onChwyt && stan === "statek" ? "grab" : "pointer") : "default",
                    // `touch-action: none` TYLKO na statkach. Na całej kracie odebrałoby
                    // przewijanie strony: ekran ustawiania jest wyższy niż telefon, a palec
                    // ląduje na planszy jako pierwszy. Z wody strona przewija się normalnie,
                    // ze statku zaczyna się przeciąganie i przeglądarka go nie przerywa.
                    touchAction: onChwyt && stan === "statek" ? "none" : undefined,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Pasek floty: ile statków której długości jeszcze pływa. */
export function Flota({
  sklad,
  zatopionych,
  accent,
}: {
  sklad: readonly number[];
  zatopionych: number;
  accent: string;
}) {
  // Które statki poszły na dno, nie wiadomo — wiadomo tylko ILE. Dlatego gasimy
  // je od najdłuższego: to informacja o liczbie, nie o tym, który konkretnie.
  return (
    // Pasek musi zmieścić dziesięć statków (plansza 10x10) w kolumnie węższej niż plansza
    // przeciwnika. Przy `gap-1.5` ostatni jednomasztowiec spadał do drugiego rzędu i wyglądał
    // jak usterka, a nie jak pasek floty. Zawijanie zostaje na wypadek jeszcze węższych
    // ekranów, ale przy normalnych szerokościach nie ma już czego zawijać.
    <div className="flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-1.5">
      {[...sklad].sort((a, b) => b - a).map((dlugosc, i) => (
        <span
          key={i}
          aria-hidden
          className="flex gap-[2px] rounded-[6px] p-[2px]"
          style={{ opacity: i < zatopionych ? 0.28 : 1 }}
        >
          {Array.from({ length: dlugosc }, (_, j) => (
            <span
              key={j}
              className="block size-2.5 rounded-[3px]"
              style={{ background: i < zatopionych ? ZATOPIONY : accent }}
            />
          ))}
        </span>
      ))}
    </div>
  );
}
