# Prompt do Gemini (Nano Banana) — ikony gier dla Doplay

> **Pakiet awatarów jest zamknięty** — trzydzieści postaci, wszystkie z twarzą.
> Prompty, którymi powstały, zostały stąd usunięte, bo nie będą już potrzebne.
> Zostaje klucz stylu i etapy od ikon GIER: to one przydadzą się przy dziewiątej grze.
>
> **Jak tego użyć:** wklejaj do Gemini etap po etapie, nie wszystko naraz, i za każdym
> razem **załączaj gotową ikonę z `public/avatars/` jako wzór** — bez niej model wraca
> do swojego domyślnego stylu maskotki i pakiet się rozjeżdża.

---

## Klucz stylu — obowiązuje KAŻDĄ ikonę w pakiecie

To jest kontrakt, do którego odwołują się wszystkie etapy niżej. Wklej go razem
z zadaniem i z załączoną ikoną wzorcową.

```
STYL — trzymaj się go rygorystycznie, to jest klucz dla całego pakietu:
- Kreskówkowy 3D, bąbelkowy, pucołowaty. Miękkie zaokrąglone kształty, zero ostrych kantów.
- Gruby, jednolity kontur w kolorze ciemnego fioletu (#2A1758), grubość identyczna
  we wszystkich ikonach.
- Delikatny gradient wypełnienia + jeden miękki refleks świetlny w lewym górnym rogu.
  Źródło światła zawsze z lewej góry, w każdej ikonie tak samo.
- Nasycone, wesołe kolory. Ikony będą leżeć na fioletowo-różowym tle (#4B1FA8 → #C0398F),
  więc muszą być od niego wyraźnie jaśniejsze i kontrastowe. Unikaj fioletu jako
  koloru dominującego ikony.
- Płaska, czytelna sylwetka — ikona musi być rozpoznawalna po zmniejszeniu do 40 px.
  Zero drobnych detali, cieniutkich kresek, tekstur i napisów.
- Zwierzęta: same głowy/pyszczki en face, przyjazne, uśmiechnięte. Bez ciał.
- Przedmioty: ujęcie lekko z przodu, prosta bryła.

WYMAGANIA TECHNICZNE:
- Format kwadratowy 1:1, tło CAŁKOWICIE PRZEZROCZYSTE (alfa), bez cienia rzuconego na tło.
- Motyw wyśrodkowany, z marginesem ok. 10% z każdej strony.
- Wszystkie ikony w tej samej skali wizualnej — pyszczek kota ma zajmować tyle samo
  kadru co pyszczek pandy.
- Bez tekstu, bez podpisów, bez ramek, bez numeracji.
```

---

## ETAP 6 — ikony pięciu gier

```
Ten sam styl co poprzednio (załączam wzorzec), ale te ikony są WIĘKSZE w użyciu
(do 80 px), więc mogą mieć odrobinę więcej detalu. Nadal: gruby kontur #2A1758,
światło z lewej góry, tło przezroczyste, format 1:1, margines 10%, bez tekstu.

Każda ikona ma dominujący kolor podany niżej — to kolor akcentu danej gry
w aplikacji, więc trzymaj się go:

1. stoper — stoper/sekundnik, dominująca limonka #CCFF00
2. panstwa-miasta — ołówek piszący po kartce, dominujący cyjan #22D3EE
3. wisielec — czaszka z pętlą/sznurem, dominujący bursztyn #FFB627
4. impostor — maska weneckia / maska szpiega, dominująca magenta #FF2D95
5. mafia — kapelusz fedora z przepaską, dominująca czerwień #E4002B

Nazwy: stoper.png, panstwa-miasta.png, wisielec.png, impostor.png, mafia.png
```

---

## ETAP 7 — ikona szóstej gry: Odcień

> **Załącz do rozmowy którąś z gotowych ikon gier** (np. `budzik.png` albo `wisielec.png`).
> Bez wzorca pojedyncza nowa ikona wyjdzie w innym stylu i będzie odstawać od reszty —
> to jedyny naprawdę krytyczny punkt tego etapu.

