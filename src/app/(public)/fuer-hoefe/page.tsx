import type { Metadata } from 'next'
import { SERVICEGEBUEHR_SATZ_TEXT, STARTPHASE_SATZ, TARIFE_AB_SATZ } from '@/lib/konditionen'
import { STARTSEITE_VORSCHAUBILD } from '@/lib/vorschaubild'
import { KundeShellMitSitzung } from '@/components/shells/kunde-shell-mit-sitzung'
import { StartseiteFuss } from '@/components/startseite/startseite-abschnitte'
import {
  FuerHoefeEinstieg,
  FuerHoefeFragen,
  FuerHoefeFutter,
  FuerHoefePreise,
  FuerHoefeSchluss,
  FuerHoefeSchritte,
  FuerHoefeVorteile,
} from '@/components/fuer-hoefe/fuer-hoefe-abschnitte'
import { MARKE } from '@/lib/marke'
import { gruendungFuerSeiten } from '@/server/queries/plattform-einstellung'

const SEITEN_TITEL = `Für Höfe — ${MARKE}`
const SEITEN_BESCHREIBUNG =
  `Dein Hofladen, online: Kunden bestellen vorab, du packst nach Liste und übergibst zur Abholzeit. ` +
  // Kein Tarif als sofort gültig (Register K1): erst kostenlos, die Tarife ab dem Stichtag.
  `${STARTPHASE_SATZ} ${TARIFE_AB_SATZ} Die Servicegebühr von ${SERVICEGEBUEHR_SATZ_TEXT} zahlt der Kunde.`

export const metadata: Metadata = {
  title: SEITEN_TITEL,
  description: SEITEN_BESCHREIBUNG,
  alternates: { canonical: '/fuer-hoefe' },
  openGraph: {
    title: SEITEN_TITEL,
    description: SEITEN_BESCHREIBUNG,
    type: 'website',
    siteName: MARKE,
    images: [STARTSEITE_VORSCHAUBILD],
  },
}

// Statisch: Die Seite liest nichts aus der Anfrage (das Bild der App zeigt
// erfundene Daten). Die Sitzung für die Kopfzeile liest KundeShellMitSitzung
// im Browser — Vorbild Startseite. Aus der Datenbank kommen seit Nr. 93 nur
// die Zahlen der Gründungshöfe (Register K2-Ergänzung): Deshalb alle fünf
// Minuten neu gebaut wie die Startseite — eine Freischaltung ändert „noch n
// Plätze", das Speichern in Admin › Einstellungen baut sofort neu.
export const revalidate = 300

/**
 * „Für Höfe" (Gate 5, Nr. 15) — Mockups web-h0-fuer-hoefe und
 * mobil-h0-fuer-hoefe. Preise und der Übergang (K1) ausschließlich aus
 * src/lib/konditionen.ts, dieselbe Quelle wie /konditionen.
 */
export default async function FuerHoefePage(): Promise<React.JSX.Element> {
  // Einmal je Bau bzw. Revalidierung (revalidate oben): Danach entscheidet sich,
  // ob die Bar-Ausnahme bis zum Stichtag (Register B1) noch dasteht.
  const jetzt = new Date()
  const gruendung = await gruendungFuerSeiten(jetzt)
  return (
    <KundeShellMitSitzung>
      <FuerHoefeEinstieg gruendung={gruendung} />
      <FuerHoefeVorteile />
      <FuerHoefeSchritte />
      <FuerHoefePreise jetzt={jetzt} gruendung={gruendung} />
      <FuerHoefeFutter />
      <FuerHoefeFragen jetzt={jetzt} />
      <FuerHoefeSchluss />
      <StartseiteFuss jahr={jetzt.getFullYear()} />
    </KundeShellMitSitzung>
  )
}
