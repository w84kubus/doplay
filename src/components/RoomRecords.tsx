"use client";
import { useI18n } from "@/lib/i18n/provider";
import { Crown, Sparkles, Trophy } from "lucide-react";
import { AvatarIcon } from "@/components/AvatarIcon";
import { GameIcon } from "@/components/GameIcon";
import type { PlayerMap, RoomRecords as Records } from "@/lib/types/room";

// „Rekordy pokoju" (UPGRADE.md §8) — trwałe przez cały czas życia pokoju.
// Pokazujemy tylko wtedy, gdy jest co pokazać: pusta sekcja w lobby to szum.
export function RoomRecords({ records, players }: { records?: Records; players: PlayerMap }) {
  const { t } = useI18n();
  const wins = Object.entries(records?.wins ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const highlights = records?.highlights ?? [];
  if (!wins.length && !highlights.length) return null;

  const nick = (uid: string) => players[uid]?.nick ?? "gracz";
  const avatar = (uid: string) => players[uid]?.avatar ?? "";

  return (
    <section className="relative flex w-full max-w-3xl flex-col gap-3">
      <h2 className="font-display flex items-center gap-2 text-lg font-bold uppercase tracking-[0.06em] text-mint">
        <Trophy size={20} strokeWidth={2.5} aria-hidden /> {t("records.title")}
      </h2>

      <div className="card flex flex-col gap-4">
        {wins.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-display text-xs font-bold uppercase tracking-[0.06em] text-ink-muted">
              {t("records.wins", { played: records?.gamesPlayed ?? 0 })}
            </span>
            <ul className="flex flex-col gap-1">
              {wins.map(([uid, n], i) => (
                <li key={uid} className="flex items-center gap-2 text-base font-bold text-ink">
                  {i === 0 ? (
                    <Crown size={18} strokeWidth={2.5} className="text-bursztyn" aria-hidden />
                  ) : (
                    <span className="tabular w-[18px] text-center text-sm text-ink-muted">{i + 1}</span>
                  )}
                  <AvatarIcon avatar={avatar(uid)} size={22} />
                  <span className="flex-1 truncate">{nick(uid)}</span>
                  <span className="tabular">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {highlights.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-display flex items-center gap-1 text-xs font-bold uppercase tracking-[0.06em] text-ink-muted">
              <Sparkles size={14} strokeWidth={2.5} aria-hidden /> {t("records.feats")}
            </span>
            <ul className="flex flex-col gap-1">
              {highlights.map((h, i) => (
                <li key={`${h.at}-${h.uid}-${i}`} className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
                  <GameIcon gameId={h.gameId} size={20} />
                  <AvatarIcon avatar={avatar(h.uid)} size={18} />
                  <span className="truncate">
                    <b className="text-ink">{nick(h.uid)}</b> - {h.key ? t(h.key as Parameters<typeof t>[0], h.params) : h.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
