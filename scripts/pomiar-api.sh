#!/usr/bin/env bash
# Pomiar opóźnienia produkcyjnego API. Ten sam zestaw przed i po zmianie regionu,
# żeby porównanie miało sens.
#
#   ./scripts/pomiar-api.sh            # produkcja
#   ./scripts/pomiar-api.sh http://localhost:3000
#
# Dwa punkty pomiarowe, bo rozdzielają dwie różne rzeczy:
#   /api/time       - sama droga do funkcji i z powrotem (endpoint nic nie robi),
#   /api/rooms/...  - to samo PLUS jeden round trip do Firestore.
# Różnica między nimi to koszt dostania się funkcji do bazy.
set -u
BAZA="${1:-https://www.doplay.pl}"
PROBY="${PROBY:-6}"

zmierz() {
  local sciezka="$1" opis="$2" suma=0 n=0
  for _ in $(seq "$PROBY"); do
    local t
    t=$(curl -s -o /dev/null -w "%{time_starttransfer}" --max-time 20 "${BAZA}${sciezka}?x=$RANDOM") || continue
    # Pierwsza próba bywa zimnym startem - liczymy ją osobno, poza średnią.
    if [ "$n" -eq 0 ]; then printf "  %-28s zimny start: %6.0f ms\n" "$opis" "$(echo "$t * 1000" | bc)"; n=1; continue; fi
    suma=$(echo "$suma + $t" | bc); n=$((n + 1))
  done
  [ "$n" -gt 1 ] && printf "  %-28s średnia:      %6.0f ms\n" "$opis" "$(echo "$suma / ($n - 1) * 1000" | bc -l)"
}

echo "Pomiar: $BAZA"
curl -s -D - -o /dev/null --max-time 15 "${BAZA}/api/time" | grep -i "^x-vercel-id" | sed 's/^/  region: /'
zmierz "/api/time" "funkcja bez bazy"
zmierz "/api/rooms/publiczne" "funkcja + Firestore"
