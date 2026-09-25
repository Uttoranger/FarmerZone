import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { getMeldungDetail } from '@/server/queries/meldung'
import { MELDUNG_ART_LABEL, STATUS_INTERN, STATUS_MARKE_FARBE, kiBegruendung, kurznummer, prLink } from '@/lib/meldung'
import { Marke } from '@/components/ui/marke'
import { TriageForm, type TriageWerte } from './triage-form'
import { KiVorschlag } from './ki-vorschlag'

export const metadata: Metadata = { title: 'Meldung — Admin — FarmerZone' }
export const dynamic = 'force-dynamic'

function zeitpunkt(d: Date): string {
  return d.toLocaleString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Vienna',
  })
}

/**
 * Detailansicht einer Meldung für den Betreiber: voller Text, Kontext,
 * Screenshot und die Triage-Felder. Die Kurznummer in der Adresse reicht —
 * getMeldungDetail löst ein Präfix auf.
 */
export default async function AdminMeldungDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await verlangeAdminSeite()

  const { id } = await params
  const m = await getMeldungDetail(id)
  if (!m) notFound()

  const gespeichert: TriageWerte = {
    status: m.status,
    clusterKey: m.clusterKey ?? '',
    triageNotiz: m.triageNotiz ?? '',
    duplikatVonId: m.duplikatVonId ? kurznummer(m.duplikatVonId) : '',
    sprintName: m.sprintName ?? '',
    antwortAnMelder: m.antwortAnMelder ?? '',
  }
  const pr = prLink(m.sprintName)

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/admin/meldungen" className="text-sm text-primary hover:underline">
          ← Meldungen
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-semibold text-foreground">{m.kurznummer}</h1>
          <span className="text-sm font-medium text-foreground">{MELDUNG_ART_LABEL[m.art]}</span>
          <Marke farbe={STATUS_MARKE_FARBE[m.status]}>{STATUS_INTERN[m.status]}</Marke>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {zeitpunkt(m.createdAt)}
          {' · '}
          {m.farm ? (
            <>
              Hof{' '}
              <Link href={`/${m.farm.slug}`} className="text-primary hover:underline">
                {m.farm.name}
              </Link>
            </>
          ) : m.customerEmail ? (
            <>Kundin · {m.customerEmail}</>
          ) : (
            'Anonym'
          )}
        </p>

        {m.status === 'VERMUTLICH_WUNSCH' && (
          <KiVorschlag meldungId={m.id} gespeichert={gespeichert} begruendung={kiBegruendung(m.triageNotiz)} />
        )}

        {/* Text */}
        <section className="mt-5 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Meldung</h2>
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{m.text}</p>
          {m.diagKennung && (
            <p className="mt-3 text-xs text-muted-foreground">
              Kennung: <span className="font-mono text-foreground">{m.diagKennung}</span>
            </p>
          )}
        </section>

        {/* Screenshot */}
        {m.screenshotUrl && (
          <section className="mt-4 rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Screenshot</h2>
            <a href={m.screenshotUrl} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- fremde Blob-Adresse, keine Optimierung nötig */}
              <img src={m.screenshotUrl} alt="Screenshot zur Meldung" className="max-h-96 w-auto max-w-full rounded-lg border border-border" />
            </a>
          </section>
        )}

        {/* Kontext */}
        <section className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Kontext</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Seite</dt>
            <dd className="break-all text-foreground">{m.seiteUrl || '—'}</dd>
            <dt className="text-muted-foreground">Viewport</dt>
            <dd className="text-foreground">{m.viewport || '—'}</dd>
            <dt className="text-muted-foreground">Browser</dt>
            <dd className="break-all text-foreground">{m.userAgent || '—'}</dd>
            <dt className="text-muted-foreground">ID</dt>
            <dd className="break-all font-mono text-foreground">{m.id}</dd>
            {m.sprintName && (
              <>
                <dt className="text-muted-foreground">Sprint</dt>
                <dd className="text-foreground">
                  {pr ? (
                    <a href={pr} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-text underline-offset-2 hover:underline">
                      {m.sprintName}
                    </a>
                  ) : (
                    m.sprintName
                  )}
                </dd>
              </>
            )}
            {m.triagedAt && (
              <>
                <dt className="text-muted-foreground">Triage</dt>
                <dd className="text-foreground">{zeitpunkt(m.triagedAt)}</dd>
              </>
            )}
          </dl>
        </section>

        {/* Triage */}
        <section className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Triage</h2>
          <TriageForm meldungId={m.id} art={m.art} werte={gespeichert} hatHof={m.farm !== null} />
        </section>
      </div>
    </main>
  )
}
