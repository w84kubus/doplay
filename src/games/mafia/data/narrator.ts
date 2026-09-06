// Skrypt narratora (SPEC §5.6). Klimatyczne, losowane kwestie na fazę — 80% klimatu tej gry.
// Silnik zapisuje KLUCZ (faza + indeks), nie gotowe zdanie: dzięki temu ta sama partia
// czyta się po polsku u jednego gracza i po angielsku u drugiego, bo tłumaczenie
// dzieje się na kliencie. `text` zostaje jako polski zapas do feedu w Firestore.
export const NARRATOR: Record<string, string[]> = {
  noc: [
    "Miasto pogrąża się w ciszy… ktoś skrada się uliczkami.",
    "Zapada noc. Zamknijcie oczy - nie każdy zaśnie.",
    "Latarnie gasną jedna po drugiej. Miasto zasypia.",
    "W ciemności słychać tylko czyjeś kroki.",
    "Noc otula miasto. Gdzieś ostrzy się nóż.",
    "Księżyc chowa się za chmurą. Czas na mroczne sprawy.",
  ],
  switt: [
    "Świt. Miasto budzi się i liczy swoich.",
    "Pierwsze promienie słońca odsłaniają, co stało się w nocy.",
    "Poranek przynosi wieści - nie wszystkie dobre.",
    "Kogut zapiał. Czas spojrzeć prawdzie w oczy.",
  ],
  dzien: [
    "Dzień. Czas na rozmowy, oskarżenia i podejrzenia.",
    "Miasto zbiera się na rynku. Kto zawinił?",
    "Padają pierwsze oskarżenia. Broń się albo giń.",
    "Napięcie rośnie. Komuś patrzycie w oczy zbyt długo.",
  ],
  glosowanie: [
    "Czas zdecydować. Kogo miasto wyśle na tamten świat?",
    "Podnieście ręce. Sprawiedliwość bywa ślepa.",
    "Głosujcie. Pomyłka może kosztować niewinnego.",
  ],
  smierc: [
    "…i tej osoby już nie ma między nami.",
    "Miasto traci kolejnego mieszkańca.",
    "Cisza. Ktoś odszedł na zawsze.",
  ],
};

/** Losuje kwestię i zwraca ją razem z kluczem tłumaczenia. */
export function narratorLine(phase: string, rng: () => number): { text: string; key: string } {
  const lines = NARRATOR[phase] ?? [""];
  const i = Math.floor(rng() * lines.length);
  return { text: lines[i] ?? "", key: `mafia.narrator.${phase}.${i}` };
}
