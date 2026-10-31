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
import { ladeKontoStand } from '@/lib/konto-schliessen'
import { schliessenSperre, wiederOeffnenBis, wiederOeffnenMoeglich } from '@/lib/konto-anfragen'
import { formatTagKurz } from '@/lib/format'
import { kalendertagInWien } from '@/lib/wiener-tag'
import type { HofKontoDaten } from '@/components/admin/hof-akte-konto'
import { HofAktePlattformgebuehr, type PlattformgebuehrAkteAnzeige } from '@/components/admin/hof-akte-plattformgebuehr'
import { ladePlattformgebuehrAkte } from '@/server/queries/plattformgebuehr'
import { HofAkteWiderrufe, type HofAkteWiderrufAnzeige } from '@/components/admin/hof-akte-widerrufe'
import { ladeWiderrufeDesHofs } from '@/server/widerruf'

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

  // Abschnitt „Widerrufe“ (Nr. 200, Nachbesserung Runde 2): ebenso eigen — ohne Name, Adresse und Nachricht.
  let widerrufe: HofAkteWiderrufAnzeige[] | null = null
  if (geladen) {
    try {
      widerrufe = await ladeWiderrufeDesHofs(id)
    } catch (err) {
      Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'hof-akte', teil: 'widerrufe' } })
    }
  }

  return (
    <div className={ADMIN_RAHMEN}>
      {geladen ? (
        <HofAkteAnsicht
          // Die Anmelde-E-Mail verlässt den Server nur gekürzt (Freigabe 187, Punkt 2) — auch in den Daten der Dialoge.
          hof={{ ...geladen.hof, ownerEmail: maskiereAdresse(geladen.hof.ownerEmail) }}
          zustand={geladen.zustand}
          konto={kontoDaten(geladen, jetzt)}
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
      {widerrufe && <HofAkteWiderrufe liste={widerrufe} />}
    </div>
  )
}

async function laden(id: string, jetzt: Date) {
  const [{ rows, hoefe }, akte, kontoStand] = await Promise.all([ladeAdminHoefe(jetzt), ladeHofAkte(id, jetzt), ladeKontoStand(id)])
  const hof = hoefe.find((h) => h.id === id)
  const row = rows.find((r) => r.id === id)
  if (!hof || !row || !akte) return 'fehlt' as const
  return { hof, zustand: hofZustand(row), akte, kontoStand }
}

/** Die Konto-Knöpfe (Nr. 190): Zustand als Text, nie als Date; die Adresse nur gekürzt. */
function kontoDaten(geladen: Exclude<Awaited<ReturnType<typeof laden>>, 'fehlt'>, jetzt: Date): HofKontoDaten | null {
  const stand = geladen.kontoStand
  if (!stand) return null
  const bis = wiederOeffnenBis(stand.geschlossenAm)
  return {
    farmId: geladen.hof.id,
    name: geladen.hof.name,
    anmeldungGekuerzt: maskiereAdresse(geladen.akte.hof.owner.email),
    geschlossen: stand.geschlossenAm
      ? { bis: bis ? formatTagKurz(kalendertagInWien(bis)) : null, wiederOeffnen: wiederOeffnenMoeglich(stand, jetzt), endgueltig: stand.endgueltigAm !== null }
      : null,
    schliessenSperre: schliessenSperre(stand.offen),
  }
}
