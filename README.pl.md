<p align="center">
  <img src="public/icon-512.png" width="96" height="96" alt="Doplay logo" style="border-radius: 20px" />
</p>

<h1 align="center">Doplay</h1>

<p align="center">
  <a href="README.md">English</a> · <b>Polski</b>
</p>

<p align="center">
  Imprezowe gry multiplayer w przeglądarce. Każdy na swoim telefonie, jeden wspólny pokój.
  <br />
  <a href="https://doplay.pl"><strong>🔗 doplay.pl</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript strict" />
  <img src="https://img.shields.io/badge/Firebase-Firestore+Auth-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white" alt="Tailwind v4" />
  <img src="https://img.shields.io/badge/PWA-instalowalna-5A0FC8?logo=pwa&logoColor=white" alt="PWA" />
  <img src="https://img.shields.io/badge/multiplayer-realtime-E4002B" alt="Multiplayer Realtime" />
  <img src="https://img.shields.io/badge/testy-287-7CF0AE?logo=vitest&logoColor=black" alt="287 testów" />
</p>

---

## O aplikacji

**Doplay** to zestaw imprezowych gier multiplayer, w które gracie na jednym spotkaniu — każdy na swoim telefonie. Bez kont, bez pobierania, bez tłumaczenia zasad. Jedna osoba zakłada pokój, reszta wpisuje 4-znakowy kod i za **15 sekund gracie**.

### Jak to działa?

1. 🏠 **Host zakłada pokój** — dostaje 4-literowy kod + QR
2. 📱 **Gracze dołączają** — wpisują kod na swoim telefonie (lub skanują QR)
3. 🎮 **Host wybiera grę** — ustawienia, start, gramy!
4. 🔄 **Kolejna runda** — po zakończeniu wracasz do lobby i wybierasz następną

## Zrzuty ekranu

Cztery ekrany — strona główna, dołączanie, lobby i runda w trakcie — w obu językach.
Interfejs przełącza się w całości: nic nie zostaje przetłumaczone do połowy.

**Polski**

![Doplay po polsku: strona główna, dołączanie do pokoju, lobby i runda Wisielca](docs/screenshots/telefony-pl.webp)

**English**

![Doplay po angielsku: strona główna, dołączanie do pokoju, lobby i runda Wisielca](docs/screenshots/telefony-en.webp)

### Ekran hosta (TV)

Osobny układ poziomy na laptopa albo telewizor — wielki kod pokoju, QR do zeskanowania i kto już jest.
Otwierasz go z lobby; gracze zostają przy swoich telefonach.

![Ekran hosta na telewizorze: kod pokoju M2R5, kod QR i pięcioro graczy](docs/screenshots/ekran-tv.webp)

## Gry

| Gra | Opis | Gracze |
|---|---|---|
| **Stoper** | Zatrzymaj w idealnym momencie. Bez patrzenia na cyfry. 2 tryby: **CEL** i **ZGADNIJ CZAS**. | 1–16 |
| **Państwa-miasta** | Litera pada, długopisy w ruch. Kto pierwszy, ten lepszy. | 1–16 |
| **Wisielec** | Zgadnij hasło, zanim ludzik zawiśnie. 3 tryby: wyścig, kooperacja, zadający. | 1–16 |
| **Impostor** | Wszyscy znają hasło. Prawie wszyscy. Znajdź kreta albo giń. | 3–16 |
| **Mafia** | Miasto śpi. Mafia nie. Auto-narrator, role: detektyw, lekarz, mafia. | 4–16 |
| **Odcień** | Zapamiętaj kolor. Odtwórz go z pamięci trzema suwakami. | 1–16 |
| **Kasyno** | Obstawiaj żetony. Kto zostanie z pustymi rękami, odpada. 4 tryby: Jackpot, Double, Wheel, Sloty. | 2–16 |
| **Kółko i krzyżyk** | Klasyk na trzy w rzędzie. Wygrany zostaje przy stole, reszta czeka w kolejce. | 2–16 |

