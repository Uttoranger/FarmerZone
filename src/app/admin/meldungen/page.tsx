import type { Metadata } from 'next'
import * as Sentry from '@sentry/nextjs'
import { verlangeAdminSeite } from '@/server/admin-wache'
import {
  filterAusParametern,
  getMeldungenFuerAdmin,
  getWunschCluster,
  zaehleMeldungenJeStatus,
  type AdminMeldungZeile,
  type WunschCluster,
} from '@/server/queries/meldung'
import { MELDUNG_ARTEN, MELDUNG_ART_LABEL, STATUS_ZU_ENTSCHEIDEN, type MeldungStatus } from '@/lib/meldung'
import { MELDUNG_ART_TON } from '@/lib/hof-hilfe'
import {
  ADMIN_STATUS_TON,
  STATUS_GRUPPEN,
  adminStatusText,
  aktiveStatusGruppe,
  artUmschalten,
  briefkastenAdresse,
  herkunftZeile,
  zaehleStatusGruppen,
  type BriefkastenSuche,
} from '@/lib/admin-briefkasten'
import { wienKalendertag } from '@/lib/kalender'
import { datumKurz } from '@/lib/verkauf-eintragen'
import { cn } from '@/lib/utils'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { LEISE } from '@/components/hof-bestellungen/stil'
import { ADMIN_RAHMEN, AdminFehler, SEITEN_TITEL } from '@/components/admin/admin-teile'
import { MeldungListe, Wunschliste, type BriefkastenZeile, type WunschBuendel } from '@/components/admin/briefkasten-teile'

export const metadata: Metadata = { title: 'Briefkasten — Admin — FarmerZone' }
export const dynamic = 'force-dynamic'

/** Mehr zeigt die Liste nie auf einmal (getMeldungenFuerAdmin). */
const LISTE_MAX = 200

/*
 * /admin/meldungen — der Briefkasten in der AdminShell (Nachtlauf Nr. 22f,
 * Mockup admin-briefkasten). Startansicht „Zu entscheiden": Neues und die
 * Wunsch-Vorschläge der KI. Daneben die gebündelte Wunschliste — Grundlage
 * einer Entscheidung, nie ihr Ersatz. Eingangskanal, kein Befehlskanal.
 */
export default async function AdminMeldungenPage({
  searchParams,
}: {
  searchParams: Promise<BriefkastenSuche & { reiter?: string }>
}): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const roh = await searchParams
  const suche: BriefkastenSuche = { status: roh.status, art: roh.art }
  const filter = filterAusParametern(suche, STATUS_ZU_ENTSCHEIDEN)
  const jetzt = new Date()

  let daten: { meldungen: AdminMeldungZeile[]; jeStatus: Partial<Record<MeldungStatus, number>>; cluster: WunschCluster[] } | null = null
  try {
    const [meldungen, jeStatus, cluster] = await Promise.all([
      getMeldungenFuerAdmin(filter),
      zaehleMeldungenJeStatus(filter.art),
      getWunschCluster(),
    ])
    daten = { meldungen, jeStatus, cluster }
  } catch (err) {
    // Nur der Bereich — nie Meldungstext.
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'briefkasten' } })
  }

  if (!daten) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel="Briefkasten" satz="Wir konnten den Briefkasten gerade nicht laden." nochmal="/admin/meldungen" />
      </div>
    )
  }

  const heute = wienKalendertag(jetzt)
  const zeilen: BriefkastenZeile[] = daten.meldungen.map((m) => ({
    id: m.id,
    art: MELDUNG_ART_LABEL[m.art],
    artTon: MELDUNG_ART_TON[m.art],
    titel: m.ersteZeile || '—',
    herkunft: `${herkunftZeile(m)} · Nr. ${m.kurznummer}`,
    datum: datumKurz(wienKalendertag(m.createdAt), heute),
    status: adminStatusText(m.status, m.sprintName),
    statusTon: ADMIN_STATUS_TON[m.status],
  }))
  const buendel: WunschBuendel[] = daten.cluster.map((c) => ({
    schluessel: c.clusterKey ?? '__ohne',
    name: c.clusterKey ?? 'Ohne Bündel',
    anzahl: c.anzahl,
    beispiele: c.beispiele.map((b) => ({ id: b.id, text: `${b.kurznummer} · ${b.hofName ?? 'Kundin'} · ${b.ersteZeile || '—'}` })),
    weitere: Math.max(0, c.anzahl - c.beispiele.length),
  }))
  const gruppe = aktiveStatusGruppe(suche.status, filter.status)
  const gruppenZahl = zaehleStatusGruppen(daten.jeStatus)
  const istVoreinstellung = gruppe === 'zu-entscheiden' && filter.art === null

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-5')}>
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <h1 className={SEITEN_TITEL}>Briefkasten</h1>
        <p className={cn('text-[13px]', LEISE)}>Wochen-Zusammenfassung montags per E-Mail, wenn etwas wartet</p>
      </header>

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
        <FilterChipReihe beschriftung="Nach Stand filtern">
          {STATUS_GRUPPEN.map((g) => (
            <FilterChip key={g.id} href={briefkastenAdresse(suche, { status: g.wert })} aktiv={gruppe === g.id}>
              {g.label}
              <span className="ml-1 tabular-nums">· {gruppenZahl[g.id]}</span>
            </FilterChip>
          ))}
        </FilterChipReihe>
        <span aria-hidden="true" className="hidden h-6 w-px bg-border md:block" />
        <FilterChipReihe beschriftung="Nach Art filtern">
          {MELDUNG_ARTEN.map((a) => (
            <FilterChip key={a} href={briefkastenAdresse(suche, { art: artUmschalten(filter.art, a) })} aktiv={filter.art === a}>
              {MELDUNG_ART_LABEL[a]}
            </FilterChip>
          ))}
        </FilterChipReihe>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-2">
          <p className={cn('text-[13px]', LEISE)} aria-live="polite">
            {zeilen.length === 1 ? '1 Meldung' : `${zeilen.length} Meldungen`}
            {zeilen.length === LISTE_MAX && ' (die jüngsten 200)'}
          </p>
          <MeldungListe
            zeilen={zeilen}
            leer={
              istVoreinstellung
                ? { titel: 'Nichts zu entscheiden', satz: 'Neue Meldungen und Vorschläge der KI landen hier.', ausweg: { text: 'Offene Meldungen zeigen', href: briefkastenAdresse({}, { status: STATUS_GRUPPEN[1].wert }) } }
                : { titel: 'Keine Meldung passt', satz: 'Mit diesem Filter gibt es keine Meldung.', ausweg: { text: 'Zu entscheiden zeigen', href: '/admin/meldungen' } }
            }
          />
        </div>
        <Wunschliste buendel={buendel} />
      </div>
    </div>
  )
}
