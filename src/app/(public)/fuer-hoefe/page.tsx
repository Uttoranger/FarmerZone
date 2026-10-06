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

const SEITEN_TITEL = 'Für Höfe — FarmerZone'
const SEITEN_BESCHREIBUNG =
  `Dein Hofladen, online: Kunden bestellen vorab, du packst nach Liste und übergibst zur Abholzeit. ` +
  // Kein Tarif als sofort gültig (Register K1): erst kostenlos, die Tarife ab dem Stichtag.
  `${STARTPHASE_SATZ} ${TARIFE_AB_SATZ} Die Servicegebühr von ${SERVICEGEBUEHR_SATZ_TEXT} zahlt der Kunde.`

export const metadata: Metadata = {
  title: SEITEN_TITEL,
  description: SEITEN_BESCHREIBUNG,
  openGraph: {
    title: SEITEN_TITEL,
    description: SEITEN_BESCHREIBUNG,
    type: 'website',
    siteName: 'FarmerZone',
    images: [STARTSEITE_VORSCHAUBILD],
  },
}

// Ganz statisch: Die Seite liest nichts aus der Anfrage und nichts aus der
// Datenbank (das Bild der App zeigt erfundene Daten). Die Sitzung für die
// Kopfzeile liest KundeShellMitSitzung im Browser — Vorbild Startseite. Das
// Jahr im Fuß gilt je Bau; einmal am Tag neu gebaut, damit es nie lange
// hinterherhängt.
export const revalidate = 86400

/**
 * „Für Höfe" (Gate 5, Nr. 15) — Mockups web-h0-fuer-hoefe und
 * mobil-h0-fuer-hoefe. Preise und der Übergang (K1) ausschließlich aus
 * src/lib/konditionen.ts, dieselbe Quelle wie /konditionen.
 */
export default function FuerHoefePage(): React.JSX.Element {
  // Einmal je Bau bzw. Revalidierung (revalidate unten): Danach entscheidet sich,
  // ob die Bar-Ausnahme bis zum Stichtag (Register B1) noch dasteht.
  const jetzt = new Date()
  return (
    <KundeShellMitSitzung>
      <FuerHoefeEinstieg />
      <FuerHoefeVorteile />
      <FuerHoefeSchritte />
      <FuerHoefePreise jetzt={jetzt} />
      <FuerHoefeFutter />
      <FuerHoefeFragen jetzt={jetzt} />
      <FuerHoefeSchluss />
      <StartseiteFuss jahr={jetzt.getFullYear()} />
    </KundeShellMitSitzung>
  )
}
