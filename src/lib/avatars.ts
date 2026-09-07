// Awatary graczy (SPEC §4). Wartości to stabilne identyfikatory, nie emoji —
// wygląd (ilustracja + kolor kafelka) żyje w src/components/AvatarIcon.tsx.
//
// Wszystkie trzydzieści to postacie z twarzą. To nie jest kaprys estetyczny:
// awatar odpowiada na pytanie „kim jestem przy tym stole", a na to nie da się
// odpowiedzieć kotwicą ani jajkiem. Przy dokładaniu nowego trzymaj tę zasadę.
export const AVATARS = [
  // ssaki
  "cat", "dog", "rabbit", "panda", "squirrel", "rat", "lion", "tiger", "giraffe", "sloth",
  // ptaki, owady, nietoperz
  "bird", "owl", "penguin", "bee", "bug", "bat",
  // wodne i pełzające
  "fish", "shark", "turtle", "frog", "octopus", "jellyfish", "crab", "snail", "worm",
  // postacie baśniowe i nie-zwierzęce
  "unicorn", "dragon", "ghost", "bot", "skull",
] as const;

export const DEFAULT_AVATAR: string = AVATARS[0];

/**
 * Czy identyfikator awatara jest jednym z obsługiwanych.
 *
 * Nie ma tu już listy wycofanych. Poprzednie pokolenia awatarów (emoji sprzed
 * przejścia na pakiet ikon i przedmioty bez twarzy) były tu akceptowane, żeby nie
 * wyrzucić gracza, który ma je zapisane w otwartym pokoju. Lista zniknęła po
 * sprawdzeniu, że w żadnym żywym pokoju nikt takiego awatara nie ma.
 *
 * Jeśli kiedyś znów będziesz wycofywać awatar, zrób to samo: sprawdź bazę PRZED
 * usunięciem. Gracz z nieobsługiwanym awatarem dostaje z `/join` błąd „Nieznany
 * awatar" i nie wraca do własnej partii, dopóki nie wybierze nowego.
 */
export function isValidAvatar(a: string): boolean {
  return (AVATARS as readonly string[]).includes(a);
}
