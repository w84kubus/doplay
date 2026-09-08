"use client";
import { useT } from "@/lib/i18n/provider";
import { SegmentPicker } from "@/components/SegmentPicker";
import type { GameSettingsProps } from "@/games/view";
import type { ChinczykSettings } from "./manifest";

export function ChinczykSettingsPanel({ value, onChange }: GameSettingsProps<ChinczykSettings>) {
  const t = useT();
  const set = (patch: Partial<ChinczykSettings>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-5">
      {/* Limit tury nie jest ozdobą: tura jest imienna, więc bez niego jeden gracz,
          któremu padł telefon, zatrzymuje partię reszty. „Bez limitu" zostawiam dla
          stołu, przy którym wszyscy siedzą obok siebie. */}
      <SegmentPicker
        label={t("set.chi.turn")}
        value={value.turaMs}
        onChange={(v) => set({ turaMs: v as ChinczykSettings["turaMs"] })}
        options={[
          { v: 10000, l: "10 s" },
          { v: 20000, l: "20 s" },
          { v: 30000, l: "30 s" },
          { v: 0, l: "∞" },
        ]}
      />
      <SegmentPicker
        label={t("set.chi.pick")}
        value={value.wyborMs}
        onChange={(v) => set({ wyborMs: v as ChinczykSettings["wyborMs"] })}
        options={[
          { v: 15000, l: "15 s" },
          { v: 30000, l: "30 s" },
          { v: 45000, l: "45 s" },
        ]}
      />
    </div>
  );
}
