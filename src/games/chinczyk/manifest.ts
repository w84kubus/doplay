import { z } from "zod";
import type { GameManifest } from "@/games/types";

// Chińczyk (Ludo) w wariancie z foony.com/pl/games/ludo, jeden do jednego:
// cztery pionki, szóstka wyprowadza z bazy i daje dodatkowy rzut, trzy szóstki pod rząd
// kasują trzeci rzut, osiem pól bezpiecznych, do środka trzeba trafić dokładnym rzutem.
export const chinczykSettingsSchema = z.object({
  /**
   * Ile czasu na turę; 0 = bez limitu.
   *
   * Domyślne 20 s jak u foony. Limit nie jest ozdobą: tura jest IMIENNA, więc bez terminu
   * jeden gracz, któremu padł telefon, zatrzymuje partię reszty na zawsze. Ta sama pułapka,
   * która zawieszała rozdanie w Impostorze i Mafii.
   */
  turaMs: z
    .union([z.literal(0), z.literal(5000), z.literal(10000), z.literal(20000), z.literal(30000), z.literal(60000)])
    .default(20000),

  /** Ile czasu na wybór koloru, zanim rozdamy resztę automatycznie. */
  wyborMs: z.union([z.literal(15000), z.literal(30000), z.literal(45000)]).default(30000),
});

export type ChinczykSettings = z.infer<typeof chinczykSettingsSchema>;

export const chinczykManifest: GameManifest<ChinczykSettings> = {
  id: "chinczyk",
  name: "Chińczyk",
  tagline: "Wyrzuć szóstkę, wyjdź z bazy i zbij kogo się da.",
  emoji: "🎲",
  // Niebieski — jedyna rodzina odcieni wolna wśród ośmiu istniejących akcentów.
  // Cyjan (#22D3EE) jest wyraźnie zielonkawy, więc przy małym kafelku się nie mylą.
  accentColor: "#3B82F6",
  // Jeden gracz wystarcza, bo resztę stołu mogą stanowić boty. Host dosadza je w lobby;
  // bez ani jednego bota przycisk „Zaczynamy" i tak nie ruszy, bo silnik potrzebuje
  // dwóch obsadzonych kolorów.
  minPlayers: 1,
  maxPlayers: 4,
  supportsHostScreen: true,
  estimatedMinutes: [20, 40],
  defaultSettings: chinczykSettingsSchema.parse({}),
  settingsSchema: chinczykSettingsSchema,
};
