import type { Metadata } from 'next'
import Link from 'next/link'
import { CircleCheck, Unlink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ABO_TEXT } from '@/lib/abo-bestaetigung'
import { aboTokenSchema } from '@/schemas/abo'
import { ladeAboBestaetigung } from '@/server/abo-anmeldung'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
import { KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/bestaetigung/bestaetigung-teile'
import { AboBestaetigenKarte } from '@/components/abo-bestaetigung/bestaetigen-karte'

export const metadata: Metadata = {
  title: 'Anmeldung bestätigen — FarmerZone',
  // Der Link trägt einen gültigen Token (next.config.ts setzt dazu no-referrer).
  robots: { index: false, follow: false },
}

// Liest den Stand des Abos bei jedem Aufruf — nie zwischenspeichern.
export const dynamic = 'force-dynamic'

const TITEL = 'font-heading text-[22px] leading-tight font-semibold md:text-2xl'
const SATZ = 'mt-1 text-[14px] leading-normal break-words text-muted-foreground [overflow-wrap:anywhere]'

/**
 * „Anmeldung bestätigen" — Double-Opt-in für Neuigkeiten eines Hofes
 * (Register S11, Nachtlauf Nr. 38). Kein Mockup — gebaut nach DESIGN_SYSTEM.md
 * in der Fokus-Shell wie /verify. Der Aufruf (GET) liest nur; bestätigt wird
 * mit dem Knopf (Server Action, POST), weil Link-Scanner der Mailprogramme
 * Links ungefragt öffnen. Fälle: offen (Knopf), schon bestätigt, abgelaufen,
 * ungültig, Abo gelöscht — die letzten drei mit Ausweg.
 */
export default async function NeuigkeitenBestaetigenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const { token: roh } = await searchParams
  const token = aboTokenSchema.safeParse(roh)
  const stand = token.success ? await ladeAboBestaetigung(token.data, new Date()) : ({ zustand: 'ungueltig' } as const)

  let inhalt: React.ReactNode
  if (stand.zustand === 'offen' && token.success) {
    inhalt = <AboBestaetigenKarte token={token.data} hofName={stand.hofName} hofSlug={stand.hofSlug} />
  } else if (stand.zustand === 'bestaetigt') {
    inhalt = (
      <section aria-labelledby="abo-titel" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <CircleCheck className="mt-1 size-6 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="abo-titel" className={TITEL}>
              Du bist schon angemeldet
            </h2>
            <p className={SATZ}>
              Du bekommst Neuigkeiten von <strong className="font-semibold text-foreground">{stand.hofName}</strong> per E-Mail. Hier ist
              nichts mehr zu tun.
            </p>
          </div>
        </div>
        <Link href={`/${stand.hofSlug}`} className={cn(KNOPF_GRUEN, 'h-12 w-full')}>
          Zum Hof
        </Link>
      </section>
    )
  } else {
    const satz =
      stand.zustand === 'abgelaufen'
        ? `${ABO_TEXT.abgelaufen} ${ABO_TEXT.ausweg}`
        : stand.zustand === 'abo_weg'
          ? ABO_TEXT.abo_weg
          : `${ABO_TEXT.ungueltig} ${ABO_TEXT.ausweg}`
    inhalt = (
      <section aria-labelledby="abo-titel" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <Unlink className="mt-1 size-6 shrink-0 text-status-offen" strokeWidth={1.7} aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="abo-titel" className={TITEL}>
              {stand.zustand === 'abgelaufen' ? 'Der Link ist abgelaufen' : 'Das hat nicht geklappt'}
            </h2>
            <p className={SATZ}>{satz}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/account/profile" className={cn(KNOPF_GRUEN, 'h-12 w-full')}>
            Zu „Mein Konto“
          </Link>
          <Link href="/hoefe" className={cn(KNOPF_RAHMEN, 'h-12 w-full')}>
            Höfe entdecken
          </Link>
        </div>
      </section>
    )
  }

  return (
    <KundeFokusShell titel="Anmeldung bestätigen" zurueck={{ href: '/', label: 'Zur Startseite' }}>
      <div className="mx-auto w-full max-w-[520px] px-4 pt-6 pb-12 md:pt-10">
        <div className="rounded-2xl border border-border bg-card p-5 md:p-6">{inhalt}</div>
      </div>
    </KundeFokusShell>
  )
}
