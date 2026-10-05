import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { BESTELLUNGEN_COOKIE, bestellEintrag, teileBestellungen } from '@/lib/bestellungen-finden'
import { leseBestellZugang } from '@/lib/bestellungen-zugang'
import { ladeBestellungenZurAdresse } from '@/server/bestellungen-finden'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { BestellungenFehler, BestellungenFinden, BestellungenListe } from '@/components/bestellungen/bestellungen-ansicht'

// Nach dem Code stehen hier Höfe, Beträge und signierte Links: nie in einen
// Suchindex, kein Referrer beim Klick hinaus (dazu der Header in next.config.ts).
export const metadata: Metadata = {
  title: 'Meine Bestellungen',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

// Jede Anfrage liest den Cookie neu — nie zwischengespeichert (S1).
export const dynamic = 'force-dynamic'

/**
 * „Bestellungen finden" (Gate 4, Nr. 14; E7/E8). Ohne bewiesene Adresse das
 * Formular E-Mail → Code, danach die Liste. Bewiesen ist eine Adresse nur über
 * den signierten Cookie, den zeigeBestellungen nach dem richtigen Code setzt
 * (src/lib/bestellungen-zugang.ts) — kein Konto, keine Better-Auth-Sitzung;
 * auch eine angemeldete Kundin bestätigt hier mit Code (eine Regel, ein Weg).
 */
export default async function BestellungenSeite(): Promise<React.JSX.Element> {
  const jetzt = new Date()
  const zugang = leseBestellZugang((await cookies()).get(BESTELLUNGEN_COOKIE)?.value, jetzt)

  if (zugang.art !== 'gueltig') {
    return (
      <KundeShellMitSitzung>
        <BestellungenFinden abgelaufen={zugang.art === 'abgelaufen'} />
      </KundeShellMitSitzung>
    )
  }

  let liste: Awaited<ReturnType<typeof ladeBestellungenZurAdresse>>
  try {
    liste = await ladeBestellungenZurAdresse(zugang.email, jetzt)
  } catch (err) {
    // Nur die Art des Fehlers — ein Datenbankfehler kann die Adresse tragen.
    const meldung = new Error('Bestellungen zur Adresse nicht lesbar')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { tags: { aufgabe: 'bestellungen-finden' } })
    return (
      <KundeShellMitSitzung>
        <BestellungenFehler />
      </KundeShellMitSitzung>
    )
  }

  const { laufend, frueher } = teileBestellungen(liste, jetzt)
  return (
    <KundeShellMitSitzung>
      <BestellungenListe
        email={zugang.email}
        laufend={laufend.map((b) => bestellEintrag(b, jetzt, true))}
        frueher={frueher.map((b) => bestellEintrag(b, jetzt, false))}
      />
    </KundeShellMitSitzung>
  )
}
