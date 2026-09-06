// Awatary graczy (SPEC §4). Wartości to stabilne identyfikatory, nie emoji —
// wygląd (ikona Lucide + kolor kafelka) żyje w src/components/AvatarIcon.tsx.
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

// Awatary wycofane. Gracze siedzący w pokojach mają je zapisane w Firestore —
// akceptujemy je przy walidacji, żeby nikogo nie wyrzucić w trakcie gry. Nie ma ich
// w AVATARS, więc nie da się ich wybrać na nowo, a AvatarIcon pokazuje dla nich
// zapasową ikonę zamiast pustego miejsca.
//
// Skasowanie wpisu stąd nie jest kosmetyką: gracz z takim awatarem dostałby przy
// powrocie do pokoju błąd „Nieznany awatar" i nie wróciłby do własnej partii.
const LEGACY_AVATARS = [
  // druga generacja pakietu (ETAP 11) — przedmioty bez twarzy zastąpione postaciami
  "shell", "feather", "egg", "paw", "guitar", "rocket", "flame",
  "gamepad", "crown", "diamond", "anchor", "bike", "zap",
  // ostatnie dwa przedmioty; po nich pakiet to same postacie z twarzą
  "pizza", "beer",
  // emoji sprzed przejścia na pakiet ikon
  "🦊", "🐼", "🐧", "🦁", "🐸", "🐙", "🦄", "🐝", "🦉", "🐬",
  "🐢", "🦖", "🦩", "🐯", "🐨", "🐰", "🦇", "🦈", "🐳", "🦭",
  "🍕", "🍺", "🎸", "🚀", "👽", "🤖", "👾", "🎃", "💀", "🔥",
];

export function isValidAvatar(a: string): boolean {
  return (AVATARS as readonly string[]).includes(a) || LEGACY_AVATARS.includes(a);
}
