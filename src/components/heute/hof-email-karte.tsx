import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { HOF_EMAIL_TEXT } from '@/lib/hof-kontakt'

/**
 * Karte „E-Mail-Adresse für Kundschaft eintragen“ in Heute (Nr. 212, § 4 Abs. 1
 * Z 3 FAGG) — dasselbe Muster wie die AGB-Karte: Hinweiskarte orange, ein Link.
 * Die Seite zeigt sie nur bei leerem Feld (hofEmailFehlt); mit gespeicherter
 * Adresse ist sie weg. Kein Lockout, kein Formular hier: Eingetragen wird in
 * den Einstellungen, dort wo das Feld ohnehin steht.
 */
export function HofEmailKarte(): React.JSX.Element {
  return (
    <Hinweiskarte
      ton="orange"
      symbol={Mail}
      titel={HOF_EMAIL_TEXT.karteTitel}
      aktion={
        <Link href={HOF_EMAIL_TEXT.einstellungenPfad} className={KNOPF_RAHMEN}>
          {HOF_EMAIL_TEXT.karteLink}
        </Link>
      }
    >
      <p className="text-[12.5px]">{HOF_EMAIL_TEXT.karteSatz}</p>
    </Hinweiskarte>
  )
}
