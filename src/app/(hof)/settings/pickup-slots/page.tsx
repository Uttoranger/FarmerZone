import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmSettings } from '@/server/queries/farm'
import { PickupSlotsClient } from '@/components/settings/pickup-slots-client'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'
import { UNTERSEITE_RAHMEN, UNTERSEITE_SATZ } from '@/components/hof-einstellungen/einstellungen-laden'
import { MARKE } from '@/lib/marke'

/** Titel der Seite — für den Kopf und den Tab, eine Schreibweise. */
const TITEL = 'Abholzeiten'

export const metadata: Metadata = { title: `${TITEL} — ${MARKE}` }

/*
 * Abholzeiten in der HofShell (Nachtlauf Nr. 22d): dieselbe Liste und dieselben
 * Actions (addPickupSlot, togglePickupSlotActive, deletePickupSlot — Regeln in
 * pickup-slot-rules.ts, maxOrders unverändert), nur Kopf und Rahmen neu.
 * Anders als die übrigen Unterseiten bleibt sie nach dem Speichern offen
 * (Nr. 44): Abholzeiten legt man meist mehrere nacheinander an.
 */
export default async function PickupSlotsPage(): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getFarmSettings(userId)
  if (!farm) redirect('/onboarding')
  const jetzt = new Date()

  return (
    <div className={UNTERSEITE_RAHMEN}>
      {/* Werkzeug-Kopf (G1, Nr. 250) mit Hof-Unterzeile, der Satz darunter (Boards s2-/w2-hofdaten-zahlung). */}
      <WerkzeugKopf titel={TITEL} unterzeile={<HofUnterzeile hofName={farm.name} jetzt={jetzt} />} />
      <p className={UNTERSEITE_SATZ}>Lege fest, wann Kunden ihre Bestellungen abholen können. Deine Abholzeiten gelten dauerhaft jede Woche. Kundinnen können Termine bis zu 14 Tage im Voraus wählen.</p>
      <div data-app-palette="neu">
        <PickupSlotsClient initialSlots={farm.pickupSlots} />
      </div>
    </div>
  )
}
