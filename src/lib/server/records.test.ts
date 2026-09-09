import { describe, expect, it } from "vitest";
import { buildHighlights, winnersOf } from "./records";
import type { GameEvent } from "@/games/types";
import type { RoomHighlight } from "@/lib/types/room";

describe("rekordy pokoju — wygrane", () => {
  it("wygrywa najwyższy wynik", () => {
    expect(winnersOf({ a: 10, b: 7, c: 3 })).toEqual(["a"]);
  });

  it("remis daje wygraną każdemu z najlepszym wynikiem", () => {
    expect(winnersOf({ a: 10, b: 10, c: 3 }).sort()).toEqual(["a", "b"]);
  });

  it("brak wyników = brak zwycięzców", () => {
    expect(winnersOf({})).toEqual([]);
  });

  it("radzi sobie z wynikami ujemnymi i zerami", () => {
    expect(winnersOf({ a: -5, b: -1, c: -9 })).toEqual(["b"]);
    expect(winnersOf({ a: 0, b: 0 }).sort()).toEqual(["a", "b"]);
  });
});

describe("rekordy pokoju — wyróżnienia", () => {
  const ev = (meta?: Record<string, unknown>): GameEvent => ({ type: "idealnie", text: "Idealne trafienie", meta });

  it("bierze tylko zdarzenia oznaczone przez silnik jako rekord", () => {
    const out = buildHighlights([ev({ uid: "a", rekord: true }), ev({ uid: "b" }), ev()], "stoper", 100);
    expect(out).toHaveLength(1);
    expect(out![0]).toMatchObject({ uid: "a", gameId: "stoper", at: 100 });
  });

  it("brak rekordów zwraca null, żeby nie ruszać pola w Firestore", () => {
    expect(buildHighlights([ev({ uid: "a" })], "stoper", 100)).toBeNull();
    expect(buildHighlights([], "stoper", 100)).toBeNull();
  });

  it("nowe trafiają na początek, przed dotychczasowe", () => {
    const stare: RoomHighlight[] = [{ gameId: "stoper", uid: "z", text: "stare", at: 1 }];
    const out = buildHighlights([ev({ uid: "a", rekord: true })], "stoper", 100, stare)!;
    expect(out.map((h) => h.uid)).toEqual(["a", "z"]);
  });

  it("lista nie rośnie w nieskończoność", () => {
    const stare: RoomHighlight[] = Array.from({ length: 20 }, (_, i) => ({
      gameId: "stoper", uid: `u${i}`, text: "x", at: i,
    }));
    const out = buildHighlights([ev({ uid: "nowy", rekord: true })], "stoper", 100, stare)!;
    expect(out).toHaveLength(20);
    expect(out[0].uid).toBe("nowy");
    expect(out.at(-1)!.uid).toBe("u18"); // najstarszy wypadł
  });

  it("ignoruje rekord bez poprawnego uid", () => {
    expect(buildHighlights([ev({ rekord: true }), ev({ uid: 42, rekord: true })], "stoper", 100)).toBeNull();
  });
});

describe("rekordy pokoju — zgłoszenia z silników", () => {
  it("kształt zgłoszenia z Impostora przechodzi przez rdzeń", () => {
    // Tak wygląda zdarzenie emitowane przez impostor/engine.ts przy trafionym haśle po wylocie.
    const out = buildHighlights(
      [{ type: "rekord", text: "Wyleciał i i tak odgadł hasło", meta: { uid: "imp", rekord: true } }],
      "impostor",
      50,
    );
    expect(out).toEqual([{ gameId: "impostor", uid: "imp", text: "Wyleciał i i tak odgadł hasło", at: 50 }]);
  });

  it("kształt zgłoszenia z Mafii przechodzi przez rdzeń", () => {
    const out = buildHighlights(
      [{ type: "rekord", text: "Wygrał dla mafii w pojedynkę", meta: { uid: "boss", rekord: true } }],
      "mafia",
      50,
    );
    expect(out).toHaveLength(1);
    expect(out![0].uid).toBe("boss");
  });

  it("zwykłe zdarzenia rozgrywki nie zaśmiecają rekordów", () => {
    const zwykle = [
      { type: "koniec", text: "Mafia wygrywa!" },
      { type: "wynik", text: "Cywile wykryli impostora!" },
      { type: "runda", text: "Runda 2" },
    ];
    expect(buildHighlights(zwykle, "mafia", 50)).toBeNull();
  });
});

describe("wyróżnienia — zgodność z Firestore", () => {
  it("nie wystawia pola params, gdy zdarzenie go nie ma", () => {
    // Firestore odrzuca `undefined` w zapisie. Zdarzenie z kluczem, ale bez parametrów
    // („wygrał w pojedynkę", „wygrał bez straty pionka") jest normalne — a wystawienie
    // `params: undefined` wywracało CAŁY zapis pokoju i zawieszało partię na dobre.
    const wynik = buildHighlights(
      [{ type: "rekord", text: "Wygrał w pojedynkę", key: "feat.mafia.solo", meta: { uid: "a", rekord: true } }],
      "mafia",
      1000,
    );
    expect(wynik).toHaveLength(1);
    expect("params" in wynik![0]).toBe(false);
    expect(JSON.stringify(wynik)).not.toContain("undefined");
  });

  it("parametry przechodzą, gdy zdarzenie je niesie", () => {
    const wynik = buildHighlights(
      [{ type: "rekord", text: "x", key: "feat.x", params: { n: 3 }, meta: { uid: "a", rekord: true } }],
      "stoper",
      1000,
    );
    expect(wynik![0].params).toEqual({ n: 3 });
  });
});
