"use client";
import { useT } from "@/lib/i18n/provider";
import { SegmentPicker } from "@/components/SegmentPicker";
import type { GameSettingsProps } from "@/games/view";
import type { StatkiSettings } from "./manifest";

export function StatkiSettingsPanel({ value, onChange, playerCount }: GameSettingsProps<StatkiSettings>) {
  const t = useT();
  const set = (patch: Partial<StatkiSettings>) => onChange({ ...value, ...patch });
  return (
    <div className="flex flex-col gap-5">
      <SegmentPicker label={t("set.sta.board")} value={value.bok}
        onChange={(v) => set({ bok: v as StatkiSettings["bok"] })}
        options={[{ v: 8, l: "8 × 8" }, { v: 10, l: "10 × 10" }]} />
      <SegmentPicker label={t("set.sta.extra")} value={value.dodatkowyStrzal}
        onChange={(v) => set({ dodatkowyStrzal: v as boolean })}
        options={[{ v: true, l: t("opt.sta.again") }, { v: false, l: t("opt.sta.once") }]} />
      <SegmentPicker label={t("set.sta.setup")} value={value.ustawianieMs}
        onChange={(v) => set({ ustawianieMs: v as StatkiSettings["ustawianieMs"] })}
        options={[{ v: 45000, l: "45 s" }, { v: 90000, l: "90 s" }]} />
      <SegmentPicker label={t("set.sta.shot")} value={value.strzalMs}
        onChange={(v) => set({ strzalMs: v as StatkiSettings["strzalMs"] })}
        options={[{ v: 20000, l: "20 s" }, { v: 40000, l: "40 s" }, { v: 0, l: "∞" }]} />
      <SegmentPicker label={t("set.sta.rounds")} value={value.rounds}
        onChange={(v) => set({ rounds: v as StatkiSettings["rounds"] })}
        options={[{ v: 1, l: "1" }, { v: 2, l: "2" }, { v: 3, l: "3" }, { v: 0, l: "∞" }]} />
      {/* Rotacja ma sens dopiero, gdy ktoś czeka — przy dwóch graczach nie ma kogo wymieniać. */}
      {playerCount > 2 && (
        <SegmentPicker label={t("set.sta.stays")} value={value.winnerStays}
          onChange={(v) => set({ winnerStays: v as boolean })}
          options={[{ v: true, l: t("opt.sta.winner") }, { v: false, l: t("opt.sta.rotate") }]} />
      )}
    </div>
  );
}
