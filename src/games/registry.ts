// Rejestr gier (SPEC §3.4). Dodanie nowej gry = jeden import + jeden wpis tutaj.
// Zero zmian w rdzeniu. Ten plik trzyma TYLKO czyste silniki + manifesty (bez Reacta),
// więc jest bezpieczny i na serwerze (runner), i na kliencie (metadane).
import type { GameEngine, GameManifest } from "./types";
import { stoperManifest } from "./stoper/manifest";
import { stoperEngine } from "./stoper/engine";
import { pmManifest } from "./panstwa-miasta/manifest";
import { pmEngine } from "./panstwa-miasta/engine";
import { wisielecManifest } from "./wisielec/manifest";
import { wisielecEngine } from "./wisielec/engine";
import { impostorManifest } from "./impostor/manifest";
import { impostorEngine } from "./impostor/engine";
import { mafiaManifest } from "./mafia/manifest";
import { odcienManifest } from "./odcien/manifest";
import { kasynoManifest } from "./kasyno/manifest";
import { kolkoManifest } from "./kolko/manifest";
import { chinczykManifest } from "./chinczyk/manifest";
import { mafiaEngine } from "./mafia/engine";
import { odcienEngine } from "./odcien/engine";
import { kasynoEngine } from "./kasyno/engine";
import { kolkoEngine } from "./kolko/engine";
import { chinczykEngine } from "./chinczyk/engine";

export interface GameEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  manifest: GameManifest<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  engine: GameEngine<any, any, any>;
}

export const GAMES: Record<string, GameEntry> = {
  [stoperManifest.id]: { manifest: stoperManifest, engine: stoperEngine },
  [pmManifest.id]: { manifest: pmManifest, engine: pmEngine },
  [wisielecManifest.id]: { manifest: wisielecManifest, engine: wisielecEngine },
  [impostorManifest.id]: { manifest: impostorManifest, engine: impostorEngine },
  [mafiaManifest.id]: { manifest: mafiaManifest, engine: mafiaEngine },
  [odcienManifest.id]: { manifest: odcienManifest, engine: odcienEngine },
  [kasynoManifest.id]: { manifest: kasynoManifest, engine: kasynoEngine },
  [kolkoManifest.id]: { manifest: kolkoManifest, engine: kolkoEngine },
  [chinczykManifest.id]: { manifest: chinczykManifest, engine: chinczykEngine },
};

/** Manifesty do wyboru gry w lobby (kolejność jak w SPEC §1). */
export const GAME_LIST = Object.values(GAMES).map((g) => g.manifest);
