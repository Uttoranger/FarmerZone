import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { getAdminFarms } from '@/server/queries/admin'
import { getMeldungenFuerAdmin } from '@/server/queries/meldung'
import { gruendungsplaetze, MAX_GRUENDUNGSHOEFE } from '@/lib/gruendungshof'
import { adminHofZeile } from '@/lib/admin-hoefe'
import { platzBeiFreischaltung } from '@/lib/admin-hoefe-seite'
import { MELDUNG_ART_LABEL, STATUS_ZU_ENTSCHEIDEN } from '@/lib/meldung'
import { MELDUNG_ART_TON } from '@/lib/hof-hilfe'
import { HoefeAnsicht, type AdminHof, type NeueMeldung } from '@/components/admin/hoefe-ansicht'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Admin — ${MARKE}` }
export const dynamic = 'force-dynamic'

/** So viele Meldungen zeigt „Neu im Briefkasten" am Handy — der Rest steht im Briefkasten. */
const NEU_IM_BRIEFKASTEN = 3

/**
 * Wie viele Gründungsplätze es gibt — an genau EINER Stelle der Seite (Register
 * K2). Bis Nr. 93 gemergt ist; danach aus ladePlattformEinstellung.
 */
const MAX_PLAETZE = MAX_GRUENDUNGSHOEFE

/*
 * /admin — Höfe und Freischaltung in der AdminShell (Nachtlauf Nr. 22f), seit
 * Nr. 94 im Seitenmuster (Register N15): Kennzahlen, Unterreiter, Inhalt. Die
 * Shell kommt aus src/app/admin/layout.tsx; die Seite prüft trotzdem selbst
 * und zuerst (verlangeAdminSeite, frisch aus der Datenbank).
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
        ...adminHofZeile(f, { gruendungsplatz: plaetze.get(f.id) ?? null, maxPlaetze: MAX_PLAETZE }, jetzt),
        aktivitaet: f.aktivitaet,
        // Das wirksame Gründungs-Ende, fertig aus getAdminFarms (Nr. 62).
        gruendung: f.gruendung,
        // Nur wartende Höfe: der Platz, den sie bei sofortiger Freischaltung bekämen (Warteliste).
        platzBeiFreischaltung: f.approvedAt === null && f.archivedAt === null ? platzBeiFreischaltung(f.id, farms, jetzt, MAX_PLAETZE) : null,
      })),
      vergeben: Math.min(plaetze.size, MAX_PLAETZE),
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
        <HoefeAnsicht hoefe={daten.hoefe} vergebenePlaetze={daten.vergeben} maxPlaetze={MAX_PLAETZE} neueMeldungen={daten.neu} />
      ) : (
        <AdminFehler titel="Höfe" satz="Wir konnten die Höfe gerade nicht laden." nochmal="/admin" />
      )}
    </div>
  )
}