> **Stoper ma dwa tryby.** W **CEL** wszyscy dostają ten sam czas do trafienia i zatrzymują stoper
> u siebie — cyfry są zamaskowane, liczysz w głowie. W **ZGADNIJ CZAS** jeden gracz jest Biegaczem
> (rotacja co rundę): startuje i zatrzymuje kiedy chce, a **nikt nie widzi cyfr — łącznie z nim**.
> START i STOP lecą do wszystkich telefonów jako dźwięk, więc reszta szacuje ze słuchu i wpisuje typ.

> **Stoper trenuje się też solo.** Osobna strona, bez pokoju: ustawiasz własny czas do trafienia,
> a po kilku próbach dostajesz błąd każdej z nich, rozrzut, aktualną serię i diagnozę tego, co
> naprawdę kosztuje punkty — czy stale spóźniasz się albo śpieszysz, bo to nawyk do poprawienia,
> czy po prostu rzuca tobą na wszystkie strony, czego poprawić się nie da.

## Funkcje

### Pokój i lobby
- **4-znakowy kod pokoju** — klocowate litery, kliknij żeby skopiować
- **QR code** — skan z telefonu, zero wpisywania
- **Deep link** — `doplay.pl/?kod=XYZW` wchodzi prosto do pokoju
- **Udostępnianie** — przycisk Share (native share / clipboard fallback)
- **Ekran hosta (TV)** — osobny układ poziomy na laptop/TV, czytelny z kanapy
- **Awatary** — 30 ilustrowanych ikon w kolorowych kafelkach; w jednym pokoju nikt nie dostaje tego samego
- **Tryb widza** — `?widz=1` wpuszcza do pokoju na podgląd, bez zajmowania miejsca, w każdej grze
- **Zasady gier** — modal z krokami dla każdej gry
- **Rekordy pokoju** — kto ile wygrał i lista wyczynów, trwałe przez cały czas życia pokoju
- **Wolne miejsca** — lobby pokazuje puste sloty, żeby czekający host nie patrzył na jeden wiersz i pustkę
- **Zakładki teczkowe** — zakładanie i dołączanie to dwie zakładki jednego formularza; nick i awatar przeżywają przełączenie

### Realtime multiplayer
- **Anonimowa autoryzacja** — Firebase Anonymous Auth, zero rejestracji
- **Presence** — zielona/szara kropka, kto jest online
- **Reconnect** — powrót do pokoju po odświeżeniu/zamknięciu (localStorage)
- **Migracja hosta** — gdy host zniknie na >30s, inny gracz przejmuje
- **Idempotencja** — actionId (UUID) zapobiega podwójnym akcjom
- **Pasek połączenia** — czerwony "Brak połączenia", zielony "✓ Połączono"
- **Wykładniczy backoff** — 500ms → 1s → 2s → ... → 16s max

### Język
- **Polski i angielski** — przełącznik w rogu, bez prefiksu języka w adresie (tam siedzą kody pokoi); obejmuje wszystkie ekrany, także gry i układ na TV
- **Przez ciasteczko** — serwer czyta je przed pierwszym renderem, więc nic nie miga w złym języku
- **Karta linku** — `og:image` plus tytuł i opis w języku czytelnika, bo link do pokoju ląduje w czatach grupowych

### Bezpieczeństwo
- **Klient NIGDY nie zapisuje stanu gry** — wszystkie zapisy przez Route Handlery + `firebase-admin`
- **Role i hasła tajne** — żyją w `rooms/{kod}/secret/state` (Firestore: `allow read: if false`)
- **Dane prywatne per gracz** — `rooms/{kod}/private/{uid}` (tylko Twoje)
- **Zero wycieków w DevToolsach** — role Mafii i hasło Impostora niewidoczne po stronie klienta

