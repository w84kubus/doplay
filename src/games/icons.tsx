import {
  Grid3x3, Coins, Dices, Gamepad2, Palette, PenLine, Skull, Swords, Timer, VenetianMask, type LucideIcon } from "lucide-react";

// Ikony gier (Lucide, ISC). Trzymane osobno od manifestów, bo manifest jest czystymi
// danymi i importuje go też serwer — komponent Reacta nie ma tam czego szukać.
//
// UWAGA: to mapa OPCJONALNA. Gra bez wpisu dostaje ikonę zapasową i działa normalnie,
// więc reguła 4 z CLAUDE.md („dodanie gry = zero zmian w rdzeniu") zostaje spełniona.
const ICONS: Record<string, LucideIcon> = {
  stoper: Timer,
  "panstwa-miasta": PenLine,
  wisielec: Skull,
  impostor: VenetianMask,
  mafia: Swords,
  odcien: Palette,
  kasyno: Coins,
  kolko: Grid3x3,
  chinczyk: Dices,
};

export function gameIcon(gameId: string): LucideIcon {
  return ICONS[gameId] ?? Gamepad2;
}
