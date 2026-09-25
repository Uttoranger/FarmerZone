import type { Metadata } from 'next'
import Link from 'next/link'
import { verlangeAdminSeite } from '@/server/admin-wache'
import {
  filterAusParametern,
  getMeldungenFuerAdmin,
  getWunschCluster,
  type AdminMeldungFilter,
} from '@/server/queries/meldung'
import {
  MELDUNG_ARTEN,
  MELDUNG_ART_LABEL,
  MELDUNG_STATUS,
  STATUS_INTERN,
  STATUS_MARKE_FARBE,
  STATUS_OFFEN,
  STATUS_ZU_ENTSCHEIDEN,
  prLink,
} from '@/lib/meldung'
import { Marke } from '@/components/ui/marke'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Meldungen — Admin — FarmerZone' }
export const dynamic = 'force-dynamic'

type Suche = { status?: string; art?: string; reiter?: string }

function datum(d: Date): string {
  return d.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Vienna' })
}

/** Ein Link auf dieselbe Seite mit geändertem Filter — der Rest bleibt erhalten. */
function filterHref(basis: Suche, aenderung: Partial<Suche>): string {
  const params = new URLSearchParams()
  const naechste = { ...basis, ...aenderung }
  for (const [k, v] of Object.entries(naechste)) if (v) params.set(k, v)
  const q = params.toString()
  return q ? `/admin/meldungen?${q}` : '/admin/meldungen'
}

function Chip({ href, aktiv, children }: { href: string; aktiv: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-medium transition-colors',
        aktiv
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </Link>
  )
}

/**
 * /admin/meldungen — die Triage-Liste des Betreibers (Sprint fehlerbriefkasten,
 * Teil D). Startansicht „Zu entscheiden": NEU + VERMUTLICH_WUNSCH — was auf
 * den Menschen wartet (Sprint Briefkasten-Rückkopplung). Der Reiter „Wünsche" zeigt die
 * gezählte Wunschliste nach clusterKey — Grundlage einer Entscheidung, nie ihr
 * Ersatz. Bei 375px sind die Zeilen Karten, keine Tabelle: nichts scrollt quer.
 */
export default async function AdminMeldungenPage({ searchParams }: { searchParams: Promise<Suche> }) {
  await verlangeAdminSeite()

  const suche = await searchParams
  const reiter = suche.reiter === 'wuensche' ? 'wuensche' : 'meldungen'
  const filter = filterAusParametern(suche, STATUS_ZU_ENTSCHEIDEN)

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="text-sm text-primary hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">Meldungen</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Eingangskanal, kein Befehlskanal — entscheiden tut der Betreiber.
        </p>

        {/* Reiter — schlichte Seitenlinks (kein ARIA-Tab-Widget: keine Pfeiltasten-Navigation nötig) */}
        <nav className="mb-4 flex gap-2 border-b border-border" aria-label="Ansicht">
          <Link
            aria-current={reiter === 'meldungen' ? 'page' : undefined}
            href={filterHref(suche, { reiter: undefined })}
            className={cn(
              'min-h-10 border-b-2 px-3 pb-2 pt-1 text-sm font-medium',
              reiter === 'meldungen' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
            )}
          >
            Meldungen
          </Link>
          <Link
            aria-current={reiter === 'wuensche' ? 'page' : undefined}
            href={filterHref(suche, { reiter: 'wuensche' })}
            className={cn(
              'min-h-10 border-b-2 px-3 pb-2 pt-1 text-sm font-medium',
              reiter === 'wuensche' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'
            )}
          >
            Wünsche
          </Link>
        </nav>

        {reiter === 'wuensche' ? <WunschReiter /> : <MeldungReiter suche={suche} filter={filter} />}
      </div>
    </main>
  )
}

