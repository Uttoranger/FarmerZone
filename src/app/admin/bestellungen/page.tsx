import type { Metadata } from 'next'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { ArrowLeft, ExternalLink, PackageSearch } from 'lucide-react'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ladeBestellDetail, ladeBestellListe, type BestellDetail, type BestellZeile } from '@/server/queries/admin-bestellungen'
import { ladeHofAuswahl } from '@/server/queries/mails'
import {
  ADMIN_BESTELLUNG_TEXT as T,
  BESTELL_FAELLE,
  BESTELL_ZEITRAUM_NAME,
  STAND_NAME,
  ausserhalbErstattetMoeglich,
  bestellFall,
  bestellVerlauf,
  bestellungenHref,
  hofAkteHref,
  notfallStornoStand,
  zeitpunktText,
} from '@/lib/admin-bestellung'
import { MAIL_TEXT, maskiereAdresse, suchErgebnis, alleMailsHref } from '@/lib/betrieb-mails'
import { bestellMarke, zahlartText } from '@/lib/hof-bestellungen'
import { stripeZahlungAdresse, eingangAdresse } from '@/lib/postfach'
import { bestellSummen, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro, formatPosition, formatTagKurz } from '@/lib/format'
import { alsCents } from '@/lib/order-totals'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { MARKE } from '@/lib/marke'
import { cn } from '@/lib/utils'
import { BESTELL_STAENDE, BESTELL_ZEITRAEUME, bestellFilterAus, gewaehlteBestellungAus, type BestellFilter, type BestellungenParameter } from '@/schemas/admin-bestellung'
import { mailSucheAus, type MailSuche } from '@/schemas/betrieb-mails'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { EmptyState } from '@/components/ui/empty-state'
import { Marke } from '@/components/ui/marke'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { LadeInhalt, LadePunkt, LadeRahmen } from '@/components/ui/lade-punkt'
import { FELD, FELD_LABEL, KARTE, KICKER, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { BestellungAktionen } from './bestellung-aktionen'
import { AuskunftKundin } from '@/components/admin/auskunft-kundin'

export const metadata: Metadata = { title: `${T.titel} — Admin — ${MARKE}` }

const SPALTE = cn(KARTE, 'min-w-0 flex-col overflow-hidden dark:ring-1 dark:ring-border')
const euro = (cents: number): string => formatEuro(centsAlsEuro(cents))

// ─── Suche und Filter ────────────────────────────────────────────────────────

function Auswahl({ id, name, label, wert, optionen }: { id: string; name: string; label: string; wert: string; optionen: ReadonlyArray<{ wert: string; name: string }> }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className={FELD_LABEL}>
        {label}
      </label>
      <select id={id} name={name} defaultValue={wert} className={cn(FELD, 'min-h-11 pr-8')}>
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Suche und Filter in EINEM Formular (GET, ohne Skript) — dasselbe Suchfeld wie Admin › Betrieb › E-Mails. */
function SuchUndFilter({ sucheRoh, f, hoefe }: { sucheRoh: string; f: BestellFilter; hoefe: ReadonlyArray<{ id: string; name: string }> }): React.JSX.Element {
  const alle = { wert: '', name: T.alle }
  return (
    <form role="search" method="get" action={bestellungenHref({})} className={cn(KARTE, 'flex flex-col gap-3 p-3.5 md:p-4')}>
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor="bestellung-suche" className={FELD_LABEL}>
          {MAIL_TEXT.sucheLabel}
        </label>
        <div className="flex gap-2">
          <input id="bestellung-suche" name="suche" type="search" defaultValue={sucheRoh} autoComplete="off" spellCheck={false} className={cn(FELD, 'min-h-11')} />
          <button type="submit" className={cn(KNOPF_RAHMEN, 'font-semibold')}>
            {MAIL_TEXT.sucheKnopf}
          </button>
        </div>
      </div>
      <div role="group" aria-label={T.filter} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Auswahl id="bestellung-stand" name="stand" label={T.filterStand} wert={f.stand ?? ''} optionen={[alle, ...BESTELL_STAENDE.map((s) => ({ wert: s, name: STAND_NAME[s] }))]} />
        <Auswahl id="bestellung-hof" name="hof" label={T.filterHof} wert={f.hof ?? ''} optionen={[alle, ...hoefe.map((h) => ({ wert: h.id, name: h.name }))]} />
        <Auswahl id="bestellung-zeitraum" name="zeitraum" label={T.filterZeitraum} wert={f.zeitraum} optionen={BESTELL_ZEITRAEUME.map((z) => ({ wert: z, name: BESTELL_ZEITRAUM_NAME[z] }))} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="inline-flex min-h-11 items-center gap-2 text-[13.5px] text-foreground">
          <input type="checkbox" name="offen" value="1" defaultChecked={f.erstattungOffen} className="size-5 accent-primary" />
          {T.filterOffen}
        </label>
        <button type="submit" className={cn(KNOPF_RAHMEN, 'font-semibold')}>
          {T.filterAnwenden}
        </button>
        <Link href={bestellungenHref({})} className={cn(KNOPF_RAHMEN, 'border-transparent text-[13px]')}>
          {T.filterZuruecksetzen}
        </Link>
      </div>
    </form>
  )
}

// ─── Liste ───────────────────────────────────────────────────────────────────

function Zeile({ z, href, aktiv }: { z: BestellZeile; href: string; aktiv: boolean }): React.JSX.Element {
  const marke = z.erstattungOffenSeit ? { text: BESTELL_FAELLE.erstattung_offen.titel, art: 'tun' as const } : bestellMarke(z.status)
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={aktiv ? 'true' : undefined}
      className={cn(
        'relative flex min-h-11 items-start gap-2.5 border-l-[3px] py-3 pr-3.5 pl-[11px] transition-colors duration-[250ms]',
        aktiv ? 'border-l-brand-text bg-muted' : 'border-l-transparent hover:bg-muted',
        FOKUS_RAHMEN_INNEN
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-foreground tabular-nums">{z.orderNumber}</span>
          <Marke art={marke.art} className="shrink-0">
            {marke.text}
          </Marke>
        </span>
        <span className={cn('truncate text-[12.5px]', LEISE)} title={z.hofName}>
          {`${z.hofName} · bestellt ${formatTagKurz(kalendertagInWien(z.createdAt))}`}
        </span>
      </span>
      <LadePunkt className="top-3 right-1.5" />
    </Link>
  )
}

function trefferKopf(suche: MailSuche): string {
  if (suche.art === 'adresse') return T.trefferZu(maskiereAdresse(suche.adresse))
  if (suche.art === 'bestellung') return T.trefferZu(suche.nummer)
  return T.neuesteZuerst
}

// ─── Detail ──────────────────────────────────────────────────────────────────

function Feld({ titel, children }: { titel: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <dt className={cn('text-[12.5px]', LEISE)}>{titel}</dt>
      <dd className="min-w-0 text-[14px] break-words text-foreground">{children}</dd>
    </>
  )
}

function Detail({ d, jetzt }: { d: BestellDetail; jetzt: Date }): React.JSX.Element {
  const fall = bestellFall(d)
  const faelle = BESTELL_FAELLE[fall]
  const summen = bestellSummen(d)
  const stripe = stripeZahlungAdresse(d.stripePaymentIntentId, UMGEBUNG.stripe)
  const verlauf = bestellVerlauf(d, d.protokoll)
  const marke = bestellMarke(d.status)
  const ergebnis = suchErgebnis(
    {
      bestellungen: [
        { id: d.id, orderNumber: d.orderNumber, hofName: d.hofName, pickupDate: d.pickupDate, paymentMethod: d.paymentMethod, paymentStatus: d.paymentStatus, status: d.status, customerEmail: d.kundinGekuerzt },
      ],
      mails: d.mails,
      adresse: null,
    },
    jetzt
  )
  const mailZeilen = ergebnis.art === 'treffer' ? (ergebnis.gruppen[0]?.zeilen ?? []) : []
  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <h2 className="font-heading text-[19px] leading-snug font-semibold break-words text-foreground tabular-nums">{d.orderNumber}</h2>
        <Marke art={marke.art}>{marke.text}</Marke>
        {fall === 'erstattung_offen' && <Marke art="tun">{faelle.titel}</Marke>}
        {stripe && (
          <a href={stripe} target="_blank" rel="noopener noreferrer" className={cn(KNOPF_RAHMEN, 'ml-auto')}>
            {T.inStripe}
            <ExternalLink className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </a>
        )}
      </div>

      <dl className="grid grid-cols-[minmax(84px,auto)_minmax(0,1fr)] gap-x-4 gap-y-2">
        <Feld titel={T.hof}>
          {d.hofName} ·{' '}
          <Link href={hofAkteHref(d.farmId)} className="font-semibold text-brand-text underline-offset-2 hover:underline">
            {T.akte}
          </Link>
        </Feld>
        <Feld titel={T.kundin}>{`${d.kundinGekuerzt} · ${T.kundinBestellungen(d.kundinBestellungen90)}`}</Feld>
        <Feld titel={T.abholung}>{`${formatTagKurz(kalendertagInWien(d.pickupDate))}, ${d.pickupTimeStart}–${d.pickupTimeEnd} Uhr`}</Feld>
        <Feld titel={T.zahlung}>
          {`${zahlartText(d.paymentMethod, d.paymentStatus)} · ${euro(summen.gesamtCents)}`}
          {summen.gebuehrCents > 0 && ` ${T.inklGebuehr(euro(summen.gebuehrCents))}`}
        </Feld>
      </dl>

      <section aria-label={T.positionen} className="flex flex-col">
        {d.items.map((i) => (
          <p key={i.id} className={cn('border-t border-border py-2 text-[14px] text-foreground', i.fehltSeit && 'line-through decoration-muted-foreground')}>
            {formatPosition({ name: i.productName, quantity: i.quantity, unit: i.product.unit, unitSize: i.product.unitSize, totalPrice: centsAlsEuro(alsCents(i.totalPrice)) })}
          </p>
        ))}
        {summen.gebuehrCents > 0 && (
          <p className={cn('flex border-t border-border py-2 text-[14px]', LEISE)}>
            <span>{T.servicegebuehr}</span>
            <span className="ml-auto tabular-nums">{euro(summen.gebuehrCents)}</span>
          </p>
        )}
      </section>

      <section aria-labelledby={`verlauf-${d.id}`}>
        <h3 id={`verlauf-${d.id}`} className={cn(KICKER, 'mb-1.5')}>
          {T.verlauf}
        </h3>
        <ol className="flex flex-col gap-1.5">
          {verlauf.map((v, n) => (
            <li key={n} className="text-[13.5px] leading-relaxed">
              <span className={cn('font-semibold', v.ton === 'tun' ? 'text-zustand-tun' : 'text-foreground')}>{v.text}</span>
              <span className={LEISE}>{` ${zeitpunktText(v.wann)}${v.zusatz ? ` · ${v.zusatz}` : ''}`}</span>
            </li>
          ))}
        </ol>
      </section>

      <Hinweiskarte ton={faelle.ton === 'tun' ? 'orange' : 'neutral'}>
        <strong className="font-semibold">{`${T.wasTun}: `}</strong>
        {faelle.wasTun}
      </Hinweiskarte>

      <BestellungAktionen
        orderId={d.id}
        nummer={d.orderNumber}
        ausserhalbMoeglich={ausserhalbErstattetMoeglich(d)}
        storno={notfallStornoStand(d)}
        hofFadenHref={d.hofFadenId ? eingangAdresse('antwort', { art: 'antwort', id: d.hofFadenId }) : null}
      />

      <section aria-labelledby={`mails-${d.id}`}>
        <h3 id={`mails-${d.id}`} className={cn(KICKER, 'mb-1.5')}>
          {T.mails}
        </h3>
        {mailZeilen.length === 0 ? (
          <p className={cn('text-[13.5px]', LEISE)}>{T.mailsLeer}</p>
        ) : (
          <ul className="flex flex-col">
            {mailZeilen.map((z, n) => (
              <li key={z.id ?? `erwartet-${n}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-2 text-[13.5px]">
                <span className="font-semibold text-foreground">{z.name}</span>
                <span className={LEISE}>{`${z.weg} · ${z.stand}`}</span>
                {z.marke && <Marke art={z.marke.art}>{z.marke.text}</Marke>}
                {z.id && (
                  <Link href={alleMailsHref({}, { mail: z.id })} className="ml-auto inline-flex min-h-11 items-center font-semibold text-brand-text underline-offset-2 hover:underline">
                    {T.mailAnsehen}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/*
 * Admin › Bestellungen (Register N32, N34; Nr. 186; Mockup
 * admin-bestellungen): Suche (Bestellnummer oder ganze Adresse — dieselbe
 * Abfrage wie Admin › Betrieb › E-Mails) und Filter, links die Liste (480 px
 * ab 1024 px), rechts das Detail (`?bestellung=`). Am Handy ersetzt das
 * Detail die Liste wie ein Blatt, mit „Zur Liste“ zurück. Ein Wechsel lässt
 * den alten Inhalt stehen (LadeRahmen, keine loading.tsx — der Filter steht
 * in der Adresse). Erste Anweisung ist die Admin-Prüfung (Recht „ansehen“).
 */
export default async function AdminBestellungenPage({ searchParams }: { searchParams: Promise<BestellungenParameter> }): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const roh = await searchParams
  const sucheRoh = typeof roh.suche === 'string' ? roh.suche : ''
  const suche = mailSucheAus(roh.suche)
  const f = bestellFilterAus(roh)
  const gewaehlt = gewaehlteBestellungAus(roh.bestellung)
  const jetzt = new Date()

  let geladen: { zeilen: BestellZeile[]; hoefe: Array<{ id: string; name: string }>; detail: BestellDetail | null } | null = null
  try {
    const [zeilen, hoefe, detail] = await Promise.all([ladeBestellListe(suche, f, jetzt), ladeHofAuswahl(), gewaehlt ? ladeBestellDetail(gewaehlt, jetzt) : Promise.resolve(null)])
    geladen = { zeilen, hoefe, detail }
  } catch (err) {
    // Nur Bereich und Seite — nie Suchwort oder Adresse.
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'bestellungen' } })
  }
  if (!geladen) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel={T.titel} satz={T.ladeFehler} nochmal={bestellungenHref(f, { suche: sucheRoh })} />
      </div>
    )
  }

  const { zeilen, hoefe, detail } = geladen
  const mitDetail = gewaehlt !== null
  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-4 md:gap-5')}>
      <LadeRahmen>
        <Seitenkopf titel={T.titel} satz={T.satz} rechts={<AuskunftKundin />} />
        <SuchUndFilter sucheRoh={sucheRoh} f={f} hoefe={hoefe} />
        <LadeInhalt className="flex flex-col gap-3.5">
          {suche.art === 'ungueltig' && <Hinweiskarte ton="orange">{MAIL_TEXT.sucheUngueltig}</Hinweiskarte>}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[480px_minmax(0,1fr)]">
            <section aria-label={T.listeBeschriftung} className={cn(SPALTE, mitDetail ? 'hidden lg:flex' : 'flex')}>
              <div className="flex items-baseline gap-2 px-3.5 pt-3 pb-2">
                <p className={KICKER}>{trefferKopf(suche)}</p>
                <p className={cn('ml-auto text-[12.5px]', LEISE)}>{T.anzahl(zeilen.length)}</p>
              </div>
              {zeilen.length === 0 ? (
                <EmptyState
                  symbol={PackageSearch}
                  titel={T.leerTitel}
                  satz={T.leerSatz}
                  className="rounded-none border-0 py-8"
                  ausweg={
                    <Link href={bestellungenHref({})} className={KNOPF_RAHMEN}>
                      {T.filterZuruecksetzen}
                    </Link>
                  }
                />
              ) : (
                <ul>
                  {zeilen.map((z) => (
                    <li key={z.id} className="border-t border-border">
                      <Zeile z={z} href={bestellungenHref(f, { suche: sucheRoh, bestellung: z.id })} aktiv={z.id === gewaehlt} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section aria-label={T.detailBeschriftung} className={cn(SPALTE, mitDetail ? 'flex' : 'hidden lg:flex')}>
              {mitDetail && (
                <Link href={bestellungenHref(f, { suche: sucheRoh })} scroll={false} className={cn(KNOPF_RAHMEN, 'm-3 mb-0 self-start border-transparent lg:hidden')}>
                  <ArrowLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
                  {T.zurListe}
                </Link>
              )}
              {detail ? <Detail d={detail} jetzt={jetzt} /> : <p className={cn('p-6 text-center text-sm', LEISE)}>{mitDetail ? T.nichtGefunden : T.waehlen}</p>}
            </section>
          </div>
          <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{T.regel}</p>
        </LadeInhalt>
      </LadeRahmen>
    </div>
  )
}
