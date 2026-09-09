import { describe, expect, it } from "vitest";
import { BAZY, BOK, indeksWejscia, KORYTARZE, poleStartowe, SRODEK, TRASA, type Pole } from "./geometria";
import { POLA, START } from "./engine";

const bokiem = (a: Pole, b: Pole) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
const skosem = (a: Pole, b: Pole) => Math.abs(a.x - b.x) === 1 && Math.abs(a.y - b.y) === 1;
const sasiaduje = (a: Pole, b: Pole) => bokiem(a, b) || skosem(a, b);
const klucz = (p: Pole) => `${p.x},${p.y}`;

// Trasa jest wpisana wprost, więc to te testy pilnują, że jest spójna. Bez nich
// literówka we współrzędnych przeszłaby niezauważona: silnik chodziłby poprawnie,
// bo zna tylko postęp, a błąd zobaczyłbyś dopiero jako pionek skaczący przez pół planszy.
describe("chińczyk — trasa na planszy", () => {
  it("ma dokładnie tyle pól, ile zna silnik", () => {
    expect(TRASA).toHaveLength(POLA);
  });

  it("nie powtarza żadnego pola", () => {
    expect(new Set(TRASA.map(klucz)).size).toBe(POLA);
  });

  it("jest zamkniętym cyklem, bez przerw", () => {
    for (let i = 0; i < TRASA.length; i++) {
      const nastepne = TRASA[(i + 1) % TRASA.length];
      expect(sasiaduje(TRASA[i], nastepne), `przerwa między ${klucz(TRASA[i])} a ${klucz(nastepne)}`).toBe(true);
    }
  });

  it("skręca po skosie DOKŁADNIE na czterech rogach", () => {
    // To nie jest niedoróbka, tylko kształt prawdziwej planszy: ramiona krzyża
    // stykają się narożnikami. Liczba 4 pilnuje, żeby nie było ich więcej przez pomyłkę.
    let skosy = 0;
    for (let i = 0; i < TRASA.length; i++) {
      if (skosem(TRASA[i], TRASA[(i + 1) % TRASA.length])) skosy++;
    }
    expect(skosy).toBe(4);
  });

  it("mieści się w siatce i omija środek", () => {
    for (const p of TRASA) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(BOK);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(BOK);
      const wSrodku = p.x >= SRODEK.od && p.x <= SRODEK.do && p.y >= SRODEK.od && p.y <= SRODEK.do;
      expect(wSrodku, `${klucz(p)} leży w środku planszy`).toBe(false);
    }
  });

  it("nie zahacza o korytarze domowe", () => {
    const trasa = new Set(TRASA.map(klucz));
    for (const korytarz of KORYTARZE) {
      for (const p of korytarz) expect(trasa.has(klucz(p)), `${klucz(p)} jest i korytarzem, i trasą`).toBe(false);
    }
  });
});

describe("chińczyk — geometria zgadza się z silnikiem", () => {
  it("z pola wejścia skręca się w SWÓJ korytarz", () => {
    // Warunek spinający silnik z planszą: pole o postępie DOM_OD-1 musi stykać się
    // z pierwszym polem własnego korytarza. Inaczej pionek wchodziłby do domu bokiem.
    for (let kolor = 0; kolor < 4; kolor++) {
      const wejscie = TRASA[indeksWejscia(kolor)];
      const pierwszeKorytarza = KORYTARZE[kolor][0];
      expect(sasiaduje(wejscie, pierwszeKorytarza), `kolor ${kolor}: ${klucz(wejscie)} nie styka się z ${klucz(pierwszeKorytarza)}`).toBe(true);
    }
  });

  it("starty są rozstawione co 13 pól i każdy leży we własnym ramieniu", () => {
    expect([...START]).toEqual([0, 13, 26, 39]);
    for (let k = 0; k < 4; k++) {
      // wejście wypada 50 pól za startem, czyli tuż przed pełnym okrążeniem
      expect(indeksWejscia(k)).toBe((START[k] + 50) % POLA);
    }
  });

  it("każdy kolor ma inne pole startowe", () => {
    const starty = [0, 1, 2, 3].map((k) => klucz(poleStartowe(k)));
    expect(new Set(starty).size).toBe(4);
  });

  it("korytarz każdego koloru kończy się przy środku", () => {
    for (const korytarz of KORYTARZE) {
      expect(korytarz).toHaveLength(5);
      const ostatnie = korytarz[korytarz.length - 1];
      const przySrodku =
        (ostatnie.x >= SRODEK.od - 1 && ostatnie.x <= SRODEK.do + 1) &&
        (ostatnie.y >= SRODEK.od - 1 && ostatnie.y <= SRODEK.do + 1);
      expect(przySrodku, `${klucz(ostatnie)} nie dotyka środka`).toBe(true);
    }
  });

  it("korytarz jest ciągiem sąsiadujących pól", () => {
    for (const korytarz of KORYTARZE) {
      for (let i = 1; i < korytarz.length; i++) {
        expect(sasiaduje(korytarz[i - 1], korytarz[i])).toBe(true);
      }
    }
  });

  it("każda baza ma cztery miejsca i leży we własnym kącie", () => {
    expect(BAZY).toHaveLength(4);
    for (const baza of BAZY) expect(baza).toHaveLength(4);
    // kąty: lewy dolny, lewy górny, prawy górny, prawy dolny
    const srodkiKatow = BAZY.map((b) => ({
      x: b.reduce((s, p) => s + p.x, 0) / 4,
      y: b.reduce((s, p) => s + p.y, 0) / 4,
    }));
    expect(srodkiKatow[0].x).toBeLessThan(BOK / 2);
    expect(srodkiKatow[0].y).toBeGreaterThan(BOK / 2);
    expect(srodkiKatow[1].x).toBeLessThan(BOK / 2);
    expect(srodkiKatow[1].y).toBeLessThan(BOK / 2);
    expect(srodkiKatow[2].x).toBeGreaterThan(BOK / 2);
    expect(srodkiKatow[2].y).toBeLessThan(BOK / 2);
    expect(srodkiKatow[3].x).toBeGreaterThan(BOK / 2);
    expect(srodkiKatow[3].y).toBeGreaterThan(BOK / 2);
  });

  it("gniazda stoją symetrycznie w swojej bazie", () => {
    // Baza zajmuje 6x6 kratek w kącie. Czwórka gniazd ma mieć te same marginesy
    // z obu stron - inaczej cała grupa zjeżdża w róg i pionki wyglądają na krzywo
    // ustawione, choć każdy z osobna stoi tam, gdzie kod mówi.
    const rogi = [
      { kx: 0, ky: 9 },
      { kx: 0, ky: 0 },
      { kx: 9, ky: 0 },
      { kx: 9, ky: 9 },
    ];
    BAZY.forEach((baza, kolor) => {
      const { kx, ky } = rogi[kolor];
      const xs = [...new Set(baza.map((p) => p.x))].sort((a, b) => a - b);
      const ys = [...new Set(baza.map((p) => p.y))].sort((a, b) => a - b);
      expect(xs).toHaveLength(2);
      expect(ys).toHaveLength(2);
      expect(xs[0] - kx).toBeCloseTo(kx + 6 - xs[1]);
      expect(ys[0] - ky).toBeCloseTo(ky + 6 - ys[1]);
    });
  });
});
