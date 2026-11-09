import Link from 'next/link'
import { Phone } from 'lucide-react'
import type { CustomerDetail, CustomerOrderSummary } from '@/server/queries/customers'
import { initialen, kundeSeitText, kundenMarke, vorTagenText, weitereBestellungen } from '@/lib/hof-kunden'
import { BESTELL_FILTER_TEXT, bestellListeHref, bestellMarke, fensterZeit } from '@/lib/hof-bestellungen'
import { abholTagMitDatum } from '@/lib/heute'
import { wienKalendertag } from '@/lib/kalender'
import { centsAlsEuro, formatEuro, formatZahl } from '@/lib/format'
import { formatiereTelefon, telefonLink } from '@/lib/telefon-anzeige'
import { whatsAppLink } from '@/lib/whatsapp'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { Marke } from '@/components/ui/marke'
import { WERKZEUG_KOPF_TITEL } from '@/components/ui/werkzeug-kopf-stil'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { KICKER_12 } from '@/components/mein-hof/kicker-12'
import { textlinkKlassen } from '@/components/ui/textlink'
import { KundenMarke } from './kunden-marke'
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

/** Titel der Karten Kontakt, Lieblingsprodukte, Neuigkeiten: Serif statt Versal-Kicker (Liste Lauf 32 kunden). */
const KARTEN_TITEL = 'font-heading text-lg font-semibold text-foreground'

/** Eine Zeile „Beschriftung links, Wert rechts“ mit Trennlinie; 44 px, damit der Link darin ein volles Ziel hat. */
const ZEILE = 'flex min-h-11 items-center justify-between gap-3 border-t border-border py-0.5 first:border-t-0'

/** Telefon und E-Mail als grüner, unterstrichener Link, selbst 44 px hoch (Messung Lauf 32: vorher 18 px). */
const KONTAKT_LINK = cn(textlinkKlassen({ form: 'zeile' }), 'justify-end text-right underline')

