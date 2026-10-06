import Link from 'next/link'
import { Bell, ChevronLeft, Mail, MessageCircle, Phone } from 'lucide-react'
import type { CustomerDetail } from '@/server/queries/customers'
import { initialen, kundeSeitText, kundenMarke, tageSeit, vorTagenText, weitereBestellungen } from '@/lib/hof-kunden'
import { bestellMarke } from '@/lib/hof-bestellungen'
import { centsAlsEuro, formatEuro, formatZahl } from '@/lib/format'
import { toWaPhone } from '@/lib/whatsapp'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KICKER, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'

/*
 * Eine Kundin des Hofs (/customers/[kundeId], Gate 8 „Code ohne Mockup",
 * Nachtlauf Nr. 22a) — gebaut nach docs/ai/DESIGN_SYSTEM.md, Abschnitt
 * „Kunden". Serverseitig gerendert: Die Seite reicht `jetzt` herein, „vor N
 * Tagen" entsteht hier und nirgends im Browser.
 *
 * Ab 1280 px zwei Spalten (links Kennzahlen und Bestellungen, rechts Kontakt,
 * Lieblingsprodukte, Neuigkeiten), darunter eine Spalte.
 */

/** So viele der geladenen Bestellungen stehen in der Liste; der Rest unter /orders. */
const GEZEIGTE_BESTELLUNGEN = 5

const euro = (cents: number) => formatEuro(centsAlsEuro(cents))

/** Der eine Hauptknopf der Seite: Hof-Aktion = Orange (Farbrollen). */
const KNOPF_ORANGE =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-primary-foreground/25 bg-primary px-[18px] text-sm font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90'

