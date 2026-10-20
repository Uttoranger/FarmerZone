import type { Metadata } from 'next'
import { ladeEinrichtenStand, verlangeEinrichtenSeite } from '@/server/admin-wache'
import { ANMELDEART, EINRICHTEN_TEXT, einrichtenBis, einrichtenZustand } from '@/lib/admin-anmeldung'
import { anmeldeZeitpunkt } from '@/lib/geraete'
import { MARKE } from '@/lib/marke'
import { cn } from '@/lib/utils'
import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { EinrichtenSchritte, type EinrichtenAnsicht } from './einrichten-schritte'

export const metadata: Metadata = { title: `${EINRICHTEN_TEXT.seitentitel} — Admin — ${MARKE}` }
// Zeigt den Stand der eigenen Sitzung (Code, Passkey, Fenster) — nie aus einem Cache.
export const dynamic = 'force-dynamic'

/**
 * /admin/einrichten — die Pflichtseite (Register N20, Ergänzung Lauf 18;
 * Nr. 115; Mockup system-admin-anmeldung-passkey, Schritte 4 und 5). Die
 * EINZIGE Admin-Seite, die ohne Passkey öffnet (verlangeEinrichtenSeite):
 * Jede andere leitet ohne Passkey hierher (src/server/admin-wache.ts). Nach
 * dem ersten Passkey bleibt sie erreichbar — für Ersatzcodes und den zweiten
 * Passkey, nur in einer Sitzung mit Passkey.
 */
export default async function AdminEinrichtenPage(): Promise<React.JSX.Element> {
  const { pflicht } = await verlangeEinrichtenSeite()

  const jetzt = new Date()
  const stand = await ladeEinrichtenStand(jetzt)
  const zustand = einrichtenZustand(
    { adminSeit: stand.adminSeit, passkeys: stand.passkeys, sitzung: stand.sitzung, pflicht, codeBestaetigtAm: stand.codeBestaetigtAm },
    jetzt
  )
  const bis = einrichtenBis(stand.adminSeit)
  const ansicht: EinrichtenAnsicht = {
    zustand,
    bestaetigtText: stand.codeBestaetigtAm ? EINRICHTEN_TEXT.bestaetigtUm(stand.codeBestaetigtAm) : null,
    fensterText: bis ? EINRICHTEN_TEXT.fensterBis(bis) : null,
    codeOffen: stand.codeOffen,
    ersatzcodes: stand.ersatzcodes,
    jetztText: anmeldeZeitpunkt(jetzt),
    mitErsatzcode: stand.sitzung.anmeldeart === ANMELDEART.ersatzcode || stand.sitzung.anmeldeart === ANMELDEART.ersatzcodeEingeloest,
  }

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex max-w-[720px] flex-col gap-4 lg:gap-[18px]')}>
      <Seitenkopf titel={EINRICHTEN_TEXT.titel} satz={EINRICHTEN_TEXT.einleitung} />
      <EinrichtenSchritte ansicht={ansicht} />
    </div>
  )
}