```
Załączam gotową ikonę z mojego pakietu jako wzorzec stylu.

Wygeneruj JEDNĄ nową ikonę gry w DOKŁADNIE tym samym stylu: kreskówkowy 3D, bąbelkowy,
gruby jednolity kontur w ciemnym fiolecie (#2A1758), miękki refleks świetlny z lewej góry,
nasycone kolory, płaska czytelna sylwetka.

WYMAGANIA TECHNICZNE (jak poprzednio):
- Format kwadratowy 1:1, tło CAŁKOWICIE PRZEZROCZYSTE, bez cienia rzuconego na tło.
- Motyw wyśrodkowany, margines ok. 10% z każdej strony.
- Ta sama skala wizualna co ikona wzorcowa.
- Bez tekstu, bez podpisów, bez ramek.
- Minimum 512×512.

GRA: „Odcień" — gracz widzi kolor przez kilka sekund, kolor znika, a potem odtwarza go
z pamięci trzema suwakami. Gra jest O KOLORZE, więc to jedyna ikona w pakiecie, która
MOŻE być wielobarwna — pozostałe mają jeden kolor dominujący, ta nie musi.

MOTYW: paleta malarska (klasyczny owal z otworem na kciuk) z trzema albo czterema
błyszczącymi kleksami farby. Korpus palety w ciepłym pomarańczu #FF8A3D — to kolor
akcentu tej gry. Kleksy w wyraźnie różnych barwach (np. róż, turkus, limonka, żółć),
każdy z własnym refleksem, jak krople gęstej farby.

WAŻNE: ikona musi być rozpoznawalna po zmniejszeniu do 40 px. Kleksy mają być duże
i wyraźnie oddzielone — nie rób drobnych plamek ani cienkich pędzelków.

Nazwa pliku: odcien.png
```

### Wariant alternatywny (jeśli paleta nie wyjdzie)

```
Ten sam styl i te same wymagania techniczne co wyżej.

Zamiast palety: trzy grube, poziome suwaki jeden pod drugim, każdy z pucołowatą
okrągłą gałką w innym kolorze (róż, turkus, limonka). Tory suwaków w ciepłym
pomarańczu #FF8A3D. To ma czytać się jak „regulujesz kolor", a nie jak zwykłe menu.

Nazwa pliku: odcien.png
```

---

## ETAP 8 — ikona siódmej gry: Kasyno — ZROBIONE

