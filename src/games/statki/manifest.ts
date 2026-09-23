import { z } from "zod";
import type { GameManifest } from "@/games/types";

// Statki. Pierwsza gra w rejestrze, w której gracz ma WŁASNĄ, trwałą ukrytą planszę
// przez całą partię — a nie samą rolę czy hasło jak Impostor i Mafia. Flota leży
// w `secret/state`, a przez `privateView` widzi ją wyłącznie jej właściciel.
export const statkiSettingsSchema = z.object({
  /** Bok planszy. 8 gra się szybciej i lepiej mieści pod kciukiem, 10 to klasyk. */
  bok: z.union([z.literal(8), z.literal(10)]).default(8),
  /**
   * Czy trafienie daje kolejny strzał. Zasada z podwórka: bez niej partia jest
   * spokojniejsza, z nią potrafi się skończyć jedną długą serią.
   */
  dodatkowyStrzal: z.boolean().default(true),
  /** Ile czasu na ustawienie floty. Zero nie wchodzi w grę — faza czeka na ludzi. */
  ustawianieMs: z.union([z.literal(45000), z.literal(90000)]).default(45000),
  /** Ile czasu na strzał. */
  strzalMs: z.union([z.literal(20000), z.literal(40000), z.literal(0)]).default(40000),
  /** Partii w meczu. Jedna partia Statków trwa dłużej niż runda Czwórek, stąd domyślnie 1. */
  rounds: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(0)]).default(1),
  /** Kto gra następną partię: wygrany zostaje przy stole czy schodzi na koniec kolejki. */
  winnerStays: z.boolean().default(true),
});

export type StatkiSettings = z.infer<typeof statkiSettingsSchema>;

export const statkiManifest: GameManifest<StatkiSettings> = {
  id: "statki",
  name: "Statki",
  tagline: "Trafiony, zatopiony. Znajdź cudzą flotę, zanim ktoś znajdzie twoją.",
  emoji: "🚢",
  // Morska zieleń — jedyna rodzina odcieni wolna wśród dziesięciu akcentów. Od cyjanu
  // Kółka (#22D3EE) różni ją przede wszystkim jasność, nie sam odcień, więc na małym
  // kafelku w lobby nie mylą się nawet obok siebie.
  accentColor: "#14B8A6",
  minPlayers: 2,
  maxPlayers: 16,
  supportsHostScreen: true,
  // Silnik przy PHASE_TIMEOUT strzela mózgiem bota, więc bot ma czym grać.
  wspieraBoty: true,
  estimatedMinutes: [8, 20],
  defaultSettings: statkiSettingsSchema.parse({}),
  settingsSchema: statkiSettingsSchema,
};
