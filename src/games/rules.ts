// G3 (UPGRADE.md §G): zasady gier — jedna karta, bez ściany tekstu.
// Oddzielone od manifestów, żeby nie puchnął registry.
//
// Treść per język siedzi TUTAJ, nie w dict.ts — tak samo jak polityka prywatności.
// To kilkadziesiąt zdań prozy plus tablice kroków; w płaskim słowniku byłyby nieczytelne,
// a i tak nigdy nie mieszają się z resztą interfejsu.
import type { Locale } from "@/lib/i18n/types";

export interface GameRules {
  howTo: string; // 2-3 zdania "jak grać"
  steps: string[]; // zwięzłe kroki rozgrywki
  tip?: string; // opcjonalna ciekawostka/wskazówka
}

const pl: Record<string, GameRules> = {
  kolko: {
    howTo: "Klasyk na planszy 3×3. Ustaw trzy swoje znaki w rzędzie - w poziomie, pionie albo na skos. Gracie we dwoje, reszta pokoju czeka w kolejce i ogląda.",
    steps: [
      "Gracie we dwoje: jeden krzyżykami, drugi kółkami",
      "Na zmianę stawiacie znak na wolnym polu",
      "Trzy w rzędzie kończą rundę",
      "Wygrany zostaje przy stole, przegrany idzie na koniec kolejki",
    ],
    tip: "Środek planszy jest wart więcej niż róg - zaczyna się od niego.",
  },
  kasyno: {
    howTo: "Cztery tryby losowe na wirtualne żetony. Obstawiasz, losowanie rozstrzyga, kto zejdzie do zera - odpada.",
    steps: [
      "Każdy dostaje tyle samo żetonów na start",
      "Co rundę obstawiasz stawkę (w Double i Wheel także kolor albo mnożnik)",
      "Zakłady wszystkich są jawne - widzisz, kto na co poszedł",
      "Losowanie, wypłaty, a kto straci wszystko, wypada z gry",
      "Wygrywa ten, kto zostanie ostatni",
    ],
    tip: "Szanse są tak dobrane, że każdy zakład ma tę samą wartość oczekiwaną - różni je tylko zmienność. ×35 kusi, ale wypada raz na czterdzieści rund.",
  },
  odcien: {
    howTo: "Kolor błyska na kilka sekund i znika. Odtwarzasz go z pamięci trzema suwakami - im bliżej, tym więcej punktów.",
    steps: [
      "Kolor wyświetla się przez kilka sekund",
      "Znika - nikt go już nie widzi",
      "Ustawiasz suwaki tak, żeby trafić w zapamiętany odcień",
      "Odsłonięcie: oryginał obok wszystkich prób, ranking wg celności",
    ],
    tip: "Zapamiętuj słowami („ciepły róż, dość ciemny”), nie samym obrazem - pamięć na nazwy jest trwalsza.",
  },
  stoper: {
    howTo: "Odmierzaj czas w głowie - zatrzymaj stoper jak najbliżej celu. Nie patrzysz na cyfry!",
    steps: [
      "Stoper rusza, cel pojawia się na ekranie",
      "Liczysz w głowie sekundy",
      "Klikasz STOP, gdy myślisz, że czas minął",
      "Im mniejszy błąd, tym więcej punktów",
    ],
    tip: "Oddychaj miarowo - to naturalny metronom.",
  },
  "panstwa-miasta": {
    howTo: "Klasyka z zeszytów szkolnych - wymyśl słowa na wylosowaną literę w 6 kategoriach.",
    steps: [
      "Losowana jest litera",
      "Wpisz słowa w każdej kategorii (na tę literę!)",
      "Kto pierwszy wypełni wszystko - może kliknąć STOP",
      "Wspólna weryfikacja: można kwestionować odpowiedzi",
      "Unikalne odpowiedzi = 10 pkt, powtórki = 5 pkt, jedyny = 15 pkt",
    ],
  },
  wisielec: {
    howTo: "Zgaduj hasło litera po literze - każdy błąd dodaje element szubienicy.",
    steps: [
      "Hasło jest ukryte za kreskami",
      "Po kolei zgadujecie litery",
      "Trafiona litera się odsłania",
      "Pudło = kawałek szubienicy",
      "Odgadnijcie hasło, zanim ludzik zawiśnie!",
    ],
    tip: "Zacznij od samogłosek: A, E, I, O.",
  },
  impostor: {
    howTo: "Wszyscy dostają to samo hasło - oprócz impostora. Zadawajcie sobie pytania i znajdźcie intruza!",
    steps: [
      "Każdy dostaje hasło (impostor nie lub inne)",
      "Po kolei dajesz jednowyrazową podpowiedź",
      "Dyskusja: kto zachowywał się podejrzanie?",
      "Głosowanie: wytypuj impostora",
      "Złapany impostor może jeszcze zgadnąć hasło!",
    ],
    tip: "Nie dawaj zbyt oczywistych podpowiedzi - impostor je wykorzysta.",
  },
  mafia: {
    howTo: "Gra psychologiczna - miasto kontra mafia. W nocy mafia zabija, w dzień wszyscy głosują.",
    steps: [
      "Role rozdane w tajemnicy: mafia, detektyw, lekarz, mieszkańcy",
      "Noc: mafia wybiera ofiarę, lekarz chroni, detektyw sprawdza",
      "Świt: narrator ogłasza, kto nie przeżył",
      "Dzień: dyskusja i głosowanie - kogo linczujemy?",
      "Gra do zwycięstwa miasta lub mafii",
    ],
    tip: "Mafia wygrywa, gdy jest ich tyle samo co reszty.",
  },
  chinczyk: {
    howTo: "Klasyczny chińczyk. Wyprowadź cztery pionki z bazy, obejdź planszę i wprowadź je do środka. Kto pierwszy zbierze tam komplet, wygrywa.",
    steps: [
      "Każdy wybiera kolor; przy dwóch graczach siadacie naprzeciw siebie",
      "Szóstka wyprowadza pionek z bazy i daje dodatkowy rzut",
      "Wejście na cudzy pionek odsyła go do bazy; pola z obwódką są bezpieczne",
      "Do środka trzeba trafić dokładnym rzutem - nadmiar przepada",
    ],
    tip: "Trzy szóstki pod rząd kasują trzeci rzut, więc szóstka nie zawsze jest dobrą wiadomością.",
  },
};

