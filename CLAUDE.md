# Doplay — pamięć projektu

## Co to jest

Multiplayerowe gry imprezowe w przeglądarce. Każdy gracz na swoim telefonie,
wspólny pokój z 4-znakowym kodem. Domena: **doplay.pl**

Do sierpnia 2026 aplikacja nazywała się Domówka. Stąd klucze `domowka-locale`,
`domowka-session` i projekt Firebase `domowka-39gd0` — **tych nazw nie zmieniamy**:
identyfikują dane już zapisane w przeglądarkach graczy i w backendzie.

Gry (8, wszystkie w `registry.ts`): Stoper, Państwa-miasta, Wisielec, Impostor,
Mafia, Odcień, Kasyno, Kółko i krzyżyk.

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
