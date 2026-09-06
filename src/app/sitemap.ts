import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Mapa strony — tylko trasy, które mają sens w wynikach wyszukiwania.
//
// Pokoje (`/pokoj/[code]`, `/p/[code]`) są celowo pominięte: są ulotne i prywatne.
// Ekran offline też, bo to komunikat błędu, a nie treść.
export default function sitemap(): MetadataRoute.Sitemap {
  const teraz = new Date();
  return [
    { url: SITE_URL, lastModified: teraz, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/nowy`, lastModified: teraz, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/dolacz`, lastModified: teraz, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/publiczne`, lastModified: teraz, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/gry/stoper/trening`, lastModified: teraz, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/prywatnosc`, lastModified: teraz, changeFrequency: "yearly", priority: 0.3 },
  ];
}
