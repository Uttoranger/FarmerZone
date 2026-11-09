import Link from 'next/link'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { AKTIONSLEISTE_KNOPF, FesteAktionsleiste } from '@/components/ui/feste-aktionsleiste'
import { LadeFehlerKasten } from '@/components/ui/lade-fehler-kasten'
import { KNOPF_ORANGE } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'
import { KOPF_AKTION } from './verkaeufe-laden'

/** Der Weg zum Dialog „Verkauf eintragen“ — dieselbe Adresse wie im Neu-Menü (Register E13). */
const NEU_HREF = '/sales?neu=1'

/**
 * Fehler beim Laden der Verkäufe — inline statt der ganzseitigen 500 (DESIGN_SYSTEM „Zustände"), mit
 * Werkzeug-Kopf samt Unterzeile (G1) und dem orangen Kasten (G6, Board s2-/w2-verkaeufe Bild 6). Die
 * Kopf-Aktion „Verkauf eintragen“ bleibt auch im Fehler (Liste Lauf 32 verkaeufe): ein Link, der die Seite
 * neu lädt und den Dialog öffnet. Der Weg zurück ist ein Link auf dieselbe Seite.
 */
export function VerkaeufeFehler({ unterzeile }: { unterzeile?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      <WerkzeugKopf
        titel="Verkäufe"
        unterzeile={unterzeile}
        aktion={
          <Link href={NEU_HREF} className={cn(KNOPF_ORANGE, KOPF_AKTION)}>
            Verkauf eintragen
          </Link>
        }
      />
      <LadeFehlerKasten titel="Wir konnten deine Verkäufe gerade nicht laden." nochmal="/sales" />
      <FesteAktionsleiste className="md:hidden">
        <Link href={NEU_HREF} className={AKTIONSLEISTE_KNOPF}>
          Verkauf eintragen
        </Link>
      </FesteAktionsleiste>
    </div>
  )
}