async function MeldungReiter({ suche, filter }: { suche: Suche; filter: AdminMeldungFilter }) {
  const meldungen = await getMeldungenFuerAdmin(filter)
  const istVoreinstellung = !suche.status
  const gleicheMenge = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((s) => b.includes(s))
  const statusChips: Array<{ wert: string | undefined; label: string; aktiv: boolean }> = [
    { wert: undefined, label: 'Zu entscheiden', aktiv: istVoreinstellung },
    { wert: STATUS_OFFEN.join(','), label: 'Offen', aktiv: !istVoreinstellung && gleicheMenge(filter.status, STATUS_OFFEN) },
    ...MELDUNG_STATUS.map((s) => ({
      wert: s,
      label: STATUS_INTERN[s],
      aktiv: !istVoreinstellung && filter.status.length === 1 && filter.status[0] === s,
    })),
    {
      wert: MELDUNG_STATUS.join(','),
      label: 'Alle',
      aktiv: !istVoreinstellung && filter.status.length === MELDUNG_STATUS.length,
    },
  ]

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1.5" aria-label="Status">
        {statusChips.map((c) => (
          <Chip key={c.label} href={filterHref(suche, { status: c.wert })} aktiv={c.aktiv}>
            {c.label}
          </Chip>
        ))}
      </div>
      <div className="mb-5 flex flex-wrap gap-1.5" aria-label="Art">
        <Chip href={filterHref(suche, { art: undefined })} aktiv={filter.art === null}>
          Alle Arten
        </Chip>
        {MELDUNG_ARTEN.map((a) => (
          <Chip key={a} href={filterHref(suche, { art: a })} aktiv={filter.art === a}>
            {MELDUNG_ART_LABEL[a]}
          </Chip>
        ))}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {meldungen.length === 0
          ? 'Keine Meldungen mit diesem Filter.'
          : meldungen.length === 1
            ? '1 Meldung'
            : `${meldungen.length} Meldungen${meldungen.length === 200 ? ' (die jüngsten 200)' : ''}`}
        {' · Voreinstellung: '}
        {STATUS_ZU_ENTSCHEIDEN.map((s) => STATUS_INTERN[s]).join(' + ')}
      </p>

      <ul className="space-y-2">
        {meldungen.map((m) => {
          const pr = prLink(m.sprintName)
          return (
            // Die ganze Karte ist klickbar (after:-Fläche des Links), der PR-Link liegt
            // darüber — ein Link im Link wäre ungültiges HTML.
            <li
              key={m.id}
              className="relative rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <Link
                  href={`/admin/meldungen/${m.id}`}
                  className="font-mono font-semibold text-foreground after:absolute after:inset-0 after:rounded-xl focus-visible:underline focus-visible:outline-none"
                >
                  {m.kurznummer}
                </Link>
                <span className="font-medium text-foreground">{MELDUNG_ART_LABEL[m.art]}</span>
                <span>{datum(m.createdAt)}</span>
                <span className="truncate">{m.hofName ?? (m.customerEmail ? 'Kundin' : 'Anonym')}</span>
                <Marke farbe={STATUS_MARKE_FARBE[m.status]} className="ml-auto">
                  {STATUS_INTERN[m.status]}
                </Marke>
              </div>
              <p className="mt-1.5 truncate text-sm text-foreground">{m.ersteZeile || '—'}</p>
              {(m.diagKennung || m.clusterKey || m.sprintName) && (
                <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                  {m.diagKennung && <span>Kennung {m.diagKennung}</span>}
                  {m.clusterKey && <span>Cluster {m.clusterKey}</span>}
                  {pr ? (
                    <a
                      href={pr}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative z-10 font-medium text-brand-text underline-offset-2 hover:underline"
                    >
                      {m.sprintName}
                    </a>
                  ) : (
                    m.sprintName && <span>Sprint {m.sprintName}</span>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

async function WunschReiter() {
  const cluster = await getWunschCluster()
  const gesamt = cluster.reduce((s, c) => s + c.anzahl, 0)

  return (
    <>
      <p className="mb-3 text-xs text-muted-foreground">
        {gesamt === 0
          ? 'Noch keine Wünsche.'
          : `${gesamt} ${gesamt === 1 ? 'Wunsch' : 'Wünsche'} in ${cluster.length} ${cluster.length === 1 ? 'Bündel' : 'Bündeln'} — Duplikate ausgenommen. Bündel entstehen über den Cluster-Schlüssel in der Triage.`}
      </p>
      <ul className="space-y-2">
        {cluster.map((c) => (
          <li key={c.clusterKey ?? '__ohne'} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-foreground">
                {c.clusterKey ?? 'Ohne Cluster'}
              </span>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {c.anzahl}×
              </span>
            </div>
            <ul className="mt-2 space-y-1">
              {c.beispiele.map((b) => (
                <li key={b.id} className="text-xs text-muted-foreground">
                  <Link href={`/admin/meldungen/${b.id}`} className="hover:underline">
                    <span className="font-mono text-foreground">{b.kurznummer}</span>
                    {' · '}
                    {b.hofName ?? 'Kundin'}
                    {' · '}
                    {b.ersteZeile || '—'}
                  </Link>
                </li>
              ))}
              {c.anzahl > c.beispiele.length && (
                <li className="text-xs text-muted-foreground">… und {c.anzahl - c.beispiele.length} weitere</li>
              )}
            </ul>
          </li>
        ))}
      </ul>
    </>
  )
}
