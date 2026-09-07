import type { Locale } from "./types";

// Treść polityki prywatności. Świadomie POZA dict.ts: to długie akapity, które w płaskim
// słowniku byłyby nieczytelne, a i tak nigdy nie są mieszane z resztą interfejsu.
//
// Stan faktyczny na dzień napisania: aplikacja nie ma analityki, reklam ani trackerów.
// Jeśli kiedykolwiek dojdzie Google Analytics, Meta Pixel czy podobne — ta strona
// przestaje wystarczać i trzeba dołożyć PRAWDZIWY baner zgody z możliwością odmowy.
export interface StorageRow {
  name: string;
  where: string;
  why: string;
  howLong: string;
}

export interface PrivacyContent {
  title: string;
  updated: string;
  intro: string;
  noTrackingTitle: string;
  noTracking: string;
  storageTitle: string;
  cols: [string, string, string, string];
  rows: StorageRow[];
  dataTitle: string;
  data: string[];
  rightsTitle: string;
  rights: string[];
  donationsTitle: string;
  donations: string[];
  donationsLink: string;
  contactTitle: string;
  contact: string;
  back: string;
}

const pl: PrivacyContent = {
  title: "Prywatność i dane",
  updated: "Ostatnia aktualizacja: 7 września 2026",
  intro:
    "Doplay nie ma kont, nie prosi o e-mail i nie zbiera danych do celów marketingowych. Poniżej dokładnie to, co aplikacja zapisuje na Twoim urządzeniu i po co.",
  noTrackingTitle: "Bez śledzenia",
  noTracking:
    "Nie używamy analityki, reklam, pikseli ani narzędzi profilujących. Nie przekazujemy niczego reklamodawcom. Dlatego nie ma tu banera „akceptuj ciasteczka” - nie ma czego odrzucić: wszystko poniżej jest albo niezbędne do działania gry, albo zapisywane dopiero wtedy, gdy sam coś ustawisz.",
  storageTitle: "Co jest zapisywane na Twoim urządzeniu",
  cols: ["Nazwa", "Gdzie", "Po co", "Jak długo"],
  rows: [
    { name: "domowka-locale", where: "Ciasteczko", why: "Zapamiętuje wybrany język (PL/EN). Zapisywane dopiero po kliknięciu przełącznika.", howLong: "12 miesięcy" },
    { name: "domowka-session", where: "localStorage", why: "Twój nick i awatar, żeby nie wpisywać ich za każdym razem, oraz kod pokoju, by wrócić do gry po odświeżeniu.", howLong: "Do wyczyszczenia przeglądarki" },
    { name: "vibration-enabled", where: "localStorage", why: "Czy telefon ma wibrować przy akcjach w grze.", howLong: "Do wyczyszczenia przeglądarki" },
    { name: "pwa-install-dismissed", where: "localStorage", why: "Żeby nie proponować instalacji aplikacji w kółko po odrzuceniu.", howLong: "30 dni" },
    { name: "Brudnopis rundy", where: "localStorage", why: "Odpowiedzi wpisywane w Państwach-miastach, żeby odświeżenie strony nie skasowało rundy.", howLong: "Do końca rundy" },
    { name: "Token logowania anonimowego", where: "Firebase (przeglądarka)", why: "Bez niego serwer nie wie, który gracz wykonuje ruch. Nie zawiera Twoich danych osobowych - to losowy identyfikator.", howLong: "Do wyczyszczenia przeglądarki" },
  ],
  dataTitle: "Jakie dane trafiają na serwer",
  data: [
    "Nick i awatar, które sam wybierasz. Nick może być dowolny - nie musi być Twoim imieniem.",
    "Anonimowy identyfikator nadany przez Firebase. Nie jest powiązany z żadnym kontem.",
    "Przebieg rozgrywki: wyniki, głosy, odpowiedzi - potrzebne, żeby gra działała u wszystkich naraz.",
    "Pokój i cała jego zawartość kasują się automatycznie po 8 godzinach od utworzenia.",
  ],
  rightsTitle: "Twoje prawa",
  rights: [
    "Możesz w każdej chwili wyczyścić dane witryny w ustawieniach przeglądarki - usunie to wszystko z tabeli powyżej.",
    "Możesz opuścić pokój, co usuwa Cię z listy graczy.",
    "Dane pokoju znikają same po 8 godzinach - nie trzeba o nic prosić.",
  ],
  donationsTitle: "Wsparcie i płatności",
  donations: [
    "Doplay nie przyjmuje płatności. Na stronie nie ma żadnego formularza płatniczego ani koszyka - odnośnik „Wesprzyj twórcę\" w stopce prowadzi do zewnętrznego serwisu buycoffee.to.",
    "Numery kart, dane bankowe i adresy rozliczeniowe nie trafiają do Doplay w żadnej formie. Obsługuje je wyłącznie buycoffee.to i to tam obowiązuje ich własna polityka prywatności.",
    "Samo kliknięcie odnośnika nie zapisuje niczego na Twoim urządzeniu. Nie ma przy nim piksela śledzącego ani przekierowania zliczającego.",
    "Jeśli zdecydujesz się wesprzeć, zobaczę tylko to, co pokaże mi buycoffee.to: nazwę podaną przy wpłacie i wiadomość, jeśli ją dopiszesz. Wpłatę można tam zostawić anonimowo.",
  ],
  donationsLink: "Polityka prywatności buycoffee.to",
  contactTitle: "Kontakt",
  contact: "Pytania o dane? Napisz do mnie przez GitHub.",
  back: "← Wróć do gry",
};

