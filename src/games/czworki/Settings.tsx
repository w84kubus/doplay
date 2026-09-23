"use client";
import { useT } from "@/lib/i18n/provider";
import { SegmentPicker } from "@/components/SegmentPicker";
import type { GameSettingsProps } from "@/games/view";
import type { CzworkiSettings } from "./manifest";

export function CzworkiSettingsPanel({ value, onChange, playerCount }: GameSettingsProps<CzworkiSettings>) {
  const t = useT();
  const set = (patch: Partial<CzworkiSettings>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-5">
      <SegmentPicker label={t("set.czw.rounds")} value={value.rounds}
        onChange={(v) => set({ rounds: v as CzworkiSettings["rounds"] })}
        options={[{ v: 3, l: "3" }, { v: 5, l: "5" }, { v: 7, l: "7" }, { v: 0, l: "∞" }]} />
      <SegmentPicker label={t("set.czw.move")} value={value.moveMs}
        onChange={(v) => set({ moveMs: v as CzworkiSettings["moveMs"] })}
        options={[{ v: 15000, l: "15 s" }, { v: 30000, l: "30 s" }, { v: 0, l: "∞" }]} />
      {/* Rotacja ma sens dopiero, gdy ktoś czeka — przy dwóch graczach nie ma kogo wymieniać. */}
      {playerCount > 2 && (
        <SegmentPicker label={t("set.czw.stays")} value={value.winnerStays}
          onChange={(v) => set({ winnerStays: v as boolean })}
          options={[{ v: true, l: t("opt.czw.winner") }, { v: false, l: t("opt.czw.rotate") }]} />
      )}
    </div>
  );
}