Ikona przyszła jako zrzut ekranu (JPEG z wypaloną szachownicą „przezroczystości"),
nie jako PNG z kanałem alfa. Tło wycięte programowo: szachownica i cień to czyste
szarości, a naklejka ma wszędzie ciemnofioletowy kontur o wyraźnej chromie — więc
rozlewanie od krawędzi obrazu po pikselach o chromie < 30 zatrzymuje się dokładnie
na konturze. Przy okazji znika biała otoczka naklejki, której pozostałe ikony
w pakiecie i tak nie mają.

MOTYW: koło fortuny w złotej obręczy z nitami, w środku okienko slota z trzema
bębnami (wiśnie / siódemka / cytryna), obok dźwignia z czerwoną gałką, na dole
stosik żetonów i moneta „2x". Akcent gry: złoto #F0B429.

Nazwa pliku: kasyno.png

---

## ETAP 9 — ikona kafelka „WKRÓTCE" (nie gra)

> **Załącz do rozmowy którąś z gotowych ikon gier** (np. `budzik.png` albo `kasyno.png`).
> Ten kafelek stoi w siatce OBOK kart gier, więc ma pasować do TEGO pakietu —
> bąbelkowego 3D — a nie do płaskich postaci z `assets/PROMPTS.md`.

> **Tło:** proś o jednolitą zieleń, nie o przezroczystość. Przy poprzednich dwóch
> partiach generator i tak oddał pliki na zieleni albo na bieli, mimo prośby o alfę.
> Wycinaniem zajmuje się `scripts/process-assets.py`.

```
I am attaching one icon from my existing game-icon set as a style reference.

Generate ONE new icon in exactly the same style: chunky cartoon 3D, bubbly volumes,
thick solid dark purple #2A1758 outline, soft highlight from the upper left, saturated
colours, flat readable silhouette.

SUBJECT: a closed gift box with its lid lifting off, warm mint #7CF0AE light spilling
out of the gap between lid and box. The box body is violet #6D3BF5, the ribbon
crossing it is mint #7CF0AE, the lid is a lighter violet. Nothing identifiable is
visible inside — only light. This has to read as „something new is coming", not as
a finished present.

The icon must stay recognisable when scaled down to 44 px, so keep the shape simple
and the glow wide rather than detailed.

Solid flat #00FF00 background for later cutout. Aspect ratio 1:1, the object centred
with roughly 10% margin on every side so the outline is never cropped. Minimum 512×512.

avoid: photorealism, photographic textures, cast shadows on the background, watermarks,
frames or borders, characters or faces, sparkle stars, motion lines, more than one
object in frame, any text, letters, numbers, question marks or logos.
```

Nazwa pliku: `wkrotce.png`, do `assets/zrodla/`.

---

## Czego potrzebuję od Ciebie na końcu

Pliki PNG o dokładnie tych nazwach (to są identyfikatory z `registry.ts` — nie zmieniaj ich):

**Gry (8):**
`stoper` `panstwa-miasta` `wisielec` `impostor` `mafia` `odcien` `kasyno` `kolko`

### Jeśli coś nie wyjdzie idealnie — nie szkodzi

- **Tło nie jest przezroczyste?** Poradzę sobie — mogę je wyciąć programowo, o ile
  jest jednolite (najlepiej czysta biel albo magenta). Powiedz mi tylko, że tak jest.
- **Rozmiar?** Cokolwiek od 512×512 w górę. Sam przeskaluję i skompresuję do WebP.
- **Któraś ikona odstaje stylem?** Wyślij i tak — powiem, którą warto wygenerować ponownie.

---

## Czego świadomie NIE zmieniamy

Ikony interfejsu (zamknij, zaznaczone, udostępnij, głośnik, strzałki, gwiazdka hosta,
ostrzeżenie, faza dnia/nocy w Mafii) zostają na **Lucide SVG**. Powód: wyświetlają się
w 12–20 px, muszą być ostre na każdym ekranie, zmieniać kolor przy najechaniu i stanach,
a jako SVG ważą ułamek tego co PNG. Wygenerowana grafika rastrowa byłaby tam gorsza,
nie lepsza.

---

## ETAP 10 — ikona ósmej gry: Kółko i krzyżyk

> **Załącz do rozmowy którąś z gotowych ikon gier** (np. `wisielec.png` albo `kasyno.png`).

> **Czego uczą dwa nieudane podejścia — warto przeczytać, zanim zmienisz prompt:**
>
> 1. **Sam X obok O** wyszedł ładnie, ale czyta się jako logotyp „XO" (całuski), nie jako
>    gra. Para znaków bez planszy nie niesie znaczenia.
> 2. **Latający hasztag `#`** wyszedł ciężki i brzydki, z dwóch powodów, oba wynikały
>    z błędu w prompcie:
>    - Kazano zrobić belki ciemnofioletowe, a **klucz stylu zakazuje fioletu jako koloru
>      dominującego ikony** — bo ikony leżą też na fioletowo-różowym tle. Największy
>      element w kolorze tła daje ciemną plamę.
>    - Hasztag to **znak pisarski, nie przedmiot**. Wszystkie pozostałe ikony pakietu są
>      RZECZAMI: szubienica z desek, globus, jednoręki bandyta, paleta malarska — każda
>      z jasnym, ciepłym korpusem. Abstrakcyjny glif nie pasuje i pasować nie będzie.
>
> Wniosek: plansza ma być **przedmiotem** — małą deseczką do gry, w duchu szubienicy.
> Korpus jasny i ciepły, kratka wyżłobiona w nim, a X i O to jedyne mocne kolory.

```
I am attaching one icon from my existing game-icon set as a style reference.

Generate ONE new icon in exactly the same style: chunky cartoon 3D, bubbly volumes,
thick solid dark purple #2A1758 outline, soft highlight from the upper left, saturated
colours, flat readable silhouette.

SUBJECT: a small physical tic-tac-toe board, like a chunky toy tile you could pick up,
tilted a few degrees so it feels playful rather than diagrammatic.

- The board is a rounded square with soft pillowy edges, filling most of the canvas.
  Its body is warm light wood / cream #F2D8A8, the same friendly material as the wooden
  gallows in my reference set. The body is the object; it carries the whole silhouette.
- The 3x3 grid is CARVED INTO the board as four shallow grooves, slightly darker than
  the body (#D9B77E). The grooves are simple straight channels. They are texture on the
  object, not free-floating bars, and they must never be the loudest thing in the icon.
- Exactly TWO pieces sit in the cells, placed diagonally from each other, resting on
  the surface with a soft contact shadow:
  a cyan #22D3EE X made of two fat rounded crossing bars,
  a magenta #FF2D95 O, a thick chunky ring, clearly hollow in the middle.
  Each piece nearly fills its cell. They are the brightest things in the icon and the
  eye must land on them first.
- The other seven cells stay empty.

COLOUR RULE, important: violet and purple appear ONLY in the thin outline. The board
body must stay warm and light. Do not make any large element violet, dark blue or
near-black.

The icon must stay recognisable when scaled down to 40 px: two loud pieces on a calm
light board.

Solid flat #00FF00 background for later cutout. Aspect ratio 1:1, the board centred
with roughly 10% margin on every side so nothing touches or crosses the canvas edge.
Minimum 512x512.

avoid: photorealism, photographic textures, cast shadows on the background, watermarks,
text, captions, a white sticker border or any white outline around the object, a large
violet or dark shape, a floating hash / pound / hashtag symbol, pieces hanging outside
the board, more than two pieces, paper or notebook texture, pencil or chalk look.

File name: kolko.png
```

### Wariant alternatywny (jeśli deseczka wyjdzie nudno)

```
Same style and same technical requirements as above.

Instead of a flat tile: a chunky wooden board standing at a slight three-quarter angle,
with the cyan X and the magenta O as thick separate tokens lying ON it, one of them
slightly overlapping the board's edge as if just placed. Keep the board body warm cream
#F2D8A8 and keep violet out of everything except the outline.

File name: kolko.png
```

### Co po wygenerowaniu

1. Plik do `assets/zrodla/kolko.png` (albo `.jpg` — pipeline przyjmie oba).
2. Dopisać do `MANIFEST` w `scripts/process-assets.py`:
   `Asset("kolko", "cutout", "ikony", 384, 384, halo=True)` — `halo=True` jak przy
   `wkrotce`, bo ciemny kontur zamyka sylwetkę i pozwala doczyścić zieloną obwódkę.
   **Jeśli mimo zakazu wyjdzie z białą obwódką**, `halo=True` jej NIE zdejmie — biel
   nie jest zielenią. Trzeba wtedy poprosić o regenerację, a nie łatać skryptem.
3. `python3 scripts/process-assets.py` — wytnie tło i zapisze WebP.
4. Gotową ikonę przenieść do `public/games/kolko.webp` w **192×192** (tyle mają
   pozostałe siedem) i dopisać `"kolko"` do zbioru `ILLUSTRATED` w
   `src/components/GameIcon.tsx`. Do tego czasu gra pokazuje zapasową ikonę Lucide
   (`Grid3x3`) i nic się nie psuje.

> **Jak ocenić wynik w pół sekundy:** zmniejsz obrazek do 40 px i spójrz. Powinieneś
> widzieć jasną deseczkę i dwie kolorowe plamy. Jeśli widzisz ciemną bryłę — jest źle,
> niezależnie od tego, jak ładnie wygląda w dużym rozmiarze.

---
