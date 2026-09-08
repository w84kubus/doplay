# ASSETS.md — manifest obrazów do wygenerowania

Kierunek: **„Ekipa"** (patrz rozmowa, ZADANIE B). Wszystko poniżej to rzeczy, których
**nie da się sensownie zrobić w CSS/SVG** — postać, scena, organiczna tekstura.
Rama aplikacji, zakładki, puste sloty, kształty w tle, cienie, obwódki i ikony
sterowania zostają w kodzie i **nie ma ich w tej tabeli**.

Prompty: `assets/PROMPTS.md`. Przetwarzanie: `scripts/process-assets.py`.

---

## Zasady nazewnictwa

Surowe pliki z Gemini wrzucasz do `assets/zrodla/` pod **ID z tabeli** i rozszerzeniem
`.png` — np. `assets/zrodla/hero-ekipa.png`. Skrypt sam wytnie tło, przytnie do
zawartości i wypluje `@1x` + `@2x` do `public/assets/…`. Nie zmieniaj nazw, bo ID jest
tym, po czym kod będzie sięgał po plik.

---

## Tabela

| ID | Plik docelowy | Wymiary (@2x) | Waga @2x / @1x | Gdzie użyty | Priorytet |
|---|---|---|---|---|---|
| `hero-ekipa` | `public/assets/postacie/hero-ekipa@{1,2}x.webp` | 1600×893 | 111 / 52 kB | `LandingContent.tsx` — hero | **P0** ✅ |
| `howto-pokoj` | `public/assets/sceny/howto-pokoj@{1,2}x.webp` | 454×640 | 25 / 12 kB | `HowToPlay.tsx` — krok 1 | **P0** ✅ |
| `howto-kod` | `public/assets/sceny/howto-kod@{1,2}x.webp` | 640×493 | 41 / 18 kB | `HowToPlay.tsx` — krok 2 | **P0** ✅ |
| `howto-gra` | `public/assets/sceny/howto-gra@{1,2}x.webp` | 640×453 | 40 / 17 kB | `HowToPlay.tsx` — krok 3 | **P0** ✅ |
| `og-tlo` | `public/assets/tla/og-tlo.webp` | 2400×1350 | 100 kB | `opengraph-image.tsx` | **P0** ✅ |
| `ziomek-czeka` | `public/assets/postacie/ziomek-czeka@{1,2}x.webp` | 655×720 | 41 / 19 kB | lobby — pusty stan | P1 ✅ |
| `ziomek-zagubiony` | `public/assets/postacie/ziomek-zagubiony@{1,2}x.webp` | 718×720 | 47 / 21 kB | błąd / offline / brak pokoju | P1 ⚠️ **do powtórzenia** |
| `ziomek-wygrana` | `public/assets/postacie/ziomek-wygrana@{1,2}x.webp` | 645×720 | 48 / 23 kB | `Podium.tsx` | P2 ✅ |

> ⚠️ `ziomek-zagubiony` wyszedł z generatora jako niemal kopia `ziomek-czeka` — ta sama
> miętowa postać w tej samej pozie siedzącej (średnia różnica pikseli 28/255, kolor ciała
> `#80E8B0` vs `#80F0B0`). Prompt prosił o magentę i pozę stojącą ze wzruszeniem ramion;
> obraz referencyjny przeważył nad opisem. Do powtórzenia — patrz `PROMPTS.md`.

| `chinczyk` | `public/games/chinczyk.webp` | 384×384 | — | kafelek gry w lobby i na landingu | P1 ⬜ |

**Osiem pozycji.** Limit to 12 — reszta pomysłów wylądowała w kodzie, nie tutaj.

---

## Czego świadomie NIE ma w tabeli (i dlaczego)

