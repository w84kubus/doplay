# Doplay — pamięć projektu

## Co to jest

Multiplayerowe gry imprezowe w przeglądarce. Każdy gracz na swoim telefonie,
wspólny pokój z 4-znakowym kodem. Domena: **doplay.pl**

Do sierpnia 2026 aplikacja nazywała się Domówka. Stąd klucze `domowka-locale`,
`domowka-session` i projekt Firebase `domowka-39gd0` — **tych nazw nie zmieniamy**:
identyfikują dane już zapisane w przeglądarkach graczy i w backendzie.

Gry (11, wszystkie w `registry.ts`): Stoper, Państwa-miasta, Wisielec, Impostor,
Mafia, Odcień, Kasyno, Kółko i krzyżyk, Chińczyk, Czwórki, Statki.

Stack: Next.js 15 (App Router) + TypeScript strict + Tailwind v4 + Firebase (Firestore + Anonymous Auth) + Vercel.

## Specyfikacja

Pełny spec: **`SPEC.md`** w rootcie repo. Nie jest ładowany automatycznie — czytaj na żądanie.

- Przed pracą nad grą: przeczytaj sekcję 3 (architektura) + sekcję tej gry (5.x).
- Po `/compact`: przeczytaj sekcję 3 ponownie.

## Zasady nienegocjowalne

1. **IMPORTANT: Klient NIGDY nie zapisuje stanu gry do Firestore.** Wszystkie zapisy idą przez Route Handlery + `firebase-admin`. Klient tylko czyta (`onSnapshot`). Złamanie tej zasady rozwala Mafię i Impostora — role byłyby widoczne w DevToolsach.

2. Role, tajne hasła i odpowiedzi innych graczy nigdy nie trafiają do `publicState`. Tajne dane żyją w `rooms/{kod}/secret/state` (reguła: `allow read: if false`) i `rooms/{kod}/private/{uid}`.

3. `engine.ts` każdej gry jest **czystą funkcją**. Zero `Date.now()`, zero `Math.random()`. Czas i losowość wchodzą przez `ctx.now` i `ctx.rng`.

4. Dodanie nowej gry = nowy folder w `src/games/` + wpis w **rejestrach** (pełna lista w konwencjach niżej). **Zero zmian w logice rdzenia** — żadnych warunków w stylu „jeśli gra == X" w `GameShell`, `game-runner` czy na stronie pokoju. Jeśli uważasz, że rdzeń wymaga zmiany — zatrzymaj się i zapytaj. Nie zmieniaj po cichu.

5. **Kod i komentarze po polsku. Interfejs dwujęzyczny** — każdy tekst widoczny dla gracza przez `t("klucz")` z `dict.ts`, zero napisów na sztywno. Fonty muszą mieć `latin-ext` (Ą Ć Ę Ł Ń Ó Ś Ź Ż). **Press Start 2P, Orbitron i VT323 nie mają polskich znaków — nie używaj.**

6. Mobile-first. Przyciski min. 56 px. `100dvh`, nie `100vh`. Pomiar czasu w Stoperze: `performance.now()`, nigdy `setInterval`.

7. `export const runtime = 'nodejs'` w każdym Route Handlerze — `firebase-admin` nie działa na Edge.

## Styl pracy

- Rób tylko bieżącą fazę. Nie refaktoruj rzeczy spoza zakresu.
- Gdy wahasz się między dwoma podejściami — przedstaw oba i zapytaj, nie decyduj sam.
- Przed zgłoszeniem „gotowe" odpal `npm test` i `npm run build`. Oba muszą przejść.
- Commit po każdej fazie, nie jeden wielki commit na końcu.

## Komendy

```
npm run dev
npm run build
npm test
npm run lint
firebase deploy --only firestore:rules
```

## Stan projektu

<!-- odhaczaj po każdej fazie -->

