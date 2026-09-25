import "server-only";

// Firebase Admin SDK — TYLKO na serwerze (Route Handlery). To jedyna droga do zapisu
// stanu gry i do secret/state (SPEC §3.1). Klient nie ma tu dostępu.
//
// Singleton z guardem na getApps().length: w środowisku serverless nie wolno
// inicjalizować aplikacji przy każdym requeście (SPEC §8, pkt 2).
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { parseServiceAccountKey } from "./service-account";

/**
 * Rozgrzewka połączenia z Firestore — raz na instancję funkcji, bez czekania.
 *
 * Pierwsze żądanie do świeżej instancji płaci wymianę podpisanego JWT na token dostępu
 * ORAZ zestawienie kanału gRPC. Trasa z autoryzacją robi to SZEREGOWO: najpierw
 * `verifyIdToken` dociąga klucze publiczne Google (~90 ms), dopiero potem zaczyna się
 * cokolwiek w bazie (~250 ms). Puszczone tutaj zapytanie startuje już przy tworzeniu
 * aplikacji, więc biegnie RÓWNOLEGLE do sprawdzania tokenu.
 *
 * Zmierzone (8 prób na wariant, świeży proces = świeża instancja): 240 ms mediany bez
 * rozgrzewki, 171 ms z nią. Zysk ~70 ms na pierwszym żądaniu, potem zero kosztu.
 *
 * Musi to być PRAWDZIWE zapytanie, nie samo `credential.getAccessToken()`. Sprawdzone:
 * sama wymiana tokenu zajmuje 153 ms, ale pierwsze zapytanie PO NIEJ i tak kosztuje
 * kolejne 192 ms, bo kanał gRPC dopiero wtedy się zestawia. Token to połowa problemu.
 *
 * Kolekcja nie istnieje i ma nie istnieć — chodzi o samo dotarcie do bazy, nie o dane.
 * Puste zapytanie kosztuje jeden odczyt na instancję, czyli nic.
 *
 * Fire-and-forget jest tu celowe: gdyby instancja zamarzła przed zakończeniem, nic się
 * nie dzieje — następne żądanie po prostu zapłaci tyle, ile płaciło dotąd.
 */
let rozgrzane = false;

function rozgrzej(app: App): void {
  if (rozgrzane) return;
  rozgrzane = true;
  void getFirestore(app)
    .collection("_rozgrzewka")
    .limit(1)
    .get()
    .catch(() => {
      // Rozgrzewka nie ma prawa niczego przewrócić. Jak się nie uda, to się nie uda.
    });
}

export function getAdminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];
  const serviceAccount = parseServiceAccountKey(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ?? "",
  );
  const app = initializeApp({ credential: cert(serviceAccount) });
  rozgrzej(app);
  return app;
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
