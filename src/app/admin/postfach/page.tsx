import type { Metadata } from 'next'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { Plus } from 'lucide-react'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { zaehleZuEntscheiden } from '@/server/queries/meldung'
import { zaehleUngelesenTeam } from '@/server/queries/postfach'
import {
  ADMIN_POSTFACH_REITER,
  ADMIN_POSTFACH_TEXT,
  adminPostfachAdresse,
  adminReiterAus,
  postfachFilterAus,
  type AdminPostfachReiter,
} from '@/lib/postfach'
import { cn } from '@/lib/utils'
import { MARKE } from '@/lib/marke'
import { Zaehler } from '@/components/ui/zaehler'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { ADMIN_RAHMEN, AdminFehler, SEITEN_TITEL } from '@/components/admin/admin-teile'
import { UnterhaltungenReiter, ladeUnterhaltungenReiter, type UnterhaltungenDaten } from './unterhaltungen-reiter'
import { MeldungenReiter, ladeMeldungenReiter, type MeldungenDaten } from './meldungen-reiter'
import { RundschreibenReiter, ladeRundschreibenReiter, type RundschreibenDaten } from './rundschreiben-reiter'

export const metadata: Metadata = { title: `${ADMIN_POSTFACH_TEXT.titel} — Admin — ${MARKE}` }
export const dynamic = 'force-dynamic'

type Suche = {
  reiter?: string | string[]
  faden?: string | string[]
  filter?: string | string[]
  status?: string | string[]
  art?: string | string[]
}

/** Next liefert einen doppelten Parameter als Liste — dann zählt der erste. */
function einzeln(wert: string | string[] | undefined): string | undefined {
  return Array.isArray(wert) ? wert[0] : wert
}

type ReiterDaten =
  | { reiter: 'unterhaltungen'; daten: UnterhaltungenDaten }
  | { reiter: 'meldungen'; daten: MeldungenDaten }
  | { reiter: 'rundschreiben'; daten: RundschreibenDaten }

/** Lädt nur den offenen Reiter; ein Datenbankfehler wirft. */
async function ladeReiter(reiter: AdminPostfachReiter, roh: Suche): Promise<ReiterDaten> {
  if (reiter === 'unterhaltungen') return { reiter, daten: await ladeUnterhaltungenReiter(roh.faden) }
  if (reiter === 'meldungen') return { reiter, daten: await ladeMeldungenReiter({ status: einzeln(roh.status), art: einzeln(roh.art) }) }
  return { reiter, daten: await ladeRundschreibenReiter() }
}

/*
 * /admin/postfach — der eine Ort, an dem beim Admin alles ankommt (Register
 * N12, Nachtlauf Nr. 87; Mockups admin-postfach, admin-rundschreiben): Reiter
 * Unterhaltungen (Antworten der Höfe) · Meldungen (der bisherige Briefkasten,
 * /admin/meldungen leitet um) · Rundschreiben. Der Reiter steht in der
 * Adresse (?reiter=), wie bisher bei den Reitern im Admin. Erste Anweisung
 * ist die Admin-Prüfung; Zähler am Reiter: ungelesene Antworten bzw.
 * Meldungen, die auf das Team warten. Lässt sich der offene Reiter nicht
 * laden, steht AdminFehler da wie auf jeder Admin-Seite — mit EINER h1
 * („Postfach"); im Reiter gäbe der Baustein eine zweite.
 */
export default async function AdminPostfachPage({ searchParams }: { searchParams: Promise<Suche> }): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const roh = await searchParams
  const reiter = adminReiterAus(roh.reiter)
  const jetzt = new Date()

  let zahlen: Record<AdminPostfachReiter, number | undefined> = { unterhaltungen: undefined, meldungen: undefined, rundschreiben: undefined }
  try {
    const [ungelesen, zuEntscheiden] = await Promise.all([zaehleUngelesenTeam(), zaehleZuEntscheiden()])
    zahlen = { unterhaltungen: ungelesen, meldungen: zuEntscheiden, rundschreiben: undefined }
  } catch (err) {
    // Ohne Zahlen geht es weiter — die Reiter laden ihre Inhalte selbst.
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'postfach' } })
  }

  let geladen: ReiterDaten | null = null
  try {
    geladen = await ladeReiter(reiter, roh)
  } catch (err) {
    // Nur Bereich und Reiter — nie ein Nachrichten- oder Meldungstext.
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: `postfach-${reiter}` } })
  }
  if (!geladen) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel={ADMIN_POSTFACH_TEXT.titel} satz={ADMIN_POSTFACH_TEXT.ladeFehler[reiter]} nochmal={adminPostfachAdresse(reiter)} />
      </div>
    )
  }

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-4')}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className={SEITEN_TITEL}>{ADMIN_POSTFACH_TEXT.titel}</h1>
        <p className="text-[13px] text-muted-foreground">{ADMIN_POSTFACH_TEXT.satz}</p>
        <Link
          href={adminPostfachAdresse('rundschreiben')}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-[18px] text-sm font-semibold whitespace-nowrap text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 sm:ml-auto',
            FOKUS_RAHMEN
          )}
        >
          <Plus className="size-4" strokeWidth={2.2} aria-hidden="true" />
          {ADMIN_POSTFACH_TEXT.neuesRundschreiben}
        </Link>
      </header>

      <nav aria-label={ADMIN_POSTFACH_TEXT.reiterBeschriftung} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max items-center gap-6 border-b border-border">
          {ADMIN_POSTFACH_REITER.map((r) => {
            const aktiv = r.id === reiter
            return (
              <li key={r.id}>
                <Link
                  href={adminPostfachAdresse(r.id)}
                  aria-current={aktiv ? 'page' : undefined}
                  className={cn(
                    '-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 px-0.5 text-[14.5px] whitespace-nowrap transition-colors duration-[250ms]',
                    aktiv ? 'border-foreground font-semibold text-foreground' : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
                    FOKUS_RAHMEN,
                    'focus-visible:-outline-offset-2'
                  )}
                >
                  {r.label}
                  <Zaehler anzahl={zahlen[r.id]} wofuer={r.id === 'meldungen' ? ADMIN_POSTFACH_TEXT.zaehlerMeldungen : ADMIN_POSTFACH_TEXT.zaehlerAntworten} />
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {geladen.reiter === 'unterhaltungen' && <UnterhaltungenReiter filter={postfachFilterAus(roh.filter)} daten={geladen.daten} jetzt={jetzt} />}
      {geladen.reiter === 'meldungen' && <MeldungenReiter suche={{ status: einzeln(roh.status), art: einzeln(roh.art) }} daten={geladen.daten} jetzt={jetzt} />}
      {geladen.reiter === 'rundschreiben' && <RundschreibenReiter daten={geladen.daten} jetzt={jetzt} />}
    </div>
  )
}
