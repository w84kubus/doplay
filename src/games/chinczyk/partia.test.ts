import { describe, expect, it } from "vitest";
import {
  chinczykEngine,
  KOLORY,
  legalneRuchy,
  META,
  pionkiKoloru,
  poleBezwzgledne,
  BEZPIECZNE,
  W_BAZIE,
  type ChinczykState,
} from "./engine";
import { chinczykSettingsSchema } from "./manifest";
import { mulberry32 } from "@/games/rng";
import type { Player, PlayerMap } from "@/lib/types/room";

// Pełne partie przegrywane od startu do wygranej, z niezmiennikami sprawdzanymi PO KAŻDEJ
// akcji. Pojedynczy test na konkretną sytuację łapie to, co ktoś przewidział; taka symulacja
// łapie to, czego nikt nie przewidział - a zgłoszenie „wypadła szóstka i nie dało się
// wystawić pionka" jest dokładnie z tej drugiej kategorii.

const gracz = (uid: string, isHost = false): Player => ({
  uid, nick: uid, avatar: "cat", joinedAt: 0, isHost, connected: true, lastSeenAt: 0, totalScore: 0,
});

/** Rzut kontrolowany: rng tak dobrane, by `1 + floor(rng*6)` dało zadane oczka. */
const kostka = (n: number) => () => (n - 1) / 6 + 0.001;

interface Widok {
  phase: string;
  tura: number;
  turaUid: string | null;
  kostka: number | null;
  ruchy: number[];
  pionki: number[];
  szostki: number;
  canFinish: boolean;
  spalona: number | null;
}

const widok = (s: ChinczykState, players: PlayerMap = {}) =>
  chinczykEngine.publicView(s, players) as unknown as Widok;

function nowaGra(ilu: number, seed = 1): ChinczykState {
  const uids = ["a", "b", "c", "d"].slice(0, ilu);
  const players: PlayerMap = Object.fromEntries(uids.map((u, i) => [u, gracz(u, i === 0)]));
  let s = chinczykEngine.init({
    players, seatOrder: uids, settings: chinczykSettingsSchema.parse({}),
    now: 1000, rng: mulberry32(seed), seed,
  });
  uids.forEach((u, i) => {
    s = chinczykEngine.reduce(s, { type: "WYBIERZ", kolor: s.doWyboru[i] }, { uid: u, now: 2000, rng: mulberry32(seed) });
  });
  return s;
}

/** Wszystko, co musi być prawdą po KAŻDEJ akcji, niezależnie od tego, jak się tam doszło. */
function sprawdzNiezmienniki(s: ChinczykState, skad: string) {
  const w = widok(s);

  for (let i = 0; i < s.pionki.length; i++) {
    const p = s.pionki[i];
    const ok = p === W_BAZIE || (p >= 0 && p <= META);
    expect(ok, `${skad}: pionek ${i} ma nielegalną pozycję ${p}`).toBe(true);
  }

  // Kolor bez gracza nie może mieć pionka poza bazą.
  for (let kolor = 0; kolor < 4; kolor++) {
    if (s.sloty[kolor]) continue;
    for (const p of pionkiKoloru(s.pionki, kolor)) {
      expect(p, `${skad}: nieobsadzony ${KOLORY[kolor]} rusza pionkiem`).toBe(W_BAZIE);
    }
  }

  // Tura zawsze wskazuje obsadzony kolor.
  if (s.phase === "rzut" || s.phase === "ruch") {
    expect(s.sloty[s.tura], `${skad}: tura na pustym slocie ${s.tura}`).toBeTruthy();
    expect(w.turaUid, `${skad}: turaUid nie zgadza się ze slotem`).toBe(s.sloty[s.tura]);
  }

  // NAJWAŻNIEJSZE: w fazie ruchu MUSI być czym się ruszyć. Inaczej gracz patrzy na
  // planszę, na której nic nie da się kliknąć, i partia stoi do wygaśnięcia tury.
  if (s.phase === "ruch") {
    expect(s.kostka, `${skad}: faza ruchu bez kostki`).not.toBeNull();
    expect(w.ruchy.length, `${skad}: faza ruchu, a zero legalnych ruchów (kostka ${s.kostka})`).toBeGreaterThan(0);
  }

  // Dwa kolory na jednym polu tylko wtedy, gdy pole jest bezpieczne.
  const zajete = new Map<number, number>();
  for (let kolor = 0; kolor < 4; kolor++) {
    pionkiKoloru(s.pionki, kolor).forEach((postep) => {
      const pole = poleBezwzgledne(kolor, postep);
      if (pole === null) return;
      const inny = zajete.get(pole);
      if (inny !== undefined && inny !== kolor) {
        expect(BEZPIECZNE.has(pole), `${skad}: ${KOLORY[kolor]} i ${KOLORY[inny]} dzielą pole ${pole}`).toBe(true);
      }
      zajete.set(pole, kolor);
    });
  }

  expect(w.canFinish, `${skad}: canFinish poza ekranem wyników`).toBe(s.phase === "wynik");
}

