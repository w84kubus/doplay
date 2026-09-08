# PROMPTS.md — gotowe prompty do Gemini (nano banana)

Każdy blok wklejasz **w całości**, bez zmian. ID nagłówka = nazwa pliku, pod jaką
zapisujesz wynik w `assets/zrodla/` (np. `assets/zrodla/hero-ekipa.png`).

---

## ⚠️ Kolejność ma znaczenie — czytaj przed pierwszym promptem

Siedem z ośmiu obrazów przedstawia **te same trzy postacie**. Model nie pamięta ich
między rozmowami, więc trzeba mu je pokazywać.

1. Wygeneruj **najpierw `hero-ekipa`**. To wzorzec całego zestawu — jeśli postacie
   nie wyjdą, generuj ponownie **ten** obraz, zanim ruszysz dalej.
2. Do **każdego kolejnego promptu załącz `hero-ekipa.png`** i dopisz na początku
   wiadomości jedno zdanie:

   > I am attaching my reference image. Keep exactly the same three characters: same
   > body shapes, same proportions, same eye style, same outline weight and the same
   > three body colours. Do not redesign them.

3. `og-tlo` jako jedyny nie ma postaci — kolejność przy nim nie ma znaczenia.

Jeśli któryś obraz wyjdzie w innym stylu — **nie poprawiaj go w kolejnych krokach**,
tylko wygeneruj od nowa z załączonym wzorcem. Jedna odstająca postać psuje cały zestaw
bardziej niż brak obrazka.

**Tło do wycięcia:** wszystkie postacie i sceny mają jednolite `#00FF00`. Nie proś
o przezroczystość — nie dostaniesz jej. Tło zdejmuje `scripts/process-assets.py`.

---

## `hero-ekipa`

```
Three chunky bean-shaped cartoon characters sitting side by side on a low couch at a
home party, each holding a small phone and grinning down at it. The left character's
body is violet #6D3BF5, the middle one magenta #C0398F, the right one mint #7CF0AE.
All three have big round white eyes with simple dot pupils, tiny stubby arms and no
fingers. The couch is deep indigo #4B1FA8. Thick dark outline, flat shading with a
single shadow level, cartoon proportions, no realistic lighting, no photographic
textures. Solid flat #00FF00 background for later cutout. Aspect ratio 16:9, the group
centred with generous margin on every side so the outline is never cropped.

avoid: photorealism, gradients inside objects, cast shadows on the background,
watermarks, frames or borders, any props beyond the couch and the three phones, any
text, letters, numbers or logos.
```

---

## `howto-pokoj`

```
One chunky bean-shaped cartoon character with a violet #6D3BF5 body standing and
holding a phone up in front of itself with both stubby arms, head tilted slightly back,
mouth open in a cheerful grin, big round white eyes with dot pupils and no fingers. The
phone body is deep indigo #4B1FA8 with a blank mint #7CF0AE screen. Thick dark outline,
flat shading with a single shadow level, cartoon proportions, no realistic lighting, no
photographic textures. Solid flat #00FF00 background for later cutout. Aspect ratio 1:1,
the character centred with generous margin on every side so the outline is never cropped.

avoid: photorealism, gradients inside objects, cast shadows on the background,
watermarks, frames or borders, more than one character, any text, letters, numbers,
icons or logos on the phone screen.
```

---

## `howto-kod`

```
Two chunky bean-shaped cartoon characters facing each other, the left one with a violet
#6D3BF5 body passing a blank rounded card to the right one with a magenta #C0398F body,
who reaches for it with both stubby arms. The card is mint #7CF0AE and completely empty.
Both have big round white eyes with dot pupils, tiny arms and no fingers. Thick dark
outline, flat shading with a single shadow level, cartoon proportions, no realistic
lighting, no photographic textures. Solid flat #00FF00 background for later cutout.
Aspect ratio 1:1, the pair centred with generous margin on every side so the outline is
never cropped.

avoid: photorealism, gradients inside objects, cast shadows on the background,
watermarks, frames or borders, extra props, any text, letters, numbers, symbols or
logos on the card.
```

---

## `howto-gra`

```
Three chunky bean-shaped cartoon characters standing in a tight group, arms raised in
celebration, each holding a small phone, all cheering with wide open mouths. Bodies in
violet #6D3BF5, magenta #C0398F and mint #7CF0AE, big round white eyes with dot pupils,
tiny stubby arms, no fingers. The phones are deep indigo #4B1FA8 with blank screens.
Thick dark outline, flat shading with a single shadow level, cartoon proportions, no
realistic lighting, no photographic textures. Solid flat #00FF00 background for later
cutout. Aspect ratio 1:1, the group centred with generous margin on every side so the
outline is never cropped.

avoid: photorealism, gradients inside objects, cast shadows on the background,
watermarks, frames or borders, confetti or motion lines, any text, letters, numbers or
logos.
```

---

## `ziomek-czeka`

