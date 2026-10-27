import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ladeAdminHoefe, ladeHofAkte } from '@/server/queries/admin-hof'
import { hofAkteAnsicht, ADMIN_HOEFE_HREF, adminHofHref } from '@/lib/admin-hof-akte'
import { hofZustand } from '@/lib/admin-hoefe-liste'
import { maskiereAdresse } from '@/lib/betrieb-mails'
import { LAND_LABEL, alsLand } from '@/lib/laender'
import { HofAkteAnsicht } from '@/components/admin/hof-akte-ansicht'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { MARKE } from '@/lib/marke'
import { HofAktePlattformgebuehr, type PlattformgebuehrAkteAnzeige } from '@/components/admin/hof-akte-plattformgebuehr'
import { ladePlattformgebuehrAkte } from '@/server/plattformgebuehr-abrechnung'

export const metadata: Metadata = { title: `Akte — Admin — ${MARKE}` }
export const dynamic = 'force-dynamic'

/*
 * /admin/hoefe/[id] — die Akte eines Hofs (Register N32, N33, N34; Nachtlauf
 * Nr. 187; Mockup admin-hof-akte): Kontakt, Aktivität, Zustand, Eingreifen
 * und die Akte aus dem Protokoll. Die Kennung in der Adresse sichert nichts —
 * die Seite prüft selbst und zuerst (verlangeAdminSeite, Recht „ansehen“);
 * jede Aktion prüft noch einmal mit ihrem Recht und frischem Passkey.
 */
export default async function HofAktePage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const ich = await verlangeAdminSeite()
  const { id } = await params

  const jetzt = new Date()
  let geladen: Awaited<ReturnType<typeof laden>> | null = null
  try {
    geladen = await laden(id, jetzt)
  } catch (err) {
    // Nur der Bereich — keine Hofnamen, keine Adressen.
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'hof-akte' } })
  }
  if (geladen === 'fehlt') notFound()

  // Abschnitt „Plattformgebühr“ (N38, Nr. 198): ein eigener Teil — scheitert er, bleibt die Akte.
  let plattformgebuehr: PlattformgebuehrAkteAnzeige | null = null
  if (geladen) {
    try {
      const akte = await ladePlattformgebuehrAkte(id, jetzt)
      plattformgebuehr = akte ? { farmId: id, ...akte } : null
    } catch (err) {
      Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'hof-akte', teil: 'plattformgebuehr' } })
    }
  }

  return (
    <div className={ADMIN_RAHMEN}>
      {geladen ? (
        <HofAkteAnsicht
          // Die Anmelde-E-Mail verlässt den Server nur gekürzt (Freigabe 187, Punkt 2) — auch in den Daten der Dialoge.
          hof={{ ...geladen.hof, ownerEmail: maskiereAdresse(geladen.hof.ownerEmail) }}
          zustand={geladen.zustand}
          akte={hofAkteAnsicht(
            { ...geladen.akte, hof: { ...geladen.akte.hof, landText: LAND_LABEL[alsLand(geladen.akte.hof.country)] } },
            {
              anmeldungGekuerzt: maskiereAdresse(geladen.akte.hof.owner.email),
              emailBestaetigt: geladen.hof.emailBestaetigtText,
              stripeBereit: geladen.hof.stripeBereit,
              onlineAn: geladen.hof.onlineAn,
              ich,
            },
            jetzt
          )}
        />
      ) : (
        <AdminFehler titel="Akte" satz="Wir konnten die Akte gerade nicht laden." nochmal={id ? adminHofHref(id) : ADMIN_HOEFE_HREF} />
      )}
      {plattformgebuehr && <HofAktePlattformgebuehr daten={plattformgebuehr} />}
    </div>
  )
}

async function laden(id: string, jetzt: Date) {
  const [{ rows, hoefe }, akte] = await Promise.all([ladeAdminHoefe(jetzt), ladeHofAkte(id, jetzt)])
  const hof = hoefe.find((h) => h.id === id)
  const row = rows.find((r) => r.id === id)
  if (!hof || !row || !akte) return 'fehlt' as const
  return { hof, zustand: hofZustand(row), akte }
}
