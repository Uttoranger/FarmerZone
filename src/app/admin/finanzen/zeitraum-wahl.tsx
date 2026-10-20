import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { FINANZEN_JAHR_TEXT } from '@/lib/finanzen'
import type { FinanzenZeitraum } from '@/schemas/admin-reiter'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { LadePunkt } from '@/components/ui/lade-punkt'

/**
 * Monat | Jahr im Seitenkopf der Finanzen (Register N15, Ergänzung Nr. 100):
 * zwei Links statt zweier Knöpfe — der Zeitraum steht in der Adresse, also ist
 * er teilbar und der Zurück-Pfeil des Browsers tut das Richtige. Die Gestalt ist
 * die des Segments (Wanne, gewählte Hälfte `bg-border`), nur als Link: das
 * Segment (`ui/segment.tsx`) ist ein Umschalter für Zustand auf der Seite und
 * kann keine Adresse tragen. Der gewählte Link führt auf die Seite, die gerade
 * offen ist, und trägt deshalb `aria-current="page"`.
 */
export function ZeitraumUmschalter({
  aktiv,
  monatHref,
  jahrHref,
}: {
  aktiv: FinanzenZeitraum
  monatHref: string
  jahrHref: string
}): React.JSX.Element {
  const eintraege = [
    { id: 'monat', label: FINANZEN_JAHR_TEXT.monat, href: monatHref },
    { id: 'jahr', label: FINANZEN_JAHR_TEXT.jahr, href: jahrHref },
  ] as const
  return (
    <nav
      aria-label={FINANZEN_JAHR_TEXT.umschalter}
      className="inline-flex max-w-full gap-[3px] rounded-full border border-border bg-background p-[3px]"
    >
      {eintraege.map((e) => (
        <Link
          key={e.id}
          href={e.href}
          aria-current={e.id === aktiv ? 'page' : undefined}
          className={cn(
            "relative inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-[''] hover:text-foreground",
            e.id === aktiv && 'bg-border font-semibold text-foreground',
            FOKUS_RAHMEN
          )}
        >
          {e.label}
          <LadePunkt />
        </Link>
      ))}
    </nav>
  )
}

/**
 * Ein Pfeil zum Blättern — beim Monat wie beim Jahr derselbe — oder ein stiller
 * Platzhalter, wo es nichts mehr gibt (ohne Ziel).
 */
export function ZeitraumPfeil({
  href,
  beschriftung,
  richtung,
}: {
  /** null = hier ist Schluss. */
  href: string | null
  beschriftung: string
  richtung: 'zurueck' | 'vor'
}): React.JSX.Element {
  const Symbol = richtung === 'zurueck' ? ChevronLeft : ChevronRight
  if (href === null) {
    // Kein ausgegrauter Knopf, der nichts tut: Die Fläche bleibt, damit die
    // Bezeichnung nicht springt, aber es gibt nichts zu treffen.
    return <span aria-hidden="true" className="block size-11" />
  }
  return (
    <Link
      href={href}
      aria-label={beschriftung}
      className={cn('relative flex size-11 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted', FOKUS_RAHMEN)}
    >
      <Symbol className="size-4" strokeWidth={1.7} aria-hidden="true" />
      <LadePunkt />
    </Link>
  )
}
