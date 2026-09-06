"use client";
import type { GameHostViewProps } from "@/games/view";
import { useT } from "@/lib/i18n/provider";
import { AvatarIcon } from "@/components/AvatarIcon";

interface Pub {
  round: number;
  totalRounds: number;
  phase: "losowanie" | "pisanie" | "weryfikacja" | "wyniki" | "koniec";
  letter: string;
  categories: string[];
  players: { uid: string; nick: string; avatar: string; score: number; roundDelta: number }[];
  stoppedBy?: string | null;
  progress?: { uid: string; filled: number }[];
  verifyCat?: number;
  categoryName?: string;
  entries?: { uid: string; answer: string; autoZero: boolean; rejected: boolean }[];
  active?: { targetUid: string; justification: string; tally: { uznaje: number; odrzucam: number } } | null;
  breakdown?: { category: string; answers: { uid: string; answer: string; points: number }[] }[] | null;
}

export function PmHostView({ publicState, accent }: GameHostViewProps) {
  const t = useT();
  const pub = publicState as Pub;
  const nickOf = (uid: string) => pub.players.find((p) => p.uid === uid)?.nick ?? "?";

  return (
    <div className="flex w-full max-w-4xl flex-col items-center gap-6" style={{ ["--accent" as string]: accent }}>
      <div className="flex items-center gap-6">
        <div className="flex h-28 w-28 items-center justify-center rounded-3xl text-6xl font-bold"
             style={{ background: accent, color: "#0b0a12", boxShadow: `0 0 40px ${accent}88`, fontFamily: "var(--font-display)" }}>
          {pub.letter}
        </div>
        <div className="text-left">
          <p className="text-sm uppercase tracking-widest text-[var(--color-ink-muted)]">{t("common.round")} {pub.round}{pub.totalRounds ? `/${pub.totalRounds}` : ""}</p>
          <p className="text-2xl font-bold">{phaseLabel(pub.phase, t)}</p>
        </div>
      </div>

      {pub.phase === "pisanie" && (
        <div className="flex flex-wrap justify-center gap-3">
          {pub.progress?.map((pr) => (
            <div key={pr.uid} className="card px-4 py-2">
              {nickOf(pr.uid)} <span className="tabular" style={{ color: accent }}>{pr.filled}/{pub.categories.length}</span>
            </div>
          ))}
        </div>
      )}

      {pub.phase === "weryfikacja" && (
        <div className="w-full max-w-2xl">
          <h3 className="mb-2 text-center text-2xl font-bold" style={{ color: accent }}>{pub.categoryName}</h3>
          {pub.active ? (
            <div className="card p-4 text-center" style={{ borderColor: accent }}>
              <p className="text-lg">Kwestia: „{pub.entries?.find((e) => e.uid === pub.active!.targetUid)?.answer}” ({nickOf(pub.active.targetUid)})</p>
              {pub.active.justification && <p className="italic text-[var(--color-ink-muted)]">- {pub.active.justification}</p>}
              <p className="mt-2 text-xl">{t("pm.accept")} {pub.active.tally.uznaje} · {t("pm.reject")} {pub.active.tally.odrzucam}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1 text-lg">
              {pub.entries?.map((e) => (
                <li key={e.uid} className="flex justify-between border-b border-[var(--color-stroke)] py-1">
                  <span className="text-[var(--color-ink-muted)]">{nickOf(e.uid)}</span>
                  <span className={e.autoZero || e.rejected ? "text-[var(--color-ink-muted)] line-through" : ""}>{e.answer || "-"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {(pub.phase === "wyniki" || pub.phase === "koniec") && (
        <div className="w-full max-w-md">
          <h3 className="mb-3 text-center text-2xl font-bold">{pub.phase === "koniec" ? t("pm.finalResults") : t("pm.table")}</h3>
          <ol className="flex flex-col gap-2">
            {[...pub.players].sort((a, b) => b.score - a.score).map((p, i) => (
              <li key={p.uid} className="card flex items-center gap-3 px-4 py-2 text-lg">
                <span className="tabular w-6 text-center font-bold text-[var(--color-ink-muted)]">{i + 1}</span>
                <span className="flex-1"><AvatarIcon avatar={p.avatar} size={18} /> {p.nick}</span>
                <span className="tabular font-bold">{p.score}</span>
                {p.roundDelta > 0 && <span className="tabular text-sm" style={{ color: accent }}>+{p.roundDelta}</span>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {(pub.phase === "losowanie") && <p className="text-xl text-[var(--color-ink-muted)]">{pub.categories.join(" · ")}</p>}
    </div>
  );
}

// `t` wędruje argumentem, bo to zwykła funkcja poza komponentem — hooka użyć nie może.
function phaseLabel(p: Pub["phase"], t: ReturnType<typeof useT>): string {
  return { losowanie: t("pm.phase.losowanie"), pisanie: t("pm.phase.pisanie"), weryfikacja: t("pm.phase.weryfikacja"), wyniki: t("pm.phase.wyniki"), koniec: t("pm.phase.koniec") }[p];
}