```
One chunky bean-shaped cartoon character with a mint #7CF0AE body sitting alone on the
floor with its legs out, slumped and bored, resting its cheek on one stubby arm while
the other holds a phone flat on the ground. Big round white eyes with dot pupils, half
closed lids, small flat mouth, no fingers. The phone is deep indigo #4B1FA8 with a blank
screen. Thick dark outline, flat shading with a single shadow level, cartoon proportions,
no realistic lighting, no photographic textures. Solid flat #00FF00 background for later
cutout. Aspect ratio 1:1, the character centred with generous margin on every side so the
outline is never cropped.

avoid: photorealism, gradients inside objects, cast shadows on the background,
watermarks, frames or borders, sadness that reads as crying, any text, letters, numbers
or logos.
```

---

## `ziomek-zagubiony`

```
One chunky bean-shaped cartoon character with a magenta #C0398F body standing and
shrugging, both stubby arms lifted and turned outwards, shoulders up, eyebrows raised in
confusion, small crooked mouth. Big round white eyes with dot pupils, no fingers. A
violet #6D3BF5 phone lies on the ground beside its feet with a blank screen. Thick dark
outline, flat shading with a single shadow level, cartoon proportions, no realistic
lighting, no photographic textures. Solid flat #00FF00 background for later cutout.
Aspect ratio 1:1, the character centred with generous margin on every side so the outline
is never cropped.

avoid: photorealism, gradients inside objects, cast shadows on the background,
watermarks, frames or borders, question marks or speech bubbles, any text, letters,
numbers or logos.
```

---

## `ziomek-wygrana`

```
One chunky bean-shaped cartoon character with a violet #6D3BF5 body jumping with both
stubby arms thrown up in triumph, mouth wide open in a shout, eyes squeezed into happy
curved arcs, no fingers. It holds a plain golden trophy cup with a smooth empty surface
in one arm. A mint #7CF0AE scarf trails behind it. Thick dark outline, flat shading with
a single shadow level, cartoon proportions, no realistic lighting, no photographic
textures. Solid flat #00FF00 background for later cutout. Aspect ratio 1:1, the character
centred with generous margin on every side so the outline is never cropped.

avoid: photorealism, gradients inside objects, cast shadows on the background,
watermarks, frames or borders, confetti, sparkles or motion lines, any text, letters,
numbers, engraving or logos on the trophy.
```

---

## `og-tlo`

> Ten jeden **nie jest wycinany** — to pełne tło pod tekst renderowany później w HTML.
> Dlatego nie ma `#00FF00` i musi mieć pustą, spokojną prawą część na napisy.

```
A flat cartoon scene of an empty living room at night set up for a party, seen straight
on: a low couch, a small table and a floor lamp pushed to the left third of the frame,
with the right two thirds left as calm empty wall. The wall is a diagonal blend from deep
indigo #4B1FA8 in the upper left through violet #6D3BF5 to magenta #C0398F in the lower
right. Furniture is darker indigo with mint #7CF0AE highlights. Thick dark outline, flat
shading with a single shadow level, cartoon proportions, no realistic lighting, no
photographic textures. Aspect ratio 16:9, full bleed to all four edges with no margin.

avoid: photorealism, photographic textures, people or characters, busy patterns on the
right two thirds, watermarks, frames or borders, any text, letters, numbers or logos.
```

---

## Po wygenerowaniu

Wrzuć pliki do `assets/zrodla/` pod ID z nagłówków (rozszerzenie `.png`) i odezwij się.
Przetworzenie to jedna komenda:

```bash
python3 scripts/process-assets.py --all
```

---

## Ikony kafelków gier (`public/games/*.webp`)

Osobny styl niż postacie „Ekipy": **bąbelkowe 3D**, jak naklejka albo ikona aplikacji,
nie płaska kreskówka. Kafelki gier stoją obok siebie w siatce, więc odstająca ikona
rzuca się w oczy bardziej niż odstająca scena.

**Załącz jako wzorzec `public/games/kolko.webp`** i dopisz na początku wiadomości:

> I am attaching one icon from my existing set. Match its style exactly: same glossy
> 3D look, same outline weight and colour, same level of gloss and shading, same
> amount of detail. Do not redesign the style.

Wynik zapisujesz jako `assets/zrodla/{id}.png`, potem:

```
python3 scripts/process-assets.py --id {id}
```

Zielone tło jest tu wygodniejsze niż szachownica, ale **wtedy w ikonie nie może być
zieleni** — chroma key zjadłby ją razem z tłem. Stąd w chińczyku pionki czerwony,
żółty i niebieski, bez zielonego.

---

## `chinczyk`

```
A single glossy 3D cartoon icon of a Ludo game: one large white die tilted towards the
viewer showing five red pips on its top face, and three chunky Ludo pawns standing just
behind it - one red #E4002B, one golden yellow #FFB627, one blue #3B82F6. The pawns are
smooth rounded skittles with a ball on top and a wide base. Soft plastic material with
gentle gradient shading and a small specular highlight on every rounded surface, thick
dark navy outline around every shape, warm cheerful palette, sticker-like app-icon look.
One compact object group, centred, nothing else in the frame. Solid flat #00FF00
background for later cutout. Aspect ratio 1:1, generous margin on every side so the
outline is never cropped.

avoid: photorealism, cast shadows on the background, a board or a table under the
pieces, green pieces or any green in the objects, casino chips, playing cards, more
than three pawns, watermarks, frames or borders, any text, letters, numbers or logos
other than the pips on the die.
```
