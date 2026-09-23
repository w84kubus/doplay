import { z } from "zod";
import type { GameManifest } from "@/games/types";

// Czwórki (Connect Four). Druga gra dwuosobowa w rejestrze, po Kółku i krzyżyku —
// i zbudowana na tym samym szkielecie: pary ROTUJĄ, więc pokój na szesnaście osób
// nie stoi, kiedy grają dwie.
//
// Różnica wobec Kółka jest jedna, ale istotna: tutaj silnik po upływie terminu gra
// ZA nieobecnego mózgiem bota, więc gra deklaruje `wspieraBoty` i da się w nią zagrać
// samemu. Kółko tego nie robi — stawia na losowym wolnym polu, co jako przeciwnik
// byłoby żartem, a nie partią.
export const czworkiSettingsSchema = z.object({
  /** Rund w partii. 0 = bez limitu, host kończy ręcznie. */
  rounds: z.union([z.literal(3), z.literal(5), z.literal(7), z.literal(0)]).default(5),
  /** Ile czasu na ruch. Bez limitu partia potrafi stanąć na odłożonym telefonie. */
  moveMs: z.union([z.literal(15000), z.literal(30000), z.literal(0)]).default(30000),
  /** Kto gra następną rundę: wygrany zostaje przy stole czy schodzi na koniec kolejki. */
  winnerStays: z.boolean().default(true),
});

export type CzworkiSettings = z.infer<typeof czworkiSettingsSchema>;

export const czworkiManifest: GameManifest<CzworkiSettings> = {
  id: "czworki",
  name: "Czwórki",
  tagline: "Wrzucaj żetony i ustaw cztery w rzędzie, zanim zrobi to przeciwnik.",
  emoji: "🔴",
  // Fiolet — wolny wśród dziewięciu istniejących akcentów. Same żetony są czerwono-żółte
  // (klasyk), więc akcent maluje ramę planszy i kafelek w lobby, a nie pionki.
  accentColor: "#A855F7",
  minPlayers: 2,
  maxPlayers: 16,
  supportsHostScreen: true,
  // Silnik przy PHASE_TIMEOUT wykonuje ruch mózgiem bota, więc bot ma czym grać.
  wspieraBoty: true,
  estimatedMinutes: [5, 15],
  defaultSettings: czworkiSettingsSchema.parse({}),
  settingsSchema: czworkiSettingsSchema,
};