### PWA i mobile
- **Instalowalna** — manifest + Service Worker (Serwist), prompt instalacji, iOS hint
- **Offline** — dedykowana strona offline, NetworkOnly dla API i Firebase
- **Wake Lock** — ekran nie gaśnie w trakcie gry
- **Wibracje** — haptic feedback na akcjach (z opcją wyłączenia)
- **Visual Viewport** — `--vvh` dla klawiatur mobilnych
- **Safe areas** — `env(safe-area-inset-*)` na notch/dynamic island

### Wygląd i UX
- **Styl „Arcade Party"** — fioletowo-różowy gradient, klocowate przyciski z twardym cieniem, panele jak naklejki. Pełna specyfikacja w [`DESIGN.md`](DESIGN.md)
- **Wciśnięcie przycisku** — element sygnaturowy: każdy przycisk zapada się o 4 px przy kliknięciu
- **Animacje** — slideIn, fadeIn, timer pulse, arcade-pop
- **SFX** — WebAudio: join, phase change, urgent tick, fanfara, defeat, neon buzz
- **Konfetti** — canvas-confetti na wygraną z kolorami gry
- **Skeleton loader** — placeholder w kształcie lobby, które za chwilę przyjdzie, więc nic nie podskakuje po załadowaniu
- **Pakiet ilustracji** — trzy powracające postacie: na stronie głównej, czekające w pustym lobby, wzruszające ramionami na ekranach błędu, świętujące na podium
- **Rama aplikacji** — aplikacja jest zaokrągloną kartą wpuszczoną w ciemną ramę, nie stroną na pełnej szerokości
- **prefers-reduced-motion** — pełne wsparcie

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Język | TypeScript (strict, zero `any`) |
| Baza danych | Cloud Firestore (realtime `onSnapshot`) |
| Autoryzacja | Firebase Anonymous Auth |
| Serwer | Route Handlers + `firebase-admin` |
| PWA | Serwist (Service Worker, manifest, offline) |
| Testy | Vitest (287 testów — pełne partie, bezpieczeństwo, kontrakty rdzenia) |
| Deploy | Vercel (auto-deploy z GitHub) |
| Dźwięki | Web Audio API (zero plików audio) |
| QR | `qrcode` (generowanie SVG) |
| Czcionki | Baloo 2 (display), Nunito (body), JetBrains Mono (liczby) |
| Języki | Własny słownik (~500 kluczy na język, bez biblioteki — next-intl wymusiłby prefiks języka w adresie) |
| Ikony | Lucide (interfejs) + własny pakiet ilustracji (30 awatarów, 8 ikon gier, postacie) |
| Obróbka grafik | `scripts/process-assets.py` — Pillow + NumPy, wycina tło z wygenerowanych ilustracji |

## Architektura