- [x] Faza 0 — setup, Firebase, auth, deploy hello-world na Vercel
- [x] Faza 1 — pokoje, lobby, presence, reconnect, QR, ekran hosta
- [x] Faza 2 — silnik gier + registry (walidacja na Stoperze; kółko i krzyżyk pominięte wtedy na życzenie Jakuba, dorobione później)
- [x] Faza 3 — Stoper: oba tryby gotowe — A „CEL" i B „ZGADNIJ CZAS" (rotacja Biegacza, beep/klik do wszystkich, typowanie stepperem; czas i typy tajne do odsłonięcia)
- [x] Faza 4 — Państwa-miasta (zweryfikowane na produkcji: tajność pisania, kwestionowanie, dedup, punktacja)
- [x] Faza 5 — Wisielec: 3 tryby (wyścig/kooperacja/zadający) w silniku + UI (klawiatura PL, SVG szubienicy); kooperacja zweryfikowana na produkcji (tajność hasła)
- [x] Faza 6 — Impostor: role/hasło tajne, 5 wariantów podpowiedzi (+ „nie wie, że jest impostorem"), głosowanie, zgadywanie po wylocie; zweryfikowane na produkcji (brak wycieku w publicState)
- [~] Faza 7 — Mafia: RDZEŃ gotowy i zweryfikowany na produkcji (mafia/mieszkańcy/detektyw/lekarz + auto-narrator, rozliczenie nocy, warunki wygranej, role tajne). Do zrobienia: role dodatkowe (§5.6) + tryb z prowadzącym
- [~] Faza 8 — polish: PWA (instalowalna, manifest+SW+ikona), Wake Lock (ekran nie gaśnie), konfetti+fanfara na wygranych — zweryfikowane na produkcji. Zostało: role dodatkowe Mafii (§5.6)

## Upgrade v2 — aktualny stan

- [x] Faza A — audyt (`AUDIT.md`): bezpieczeństwo OK, 0 [KRYTYCZNE], lista braków vs SPEC
- [x] Faza B — PWA: Serwist SW (NetworkOnly /api/ + Firebase), manifest kompletny (id/scope/shortcuts), ikony PNG (any+maskable+apple), prompt instalacji (beforeinstallprompt + iOS hint), ekran offline, useVisualViewport, useVibrate, user-scalable=no usunięte globalnie
- [x] Faza C — realtime: resync zegara po tła, powrót do pokoju (localStorage), migracja hosta na rozłączeniu (>30s via ping), actionId idempotencja, reset w transakcji, pasek połączenia, wykładniczy backoff
- [x] Faza D — wygląd: skeleton lobby, neon click-to-copy + ambient glow, slideIn/fadeIn animacje, timer-urgent pulsacja, nowe SFX (join/phaseChange/neonBuzz/defeat), ekran hosta TV (8rem kod, duże awatary), prefers-reduced-motion
- [x] Faza E — wydajność: dynamic imports gier (next/dynamic), manifests.ts (klient bez engines), selektywne private writes (JSON diff), debounce pingów 10s, /pokoj 339→314kB, / 110kB OK
- [x] Faza F — jakość: ErrorBoundary per trasa gry, strukturalny logger (room/game/phase), tsconfig strict OK, zero any w prod, testy pokrywają pełne partie + bezpieczeństwo (dziś **255 testów w 15 plikach**)
- [x] Faza G — dopracowanie: ShareButton (navigator.share + fallback clipboard), deep link /?kod=XYZW, GameRulesCard (modal z krokami per gra), rules.ts (wszystkie 7 gier), rekordy pokoju. Zostało: unikalne awatary, dołączanie jako widz
- [x] Faza H — dwujęzyczność PL/EN: cały interfejs, widoki wszystkich gier, ekran TV,
      karty zasad i polityka prywatności. 479 kluczy na język w `dict.ts`
- [x] Faza I — rebranding Domówka → **Doplay** i własna domena `doplay.pl`
      (apex 308 → `www`, `domowka.vercel.app` 308 → `www`; repo: `w84kubus/doplay`)
- [x] Faza J — porządki w warstwach Tailwinda (`@layer components`), przebudowa
      zrzutów w README, koordynacja pasków przy dolnej krawędzi
- [x] Faza K — sprzątanie bazy: cron kasujący wygasłe pokoje z podkolekcjami,
      poprawka `leave` (nie zostawia sierot), plan Blaze zamiast Spark
- [x] Faza M — Chińczyk: silnik, geometria planszy, widoki, animacje, boty
      i własna ilustracja kafelka (wszystkie 4 fazy)
- [x] Faza L — publiczne pokoje: trzecia zakładka z listą otwartych pokoi,
      przełącznik hosta w lobby, wejście do losowego, limit graczy w `join`;
      wcześniej naprawa faz, które czekały na gracza bez terminu

### Co realnie zostało

<!-- Kasyno: double i wheel zweryfikowane w rozgrywce 2026-08-29 — wypłaty ×2,
     eskalacja wpisowego co 5 rund, bankructwo i eliminacja. Sloty i jackpot działały wcześniej. -->

- Mafia: role dodatkowe (SPEC §5.6) + tryb z prowadzącym

## Konwencje, które łatwo przeoczyć

### Opt-in silnika

Rdzeń nie zna żadnej konkretnej gry — dwie rzeczy działają przez opt-in silnika, nie przez
wiedzę rdzenia o grach. Dzięki temu zasada 4 zostaje nienaruszona: nowa gra bez tych opt-inów
po prostu działa, tylko bez danej funkcji.

- **Rekordy pokoju.** Silnik oznacza swoje zdarzenie `meta: { uid, rekord: true }`, a rdzeń
  dopisuje je do wyróżnień. Zgłaszają: Stoper (idealne trafienie), Impostor (odgadł hasło po
  wylocie), Mafia (wygrana w pojedynkę). Logika w `lib/server/records.ts`.
- **Zakończenie gry.** Silnik wystawia `canFinish` w `publicView` dla fazy, z której wypada
  skończyć (zwykle ekran wyników). `GameShell` pokazuje wtedy „Zakończ grę" — jedna
  implementacja dla wszystkich gier — a poza tą fazą awaryjne „Przerwij i wróć do lobby".
  Różnica jest istotna: zakończenie daje podium i zapisuje rekordy, przerwanie nie.
  Kontrakt pilnuje `src/games/finish.test.ts`, iterując po całym rejestrze.

### Rejestry, w które wpina się nowa gra

Zasada 4 mówi „wpis w rejestrach" — to jest ich pełna lista. Pominięcie któregokolwiek
**nie wywoła błędu typów**: gra po prostu przestaje działać w jednym miejscu, co jest
znacznie trudniejsze do zauważenia niż czerwony build.

| Plik | Po co | Skutek pominięcia |
|---|---|---|
| `games/registry.ts` | manifest + silnik (serwer) | gry nie da się wystartować |
| `games/manifests.ts` | manifest bez silnika (klient) | nie pojawia się w lobby ani na landingu |
| `games/components.tsx` | `Settings`, `PlayerView`, `HostView` | pusty ekran po starcie |
| `games/icons.tsx` | ikona na karcie i w lobby | brak ikony |
| `games/rules.ts` | karta „Jak grać?" — PL i EN osobno | przycisk zasad nic nie pokazuje |
| `lib/i18n/dict.ts` | `game.{id}.name` i `game.{id}.tagline` | zamiast nazwy widać surowy klucz |

Ilustrowany kafelek to osobna, OPCJONALNA rzecz: plik `public/games/{id}.webp` (192x192,
przezroczysty) plus id w `ILLUSTRATED` w `components/GameIcon.tsx`. Gra bez tego dostaje
ikonę Lucide i działa normalnie — ale stoi w lobby obok dziesięciu rysunków jako płaski
znaczek i widać to natychmiast. Obrazki z Gemini mają kratkę przezroczystości WRYSOWANĄ
w JPEG, więc alfę robi się samemu: `scripts/kafelek.py` wycina tło wypełnieniem od
krawędzi (progiem na biel nie można — biel jest też w rysunku), przycina i skaluje.

To są tablice rejestracyjne, nie logika — rdzeń nadal nie zna żadnej konkretnej gry.
Sprawdzone przy dodawaniu Kółka i krzyżyka: sześć testów kontraktu z `finish.test.ts`
przeszło od razu, bez dotykania `GameShell` ani `game-runner`.

### Dwujęzyczność (PL/EN)

Reguła jest w zasadzie 5; tu rzeczy, które z niej nie wynikają.

- Język trzyma ciasteczko `domowka-locale`; serwer czyta je **przed pierwszym
  renderem** (layout.tsx), więc nie ma migotania. Świadomie bez biblioteki:
  `next-intl` wymusiłby prefiks języka w adresie, a w URL-ach siedzą kody pokoi.
- Pułapka, w którą łatwo wpaść: **skanowanie źródeł nie wystarczy** do sprawdzenia,
  czy wszystko przetłumaczone. Część napisów powstaje przez interpolację
  (`` `Runda ${n}` ``) albo doklejenie (`" (Ty)"`) i grep ich nie łapie. Jedyna
  pewna metoda: przełączyć aplikację na EN i przeczytać realny render.
- Wisielec **celowo** zostaje częściowo polski: klawiatura ekranowa i nazwy
  kategorii („Zwierzęta"), bo listy haseł są polskie. Angielska etykieta nad
  polskimi słowami myliłaby bardziej niż pomagała.

### Paski przy dolnej krawędzi

`src/lib/client/notices.ts` koordynuje wszystko, co jest `fixed` przy dole:
informację o prywatności i zachętę do instalacji PWA.

- Zasada: **jeden komunikat naraz i nigdy na sterowaniu**. Nie układamy w stos.
- Ekran może zgłosić `claimBottom()`, że dolna krawędź należy do niego —
  `GameShell` robi to na czas gry, więc oba paski milkną i nie wchodzą na
  „Przerwij i wróć do lobby". Rdzeń nie wie, że to gra: zgłosić się może dowolny
  komponent, więc zasada 4 zostaje nienaruszona.
- Informacja o prywatności jest wtedy **odkładana, nie oznaczana jako zobaczona** —
  inaczej gracz, który dołączył w trakcie rundy, nigdy by jej nie zobaczył.

### Style

Klasy komponentów (`.btn`, `.card`, `.screen`) żyją w `@layer components`
w `globals.css`. To nie kosmetyka: bez warstwy miały tę samą specyficzność co
utility Tailwinda i wygrywała kolejność w pliku, więc `rounded-tr-none` po cichu
nie nadpisywało `.card`.

### Kasowanie pokoju zawsze przez `recursiveDelete`

Zwykłe `delete()` na dokumencie pokoju **nie rusza podkolekcji**. `secret/state`
i `private/{uid}` zostają wtedy w bazie bez rodzica: niewidoczne w konsoli, poza
zasięgiem crona (szuka po `expiresAt`, a nieistniejący dokument nie ma pól) i pełne
ról graczy. Tak nazbierało się 74 osieroconych dokumentów, zanim ktokolwiek zauważył.

- Kasujesz pokój → `db.recursiveDelete(ref)`. Bez wyjątków.
- W transakcji się nie da. Wzorzec z `leave/route.ts`: flaga ustawiana w środku
  transakcji (**zerowana na starcie każdej próby**, bo Firestore powtarza callback),
  `recursiveDelete` po zatwierdzeniu.
- Natywne TTL Firestore z tego samego powodu odpada — kasuje tylko rodzica.
  Stąd własny cron `/api/cron/cleanup` (`vercel.json`, raz na dobę).

Sam miniony `expiresAt` nie wystarcza do skasowania: partia może trwać dłużej niż
8 h. Drugim warunkiem jest godzina ciszy od ostatniego pinga — pokój z żywym
graczem czeka do jutra. Logika wyboru siedzi w `lib/server/cleanup.ts`, celowo bez
`server-only` i bez firebase-admin, żeby dała się przetestować jak zwykła funkcja.

Ten sam cron ma **zamiatarkę sierot** — dokumenty w `private`/`secret` bez rodzica.
Niebezpieczny jest tu wyścig, nie kasowanie: pokój założony po odczycie listy pokoi
nie ma rodzica *na naszej liście*, choć żyje. Dlatego progiem jest `readTime`
zapytania, a nie „starsze niż godzina" — bierzemy wyłącznie dokumenty zapisane
przed zdjęciem listy. Oba czasy z zegara Firestore, nigdy z `Date.now()` procesu.

Bramka crona zamyka się przy braku `CRON_SECRET` (odpowiada 401), zamiast otwierać
trasę dla wszystkich. Sekret jest w Vercelu i w `.env.local`.


### Publiczne pokoje

Pokój z flagą `public` trafia na listę pod `/publiczne`. Host przełącza ją w lobby,
w obie strony. Rzeczy, które łatwo cofnąć przez nieuwagę:

- **Reguły Firestore zostają zamknięte.** Kuszące „albo pokój jest publiczny" w regule
  pozwoliłoby każdemu zalogowanemu czytać CAŁY dokument dowolnego publicznego pokoju
  bez wchodzenia do niego. Listę serwuje `GET /api/rooms/publiczne` przez Admin SDK.
  Cena: brak realtime, odpytywanie co 10 s.
- **Na liście nie ma nicków ani żadnego tekstu wpisanego przez gracza.** To jedyny ekran
  widoczny dla kogoś spoza pokoju. Pilnują tego dwa testy: na dokładny zestaw pól
  i na nick ze znacznikami HTML. Dokładanie pól do `PubliczyPokoj` wymaga tej samej ostrożności.
- **Nazwy gry na kafelku nie ma świadomie.** W lobby `gameId` dokumentu jest ZAWSZE null:
  wybór gry to stan klienta do startu, a `reset` zeruje pole. Kafelek pokazywałby
  „gra jeszcze niewybrana" na każdej pozycji.
- **Próg porzucenia to 5 minut, nie 20 s** od kropki „online". Ping milknie już przy
  przełączeniu na inną aplikację. Obie pomyłki kosztują różnie: pokazany martwy pokój to
  jedno nieudane dołączenie z czytelnym błędem, ukryty żywy to gracz, którego nikt nie
  znajdzie — czyli dokładnie to, czemu ta lista ma zapobiec.

`join` ma limit graczy liczony z rejestru manifestów (`MAX_W_POKOJU`), nie wpisany na
sztywno. Do tej fazy limitu nie było wcale — kontrola `maxPlayers` siedziała dopiero
w `startGame`, więc publiczny pokój mógłby nazbierać tylu obcych, że żadnej gry nie da
się odpalić, a błąd zobaczyłby dopiero host przy starcie.

### Funkcje muszą stać obok bazy, nie obok użytkownika

Firestore tego projektu siedzi w `europe-central2`, czyli w Warszawie. Funkcje na Vercelu
domyślnie ruszają w `iad1` (Waszyngton) i nikt tego nie zauważa, bo nic się nie psuje —
jest tylko WOLNO, i to tym bardziej, im więcej graczy.

Droga jednego kliknięcia wyglądała tak: telefon w Polsce → edge w Sztokholmie → funkcja
w Waszyngtonie → Firestore w Warszawie → i z powrotem tą samą trasą. Atlantyk dwa razy
na każdy round trip do bazy, a transakcja potrzebuje co najmniej dwóch: odczytu
i zatwierdzenia.

Zmierzone przed zmianą (`scripts/pomiar-api.sh`, z Polski, produkcja):

- `/api/time`, endpoint zwracający samo `Date.now()` — **260 ms**,
- `/api/rooms/publiczne`, jedno zapytanie do Firestore — **400 ms**,
- czyli sam round trip funkcja→baza kosztował **~140 ms**.

Stąd `"regions": ["fra1"]` w `vercel.json`. Frankfurt jest ~20 ms od Warszawy zamiast ~140.
Vercel nie ma polskiego regionu, a plan Hobby pozwala wybrać dokładnie jeden — i o to chodzi.

Dwie rzeczy, które warto rozumieć przy diagnozie następnym razem:

- **Odczyty były szybkie przez cały czas.** Klient czyta Firestore BEZPOŚREDNIO przez
  `onSnapshot`, Polska→Warszawa to ~20 ms. Przez Vercela idą tylko ZAPISY (zasada 1).
  Dlatego objaw jest mylący: cudze ruchy pojawiają się natychmiast, a własne kliknięcie
  wisi. Kto tego nie wie, zaczyna podejrzewać realtime albo hosting.
- **Dlatego jest gorzej przy większej liczbie graczy.** Baza ma `concurrencyMode:
  PESSIMISTIC`, więc transakcja trzyma blokadę na dokumencie pokoju. Im dłuższy round trip,
  tym dłużej blokada jest zajęta, a wszyscy piszą do tego samego dokumentu. Skrócenie
  round tripu skraca blokadę i rywalizacja znika sama, bez zmian w kodzie.

Region sprawdza się nagłówkiem: `x-vercel-id: arn1::iad1` znaczy „wszedł w Sztokholmie,
wykonał się w Waszyngtonie". Lokalizację bazy da się odczytać z Admin API
(`GET https://firestore.googleapis.com/v1/projects/{id}/databases/(default)` → `locationId`).

Następny próg, gdyby kiedyś było trzeba: pingi piszą do `rooms/{kod}`, czyli do JEDNEGO
dokumentu, a Firestore wytrzymuje tam około jednego zapisu na sekundę. Przy ośmiu graczach
same pingi to ~0,8 zapisu/s, zanim ktokolwiek zrobi ruch. Lekarstwem jest przeniesienie
obecności do `rooms/{kod}/presence/{uid}` — każdy pisze do swojego dokumentu i nikt z nikim
nie konkuruje, a ping przestaje budzić listenery pozostałych. To już zmiana w rdzeniu
(obecność, migracja hosta, kasowanie pokoju), więc nie na zapas.

### Firestore nie przyjmuje tablicy w tablicy

`number[][]` w stanie silnika przechodzi typy, testy i build, a wywala się dopiero przy
starcie partii: `500 INVALID_ARGUMENT: Property publicState contains an invalid nested
entity`. Chińczyk trzyma więc pozycje pionków w JEDNEJ płaskiej tablicy 16 pól
(`idxPionka(kolor, pionek)`), nie w czterech czwórkach.

Mapa z tablicami w wartościach jest dozwolona, ale płaska tablica indeksowana funkcją
czyta się lepiej niż `{"0": [...], "1": [...]}` wracające z bazy jako obiekt.

### Gra z trwałą ukrytą planszą (Statki)

Impostor i Mafia chowają ROLĘ, Państwa-miasta odpowiedzi jednej rundy. Statki są pierwsze
z trwałym, prywatnym układem, który przeciwnik odkrywa przez całą partię — i to zmienia
sposób testowania, nie samą architekturę (flota leży w `secret/state` jak każdy sekret).

- **`publicView` wystawia wyłącznie SKUTKI strzałów**: trafienia, pudła i pola zatopionych.
  Nigdy floty ani niczego, z czego da się ją odtworzyć.
- Wyciek tutaj **nie wywala partii i nie rzuca wyjątkiem** — po prostu ktoś z otwartym
  DevToolsem wygrywa każdą partię i nikt nie wie dlaczego. Dlatego tajność ma własny plik
  testów (`tajnosc.test.ts`), osobny od reguł gry.
- Właściwy test tajności to **nierozróżnialność, nie „nie ma pola X"**: przesunięcie
  NIETKNIĘTEGO statku w dowolne inne dopuszczalne miejsce musi dać bajt w bajt ten sam
  `publicView`. Pierwsza wersja porównywała liczby w całym widoku i nie działała — obie
  plansze numerują pola tak samo, więc pole 50 gracza A wyglądało jak wyciek pola 50 gracza B.
- **Ekran TV dostaje sam `publicState`**, więc nie ma z czego narysować floty. To nie jest
  ostrożność widoku, tylko konsekwencja kontraktu — i dlatego działa bez pilnowania.
- **Bot dostaje dokładnie to, co widzi człowiek** (własne strzały i ich skutki), a nie stan
  silnika. Inaczej grałby bezbłędnie, a wyciek mógłby się kiedyś przelać do widoku.
- Pole `sklad` w widoku publicznym nazywa się tak, a nie `flota`, świadomie: dwa pola o tej
  samej nazwie, jedno jawne i jedno tajne, prosiłyby się o pomyłkę przy dokładaniu czegokolwiek.

Osobno warto zapamiętać pułapkę, którą wyłapał dopiero test rekordu: `zakoncz` PODMIENIAŁ
bufor zdarzeń, więc wygrana w ostatniej rundzie kasowała zdarzenia tej rundy — a przy
domyślnym ustawieniu Statków (jedna partia) wygrana ZAWSZE wypada w ostatniej. Ginął
komunikat o zwycięstwie i rekord za suchą wygraną. Zdarzenia rundy trzeba DOKLEIĆ do
zdarzenia końca gry. To samo dotyczyło Czwórek i zostało poprawione razem.

### Przeciąganie palcem po planszy

Ustawianie floty w Statkach idzie przeciąganiem (Pointer Events). Cztery rzeczy decydują
o tym, czy gest jest znośny, i każda z nich osobno potrafi go zepsuć:

- **Podgląd lokalny, zanim wróci serwer.** Klient nadal nie zapisuje stanu gry (zasada 1) —
  to wyłącznie podgląd w `useState`, czyszczony, gdy serwer przyśle to samo ustawienie,
  plus bezpiecznik czasowy na wypadek odrzucenia. Bez tego statek stał w starym miejscu
  przez całą podróż do Firestore'a i z powrotem, a ręka była już gdzie indziej. Zmierzone:
  2 ms do odrysowania zamiast pełnego obiegu sieciowego.
- **Chwycony kawałek zostaje pod palcem.** Przenoszenie DZIOBA na wskazane pole sprawia,
  że złapanie czteromasztowca za rufę przerzuca go o trzy pola w bok.
- **Dociskanie do krawędzi zamiast odmowy.** Palec celuje w statek, nie w jego dziób,
  więc przy ścianie ustawienie trzeba cofnąć, a nie uznać za nielegalne. Ta sama funkcja
  (`dziobWPlanszy`) obsługuje obrót — bez niej obrót przy prawej krawędzi po cichu nic
  nie robił i przycisk wyglądał na zepsuty.
- **`touch-action: none` TYLKO na statkach.** Na całej kracie odbiera przewijanie strony,
  a ekran ustawiania jest wyższy niż telefon.

Pozostałe pułapki: `setPointerCapture` w `try/catch` (bez przechwytywania gest nadal
działa, bo pole liczymy ze współrzędnych przez `elementFromPoint`, a stan gestu jest
wspólny dla całej kraty), oraz zduszenie `click`, które przeglądarka wysyła po
przeciągnięciu na pole startowe — inaczej jedno pociągnięcie robi dwie rzeczy naraz.

Dotknięcie zostaje jako DRUGA droga do tego samego: przeciągania nie obsłuży klawiatura
ani czytnik ekranu.

Przy sprawdzaniu w przeglądarce: faza ustawiania ma termin (domyślnie 45 s). Debugowanie
trwa dłużej, więc połowa moich prób przeciągania poszła po ekranie STRZELANIA i wyglądała
na niedziałający gest. Najpierw `document.body.innerText`, potem wnioski.

### Plansza zna tylko PUŁAP rozmiaru, nigdy rzeczywisty

Komponent planszy dostaje `rozmiar` jako górną granicę pola. Realny rozmiar wychodzi dopiero
z szerokości ekranu albo z limitu wysokości i bywa o połowę mniejszy. Każda wartość policzona
z pułapu w pikselach rozjeżdża się wtedy z tym, co widać — a rozjazd jest niewidoczny na
telefonie, na którym się to pisze, i uderza dopiero na telewizorze.

W Czwórkach kosztowało to dwie pomyłki: obwódka `0,16 × 110 px` na polu, które wyszło 65 px,
zamieniła zwycięską czwórkę w cztery obwarzanki z punkcikiem w środku, a odstęp 6 px przy polu
38 px dał 16 % zamiast zaplanowanych 13 %.

- Promienie i obwódki: `radial-gradient` w procentach PROMIENIA, nie `border` ani `box-shadow`.
- Odstępy: `margin` w procentach (liczy się od szerokości pola), nie `gap` (procent odstępu
  w kolumnie liczyłby się od jej wysokości, którą same pola dopiero wyznaczają).
- Animacja spadania: `translateY` w procentach własnej wysokości.
- Cień głębi otworu może zostać w pikselach — kilka pikseli wygląda tak samo w każdej skali.

Sprawdzać pomiarem, nie okiem: `getBoundingClientRect` dwóch sąsiednich pól i stosunek odstępu
do szerokości pola musi wyjść tak samo na telefonie i na ekranie TV.

Drugi wniosek z tej samej gry: **plansza wyższa niż Kółko musi mieć limit WYSOKOŚCI**, nie tylko
szerokości. Sześć rzędów dobranych do szerokości schodziło poniżej ekranu 1280x720 i z sześciu
rzędów widać było trzy. Limit wchodzi przez `maxWidth: min(Xpx, Ydvh)` — tak samo jak
w Chińczyku (`min(42rem, 72dvh)`), bo to szerokość rządzi rozmiarem pola.

### Boty jeżdżą na istniejących tickach

Bot to zwykły wpis w `players` z flagą `bot: true`. Nie ma tokenu, nie pinguje i nigdy
nie wyśle akcji — jego turę wykonuje ten sam mechanizm, który gra za nieobecnego
człowieka: termin fazy mija, host ponagla `/tick`, silnik dostaje `PHASE_TIMEOUT`.
Silnik chińczyka daje slotom botów 1,2 s zamiast ustawionego limitu, więc ten termin
jest jednocześnie pauzą „na myślenie", a kostka zdąży się doturlać.

Wybrane świadomie zamiast haka `bot?()` w `GameEngine`: tamto oznaczałoby nowe pole
w kontrakcie wszystkich gier i osobną pętlę odpytywania przez całą partię.

Rdzeń musi znać flagę w czterech miejscach — pominięcie któregokolwiek psuje coś cicho:

- **obecność** (`isConnected`): bot jest zawsze online, inaczej lista wyszarza go po 20 s,
- **migracja hosta** (`pickNewHost`): bot NIE może zostać hostem, bo nie odpala ticków
  i partia stanęłaby na pierwszej fazie z terminem,
- **kasowanie pokoju** (`leave`): pokój z samymi botami jest pusty i idzie do skasowania,
  inaczej żyłby do wygaśnięcia TTL, zajmując kod,
- **termin tury**: liczony dla koloru, który PRZEJMUJE ruch, nie dla kończącego —
  inaczej człowiek po bocie dostaje 1,2 s, a bot po człowieku pełne 20 s.

Mózg (`games/chinczyk/bot.ts`) jest czystą funkcją na liczbach i gra nim także nieobecny
człowiek. Poziom jest jeden i celowo „rozsądny": bije, kończy pionki, chowa się na pola
bezpieczne, nie liczy wariantów w głąb.

Przycisk w lobby jest ograniczony limitem WYBRANEJ gry, nie `MAX_W_POKOJU` — inaczej host
dosadziłby chińczykowi piętnaście botów i dowiedziałby się o tym przy „Zaczynamy".

**Boty są opt-inem manifestu (`wspieraBoty`), nie funkcją całego rdzenia.** Bot rusza się
tylko tam, gdzie silnik przy `PHASE_TIMEOUT` gra ZA nieobecnego. Dziś deklarują to Chińczyk,
Czwórki i Statki. W Stoperze, Państwach-miastach, Odcieniu i Kasynie termin tylko przewija fazę, więc
bot byłby milczącym miejscem przy stole; w Mafii i Impostorze wręcz szkodliwym — rolą, która
nigdy nie zadziała. Przycisk nie pokazuje się bez tej deklaracji, a `startGame` odmawia startu
gry bez `wspieraBoty`, gdy w pokoju został bot z POPRZEDNIEJ partii.

`games/boty.test.ts` pilnuje kontraktu na całym rejestrze, ale łapie tylko część przypadków
(Mafię, Impostora, Wisielca) — zasięg opisany w samym pliku. Przy dokładaniu botów do kolejnej
gry czyta się jej `PHASE_TIMEOUT`, a nie zielony test.

### Faza, która czeka na gracza, musi mieć termin

`phaseEndsAt: null` w fazie, która czeka na akcję konkretnych ludzi, to zakleszczenie.
Tak było w `rozdaniu` Impostora i Mafii: czekały na `CONFIRM` od wszystkich, a ani
`PHASE_TIMEOUT`, ani hostowy `NEXT` tej fazy nie obsługiwały. Jeden gracz, któremu padł
telefon, zawieszał partię reszty bez wyjścia poza przerwanie gry.

- Termin włącza istniejący mechanizm ticków, więc poprawka mieści się w silniku.
  `ActionContext` nie wie nic o rozłączeniach i nie musi.
- Limity hojne: mają łapać tych, którzy odeszli od stołu, a nie poganiać grających.
  Tura podpowiedzi skaluje się z liczbą graczy, bo w trybie „na głos" mówi się po kolei.
- Kto nie zdążył, **nie wypada z gry** — rola zostaje, po prostu przestajemy czekać.
- Pułapka pokryta testem: kolejna tura musi dostać ŚWIEŻY termin. Odziedziczony byłby
  już miniony i wygasałby natychmiast.

### Service worker potrafi udawać błąd aplikacji

`next.config.ts` wyłącza Serwista w dev, ale `public/sw.js` z ostatniego builda
produkcyjnego **dalej leży na dysku i jest serwowany**. `ServiceWorkerRegister`
rejestrował go bezwarunkowo, więc sesja deweloperska chodziła pod workerem
zbudowanym z INNEGO bundla i dostawała od niego chunki tamtej wersji.

Objawy nie wyglądają na problem z cache i o to w nich najgorsze:

- `Invalid or unexpected token` w konsoli, choć `npm run build` przechodzi czysto,
- ekran zawieszony na skeletonie, mimo że reguły i token są w porządku,
- surowe klucze słownika (`stoper.gameOver`) zamiast tekstów.

Komponent nie rejestruje już workera poza produkcją i **wyrejestrowuje ten, który
został**. To drugie jest ważniejsze: `unregister()` działa dopiero, gdy zamkną się
wszystkie kontrolowane karty, a twarde odświeżenie go nie rusza. Kto już ma workera
w przeglądarce, odzyska normalne działanie dopiero po tej poprawce.

Diagnostyka na przyszłość: `navigator.serviceWorker.controller` w konsoli. Jeśli nie
jest `null` na `localhost`, to najpierw podejrzewaj jego, a nie własny kod. Origin
obejmuje port, więc drugi port to czysta przeglądarka — ale **dwa serwery dev naraz
rozjeżdżają wspólny `.next`** i sypią `Expected clientReferenceManifest to be defined`.
Wtedy jeden serwer, `rm -rf .next` i od nowa.

### Pakiet awatarów to same postacie

Po wymianie w ETAP-ie 11 wszystkie 30 awatarów ma twarz. Kryterium jest twarde:
awatar odpowiada na pytanie „kim jestem przy tym stole" i na to nie da się odpowiedzieć
jajkiem ani kotwicą. Trzynaście martwych przedmiotów wypadło, pizza i piwo poszły za nimi.

Wycofane identyfikatory **zostają w `LEGACY_AVATARS`**, nigdy nie znikają. Gracz siedzący
w pokoju ze starym awatarem inaczej dostałby z `/join` „Nieznany awatar" i nie wróciłby
do własnej partii. Drugą warstwą jest migracja sesji w `store/session.ts`: podmienia
zapisany awatar na domyślny, zanim formularz zdąży go wysłać.

Kolor kafelka (`avatarColor`) jest ważniejszy niż sylwetka. Przy trzydziestu okrągłych
ikonach po 40 px to on decyduje, czy da się je odróżnić — dlatego żyrafa dostała turkus,
a tygrys ciemne kakao, choć obie postacie są ciepłe.
