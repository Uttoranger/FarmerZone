'use client'

import { Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ETIKETT, KNOPF_BREIT_RAHMEN } from '@/components/bestaetigung/bestaetigung-stil'
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
  // Board s1-/w1-bestaetigung: „ERZÄHL’S WEITER“ als kleine Überschrift, ein Satz, darunter der Knopf mit Rand über die volle Breite.
  return (
    <section aria-labelledby="erzaehl-weiter" className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]">
      <h2 id="erzaehl-weiter" className={ETIKETT}>
        Erzähl&apos;s weiter
      </h2>
      <p className="text-[14px] leading-normal text-muted-foreground">Kennst du jemanden, der gern frisch vom Hof kauft?</p>
      <button type="button" onClick={() => void teileHof({ name: hofName, slug: hofSlug })} className={cn(KNOPF_BREIT_RAHMEN, 'mt-1')}>
        <Share2 className="size-[18px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
        <span className="min-w-0 truncate">{hofName} teilen</span>
      </button>
    </section>
  )
}
