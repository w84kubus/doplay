"use client";
import type { GameHostViewProps } from "@/games/view";
import { useI18n } from "@/lib/i18n/provider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { Flota, Krata, type StanPola } from "./ui";

interface PlanszaPub {
  trafienia: number[];
  pudla: number[];
  zatopione: number[];
  statkow: number;
  zatopionych: number;
}
interface Pub {
  phase: "ustawianie" | "strzal" | "wynik" | "koniec";
  round: number; totalRounds: number; bok: number; sklad: number[];
  para: [string, string]; turaUid: string | null; gotowi: string[];
  ostatni: { uid: string; pole: number; trafiony: boolean; zatopiony: boolean } | null;
  plansze: Record<string, PlanszaPub>;
  ostatnia: { zwyciezca: string | null } | null;
  players: { uid: string; nick: string; avatar: string; score: number; gra: boolean }[];
}

/**
 * Ekran TV. Obie plansze obok siebie — i ANI JEDNEGO statku, którego nie odsłoniły strzały.
 *
 * To nie jest to samo co telefon: telewizor widzą wszyscy w pokoju, także gracz, którego
 * flota jest na ekranie. Dlatego ten widok dostaje wyłącznie `publicState`, tak jak każdy
 * inny ekran wspólny — floty po prostu nie ma z czego narysować.
 */
export function StatkiHostView({ publicState, accent }: GameHostViewProps) {
  const { t } = useI18n();
  const pub = publicState as Pub;
  const nickOf = (uid: string) => pub.players.find((p) => p.uid === uid)?.nick ?? "?";

  const stany = (uid: string): StanPola[] => {
    const plansza = pub.plansze[uid];
    const wynik: StanPola[] = Array(pub.bok * pub.bok).fill("woda");
    for (const p of plansza?.pudla ?? []) wynik[p] = "pudlo";
    for (const p of plansza?.trafienia ?? []) wynik[p] = "trafienie";
    for (const p of plansza?.zatopione ?? []) wynik[p] = "zatopiony";
    return wynik;
  };

  const status =
    pub.phase === "ustawianie"
      ? t("statki.tvSetup", { ile: pub.gotowi.length, z: 2 })
      : pub.phase === "strzal"
        ? t("statki.nowShooting", { nick: nickOf(pub.turaUid ?? "") })
        : t("statki.winner", { nick: nickOf(pub.ostatnia?.zwyciezca ?? "") });

  return (
    <div className="flex w-full max-w-6xl flex-col items-center gap-4" style={{ ["--accent" as string]: accent }}>
      <p className="text-base uppercase tracking-[0.3em] text-[var(--color-ink-muted)]">
        {t("statki.round", { round: pub.round })}{pub.totalRounds ? ` / ${pub.totalRounds}` : ""}
      </p>

      <div className="flex w-full flex-col items-center justify-center gap-6 md:flex-row md:items-start md:gap-10">
        {pub.para.map((uid) => (
          <section key={uid} className="flex w-full min-w-0 flex-1 flex-col items-center gap-3">
            <p className="flex items-center gap-2 text-2xl font-bold">
              <AvatarIcon avatar={pub.players.find((p) => p.uid === uid)?.avatar ?? ""} size={30} />
              {nickOf(uid)}
              <span className="tabular font-bold" style={{ color: accent }}>
                {pub.players.find((p) => p.uid === uid)?.score ?? 0}
              </span>
            </p>
            <Krata bok={pub.bok} stany={stany(uid)} rozmiar={90} maxWys={52} accent={accent} etykieta={nickOf(uid)} />
            <Flota sklad={pub.sklad} zatopionych={pub.plansze[uid]?.zatopionych ?? 0} accent={accent} />
          </section>
        ))}
      </div>

      <p className="text-2xl" style={{ color: accent }}>{status}</p>
    </div>
  );
}
