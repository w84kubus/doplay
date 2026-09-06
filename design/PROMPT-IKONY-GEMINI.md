# Prompt do Gemini (Nano Banana) — pakiet ikon dla Domówki

> **UWAGA na kolejność czytania.** Etapy 1-10 to zapis tego, JAK pakiet powstał,
> a nie lista obowiązująca dziś. **ETAP 11 wycofuje 13 awatarów** (w tym `flame`,
> `egg`, `anchor`, `guitar`) i zastępuje je postaciami. Zanim cokolwiek wygenerujesz,
> przeczytaj najpierw ETAP 11 — inaczej odtworzysz ikony, które właśnie wyrzucamy.
>
> **Jak tego użyć:** wklejaj do Gemini **etap po etapie**, nie wszystko naraz.
> Etap 1 ustala styl. Etapy 2–6 dogrywają resztę, **odwołując się do obrazka z etapu 1**
> (załącz go w rozmowie) — bez tego każda partia wyjdzie w innym stylu i pakiet się rozjedzie.

---

## ETAP 1 — klucz stylu (6 awatarów)

```
Jesteś ilustratorem UI. Tworzysz pakiet ikon-awatarów do imprezowej gry mobilnej
w stylu "arcade party": soczysty, kreskówkowy, radosny.

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

ZADANIE:
Wygeneruj 6 osobnych ikon, każdą jako oddzielny obrazek:
1. cat — pyszczek kota, pomarańczowo-rudy
2. dog — pyszczek psa, jasnobrązowy
3. panda — pyszczek pandy, biało-czarny
4. rabbit — pyszczek królika, kremowy
5. fish — rybka, turkusowo-niebieska
6. flame — płomień, pomarańczowo-czerwony   ← WYCOFANY w ETAPIE 11, nie generuj ponownie

Nazwij pliki dokładnie: cat.png, dog.png, panda.png, rabbit.png, fish.png, flame.png
```

---

## ETAP 2 — zwierzęta, część 1

```
Załączam ikony z poprzedniego etapu jako wzorzec stylu.
Wygeneruj kolejne 6 ikon w DOKŁADNIE tym samym stylu, konturze, skali i oświetleniu.
Te same wymagania techniczne (1:1, tło przezroczyste, margines 10%, bez tekstu).

1. bird — ptaszek, żółto-niebieski
2. squirrel — wiewiórka, rudobrązowa
3. turtle — żółw, zielony
4. bug — biedronka/żuczek, czerwono-czarny
5. rat — myszka, szara
6. snail — ślimak, beżowo-brązowy

Nazwy: bird.png, squirrel.png, turtle.png, bug.png, rat.png, snail.png
```

---

## ETAP 3 — zwierzęta, część 2

```
Ten sam styl co poprzednio (załączam wzorzec). Te same wymagania techniczne.

1. worm — robaczek, różowy
2. shell — muszla, kremowo-różowa
3. feather — piórko, jasnoniebieskie
4. egg — jajko, kremowe
5. paw — odcisk łapy, fioletowo-liliowy
6. ghost — duszek, biało-błękitny

Nazwy: worm.png, shell.png, feather.png, egg.png, paw.png, ghost.png
```

---

## ETAP 4 — przedmioty, część 1

```
Ten sam styl co poprzednio (załączam wzorzec). Te same wymagania techniczne.
Przedmioty rysuj jako proste, pucołowate bryły — ta sama bąbelkowa stylistyka
co zwierzęta, ten sam gruby kontur.

1. pizza — kawałek pizzy
2. beer — kufel piwa z pianką
3. guitar — gitara elektryczna, czerwona
4. rocket — rakieta, biało-czerwona
5. bot — głowa robota, srebrno-niebieska
6. gamepad — pad do gier, ciemnoszary z kolorowymi przyciskami

Nazwy: pizza.png, beer.png, guitar.png, rocket.png, bot.png, gamepad.png
```

---

## ETAP 5 — przedmioty, część 2

