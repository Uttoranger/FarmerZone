import Link from 'next/link'
import { Bell, Mail, MessageCircle, Phone } from 'lucide-react'
import type { CustomerDetail } from '@/server/queries/customers'
import { initialen, kundeSeitText, kundenMarke, tageSeit, vorTagenText, weitereBestellungen } from '@/lib/hof-kunden'
import { BESTELL_FILTER_TEXT, bestellListeHref, bestellMarke } from '@/lib/hof-bestellungen'
import { centsAlsEuro, formatEuro, formatZahl } from '@/lib/format'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'
import { whatsAppLink } from '@/lib/whatsapp'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { StatusBadge } from '@/components/ui/status-badge'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { KICKER_12 } from '@/components/mein-hof/kicker-12'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
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
  // Anrufen und WhatsApp gibt es nur für eine Nummer, die sich lesen lässt (Nr. 75, Nr. 81): Aus zwei Nummern in einem Feld
  // oder einem Zusatz wie „ab 18 Uhr“ würde ein Link eine andere Nummer wählen, als dort steht. Die Eingabe steht dann als Text in „Kontakt“.
  const anrufen = telefonLink(telefon)
  const whatsApp = anrufen ? whatsAppLink(telefon) : null
  // Der Hinweis gilt nur, wenn gar keine Nummer dasteht („keine Angabe“) — sonst wäre er falsch neben der Nummer in „Kontakt“.
  const keineNummer = !/\d/.test(telefon)
  const gezeigt = kunde.recentOrders.slice(0, GEZEIGTE_BESTELLUNGEN)
  const rest = weitereBestellungen(kunde.alleBestellungen, gezeigt.length)
  const abo = kunde.isSubscribed ? kunde.subscription : null

  return (
    <>
      {/* Werkzeug-Kopf (G1, Liste Lauf 32 kunden): Rückweg „Kunden“, die h1 ist der Name. */}
      <WerkzeugKopf titel={<span title={kunde.customerName}>{kunde.customerName}</span>} unterzeile={<p className={cn('text-[13px] md:text-sm', LEISE)}>{kundeSeitText(kunde.firstOrderDate)}</p>} />
      <article aria-label={kunde.customerName} className="flex flex-col gap-4">
        {/* Profil frei auf dem Grund, Marke daneben, drei Kontaktknöpfe in einer Zeile (Board s2-/w2-kunden Bild 3). */}
        <header className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3.5">
            <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-zustand-laeuft-grund font-heading text-xl font-semibold text-status-fertig">
              {initialen(kunde.customerName)}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px]">
              {marke && <StatusBadge status={marke.ton}>{marke.text}</StatusBadge>}
              {kunde.isSubscribed && (
                <span className="inline-flex items-center gap-1 text-status-fertig">
                  <Bell className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
                  bekommt Neuigkeiten
                </span>
              )}
            </div>
          </div>

          <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex sm:flex-wrap">
            {anrufen && (
              <a href={anrufen} className={cn(KNOPF_ORANGE, 'px-3', FOKUS_RAHMEN)}>
                <Phone className="size-4" strokeWidth={1.7} aria-hidden="true" />
                Anrufen
              </a>
            )}
            {whatsApp && (
              <a href={whatsApp} target="_blank" rel="noopener noreferrer" className={cn(KNOPF_RAHMEN, 'justify-center px-3 whitespace-nowrap')}>
                <MessageCircle className="size-4" strokeWidth={1.7} aria-hidden="true" />
                WhatsApp
              </a>
            )}
            <a href={`mailto:${kunde.customerEmail}`} className={cn(KNOPF_RAHMEN, 'justify-center px-3 whitespace-nowrap')}>
              <Mail className="size-4" strokeWidth={1.7} aria-hidden="true" />
              E-Mail
            </a>
          </div>
          {keineNummer && <p className={cn('text-[13px]', LEISE)}>Keine Telefonnummer hinterlegt – du erreichst sie per E-Mail.</p>}
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <dl className="grid grid-cols-3 gap-2">
              <Kennzahl wert={formatZahl(kunde.orderCount)} beschriftung={kunde.orderCount === 1 ? 'Bestellung' : 'Bestellungen'} />
              <Kennzahl wert={euro(kunde.umsatzCents)} beschriftung="Umsatz" />
              <Kennzahl wert={vorTagenText(kunde.daysSinceLastOrder)} beschriftung="zuletzt bestellt" />
            </dl>

            <section aria-labelledby="kundin-bestellungen" className="flex flex-col gap-2">
              <h2 id="kundin-bestellungen" className={KICKER_12}>
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
                          <Marke art={status.art}>{status.text}</Marke>
                        </span>
                      }
                    />
                  )
                })}
              </ListGruppe>
              {rest > 0 && (
                // „Noch offen" und „Erledigt" zeigen zusammen alle Bestellungen (einen Filter für alle gibt es
                // seit Nr. 45 nicht mehr) — auch eine überfällige offene ist so auffindbar (Runde 1).
                <p className={cn('text-[13px]', LEISE)}>
                  {rest} weitere {rest === 1 ? 'Bestellung findest' : 'Bestellungen findest'} du unter Bestellungen bei „
                  <Link href={bestellListeHref('offen')} className={cn('rounded font-medium text-foreground underline underline-offset-2', FOKUS_RAHMEN)}>
                    {BESTELL_FILTER_TEXT.offen}
                  </Link>
                  “ und „
                  <Link href={bestellListeHref('erledigt')} className={cn('rounded font-medium text-foreground underline underline-offset-2', FOKUS_RAHMEN)}>
                    {BESTELL_FILTER_TEXT.erledigt}
                  </Link>
                  “.
                </p>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <section aria-labelledby="kundin-kontakt" className={cn(KARTE, 'flex flex-col gap-1 p-4 md:px-[18px]')}>
              <h2 id="kundin-kontakt" className={KICKER_12}>
                Kontakt
              </h2>
              {/* Beschriftung links, Wert rechts unterstrichen (Board w2-kunden Bild 3). */}
              <dl className="flex flex-col text-[14px]">
                {telefon !== '' && (
                  <div className="flex min-h-11 items-center justify-between gap-3">
                    <dt className={LEISE}>Telefon</dt>
                    <dd className="min-w-0 text-right">
                      {anrufen ? (
                        <a href={anrufen} className={cn('rounded-sm font-medium text-foreground underline underline-offset-2', FOKUS_RAHMEN)}>
                          {formatiereTelefon(telefon)}
                        </a>
                      ) : (
                        <span className="[overflow-wrap:anywhere]">{formatiereTelefon(telefon)}</span>
                      )}
                    </dd>
                  </div>
                )}
                <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border first:border-t-0">
                  <dt className={LEISE}>E-Mail</dt>
                  <dd className="min-w-0 text-right">
                    <a href={`mailto:${kunde.customerEmail}`} className={cn('rounded-sm font-medium break-all text-foreground underline underline-offset-2', FOKUS_RAHMEN)}>
                      {kunde.customerEmail}
                    </a>
                  </dd>
                </div>
              </dl>
            </section>

            {kunde.topProducts.length > 0 && (
              <section aria-labelledby="kundin-lieblinge" className={cn(KARTE, 'flex flex-col gap-2 p-4 md:px-[18px]')}>
                <h2 id="kundin-lieblinge" className={KICKER_12}>
                  Lieblingsprodukte
                </h2>
                {/* Name links, Menge rechts („9×“, Board w2-kunden Bild 3). */}
                <ol className="flex flex-col">
                  {kunde.topProducts.map((p) => (
                    <li key={p.name} className="flex min-h-10 items-center gap-3 border-t border-border text-[14px] first:border-t-0">
                      <span className="min-w-0 flex-1 truncate" title={p.name}>
                        {p.name}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{formatZahl(p.count)}×</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {abo && (
              <section aria-labelledby="kundin-neuigkeiten" className={cn(KARTE, 'flex flex-col gap-2 p-4 md:px-[18px]')}>
                <h2 id="kundin-neuigkeiten" className={KICKER_12}>
                  Neuigkeiten von dir
                </h2>
                <dl className="flex flex-col text-[14px]">
                  <Einwilligung symbol={Mail} name="E-Mail-Neuigkeiten" an={abo.optInEmail} />
                  <Einwilligung symbol={MessageCircle} name="WhatsApp-Neuigkeiten" an={abo.optInWhatsApp} />
                </dl>
              </section>
            )}
          </div>
        </div>
      </article>
    </>
  )
}

/** Beschriftung oben links, Wert darunter (Liste Lauf 32 kunden: „Kennzahl-Kacheln zentriert“). */
function Kennzahl({ wert, beschriftung }: { wert: string; beschriftung: string }): React.JSX.Element {
  return (
    <div className={cn(KARTE, 'flex min-w-0 flex-col gap-0.5 px-3 py-3 text-left')}>
      <dt className={cn('text-[12px]', LEISE)}>{beschriftung}</dt>
      <dd className="font-heading text-lg leading-tight font-semibold break-words tabular-nums md:text-xl">{wert}</dd>
    </div>
  )
}

/** Eine Zeile „Neuigkeiten von dir“: Kanal links, Zustand rechts (Board w2-kunden Bild 3). */
function Einwilligung({ symbol: Symbol, name, an }: { symbol: typeof Mail; name: string; an: boolean }): React.JSX.Element {
  return (
    <div className="flex min-h-10 items-center gap-2 border-t border-border first:border-t-0">
      <Symbol className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
      <dt className="flex-1">{name}</dt>
      <dd className={an ? 'font-semibold text-status-fertig' : LEISE}>{an ? 'an' : 'aus'}</dd>
    </div>
  )
}