const en: Record<string, GameRules> = {
  kolko: {
    howTo: "The 3×3 classic. Get three of your marks in a row - across, down or diagonally. Two of you play; the rest of the room queues up and watches.",
    steps: [
      "Two of you play: one takes crosses, the other noughts",
      "You take turns placing a mark on a free square",
      "Three in a row ends the round",
      "The winner keeps the table, the loser goes to the back of the queue",
    ],
    tip: "The centre square is worth more than a corner - start there.",
  },
  kasyno: {
    howTo: "Four games of chance played with virtual chips. You bet, the draw decides, and whoever hits zero is out.",
    steps: [
      "Everyone starts with the same pile of chips",
      "Each round you place a stake (in Double and Wheel, also a colour or a multiplier)",
      "Every bet is public - you can see what everyone went for",
      "The draw, the payouts, and anyone who loses it all drops out",
      "Last one standing wins",
    ],
    tip: "The odds are set so every bet has the same expected value - only the variance differs. ×35 is tempting, but it lands about once in forty rounds.",
  },
  odcien: {
    howTo: "A colour flashes for a few seconds and disappears. You rebuild it from memory with three sliders - the closer you get, the more points you score.",
    steps: [
      "The colour shows for a few seconds",
      "It disappears - nobody can see it any more",
      "You move the sliders to match the shade you remember",
      "The reveal: the original next to everyone's attempts, ranked by accuracy",
    ],
    tip: "Memorise it in words (\"warm pink, fairly dark\") rather than as an image - memory for names lasts longer.",
  },
  stoper: {
    howTo: "Count the time in your head and stop the clock as close to the target as you can. You don't get to see the digits!",
    steps: [
      "The clock starts, the target appears on screen",
      "You count the seconds in your head",
      "You hit STOP when you think the time is up",
      "The smaller your error, the more points you get",
    ],
    tip: "Breathe steadily - it's a natural metronome.",
  },
  "panstwa-miasta": {
    howTo: "The classic school-notebook game - think of a word starting with the drawn letter in each of 6 categories.",
    steps: [
      "A letter is drawn",
      "Type a word in every category (starting with that letter!)",
      "Whoever fills everything in first can hit STOP",
      "Everyone reviews together: answers can be challenged",
      "A unique answer scores 10, a repeated one 5, the only answer in its category 15",
    ],
  },
  wisielec: {
    howTo: "Guess the phrase letter by letter - every miss adds another piece of the gallows.",
    steps: [
      "The phrase is hidden behind dashes",
      "You take turns guessing letters",
      "A correct letter is revealed",
      "A miss adds a piece of the gallows",
      "Guess the phrase before the figure hangs!",
    ],
    tip: "Start with the vowels: A, E, I, O.",
  },
  impostor: {
    howTo: "Everyone gets the same password - except the impostor. Question each other and find the intruder!",
    steps: [
      "Everyone gets the password (the impostor gets none, or a different one)",
      "In turn, each player gives a one-word clue",
      "Discussion: who was acting suspiciously?",
      "Vote: name the impostor",
      "A caught impostor still gets one shot at guessing the password!",
    ],
    tip: "Don't make your clue too obvious - the impostor will use it.",
  },
  mafia: {
    howTo: "A game of reading people - the town against the mafia. The mafia kills at night, everyone votes by day.",
    steps: [
      "Roles are dealt in secret: mafia, detective, doctor, townsfolk",
      "Night: the mafia picks a victim, the doctor protects, the detective checks",
      "Dawn: the narrator announces who didn't make it",
      "Day: discussion and a vote - who do we lynch?",
      "Play until the town or the mafia wins",
    ],
    tip: "The mafia wins once they equal the number of everyone else.",
  },
  chinczyk: {
    howTo: "Classic Ludo. Get four pieces out of your base, walk them round the board and bring them into the centre. First to gather all four there wins.",
    steps: [
      "Everyone picks a colour; with two players you sit opposite each other",
      "A six lets a piece out of the base and grants an extra roll",
      "Landing on someone else's piece sends it home; outlined squares are safe",
      "You need an exact roll to enter the centre - anything over is wasted",
    ],
    tip: "Three sixes in a row cancel the third roll, so a six is not always good news.",
  },
};

/** Zasady w języku gracza. Nieznana gra = brak karty (komponent zwraca null). */
export const GAME_RULES: Record<Locale, Record<string, GameRules>> = { pl, en };
