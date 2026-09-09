"use client";
import { useT } from "@/lib/i18n/provider";
import type { GameHostViewProps } from "@/games/view";
import { BARWY, Plansza } from "./Plansza";
import { Kostka } from "./Kostka";
import { META, pionkiKoloru } from "./engine";

interface Slot {
  kolor: string;
  uid: string | null;
  nick: string | null;
}
interface Pub {
  phase: "kolory" | "rzut" | "ruch" | "wynik" | "koniec";
  sloty: Slot[];
  pionki: number[];
  tura: number;
  kostka: number | null;
  zwyciezca: number | null;
}

// Ekran hosta na TV. Renderuje WYŁĄCZNIE stan publiczny — a chińczyk nie ma innego,
// więc nie ma tu czego ukrywać. Plansza jest ta sama co na telefonie, tylko większa.
export function ChinczykHostView({ publicState }: GameHostViewProps) {
  const t = useT();
  const pub = publicState as Pub;
  const barwa = BARWY[pub.tura] ?? "#FFFFFF";
  const koniecPartii = pub.phase === "wynik" || pub.phase === "koniec";

  if (pub.phase === "kolory") {
    return (
      <div className="flex w-full max-w-4xl flex-col items-center gap-6">
        <p className="font-display text-3xl font-bold uppercase tracking-[0.2em] text-ink">
          {t("chinczyk.pickColour")}
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {pub.sloty.map((s, k) => (
            <div
              key={k}
              className="font-display flex min-w-[9rem] items-center justify-center rounded-[18px] border-[5px] px-5 py-4 text-lg font-bold uppercase"
              style={{ background: s.uid ? BARWY[k] : "transparent", borderColor: BARWY[k], opacity: s.uid ? 1 : 0.35 }}
            >
              {s.nick ?? "—"}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-6 md:flex-row md:items-start md:justify-center">
      {/* Telewizora nikt nie przewija, więc plansza nie może być wyższa niż ekran.
          Kwadrat ograniczamy szerokością liczoną z wysokości okna — przy układzie
          jeden pod drugim (poniżej `lg`) inaczej wychodziła poza dolną krawędź. */}
      <div className="w-full" style={{ maxWidth: "min(42rem, 72dvh)" }}>
        <Plansza pionki={pub.pionki} sloty={pub.sloty.map((s) => s.uid)} tura={pub.tura} />
      </div>

      <aside className="flex w-full max-w-sm flex-col items-center gap-5">
        <div
          className="font-display w-full rounded-[18px] border-[5px] px-5 py-4 text-center text-2xl font-bold uppercase tracking-[0.06em]"
          style={{ background: `${barwa}33`, borderColor: barwa }}
        >
          {koniecPartii
            ? t("chinczyk.won", { nick: pub.sloty[pub.zwyciezca ?? 0]?.nick ?? "" })
            : t("chinczyk.turnOf", { nick: pub.sloty[pub.tura]?.nick ?? "" })}
        </div>

        {!koniecPartii && <Kostka wartosc={pub.kostka} kolor={barwa} bok={104} />}

        <ul className="flex w-full flex-col gap-2">
          {pub.sloty.map((s, k) =>
            s.uid ? (
              <li
                key={k}
                className="flex items-center justify-between rounded-[14px] border-[3px] px-4 py-2 text-base font-bold"
                style={{ borderColor: BARWY[k], background: `${BARWY[k]}22` }}
              >
                <span className="text-ink">{s.nick}</span>
                <span className="tabular text-ink-muted">
                  {pionkiKoloru(pub.pionki, k).filter((p) => p === META).length} / 4
                </span>
              </li>
            ) : null,
          )}
        </ul>
      </aside>
    </div>
  );
}
