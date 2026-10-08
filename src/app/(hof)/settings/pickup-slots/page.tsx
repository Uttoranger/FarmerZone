import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getFarmSettings } from '@/server/queries/farm'
import { PickupSlotsClient } from '@/components/settings/pickup-slots-client'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'

export const metadata: Metadata = { title: 'Abholzeiten — FarmerZone' }

/*
 * Abholzeiten in der HofShell (Nachtlauf Nr. 22d): dieselbe Liste und dieselben
 * Actions (addPickupSlot, togglePickupSlotActive, deletePickupSlot — Regeln in
 * pickup-slot-rules.ts, maxOrders unverändert), nur Kopf und Rahmen neu.
 * Anders als die übrigen Unterseiten bleibt sie nach dem Speichern offen
 * (Nr. 44): Abholzeiten legt man meist mehrere nacheinander an.
 */
export default async function PickupSlotsPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmSettings(session.user.id)
  if (!farm) redirect('/login')

  return (
    <div className={UNTERSEITE_RAHMEN}>
      <UnterseitenKopf
        titel="Abholzeiten"
        satz="Lege fest, wann Kunden ihre Bestellungen abholen können. Deine Abholzeiten gelten dauerhaft jede Woche. Kundinnen können Termine bis zu 14 Tage im Voraus wählen."
      />
      <div data-app-palette="neu">
        <PickupSlotsClient initialSlots={farm.pickupSlots} />
      </div>
    </div>
  )
}
