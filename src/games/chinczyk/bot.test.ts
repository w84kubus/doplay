import { describe, expect, it } from "vitest";
import { wybierzRuch } from "./bot";
import { DOM_OD, META, PIONKOW, START, W_BAZIE } from "./engine";

// Testy mózgu bota. Każdy ustawia sytuację, w której DOBRY ruch jest oczywisty dla
// człowieka, i sprawdza, czy bot wybiera ten sam. Nie testujemy „czy wygrywa" — to
// zależy od kostki — tylko czy nie robi rzeczy, które widz od razu uzna za głupie.

const CZERWONY = 0;
const ZOLTY = 2;
const SLOTY = ["a", null, "b", null];

/** Płaska tablica 16 pozycji z podanymi czwórkami. */
function plansza(pary: Record<number, number[]>): number[] {
  const p = Array<number>(4 * PIONKOW).fill(W_BAZIE);
  for (const [kolor, czworka] of Object.entries(pary)) {
    czworka.forEach((v, i) => (p[Number(kolor) * PIONKOW + i] = v));
  }
  return p;
}

describe("bot chińczyka — wybór ruchu", () => {
  it("zbija, gdy ma czym, zamiast bezpiecznie iść do przodu", () => {
    // Czerwony start to pole 0, żółty start to 26. Żółty pionek na postępie 1 stoi na polu 27.
    // Czerwony z postępu 24 (pole 24) dojedzie tam trójką.
    const pionki = plansza({ [CZERWONY]: [24, 40, W_BAZIE, W_BAZIE], [ZOLTY]: [1, W_BAZIE, W_BAZIE, W_BAZIE] });
    expect(wybierzRuch(pionki, SLOTY, CZERWONY, 3)).toBe(0);
  });

  it("woli zbić pionek, który zaszedł dalej", () => {
    // Dwa zbicia do wyboru. Celowo tak ustawione, że BLIŻSZE zbicie zabiera pionek
    // znacznie bardziej zaawansowany: inaczej wybór rozstrzygałby sam postęp czerwonego
    // i test nie mówiłby nic o tym, kogo bot woli zbić.
    // Żółty postęp 30 stoi na polu 4, żółty postęp 2 na polu 28.
    const pionki = plansza({
      [CZERWONY]: [1, 25, W_BAZIE, W_BAZIE],
      [ZOLTY]: [30, 2, W_BAZIE, W_BAZIE],
    });
    // pionek 0: 1 + 3 = 4 (zbija tego tuż przed domem), pionek 1: 25 + 3 = 28 (zbija świeżego)
    expect(wybierzRuch(pionki, SLOTY, CZERWONY, 3)).toBe(0);
  });

  it("wprowadza pionka do środka, gdy rzut trafia dokładnie", () => {
    const pionki = plansza({ [CZERWONY]: [META - 2, 10, W_BAZIE, W_BAZIE] });
    expect(wybierzRuch(pionki, SLOTY, CZERWONY, 2)).toBe(0);
  });

  it("kończy pionka zamiast wyprowadzać nowego z bazy", () => {
    // Szóstka daje wybór: wjazd do środka albo świeży pionek na pole startowe.
    // Pole startowe jest bezpieczne, więc bez premii za metę bot wybrałby bazę.
    const pionki = plansza({ [CZERWONY]: [META - 6, W_BAZIE, W_BAZIE, W_BAZIE] });
    expect(wybierzRuch(pionki, SLOTY, CZERWONY, 6)).toBe(0);
  });

  it("na szóstkę wyprowadza pionka z bazy, zamiast przesuwać tego w polu", () => {
    const pionki = plansza({ [CZERWONY]: [10, W_BAZIE, W_BAZIE, W_BAZIE] });
    expect(wybierzRuch(pionki, SLOTY, CZERWONY, 6)).toBe(1);
  });

  it("wjeżdża do korytarza domowego, nawet gdy alternatywa ląduje bezpiecznie", () => {
    // 48 + 4 = 52 = korytarz. Alternatywa: 30 + 4 = 34, czyli globus (pole bezpieczne),
    // więc sam postęp i premia za bezpieczeństwo przemawiają za nią - decyduje korytarz.
    const pionki = plansza({ [CZERWONY]: [48, 30, W_BAZIE, W_BAZIE] });
    expect(DOM_OD).toBe(51);
    expect(wybierzRuch(pionki, SLOTY, CZERWONY, 4)).toBe(0);
  });

  it("nie wstawia pionka pod lufę, nawet gdy tamten ruch idzie dalej", () => {
    // Żółty stoi na polu 30 (postęp 4) i celuje w pola 31-36.
    // Pionek 0: 28 + 4 = 32, czyli prosto pod lufę, ale DALEJ na trasie.
    // Pionek 1: 20 + 4 = 24, spokojnie. Bez kary za wystawienie wygrałby sam postęp.
    const pionki = plansza({
      [CZERWONY]: [28, 20, W_BAZIE, W_BAZIE],
      [ZOLTY]: [4, W_BAZIE, W_BAZIE, W_BAZIE],
    });
    expect(START[ZOLTY]).toBe(26);
    expect(wybierzRuch(pionki, SLOTY, CZERWONY, 4)).toBe(1);
  });

  it("woli stanąć na polu bezpiecznym niż pojechać dalej po odkrytej trasie", () => {
    // 30 + 4 = 34 to globus; 36 + 4 = 40 to zwykłe pole, tyle że dalej na trasie.
    const pionki = plansza({ [CZERWONY]: [30, 36, W_BAZIE, W_BAZIE] });
    expect(wybierzRuch(pionki, SLOTY, CZERWONY, 4)).toBe(0);
  });

  it("bez sensownych opcji rusza pionkiem najbliżej domu", () => {
    // Sam na planszy, nikogo do zbicia, nic w zasięgu mety — liczy się postęp.
    const pionki = plansza({ [CZERWONY]: [5, 30, 12, W_BAZIE] });
    expect(wybierzRuch(pionki, SLOTY, CZERWONY, 2)).toBe(1);
  });

  it("oddaje null, gdy nie ma żadnego legalnego ruchu", () => {
    const pionki = plansza({ [CZERWONY]: [W_BAZIE, W_BAZIE, W_BAZIE, W_BAZIE] });
    expect(wybierzRuch(pionki, SLOTY, CZERWONY, 3)).toBeNull();
  });

  it("jest deterministyczny — ta sama sytuacja daje ten sam ruch", () => {
    const pionki = plansza({ [CZERWONY]: [3, 3, W_BAZIE, W_BAZIE], [ZOLTY]: [7, W_BAZIE, W_BAZIE, W_BAZIE] });
    const a = wybierzRuch(pionki, SLOTY, CZERWONY, 4);
    const b = wybierzRuch(pionki, SLOTY, CZERWONY, 4);
    expect(a).toBe(b);
  });
});
