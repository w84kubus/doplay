"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/provider";

// Zakładki „teczkowe" (DESIGN.md §4.3) — jedyna z czterech receptur komponentów,
// której dotąd nie było w kodzie. Siedzą na górnej krawędzi panelu i są z nim zrośnięte:
// aktywna ma zaokrąglone tylko górne rogi i wchodzi w panel, nieaktywna jest niższa
// i ciemniejsza, jakby leżała pod spodem.
//
// To NIE jest `role="tablist"`, tylko nawigacja między trzema trasami: /nowy, /dolacz
// i /publiczne istnieją osobno (linki z landingu, powrót w historii, wklejony adres), a zakładka
// jest tylko ich wspólnym przełącznikiem. Stąd <Link> i aria-current, nie role="tab".
//
// Zakładanie, dołączanie i lista publiczna to trzy tryby tego samego formularza —
// nick i awatar są wspólne i siedzą w sesji, więc przełączenie niczego nie gubi.

export type EntryMode = "create" | "join" | "public";

const HREF: Record<EntryMode, string> = { create: "/nowy", join: "/dolacz", public: "/publiczne" };

export function EntryTabs({ active }: { active: EntryMode }) {
  const t = useT();
  const label: Record<EntryMode, string> = {
    create: t("entry.newRoom"),
    join: t("entry.tabJoin"),
    public: t("entry.publicRooms"),
  };

  return (
    <div className="flex w-full gap-1">
      {(["create", "join", "public"] as const).map((mode) => {
        const on = mode === active;
        return (
          <Link
            key={mode}
            href={HREF[mode]}
            aria-current={on ? "page" : undefined}
            className={`font-display flex flex-1 items-center justify-center rounded-t-[16px] px-2 text-center text-[0.7rem] font-bold uppercase leading-tight tracking-[0.04em] transition-colors sm:px-3 sm:text-sm sm:tracking-[0.06em] ${
              on
                ? "mt-0 bg-panel-hi py-3 text-mint"
                : "mt-1 bg-black/15 py-2.5 text-ink-muted hover:text-ink"
            }`}
          >
            {label[mode]}
          </Link>
        );
      })}
    </div>
  );
}
