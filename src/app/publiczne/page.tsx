"use client";
import { EntryForm } from "@/components/EntryForm";
import { EntryHeader } from "@/components/EntryHeader";

// Lista publicznych pokoi — trzecia zakładka obok zakładania i dołączania.
// Osobna trasa, jak /nowy i /dolacz, bo zakładki są nawigacją, nie stanem.
export default function PubliczneePage() {
  return (
    <main className="arcade-bg screen relative items-center justify-center gap-6 overflow-hidden">
      <div className="halftone pointer-events-none absolute inset-0" aria-hidden />
      <EntryHeader mode="public" />
      <EntryForm mode="public" withTabs />
    </main>
  );
}
