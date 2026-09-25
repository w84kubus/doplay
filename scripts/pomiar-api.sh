#!/usr/bin/env bash
# Pomiar opóźnienia produkcyjnego API — tak, jak odczuwa je telefon gracza.
#
#   ./scripts/pomiar-api.sh                      # produkcja
#   ./scripts/pomiar-api.sh http://localhost:3000
#   PROBY=15 ./scripts/pomiar-api.sh             # więcej prób
#
# WSZYSTKIE PRÓBY IDĄ PO JEDNYM POŁĄCZENIU i to jest cały sens tej wersji.
# Pierwsza wersja wołała `curl` osobno dla każdej próby, więc każda płaciła TCP + TLS
# do edge'a — około 130 ms, których przeglądarka nie płaci, bo trzyma połączenie otwarte.
# Liczby wychodziły przez to zawyżone o tę stałą i wyglądało, jakby przeniesienie funkcji
# do Frankfurtu prawie nic nie dało, choć dało.
#
# Do porównań „przed/po" i tak najbardziej nadaje się RÓŻNICA między dwoma endpointami:
#   /api/time            — funkcja, która nie dotyka bazy,
#   /api/rooms/publiczne — to samo PLUS jeden round trip do Firestore.
# Obie płacą ten sam narzut drogi, więc różnica to czysty koszt dotarcia funkcji do bazy.
set -u
BAZA="${1:-https://www.doplay.pl}"
PROBY="${PROBY:-8}"

# Mediana, nie średnia: pojedyncza zimna instancja potrafi wystrzelić do 1,5 s
# i sama jedna przesuwa średnią o kilkadziesiąt procent.
podsumuj() {
  awk -v etykieta="$1" '
    { czasy[NR] = $1 * 1000; if ($2 > 0) handshake = $2 * 1000 }
    END {
      n = NR
      if (n == 0) { printf "  %-22s brak odpowiedzi\n", etykieta; exit }
      # sortowanie bąbelkowe — przy kilkunastu próbach nie ma o czym mówić
      for (i = 1; i <= n; i++) for (j = i + 1; j <= n; j++)
        if (czasy[j] < czasy[i]) { t = czasy[i]; czasy[i] = czasy[j]; czasy[j] = t }
      mediana = (n % 2) ? czasy[(n + 1) / 2] : (czasy[n / 2] + czasy[n / 2 + 1]) / 2

      # Odstające w górę to najpewniej zimny start instancji — pokazujemy osobno,
      # zamiast wtapiać je w wynik albo udawać, że ich nie było.
      zimne = 0
      for (i = 1; i <= n; i++) if (czasy[i] > 3 * mediana) zimne++
      printf "  %-22s mediana %5.0f ms   (min %.0f, max %.0f, n=%d)\n",
             etykieta, mediana, czasy[1], czasy[n], n
      if (zimne > 0) printf "  %-22s   w tym %d zimnych: do %.0f ms\n", "", zimne, czasy[n]
      if (handshake > 0) printf "%.0f\n", handshake > "/dev/stderr"
      printf "%.0f\n", mediana > "/tmp/.pomiar-mediana"
    }
  '
}

# Jedno wywołanie curl na endpoint: pierwsze żądanie zestawia połączenie, reszta je
# współdzieli. `?x=` łamie cache, żeby każda próba naprawdę doszła do funkcji.
zmierz() {
  local sciezka="$1" i args=()
  for i in $(seq "$PROBY"); do
    args+=(-o /dev/null "${BAZA}${sciezka}?x=${RANDOM}${i}")
  done
  curl -s -w "%{time_starttransfer} %{time_appconnect}\n" "${args[@]}"
}

echo "Pomiar: $BAZA   (prób: $PROBY, jedno połączenie na endpoint)"
curl -s -D - -o /dev/null --max-time 15 "${BAZA}/api/time" \
  | awk 'tolower($1) == "x-vercel-id:" { print "  region:                " $2 }'

echo
uchwyt=$(zmierz /api/time | podsumuj "funkcja bez bazy" 2>/tmp/.pomiar-hs)
echo "$uchwyt"
bez_bazy=$(cat /tmp/.pomiar-mediana 2>/dev/null || echo 0)
zmierz /api/rooms/publiczne | podsumuj "funkcja + Firestore" 2>/dev/null
z_baza=$(cat /tmp/.pomiar-mediana 2>/dev/null || echo 0)

echo
[ -s /tmp/.pomiar-hs ] && printf "  %-22s %5s ms   (raz na połączenie, przeglądarka płaci to rzadko)\n" \
  "zestawienie TCP+TLS" "$(head -1 /tmp/.pomiar-hs)"
if [ "$bez_bazy" -gt 0 ] && [ "$z_baza" -gt 0 ]; then
  printf "  %-22s %5d ms   <- to zmienia się przy przenosinach regionu\n" \
    "round trip do bazy" "$((z_baza - bez_bazy))"
fi
rm -f /tmp/.pomiar-mediana /tmp/.pomiar-hs
