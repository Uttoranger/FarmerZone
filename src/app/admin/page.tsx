import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { getAdminFarms } from '@/server/queries/admin'
import { getMeldungenFuerAdmin } from '@/server/queries/meldung'
import { gruendungsplaetze, vergebeneGruendungsplaetze, MAX_GRUENDUNGSHOEFE } from '@/lib/gruendungshof'
import { adminHofZeile } from '@/lib/admin-hoefe'
import { MELDUNG_ART_LABEL, STATUS_ZU_ENTSCHEIDEN } from '@/lib/meldung'
import { MELDUNG_ART_TON } from '@/lib/hof-hilfe'
import { HoefeAnsicht, type AdminHof, type NeueMeldung } from '@/components/admin/hoefe-ansicht'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'

export const metadata: Metadata = { title: 'Admin — FarmerZone' }
export const dynamic = 'force-dynamic'

/** So viele Meldungen zeigt „Neu im Briefkasten" am Handy — der Rest steht im Briefkasten. */
const NEU_IM_BRIEFKASTEN = 3

/*
 * /admin — Höfe und Freischaltung in der AdminShell (Nachtlauf Nr. 22f).
 * Die Shell kommt aus src/app/admin/layout.tsx; die Seite prüft trotzdem
 * selbst und zuerst (verlangeAdminSeite, frisch aus der Datenbank).
 */
export default async function AdminPage(): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const jetzt = new Date()
  let daten: { hoefe: AdminHof[]; vergeben: number; neu: NeueMeldung[] } | null = null
  try {
    const [farms, zuEntscheiden] = await Promise.all([
      getAdminFarms(jetzt),
      getMeldungenFuerAdmin({ status: [...STATUS_ZU_ENTSCHEIDEN], art: null }),
    ])
    // Plätze serverseitig: die Ansicht ist eine Client-Komponente und rechnet
    // nicht selbst mit Datumswerten.
    const plaetze = gruendungsplaetze(farms)
    daten = {
      hoefe: farms.map((f) => ({
        ...adminHofZeile(f, { gruendungsplatz: plaetze.get(f.id) ?? null, maxPlaetze: MAX_GRUENDUNGSHOEFE }, jetzt),
        aktivitaet: f.aktivitaet,
      })),
      vergeben: vergebeneGruendungsplaetze(farms),
      neu: zuEntscheiden.slice(0, NEU_IM_BRIEFKASTEN).map((m) => ({
        id: m.id,
        art: MELDUNG_ART_LABEL[m.art],
        artTon: MELDUNG_ART_TON[m.art],
        titel: m.ersteZeile || '—',
      })),
    }
  } catch (err) {
    // Nur der Bereich — keine Hofnamen, keine Adressen.
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'hoefe' } })
  }

  return (
    <div className={ADMIN_RAHMEN}>
      {daten ? (
        <HoefeAnsicht hoefe={daten.hoefe} vergebenePlaetze={daten.vergeben} maxPlaetze={MAX_GRUENDUNGSHOEFE} neueMeldungen={daten.neu} />
      ) : (
        <AdminFehler titel="Höfe" satz="Wir konnten die Höfe gerade nicht laden." nochmal="/admin" />
      )}
    </div>
  )
}
