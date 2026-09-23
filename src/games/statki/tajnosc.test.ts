import { describe, expect, it } from "vitest";
import { statkiEngine, type StatkiState } from "./engine";
import { statkiSettingsSchema } from "./manifest";
import { polaFloty, polaStatku, poprawnaFlota, type Statek } from "./plansza";
import { mulberry32 } from "@/games/rng";
import type { Player, PlayerMap } from "@/lib/types/room";

// NAJWAŻNIEJSZY plik testów tej gry.
//
// Statki to pierwsza gra w rejestrze z trwałą, ukrytą planszą gracza. Wyciek floty
// nie wywala partii i nie rzuca wyjątkiem — po prostu ktoś z otwartym DevToolsem wygrywa
// każdą partię i nikt nie wie dlaczego. Dlatego tajność sprawdzamy osobno od reguł gry
// i na całych partiach, a nie tylko na stanie początkowym.

const uids = ["a", "b", "widz"];
const players: PlayerMap = Object.fromEntries(
  uids.map((u) => [u, { uid: u, nick: u, avatar: "cat", joinedAt: 0, isHost: u === "a", connected: true, lastSeenAt: 0, totalScore: 0 } as Player]),
);

function gra(seed = 1): StatkiState {
  return statkiEngine.init({
    players, seatOrder: uids, settings: statkiSettingsSchema.parse({}),
    now: 1000, rng: mulberry32(seed), seed,
  });
}

interface PlanszaPub { trafienia: number[]; pudla: number[]; zatopione: number[] }
interface Pub { plansze: Record<string, PlanszaPub>; bok: number }

describe("statki — flota nie wychodzi do publicView", () => {
  it("widok publiczny nie zawiera ANI JEDNEGO obiektu statku", () => {
    // Test strukturalny: `Statek` to {dlugosc, pole, poziomo}. Gdyby kiedykolwiek ktoś
    // dołożył flotę do widoku „tylko na chwilę, do debugowania", ten test zapala się
    // natychmiast, niezależnie od tego, pod jakim kluczem ją wstawi.
    const json = JSON.stringify(statkiEngine.publicView(gra(), players));
    expect(json).not.toContain('"poziomo"');
    expect(json).not.toContain('"pole"');
    expect(json).not.toContain('"floty"');
  });

  it("na starcie partii widok publiczny nie zdradza ŻADNEGO pola floty", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s = gra(seed);
      const pub = statkiEngine.publicView(s, players) as unknown as Pub;
      for (const uid of s.para) {
        expect(pub.plansze[uid].trafienia).toEqual([]);
        expect(pub.plansze[uid].pudla).toEqual([]);
        expect(pub.plansze[uid].zatopione).toEqual([]);
      }
    }
  });

  it("w trakcie partii widok zdradza WYŁĄCZNIE pola, w które ktoś strzelał", () => {
    for (let seed = 1; seed <= 20; seed++) {
      let s = gra(seed);
      const rng = mulberry32(seed * 31 + 7);
      s = statkiEngine.reduce(s, { type: "PHASE_TIMEOUT" }, { uid: "a", now: 2000, rng });

      for (let ruch = 0; ruch < 120 && s.phase === "strzal"; ruch++) {
        s = statkiEngine.reduce(s, { type: "PHASE_TIMEOUT" }, { uid: s.para[s.tura], now: 3000 + ruch, rng });

        const pub = statkiEngine.publicView(s, players) as unknown as Pub;
        for (const uid of s.para) {
          const przeciwnik = s.para[0] === uid ? s.para[1] : s.para[0];
          const oddane = new Set(s.strzaly[przeciwnik] ?? []);
          const plansza = pub.plansze[uid];
          const pokazane = [...plansza.trafienia, ...plansza.pudla, ...plansza.zatopione];

          // Nic, w co nikt nie strzelał, nie ma prawa pojawić się na planszy.
          for (const pole of pokazane) {
            expect(oddane.has(pole), `seed ${seed}: pokazano pole ${pole}, w które nikt nie strzelał`).toBe(true);
          }
          // I odwrotnie: każde nietknięte pole floty musi zostać nietknięte.
          const nieostrzelane = polaFloty(s.floty[uid] ?? [], s.bok).filter((p) => !oddane.has(p));
          for (const pole of nieostrzelane) {
            expect(pokazane, `seed ${seed}: wyciekło pole ${pole} gracza ${uid}`).not.toContain(pole);
          }
        }
      }
    }
  });

  it("przesunięcie NIETKNIĘTEGO statku nie zmienia widoku publicznego ani o bit", () => {
    // To jest właściwa definicja tajności, mocniejsza niż „nie ma wycieku pola X".
    // Skoro przeciwnik nie zna położenia statku, w który nikt nie strzelał, to widok
    // publiczny MUSI być identyczny dla każdego dopuszczalnego położenia tego statku.
    // Gdyby cokolwiek w widoku od niego zależało — choćby licznik albo kolejność pól —
    // dałoby się z tego czytać, a ten test to wyłapie bez zgadywania, czego szukać.
    //
    // Pierwsza wersja tego testu porównywała po prostu LICZBY w całym widoku i nie
    // działała: obie plansze numerują pola tak samo, więc pole 50 gracza A wyglądało
    // jak wyciek pola 50 gracza B.
    let sprawdzonych = 0;

    for (let seed = 1; seed <= 20; seed++) {
      let s = gra(seed);
      const rng = mulberry32(seed + 900);
      s = statkiEngine.reduce(s, { type: "PHASE_TIMEOUT" }, { uid: "a", now: 2000, rng });
      for (let ruch = 0; ruch < 24 && s.phase === "strzal"; ruch++) {
        s = statkiEngine.reduce(s, { type: "PHASE_TIMEOUT" }, { uid: s.para[s.tura], now: 3000 + ruch, rng });
      }

      const [pierwszy, drugi] = s.para;
      const oddane = new Set(s.strzaly[pierwszy] ?? []); // strzały w planszę gracza `drugi`
      const flota = s.floty[drugi] ?? [];
      const nietkniety = flota.findIndex((st) => (polaStatku(st, s.bok) ?? []).every((p) => !oddane.has(p)));
      if (nietkniety < 0) continue;

      // Szukamy INNEGO położenia tego samego statku, zgodnego z tym, co już wiadomo:
      // nie może wejść na pole, w które ktoś strzelał (byłoby trafienie albo pudło).
      let przeniesiona: Statek[] | null = null;
      for (let pole = 0; pole < s.bok * s.bok && !przeniesiona; pole++) {
        for (const poziomo of [true, false]) {
          const kandydat = flota.map((st, i) => (i === nietkniety ? { ...st, pole, poziomo } : st));
          const pola = polaStatku(kandydat[nietkniety], s.bok);
          if (!pola || pola.some((pp) => oddane.has(pp))) continue;
          if (pole === flota[nietkniety].pole && poziomo === flota[nietkniety].poziomo) continue;
          if (!poprawnaFlota(kandydat, s.bok)) continue;
          przeniesiona = kandydat;
          break;
        }
      }
      if (!przeniesiona) continue;

      const inna: StatkiState = { ...s, floty: { ...s.floty, [drugi]: przeniesiona } };
      expect(
        JSON.stringify(statkiEngine.publicView(inna, players)),
        `seed ${seed}: widok publiczny zmienił się po przestawieniu nietkniętego statku`,
      ).toBe(JSON.stringify(statkiEngine.publicView(s, players)));
      sprawdzonych++;
    }

    // Bez tego test mógłby przejść, nie sprawdziwszy niczego — gdyby `continue` zjadło
    // wszystkie przypadki, zielony kolor nic by nie znaczył.
    expect(sprawdzonych).toBeGreaterThan(10);
  });
});

