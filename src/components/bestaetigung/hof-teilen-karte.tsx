'use client'

import { Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { teileHof } from '@/components/shared/hof-teilen'

/**
 * „Erzähl's weiter" auf der Bestätigungsseite (Mockup
 * web-k3-bestaetigung-online-mit-erzaehl-s-weiter): ein Outline-Knopf, der
 * die ÖFFENTLICHE Hofseite teilt — über das Teilen-Menü des Geräts, sonst in
 * die Zwischenablage (teileHof). Bewusst nur Name und Slug als Props: Die
 * Seite darüber trägt die Signatur der Bestellung in der Adresse, und dieser
 * Link darf nie geteilt werden (tests/bestaetigung-seite.test.ts). Keine
 * Zählung, kein Kanal, keine Personendaten — die Teilen-Wirkung ist Gate 7.
 */
export function HofTeilenKarte({ hofName, hofSlug }: { hofName: string; hofSlug: string }): React.JSX.Element {
  return (
    <section
      aria-labelledby="erzaehl-weiter"
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:gap-3.5 md:px-[18px]"
    >
      <div className="min-w-0 flex-1">
        <h2 id="erzaehl-weiter" className="text-[15px] font-semibold">
          Erzähl&apos;s weiter
        </h2>
        <p className="mt-0.5 text-[12.5px] leading-normal break-words text-muted-foreground">
          {hofName} freut sich über neue Stammkundschaft aus der Nachbarschaft.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void teileHof({ name: hofName, slug: hofSlug })}
        className={cn(
          'inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-border bg-card px-3.5 text-[13.5px] font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted sm:self-auto',
          FOKUS_RAHMEN
        )}
      >
        <Share2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
        Hof teilen
      </button>
    </section>
  )
}
