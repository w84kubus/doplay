"use client";
import { useT } from "@/lib/i18n/provider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { doubleColourOf } from "./tables";

// Historia ostatnich losowań — tablica jak w prawdziwym kasynie.
//
// Dane były w stanie i w publicView od początku, tylko nikt ich nie pokazywał.
// Silnik trzyma 12 ostatnich wpisów, najnowszy pierwszy, w formacie zależnym
// od trybu: numer pola (double), „x{mnożnik}" (wheel) albo uid zwycięzcy (jackpot).
//
// Sloty świadomie pominięte: każdy kręci osobno i we własnym tempie, więc wspólna
// historia rundy nie ma tam sensu — silnik zapisuje dla nich „-".

type Gracz = { uid: string; nick: string; avatar: string };

export function Historia({
  history,
  mode,
  players,
}: {
  history: string[];
  mode: "jackpot" | "double" | "wheel" | "sloty";
  players: Gracz[];
}) {
  const t = useT();
  if (mode === "sloty" || history.length === 0) return null;

  return (
    <section className="flex w-full max-w-md flex-col gap-1.5">
      <span className="font-display text-xs font-bold uppercase tracking-[0.06em] text-ink-muted">
        {t("kasyno.history")}
      </span>
      {/* Pasek przewija się poziomo we własnym kontenerze — przy 12 wpisach
          i wąskim telefonie inaczej rozpychałby całą stronę. */}
      <ol className="flex gap-1.5 overflow-x-auto pb-1" aria-label={t("kasyno.history")}>
        {history.map((wpis, i) => (
          <li key={i} className="flex-none">
            <Wpis wpis={wpis} mode={mode} players={players} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Wpis({ wpis, mode, players }: { wpis: string; mode: string; players: Gracz[] }) {
  if (mode === "double") {
    const n = Number(wpis);
    const kolor = Number.isFinite(n) ? doubleColourOf(n) : null;
    const tlo =
      kolor === "green" ? "var(--color-mint)" : kolor === "red" ? "var(--color-czerwien)" : "#1B1730";
    const atrament = kolor === "green" ? "#06281A" : "#FFFFFF";
    return (
      <span
        className="tabular flex size-9 items-center justify-center rounded-full border-2 border-stroke text-sm font-bold"
        style={{ background: tlo, color: atrament }}
        title={wpis}
      >
        {wpis}
      </span>
    );
  }

  if (mode === "wheel") {
    // ×35 wypada raz na czterdzieści rund — wyróżniony, bo to jedyny wpis,
    // na który ktokolwiek czeka.
    const rzadki = wpis === "x35";
    return (
      <span
        className={`tabular flex h-9 min-w-9 items-center justify-center rounded-[10px] border-2 px-2 text-sm font-bold ${
          rzadki ? "border-bursztyn bg-bursztyn/20 text-bursztyn" : "border-stroke bg-panel text-ink"
        }`}
      >
        {wpis.replace("x", "×")}
      </span>
    );
  }

  // jackpot — wpisem jest uid zwycięzcy
  const gracz = players.find((p) => p.uid === wpis);
  if (!gracz) {
    return (
      <span className="flex size-9 items-center justify-center rounded-full border-2 border-stroke bg-panel text-sm font-bold text-ink-muted">
        -
      </span>
    );
  }
  return (
    <span
      className="flex size-9 items-center justify-center rounded-full border-2 border-stroke bg-panel"
      title={gracz.nick}
    >
      <AvatarIcon avatar={gracz.avatar} size={20} />
    </span>
  );
}