describe("statki — privateView oddaje tylko własną flotę", () => {
  it("gracz widzi swoją flotę i nie widzi cudzej", () => {
    const s = gra(5);
    const mojA = statkiEngine.privateView(s, "a") as { flota: Statek[] };
    const mojB = statkiEngine.privateView(s, "b") as { flota: Statek[] };
    expect(mojA.flota).toEqual(s.floty.a);
    expect(mojB.flota).toEqual(s.floty.b);
    expect(mojA.flota).not.toEqual(mojB.flota);
    // Najprostszy możliwy wyciek: podanie obu flot w jednym dokumencie.
    expect(JSON.stringify(mojA)).not.toContain(JSON.stringify(s.floty.b));
  });

  it("widz spoza pary nie dostaje żadnej floty", () => {
    const s = gra(5);
    const widz = statkiEngine.privateView(s, "widz") as { gram: boolean; flota?: unknown };
    expect(widz.gram).toBe(false);
    expect(widz.flota).toBeUndefined();
    expect(JSON.stringify(widz)).not.toContain('"poziomo"');
  });

  it("dokument prywatny przeciwnika nie zmienia się od MOICH ustawień floty", () => {
    // Rdzeń zapisuje private/{uid} tylko wtedy, gdy się zmienił (selektywny zapis).
    // Gdyby mój ruch statkiem ruszał dokument przeciwnika, po drugiej stronie pojawiłby
    // się zapis bez powodu — a to pierwszy objaw tego, że coś wspólnego trzyma obie floty.
    const s = gra(9);
    const przedB = JSON.stringify(statkiEngine.privateView(s, "b"));
    const po = statkiEngine.reduce(s, { type: "LOSUJ" }, { uid: "a", now: 2000, rng: mulberry32(77) });
    expect(JSON.stringify(statkiEngine.privateView(po, "b"))).toBe(przedB);
  });
});
