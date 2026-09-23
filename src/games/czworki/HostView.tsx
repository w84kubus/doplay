"use client";
import type { GameHostViewProps } from "@/games/view";
import { useI18n } from "@/lib/i18n/provider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { Plansza, Zeton } from "./ui";
import type { Pole } from "./engine";

interface Pub {
  phase: "gra" | "wynik" | "koniec";
  round: number; totalRounds: number;
  plansza: Pole[]; para: [string, string]; turaUid: string | null; ostatni: number | null;
  ostatnia: { zwyciezca: string | null; linia: readonly number[] | null } | null;
  players: { uid: string; nick: string; avatar: string; score: number; gra: boolean }[];
}

// Ekran TV. Plansza obok tabeli, nie nad nią — tak samo jak w Chińczyku i z tego samego
// powodu: sześć rzędów jest wysokie, a telewizor jest szeroki. Ułożone w kolumnie,
// plansza dobrana do szerokości schodziła poniżej dolnej krawędzi ekranu 1280x720
// i z sześciu rzędów widać było trzy.
export function CzworkiHostView({ publicState, accent }: GameHostViewProps) {
  const { t } = useI18n();
  const pub = publicState as Pub;
  const nickOf = (uid: string) => pub.players.find((p) => p.uid === uid)?.nick ?? "?";

  return (
    <div className="flex w-full max-w-6xl flex-col items-center gap-5" style={{ ["--accent" as string]: accent }}>
      <p className="text-base uppercase tracking-[0.3em] text-[var(--color-ink-muted)]">
        {t("czworki.round", { round: pub.round })}{pub.totalRounds ? ` / ${pub.totalRounds}` : ""}
      </p>

      <div className="flex w-full flex-col items-center gap-6 md:flex-row md:items-center md:justify-center md:gap-10">
        {/* Plansza dostaje KONKRETNĄ szerokość do podziału (`flex-1`), a nie `w-auto`.
            Przy `w-auto` jej wewnętrzne `w-full` liczyłoby się od szerokości, którą sama
            wyznacza — błędne koło, które przeglądarka rozstrzyga na korzyść minimum
            i plansza kurczy się do kilkudziesięciu pikseli. */}
        <div className="flex w-full min-w-0 flex-1 justify-center">
          <Plansza
            plansza={pub.plansza}
            linia={pub.ostatnia?.linia}
            ostatni={pub.ostatni}
            rozmiar={140}
            maxWys={66}
            accent={accent}
          />
        </div>

        <aside className="flex w-full max-w-sm flex-col items-center gap-5 md:flex-none">
          <p className="flex flex-col items-center gap-2 text-3xl font-bold">
            <span className="inline-flex items-center gap-2"><Zeton znak={0} size={26} /> {nickOf(pub.para[0])}</span>
            <span className="text-xl text-[var(--color-ink-muted)]">vs</span>
            <span className="inline-flex items-center gap-2"><Zeton znak={1} size={26} /> {nickOf(pub.para[1])}</span>
          </p>

          {pub.phase === "gra" ? (
            <p className="text-2xl" style={{ color: accent }}>{t("czworki.nowPlaying", { nick: nickOf(pub.turaUid ?? "") })}</p>
          ) : (
            <p className="text-3xl font-bold" style={{ color: accent }}>
              {pub.ostatnia?.zwyciezca ? t("czworki.winner", { nick: nickOf(pub.ostatnia.zwyciezca) }) : t("czworki.draw")}
            </p>
          )}

          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {[...pub.players].sort((a, b) => b.score - a.score).map((p) => (
              <div key={p.uid} className="flex items-center gap-2 text-lg">
                <AvatarIcon avatar={p.avatar} size={26} /><span>{p.nick}</span>
                <span className="tabular font-bold" style={{ color: accent }}>{p.score}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
