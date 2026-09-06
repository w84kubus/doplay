"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import type { PubliczyPokoj } from "@/lib/server/publiczne";

// Zachęta do publicznych pokoi na stronie głównej.
//
// Pokazuje się WYŁĄCZNIE wtedy, gdy ktoś realnie czeka. Reklamowanie tej funkcji
// na sztywno prowadziłoby gościa z wyszukiwarki do pustej listy, co wygląda gorzej
// niż brak zachęty: strona sprawia wtedy wrażenie martwej. Stąd zero placeholderów
// i zero „sprawdź publiczne pokoje" na sucho.
//
// Świadomie nie jest to trzeci przycisk w hero — dwa i tak ledwo mieszczą się
// na 375 px (patrz komentarz w LandingContent), a trzeci zepchnąłby ilustrację
// pod zgięcie.
export function PublicRoomsHint() {
  const t = useT();
  const [ilu, setIlu] = useState(0);

  useEffect(() => {
    let zywy = true;
    fetch("/api/rooms/publiczne", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { pokoje?: PubliczyPokoj[] }) => {
        if (zywy) setIlu(d.pokoje?.length ?? 0);
      })
      .catch(() => {}); // cisza: brak zachęty jest lepszy niż komunikat o błędzie
    return () => {
      zywy = false;
    };
  }, []);

  if (ilu === 0) return null;

  return (
    <Link
      href="/publiczne"
      className="flex items-center gap-2 rounded-[14px] border-[3px] border-mint/50 bg-mint/10 px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-mint/20 animate-[fadeIn_0.3s_ease]"
    >
      {/* Liczba jako cyfra przy ikonie, nie w zdaniu: polska odmiana „pokój / pokoje /
          pokoi" wymagałaby trzech form na język, a to jest jeden kafelek. */}
      <span className="font-display flex flex-none items-center gap-1 rounded-full bg-mint px-2 py-0.5 text-xs font-bold text-[#06281A]">
        <Users size={12} strokeWidth={3} aria-hidden />
        {ilu}
      </span>
      {t("landing.publicWaiting")}
    </Link>
  );
}
