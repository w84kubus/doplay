"use client";
import { useState } from "react";
import { Globe } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { apiPost } from "@/lib/client/api";

// Przełącznik „pokój publiczny" — tylko dla hosta, tylko w lobby.
//
// Świadomie w obie strony i w lobby, a nie checkbox przy zakładaniu pokoju: decyzja
// „otwieram dla obcych" zapada dopiero wtedy, gdy widać, że znajomi nie doszli,
// a po skompletowaniu składu chce się ją cofnąć.
export function PublicRoomToggle({ code, isPublic }: { code: string; isPublic: boolean }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  // Optymistycznie, żeby przełącznik nie zastygał na czas rundy do Firestore i z powrotem.
  const [lokalnie, setLokalnie] = useState<boolean | null>(null);
  const wlaczony = lokalnie ?? isPublic;

  const przelacz = async () => {
    if (busy) return;
    const cel = !wlaczony;
    setBusy(true);
    setLokalnie(cel);
    try {
      await apiPost(`/api/rooms/${code}/publiczny`, { public: cel });
    } catch {
      setLokalnie(!cel); // nie udało się — wracamy do stanu sprzed kliknięcia
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={wlaczony}
      onClick={przelacz}
      disabled={busy}
      className={`card flex min-h-[56px] w-full items-center gap-3 text-left transition-colors ${
        wlaczony ? "border-mint" : ""
      }`}
    >
      <Globe
        size={22}
        strokeWidth={2.5}
        className={wlaczony ? "flex-none text-mint" : "flex-none text-ink-muted"}
        aria-hidden
      />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="font-display text-sm font-bold uppercase tracking-[0.06em] text-ink">
          {t("lobby.publicLabel")}
        </span>
        <span className="text-xs font-semibold text-ink-muted">
          {wlaczony ? t("lobby.publicOn") : t("lobby.publicOff")}
        </span>
      </span>
      {/* Suwak: sam tekst nie mówi, czy to stan, czy zachęta do kliknięcia. */}
      <span
        className={`flex h-7 w-12 flex-none items-center rounded-full border-[3px] border-stroke p-0.5 transition-colors ${
          wlaczony ? "justify-end bg-mint" : "justify-start bg-black/25"
        }`}
        aria-hidden
      >
        <span className="size-4 rounded-full bg-white" />
      </span>
    </button>
  );
}
