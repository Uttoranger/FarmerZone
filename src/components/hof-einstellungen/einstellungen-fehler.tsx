import Link from 'next/link'
import type { ReactNode } from 'react'
import { HinweiskarteFehler, NOCHMAL_KNOPF } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { cn } from '@/lib/utils'

/** Wörtlich nach Board s1-/w1-einstellungen Bild 2. */
export const EINSTELLUNGEN_FEHLER_TEXT = {
  titel: 'Wir konnten deine Einstellungen gerade nicht laden.',
  satz: 'Deine Angaben sind nicht verloren. Versuch es noch einmal.',
  knopf: 'Neu laden',
} as const

/**
 * Fehler beim Laden einer Einstellungsseite — inline statt der ganzseitigen 500 (DESIGN_SYSTEM „Zustände").
 * Seit Nr. 250 nach G6 (Liste Lauf 32, einstellungen „Fehlerkarte“): Kasten in der Warnfarbe, Titel fett,
 * darunter der Knopf klein und linksbündig wie „Nochmal“; darüber derselbe Werkzeug-Kopf (G1) wie die
 * fertige Seite, mit der Hof-Unterzeile, wenn der Name zu haben war. Der Knopf ist ein Link auf dieselbe
 * Seite: Sie ist dynamisch, Hinlaufen heißt neu fragen.
 */
export function EinstellungenFehler({ titel, href, unterzeile }: { titel: string; href: string; unterzeile?: ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <WerkzeugKopf titel={titel} unterzeile={unterzeile} />
      <HinweiskarteFehler titel={EINSTELLUNGEN_FEHLER_TEXT.titel}>
        <p>{EINSTELLUNGEN_FEHLER_TEXT.satz}</p>
        <Link href={href} className={cn(NOCHMAL_KNOPF, FOKUS_RAHMEN, 'mt-2')}>
          {EINSTELLUNGEN_FEHLER_TEXT.knopf}
        </Link>
      </HinweiskarteFehler>
    </div>
  )
}
