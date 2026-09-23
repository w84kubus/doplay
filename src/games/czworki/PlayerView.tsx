"use client";
import { useEffect, useState } from "react";
import { Trophy, Users } from "lucide-react";
import type { GameViewProps } from "@/games/view";
import { useT } from "@/lib/i18n/provider";
import { AvatarIcon } from "@/components/AvatarIcon";
import { sfx, vibrate } from "@/lib/sound";
import { Plansza, Zeton } from "./ui";
import type { Pole } from "./engine";

interface Pub {
  phase: "gra" | "wynik" | "koniec";
  round: number;
  totalRounds: number;
  plansza: Pole[];
  tura: 0 | 1;
  para: [string, string];
  turaUid: string | null;
  ostatni: number | null;
  kolejka: string[];
  ostatnia: { zwyciezca: string | null; linia: readonly number[] | null } | null;
  players: { uid: string; nick: string; avatar: string; score: number; gra: boolean }[];
  canFinish: boolean;
}
interface Priv {
  gram?: boolean;
  znak?: 0 | 1 | null;
  mojaTura?: boolean;
}

function useTicker(ms = 400) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}
const secLeft = (e: number | null, now: number) => (e == null ? null : Math.max(0, Math.ceil((e - now) / 1000)));

export function CzworkiPlayerView({ room, publicState, privateState, meUid, isHost, dispatch, serverNow, accent }: GameViewProps) {
  const t = useT();
  const pub = publicState as Pub;
  const priv = privateState as Priv | null;
  useTicker();
  const left = secLeft(room.phaseEndsAt ?? null, serverNow());
  const nickOf = (uid: string) => pub.players.find((p) => p.uid === uid)?.nick ?? "?";

  // Klik żetonu słychać u WSZYSTKICH przy stole, nie tylko u grającego — to jedyny
  // sygnał, że partia ruszyła dalej, gdy patrzy się akurat na telefon sąsiada.
  useEffect(() => {
    if (pub.ostatni != null) sfx.stop();
  }, [pub.ostatni]);

  const naglowek = (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-ink-muted">
        {t("czworki.round", { round: pub.round })}
        {pub.totalRounds ? ` / ${pub.totalRounds}` : ""}
      </p>
      <p className="flex flex-wrap items-center justify-center gap-2 text-base font-bold text-ink">
        <span className="inline-flex items-center gap-1.5">
          <Zeton znak={0} /> {nickOf(pub.para[0])}
        </span>
        <span className="text-ink-muted">vs</span>
        <span className="inline-flex items-center gap-1.5">
          <Zeton znak={1} /> {nickOf(pub.para[1])}
        </span>
      </p>
    </div>
  );

  const tabela = (
    <ul className="flex w-full max-w-md flex-col gap-1">
      {[...pub.players].sort((a, b) => b.score - a.score).map((p) => (
        <li
          key={p.uid}
          className="flex items-center gap-2 rounded-[12px] border-2 px-3 py-2 text-sm"
          style={{ borderColor: p.gra ? accent : "var(--color-stroke)", background: "var(--color-panel)" }}
        >
          <AvatarIcon avatar={p.avatar} size={20} />
          <span className="flex-1 truncate font-bold text-ink">
            {p.nick}
            {p.uid === meUid && <> {t("common.you")}</>}
          </span>
          {p.gra && <Zeton znak={pub.para[0] === p.uid ? 0 : 1} size={14} />}
          <span className="tabular font-bold" style={{ color: accent }}>{p.score}</span>
        </li>
      ))}
    </ul>
  );

  // —— WYNIK RUNDY / KONIEC ——
  if (pub.phase !== "gra") {
    const zw = pub.ostatnia?.zwyciezca;
    return (
      <div className="flex flex-col items-center gap-5" style={{ ["--accent" as string]: accent }}>
        {naglowek}
        <p className="font-display text-2xl font-bold uppercase" style={{ color: accent }}>
          {pub.phase === "koniec"
            ? t("czworki.gameOver")
            : zw
              ? t("czworki.winner", { nick: nickOf(zw) })
              : t("czworki.draw")}
        </p>
        <Plansza plansza={pub.plansza} linia={pub.ostatnia?.linia} ostatni={pub.ostatni} rozmiar={60} maxWys={42} accent={accent} />
        {tabela}
        {isHost && pub.phase === "wynik" && (
          <button type="button" className="btn btn-accent" style={{ ["--accent" as string]: accent }}
            onClick={() => dispatch({ type: "NEXT" })}>
            {t("common.next")}
          </button>
        )}
      </div>
    );
  }

  // —— GRA ——
  return (
    <div className="flex flex-col items-center gap-4" style={{ ["--accent" as string]: accent }}>
      {naglowek}

      {priv?.gram ? (
        <p className="font-display text-sm font-bold uppercase tracking-[0.06em]" style={{ color: accent }}>
          {priv.mojaTura ? t("czworki.yourTurn") : t("czworki.waitTurn", { nick: nickOf(pub.turaUid ?? "") })}
          {left != null ? ` · ${left}s` : ""}
        </p>
      ) : (
        // Kto czeka w kolejce, ogląda planszę na żywo — nie ma tu nic tajnego.
        <p className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
          <Users size={16} strokeWidth={2.5} aria-hidden />
          {t("czworki.spectating", { nick: nickOf(pub.turaUid ?? "") })}
        </p>
      )}

      <Plansza
        plansza={pub.plansza}
        ostatni={pub.ostatni}
        rozmiar={72}
        maxWys={52}
        accent={accent}
        aktywne={!!priv?.mojaTura}
        mojZnak={priv?.znak ?? null}
        onKolumna={(k) => {
          vibrate(20);
          dispatch({ type: "WRZUC", kolumna: k });
        }}
      />

      {priv?.mojaTura && (
        <p className="text-center text-xs font-semibold text-ink-muted">{t("czworki.tapColumn")}</p>
      )}

      {pub.kolejka.length > 0 && (
        <p className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
          <Trophy size={14} strokeWidth={2.5} aria-hidden />
          {t("czworki.queue", { nicks: pub.kolejka.map(nickOf).join(", ") })}
        </p>
      )}

      {tabela}
    </div>
  );
}