```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # root layout, fonty, PWA, ConnectionBar
│   ├── page.tsx                # landing page + deep link /?kod=
│   ├── nowy/                   # zakładanie pokoju
│   ├── dolacz/                 # dołączanie do pokoju
│   ├── pokoj/[code]/           # ekran gracza (lobby + gra)
│   │   └── ekran/              # ekran hosta na TV (układ poziomy)
│   ├── p/[code]/               # deep link ze skanu QR (kod wpisany)
│   ├── gry/stoper/trening/     # trening Stopera solo (bez pokoju)
│   ├── prywatnosc/             # obowiązek informacyjny (RODO art. 13)
│   ├── opengraph-image.jpg     # karta linku do czatów i social mediów
│   ├── ~offline/               # strona offline (PWA)
│   ├── robots.ts               # robots.txt (pokoje poza indeksem)
│   ├── sitemap.ts              # sitemap.xml
│   └── api/                    # Route Handlers (jedyne miejsce zapisu!)
│       ├── cron/cleanup/       # co noc: wygasłe pokoje + zamiatarka sierot
│       └── rooms/
│           ├── route.ts        # POST — tworzenie pokoju
│           └── [code]/
│               ├── join/       # dołączanie
│               ├── leave/      # wyjście
│               ├── ping/       # presence + migracja hosta
│               ├── start/      # start gry
│               ├── action/     # akcja gracza (idempotentna)
│               ├── tick/       # tick fazy (timer)
│               ├── reset/      # powrót do lobby (transakcja)
│               └── observe/    # tryb obserwatora (ekran hosta)
│
├── games/                      # Silniki i UI gier (plugin architecture)
│   ├── registry.ts             # rejestr silników (serwer)
│   ├── manifests.ts            # manifesty gier (klient — bez silników)
│   ├── icons.tsx               # ikony zapasowe gier (Lucide)
│   ├── rules.ts                # karty „Jak grać?" — PL i EN osobno
│   ├── finish.test.ts          # kontrakt „Zakończ grę" dla całego rejestru
│   ├── components.tsx          # UI gier (dynamic imports)
│   ├── types.ts                # interfejsy GameEngine, GameManifest
│   ├── view.ts                 # interfejsy GameViewProps
│   ├── stoper/                 # ⏱️ Stoper
│   │   ├── engine.ts           # czysta funkcja: init → action → state
│   │   ├── manifest.ts         # metadata + settings schema (Zod)
│   │   ├── Settings.tsx        # panel ustawień
│   │   ├── PlayerView.tsx      # widok gracza
│   │   └── HostView.tsx        # widok na TV
│   ├── panstwa-miasta/         # ✍️ Państwa-miasta
│   ├── wisielec/               # 🪢 Wisielec
│   ├── impostor/               # 🕵️ Impostor
│   ├── mafia/                  # 🔪 Mafia
│   ├── odcien/                 # 🎨 Odcień
│   ├── kasyno/                 # 🎰 Kasyno
│   └── kolko/                  # ⭕ Kółko i krzyżyk
│
├── components/                 # Komponenty React
│   ├── game/                   # GameShell, LobbyGames, GameRulesCard
│   ├── AvatarIcon.tsx          # ilustracja awatara + kolor kafelka
│   ├── AvatarPicker.tsx        # siatka 30 awatarów
│   ├── GameIcon.tsx            # ilustracja gry (fallback: ikona Lucide)
│   ├── GameCard.tsx            # karta gry na landingu
│   ├── GameRow.tsx             # wiersz gry w lobby
│   ├── SegmentPicker.tsx       # arcade segment buttons (ustawienia gier)
│   ├── HowToPlay.tsx           # sekcja „Jak grać" na landingu
│   ├── RoomRecords.tsx         # rekordy pokoju
│   ├── RoomCodeNeon.tsx        # klocowaty kod pokoju (click-to-copy)
│   ├── RoomQr.tsx              # QR code pokoju
│   ├── PlayerList.tsx          # lista graczy z presence
│   ├── ShareButton.tsx         # udostępnianie (navigator.share)
│   ├── ConnectionBar.tsx       # pasek online/offline
│   ├── InstallPrompt.tsx       # prompt instalacji PWA
│   ├── ErrorBoundary.tsx       # error boundary per gra
│   ├── LobbySkeleton.tsx       # skeleton loader
│   ├── Illustration.tsx        # pakiet ilustracji (@1x/@2x przez srcSet)
│   ├── ComingSoonCard.tsx      # kafelek „więcej gier wkrótce"
│   ├── EntryTabs.tsx           # zakładki teczkowe (zakładam / dołączam)
│   ├── LanguageSwitcher.tsx    # PL / EN
│   ├── PrivacyNotice.tsx       # informacja przy pierwszej wizycie
│   ├── ReturnToRoom.tsx        # „masz aktywny pokój"
│   ├── SpectatorRoom.tsx       # podgląd bez zajmowania miejsca (używa HostView)
│   └── WatchLink.tsx           # wejście „oglądaj"
│
├── hooks/                      # Custom hooks
│   ├── useRoom.ts              # Firestore onSnapshot + backoff
│   ├── usePresence.ts          # ping co 10s (debounce)
│   ├── useServerClock.ts       # synchronizacja zegara (NTP-like)
│   ├── usePrivate.ts           # private/{uid} listener
│   ├── useGameTick.ts          # auto-tick gdy faza wygasa
│   ├── useAnonAuth.ts          # Firebase Anonymous Auth
│   ├── useWakeLock.ts          # Screen Wake Lock API
│   ├── useVibrate.ts           # Vibration API (z opt-out)
│   └── useVisualViewport.ts    # Visual Viewport API (--vvh)
│
├── lib/                        # Infrastruktura
│   ├── server/game-runner.ts   # applyAction, persist, idempotencja
│   ├── server/records.ts       # rekordy pokoju (czyste funkcje, testowalne)
│   ├── server/cleanup.ts       # który pokój kasujemy (czyste, testowalne)
│   ├── trening-stats.ts        # statystyki treningu Stopera (czyste)
│   ├── site.ts                 # adres kanoniczny pod SEO
│   ├── client/api.ts           # apiPost z obsługą błędów
│   ├── sound.ts                # WebAudio SFX (10 dźwięków)
│   ├── confetti.ts             # canvas-confetti wrapper
│   ├── action-id.ts            # crypto.randomUUID()
│   ├── client/notices.ts       # koordynacja pasków przyklejonych do dołu
│   ├── i18n/                   # słownik, provider, treść prywatności
│   ├── store/session.ts        # Zustand (activeRoom)
│   └── types/room.ts           # Room, Player, RoomStatus
│
└── sw.ts                       # Service Worker (Serwist)
```