const en: PrivacyContent = {
  title: "Privacy and data",
  updated: "Last updated: 7 September 2026",
  intro:
    "Doplay has no accounts, never asks for your email, and collects nothing for marketing. Below is exactly what the app stores on your device and why.",
  noTrackingTitle: "No tracking",
  noTracking:
    "We use no analytics, no ads, no pixels and no profiling tools. Nothing is shared with advertisers. That's why there's no “accept cookies” banner here - there is nothing to reject: everything below is either required for the game to work, or saved only once you change a setting yourself.",
  storageTitle: "What is stored on your device",
  cols: ["Name", "Where", "Why", "How long"],
  rows: [
    { name: "domowka-locale", where: "Cookie", why: "Remembers the language you picked (PL/EN). Written only after you use the switcher.", howLong: "12 months" },
    { name: "domowka-session", where: "localStorage", why: "Your name and avatar so you don't retype them, plus the room code so you can return after a refresh.", howLong: "Until you clear your browser" },
    { name: "vibration-enabled", where: "localStorage", why: "Whether your phone vibrates on in-game actions.", howLong: "Until you clear your browser" },
    { name: "pwa-install-dismissed", where: "localStorage", why: "So the install prompt stops nagging once you dismiss it.", howLong: "30 days" },
    { name: "Round draft", where: "localStorage", why: "Answers you type in Categories, so refreshing the page doesn't lose the round.", howLong: "Until the round ends" },
    { name: "Anonymous sign-in token", where: "Firebase (browser)", why: "Without it the server can't tell which player made a move. It holds no personal data - it's a random identifier.", howLong: "Until you clear your browser" },
  ],
  dataTitle: "What reaches the server",
  data: [
    "The name and avatar you choose. The name can be anything - it doesn't have to be your real one.",
    "An anonymous identifier issued by Firebase. It isn't linked to any account.",
    "Gameplay: scores, votes, answers - needed so the game stays in sync for everyone.",
    "The room and everything in it is deleted automatically 8 hours after it was created.",
  ],
  rightsTitle: "Your rights",
  rights: [
    "You can clear site data in your browser settings at any time - that removes everything in the table above.",
    "You can leave a room, which removes you from the player list.",
    "Room data disappears on its own after 8 hours - you don't need to ask for anything.",
  ],
  donationsTitle: "Support and payments",
  donations: [
    "Doplay does not take payments. There is no payment form and no checkout on the site - the \"Support the creator\" link in the footer goes to buycoffee.to, a separate service.",
    "Card numbers, bank details and billing addresses never reach Doplay in any form. They are handled solely by buycoffee.to, under their own privacy policy.",
    "Clicking the link stores nothing on your device. There is no tracking pixel and no counting redirect behind it.",
    "If you do decide to support the project, all I see is what buycoffee.to shows me: the name given with the payment and your message, if you leave one. Payments there can be anonymous.",
  ],
  donationsLink: "buycoffee.to privacy policy",
  contactTitle: "Contact",
  contact: "Questions about data? Reach me on GitHub.",
  back: "← Back to the game",
};

export const PRIVACY: Record<Locale, PrivacyContent> = { pl, en };
