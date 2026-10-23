import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmSettings } from '@/server/queries/farm'
import { PickupSlotsClient } from '@/components/settings/pickup-slots-client'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
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

  return (
    <div className={UNTERSEITE_RAHMEN}>
      <UnterseitenKopf
        titel={TITEL}
        satz="Lege fest, wann Kunden ihre Bestellungen abholen können. Deine Abholzeiten gelten dauerhaft jede Woche. Kundinnen können Termine bis zu 14 Tage im Voraus wählen."
      />
      <div data-app-palette="neu">
        <PickupSlotsClient initialSlots={farm.pickupSlots} />
      </div>
    </div>
  )
}