| Element | Decyzja | Uzasadnienie |
|---|---|---|
| Kształty w tle (ukośne „chevrony", winieta, poświata) | **CSS** | `linear-gradient` + `radial-gradient` na warstwie `position: fixed`. Waży zero bajtów i skaluje się na każdy ekran. Obraz musiałby mieć osobne warianty na telefon i TV. |
| Rama aplikacji (ciemny bezel + zaokrąglona karta) | **CSS** | Dwa `border-radius` i jeden kolor tła. |
| Zakładki „teczkowe" (DESIGN.md §4.3) | **CSS** | `rounded-t-[16px]` + brak dolnej krawędzi. Asset uniemożliwiłby zmianę etykiety. |
| Pusty slot gracza (DESIGN.md §4.5) | **SVG inline** | Prosta sylwetka głowa-ramiona, ~12 linii ścieżki. Powtarza się do 15× na ekranie — obraz byłby 15 requestami po to samo, a sylwetka i tak ma być bezosobowa. |
| Podgląd wybranego awatara (duży) | **istniejący pakiet** | Pliki już są w `public/avatars/{id}.webp`. Potrzebny tylko większy eksport: `BOX = 384` w `scripts/build-avatars.mjs`, źródła leżą w `emoji-pack/`. Zero nowych generacji. |
| Ikona losowania awatara („?") | **Lucide** | `Dices` — to kontrolka, nie ilustracja. Ikony sterowania zostają w bibliotece, ilustracje nie. |
| Trofeum / medale na podium | **istniejący pakiet + CSS** | Miejsca 2–3 to `Medal` w kolorze; pierwsze miejsce dostaje `ziomek-wygrana`. Trzy osobne trofea to trzy pliki na jeden ekran oglądany 10 sekund. |
| Konfetti | **kod** | `src/lib/confetti.ts` już to robi. |

---

## Budżet wagowy — zmierzony

**Format zmieniony z PNG na WebP po zważeniu.** Siedem wycinanek waży 3442 kB w PNG
i **357 kB w WebP q82** — dziesięciokrotnie mniej, przy braku widocznej różnicy.
Płaska kreskówka z twardym konturem nie ma czego stracić na kompresji (sprawdzone
na powiększeniu q90 / q82 / q72 — dopiero q72 zaczyna delikatnie mydlić kontur).
Reszta strony i tak jest w WebP: awatary, ikony gier.

| Co pobiera gracz na landingu | @1x | @2x (retina) |
|---|---|---|
| `hero-ekipa` | 52 kB | 111 kB |
| 3× `howto-*` | 47 kB | 106 kB |
| **Razem** | **99 kB** | **217 kB** |

Sufit 150 kB dla @1x — mieścimy się. Retina płaci 217 kB, co przy `srcset` dotyczy
tylko urządzeń, które faktycznie z tego skorzystają.

`og-tlo` (100 kB) nie obciąża gracza — pobierają go tylko crawlery. `ziomek-*` są poza
pierwszym ekranem i idą `loading="lazy"`.

Reguły podawania (do etapu implementacji, nie teraz):
- `hero-ekipa` — `priority`, `sizes` z breakpointami, `@2x` tylko przez `srcset`.
- wszystko poniżej pierwszego ekranu — `loading="lazy"`, jawne `width`/`height` (żeby nie skakał layout).
- `ziomek-zagubiony` na ekranie offline musi być **precache'owany przez Service Workera** —
  inaczej ekran „brak połączenia" nie pokaże obrazka właśnie wtedy, gdy jest potrzebny.
  To jedyny asset z tej listy, który trafia do `src/sw.ts`.

---

## Spójność zestawu

Siedem z ośmiu pozycji przedstawia **te same trzy postacie** (patrz `PROMPTS.md`).
Generuj je **w kolejności z tabeli**: `hero-ekipa` jest wzorcem, każdy kolejny prompt
dostaje go jako załącznik referencyjny. Bez tego postacie rozjadą się w proporcjach
i odcieniach, a zestaw będzie wyglądał jak zlepek z trzech różnych banków obrazów.
Instrukcja łańcuchowa jest na górze `PROMPTS.md`.