/** Rozgrywa partię do wygranej albo do limitu tur. Zwraca log i końcowy stan. */
function rozegraj(ilu: number, seed: number, maxTur = 4000) {
  let s = nowaGra(ilu, seed);
  const rng = mulberry32(seed * 7919 + 13);
  let tur = 0;

  for (; tur < maxTur && s.phase !== "wynik" && s.phase !== "koniec"; tur++) {
    const przed = s.phase;
    const uid = s.sloty[s.tura]!;
    if (s.phase === "rzut") {
      s = chinczykEngine.reduce(s, { type: "RZUC" }, { uid, now: 3000 + tur, rng });
    } else if (s.phase === "ruch") {
      const ruchy = widok(s).ruchy;
      const wybor = ruchy[Math.floor(rng() * ruchy.length)];
      s = chinczykEngine.reduce(s, { type: "RUSZ", pionek: wybor }, { uid, now: 3000 + tur, rng });
    }
    sprawdzNiezmienniki(s, `partia ${ilu}os/seed ${seed}, tura ${tur}, z fazy ${przed}`);
  }
  return { s, tur };
}

describe("chińczyk — pełne partie", () => {
  it("partie dwu-, trzy- i czteroosobowe dochodzą do wygranej bez złamania reguł", () => {
    for (const ilu of [2, 3, 4]) {
      for (let seed = 1; seed <= 12; seed++) {
        const { s, tur } = rozegraj(ilu, seed);
        expect(s.phase, `partia ${ilu} osób, seed ${seed}: nie skończyła się w ${tur} turach`).toBe("wynik");
        expect(s.zwyciezca, `partia ${ilu}/${seed}: brak zwycięzcy`).not.toBeNull();
        // Wygrywa ten, kto ma komplet w domu.
        expect(pionkiKoloru(s.pionki, s.zwyciezca!).every((p) => p === META)).toBe(true);
      }
    }
  });

  it("szóstka przy pionku w bazie ZAWSZE daje możliwość wystawienia", () => {
    // Dokładnie zgłoszony przypadek: „wypadło 6, a nie dało się wystawić pionka".
    for (let seed = 1; seed <= 40; seed++) {
      let s = nowaGra(4, seed);
      const rng = mulberry32(seed + 500);
      for (let tur = 0; tur < 400 && s.phase === "rzut"; ) {
        const kolor = s.tura;
        const uid = s.sloty[kolor]!;
        const wBazie = pionkiKoloru(s.pionki, kolor).some((p) => p === W_BAZIE);
        const przedSzostki = s.szostki;

        s = chinczykEngine.reduce(s, { type: "RZUC" }, { uid, now: 3000 + tur, rng: kostka(6) });

        if (wBazie && przedSzostki < 2) {
          // Poza trzecią szóstką z rzędu MUSI dać się ruszyć - i to pionkiem z bazy.
          expect(s.phase, `seed ${seed}: szóstka przy pionku w bazie nie dała fazy ruchu`).toBe("ruch");
          const w = widok(s);
          const zBazy = w.ruchy.filter((i) => pionkiKoloru(s.pionki, kolor)[i] === W_BAZIE);
          expect(zBazy.length, `seed ${seed}: brak pionka z bazy wśród ruchów`).toBeGreaterThan(0);
          s = chinczykEngine.reduce(s, { type: "RUSZ", pionek: zBazy[0] }, { uid, now: 3000 + tur, rng });
        } else if (s.phase === "ruch") {
          const w = widok(s);
          s = chinczykEngine.reduce(s, { type: "RUSZ", pionek: w.ruchy[0] }, { uid, now: 3000 + tur, rng });
        }
        tur++;
      }
    }
  });

  it("PHASE_TIMEOUT nigdy nie zostawia partii w martwym punkcie", () => {
    // Tą samą drogą chodzą boty, więc zakleszczenie tutaj to zakleszczenie gry z botem.
    for (let seed = 1; seed <= 10; seed++) {
      let s = nowaGra(4, seed);
      let zmian = 0;
      for (let i = 0; i < 1500 && s.phase !== "wynik"; i++) {
        const przed = JSON.stringify({ f: s.phase, t: s.tura, p: s.pionki });
        s = chinczykEngine.reduce(s, { type: "PHASE_TIMEOUT" }, { uid: "a", now: 5000 + i, rng: mulberry32(seed + i) });
        sprawdzNiezmienniki(s, `timeout seed ${seed}, krok ${i}`);
        if (JSON.stringify({ f: s.phase, t: s.tura, p: s.pionki }) !== przed) zmian++;
      }
      expect(s.phase, `seed ${seed}: sama gra terminami nie doszła do wyniku`).toBe("wynik");
      expect(zmian).toBeGreaterThan(50);
    }
  });

  it("legalneRuchy zgadza się z regułami na każdej kombinacji pozycji i oczek", () => {
    for (let pozycja = -1; pozycja <= META; pozycja++) {
      for (let oczka = 1; oczka <= 6; oczka++) {
        const ruchy = legalneRuchy([pozycja, META, META, META], oczka);
        const wolno = ruchy.includes(0);
        if (pozycja === META) expect(wolno, `pionek na mecie nie rusza się`).toBe(false);
        else if (pozycja === W_BAZIE) expect(wolno, `z bazy tylko szóstką`).toBe(oczka === 6);
        else expect(wolno, `na metę dokładnym rzutem (${pozycja}+${oczka})`).toBe(pozycja + oczka <= META);
      }
    }
  });
});
