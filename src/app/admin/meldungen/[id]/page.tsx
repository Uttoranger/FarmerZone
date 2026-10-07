import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { getMeldungDetail, getMeldungNachbarn, type AdminMeldungDetail } from '@/server/queries/meldung'
import { MELDUNG_ART_LABEL, kiBegruendung, kurznummer, prLink } from '@/lib/meldung'
import { MELDUNG_ART_TON, geraetKurz } from '@/lib/hof-hilfe'
import { ADMIN_STATUS_TON, BRIEFKASTEN_HREF, adminStatusText, bildschirmText } from '@/lib/admin-briefkasten'
import { seitenPfad } from '@/lib/fremdtext'
import { wienKalendertag } from '@/lib/kalender'
import { datumKurz } from '@/lib/verkauf-eintragen'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KICKER, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { TriageForm, type TriageWerte } from './triage-form'
import { KiVorschlag } from './ki-vorschlag'

export const metadata: Metadata = { title: 'Meldung — Admin — FarmerZone' }
export const dynamic = 'force-dynamic'

function uhrzeit(d: Date): string {
  return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' })
}

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

/*
 * Meldung entscheiden (Nachtlauf Nr. 22f, Mockup admin-meldung-entscheiden):
 * links die Meldung mit Bildschirmfoto und dem, was automatisch mitkam,
 * rechts der Vorschlag der KI (nur ein Vorschlag — entschieden wird mit
 * einem Knopf) und das Formular „Entscheiden". Die Kurznummer in der Adresse
 * reicht — getMeldungDetail löst ein Präfix auf. Meldungstext und
 * Browserangabe sind Fremdtext und stehen nur als Text da.
 */
export default async function AdminMeldungDetailPage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const { id } = await params
  let daten: { m: AdminMeldungDetail | null; nachbarn: { vorige: string | null; naechste: string | null } } | null = null
  try {
    const m = await getMeldungDetail(id)
    daten = { m, nachbarn: m ? await getMeldungNachbarn(m) : { vorige: null, naechste: null } }
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'meldung' } })
  }

  if (!daten) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel="Meldung" satz="Wir konnten die Meldung gerade nicht laden." nochmal={`/admin/meldungen/${encodeURIComponent(id)}`} />
      </div>
    )
  }
  const { m, nachbarn } = daten
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
  const jetzt = new Date()
  const tag = datumKurz(wienKalendertag(m.createdAt), wienKalendertag(jetzt))
  const begruendung = kiBegruendung(m.triageNotiz)

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-4')}>
      <nav aria-label="Meldungen blättern" className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={BRIEFKASTEN_HREF}
          className={cn('inline-flex min-h-11 items-center gap-1 rounded-full pr-3 text-[14px] text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)}
        >
          <ChevronLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
          Briefkasten
        </Link>
        <div className="flex gap-2">
          {nachbarn.vorige && (
            <Link href={`/admin/meldungen/${nachbarn.vorige}`} className={KNOPF_RAHMEN}>
              <ChevronLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
              Vorige
            </Link>
          )}
          {nachbarn.naechste && (
            <Link href={`/admin/meldungen/${nachbarn.naechste}`} className={KNOPF_RAHMEN}>
              Nächste
              <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
            </Link>
          )}
        </div>
      </nav>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="flex min-w-0 flex-col gap-4">
          <article aria-labelledby="meldung-titel" className={cn(KARTE, 'flex flex-col gap-3 p-4 md:p-[18px]')}>
            <h1 id="meldung-titel" className="sr-only">
              Meldung {m.kurznummer}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <StatusBadge status={MELDUNG_ART_TON[m.art]}>{MELDUNG_ART_LABEL[m.art]}</StatusBadge>
              <StatusBadge status={ADMIN_STATUS_TON[m.status]}>{adminStatusText(m.status, m.sprintName)}</StatusBadge>
              <span className={LEISE}>
                {tag}, {uhrzeit(m.createdAt)} ·{' '}
                {m.farm ? (
                  <a
                    href={`/${m.farm.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn('rounded font-medium text-brand-text hover:underline', FOKUS_RAHMEN)}
                  >
                    {m.farm.name}
                  </a>
                ) : m.customerEmail ? (
                  <span className="break-all">Kundin · {m.customerEmail}</span>
                ) : (
                  'Anonym'
                )}
                {' · '}Nr. <span className="font-mono">{m.kurznummer}</span>
              </span>
            </div>
            <p className="text-[15.5px] leading-relaxed break-words whitespace-pre-wrap text-foreground">„{m.text}“</p>
            {m.screenshotUrl && (
              <a
                href={m.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('block self-start rounded-xl', FOKUS_RAHMEN)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- fremde Blob-Adresse, keine Optimierung nötig */}
                <img src={m.screenshotUrl} alt="Bildschirmfoto zur Meldung" className="max-h-96 w-auto max-w-full rounded-xl border border-border" />
              </a>
            )}
          </article>

          <section aria-labelledby="mitgeschickt-titel" className={cn(KARTE, 'p-4 md:p-[18px]')}>
            <h2 id="mitgeschickt-titel" className={KICKER}>
              Automatisch mitgeschickt
            </h2>
            <dl className="mt-2 grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] text-[13.5px] md:grid-cols-[140px_minmax(0,1fr)] [&>dd]:border-t [&>dd]:border-border [&>dd]:py-2.5 [&>dt]:border-t [&>dt]:border-border [&>dt]:py-2.5">
              <dt className={LEISE}>Seite</dt>
              <dd className="break-all text-foreground">{m.seiteUrl ? seitenPfad(m.seiteUrl) : '–'}</dd>
              <dt className={LEISE}>Gerät</dt>
              <dd className="text-foreground" title={m.userAgent}>
                {geraetKurz(m.userAgent)}
              </dd>
              <dt className={LEISE}>Bildschirm</dt>
              <dd className="text-foreground">{bildschirmText(m.viewport)}</dd>
              <dt className={LEISE}>Fehlernummer</dt>
              <dd className="font-mono text-foreground">{m.diagKennung || '–'}</dd>
              <dt className={LEISE}>Browser</dt>
              <dd className="text-[12.5px] break-all text-muted-foreground">{m.userAgent || '–'}</dd>
              {m.sprintName && (
                <>
                  <dt className={LEISE}>Sprint</dt>
                  <dd className="text-foreground">
                    {pr ? (
                      <a href={pr} target="_blank" rel="noopener noreferrer" className={cn('rounded font-medium text-brand-text hover:underline', FOKUS_RAHMEN)}>
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
                  <dt className={LEISE}>Entschieden</dt>
                  <dd className="text-foreground">{zeitpunkt(m.triagedAt)}</dd>
                </>
              )}
              <dt className={LEISE}>Kennung</dt>
              <dd className="font-mono text-[12.5px] break-all text-muted-foreground">{m.id}</dd>
            </dl>
            <p className={cn('mt-2 text-[12.5px]', LEISE)}>Keine IP-Adresse, keine Cookies.</p>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {m.status === 'VERMUTLICH_WUNSCH' && <KiVorschlag meldungId={m.id} gespeichert={gespeichert} begruendung={begruendung} />}
          <section aria-labelledby="entscheiden-titel" className={cn(KARTE, 'p-4 md:p-[18px]')}>
            <h2 id="entscheiden-titel" className="mb-3 font-heading text-[19px] font-semibold text-foreground">
              Entscheiden
            </h2>
            <TriageForm meldungId={m.id} art={m.art} werte={gespeichert} hatHof={m.farm !== null} />
          </section>
        </div>
      </div>
    </div>
  )
}