/** Der Titel in der Leiste am Handy — dieselbe Schrift wie die h1 des Werkzeug-Kopfs, aber kein Überschriften-Element. */
const WERKZEUG_TITEL_HANDY = WERKZEUG_KOPF_TITEL

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
      {/* Werkzeug-Kopf (G1) nach Board s2-/w2-kunden Bild 3 (Nr. 273): am Handy steht in der Leiste „Kundin“ mit
          „Kunden“ darunter, im Web nur der Rückweg „‹ Kunden“. Die eine h1 ist der Name im Profil — die h1 des
          Kopfs bleibt deshalb hier aus (`[&_h1]:hidden`, display:none, also auch nicht im Screenreader). */}
      <div className="contents [&_[data-werkzeug-kopf]_h1]:hidden">
        <WerkzeugKopf
          titel="Kundin"
          unterzeile={
            <span className="flex flex-col md:hidden">
              <span className={WERKZEUG_TITEL_HANDY}>Kundin</span>
              <span className={cn('text-[13px]', LEISE)}>Kunden</span>
            </span>
          }
        />
      </div>
      <article aria-labelledby="kundin-name" className="flex flex-col gap-4">
        {/* Profil frei auf dem Grund: Avatar, daneben Name (h1, Serif) mit Marke und „Kunde seit …“ (Board s2-/w2-kunden Bild 3). */}
        <header className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-zustand-laeuft-grund text-lg font-bold text-status-fertig">
              {initialen(kunde.customerName)}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h1 id="kundin-name" title={kunde.customerName} className="min-w-0 font-heading text-2xl leading-tight font-semibold break-words text-foreground md:text-[28px]">
                  {kunde.customerName}
                </h1>
                {marke && <KundenMarke ton={marke.ton}>{marke.text}</KundenMarke>}
              </div>
              <p className={cn('text-sm', LEISE)}>{kundeSeitText(kunde.firstOrderDate)}</p>
            </div>
          </div>

          {/* Drei Kontaktknöpfe in einer Zeile; nur „Anrufen“ trägt sein Symbol, WhatsApp und E-Mail nicht (Board). */}
          <div className="grid auto-cols-fr grid-flow-col gap-2 sm:flex sm:flex-wrap">
            {anrufen && (
              <a href={anrufen} className={cn(KNOPF_ORANGE, 'px-3', FOKUS_RAHMEN)}>
                <Phone className="size-4" strokeWidth={1.7} aria-hidden="true" />
                Anrufen
              </a>
            )}
            {whatsApp && (
              <a href={whatsApp} target="_blank" rel="noopener noreferrer" className={cn(KNOPF_RAHMEN, 'justify-center px-3 whitespace-nowrap')}>
                WhatsApp
              </a>
            )}
            <a href={`mailto:${kunde.customerEmail}`} className={cn(KNOPF_RAHMEN, 'justify-center px-3 whitespace-nowrap')}>
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
                  return (
                    <ListRow
                      key={o.id}
                      href={`/orders/${o.id}`}
                      gross
                      // Fett der Abholtermin, darunter Nummer und Positionen (Liste Lauf 32 kunden „Bestellzeilen ohne Abholtermin“).
                      titel={abholTermin(o, jetzt)}
                      untertitel={bestellZeile(o)}
                      ende={
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[15px] font-semibold tabular-nums">{euro(o.betragCents)}</span>
                          <Marke art={status.art} form="schild">
                            {status.text}
                          </Marke>
                        </span>
                      }
                    />
                  )
                })}
              </ListGruppe>
              {rest > 0 && (
                // „Noch offen" und „Erledigt" zeigen zusammen alle Bestellungen (einen Filter für alle gibt es
                // seit Nr. 45 nicht mehr) — auch eine überfällige offene ist so auffindbar (Runde 1).
                <p className={cn('text-sm', LEISE)}>
                  {rest} weitere {rest === 1 ? 'Bestellung findest' : 'Bestellungen findest'} du unter Bestellungen bei „
                  <Link href={bestellListeHref('offen')} className={textlinkKlassen({ form: 'im-satz' })}>
                    {BESTELL_FILTER_TEXT.offen}
                  </Link>
                  “ und „
                  <Link href={bestellListeHref('erledigt')} className={textlinkKlassen({ form: 'im-satz' })}>
                    {BESTELL_FILTER_TEXT.erledigt}
                  </Link>
                  “.
                </p>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <section aria-labelledby="kundin-kontakt" className={cn(KARTE, 'flex flex-col gap-0.5 p-[14px] md:px-[18px]')}>
              <h2 id="kundin-kontakt" className={KARTEN_TITEL}>
                Kontakt
              </h2>
              {/* Beschriftung links, Wert rechts als grüner, unterstrichener Link mit 44 px Ziel, ohne Symbol (Board s2-/w2-kunden Bild 3). */}
              <dl className="flex flex-col text-[15px]">
                {telefon !== '' && (
                  <div className={ZEILE}>
                    <dt>Telefon</dt>
                    <dd className="min-w-0 text-right">
                      {anrufen ? (
                        <a href={anrufen} className={KONTAKT_LINK}>
                          {formatiereTelefon(telefon)}
                        </a>
                      ) : (
                        <span className="[overflow-wrap:anywhere]">{formatiereTelefon(telefon)}</span>
                      )}
                    </dd>
                  </div>
                )}
                <div className={ZEILE}>
                  <dt>E-Mail</dt>
                  <dd className="min-w-0 text-right">
                    <a href={`mailto:${kunde.customerEmail}`} className={cn(KONTAKT_LINK, 'break-all')}>
                      {kunde.customerEmail}
                    </a>
                  </dd>
                </div>
              </dl>
            </section>

            {kunde.topProducts.length > 0 && (
              <section aria-labelledby="kundin-lieblinge" className={cn(KARTE, 'flex flex-col gap-0.5 p-[14px] md:px-[18px]')}>
                <h2 id="kundin-lieblinge" className={KARTEN_TITEL}>
                  Lieblingsprodukte
                </h2>
                {/* Name links, Menge rechts („9×“, Board w2-kunden Bild 3). */}
                <ol className="flex flex-col text-[15px]">
                  {kunde.topProducts.map((p) => (
                    <li key={p.name} className={ZEILE}>
                      <span className="min-w-0 flex-1 truncate" title={p.name}>
                        {p.name}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatZahl(p.count)}×</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {abo && (
              <section aria-labelledby="kundin-neuigkeiten" className={cn(KARTE, 'flex flex-col gap-0.5 p-[14px] md:px-[18px]')}>
                <h2 id="kundin-neuigkeiten" className={KARTEN_TITEL}>
                  Neuigkeiten von dir
                </h2>
                <dl className="flex flex-col text-[15px]">
                  <Einwilligung name="E-Mail-Neuigkeiten" an={abo.optInEmail} />
                  <Einwilligung name="WhatsApp-Neuigkeiten" an={abo.optInWhatsApp} />
                </dl>
              </section>
            )}
          </div>
        </div>
      </article>
    </>
  )
}

/** Beschriftung oben links (13 px fett, leise), Wert darunter (Board s2-/w2-kunden Bild 3). */
function Kennzahl({ wert, beschriftung }: { wert: string; beschriftung: string }): React.JSX.Element {
  return (
    <div className={cn(KARTE, 'flex min-h-16 min-w-0 flex-col gap-0.5 px-3 py-2.5 text-left')}>
      <dt className={cn('text-[13px] font-semibold', LEISE)}>{beschriftung}</dt>
      <dd className="font-heading text-lg leading-tight font-semibold break-words tabular-nums md:text-xl">{wert}</dd>
    </div>
  )
}

/** Eine Zeile „Neuigkeiten von dir“: Kanal links, Zustand rechts, ohne Symbol (Board w2-kunden Bild 3). */
function Einwilligung({ name, an }: { name: string; an: boolean }): React.JSX.Element {
  return (
    <div className={ZEILE}>
      <dt className="flex-1">{name}</dt>
      <dd className={an ? 'font-semibold text-status-fertig' : LEISE}>{an ? 'an' : 'aus'}</dd>
    </div>
  )
}

/** „Heute, Mi 3. März, 15–18 Uhr“ — Abholtag mit Datum (Wiener Tag) und Fenster, dieselben Hilfen wie Bestellungen. */
function abholTermin(o: CustomerOrderSummary, jetzt: Date): string {
  const tag = abholTagMitDatum(wienKalendertag(jetzt), wienKalendertag(new Date(o.pickupDate)))
  return `${tag}, ${fensterZeit(o.pickupTimeStart, o.pickupTimeEnd)}`
}

/** „HM-0303-4A7B · 4× Heumilch · 1× Eier“ — Nummer und höchstens drei Positionen, der Rest als „+n“. */
function bestellZeile(o: CustomerOrderSummary): string {
  const positionen = o.items.slice(0, 3).map((p) => `${formatZahl(p.quantity)}× ${p.productName}`)
  const mehr = o.items.length - positionen.length
  return [o.orderNumber, ...positionen].join(' · ') + (mehr > 0 ? ` +${mehr}` : '')
}
