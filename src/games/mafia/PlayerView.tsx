"use client";
import { useI18n } from "@/lib/i18n/provider";
import type { Key } from "@/lib/i18n/dict";
import { Vote } from "lucide-react";
import { Ban, Beer, Bomb, Check, Crosshair, Heart, House, Moon, PartyPopper, Search, Skull, Spade, Stethoscope, Sun, Swords, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { GameViewProps } from "@/games/view";
import type { Role } from "./engine";
import { useSent } from "@/games/useOptimistic";
import { AvatarIcon } from "@/components/AvatarIcon";

interface PlayerV { uid: string; nick: string; avatar: string; alive: boolean; confirmed: boolean; voted: boolean; role: Role | null; score: number }
interface Pub {
  phase: "rozdanie" | "noc" | "switt" | "dzien" | "glosowanie" | "koniec";
  night: number; narrator: string; narratorKey: string | null; deaths: string[]; winner: "miasto" | "mafia" | "zakochani" | null; afterReveal: string;
  players: PlayerV[]; votesTally: Record<string, number>; aliveCount: number;
}
interface Priv { role?: Role; alive?: boolean; mafia?: string[]; mafiaVotes?: Record<string, string>; checks?: { target: string; isMafia: boolean }[]; acted?: boolean; blockUsed?: boolean; lover?: string | null }

const ROLE_INFO: Record<Role, { Icon: LucideIcon; nameKey: Key; descKey: Key }> = {
  mafia: { Icon: Swords, nameKey: "mafia.role.mafia", descKey: "mafia.role.mafia.desc" },
  mieszkaniec: { Icon: House, nameKey: "mafia.role.mieszkaniec", descKey: "mafia.role.mieszkaniec.desc" },
  detektyw: { Icon: Search, nameKey: "mafia.role.detektyw", descKey: "mafia.role.detektyw.desc" },
  lekarz: { Icon: Stethoscope, nameKey: "mafia.role.lekarz", descKey: "mafia.role.lekarz.desc" },
  szeryf: { Icon: Ban, nameKey: "mafia.role.szeryf", descKey: "mafia.role.szeryf.desc" },
  barman: { Icon: Beer, nameKey: "mafia.role.barman", descKey: "mafia.role.barman.desc" },
  snajper: { Icon: Crosshair, nameKey: "mafia.role.snajper", descKey: "mafia.role.snajper.desc" },
  kamikadze: { Icon: Bomb, nameKey: "mafia.role.kamikadze", descKey: "mafia.role.kamikadze.desc" },
  zakochani: { Icon: Heart, nameKey: "mafia.role.zakochani", descKey: "mafia.role.zakochani.desc" },
};

// Pytanie i akcja nocna per rola — tabelą, nie łańcuchem ternarnych. Przy trzech
// rolach ternarne jeszcze się czytało, przy sześciu przestaje, a docelowo ról jest 21.
const PYTANIE_ROLI: Partial<Record<Role, Key>> = {
  mafia: "mafia.whoMafia",
  detektyw: "mafia.whoCheck",
  lekarz: "mafia.whoProtect",
  barman: "mafia.whoBartend",
  szeryf: "mafia.whoBlock",
  snajper: "mafia.whoSnipe",
};
const AKCJA_ROLI: Partial<Record<Role, string>> = {
  mafia: "MAFIA_KILL",
  detektyw: "INVESTIGATE",
  lekarz: "PROTECT",
  barman: "BARTEND",
  szeryf: "BLOCK",
  snajper: "SNIPE",
};

function useTicker(ms = 400) { const [, s] = useState(0); useEffect(() => { const id = setInterval(() => s((n) => n + 1), ms); return () => clearInterval(id); }, [ms]); }
const secLeft = (e: number | null, now: number) => (e == null ? null : Math.max(0, Math.ceil((e - now) / 1000)));

export function MafiaPlayerView({ room, publicState, privateState, meUid, isHost, dispatch, serverNow, accent }: GameViewProps) {
  const { t } = useI18n();
  const pub = publicState as Pub;
  const priv = privateState as Priv | null;
  const nickOf = (uid: string) => pub.players.find((p) => p.uid === uid)?.nick ?? "?";
  useTicker();
  const left = secLeft(room.phaseEndsAt, serverNow());
  const me = pub.players.find((p) => p.uid === meUid);
  const iAmAlive = me?.alive ?? true;
  const [sent, markSent] = useSent(room.version); // natychmiastowy feedback na akcję/głos

  const narrator = <p className="text-center text-sm italic text-[var(--color-ink-muted)]">{pub.narratorKey ? t(pub.narratorKey as Parameters<typeof t>[0]) : pub.narrator}</p>;

  // —— ROZDANIE ——
  if (pub.phase === "rozdanie") {
    return (
      <div className="flex flex-col items-center gap-5" style={{ ["--accent" as string]: accent }}>
        {narrator}
        <RoleCard priv={priv} nickOf={nickOf} accent={accent} />
        {me?.confirmed || sent
          ? <p className="text-[var(--color-ink-muted)]">{t("common.waitingCount", { ilu: pub.players.filter((p) => p.confirmed).length, ze: pub.players.length })}</p>
          : <button className="btn btn-accent" style={{ ["--accent" as string]: accent }} onClick={() => { markSent(); dispatch({ type: "CONFIRM" }); }}>{t("mafia.remembered")}</button>}
      </div>
    );
  }

  // —— KONIEC ——
  if (pub.phase === "koniec") {
    return (
      <div className="flex flex-col items-center gap-4" style={{ ["--accent" as string]: accent }}>
        <p className="text-3xl font-bold" style={{ color: pub.winner === "mafia" ? accent : "#4ade80" }}>
          {pub.winner === "zakochani"
            ? <>{t("mafia.loversWin")} <Heart size={26} strokeWidth={2.5} className="inline-block align-[-0.18em]" /></>
            : pub.winner === "mafia"
            ? <>{t("mafia.mafiaWins")} <Swords size={26} strokeWidth={2.5} className="inline-block align-[-0.18em]" /></>
            : <>{t("mafia.townWins")} <PartyPopper size={26} strokeWidth={2.5} className="inline-block align-[-0.18em]" /></>}
        </p>
        {narrator}
        <RoleReveal pub={pub} meUid={meUid} accent={accent} />
      </div>
    );
  }

  // —— ŚWIT ——
  if (pub.phase === "switt") {
    return (
      <div className="flex flex-col items-center gap-4" style={{ ["--accent" as string]: accent }}>
        {narrator}
        {pub.deaths.length ? pub.deaths.map((d) => (
          <p key={d} className="text-xl font-bold"><Skull size={22} strokeWidth={2.5} className="inline-block align-[-0.18em]" aria-hidden /> {nickOf(d)}{pub.players.find((p) => p.uid === d)?.role ? ` — ${t(ROLE_INFO[pub.players.find((p) => p.uid === d)!.role!].nameKey)}` : ""}</p>
        )) : <p className="text-lg text-[var(--color-ink-muted)]">{t("mafia.nobodyDied")}</p>}
        <AliveList pub={pub} meUid={meUid} />
        {isHost && <button className="btn btn-accent" style={{ ["--accent" as string]: accent }} onClick={() => dispatch({ type: "NEXT" })}>{t("common.next")}</button>}
      </div>
    );
  }

  // —— NOC ——
  if (pub.phase === "noc") {
    if (!iAmAlive) return <div className="flex flex-col items-center gap-3">{narrator}<p className="text-[var(--color-ink-muted)]">{t("mafia.youAreDead")}</p></div>;
    const role = priv?.role;
    const acted = priv?.acted;
    const targets = pub.players.filter((p) => p.alive);
    return (
      <div className="flex flex-col items-center gap-4" style={{ ["--accent" as string]: accent }}>
        <p className="flex items-center justify-center gap-2 text-center text-2xl"><Moon size={24} strokeWidth={2.5} aria-hidden /> {t("mafia.night", { n: pub.night })}</p>
        {narrator}
        {role === "mieszkaniec" && <p className="text-center text-[var(--color-ink-muted)]">{t("mafia.sleepWell")}</p>}
        {role === "szeryf" && priv?.blockUsed && !priv?.acted ? (
          <p className="text-center text-[var(--color-ink-muted)]">{t("mafia.blockUsed")}</p>
        ) : role && role !== "mieszkaniec" && (
          acted || sent ? (
            <p className="text-center" style={{ color: accent }}>
              {t("mafia.choiceSaved")} {left != null ? `(${left}s)` : ""}
              {role === "detektyw" && priv?.checks && priv.checks.length > 0 && (
                <span className="mt-2 block text-sm text-[var(--color-ink-muted)]">
                  {t("mafia.lastCheck", { nick: nickOf(priv.checks[priv.checks.length - 1].target) })} {priv.checks[priv.checks.length - 1].isMafia ? <>{t("mafia.isMafia")} <Swords size={14} strokeWidth={2.5} className="inline-block align-[-0.15em]" /></> : <>{t("mafia.isClean")} <Check size={14} strokeWidth={3} className="inline-block align-[-0.15em]" /></>}
                </span>
              )}
            </p>
          ) : (
            <>
              <p className="text-center font-semibold">
                {PYTANIE_ROLI[role] ? t(PYTANIE_ROLI[role]!) : t("mafia.whoProtect")}
                {left != null ? ` · ${left}s` : ""}
              </p>
              <div className="grid w-full grid-cols-2 gap-2">
                {targets.map((p) => {
                  const blocked = role === "mafia" && priv?.mafia?.includes(p.uid);
                  if (blocked) return null;
                  const type = AKCJA_ROLI[role] ?? "PROTECT";
                  const mafiaVoteCount = role === "mafia" && priv?.mafiaVotes ? Object.values(priv.mafiaVotes).filter((t) => t === p.uid).length : 0;
                  return (
                    <button key={p.uid} className="btn" onClick={() => { markSent(); dispatch({ type, target: p.uid }); }}>
                      <AvatarIcon avatar={p.avatar} size={18} /> {p.nick}{mafiaVoteCount > 0 ? ` (${mafiaVoteCount})` : ""}
                    </button>
                  );
                })}
              </div>
              {/* Snajper strzela ALBO świadomie pasuje — bez tego przycisku noc stoi
                  do wygaśnięcia timera, gdy nie chce ryzykować pudła. */}
              {role === "snajper" && (
                <button className="btn btn-ghost" onClick={() => { markSent(); dispatch({ type: "SNIPE", target: null }); }}>
                  {t("mafia.hold")}
                </button>
              )}
              {role === "mafia" && priv?.mafia && priv.mafia.length > 1 && (
                <p className="text-xs text-[var(--color-ink-muted)]">{t("mafia.yourMafia", { nicks: priv.mafia.filter((u) => u !== meUid).map(nickOf).join(", ") })}</p>
              )}
            </>
          )
        )}
      </div>
    );
  }

  // —— DZIEŃ ——
  if (pub.phase === "dzien") {
    return (
      <div className="flex flex-col items-center gap-4" style={{ ["--accent" as string]: accent }}>
        <p className="flex items-center gap-2 text-2xl"><Sun size={24} strokeWidth={2.5} aria-hidden /> {t("mafia.day", { n: pub.night })}</p>
        {narrator}
        <p className="text-[var(--color-ink-muted)]">{t("mafia.talkLive")} {left != null ? t("mafia.timeLeft", { sec: left }) : ""}</p>
        <AliveList pub={pub} meUid={meUid} />
        {isHost && <button className="btn btn-accent" style={{ ["--accent" as string]: accent }} onClick={() => dispatch({ type: "NEXT" })}>{t("mafia.toVote")}</button>}
      </div>
    );
  }

  // —— GŁOSOWANIE ——
  return (
    <div className="flex flex-col gap-3" style={{ ["--accent" as string]: accent }}>
      <p className="flex items-center justify-center gap-2 text-center text-xl"><Vote size={22} strokeWidth={2.5} aria-hidden /> {t("mafia.voting")} {left != null ? `· ${left}s` : ""}</p>
      {narrator}
      {!iAmAlive ? <p className="text-center text-[var(--color-ink-muted)]">{t("mafia.deadDontVote")}</p> : me?.voted || sent ? (
        <p className="text-center text-[var(--color-ink-muted)]">{t("mafia.voted")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {pub.players.filter((p) => p.alive && p.uid !== meUid).map((p) => (
            <button key={p.uid} className="btn" onClick={() => { markSent(); dispatch({ type: "VOTE", target: p.uid }); }}>
              <AvatarIcon avatar={p.avatar} size={18} /> {p.nick}{pub.votesTally[p.uid] ? ` (${pub.votesTally[p.uid]})` : ""}
            </button>
          ))}
          <button className="btn col-span-2" onClick={() => { markSent(); dispatch({ type: "VOTE", target: "nikt" }); }}>{t("mafia.nobody")}</button>
        </div>
      )}
    </div>
  );
}

function RoleCard({ priv, nickOf, accent }: { priv: Priv | null; nickOf: (u: string) => string; accent: string }) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const role = priv?.role;
  const info = role ? ROLE_INFO[role] : null;
  return (
    <button onPointerDown={() => setShow(true)} onPointerUp={() => setShow(false)} onPointerLeave={() => setShow(false)}
      className="flex h-60 w-full max-w-xs select-none flex-col items-center justify-center gap-2 rounded-3xl border-2 p-4 text-center"
      style={{ borderColor: accent, background: "var(--color-panel)" }}>
      {show && info ? (
        <>
          <info.Icon size={56} strokeWidth={2.5} aria-hidden />
          <span className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)", color: role === "mafia" ? accent : "var(--color-ink)" }}>{t(info.nameKey)}</span>
          <span className="text-sm text-[var(--color-ink-muted)]">{t(info.descKey)}</span>
          {role === "mafia" && priv?.mafia && priv.mafia.length > 1 && (
            <span className="text-sm">{t("mafia.yourMafia", { nicks: priv.mafia.map(nickOf).join(", ") })}</span>
          )}
          {role === "zakochani" && priv?.lover && (
            <span className="text-sm">{t("mafia.yourLover", { nick: nickOf(priv.lover) })}</span>
          )}
        </>
      ) : (
        <><Spade size={44} strokeWidth={2.5} aria-hidden /><span className="text-[var(--color-ink-muted)]">{t("mafia.holdToSeeRole")}</span></>
      )}
    </button>
  );
}

