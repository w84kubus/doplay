import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/games/rng";
import { GAMES } from "@/games/registry";
import type { Player, PlayerMap } from "@/lib/types/room";

// Kontrakt opt-inu `wspieraBoty`, sprawdzany na całym rejestrze — jak `finish.test.ts`.
//
// Bot nie ma własnego napędu: nie ma tokenu, nie pinguje i nigdy nie wyśle akcji.
// Jego ruch wykonuje `PHASE_TIMEOUT`. Gra, której silnik po upływie terminu tylko
// PRZEWIJA fazę (zamyka rundę, rozlicza głosowanie), zostawiłaby bota jako milczące
// miejsce przy stole — a w Mafii i Impostorze jako rolę, która nigdy nie zadziała.
//
// Dlatego deklaracja `wspieraBoty: true` jest obietnicą: „mój silnik gra za nieobecnego".
//
// ZASIĘG tego testu, żeby nikt mu nie ufał bardziej, niż zasługuje. Sprawdzone przez
// włączenie flagi po kolei każdej grze w rejestrze:
//   łapie  - Mafię, Impostora i Wisielca (tam PHASE_TIMEOUT nie rusza stanu albo pasuje),
//   puszcza - Stopera, Państwa-miasta, Odcień i Kasyno, bo ich termin PRZEWIJA fazę
//             i stan się zmienia, choć bot i tak nic by nie zagrał.
// Rozróżnienie „ruch nieobecnego" kontra „sam upływ czasu" wymaga wiedzy o konkretnej
// grze, więc ta bramka jest wstępna, nie ostateczna. Przy dokładaniu botów do kolejnej
// gry przeczytaj jej `PHASE_TIMEOUT`, zamiast poprzestać na zielonym teście.

const uids = ["host", "a", "b", "c"];
const players: PlayerMap = Object.fromEntries(
  uids.map((u) => [
    u,
    { uid: u, nick: u, avatar: "cat", joinedAt: 0, isHost: u === "host", connected: true, lastSeenAt: 0, totalScore: 0 } as Player,
  ]),
);

const zBotami: PlayerMap = { ...players, bot_1: { ...players.a, uid: "bot_1", nick: "Bot", bot: true } };

describe("boty — kontrakt rejestru", () => {
  const wspierajace = Object.values(GAMES).filter((g) => g.manifest.wspieraBoty);

  it("ktoś w ogóle deklaruje wsparcie botów", () => {
    // Gdyby ta lista była pusta, reszta testów niżej milczałaby zamiast sprawdzać.
    expect(wspierajace.length).toBeGreaterThan(0);
  });

  it("gra z botami rusza z miejsca na PHASE_TIMEOUT, zamiast stać", () => {
    for (const { manifest, engine } of wspierajace) {
      const start = engine.init({
        players: zBotami,
        seatOrder: Object.keys(zBotami),
        settings: manifest.defaultSettings,
        now: 1000,
        rng: mulberry32(1),
        seed: 1,
      });
      const po = engine.reduce(start, { type: "PHASE_TIMEOUT" }, { uid: "host", now: 5000, rng: mulberry32(2) });
      expect(JSON.stringify(po), `${manifest.id}: PHASE_TIMEOUT niczego nie zmienił`).not.toBe(JSON.stringify(start));
    }
  });

  it("gra z botami ma sens dla jednego człowieka przy stole", () => {
    // Sens dosadzania bota jest wtedy, gdy pozwala zagrać w mniejszym gronie niż
    // wymaga tego gra. Przy `minPlayers` większym niż 2 bot niczego nie odblokowuje.
    for (const { manifest } of wspierajace) {
      expect(manifest.minPlayers, `${manifest.id}: za wysokie minimum jak na grę z botem`).toBeLessThanOrEqual(2);
    }
  });
});
