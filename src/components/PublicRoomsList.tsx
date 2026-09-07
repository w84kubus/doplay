"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Users } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { AvatarIcon, avatarColor } from "@/components/AvatarIcon";
import type { PubliczyPokoj } from "@/lib/server/publiczne";

// Lista pokoi otwartych dla obcych.
//
// Świadomie BEZ nicków: to jedyny ekran w aplikacji, który widzi ktoś spoza pokoju,
// więc nie pokazujemy tu żadnego tekstu wpisanego przez gracza. Kto siedzi w środku,
// widać po awatarach, a te są identyfikatorami z zamkniętej listy, nie tekstem.
//
// Odświeżanie odpytywaniem, nie onSnapshot: lista idzie z Route Handlera, żeby reguły
// Firestore zostały zamknięte. Wejście do pokoju, który właśnie zniknął, i tak obsługuje
// błąd z /join.
const ODSWIEZANIE_MS = 5000;

/**
 * Nie odpytuj częściej niż co tyle. Zabezpieczenie przed lawiną przy powrocie do karty:
 * przełączenie okna potrafi wystrzelić `visibilitychange` i `focus` jedno po drugim,
 * a przeglądarka dokłada do tego zaległy tik interwału.
 */
const MIN_ODSTEP_MS = 1500;

/**
 * Jak dawno pokój stoi otwarty. To jedyny sygnał, po którym obcy pozna, czy ktoś tam
 * jeszcze siedzi, czy trafi do lobby, z którego wszyscy się rozeszli. Nazwy gry pokazać
 * nie można: w lobby dokument nie zna wybranej gry, bo wybór żyje u hosta do startu.
 */
function swiezosc(createdAt: number, t: (k: "publiczne.justOpened" | "publiczne.openedMin", p?: Record<string, string | number>) => string): string {
  const min = Math.floor((Date.now() - createdAt) / 60000);
  return min < 1 ? t("publiczne.justOpened") : t("publiczne.openedMin", { min });
}

export function PublicRoomsList({
  onPick,
  busy,
  onLoaded,
}: {
  onPick: (code: string) => void;
  busy: boolean;
  onLoaded?: (pokoje: PubliczyPokoj[]) => void;
}) {
  const t = useT();
  const [pokoje, setPokoje] = useState<PubliczyPokoj[] | null>(null);
  const [odswieza, setOdswieza] = useState(false);
  const ostatnie = useRef(0);

  const pobierz = useCallback(async () => {
    ostatnie.current = Date.now();
    setOdswieza(true);
    try {
      const r = await fetch("/api/rooms/publiczne", { cache: "no-store" });
      const dane = (await r.json()) as { pokoje?: PubliczyPokoj[] };
      const lista = dane.pokoje ?? [];
      setPokoje(lista);
      onLoaded?.(lista);
    } catch {
      setPokoje([]); // cisza zamiast błędu: pusta lista i tak zachęca do założenia pokoju
      onLoaded?.([]);
    } finally {
      setOdswieza(false);
    }
  }, [onLoaded]);

  useEffect(() => {
    pobierz();
    const id = setInterval(pobierz, ODSWIEZANIE_MS);

    // Powrót do karty odświeża natychmiast. To jest ta poprawka, którą widać najbardziej:
    // przeglądarka usypia interwały w tle, więc po przełączeniu okna lista potrafiła być
    // stara o kilkadziesiąt sekund, a użytkownik patrzył na nią od razu po powrocie.
    const naPowrot = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ostatnie.current < MIN_ODSTEP_MS) return;
      pobierz();
    };
    document.addEventListener("visibilitychange", naPowrot);
    window.addEventListener("focus", naPowrot);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", naPowrot);
      window.removeEventListener("focus", naPowrot);
    };
  }, [pobierz]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-bold uppercase tracking-[0.06em] text-mint">
          {t("entry.publicRooms")}
        </span>
        <button
          type="button"
          onClick={pobierz}
          className="font-display flex min-h-[44px] items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-ink-muted transition-colors hover:text-ink"
        >
          <RefreshCw size={14} strokeWidth={2.5} className={odswieza ? "animate-spin" : ""} aria-hidden />
          {t("publiczne.refresh")}
        </button>
      </div>

      {pokoje === null ? (
        <p className="py-6 text-center text-sm text-ink-muted">{t("publiczne.loading")}</p>
      ) : pokoje.length === 0 ? (
        <p className="rounded-[14px] border-[3px] border-dashed border-stroke px-4 py-5 text-center text-sm leading-relaxed text-ink-muted">
          {t("publiczne.empty")}
        </p>
      ) : (
        /* Przewijanie w osobnym opakowaniu, nie na <ul>. CSS wylicza `overflow-x`
           na `auto`, gdy druga oś nie jest `visible`, więc kontener przycinał cień
           3 px pod ostatnim kafelkiem i obwódkę fokusu po bokach. Padding robi im
           miejsce, a ujemny margines cofa kafelki na tę samą oś co reszta panelu
           (karta ma 24 px paddingu, więc 6 px zapasu się mieści). */
        <div className="-mx-1.5 max-h-[19rem] overflow-y-auto px-1.5 pb-1.5">
          <ul className="flex flex-col gap-2">
            {pokoje.map((p) => (
              <li key={p.code}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(p.code)}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-[14px] border-[3px] border-stroke bg-panel px-3 py-2 text-left shadow-[0_3px_0_rgb(0_0_0/0.35)] transition-transform duration-75 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-mint focus-visible:outline-offset-2 active:translate-y-[3px] active:shadow-none disabled:opacity-50"
                >
                  <span className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                    <span className="font-display flex items-center gap-1.5 text-sm font-bold uppercase tracking-[0.06em] text-ink">
                      <Users size={14} strokeWidth={2.5} aria-hidden />
                      {t("publiczne.waiting", { ilu: p.ilu })}
                    </span>
                    <span className="truncate text-xs font-semibold text-ink-muted">{swiezosc(p.createdAt, t)}</span>
                  </span>
                  {/* Cztery awatary i dość: liczba osób stoi obok cyfrą, więc to jest
                      ozdoba. Przy pięciu rząd zjadał tekst obok na wąskim telefonie. */}
                  <span className="flex flex-none -space-x-2">
                    {p.avatars.slice(0, 4).map((a, i) => (
                      <span
                        key={i}
                        className="flex size-7 items-center justify-center rounded-full border-2 border-stroke"
                        style={{ background: avatarColor(a) }}
                        aria-hidden
                      >
                        <AvatarIcon avatar={a} size={16} />
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
