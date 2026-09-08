import Image from "next/image";
import { gameIcon } from "@/games/icons";

// Gry z własną ilustracją w public/games/. Gra spoza tej listy dostaje ikonę Lucide,
// więc dodanie nowej gry nadal nie wymaga zmian tutaj (CLAUDE.md, zasada 4).
const ILLUSTRATED = new Set([
  "stoper",
  "panstwa-miasta",
  "wisielec",
  "impostor",
  "mafia",
  "odcien",
  "kasyno",
  "kolko",
  "chinczyk",
]);

export function GameIcon({
  gameId,
  size = 26,
  color,
  className,
}: {
  gameId: string;
  size?: number;
  /** Kolor ikony zapasowej (Lucide). Ilustracje mają własne kolory. */
  color?: string;
  className?: string;
}) {
  if (ILLUSTRATED.has(gameId)) {
    return (
      <Image
        src={`/games/${gameId}.webp`}
        alt=""
        width={size}
        height={size}
        // Rozmiar w rem, nie w px: atrybuty width/height nie skalują się z bazowym
        // rozmiarem czcionki, więc na desktopie ikona zostawała mała mimo powiększenia UI.
        style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
        className={`inline-block shrink-0 align-[-0.18em] ${className ?? ""}`}
        aria-hidden
        unoptimized
      />
    );
  }
  const Icon = gameIcon(gameId);
  return (
    <Icon
      size={size}
      strokeWidth={2.5}
      style={color ? { color } : undefined}
      className={`inline-block shrink-0 align-[-0.18em] ${className ?? ""}`}
      aria-hidden
    />
  );
}
