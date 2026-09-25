"""Obrazek do posta: logo, hasło, wszystkie kafelki gier i dwa telefony z prawdziwą grą.

    python3 scripts/zaproszenie.py     # -> docs/screenshots/zaproszenie.jpg

Wymaga fontu Baloo 2 w /tmp/baloo2.ttf (ten sam, którego używa strona):
    curl -sL -o /tmp/baloo2.ttf "https://github.com/google/fonts/raw/main/ofl/baloo2/Baloo2%5Bwght%5D.ttf"

Zrzuty telefonów bierze z `.playwright-mcp/`, więc po zmianach w wyglądzie trzeba je
najpierw zrobić od nowa — inaczej obrazek pokaże starą wersję interfejsu.

Format 1200x630, czyli proporcja, której Facebook używa w kanale i w podglądzie linku.
Tło, fonty i barwy te same co w aplikacji, żeby obrazek i strona wyglądały jak jedno.
"""
import math
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = [(0x4B, 0x1F, 0xA8), (0x7A, 0x2C, 0xC0), (0xC0, 0x39, 0x8F)]
LIMONKA = (0xCC, 0xFF, 0x00)
BIEL = (255, 255, 255)
STROKE = (0x2A, 0x17, 0x58)
G = "/Users/jakub/domowka"

def font(rozmiar: int, waga: int = 700) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype("/tmp/baloo2.ttf", rozmiar)
    try:
        f.set_variation_by_axes([waga])
    except Exception:
        pass
    return f

# --- tło: ten sam gradient 135 stopni co `.arcade-bg`, plus rastrowa tekstura ---
plotno = Image.new("RGB", (W, H))
rys = ImageDraw.Draw(plotno)
for x in range(W):
    for_y = x / (W - 1)
    if for_y < 0.45:
        u = for_y / 0.45
        c = tuple(int(BG[0][i] + (BG[1][i] - BG[0][i]) * u) for i in range(3))
    else:
        u = (for_y - 0.45) / 0.55
        c = tuple(int(BG[1][i] + (BG[2][i] - BG[1][i]) * u) for i in range(3))
    rys.line([(x, 0), (x, H)], fill=c)

kropki = Image.new("RGBA", (W, H), (0, 0, 0, 0))
rk = ImageDraw.Draw(kropki)
for y in range(0, H, 6):
    for x in range(0, W, 6):
        rk.ellipse([x, y, x + 1, y + 1], fill=(255, 255, 255, 18))
plotno = Image.alpha_composite(plotno.convert("RGBA"), kropki)
rys = ImageDraw.Draw(plotno)

# --- logo ---
logo = Image.open(f"{G}/public/logo-doplay.webp").convert("RGBA")
logo = logo.resize((380, round(380 * logo.height / logo.width)), Image.LANCZOS)
plotno.paste(logo, (62, 44), logo)

# --- hasło ---
y = 44 + logo.height + 14
rys.text((66, y), "Gry imprezowe w przeglądarce.", font=font(38), fill=BIEL)
rys.text((66, y + 46), "Każdy na swoim telefonie.", font=font(38), fill=BIEL)

# --- kafelki wszystkich gier, dwa rzędy ---
gry = ["stoper", "panstwa-miasta", "wisielec", "impostor", "mafia", "odcien",
       "kasyno", "kolko", "chinczyk", "czworki", "statki"]
bok, odstep = 62, 10
y_kafelki = y + 116
for i, gra in enumerate(gry):
    rzad, kol = divmod(i, 6)
    kafel = Image.open(f"{G}/public/games/{gra}.webp").convert("RGBA")
    kafel = kafel.resize((bok, bok), Image.LANCZOS)
    plotno.paste(kafel, (66 + kol * (bok + odstep), y_kafelki + rzad * (bok + odstep)), kafel)

# --- adres w „pigułce" ---
adres, f_adres = "doplay.pl", font(46)
sz = rys.textbbox((0, 0), adres, font=f_adres)
pw, ph = sz[2] - sz[0] + 56, sz[3] - sz[1] + 36
py = y_kafelki + 2 * (bok + odstep) + 18
rys.rounded_rectangle([66, py, 66 + pw, py + ph], 18, fill=LIMONKA)
rys.text((66 + 28, py + 14 - sz[1]), adres, font=f_adres, fill=STROKE)

# --- telefony z prawdziwą rozgrywką ---
def telefon(sciezka: str, wysokosc: int, kat: float) -> Image.Image:
    im = Image.open(sciezka).convert("RGBA")
    im = im.resize((round(im.width * wysokosc / im.height), wysokosc), Image.LANCZOS)
    ramka = Image.new("RGBA", (im.width + 12, im.height + 12), (0, 0, 0, 0))
    ImageDraw.Draw(ramka).rounded_rectangle([0, 0, ramka.width - 1, ramka.height - 1], 30, fill=STROKE + (255,))
    maska = Image.new("L", im.size, 0)
    ImageDraw.Draw(maska).rounded_rectangle([0, 0, im.width - 1, im.height - 1], 24, fill=255)
    ramka.paste(im, (6, 6), maska)
    return ramka.rotate(kat, resample=Image.BICUBIC, expand=True)

tyl = telefon(f"{G}/.playwright-mcp/pl-4-czworki.png", 470, -7)
przod = telefon(f"{G}/.playwright-mcp/pl-statki-gra.png", 510, 5)
plotno.paste(tyl, (700, 60), tyl)
plotno.paste(przod, (890, 78), przod)

plotno.convert("RGB").save(f"{G}/docs/screenshots/zaproszenie.jpg", "JPEG", quality=90, optimize=True)
print("zapisane: docs/screenshots/zaproszenie.jpg", plotno.size)
