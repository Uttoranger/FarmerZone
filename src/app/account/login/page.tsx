import type { Metadata } from 'next'
import { zielNachAnmeldung } from '@/lib/anmeldecode'
import { zielParameterSchema } from '@/schemas/anmeldecode'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { AnmeldenSeite } from '@/components/anmelden/anmelden-seite'

export const metadata: Metadata = {
  title: 'Anmelden',
}

/**
 * Kunden-Anmeldung mit Code aus der E-Mail (E7, Gate 4 Nr. 08) — im neuen
 * Design in der KundeShell. Mockups: web-k0-anmelden-kunde-code-hof-passwort,
 * mobil-k0-anmelden-mit-code.
 *
 * `?ziel=` darf sagen, wohin es nach der Anmeldung geht (für „Bestellungen
 * finden", Nr. 14) — aber nur ein eigener, relativer Pfad; alles andere
 * endet wie bisher auf „Mein Konto" (zielNachAnmeldung, keine offene
 * Weiterleitung). Geprüft hier auf dem Server, der Browser bekommt nur das
 * Ergebnis.
 */
export default async function KundenLoginSeite({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const { ziel } = await searchParams
  return (
    <KundeShellMitSitzung>
      <AnmeldenSeite aktiv="kunde" ziel={zielNachAnmeldung(zielParameterSchema.parse(ziel))} />
    </KundeShellMitSitzung>
  )
}
