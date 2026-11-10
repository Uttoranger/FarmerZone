import Link from 'next/link'
import { PFLICHT_KNOPF_RAHMEN, PflichtKarte } from '@/components/heute/pflicht-karte'
import { HOF_EMAIL_TEXT } from '@/lib/hof-kontakt'

/**
 * Karte „E-Mail-Adresse für Kundschaft eintragen“ in Heute (Nr. 212, § 4 Abs. 1
 * Z 3 FAGG) — dasselbe Muster wie die AGB-Karte: PflichtKarte, ein Link über die volle Breite.
 * Die Seite zeigt sie nur bei leerem Feld (hofEmailFehlt); mit gespeicherter
 * Adresse ist sie weg. Kein Lockout, kein Formular hier: Eingetragen wird in
 * den Einstellungen, dort wo das Feld ohnehin steht.
 */
export function HofEmailKarte(): React.JSX.Element {
  return (
    <PflichtKarte
      titel={HOF_EMAIL_TEXT.karteTitel}
      knoepfe={
        <Link href={HOF_EMAIL_TEXT.einstellungenPfad} className={PFLICHT_KNOPF_RAHMEN}>
          {HOF_EMAIL_TEXT.karteLink}
        </Link>
      }
    >
      <p>{HOF_EMAIL_TEXT.karteSatz}</p>
    </PflichtKarte>
  )
}
