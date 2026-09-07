"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AVATARS, DEFAULT_AVATAR } from "@/lib/avatars";

// Lokalne preferencje gracza (nick, awatar) + aktywna sesja pokoju (UPGRADE.md §C1).
// To NIE jest stan gry (SPEC §11) — tylko wygoda, żeby nie wpisywać nicku za każdym razem
// i umożliwienie powrotu do pokoju po odświeżeniu/zamknięciu.
// Persystujemy w localStorage.
interface SessionState {
  nick: string;
  avatar: string;
  // Aktywna sesja pokoju — pozwala na powrót do gry (C1).
  activeRoom: { code: string; nick: string } | null;
  setNick: (nick: string) => void;
  setAvatar: (avatar: string) => void;
  setActiveRoom: (room: { code: string; nick: string } | null) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      nick: "",
      avatar: DEFAULT_AVATAR,
      activeRoom: null,
      setNick: (nick) => set({ nick }),
      setAvatar: (avatar) => set({ avatar }),
      setActiveRoom: (activeRoom) => set({ activeRoom }),
    }),
    {
      // Nazwa sprzed rebrandingu na Doplay — patrz LOCALE_COOKIE w i18n/types.ts.
      // Zmiana odcięłaby wracających graczy od zapisanego nicku, awatara i pokoju.
      name: "domowka-session",
      // Migracja zamienia nieznany awatar na domyślny. Numer wersji trzeba PODBIĆ
      // przy każdej wymianie pakietu, bo migracja odpala się tylko przy przejściu
      // na wyższą wersję — inaczej dotknie wyłącznie graczy sprzed poprzedniej.
      //
      // v1: emoji („🦊") na identyfikatory ikon.
      // v2: wycofanie przedmiotów bez twarzy („pizza", „egg", „anchor"). Serwer
      //     nie przyjmuje ich już wcale, więc bez tego podbicia wracający gracz
      //     wysłałby zapisaną wartość i dostał „Nieznany awatar" zamiast wejść.
      version: 2,
      migrate: (persisted) => {
        const prev = (persisted ?? {}) as Partial<SessionState>;
        const known = (AVATARS as readonly string[]).includes(prev.avatar ?? "");
        return { ...prev, avatar: known ? prev.avatar : DEFAULT_AVATAR } as SessionState;
      },
    },
  ),
);