```
Ten sam styl co poprzednio (załączam wzorzec). Te same wymagania techniczne.

1. skull — czaszka, kremowo-biała, wesoła nie straszna
2. crown — korona, złota
3. diamond — diament, jasnoniebieski
4. anchor — kotwica, granatowo-srebrna
5. bike — rower, turkusowy
6. zap — błyskawica, żółta

Nazwy: skull.png, crown.png, diamond.png, anchor.png, bike.png, zap.png
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

**37 plików PNG** o dokładnie tych nazwach (to są identyfikatory z kodu — nie zmieniaj ich):

> Spis poniżej to **stan sprzed ETAPU 11**. Trzynaście z tych awatarów jest wycofanych,
> aktualna lista jest w ETAPIE 11.

**Awatary (30, stan historyczny):**
`cat` `dog` `bird` `rabbit` `panda` `squirrel` `fish` `turtle` `bug` `rat`
`snail` `worm` `shell` `feather` `egg` `paw` `pizza` `beer` `guitar` `rocket`
`bot` `ghost` `skull` `flame` `gamepad` `crown` `diamond` `anchor` `bike` `zap`

**Gry (7):**
`stoper` `panstwa-miasta` `wisielec` `impostor` `mafia` `odcien` `kasyno`

> **Uwaga o nazwach:** nazwy plików są wygodne, ale nie krytyczne — przy poprzednim
> pakiecie przyszły po polsku (`budzik.png`, `karty-2.png`) i po prostu je zmapowałem.
> Ważniejsze, żeby styl się zgadzał.

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
>    - Kazano zrobić belki ciemnofioletowe, a **ETAP 1 zakazuje fioletu jako koloru
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

## ETAP 11 — wymiana martwych przedmiotów na postacie

### Dlaczego

Pakiet rozjechał się na dwie połowy. Piętnaście awatarów ma twarz i patrzy na gracza,
piętnaście to martwe przedmioty. Awatar odpowiada na pytanie „kim jestem przy tym stole",
a na to nie da się odpowiedzieć jajkiem ani kotwicą. Widać to od razu, gdy ustawi się
je obok siebie: kot, panda i ślimak to postacie, a muszelka i pióro to clipart.

Kryterium jest jedno i twarde: **awatar musi mieć oczy**. Wszystko, co ich nie ma,
wypada — niezależnie od tego, jak ładnie narysowane.

### Co zostaje (15 — mają twarz)

`cat` `dog` `bird` `rabbit` `panda` `squirrel` `fish` `turtle` `bug` `rat` `snail` `worm`
oraz trzy postacie nie-zwierzęce, które też patrzą: `bot` `ghost` `skull`.

### Co wypada (13 — brak twarzy)

`shell` `feather` `egg` `paw` `guitar` `rocket` `flame` `gamepad` `crown` `diamond`
`anchor` `bike` `zap`

`paw` wypada podwójnie: łapka to nie postać, a przy kocie i psie w tym samym zestawie
jest wręcz myląca.

### Dwa przypadki do decyzji: `pizza` i `beer`

Nie są postaciami, ale są **tematyczne** — to imprezowa gra. Zamiast wyrzucać, można
je przerysować z twarzą: kawałek pizzy z oczami i uśmiechem jest postacią i zostaje
w klimacie. Prompt na to jest w partii C niżej. Jeśli wolisz czystość pakietu,
pomiń partię C i zamów dwie dodatkowe postacie z listy rezerwowej.

### Kolizje, których trzeba pilnować

Przy trzydziestu okrągłych awatarach po 40 px sylwetka to za mało — decyduje **kolor**.
Zajęte pola: pomarańcz (kot, wiewiórka), brąz (pies), błękit (ptaszek, rybka, robot),
zieleń (żółw), czerwień (biedronka), szarość (myszka, czaszka), biel (duszek, panda),
róż (robaczek), beż (królik, ślimak).

Wolne i warte zajęcia: **żółto-czarne pasy, limonka, magenta, złoto, turkus, grafit**.

Dlatego w promptach niżej kolor jest podany sztywno dla każdej postaci, a nie zostawiony
modelowi. Drugą linią obrony jest kolor kafelka pod awatarem (`avatarColor`
w `AvatarIcon.tsx`) — dwa szare zwierzaki na różnych kafelkach czytają się jako różne.

---

### Partia A — 7 postaci (wklej razem z obrazkiem z ETAPU 1)

```
To jest kontynuacja pakietu awatarów. Załączam ikonę z pierwszej partii jako wzór stylu.
Trzymaj się jej dokładnie: ten sam gruby ciemnofioletowy kontur (#2A1758) o tej samej
grubości, ten sam kreskówkowy 3D, ta sama bąbelkowa miękkość, to samo światło z lewej góry,
ta sama skala kadru (pyszczek zajmuje tyle samo miejsca co w załączonym wzorze).

Wszystkie zwierzęta: SAMA GŁOWA en face, bez ciała, przyjazna, uśmiechnięta, oczy
skierowane na patrzącego. Tło całkowicie przezroczyste, kwadrat 1:1, margines ok. 10%.
Bez tekstu, bez ramek, bez cienia rzuconego na tło.

Kolor każdej postaci jest PODANY i obowiązkowy — te ikony będą leżeć obok trzydziestu
innych i kolor jest jedyną rzeczą, która je odróżni po zmniejszeniu do 40 px.
Nie zmieniaj go „dla ładniejszej kompozycji".

Wygeneruj 7 osobnych obrazków:
1. frog — głowa żaby, JASKRAWA LIMONKA (#7CC93F), szeroki uśmiech, wypukłe oczy
   na czubku głowy. Ma być wyraźnie jaśniejsza i bardziej kwaśna niż zieleń żółwia.
2. bee — głowa pszczoły, ŻÓŁTO-CZARNE PASY (#F2C23E + czerń), okrągłe czułki,
   maleńkie skrzydełka po bokach głowy.
3. penguin — głowa pingwina, CZARNA z BIAŁYM PYSZCZKIEM i POMARAŃCZOWYM DZIOBEM (#F08A2E).
   Uwaga: w pakiecie jest już panda (biała głowa, czarne uszy) — pingwin ma być jej
   odwrotnością, czyli ciemna głowa z jasnym środkiem.
4. lion — głowa lwa, ZŁOTA GRZYWA (#E0A02E) wokół jaśniejszego pyszczka. Grzywa jako
   pełny pierścień, bo to ona tworzy rozpoznawalną sylwetkę.
5. octopus — głowa ośmiornicy, MAGENTA (#D9418C), duże oczy, kilka krótkich macek
   podwiniętych pod spodem. Macki grube i miękkie, nie cienkie nitki.
6. unicorn — głowa jednorożca, BIAŁA z TĘCZOWĄ GRZYWĄ i ZŁOTYM ROGIEM. Grzywa
   wielobarwna, bo w pakiecie jest już biały duszek — tęcza ma je rozróżnić.
7. dragon — głowa smoka, GŁĘBOKI SZMARAGD (#2F9E6E), dwa rogi, mały pyszczek,
   przyjazny nie groźny. Rogi są tu najważniejsze: odróżniają go od żółwia i żaby.

Nazwij pliki dokładnie: frog.png, bee.png, penguin.png, lion.png, octopus.png,
unicorn.png, dragon.png
```

### Partia B — 6 postaci (znowu z obrazkiem wzorcowym)

```
Kolejna partia tego samego pakietu. Ten sam wzór stylu w załączniku, te same zasady:
sama głowa en face, gruby kontur #2A1758, światło z lewej góry, przezroczyste tło,
kwadrat 1:1, margines 10%, podany kolor obowiązkowy.

1. owl — głowa sowy, CIEPŁY BURSZTYN (#C98A3C) z OGROMNYMI ŻÓŁTYMI OCZAMI.
   Oczy mają zajmować dobrą jedną trzecią głowy — to one odróżniają sowę od psa
   i wiewiórki, które są w podobnym brązie.
2. bat — głowa nietoperza, GRAFIT Z FIOLETOWYM ODCIENIEM (#4A4358), duże spiczaste
   uszy, dwa malutkie kły w uśmiechu. Ma być ciemna, ale nie czarna.
3. shark — głowa rekina, STALOWY BŁĘKIT (#4A7BA8), szeroki zębaty uśmiech, płetwa
   na czubku głowy. W pakiecie jest już turkusowa rybka — rekin ma być wyraźnie
   ciemniejszy, a zęby i płetwa mają robić różnicę.
4. jellyfish — głowa meduzy, PÓŁPRZEZROCZYSTY LILIOWY RÓŻ (#C86FB0), kopułka z kilkoma
   falującymi nitkami pod spodem. W pakiecie jest różowy robaczek — meduzę ma odróżnić
   kopuła i nitki.
5. sloth — głowa leniwca, CIEPŁY BEŻ (#C4A882) z CIEMNĄ MASKĄ wokół oczu i sennym
   półuśmiechem. Maska jest obowiązkowa: bez niej zlewa się z królikiem i ślimakiem.
6. crab — głowa kraba, KORALOWA CZERWIEŃ (#E2603F), dwa szczypce uniesione po bokach
   głowy, oczy na krótkich słupkach. W pakiecie jest czerwona biedronka (okrągła kopuła
   w kropki) — kraba mają odróżnić szczypce i oczy na słupkach.

Nazwij pliki dokładnie: owl.png, bat.png, shark.png, jellyfish.png, sloth.png, crab.png
```

### Partia C — dwa przedmioty, które dostają twarz (opcjonalna)

```
Ten sam styl i te same zasady techniczne co poprzednio.

Te dwie ikony JUŻ istnieją w pakiecie jako martwe przedmioty. Przerysuj je jako postacie:
dodaj duże przyjazne oczy i uśmiech, zachowując kształt i kolor, żeby dalej były
rozpoznawalne jako pizza i kufel.

1. pizza — kawałek pizzy z twarzą. Ser i pepperoni zostają, oczy i uśmiech na serze.
2. beer — kufel piwa z twarzą. Piana i złoty płyn zostają, twarz na szkle.

Nie rób z nich ludzików: żadnych rąk, nóg ani czapek. To ma być pizza, która patrzy,
a nie postać trzymająca pizzę.

Nazwij pliki dokładnie: pizza.png, beer.png
```

### Lista rezerwowa

Gdyby któraś postać nie wyszła albo gdybyś wolał pominąć partię C:
**koala** (popielaty, ogromne puchate uszy), **szop** (popielaty z czarną maską bandyty),
**kameleon** (turkus przechodzący w limonkę, oko na obrotowej wieżyczce),
**jeż** (brązowe kolce, jasny pyszczek), **wieloryb** (granat, mała fontanna).

Każda z nich wchodzi w wolne pole kolorystyczne, ale wymaga sprawdzenia przy sąsiadach:
koala i szop dokładają szarości do myszki i czaszki, jeż dokłada brązu do psa.

### Co po wygenerowaniu

1. Pliki do `emoji-pack/` pod nazwami jak wyżej.
2. W `scripts/build-avatars.mjs` dopisać do `MAP` wpisy `frog: "frog"` itd. — nowe
   pliki mają angielskie nazwy, więc mapowanie jest tożsamościowe.
3. `node scripts/build-avatars.mjs` — przytnie, wyrówna skalę i zapisze WebP 192×192.
4. W `src/lib/avatars.ts`: wstawić nowe identyfikatory do `AVATARS` w miejsce starych.
   **Wycofane identyfikatory przenieść do `LEGACY_AVATARS`, nie kasować.** Bez tego
   gracz, który siedzi teraz w pokoju z awatarem `egg`, po odświeżeniu strony dostanie
   z `/join` błąd „Nieznany awatar" i nie wróci do własnej partii. Pokoje żyją 8 h,
   więc okno jest krótkie, ale realne.
5. W `src/components/AvatarIcon.tsx` dopisać kolory kafelków. Propozycja, dobrana tak,
   by rozjechać się z sąsiadami:

   ```
   frog: "#5FA33C", bee: "#D9A81F", penguin: "#3D4A5C", lion: "#D98E2B",
   octopus: "#C43D7E", unicorn: "#B98FD6", dragon: "#2C8A62", owl: "#B0762F",
   bat: "#453F55", shark: "#3E6B96", jellyfish: "#B25FA0", sloth: "#A8906B",
   crab: "#CC5335",
   ```

6. Sprawdzian końcowy: złóż wszystkie trzydzieści w jeden arkusz i zmniejsz do 40 px.
   Jeśli dwa awatary da się pomylić, zmień **kolor kafelka**, nie ilustrację — to tańsza
   i skuteczniejsza poprawka.
