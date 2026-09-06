"use client";
import Link from "next/link";
import Image from "next/image";
import { ReturnToRoom } from "@/components/ReturnToRoom";
import { GameCard } from "@/components/GameCard";
import { ComingSoonCard } from "@/components/ComingSoonCard";
import { HowToPlay } from "@/components/HowToPlay";
import { PublicRoomsHint } from "@/components/PublicRoomsHint";
import { GithubMark } from "@/components/GithubMark";
import { Illustration } from "@/components/Illustration";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { GAME_LIST } from "@/games/manifests";
import { useT } from "@/lib/i18n/provider";

// Treść landingu wyjęta z page.tsx do komponentu klienckiego: przełącznik języka
// musi natychmiast przerenderować teksty, a page.tsx zostaje serwerowy, bo trzyma
// logikę deep linku (/?kod= → redirect), która musi wykonać się przed renderem.
export function LandingContent() {
  const t = useT();
  return (
    <main className="arcade-bg screen relative items-center gap-10 overflow-hidden">
      <div className="halftone pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative flex w-full max-w-4xl justify-end">
        <LanguageSwitcher />
      </div>

      {/* Hero. Na desktopie dwie kolumny — tekst i ekipa — bo w jednej wąskiej kolumnie
          70% szerokości zostawało pustym gradientem. Na telefonie ilustracja ląduje pod
          przyciskami: obietnicę produktu opowiada obrazek, ale kliknięcie ma być pierwsze. */}
      <header className="relative grid w-full max-w-5xl items-center gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
          <Image
            src="/icon-512.png"
            alt=""
            width={132}
            height={132}
            priority
            className="size-20 drop-shadow-[0_6px_0_rgb(0_0_0/0.28)] sm:size-24"
            aria-hidden
          />
          <h1 className="font-display text-5xl font-bold uppercase tracking-wide text-ink drop-shadow-[0_4px_0_rgb(0_0_0/0.35)] sm:text-6xl">
            Doplay
          </h1>
          <p className="max-w-md text-lg font-semibold leading-relaxed text-ink-muted">
            {t("landing.tagline")}
          </p>
          {/* Na telefonie przyciski jeden pod drugim (DESIGN.md §6: „mobile — przyciski
              w-full"). Obok siebie nie mieszczą się: para ma 351 px minimalnej szerokości
              przy 335 px dostępnych na 375-px ekranie, więc `overflow-hidden` na <main>
              po cichu ucinał po 8 px z każdej strony. */}
          <div className="flex w-full max-w-md flex-col gap-3 pt-2 sm:max-w-none sm:flex-row">
            <Link href="/nowy" className="btn text-base sm:whitespace-nowrap">
              {t("landing.create")}
            </Link>
            <Link href="/dolacz" className="btn btn-ghost text-base sm:whitespace-nowrap">
              {t("landing.join")}
            </Link>
          </div>

          {/* Widoczne tylko wtedy, gdy ktoś realnie czeka — komponent sam znika przy pustej liście. */}
          <PublicRoomsHint />
        </div>
        <Illustration
          id="postacie/hero-ekipa"
          priority
          className="mx-auto w-full max-w-md drop-shadow-[0_6px_0_rgb(0_0_0/0.28)] lg:max-w-none"
        />
      </header>

      <ReturnToRoom />

      <section className="relative flex w-full max-w-4xl flex-col gap-4">
        <h2 className="font-display text-center text-2xl font-bold uppercase tracking-wide text-ink drop-shadow-[0_3px_0_rgb(0_0_0/0.35)]">
          {t("landing.games")}
        </h2>
        <ul className="grid auto-rows-fr grid-cols-2 gap-3 lg:grid-cols-5">
          {GAME_LIST.map((g) => (
            <GameCard key={g.id} manifest={g} />
          ))}
          <ComingSoonCard />
        </ul>
      </section>

      <HowToPlay />

      <footer className="font-display relative mt-auto flex flex-col items-center gap-2 pt-4 text-center text-xs font-bold uppercase tracking-[0.06em] text-ink-muted">
        <Link href="/prywatnosc" className="underline underline-offset-2 hover:text-ink">
          {t("privacy.link")}
        </Link>
        <a
          href="https://github.com/w84kubus"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 underline underline-offset-2 hover:text-ink"
        >
          <GithubMark />
          {t("footer.madeBy", { name: "Jakub Bondel" })}
        </a>
        <span className="opacity-70">doplay.pl</span>
      </footer>
    </main>
  );
}