export function KundenDetail({ kunde, jetzt }: { kunde: CustomerDetail; jetzt: Date }): React.JSX.Element {
  const marke = kundenMarke(kunde.status)
  const telefon = kunde.customerPhone.trim()
  const gezeigt = kunde.recentOrders.slice(0, GEZEIGTE_BESTELLUNGEN)
  const rest = weitereBestellungen(kunde.orderCount, gezeigt.length)
  const abo = kunde.isSubscribed ? kunde.subscription : null

  return (
    <article aria-labelledby="kundin-name" className="flex flex-col gap-4">
      <Link
        href="/customers"
        className={cn('-ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-3 pl-1.5 text-sm font-medium text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)}
      >
        <ChevronLeft className="size-5" strokeWidth={1.7} aria-hidden="true" />
        Alle Kunden
      </Link>

      <header className={cn(KARTE, 'flex flex-col gap-4 p-4 md:px-[18px]')}>
        <div className="flex items-start gap-3.5">
          <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-muted font-heading text-xl font-semibold text-foreground">
            {initialen(kunde.customerName)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 id="kundin-name" title={kunde.customerName} className="line-clamp-2 font-heading text-[22px] leading-tight font-semibold break-words md:text-[26px]">
              {kunde.customerName}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
              {marke && <StatusBadge status={marke.ton}>{marke.text}</StatusBadge>}
              <span className={LEISE}>{kundeSeitText(kunde.firstOrderDate)}</span>
              {kunde.isSubscribed && (
                <span className="inline-flex items-center gap-1 text-status-fertig">
                  <Bell className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
                  bekommt Neuigkeiten
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {telefon && (
            <>
              <a href={`tel:${telefon}`} className={cn(KNOPF_ORANGE, FOKUS_RAHMEN)}>
                <Phone className="size-4" strokeWidth={1.7} aria-hidden="true" />
                Anrufen
              </a>
              <a href={`https://wa.me/${toWaPhone(telefon)}`} target="_blank" rel="noopener noreferrer" className={KNOPF_RAHMEN}>
                <MessageCircle className="size-4" strokeWidth={1.7} aria-hidden="true" />
                WhatsApp
              </a>
            </>
          )}
          <a href={`mailto:${kunde.customerEmail}`} className={KNOPF_RAHMEN}>
            <Mail className="size-4" strokeWidth={1.7} aria-hidden="true" />
            E-Mail
          </a>
        </div>
        {!telefon && <p className={cn('text-[13px]', LEISE)}>Keine Telefonnummer hinterlegt – du erreichst sie per E-Mail.</p>}
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <dl className="grid grid-cols-3 gap-2">
            <Kennzahl wert={formatZahl(kunde.orderCount)} beschriftung={kunde.orderCount === 1 ? 'Bestellung' : 'Bestellungen'} />
            <Kennzahl wert={euro(kunde.umsatzCents)} beschriftung="Umsatz" />
            <Kennzahl wert={vorTagenText(kunde.daysSinceLastOrder)} beschriftung="zuletzt bestellt" />
          </dl>

          <section aria-labelledby="kundin-bestellungen" className="flex flex-col gap-2">
            <h2 id="kundin-bestellungen" className={KICKER}>
              Letzte Bestellungen
            </h2>
            <ListGruppe>
              {gezeigt.map((o) => {
                const status = bestellMarke(o.status)
                const positionen = o.items.slice(0, 3).map((p) => `${formatZahl(p.quantity)}× ${p.productName}`)
                const mehr = o.items.length - positionen.length
                return (
                  <ListRow
                    key={o.id}
                    href={`/orders/${o.id}`}
                    titel={o.orderNumber}
                    untertitel={[vorTagenText(tageSeit(o.createdAt, jetzt)), positionen.join(', ') + (mehr > 0 ? ` +${mehr}` : '')].filter(Boolean).join(' · ')}
                    ende={
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[14px] font-semibold tabular-nums">{euro(o.betragCents)}</span>
                        <StatusBadge status={status.ton}>{status.text}</StatusBadge>
                      </span>
                    }
                  />
                )
              })}
            </ListGruppe>
            {rest > 0 && (
              <p className={cn('text-[13px]', LEISE)}>
                {rest} weitere {rest === 1 ? 'Bestellung findest' : 'Bestellungen findest'} du unter{' '}
                <Link href="/orders?filter=alle" className={cn('rounded font-medium text-foreground underline underline-offset-2', FOKUS_RAHMEN)}>
                  Bestellungen
                </Link>
                .
              </p>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <section aria-labelledby="kundin-kontakt" className={cn(KARTE, 'flex flex-col gap-1 p-4 md:px-[18px]')}>
            <h2 id="kundin-kontakt" className={KICKER}>
              Kontakt
            </h2>
            {telefon && (
              <a href={`tel:${telefon}`} className={cn('inline-flex min-h-11 w-fit items-center gap-2 rounded-md text-[14px] font-medium text-status-fertig hover:underline', FOKUS_RAHMEN)}>
                <Phone className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                {telefon}
              </a>
            )}
            <a href={`mailto:${kunde.customerEmail}`} className={cn('inline-flex min-h-11 min-w-0 items-center gap-2 rounded-md text-[14px] font-medium break-all text-status-fertig hover:underline', FOKUS_RAHMEN)}>
              <Mail className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
              {kunde.customerEmail}
            </a>
          </section>

          {kunde.topProducts.length > 0 && (
            <section aria-labelledby="kundin-lieblinge" className={cn(KARTE, 'flex flex-col gap-2 p-4 md:px-[18px]')}>
              <h2 id="kundin-lieblinge" className={KICKER}>
                Lieblingsprodukte
              </h2>
              <ol className="flex flex-col gap-2">
                {kunde.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3 text-[14px]">
                    <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={p.name}>
                      {p.name}
                    </span>
                    <span className={cn('shrink-0 text-[12.5px]', LEISE)}>{formatZahl(p.count)}× bestellt</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {abo && (
            <section aria-labelledby="kundin-neuigkeiten" className={cn(KARTE, 'flex flex-col gap-2 p-4 md:px-[18px]')}>
              <h2 id="kundin-neuigkeiten" className={KICKER}>
                Neuigkeiten von dir
              </h2>
              <dl className="flex flex-col gap-1.5 text-[14px]">
                <Einwilligung symbol={Mail} name="E-Mail-Neuigkeiten" an={abo.optInEmail} />
                <Einwilligung symbol={MessageCircle} name="WhatsApp-Neuigkeiten" an={abo.optInWhatsApp} />
              </dl>
            </section>
          )}
        </div>
      </div>
    </article>
  )
}

function Kennzahl({ wert, beschriftung }: { wert: string; beschriftung: string }): React.JSX.Element {
  return (
    <div className={cn(KARTE, 'flex min-w-0 flex-col-reverse items-center gap-0.5 px-2 py-3 text-center')}>
      <dt className={cn('text-[12px]', LEISE)}>{beschriftung}</dt>
      <dd className="font-heading text-lg leading-tight font-semibold break-words tabular-nums md:text-xl">{wert}</dd>
    </div>
  )
}

function Einwilligung({ symbol: Symbol, name, an }: { symbol: typeof Mail; name: string; an: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Symbol className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
      <dt>{name}:</dt>
      <dd className={an ? 'font-semibold text-status-fertig' : LEISE}>{an ? 'an' : 'aus'}</dd>
    </div>
  )
}
