"use client";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { GithubMark } from "@/components/GithubMark";
import { useI18n } from "@/lib/i18n/provider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PRIVACY } from "@/lib/i18n/privacy";

// Obowiązek informacyjny (RODO art. 13). Nie ma tu banera zgody, bo aplikacja nie ma
// analityki ani trackerów — szczegóły w src/lib/i18n/privacy.ts.
export default function PrywatnoscPage() {
  const { locale } = useI18n();
  const c = PRIVACY[locale];

  return (
    <main className="arcade-bg screen relative items-center gap-8 overflow-hidden">
      <div className="halftone pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative flex w-full max-w-3xl justify-end">
        <LanguageSwitcher />
      </div>

      <header className="relative flex w-full max-w-3xl flex-col gap-2">
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-ink drop-shadow-[0_4px_0_rgb(0_0_0/0.35)]">
          {c.title}
        </h1>
        <p className="font-display text-xs font-bold uppercase tracking-[0.06em] text-ink-muted">{c.updated}</p>
        <p className="text-base font-semibold leading-relaxed text-ink-muted">{c.intro}</p>
      </header>

      <section className="card relative w-full max-w-3xl border-mint/60">
        <h2 className="font-display mb-2 text-lg font-bold uppercase tracking-[0.06em] text-mint">
          {c.noTrackingTitle}
        </h2>
        <p className="text-base font-semibold leading-relaxed text-ink">{c.noTracking}</p>
      </section>

      <section className="relative flex w-full max-w-3xl flex-col gap-3">
        <h2 className="font-display text-lg font-bold uppercase tracking-[0.06em] text-mint">{c.storageTitle}</h2>
        {/* Tabela szeroka — na telefonie przewija się w poziomie zamiast rozpychać stronę. */}
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-stroke">
                {c.cols.map((col) => (
                  <th key={col} className="font-display px-3 py-2 text-xs font-bold uppercase tracking-[0.06em] text-ink-muted">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r) => (
                <tr key={r.name} className="border-b border-stroke/50 last:border-0">
                  <td className="tabular px-3 py-2 align-top text-xs font-bold text-mint">{r.name}</td>
                  <td className="px-3 py-2 align-top font-semibold text-ink-muted">{r.where}</td>
                  <td className="px-3 py-2 align-top font-semibold leading-snug text-ink">{r.why}</td>
                  <td className="px-3 py-2 align-top font-semibold text-ink-muted">{r.howLong}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {([
        [c.dataTitle, c.data],
        [c.rightsTitle, c.rights],
      ] as const).map(([title, items]) => (
        <section key={title} className="relative flex w-full max-w-3xl flex-col gap-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-[0.06em] text-mint">{title}</h2>
          <ul className="card flex list-disc flex-col gap-2 pl-9 text-base font-semibold leading-relaxed text-ink">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      {/* Wsparcie. Osobna sekcja, a nie punkt w „danych na serwerze", bo tu chodzi
          o coś odwrotnego: co NIE trafia do Doplay. Odnośnik prowadzi do polityki
          buycoffee.to, bo to oni są administratorem danych przy wpłacie, nie my. */}
      <section className="relative flex w-full max-w-3xl flex-col gap-3">
        <h2 className="font-display text-lg font-bold uppercase tracking-[0.06em] text-mint">
          {c.donationsTitle}
        </h2>
        <div className="card flex flex-col gap-3">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-base font-semibold leading-relaxed text-ink">
            {c.donations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <a
            href="https://buycoffee.to/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-display inline-flex min-h-[44px] w-fit items-center gap-2 rounded-[14px] border-[3px] border-stroke bg-panel px-4 text-sm font-bold uppercase tracking-[0.06em] text-ink shadow-[0_3px_0_rgb(0_0_0/0.35)] transition-transform duration-75 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-mint focus-visible:outline-offset-2 active:translate-y-[3px] active:shadow-none"
          >
            <ExternalLink size={16} strokeWidth={2.5} aria-hidden />
            {c.donationsLink}
          </a>
        </div>
      </section>

      <section className="relative flex w-full max-w-3xl flex-col gap-3">
        <h2 className="font-display text-lg font-bold uppercase tracking-[0.06em] text-mint">{c.contactTitle}</h2>
        <div className="card flex flex-col items-start gap-3 text-base font-semibold leading-relaxed text-ink">
          <p>{c.contact}</p>
          <a
            href="https://github.com/w84kubus"
            target="_blank"
            rel="noopener noreferrer"
            className="font-display inline-flex min-h-[44px] items-center gap-2 rounded-[14px] border-[3px] border-stroke bg-panel px-4 text-sm font-bold uppercase tracking-[0.06em] text-ink shadow-[0_3px_0_rgb(0_0_0/0.35)] transition-transform duration-75 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-mint focus-visible:outline-offset-2 active:translate-y-[3px] active:shadow-none"
          >
            <GithubMark size={18} />
            github.com/w84kubus
          </a>
        </div>
      </section>

      <Link href="/" className="btn btn-ghost relative mb-4 w-full max-w-3xl">
        {c.back}
      </Link>
    </main>
  );
}
