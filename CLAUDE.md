# Doplay — pamięć projektu

## Co to jest

Multiplayerowe gry imprezowe w przeglądarce. Każdy gracz na swoim telefonie,
wspólny pokój z 4-znakowym kodem. Domena: **doplay.pl**

Do sierpnia 2026 aplikacja nazywała się Domówka. Stąd klucze `domowka-locale`,
`domowka-session` i projekt Firebase `domowka-39gd0` — **tych nazw nie zmieniamy**:
identyfikują dane już zapisane w przeglądarkach graczy i w backendzie.

Gry (9, wszystkie w `registry.ts`): Stoper, Państwa-miasta, Wisielec, Impostor,
Mafia, Odcień, Kasyno, Kółko i krzyżyk, Chińczyk.

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

### Firestore nie przyjmuje tablicy w tablicy

`number[][]` w stanie silnika przechodzi typy, testy i build, a wywala się dopiero przy
starcie partii: `500 INVALID_ARGUMENT: Property publicState contains an invalid nested
entity`. Chińczyk trzyma więc pozycje pionków w JEDNEJ płaskiej tablicy 16 pól
(`idxPionka(kolor, pionek)`), nie w czterech czwórkach.

Mapa z tablicami w wartościach jest dozwolona, ale płaska tablica indeksowana funkcją
czyta się lepiej niż `{"0": [...], "1": [...]}` wracające z bazy jako obiekt.

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
