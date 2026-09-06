"use client";
import { useI18n } from "@/lib/i18n/provider";
import { Flag, Moon, Skull, Spade, Sun, Sunrise, Vote } from "lucide-react";
import type { GameHostViewProps } from "@/games/view";
import type { Role } from "./engine";
import { AvatarIcon } from "@/components/AvatarIcon";

interface PlayerV { uid: string; nick: string; avatar: string; alive: boolean; voted: boolean; role: Role | null; score: number }
interface Pub {
  phase: string; night: number; narrator: string; narratorKey: string | null; deaths: string[]; winner: "miasto" | "mafia" | "zakochani" | null;
  players: PlayerV[]; votesTally: Record<string, number>; aliveCount: number;
}
const ROLE_NAME: Record<Role, string> = {
  mafia: "Mafia", mieszkaniec: "Mieszkaniec", detektyw: "Detektyw", lekarz: "Lekarz",
  szeryf: "Szeryf", barman: "Barman", snajper: "Snajper",
  kamikadze: "Kamikadze", zakochani: "Zakochani",
};

export function MafiaHostView({ publicState, accent }: GameHostViewProps) {
  const { t } = useI18n();
  const pub = publicState as Pub;
  const nickOf = (uid: string) => pub.players.find((p) => p.uid === uid)?.nick ?? "?";
  const night = pub.phase === "noc" || (pub.phase === "switt" && pub.narrator);

  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-6" style={{ ["--accent" as string]: accent, filter: night ? "brightness(0.85)" : undefined }}>
      <p className="flex items-center justify-center gap-2 text-2xl">
        {pub.phase === "noc" ? <><Moon size={26} strokeWidth={2.5} aria-hidden /> {t("mafia.night", { n: pub.night })}</> :
         pub.phase === "dzien" ? <><Sun size={26} strokeWidth={2.5} aria-hidden /> {t("mafia.day", { n: pub.night })}</> :
         pub.phase === "glosowanie" ? <><Vote size={26} strokeWidth={2.5} aria-hidden /> {t("mafia.voting")}</> :
         pub.phase === "switt" ? <><Sunrise size={26} strokeWidth={2.5} aria-hidden /> {t("mafia.dawn")}</> :
         pub.phase === "koniec" ? <><Flag size={26} strokeWidth={2.5} aria-hidden /> {t("mafia.end")}</> :
         <><Spade size={26} strokeWidth={2.5} aria-hidden /> {t("mafia.deal")}</>}
      </p>
      <p className="max-w-2xl text-center text-xl italic text-[var(--color-ink-muted)]">{pub.narratorKey ? t(pub.narratorKey as Parameters<typeof t>[0]) : pub.narrator}</p>

      {pub.phase === "switt" && (
        <div className="text-center">
          {pub.deaths.length ? pub.deaths.map((d) => (
            <p key={d} className="text-3xl font-bold"><Skull size={30} strokeWidth={2.5} className="inline-block align-[-0.18em]" aria-hidden /> {nickOf(d)}{pub.players.find((p) => p.uid === d)?.role ? ` - ${ROLE_NAME[pub.players.find((p) => p.uid === d)!.role!]}` : ""}</p>
          )) : <p className="text-2xl text-[var(--color-ink-muted)]">{t("mafia.quietNight")}</p>}
        </div>
      )}

      {pub.phase === "koniec" ? (
        <>
          <p className="text-4xl font-bold" style={{ color: pub.winner === "mafia" ? accent : "#4ade80" }}>
            {pub.winner === "zakochani" ? t("mafia.loversWin") : pub.winner === "mafia" ? t("mafia.mafiaWins") : t("mafia.townWins")}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {pub.players.map((p) => (
              <div key={p.uid} className="card px-4 py-2 text-center">
                <div><AvatarIcon avatar={p.avatar} size={26} /></div><div>{p.nick}</div>
                <div className="text-sm" style={{ color: p.role === "mafia" ? accent : "var(--color-ink-muted)" }}>{p.role ? ROLE_NAME[p.role] : "?"}</div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap justify-center gap-3">
          {pub.players.map((p) => (
            <div key={p.uid} className="card flex flex-col items-center px-4 py-2" style={{ opacity: p.alive ? 1 : 0.35 }}>
              <span>{p.alive ? <AvatarIcon avatar={p.avatar} size={30} /> : <Skull size={30} strokeWidth={2.5} className="inline-block" aria-hidden />}</span>
              <span>{p.nick}</span>
              {pub.phase === "glosowanie" && <span className="tabular text-sm" style={{ color: accent }}>{"●".repeat(pub.votesTally[p.uid] ?? 0)}</span>}
            </div>
          ))}
        </div>
      )}

      <p className="text-[var(--color-ink-muted)]">Żywych: {pub.aliveCount}</p>
    </div>
  );
}