### Kluczowe decyzje projektowe

- **Klient read-only** — klient NIGDY nie zapisuje do Firestore. Wszystko przez Route Handlery + `firebase-admin`. Złamanie tej zasady wycieka role w DevToolsach.
- **Silniki to czyste funkcje** — zero `Date.now()`, zero `Math.random()`. Czas i losowość wchodzą przez `ctx.now` i `ctx.rng`. W pełni deterministyczne, w pełni testowalne.
- **Plugin architecture** — dodanie nowej gry = nowy folder w `src/games/` plus wpis w **sześciu rejestrach** (silnik, manifest kliencki, widoki, ikona, karta zasad, słownik). Zero zmian w rdzeniu. Warto je wyliczyć, bo pominięcie któregokolwiek **nie wywoła błędu budowania**: gra po prostu przestaje działać w jednym miejscu, co jest dużo trudniejsze do zauważenia niż czerwony build. Sprawdzone przy dodawaniu Kółka i krzyżyka — testy kontraktu przeszły od razu, bez dotykania `GameShell` ani `game-runner`.
- **Dynamic imports** — komponenty gier ładowane dynamicznie (`next/dynamic`). Gracz pobiera tylko kod aktualnej gry, nie wszystkich ośmiu.
- **Tajne dane w trzech warstwach** — `publicState` (wszyscy widzą), `secret/state` (nikt nie czyta, `allow read: if false`), `private/{uid}` (tylko Twoje).
- **Timer bez crona** — serwer pisze `phaseEndsAt`, klienci odliczają, a po upływie czasu ponagla serwer **wyłącznie host**. Reszta wchodzi jako zapas dopiero po 3 s, gdyby host wypadł. Wcześniej ponaglali wszyscy naraz, co przy 8 graczach dawało ~6,6 transakcji/s na jednym dokumencie przy limicie Firestore ~1/s — transakcje wchodziły w konflikt i faza spóźniała się o kilka sekund.
- **Kasowanie pokoju zawsze przez `recursiveDelete`** — zwykłe `delete()` na dokumencie Firestore zostawia jego podkolekcje, a `secret/state` i `private/{uid}` to dokładnie te miejsca, w których siedzą role. Pokój znikałby z listy, a role wszystkich graczy zostawały w bazie: bez rodzica i niewidoczne w konsoli. Natywne TTL Firestore odpada z tego samego powodu — kasuje wyłącznie rodzica. Stąd własny nocny cron, który przy okazji zamiata sieroty jako druga linia obrony. Trudne jest w nim nie kasowanie, tylko wyścig: pokój założony *po* odczycie listy pokoi nie ma na niej rodzica, choć żyje. Dlatego progiem jest `readTime` zapytania, a nie wiek dokumentu, a oba czasy pochodzą z zegara Firestore, nie procesu.
- **Polski jako pierwszy, angielski obok** — kod, trasy i nazwy katalogów zostają po polsku, podobnie jak TREŚĆ gier: listy haseł do Wisielca i Państw-miast są polskie, a klawiatura Wisielca razem z nimi. Interfejs czyta ze słownika. Bez biblioteki i18n: next-intl wymusiłby prefiks języka w adresie, a tam siedzą kody pokoi. Język trzyma ciasteczko, które serwer czyta przed pierwszym renderem, więc nic nie miga w złym języku.
- **Fonty z `latin-ext`** (Ą Ć Ę Ł Ń Ó Ś Ź Ż) — sama obecność glifów to jednak za mało: Fredoka je ma, ale rysuje ogonek w Ą/Ę cienkim włosem oderwanym od litery. Stąd Baloo 2 — szczegóły w [`DESIGN.md`](DESIGN.md).
- **Reguły komponentów w `@layer components`** — Tailwind układa kaskadę theme → base → components → utilities. Poza warstwą te reguły lądują *po* utility i wygrywają każdy remis, więc `px-4` obok `.card` po cichu nic nie robiło. Przed poprawką takich miejsc było około czterdziestu.
- **Rdzeń nie zna żadnej gry** — dwie funkcje działają przez opt-in silnika, nie przez wiedzę rdzenia. Gra bez opt-inu po prostu działa, tylko bez danej funkcji:
  - **Rekordy** — silnik oznacza zdarzenie `meta: { uid, rekord: true }`, rdzeń zbiera i dopisuje do wyróżnień pokoju.
  - **Zakończenie gry** — silnik wystawia `canFinish` w `publicView`, a `GameShell` pokazuje wtedy „Zakończ grę" zamiast awaryjnego przerwania. Zakończenie daje podium i zapisuje rekordy, przerwanie nie.

