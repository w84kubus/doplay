import Image from "next/image";
import { PawPrint } from "lucide-react";
import { AVATARS } from "@/lib/avatars";

// Wygląd awatara: ilustracja z pakietu (public/avatars/{id}.webp) + kolor kafelka.
// Trzymane osobno od src/lib/avatars.ts — tam lista domenowa, tu warstwa prezentacji.
const COLOR: Record<string, string> = {
  cat: "#E8833A", dog: "#8B6F47", bird: "#3FA9D9", rabbit: "#C9A9A0", panda: "#5B6B7A",
  squirrel: "#B5713C", fish: "#3E86BF", turtle: "#5FA35A", bug: "#C4453C", rat: "#7D8A94",
  snail: "#A8894F", worm: "#D98CA0", pizza: "#D4762E", beer: "#D9A32B",
  bot: "#6E8CA0", ghost: "#8E8BC7", skull: "#8A8F99",
  // Druga generacja. Kolory dobrane tak, żeby rozjechać się z sąsiadem o podobnej
  // ilustracji: sowa jest ciemniejsza od psa, rekin od rybki, meduza od robaczka.
  // Przy 40 px to kafelek, a nie kształt, decyduje o rozróżnieniu.
  frog: "#5FA33C", bee: "#D9A81F", penguin: "#3D4A5C", lion: "#D98E2B",
  octopus: "#C43D7E", unicorn: "#B98FD6", dragon: "#2C8A62", owl: "#B0762F",
  bat: "#453F55", shark: "#3E6B96", jellyfish: "#B25FA0", sloth: "#A8906B",
  crab: "#CC5335",
};

const KNOWN = new Set<string>(AVATARS);

/** Kolor kafelka pod awatarem. Nieznana wartość dostaje neutralną szarość. */
export function avatarColor(avatar: string): string {
  return COLOR[avatar] ?? "#7D8A94";
}

/**
 * Awatar jako ilustracja. `size` w px — obrazek jest kwadratowy.
 * Awatary sprzed przejścia na pakiet (emoji zapisane w Firestore) nie mają pliku,
 * więc dostają zapasową ikonę zamiast pustego miejsca albo błędu 404.
 */
export function AvatarIcon({
  avatar,
  size = 24,
  className,
}: {
  avatar: string;
  size?: number;
  className?: string;
}) {
  if (!KNOWN.has(avatar)) {
    return (
      <PawPrint
        size={size}
        strokeWidth={2.5}
        className={`inline-block shrink-0 align-[-0.18em] ${className ?? ""}`}
        aria-hidden
      />
    );
  }
  return (
    <Image
      src={`/avatars/${avatar}.webp`}
      alt=""
      width={size}
      height={size}
      // Rozmiar w rem, nie w px: atrybuty width/height nie skalują się z bazowym
      // rozmiarem czcionki, więc na desktopie awatar zostawał mały mimo powiększenia UI.
      style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }}
      className={`inline-block shrink-0 align-[-0.18em] ${className ?? ""}`}
      aria-hidden
      unoptimized
    />
  );
}
