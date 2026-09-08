// Manifesty gier (client-safe). Importuj to zamiast registry.ts na kliencie —
// registry.ts ciągnie silniki (1700+ linii), klient ich nie potrzebuje.
import type { GameManifest } from "./types";
import { stoperManifest } from "./stoper/manifest";
import { pmManifest } from "./panstwa-miasta/manifest";
import { wisielecManifest } from "./wisielec/manifest";
import { impostorManifest } from "./impostor/manifest";
import { mafiaManifest } from "./mafia/manifest";
import { odcienManifest } from "./odcien/manifest";
import { kasynoManifest } from "./kasyno/manifest";
import { kolkoManifest } from "./kolko/manifest";
import { chinczykManifest } from "./chinczyk/manifest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAME_MANIFESTS: Record<string, GameManifest<any>> = {
  [stoperManifest.id]: stoperManifest,
  [pmManifest.id]: pmManifest,
  [wisielecManifest.id]: wisielecManifest,
  [impostorManifest.id]: impostorManifest,
  [mafiaManifest.id]: mafiaManifest,
  [odcienManifest.id]: odcienManifest,
  [kasynoManifest.id]: kasynoManifest,
  [kolkoManifest.id]: kolkoManifest,
  [chinczykManifest.id]: chinczykManifest,
};

/** Manifesty do wyboru gry w lobby (kolejność jak w SPEC §1). */
export const GAME_LIST = Object.values(GAME_MANIFESTS);

/**
 * Ile osób ma sens w jednym pokoju: tyle, ile znosi najpojemniejsza gra.
 *
 * Liczone z rejestru, nie wpisane na sztywno, żeby gra z innym limitem podniosła to
 * sama. Rdzeń nadal nie zna żadnej konkretnej gry — pyta cały rejestr o maksimum.
 *
 * Do Fazy „publiczne pokoje" `join` nie miał żadnego limitu: kontrola `maxPlayers`
 * siedziała dopiero w `startGame`. Przy pokoju dla znajomych to nie przeszkadzało,
 * ale publiczny pokój mógłby nazbierać tylu obcych, że żadnej gry nie dałoby się
 * odpalić, a błąd zobaczyłby dopiero host przy starcie.
 */
export const MAX_W_POKOJU = Math.max(...GAME_LIST.map((m) => m.maxPlayers));
