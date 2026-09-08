"use client";
import { useT } from "@/lib/i18n/provider";
import { Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { DISCONNECT_AFTER_MS, type PlayerMap } from "@/lib/types/room";
import { AvatarIcon } from "@/components/AvatarIcon";

// Lista graczy na żywo. Status „połączony" liczymy LOKALNIE z lastSeenAt vs czas serwera
// (SPEC §3.7) — rozłączony robi się szary, ale zostaje w grze. Lokalny ticker odświeża
// wyszarzenie nawet gdy rozłączony gracz przestał przysyłać snapshoty.

/** Domyślnie do ilu wierszy dopełniamy listę pustymi slotami (DESIGN.md §4.5). */
const MIN_SLOTS = 4;

/** Sylwetka do pustego slotu. Bezosobowa z założenia — to jeszcze nie jest nikt. */
function EmptyAvatar() {
  return (
    <svg viewBox="0 0 24 24" width="60%" height="60%" fill="currentColor" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8z" />
    </svg>
  );
}

export function PlayerList({
  players,
  hostUid,
  myUid,
  serverNow,
  onKick,
  minSlots = MIN_SLOTS,
}: {
  players: PlayerMap;
  hostUid: string;
  myUid: string | null;
  serverNow: () => number;
  onKick?: (uid: string) => void;
  /** Do ilu wierszy dopełnić pustymi slotami. 0 wyłącza je zupełnie. */
  minSlots?: number;
}) {
  const t = useT();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 3000);
    return () => clearInterval(id);
  }, []);

  const now = serverNow();
  const sorted = Object.values(players).sort((a, b) => a.joinedAt - b.joinedAt);
  // Puste sloty tylko do `minSlots`. Dopełnianie do maxPlayers dałoby przy grach na
  // 16 osób ścianę piętnastu placeholderów — komunikat „jest miejsce" niesie już
  // trzeci pusty wiersz, a reszta byłaby tylko szumem do przewijania.
  const empty = Math.max(0, minSlots - sorted.length);

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((p) => {
        // Bot nie pinguje, ale nigdzie się nie wybiera — wyszarzony wyglądałby na zepsuty.
        const connected = p.bot === true || now - p.lastSeenAt < DISCONNECT_AFTER_MS;
        const isMe = p.uid === myUid;
        const canKick = onKick && myUid === hostUid && !isMe;
        return (
          <li
            key={p.uid}
            className="flex items-center gap-3 rounded-[14px] border-[3px] border-stroke bg-panel px-3 py-2 shadow-[0_3px_0_rgb(0_0_0/0.35)] animate-[slideIn_0.3s_ease]"
            style={{ opacity: connected ? 1 : 0.45 }}
          >
            {/* Awatar w kole z białą obwódką i twardym cieniem (DESIGN.md §4.5).
                Świadomie 64 px, nie 96 — specyfikacja opisuje slot z siatki na ekranie
                hosta, a tu mamy gęstą listę na telefonie. Przy 96 px ośmiu graczy
                zajmowałoby 880 px i lobby trzeba by przewijać, żeby dojść do gier. */}
            <span
              className="flex size-16 flex-none items-center justify-center rounded-full border-4 border-white bg-panel-hi shadow-[0_3px_0_rgb(0_0_0/0.35)]"
              aria-hidden
            >
              <AvatarIcon avatar={p.avatar} size={38} />
            </span>
            <span className="flex-1 truncate text-base font-bold text-ink">
              {p.nick}
              {isMe && <span className="font-semibold text-ink-muted"> {t("common.you")}</span>}
            </span>
            {p.uid === hostUid && (
              <span
                className="font-display rounded-md bg-mint px-2 py-0.5 text-xs font-bold uppercase text-sheet-ink"
                title="Host"
              >
                <Star size={12} strokeWidth={3} className="inline-block align-[-0.1em]" fill="currentColor" aria-hidden /> host
              </span>
            )}
            <span
              className="inline-block size-3 flex-none rounded-full border-2 border-white/50"
              style={{ background: connected ? "var(--color-online)" : "var(--color-offline)" }}
              aria-label={connected ? "połączony" : "rozłączony"}
              title={connected ? "połączony" : "rozłączony"}
            />
            {canKick && (
              <button
                type="button"
                onClick={() => onKick!(p.uid)}
                aria-label={`Wyrzuć ${p.nick}`}
                className="flex size-9 flex-none items-center justify-center rounded-lg text-base font-bold text-ink-muted transition-colors hover:bg-czerwien hover:text-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-mint"
              >
                <X size={16} strokeWidth={3} aria-hidden />
              </button>
            )}
          </li>
        );
      })}

      {/* Wolne miejsca. Czekający host ma widzieć, że pokój na kogoś czeka —
          a nie jeden wiersz i pustkę pod spodem. */}
      {Array.from({ length: empty }, (_, i) => (
        <li
          key={`pusty-${i}`}
          className="flex items-center gap-3 rounded-[14px] border-[3px] border-dashed border-white/20 px-3 py-2"
          aria-hidden
        >
          <span className="flex size-16 flex-none items-center justify-center rounded-full bg-white/10 text-ink-muted opacity-40">
            <EmptyAvatar />
          </span>
          <span className="font-display text-sm font-bold uppercase tracking-[0.06em] text-ink-muted opacity-50">
            {t("lobby.emptySlot")}
          </span>
        </li>
      ))}
    </ul>
  );
}
