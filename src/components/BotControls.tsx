"use client";
import { useState } from "react";
import { Bot, Minus, Plus } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { apiPost, apiDelete } from "@/lib/client/api";

// Dosadzanie botów do lobby — tylko host, tylko przed startem.
//
// Rdzeń nie wie, KTÓRA gra umie grać z botem: silnik bez obsługi flagi `bot` po prostu
// potraktuje go jak każdego innego gracza, który nic nie klika, i po terminie tury zagra
// za niego tak samo jak za nieobecnego człowieka. Dlatego przycisk stoi w lobby, a nie
// w ustawieniach konkretnej gry.
export function BotControls({
  code,
  ilu,
  jestMiejsce,
}: {
  code: string;
  /** Ilu botów już siedzi w pokoju. */
  ilu: number;
  /** Czy da się dosadzić jeszcze jednego. */
  jestMiejsce: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [blad, setBlad] = useState(false);

  const zmien = async (kierunek: 1 | -1) => {
    if (busy) return;
    setBusy(true);
    setBlad(false);
    try {
      if (kierunek === 1) await apiPost(`/api/rooms/${code}/bot`);
      else await apiDelete(`/api/rooms/${code}/bot`);
    } catch {
      // Lista graczy i tak przyjdzie z Firestore, więc nie zgadujemy stanu lokalnie —
      // wystarczy powiedzieć, że się nie udało.
      setBlad(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flex min-h-[56px] w-full items-center gap-3">
      <Bot size={22} strokeWidth={2.5} className="flex-none text-ink-muted" aria-hidden />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="font-display text-sm font-bold uppercase tracking-[0.06em] text-ink">
          {t("lobby.botsLabel")}
        </span>
        <span className="text-xs font-semibold text-ink-muted">
          {blad ? t("lobby.botsError") : t("lobby.botsHint")}
        </span>
      </span>

      <span className="flex flex-none items-center gap-2">
        <button
          type="button"
          onClick={() => zmien(-1)}
          disabled={busy || ilu === 0}
          aria-label={t("lobby.botRemove")}
          className="flex size-11 items-center justify-center rounded-[12px] border-[3px] border-stroke bg-panel-hi text-ink transition-transform duration-75 active:translate-y-[2px] disabled:opacity-35"
        >
          <Minus size={20} strokeWidth={3} aria-hidden />
        </button>
        <span className="tabular w-5 text-center text-base font-bold text-ink" aria-live="polite">
          {ilu}
        </span>
        <button
          type="button"
          onClick={() => zmien(1)}
          disabled={busy || !jestMiejsce}
          aria-label={t("lobby.botAdd")}
          className="flex size-11 items-center justify-center rounded-[12px] border-[3px] border-stroke bg-panel-hi text-ink transition-transform duration-75 active:translate-y-[2px] disabled:opacity-35"
        >
          <Plus size={20} strokeWidth={3} aria-hidden />
        </button>
      </span>
    </div>
  );
}
