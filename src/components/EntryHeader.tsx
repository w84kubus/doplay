"use client";
import Image from "next/image";
import { useT } from "@/lib/i18n/provider";
import type { EntryMode } from "@/components/EntryTabs";

// Nagłówek ekranu wejścia: logo zamiast tytułu.
//
// Wcześniej stał tu <h1> „Nowy pokój" / „Dołącz do pokoju" — po dodaniu zakładek
// powtarzałby dokładnie to, co mówi aktywna zakładka tuż pod spodem. Zostaje logo
// (jak w referencji), a nazwa trybu żyje w zakładce.
//
// <h1> nie znika, tylko przestaje być widoczny: strona bez nagłówka pierwszego
// stopnia jest gorsza dla czytnika ekranu niż powtórzenie dla oka.
export function EntryHeader({ mode }: { mode: EntryMode }) {
  const t = useT();
  return (
    <div className="relative flex flex-col items-center">
      <h1 className="sr-only">{t(mode === "create" ? "entry.newRoom" : mode === "public" ? "entry.publicRooms" : "entry.joinRoom")}</h1>
      <Image
        src="/icon-512.png"
        alt=""
        width={132}
        height={132}
        priority
        className="size-20 drop-shadow-[0_6px_0_rgb(0_0_0/0.28)] sm:size-24"
        aria-hidden
      />
    </div>
  );
}
