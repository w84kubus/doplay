"""Kafelek gry z obrazka Gemini: usuwa wrysowaną kratkę, przycina, skaluje do 192x192 WebP.

    python3 scripts/kafelek.py ~/Downloads/statki.jpeg public/games/statki.webp

Po wstawieniu pliku trzeba jeszcze dopisać id gry do `ILLUSTRATED`
w `src/components/GameIcon.tsx` — bez tego kafelek leży w repo i nikt go nie widzi.

Kratka przezroczystości jest tu NAMALOWANA (plik jest JPEG-iem, alfy nie ma), więc trzeba
ją usunąć samemu. Nie da się tego zrobić progiem na biel: biel występuje też w rysunku
(biały pionek Statków, prześwity w otworach Czwórek). Dlatego tło bierzemy WYPEŁNIENIEM
OD KRAWĘDZI - liczy się nie kolor, lecz to, czy piksel łączy się z brzegiem obrazka.
"""
import sys
from collections import deque

import numpy as np
from PIL import Image

ROZMIAR = 192          # tyle mają pozostałe kafelki w public/games
MARGINES = 0.03        # zapas wokół rysunku, ułamek boku
JASNE = 190            # od tylu w każdym kanale piksel może być kratką
SZARE = 28             # maksymalna różnica między kanałami (kratka jest bezbarwna)
OTULINA = 3            # ile pikseli tła zjeść dodatkowo - zjada halo po JPEG-u


def maska_tla(rgb: np.ndarray) -> np.ndarray:
    jasne = rgb.min(axis=2) >= JASNE
    bezbarwne = (rgb.max(axis=2).astype(int) - rgb.min(axis=2).astype(int)) <= SZARE
    kandydat = jasne & bezbarwne

    h, w = kandydat.shape
    tlo = np.zeros((h, w), dtype=bool)
    kolejka = deque()
    for x in range(w):
        for y in (0, h - 1):
            if kandydat[y, x] and not tlo[y, x]:
                tlo[y, x] = True
                kolejka.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if kandydat[y, x] and not tlo[y, x]:
                tlo[y, x] = True
                kolejka.append((y, x))

    while kolejka:
        y, x = kolejka.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and kandydat[ny, nx] and not tlo[ny, nx]:
                tlo[ny, nx] = True
                kolejka.append((ny, nx))
    return tlo


def rozszerz(maska: np.ndarray, ile: int) -> np.ndarray:
    """Rozlewa maskę o `ile` pikseli. JPEG zostawia wokół rysunku jasną obwódkę,
    która bez tego zostaje jako brudna ramka widoczna na ciemnym tle aplikacji."""
    wynik = maska.copy()
    for _ in range(ile):
        p = np.zeros_like(wynik)
        p[1:, :] |= wynik[:-1, :]
        p[:-1, :] |= wynik[1:, :]
        p[:, 1:] |= wynik[:, :-1]
        p[:, :-1] |= wynik[:, 1:]
        wynik |= p
    return wynik


def zrob(zrodlo: str, cel: str) -> None:
    obraz = Image.open(zrodlo).convert("RGB")
    rgb = np.array(obraz)
    tlo = rozszerz(maska_tla(rgb), OTULINA)

    alfa = np.where(tlo, 0, 255).astype(np.uint8)
    rgba = np.dstack([rgb, alfa])
    wynik = Image.fromarray(rgba)

    # Przycięcie do rysunku, żeby kafelek nie miał przypadkowego zapasu z jednej strony.
    ramka = wynik.getbbox()
    if ramka:
        wynik = wynik.crop(ramka)

    bok = max(wynik.size)
    plotno = round(bok * (1 + 2 * MARGINES))
    kwadrat = Image.new("RGBA", (plotno, plotno), (0, 0, 0, 0))
    kwadrat.paste(wynik, ((plotno - wynik.width) // 2, (plotno - wynik.height) // 2))
    kwadrat = kwadrat.resize((ROZMIAR, ROZMIAR), Image.LANCZOS)
    kwadrat.save(cel, "WEBP", quality=92, method=6)

    krycie = np.array(kwadrat)[:, :, 3]
    print(f"{cel}: {kwadrat.size[0]}x{kwadrat.size[1]}, "
          f"przezroczyste {round((krycie == 0).mean() * 100)}%, "
          f"rysunek {round((krycie > 200).mean() * 100)}%")


if __name__ == "__main__":
    zrob(sys.argv[1], sys.argv[2])
