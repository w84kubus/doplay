#!/usr/bin/env python3
"""
Tnie arkusz ikon z generatora na osobne pliki PNG z przezroczystością.

Gemini oddaje kilka ikon na jednym obrazku, a „przezroczyste tło" bywa
szachownicą WMALOWANĄ w piksele, bo plik wychodzi jako JPEG. Ten skrypt
rozpoznaje takie tło, wycina je i rozdziela ikony na pliki o zadanych nazwach.

Użycie:
    python3 scripts/tnij-arkusz.py ARKUSZ.jpg nazwa1,nazwa2,...  [--tlo szachownica|jasne]

Nazwy podaje się w kolejności czytania (rzędami, od lewej). Myślnik `-`
oznacza blok do pominięcia — generator lubi dorzucić duplikat albo bonus.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# process-assets.py ma myślnik w nazwie, więc nie da się go zaimportować zwykłym
# `import`. Ładujemy po ścieżce i REJESTRUJEMY w sys.modules jeszcze przed wykonaniem:
# bez tego dataclass w środku nie znajduje własnego modułu i wywala się na 3.9.
import importlib.util

_spec = importlib.util.spec_from_file_location(
    "process_assets", Path(__file__).parent / "process-assets.py"
)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["process_assets"] = _mod
_spec.loader.exec_module(_mod)
flood_from_border = _mod.flood_from_border
dilate = _mod.dilate

WYJSCIE = Path("emoji-pack")
MARGINES = 0.06   # ile pustego zostawić wokół ikony, ułamek jej większego boku
ZJEDZ = 3         # ile pikseli tła zjeść do środka, żeby zdjąć obwódkę po JPEG


def maska_tla(rgb: np.ndarray, tryb: str) -> np.ndarray:
    """Piksele wyglądające na tło. Sama maska nie wystarcza — liczy się spójność z krawędzią."""
    if tryb == "szachownica":
        # Biel i jasna szarość szachownicy: prawie bez nasycenia i jasne.
        rozpietosc = rgb.max(axis=2) - rgb.min(axis=2)
        return (rozpietosc < 26) & (rgb.min(axis=2) > 168)
    # „jasne": jednolite jasne tło, mierzone względem koloru z rogów obrazu
    rogi = np.stack([rgb[0, 0], rgb[0, -1], rgb[-1, 0], rgb[-1, -1]])
    odniesienie = rogi.mean(axis=0)
    return np.sqrt(((rgb - odniesienie) ** 2).sum(axis=2)) < 46


def pasma(maska_1d: np.ndarray, min_dlugosc: int) -> list[tuple[int, int]]:
    """Ciągłe odcinki wartości True, krótsze niż próg pomijamy (śmieci po kompresji)."""
    d = np.diff(np.concatenate(([0], maska_1d.astype(np.int8), [0])))
    pary = list(zip(np.where(d == 1)[0], np.where(d == -1)[0]))
    return [(a, b) for a, b in pary if b - a >= min_dlugosc]


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    plik = Path(sys.argv[1])
    nazwy = sys.argv[2].split(",")
    tryb = "szachownica"
    if "--tlo" in sys.argv:
        tryb = sys.argv[sys.argv.index("--tlo") + 1]

    img = Image.open(plik).convert("RGB")
    rgb = np.asarray(img, dtype=np.int16)

    poza = flood_from_border(maska_tla(rgb, tryb))
    przod = ~dilate(poza, ZJEDZ)

    rgba = np.dstack([np.asarray(img, dtype=np.uint8), (przod * 255).astype(np.uint8)])
    pelny = Image.fromarray(rgba)  # tryb wynika z 4 kanałów; parametr `mode` jest przestarzały

    # Podział na ikony: najpierw pasma poziome (rzędy), potem pionowe w każdym rzędzie.
    prog = max(img.size) // 40
    WYJSCIE.mkdir(exist_ok=True)
    bloki: list[tuple[int, int, int, int]] = []
    for y0, y1 in pasma(przod.any(axis=1), prog):
        wycinek = przod[y0:y1]
        for x0, x1 in pasma(wycinek.any(axis=0), prog):
            bloki.append((x0, y0, x1, y1))

    if len(bloki) != len(nazwy):
        print(f"UWAGA: znaleziono {len(bloki)} bloków, a podano {len(nazwy)} nazw.")
        for i, (x0, y0, x1, y1) in enumerate(bloki):
            print(f"  blok {i}: x {x0}-{x1}, y {y0}-{y1}")
        sys.exit(2)

    for (x0, y0, x1, y1), nazwa in zip(bloki, nazwy):
        if nazwa == "-":
            print(f"  pomijam blok x {x0}-{x1}, y {y0}-{y1}")
            continue
        kadr = pelny.crop((x0, y0, x1, y1))
        # Przytnij dokładnie do zawartości, potem dołóż równy margines ze wszystkich stron.
        kadr = kadr.crop(kadr.getbbox())
        m = int(max(kadr.size) * MARGINES)
        bok = max(kadr.size) + 2 * m
        plansza = Image.new("RGBA", (bok, bok), (0, 0, 0, 0))
        plansza.paste(kadr, ((bok - kadr.size[0]) // 2, (bok - kadr.size[1]) // 2))
        plansza.save(WYJSCIE / f"{nazwa}.png")
        print(f"  {nazwa}.png  {plansza.size[0]}x{plansza.size[1]}")


if __name__ == "__main__":
    main()
