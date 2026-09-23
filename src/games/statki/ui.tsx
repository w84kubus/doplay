"use client";
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
}: {
  bok: number;
  /** Stan każdego pola, długość bok². Parent liczy to z publicView. */
  stany: StanPola[];
  /** GÓRNA GRANICA boku pola w px. Węższy ekran zmniejsza kratę proporcjonalnie. */
  rozmiar: number;
  /** Ile wysokości ekranu (w dvh) krata może najwyżej zająć. */
  maxWys?: number;
  onPole?: (pole: number) => void;
  /** Które pola reagują na dotyk. Null = żadne. */
  aktywne?: (pole: number) => boolean;
  /** Pola podświetlone — wybrany statek w fazie ustawiania. */
  wybrane?: readonly number[];
  accent: string;
  etykieta: string;
}) {
  const bokKraty = rozmiar * (bok + (bok + 1) * (ODSTEP / 100));
  const ograniczenie = maxWys
    ? `min(${Math.round(bokKraty)}px, ${maxWys.toFixed(1)}dvh)`
    : `${Math.round(bokKraty)}px`;
  const podswietlone = new Set(wybrane ?? []);

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
                  onClick={() => klikalne && onPole?.(pole)}
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
                    cursor: klikalne ? "pointer" : "default",
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
    <div className="flex flex-wrap items-center justify-center gap-1.5">
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
