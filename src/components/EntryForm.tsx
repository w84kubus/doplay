"use client";
import { useT } from "@/lib/i18n/provider";
import { Dices } from "lucide-react";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CodeInput } from "./CodeInput";
import { AvatarPicker } from "./AvatarPicker";
import { AvatarIcon, avatarColor } from "./AvatarIcon";
import { EntryTabs } from "./EntryTabs";
import { PublicRoomsList } from "./PublicRoomsList";
import type { PubliczyPokoj } from "@/lib/server/publiczne";
import { AVATARS } from "@/lib/avatars";
import { useSession } from "@/lib/store/session";
import { apiPost } from "@/lib/client/api";
import { MAX_NICK_LENGTH, sanitizeNick } from "@/lib/schemas/room";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room-code";

// Wspólny formularz wejścia (SPEC §4). Tryb "create" zakłada pokój, "join" dołącza kodem,
// "public" wybiera pokój z listy otwartych. Wszystkie trzy dzielą nick i awatar z sesji.
export function EntryForm({
  mode,
  initialCode = "",
  withTabs = false,
}: {
  mode: "create" | "join" | "public";
  initialCode?: string;
  /**
   * Zakładki nad panelem (DESIGN.md §4.3). Wyłączone na /p/[code]: tam kod przyszedł
   * ze skanu QR i jest już wpisany, więc zakładka „nowy pokój" tylko by go wyrzuciła.
   */
  withTabs?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { nick, avatar, setNick, setAvatar, setActiveRoom } = useSession();
  const [code, setCode] = useState(normalizeRoomCode(initialCode));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publiczne, setPubliczne] = useState<PubliczyPokoj[]>([]);

  // Losowanie zawsze zmienia awatar — trafienie w ten sam, który już jest wybrany,
  // wyglądałoby jak zepsuty przycisk.
  const randomAvatar = useCallback(() => {
    const inne = AVATARS.filter((a) => a !== avatar);
    setAvatar(inne[Math.floor(Math.random() * inne.length)]);
  }, [avatar, setAvatar]);

  const nickOk = sanitizeNick(nick).length > 0;
  const codeOk = mode === "join" ? isValidRoomCode(code) : true;
  // W trybie publicznym przycisk wchodzi do losowego pokoju, więc bez pokoi nie ma co robić.
  const canSubmit = nickOk && codeOk && !busy && (mode !== "public" || publiczne.length > 0);

  /** Dołączenie do konkretnego kodu — z wpisanego pola albo z kafelka na liście. */
  const dolacz = async (kod: string) => {
    if (busy || !nickOk) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/rooms/${kod}/join`, { nick, avatar });
      setActiveRoom({ code: kod, nick });
      router.push(`/pokoj/${kod}`);
    } catch (err) {
      // Pokój z listy mógł się w międzyczasie zapełnić albo zamknąć — lista odświeża
      // się sama co kilka sekund, więc wystarczy pokazać powód i zostawić wybór.
      setError(err instanceof Error ? err.message : t("entry.error"));
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!canSubmit) return;
    if (mode === "create") {
      setBusy(true);
      setError(null);
      try {
        const { code: newCode } = await apiPost<{ code: string }>("/api/rooms", { nick, avatar });
        setActiveRoom({ code: newCode, nick });
        router.push(`/pokoj/${newCode}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("entry.error"));
        setBusy(false);
      }
      return;
    }
    if (mode === "public") {
      const losowy = publiczne[Math.floor(Math.random() * publiczne.length)];
      if (losowy) await dolacz(losowy.code);
      return;
    }
    await dolacz(code);
  };

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {/* Zakładki i panel to jedna teczka — bez odstępu między nimi. Reszta
          formularza (błąd, przycisk, powrót) zachowuje normalny gap-5. */}
      <div className="flex flex-col">
        {withTabs && <EntryTabs active={mode} />}

        {/* Górne rogi karty kanciaste, bo stoją na nich OBIE zakładki — patrz
            .card-tabbed w globals.css. */}
        <div className={`card arcade-pop flex flex-col gap-5 ${withTabs ? "card-tabbed" : ""}`}>
          {mode === "join" && (
            <div className="flex flex-col gap-2">
              <label className="font-display text-sm font-bold uppercase tracking-[0.06em] text-mint">
                {t("entry.code")}
              </label>
              <CodeInput value={code} onChange={setCode} />
            </div>
          )}

          {mode === "public" && (
            <>
              <p className="text-sm leading-relaxed text-ink-muted">{t("publiczne.lead")}</p>
              <PublicRoomsList onPick={dolacz} busy={busy} onLoaded={setPubliczne} />
            </>
          )}

          <div className="flex flex-col gap-2">
            <label
              htmlFor="nick"
              className="font-display text-sm font-bold uppercase tracking-[0.06em] text-mint"
            >
              {t("entry.nick")}
            </label>
            <input
              id="nick"
              value={nick}
              onChange={(e) => setNick(e.target.value.replace(/[\r\n]/g, ""))}
              maxLength={MAX_NICK_LENGTH * 2}
              placeholder={t("entry.nickPlaceholder")}
              autoComplete="off"
              className="min-h-[56px] rounded-[14px] border-[3px] border-stroke bg-panel px-4 text-lg font-bold text-ink shadow-[0_3px_0_rgb(0_0_0/0.35)] outline-none transition-colors placeholder:font-semibold placeholder:text-ink-muted/60 focus:border-mint focus:bg-panel-hi"
            />
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-display text-sm font-bold uppercase tracking-[0.06em] text-mint">
              {t("entry.avatar")}
            </span>

            {/* Duży podgląd wyboru (DESIGN.md §4.5). Bez niego ekran wejścia wyglądał
                jak siatka ustawień — a to jest moment „to ja", jedyny, w którym gracz
                zakłada sobie twarz na cały wieczór. Kafelki w siatce mają 40 px i przy
                tym rozmiarze nie widać, co się właściwie wybrało. */}
            <div className="flex flex-col items-center gap-2">
              <span
                className="flex size-28 items-center justify-center rounded-full border-[6px] border-white shadow-[0_4px_0_rgb(0_0_0/0.35)]"
                style={{ background: avatarColor(avatar) }}
                aria-hidden
              >
                <AvatarIcon avatar={avatar} size={68} />
              </span>
              <button
                type="button"
                onClick={randomAvatar}
                className="font-display flex min-h-[44px] items-center gap-2 rounded-[14px] border-[3px] border-stroke bg-panel px-4 text-sm font-bold uppercase tracking-[0.06em] text-ink shadow-[0_3px_0_rgb(0_0_0/0.35)] transition-transform duration-75 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-mint focus-visible:outline-offset-2 active:translate-y-[3px] active:shadow-none"
              >
                <Dices size={18} strokeWidth={2.5} aria-hidden />
                {t("entry.randomAvatar")}
              </button>
            </div>

            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-[14px] border-[3px] border-white/40 bg-czerwien/90 px-4 py-3 text-center font-body text-sm font-bold text-white shadow-[0_3px_0_rgb(0_0_0/0.35)]"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        className={`btn ${mode === "create" ? "btn-coral" : ""}`}
        disabled={!canSubmit}
      >
        {busy
          ? t("common.loading")
          : t(
              mode === "create"
                ? "entry.creating"
                : mode === "public"
                  ? "publiczne.joinRandom"
                  : "entry.joining",
            )}
      </button>

      <Link
        href="/"
        className="font-display text-center text-sm font-bold uppercase tracking-[0.06em] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {t("common.back")}
      </Link>
    </form>
  );
}