function AliveList({ pub, meUid }: { pub: Pub; meUid: string }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {pub.players.map((p) => (
        <span key={p.uid} className="rounded-lg px-2 py-1 text-sm" style={{ background: "var(--color-panel)", opacity: p.alive ? 1 : 0.4 }}>
          {p.alive ? <AvatarIcon avatar={p.avatar} size={18} /> : <Skull size={18} strokeWidth={2.5} className="inline-block align-[-0.18em]" aria-hidden />} {p.nick}{p.uid === meUid && ` ${t("common.you")}`}
        </span>
      ))}
    </div>
  );
}

function RoleReveal({ pub, meUid, accent }: { pub: Pub; meUid: string; accent: string }) {
  const { t } = useI18n();
  return (
    <ul className="w-full max-w-sm">
      {[...pub.players].sort((a, b) => b.score - a.score).map((p) => (
        <li key={p.uid} className="flex items-center justify-between px-2 py-1 text-sm">
          <span><AvatarIcon avatar={p.avatar} size={18} /> {p.nick}{p.uid === meUid && ` ${t("common.you")}`} — <b style={{ color: p.role === "mafia" ? accent : undefined }}>{p.role ? t(ROLE_INFO[p.role].nameKey) : "?"}</b></span>
          <span className="tabular font-bold">{p.score}</span>
        </li>
      ))}
    </ul>
  );
}
