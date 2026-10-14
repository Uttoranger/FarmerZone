import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { CheckCheck, Inbox } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { ladeFaedenHof } from '@/server/queries/postfach'
import {
  POSTFACH_ALLES_GELESEN,
  POSTFACH_FEHLER,
  POSTFACH_LEER,
  POSTFACH_TEXT,
  neuText,
  postfachFilterAus,
  postfachFilterHref,
  postfachZeilen,
  zaehleUngelesen,
  type FadenRoh,
} from '@/lib/postfach'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'
import { MARKE } from '@/lib/marke'
import { POSTFACH_RAHMEN, PostfachZeile } from './teile'

export const metadata: Metadata = { title: `${POSTFACH_TEXT.titel} — ${MARKE}` }

export const dynamic = 'force-dynamic'

/*
 * Das Postfach des Hofs (Register N12, Nachtlauf Nr. 87; Mockup
 * mobil-h6-postfach): je Nachricht vom Team ein Faden, neueste zuerst, Filter
 * Alle/Ungelesen. Nur die Fäden dieses Hofs (farmId der Sitzung in der
 * Abfrage). Abweichend vom Mockup ohne Pfeil zurück: Postfach ist ein
 * Hauptpunkt, und Seiten der Leiste und des Mehr-Blatts haben keinen Rückweg
 * (Register N1, elternseite). Ein Ladefehler steht inline statt als 500.
 */
export default async function PostfachPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>
}): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  const filter = postfachFilterAus((await searchParams).filter)
  let faeden: FadenRoh[] | null = null
  try {
    faeden = await ladeFaedenHof(farm.id)
  } catch (err) {
    // Nur Bereich und Hof — nie ein Nachrichtentext.
    Sentry.captureException(err, { tags: { bereich: 'postfach', seite: 'liste' }, extra: { farmId: farm.id } })
  }

  const ungelesen = faeden ? zaehleUngelesen(faeden) : 0
  // Ein Zeitpunkt für die ganze Seite, auf dem Server („vor 3 Std.").
  const zeilen = faeden ? postfachZeilen(faeden, filter, new Date()) : []

  return (
    <div className={cn(POSTFACH_RAHMEN, 'flex flex-col gap-4')}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h1 className="font-heading text-[27px] font-semibold md:text-[30px]">{POSTFACH_TEXT.titel}</h1>
        {ungelesen > 0 && <Marke art="tun">{neuText(ungelesen)}</Marke>}
      </header>

      {faeden === null ? (
        <Hinweiskarte ton="orange">{POSTFACH_FEHLER.laden}</Hinweiskarte>
      ) : faeden.length === 0 ? (
        <EmptyState symbol={Inbox} titel={POSTFACH_LEER.titel} satz={POSTFACH_LEER.satz} />
      ) : (
        <>
          <FilterChipReihe beschriftung={POSTFACH_TEXT.filterBeschriftung}>
            <FilterChip href={postfachFilterHref('alle')} aktiv={filter === 'alle'}>
              {POSTFACH_TEXT.alle}
            </FilterChip>
            <FilterChip href={postfachFilterHref('ungelesen')} aktiv={filter === 'ungelesen'}>
              {POSTFACH_TEXT.ungelesen}
            </FilterChip>
          </FilterChipReihe>
          {zeilen.length === 0 ? (
            <EmptyState
              symbol={CheckCheck}
              titel={POSTFACH_ALLES_GELESEN.titel}
              satz={POSTFACH_ALLES_GELESEN.satz}
              aktion={
                <Link
                  href={postfachFilterHref('alle')}
                  className={cn('inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted', FOKUS_RAHMEN)}
                >
                  {POSTFACH_ALLES_GELESEN.ausweg}
                </Link>
              }
            />
          ) : (
            <ul className="overflow-hidden rounded-2xl border border-border bg-card dark:ring-1 dark:ring-border">
              {zeilen.map((zeile) => (
                <li key={zeile.id} className="border-b border-border last:border-0">
                  <PostfachZeile zeile={zeile} />
                </li>
              ))}
            </ul>
          )}
          {/* Nur mit Fäden: Leer sagt der EmptyState dasselbe (DESIGN_SYSTEM „Leerzustände"). */}
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">{POSTFACH_TEXT.erklaerung}</p>
        </>
      )}
    </div>
  )
}
