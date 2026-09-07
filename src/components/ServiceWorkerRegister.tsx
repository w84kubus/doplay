"use client";
import { useEffect } from "react";

// Rejestracja service workera (Serwist, UPGRADE.md §B2).
// register: false w next.config.ts — rejestrujemy ręcznie, żeby kontrolować timing.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // W dev NIE rejestrujemy i dodatkowo sprzątamy po sobie.
    //
    // `next.config.ts` wyłącza Serwista w dev, więc `public/sw.js` NIE jest wtedy
    // przebudowywany — ale plik z ostatniego builda produkcyjnego dalej leży na dysku
    // i jest serwowany. Rejestracja podpinała więc workera zbudowanego z INNEGO bundla,
    // który potem podawał chunki z tamtej wersji. Objawy są mylące, bo nie wyglądają
    // na problem z cache: „Invalid or unexpected token", zawieszony skeleton albo
    // surowe klucze słownika zamiast tekstów.
    //
    // Wyrejestrowanie jest ważniejsze niż sam brak rejestracji: bez niego worker
    // złapany wcześniej siedzi w przeglądarce i psuje kolejne sesje, a przeciętny
    // sposób na to (twarde odświeżenie) go nie rusza.
    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((rejestracje) => {
        for (const r of rejestracje) r.unregister();
      });
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
