"use client";
import { useState } from "react";
import { Check, Dices } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import type { GameViewProps } from "@/games/view";
import { BARWY, Plansza } from "./Plansza";
import { Kostka } from "./Kostka";
import { KOLORY } from "./engine";

interface Slot {
  kolor: string;
  uid: string | null;
  nick: string | null;
}
interface Pub {
  phase: "kolory" | "rzut" | "ruch" | "wynik" | "koniec";
  sloty: Slot[];
  doWyboru: number[];
  pionki: number[];
  tura: number;
  turaUid: string | null;
  kostka: number | null;
  szostki: number;
  ruchy: number[];
  zwyciezca: number | null;
  scores: Record<string, number>;
}

export function ChinczykPlayerView({ publicState, meUid, dispatch, accent }: GameViewProps) {
  const t = useT();
  const pub = publicState as Pub;
  const [busy, setBusy] = useState(false);
  const mojKolor = pub.sloty.findIndex((s) => s.uid === meUid);
  const mojaTura = pub.turaUid === meUid;
  // Ekran wyników i stan po hostowym „Zakończ grę" wyglądają dla gracza tak samo.
  const koniecPartii = pub.phase === "wynik" || pub.phase === "koniec";

  const wyslij = async (akcja: unknown) => {
    if (busy) return;
    setBusy(true);
    try {
      await dispatch(akcja);
    } finally {
      setBusy(false);
    }
  };

  // ---- WYBÓR KOLORU ----
  if (pub.phase === "kolory") {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-4">
        <p className="font-display text-lg font-bold uppercase tracking-[0.06em] text-ink">
          {t("chinczyk.pickColour")}
        </p>
        <div className="grid w-full grid-cols-2 gap-3">
          {pub.doWyboru.map((k) => {
            const zajety = pub.sloty[k].uid;
            const moj = zajety === meUid;
            return (
              <button
                key={k}
                type="button"
                disabled={Boolean(zajety) && !moj}
                onClick={() => wyslij({ type: "WYBIERZ", kolor: k })}
                className={`font-display flex min-h-[64px] items-center justify-center gap-2 rounded-[16px] border-[4px] text-sm font-bold uppercase tracking-[0.06em] transition-transform duration-75 active:translate-y-[3px] disabled:opacity-40 ${
                  moj ? "border-white text-white" : "border-stroke text-ink"
                }`}
                style={{ background: BARWY[k] }}
              >
                {moj && <Check size={18} strokeWidth={3} aria-hidden />}
                {t(`chinczyk.colour.${KOLORY[k]}` as never)}
                {zajety && !moj ? ` · ${pub.sloty[k].nick}` : ""}
              </button>
            );
          })}
        </div>
        <p className="text-center text-sm font-semibold text-ink-muted">{t("chinczyk.waitingColours")}</p>
      </div>
    );
  }

  const barwaTury = BARWY[pub.tura] ?? accent;

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      {/* Czyja tura. Kolor paska mówi to szybciej niż tekst. */}
      <div
        className="font-display flex w-full items-center justify-center gap-2 rounded-[14px] border-[3px] border-stroke px-4 py-2 text-sm font-bold uppercase tracking-[0.06em]"
        style={{ background: `${barwaTury}33`, borderColor: barwaTury }}
      >
        {koniecPartii
          ? t("chinczyk.won", { nick: pub.sloty[pub.zwyciezca ?? 0]?.nick ?? "" })
          : mojaTura
            ? t("chinczyk.yourTurn")
            : t("chinczyk.turnOf", { nick: pub.sloty[pub.tura]?.nick ?? "" })}
      </div>

      <Plansza
        pionki={pub.pionki}
        sloty={pub.sloty.map((s) => s.uid)}
        tura={pub.tura}
        ruchy={mojaTura ? pub.ruchy : []}
        mojKolor={mojKolor >= 0 ? mojKolor : null}
        onPionek={(pionek) => wyslij({ type: "RUSZ", pionek })}
      />

      {!koniecPartii && (
        // Strefa akcji ma STAŁĄ wysokość, mimo że jej zawartość zmienia się co pół tury.
        // Bez tego plansza podskakiwała w górę i w dół przy każdym rzucie — dokładnie ta
        // sama irytacja co przycisk STOP w treningu stopera.
        <div className="flex min-h-[9.5rem] flex-col items-center justify-start gap-3">
          <Kostka wartosc={pub.kostka} kolor={barwaTury} kreci={busy} />

          <button
            type="button"
            disabled={busy || pub.phase !== "rzut" || !mojaTura}
            onClick={() => wyslij({ type: "RZUC" })}
            className={`btn ${pub.phase === "rzut" && mojaTura ? "" : "invisible"}`}
            style={{ ["--accent" as string]: barwaTury }}
            aria-hidden={pub.phase === "rzut" && mojaTura ? undefined : true}
          >
            <Dices size={20} strokeWidth={2.5} aria-hidden /> {t("chinczyk.roll")}
          </button>

          {/* Jedna linijka na podpowiedź i jedna na szóstki — obie zawsze zajmują miejsce. */}
          <p className={`text-center text-sm font-semibold text-ink ${pub.phase === "ruch" && mojaTura ? "" : "invisible"}`}>
            {t("chinczyk.pickPiece")}
          </p>
          <p className={`text-xs font-semibold text-bursztyn ${mojaTura && pub.szostki > 0 ? "" : "invisible"}`}>
            {t("chinczyk.sixes", { n: pub.szostki })}
          </p>
        </div>
      )}
    </div>
  );
}
