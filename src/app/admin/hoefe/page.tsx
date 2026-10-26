import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { prisma } from '@/lib/prisma'
import { getAdminFarms } from '@/server/queries/admin'
import { getMeldungenFuerAdmin } from '@/server/queries/meldung'
import { lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { gruendungEinstellungAus } from '@/lib/plattform-einstellung'
import { gruendungsplaetze, zaehleAusgenommene } from '@/lib/gruendungshof'
import { adminHofZeile } from '@/lib/admin-hoefe'
import { gruendungAenderung, gruendungZuletztText, platzBeiFreischaltung, testhofAenderung } from '@/lib/admin-hoefe-seite'
import { MELDUNG_ART_LABEL, STATUS_ZU_ENTSCHEIDEN } from '@/lib/meldung'
import { MELDUNG_ART_TON } from '@/lib/hof-hilfe'
import { HoefeAnsicht, type AdminHof, type NeueMeldung } from '@/components/admin/hoefe-ansicht'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Admin — ${MARKE}` }
export const dynamic = 'force-dynamic'

/** So viele Meldungen zeigt „Neu im Briefkasten" am Handy — der Rest steht im Briefkasten. */
const NEU_IM_BRIEFKASTEN = 3

/*
 * /admin/hoefe — Höfe und Freischaltung (seit Nr. 185 hier; /admin ist Heute,
 * alte Adressen /admin?… leiten mit 308 hierher) in der AdminShell (Nachtlauf Nr. 22f), seit
 * Nr. 94 im Seitenmuster (Register N15): Kennzahlen, Unterreiter, Inhalt. Die
 * Shell kommt aus src/app/admin/layout.tsx; die Seite prüft trotzdem selbst
 * und zuerst (verlangeAdminSeite, frisch aus der Datenbank).
 */
export default async function AdminPage(): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const jetzt = new Date()
  let daten: { hoefe: AdminHof[]; vergeben: number; maxPlaetze: number; ausgenommen: number; neu: NeueMeldung[] } | null = null
  try {
    const [farms, zuEntscheiden, einstellung] = await Promise.all([
      getAdminFarms(jetzt),
      getMeldungenFuerAdmin({ status: [...STATUS_ZU_ENTSCHEIDEN], art: null }),
      // Die Zahl der Plätze frisch aus der Einstellung (Register K2) — dieselbe, mit der die Actions prüfen.
      lesePlattformEinstellung(),
    ])
    const regeln = gruendungEinstellungAus(einstellung)
    const { plaetze: maxPlaetze, bis: standardBis } = regeln
    // Wer zuletzt aus- oder wieder aufgenommen hat (Nr. 109) — nur der Name, eine Abfrage für alle Höfe.
    const personIds = [...new Set(farms.flatMap((f) => (f.gruendungGeaendertVonUserId ? [f.gruendungGeaendertVonUserId] : [])))]
    const personen =
      personIds.length > 0 ? await prisma.user.findMany({ where: { id: { in: personIds } }, select: { id: true, name: true } }) : []
    const nameVon = new Map(personen.map((p) => [p.id, p.name]))
    // Plätze serverseitig: die Ansicht ist eine Client-Komponente und rechnet
    // nicht selbst mit Datumswerten.
    const plaetze = gruendungsplaetze(farms)
    daten = {
      hoefe: farms.map((f) => {
        const imRennenOderAusgenommen = f.approvedAt !== null && f.archivedAt === null
        return {
          ...adminHofZeile(f, { gruendungsplatz: plaetze.get(f.id) ?? null, maxPlaetze }, jetzt),
          aktivitaet: f.aktivitaet,
          // Das wirksame Gründungs-Ende, fertig aus getAdminFarms (Nr. 62).
          gruendung: f.gruendung,
          // Nur wartende Höfe: der Platz, den sie bei sofortiger Freischaltung bekämen (Warteliste).
          platzBeiFreischaltung: f.approvedAt === null && f.archivedAt === null ? platzBeiFreischaltung(f.id, farms, jetzt, regeln) : null,
          // Nur freigeschaltete, nicht stillgelegte Höfe lassen sich aus- bzw. wieder aufnehmen (Register K2, Nr. 109).
          gruendungAenderung: imRennenOderAusgenommen ? gruendungAenderung(f, farms, maxPlaetze, standardBis) : null,
          // Testhof (Register N21, Nr. 119): markieren wie ausnehmen, zurücknehmen bei jedem Testhof.
          testhofAenderung: testhofAenderung(f, farms, maxPlaetze),
          gruendungZuletzt: gruendungZuletztText(
            f.gruendungGeaendertAm,
            f.gruendungGeaendertVonUserId ? (nameVon.get(f.gruendungGeaendertVonUserId) ?? null) : null
          ),
        }
      }),
      vergeben: Math.min(plaetze.size, maxPlaetze),
      maxPlaetze,
      ausgenommen: zaehleAusgenommene(farms),
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
        <HoefeAnsicht
          hoefe={daten.hoefe}
          vergebenePlaetze={daten.vergeben}
          maxPlaetze={daten.maxPlaetze}
          ausgenommen={daten.ausgenommen}
          neueMeldungen={daten.neu}
        />
      ) : (
        <AdminFehler titel="Höfe" satz="Wir konnten die Höfe gerade nicht laden." nochmal="/admin/hoefe" />
      )}
    </div>
  )
}
