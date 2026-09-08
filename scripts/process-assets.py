#!/usr/bin/env python3
"""
process-assets.py — surowy plik z generatora → gotowy asset dla `public/assets/`.

Robi cztery rzeczy:
  1. zdejmuje jednolite tło (domyślnie #00FF00) z zachowaniem antyaliasingu na krawędzi,
  2. przycina do zawartości (bounding box) z zadanym marginesem,
  3. eksportuje @2x i @1x,
  4. zapisuje wszystko jako WebP — z alfą dla wycinanek, bez dla teł.

Tylko Pillow + NumPy. Żadnych zewnętrznych API, żadnego wysyłania obrazów na serwer.


JAK URUCHOMIĆ
-------------
Zależności (raz):

    python3 -m pip install --user Pillow numpy

Wrzuć pliki z Gemini do `assets/zrodla/` pod ID z `assets/ASSETS.md`
(np. `assets/zrodla/hero-ekipa.png`), potem z rootu repo:

    python3 scripts/process-assets.py --all          # wszystko z manifestu
    python3 scripts/process-assets.py --id hero-ekipa
    python3 scripts/process-assets.py --all --dry-run   # tylko wypisz, co by zrobił

Gdy tło wyszło w innym kolorze niż zielony albo krawędzie są brudne:

    python3 scripts/process-assets.py --id howto-kod --key '#FF00FF'
    python3 scripts/process-assets.py --id howto-kod --t-in 30 --t-out 110

`--t-in` to odległość od koloru klucza, poniżej której piksel jest NA PEWNO tłem,
`--t-out` — powyżej której jest NA PEWNO obiektem (skala 0–441, euklides w RGB).
Te dwa progi decydują tylko o TOPOLOGII: co jest tłem, a co obiektem.

Sama alfa na krawędzi liczy się inaczej — z nasycenia w kierunku klucza — i sterują
nią dwa pokrętła:

    --gain 1.6      # obwódka wciąż widoczna: podbij (twardsza krawędź)
    --rim 4         # zielony rąbek TUŻ PRZY konturze: czyść głębiej w obiekt
    --rim 0         # obiekt sam ma być w kolorze klucza aż do krawędzi — nie czyść

Jeśli po wycięciu zniknął fragment obiektu w kolorze klucza (miętowy ekran telefonu
przy zielonym tle), to znaczy, że NIE był domknięty konturem i rozlewanie weszło do
środka — podnieś `--t-in`, a jeśli to nie pomoże, wygeneruj obraz ponownie.

Zawsze obejrzyj wynik na ciemnym I jasnym tle, zanim uznasz go za gotowy:

    python3 scripts/process-assets.py --id hero-ekipa --preview


DLACZEGO NIE ZWYKŁY „USUŃ ZIELONY"
----------------------------------
Prosty próg po kolorze wycina też te fragmenty obiektu, które akurat są w kolorze
klucza (miętowy ekran telefonu przy zielonym tle). Dlatego usuwamy tylko tło
POŁĄCZONE Z KRAWĘDZIĄ obrazu — wnętrze obiektu jest odcięte konturem i zostaje
nietknięte, choćby miało dokładnie ten sam kolor.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("Brakuje zależności. Uruchom: python3 -m pip install --user Pillow numpy")


ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = ROOT / "assets" / "zrodla"
OUT_DIR = ROOT / "public" / "assets"

DEFAULT_KEY = "#00FF00"
DEFAULT_T_IN = 40.0    # < tego = na pewno tło
DEFAULT_T_OUT = 100.0  # > tego = na pewno obiekt
DEFAULT_RIM = 2        # ile px w głąb konturu czyścimy z koloru klucza
DEFAULT_GAIN = 1.25    # podbicie alfy na krawędzi — zwęża resztkową obwódkę
DEFAULT_MARGIN = 0.02  # 2% dłuższego boku


# --- manifest (musi zgadzać się z assets/ASSETS.md) ---------------------------

@dataclass(frozen=True)
class Asset:
    ident: str
    kind: str          # "cutout" (WebP + alfa) albo "background" (WebP, bez alfy)
    subdir: str
    width: int         # docelowa szerokość @2x
    height: int        # docelowa wysokość @2x
    key: str | None = None   # kolor tła TEGO pliku, gdy inny niż domyślny
    halo: bool = False       # zdjąć naklejkową otoczkę po wycięciu tła?


MANIFEST: tuple[Asset, ...] = (
    # Hero przyszedł z generatora na BIELI, mimo prośby o zieleń — stąd własny klucz.
    Asset("hero-ekipa", "cutout", "postacie", 1600, 900, key="#FFFFFF"),
    Asset("howto-pokoj", "cutout", "sceny", 640, 640),
    Asset("howto-kod", "cutout", "sceny", 640, 640),
    Asset("howto-gra", "cutout", "sceny", 640, 640),
    Asset("og-tlo", "background", "tla", 2400, 1350),
    Asset("ziomek-czeka", "cutout", "postacie", 720, 720),
    Asset("ziomek-zagubiony", "cutout", "postacie", 720, 720),
    Asset("ziomek-wygrana", "cutout", "postacie", 720, 720),
    # Kafelek „wkrótce" w sekcji gier. Styl bąbelkowego 3D jak ikony gier,
    # nie płaski jak postacie — stoi w siatce obok kart gier.
    Asset("wkrotce", "cutout", "ikony", 384, 384, halo=True),
    # Ikona gry „Kółko i krzyżyk". 384 px @2x wystarcza: docelowo idzie do
    # public/games/ w 192 px, tyle co pozostałe siedem ikon gier.
    Asset("kolko", "cutout", "ikony", 384, 384, halo=True),
    # Ikona gry „Chińczyk" — ten sam rozmiar i ten sam styl bąbelkowego 3D co „kolko".
    Asset("chinczyk", "cutout", "ikony", 384, 384, halo=True),
)


def hex_to_rgb(value: str) -> np.ndarray:
    s = value.strip().lstrip("#")
    if len(s) != 6:
        raise ValueError(f"Kolor ma być w formacie #RRGGBB, dostałem: {value!r}")
    return np.array([int(s[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


# --- wycinanie tła ------------------------------------------------------------

def _spread_along_rows(reach: np.ndarray, bg: np.ndarray) -> np.ndarray:
    """
    Jeden przebieg rozlewania w poziomie: w każdym wierszu spójny ciąg pikseli tła
    dziedziczy osiągalność, jeśli choć jeden jego piksel jest już osiągalny.

    Zamiast BFS piksel po pikselu (w Pythonie: minuty na obrazie 2000×2000) numerujemy
    ciągi przez cumsum i sprawdzamy trafienia jednym bincountem. Cały przebieg to kilka
    operacji wektorowych na całej tablicy.
    """
    h, w = bg.shape
    runs = np.cumsum(~bg, axis=1)                       # numer ciągu w obrębie wiersza
    ids = runs + np.arange(h, dtype=np.int64)[:, None] * (w + 1)
    n = int(h * (w + 1)) + 1
    seeds = ids[reach & bg]
    if seeds.size == 0:
        return np.zeros_like(bg)
    hit = np.bincount(seeds.ravel(), minlength=n) > 0
    return bg & hit[ids]


def flood_from_border(bg: np.ndarray) -> np.ndarray:
    """Piksele tła połączone z krawędzią obrazu (4-spójność)."""
    reach = np.zeros_like(bg)
    reach[0, :] |= bg[0, :]
    reach[-1, :] |= bg[-1, :]
    reach[:, 0] |= bg[:, 0]
    reach[:, -1] |= bg[:, -1]

    while True:
        before = int(reach.sum())
        reach |= _spread_along_rows(reach, bg)
        reach |= _spread_along_rows(reach.T.copy(), bg.T.copy()).T
        if int(reach.sum()) == before:
            return reach


def dilate(mask: np.ndarray, steps: int) -> np.ndarray:
    """Rozszerz maskę o `steps` pikseli (4-spójność). Kilka przesunięć tablicy, bez pętli po pikselach."""
    out = mask.copy()
    for _ in range(max(steps, 0)):
        grown = out.copy()
        grown[1:, :] |= out[:-1, :]
        grown[:-1, :] |= out[1:, :]
        grown[:, 1:] |= out[:, :-1]
        grown[:, :-1] |= out[:, 1:]
        out = grown
    return out


def strip_halo(rgba: np.ndarray, outline_lum: float = 70.0) -> np.ndarray:
    """
    Zdejmij naklejkową otoczkę, która została PO wycięciu tła.

    Generator lubi obrysować obiekt białym paskiem „jak naklejkę". Przy zielonym kluczu
    taki pasek przeżywa wycinanie, bo nie jest zielony — a pakiet ikon gier go nie ma
    i jedna ikona z otoczką wygląda jak z innego kompletu.

    NIE szukamy otoczki po kolorze. Próbowałem tak dwa razy i za każdym razem między
    przezroczystym tłem a białym paskiem stawał pas bieli podbarwionej kluczem, którego
    żaden próg nie łapał razem z bielą, nie wpuszczając jednocześnie rozlewania w obiekt.

    Zamiast tego korzystamy z tego, co te ikony mają z definicji: GRUBY CIEMNY KONTUR
    dookoła całej sylwetki. Zostawiamy dokładnie to, co ten kontur zamyka — wszystko
    poza nim leci. Kryterium jest odporne: przy progu jasności od 50 do 110 wynik jest
    identyczny, bo kontur jest szczelny.
    """
    rgb = rgba[..., :3].astype(np.float64)
    alpha = rgba[..., 3].astype(np.float64) / 255.0
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]

    kontur = (lum < outline_lum) & (alpha > 0.5)
    poza = flood_from_border(~kontur)

    out = rgba.copy()
    out[..., 3] = np.where(poza, 0, rgba[..., 3])

    # Kontur był wygładzany WZGLĘDEM białej otoczki, więc po jej zdjęciu zostałby po niej
    # jasny rąbek. Odwracamy to mieszanie na pikselach, które właśnie stały się brzegiem.
    rabek = dilate(poza, 2) & ~poza & (alpha > 0.02)
    biel = np.array([255.0, 255.0, 255.0])
    a = np.clip(out[..., 3].astype(np.float64) / 255.0, 1e-6, 1.0)[..., None]
    odwrocone = np.clip((rgb - (1.0 - a) * biel) / a, 0, 255)
    out[..., :3] = np.where(rabek[..., None], odwrocone.astype(np.uint8), out[..., :3])
    return out


def cut_background(
    img: Image.Image,
    key_hex: str,
    t_in: float,
    t_out: float,
    despill: bool = True,
    gain: float = 1.0,
    rim: int = 2,
) -> Image.Image:
    """RGB → RGBA z wyciętym tłem. Krawędź zostaje miękka (alfa częściowa)."""
    rgb = np.asarray(img.convert("RGB"), dtype=np.float64)
    key = hex_to_rgb(key_hex)

    dist = np.sqrt(((rgb - key) ** 2).sum(axis=2))

    # Kandydaci na tło: wszystko, co nie jest NA PEWNO obiektem. Piksele krawędziowe
    # (półprzezroczyste) też tu wpadają — i dobrze, bo to one dostaną alfę pośrednią.
    bg = dist < t_out
    outside = flood_from_border(bg)

    # Alfa liczona z NASYCENIA w kierunku klucza, nie z odległości od niego.
    # Odległość rośnie nieliniowo względem udziału tła: piksel pół na pół zielony
    # z ciemnym konturem leży już 124 jednostki od czystej zieleni, więc próg po
    # odległości uznałby go za w pełni nieprzezroczysty i zostawiłby połowę zieleni
    # na krawędzi. Rzut na oś barwy klucza jest w tym mieszaniu prawie liniowy.
    chroma_key = key - key.mean()
    denom = float((chroma_key ** 2).sum())

    if denom < 1.0:
        # Klucz bez barwy (biel, czerń, szarość) — nie ma osi, na którą można rzutować,
        # więc wracamy do rampy po odległości. Ten przypadek nie jest teoretyczny:
        # generator potrafi oddać scenę na bieli, mimo prośby o zieleń.
        achromatic = True
        score = 1.0 - np.clip((dist - t_in) / max(t_out - t_in, 1e-6), 0.0, 1.0)
    else:
        achromatic = False
        chroma_px = rgb - rgb.mean(axis=2, keepdims=True)
        score = np.clip((chroma_px * chroma_key).sum(axis=2) / denom, 0.0, 1.0)

    alpha = np.clip((1.0 - score) * gain, 0.0, 1.0)

    # Alfa częściowa ma prawo istnieć TYLKO w wąskim pasie antyaliasingu przy obiekcie.
    # Wszystko inne w tle jest tłem, niezależnie od odcienia — inaczej cień rzucony na
    # zieleń (u nas: elipsa pod skaczącymi postaciami, #0BBD1F) dostaje alfę 0,43
    # i zostaje na obrazku jako brudna plama widoczna dopiero na ciemnym tle aplikacji.
    near_object = dilate(~outside, rim + 1)
    alpha[outside & ~near_object] = 0.0

    # Kieszenie koloru klucza zamknięte wewnątrz obiektu (zieleń między ramionami
    # dwóch postaci) — rozlewanie od krawędzi tam nie wejdzie, a to nadal jest tło.
    # Warunek jest ciasny: `t_in` od CZYSTEGO klucza. Miętowe ekrany telefonów leżą
    # 214 jednostek od zieleni, więc ta reguła ich nie dotyka.
    #
    # NIGDY przy kluczu bez barwy. Reguła jest bezpieczna tylko dlatego, że kolor
    # klucza dobiera się tak, by nie występował w rysunku — a biel i czerń występują
    # w kreskówce wszędzie. Przy kluczu #FFFFFF wycięło to białka oczu wszystkim trzem
    # postaciom (147 tys. pikseli) i przez oczodoły było widać tło strony.
    alpha[~outside] = 1.0  # wnętrze obiektu jest nietykalne, choćby miało kolor klucza
    if not achromatic:
        alpha[(~outside) & (dist < t_in)] = 0.0

    # Głębokie wnętrze obiektu — tam nie wolno ruszać kolorów (miętowy ekran telefonu
    # przy zielonym kluczu musi zostać miętowy).
    interior_far = ~dilate(outside, rim)

    out = rgb.copy()
    if despill:
        # Piksel krawędziowy to mieszanka obiektu i tła: p = a*obiekt + (1-a)*klucz.
        # Odwracamy to równanie, inaczej wokół konturu zostaje zielona obwódka,
        # widoczna dopiero po położeniu obrazka na ciemnym tle.
        a = alpha[..., None]
        safe = a > 0.02
        out = np.where(safe, (rgb - (1.0 - a) * key) / np.maximum(a, 1e-6), rgb)

        # Resztka po odwróceniu: dominujący kanał klucza ściągnięty do poziomu
        # pozostałych. Pas czyszczenia to piksele tła przy krawędzi ORAZ cienki rąbek
        # już w środku obiektu — ten drugi jest konieczny, bo granica rozlewania wypada
        # w połowie ramki antyaliasingu i piksele tuż za nią mają alfę 1, ale wciąż
        # niosą kilkadziesiąt procent koloru klucza. Głębokie wnętrze zostaje nietknięte,
        # inaczej wypralibyśmy kolor z miętowego ekranu telefonu razem z obwódką.
        #
        # Przy kluczu bez barwy krok się nie stosuje: biel nie ma kanału dominującego,
        # a ściągnięcie czerwonego do poziomu pozostałych zafarbowałoby krawędź na cyjan.
        # Tam wystarcza samo odwrócenie mieszania wyżej.
        if not achromatic:
            edge = (dilate(outside, rim) & (alpha > 0.02)) & ~interior_far
            d = int(np.argmax(key))
            others = [i for i in range(3) if i != d]
            ceiling = np.maximum(out[..., others[0]], out[..., others[1]])
            out[..., d] = np.where(edge, np.minimum(out[..., d], ceiling), out[..., d])

    rgba = np.concatenate(
        [np.clip(out, 0, 255), (alpha * 255.0)[..., None]], axis=2
    ).astype(np.uint8)
    return Image.fromarray(rgba)


def trim_to_content(img: Image.Image, margin: float) -> Image.Image:
    """Przytnij do zawartości + margines. Bez marginesu antyaliasing łapie krawędź kadru."""
    alpha = np.asarray(img)[..., 3]
    ys, xs = np.where(alpha > 8)
    if ys.size == 0:
        raise ValueError("Po wycięciu tła nie zostało nic — sprawdź --key albo progi")

    pad = int(round(max(img.width, img.height) * margin))
    x0 = max(int(xs.min()) - pad, 0)
    y0 = max(int(ys.min()) - pad, 0)
    x1 = min(int(xs.max()) + 1 + pad, img.width)
    y1 = min(int(ys.max()) + 1 + pad, img.height)
    return img.crop((x0, y0, x1, y1))


# --- skalowanie i zapis -------------------------------------------------------

def fit_inside(img: Image.Image, w: int, h: int) -> Image.Image:
    """Zmieść w ramce w:h bez deformacji i bez powiększania ponad oryginał."""
    scale = min(w / img.width, h / img.height, 1.0)
    size = (max(round(img.width * scale), 1), max(round(img.height * scale), 1))
    return img.resize(size, Image.LANCZOS)


def cover_crop(img: Image.Image, w: int, h: int) -> Image.Image:
    """Wypełnij ramkę w:h, nadmiar przytnij symetrycznie (dla teł — mają iść pod krawędź)."""
    scale = max(w / img.width, h / img.height)
    resized = img.resize(
        (max(round(img.width * scale), 1), max(round(img.height * scale), 1)), Image.LANCZOS
    )
    left = (resized.width - w) // 2
    top = (resized.height - h) // 2
    return resized.crop((left, top, left + w, top + h))


def save_preview(img: Image.Image, path: Path) -> None:
    """Ten sam obrazek na ciemnym i jasnym tle — zielona obwódka widać tylko na jednym."""
    w, h = img.size
    strip = Image.new("RGB", (w * 2, h), (20, 10, 36))
    strip.paste(Image.new("RGB", (w, h), (245, 243, 255)), (w, 0))
    strip.paste(img, (0, 0), img)
    strip.paste(img, (w, 0), img)
    strip.save(path)


def process(asset: Asset, args: argparse.Namespace) -> None:
    src = None
    for ext in (".png", ".webp", ".jpg", ".jpeg"):
        candidate = SRC_DIR / f"{asset.ident}{ext}"
        if candidate.exists():
            src = candidate
            break
    if src is None:
        print(f"  POMIJAM {asset.ident} — brak pliku w {SRC_DIR.relative_to(ROOT)}/")
        return

    dest_dir = OUT_DIR / asset.subdir
    img = Image.open(src)

    if asset.kind == "background":
        out = cover_crop(img.convert("RGB"), asset.width, asset.height)
        target = dest_dir / f"{asset.ident}.webp"
        half = dest_dir / f"{asset.ident}@1x.webp"
        if args.dry_run:
            print(f"  {asset.ident}: {src.name} {img.size} → {target.relative_to(ROOT)} {out.size}")
            return
        dest_dir.mkdir(parents=True, exist_ok=True)
        out.save(target, "WEBP", quality=86, method=6)
        out.resize((asset.width // 2, asset.height // 2), Image.LANCZOS).save(
            half, "WEBP", quality=86, method=6
        )
        print(f"  {asset.ident}: {target.relative_to(ROOT)} ({target.stat().st_size // 1024} kB)")
        return

    # Klucz z manifestu ma pierwszeństwo, chyba że użytkownik podał --key jawnie.
    key = args.key if args.key != DEFAULT_KEY else (asset.key or DEFAULT_KEY)
    cut = cut_background(
        img, key, args.t_in, args.t_out,
        despill=not args.no_despill, gain=args.gain, rim=args.rim
    )
    halo = args.halo or asset.halo
    if halo:
        cut = Image.fromarray(strip_halo(np.asarray(cut.convert("RGBA"))))
    cut = trim_to_content(cut, args.margin)
    big = fit_inside(cut, asset.width, asset.height)
    small = big.resize((max(big.width // 2, 1), max(big.height // 2, 1)), Image.LANCZOS)

    # WebP, nie PNG. Zmierzone na tym zestawie: siedem wycinanek to 3442 kB w PNG
    # i 357 kB w WebP q82, przy braku widocznej różnicy — płaska kreskówka z twardym
    # konturem nie ma czego stracić. Reszta strony (awatary, ikony gier) też jest WebP.
    p2 = dest_dir / f"{asset.ident}@2x.webp"
    p1 = dest_dir / f"{asset.ident}@1x.webp"
    if args.dry_run:
        print(f"  {asset.ident}: {src.name} {img.size} → {p2.relative_to(ROOT)} {big.size}")
        return

    dest_dir.mkdir(parents=True, exist_ok=True)
    big.save(p2, "WEBP", quality=args.quality, method=6)
    small.save(p1, "WEBP", quality=args.quality, method=6)
    note = f"@2x {p2.stat().st_size // 1024} kB, @1x {p1.stat().st_size // 1024} kB"

    if args.png:
        # Bezstratny master — tylko na życzenie, do repo nie idzie.
        big.save(dest_dir / f"{asset.ident}@2x.png", "PNG", optimize=True)
        note += " (+ png)"

    if args.preview:
        prev = SRC_DIR / f"{asset.ident}.podglad.png"
        save_preview(fit_inside(cut, 500, 500), prev)
        note += f" · podgląd: {prev.relative_to(ROOT)}"

    print(f"  {asset.ident}: klucz {key} → {p2.relative_to(ROOT)} {big.size} ({note})")


def main() -> int:
    ap = argparse.ArgumentParser(description="Przygotowanie assetów Domówki")
    ap.add_argument("--all", action="store_true", help="przetwórz wszystko z manifestu")
    ap.add_argument("--id", action="append", default=[], help="konkretne ID (można powtórzyć)")
    ap.add_argument("--key", default=DEFAULT_KEY, help=f"kolor tła do wycięcia (domyślnie {DEFAULT_KEY})")
    ap.add_argument("--t-in", type=float, default=DEFAULT_T_IN, dest="t_in")
    ap.add_argument("--t-out", type=float, default=DEFAULT_T_OUT, dest="t_out")
    ap.add_argument("--margin", type=float, default=DEFAULT_MARGIN, help="margines po przycięciu, ułamek dłuższego boku")
    ap.add_argument("--gain", type=float, default=DEFAULT_GAIN, help="podbicie alfy na krawędzi; >1 zwęża obwódkę, <1 ją zmiękcza")
    ap.add_argument("--halo", action="store_true", help="zdejmij naklejkową otoczkę (zostaw tylko to, co zamyka ciemny kontur)")
    ap.add_argument("--rim", type=int, default=DEFAULT_RIM, help="ile pikseli w głąb obiektu czyścić z koloru klucza (0 = wyłącz)")
    ap.add_argument("--no-despill", action="store_true", help="nie odejmuj koloru klucza z krawędzi")
    ap.add_argument("--quality", type=int, default=82, help="jakość WebP (domyślnie 82)")
    ap.add_argument("--png", action="store_true", help="zapisz dodatkowo bezstratny master PNG")
    ap.add_argument("--preview", action="store_true", help="zapisz podgląd na ciemnym i jasnym tle")
    ap.add_argument("--dry-run", action="store_true", help="tylko wypisz, nic nie zapisuj")
    args = ap.parse_args()

    if not args.all and not args.id:
        ap.error("podaj --all albo --id <ID>")
    if args.t_in >= args.t_out:
        ap.error("--t-in musi być mniejsze od --t-out")

    known = {a.ident: a for a in MANIFEST}
    for unknown in [i for i in args.id if i not in known]:
        ap.error(f"nieznane ID: {unknown}. Dostępne: {', '.join(known)}")

    todo = list(MANIFEST) if args.all else [known[i] for i in args.id]
    if not SRC_DIR.exists():
        print(f"Brak katalogu {SRC_DIR.relative_to(ROOT)}/ — wrzuć tam pliki z generatora.")
        return 1

    print(f"Przetwarzam {len(todo)} pozycji (klucz {args.key}, progi {args.t_in}/{args.t_out}):")
    failed = 0
    for asset in todo:
        try:
            process(asset, args)
        except Exception as exc:  # noqa: BLE001 — chcemy przejść resztę listy
            failed += 1
            print(f"  BŁĄD {asset.ident}: {exc}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