## Uruchomienie lokalne

### Wymagania

- Node.js 22+
- Projekt Firebase z Firestore i Authentication (Anonymous)

### Instalacja

```bash
git clone https://github.com/w84kubus/doplay.git
cd doplay
npm install
```

### Konfiguracja

Utwórz plik `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# firebase-admin (Route Handlery) — cały JSON konta serwisowego zakodowany base64:
#   base64 -i sciezka/do/klucza.json | tr -d '\n'
FIREBASE_SERVICE_ACCOUNT_KEY=your_base64_encoded_service_account_json

# Sekret nocnego crona sprzątającego. Wygeneruj: openssl rand -hex 32
# Bez niego /api/cron/cleanup odpowiada 401 i nic się nie kasuje.
CRON_SECRET=your_random_secret
```

Ta sama lista z komentarzami jest w [`.env.local.example`](.env.local.example).

### Komendy

```bash
npm run dev        # serwer deweloperski (localhost:3000)
npm run build      # produkcyjny build
npm run lint       # eslint
npm run test       # vitest run (287 testów)
```

## Instalacja na telefonie (PWA)

Aplikacja jest w pełni instalowalna jako PWA:

| Platforma | Instrukcja |
|---|---|
| **iOS** | Safari → Udostępnij (↑) → *Dodaj do ekranu początkowego* |
| **Android** | Chrome → Menu (⋮) → *Zainstaluj aplikację* / automatyczny prompt |

Po instalacji działa w pełnym ekranie z własną ikoną. Ekran hosta (TV) utrzymuje się aktywny dzięki Wake Lock.

## Licencja

**Wszelkie prawa zastrzeżone** — patrz [LICENSE](LICENSE).

Kod jest publiczny **wyłącznie do wglądu**: do czytania, nauki i oceny warsztatu.
To nie jest open source. Kopiowanie, użycie w innym projekcie czy uruchomienie
jako własnej usługi wymaga pisemnej zgody. Nazwa, domena, logo i ilustracje nie
są objęte nawet tym ograniczonym udostępnieniem.
