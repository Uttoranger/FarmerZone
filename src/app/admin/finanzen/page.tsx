import type { Metadata } from 'next'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { aktuellerFinanzMonat, getFinanzen, type FinanzenDaten } from '@/server/queries/finanzen'
import { centsAlsEuro, istMonatsschluessel } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import {
  EINNAHMEN_ONLINE_LABEL,
  EINNAHMEN_PROVISION_LABEL,
  EINNAHMEN_VOR_ORT_LABEL,
  FINANZEN_FUSSZEILE,
  STRIPE_HINWEIS,
  kostendeckungSatz,
} from '@/lib/finanzen'
import { cn } from '@/lib/utils'
import { ProgressBar } from '@/components/ui/progress-bar'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KICKER, LEISE } from '@/components/hof-bestellungen/stil'
import { ADMIN_RAHMEN, AdminFehler, SEITEN_TITEL } from '@/components/admin/admin-teile'
import { DiagrammLegende, FinanzenDiagramm } from './finanzen-diagramm'
import { KostenListe } from './kosten-liste'

export const metadata: Metadata = { title: 'Finanzen — Admin — FarmerZone' }
// Die Seite zeigt Geld und wird selten aufgerufen — nie aus einem Cache.
export const dynamic = 'force-dynamic'

/**
 * /admin/finanzen — beantwortet EINE Frage: Ab wann trägt sich die Plattform?
 * (Mockup admin-finanzen, im neuen Design seit Nr. 22f.)
 *
 * Die Einnahmen kommen aus den Bestellungen (die Servicegebühr, in vier Töpfen
 * — src/lib/finanzen.ts), die Kosten trägt der Betreiber selbst ein. Ein
 * Überblick, keine Buchhaltung: keine Abrechnung mit den Höfen, kein
 * automatischer Abruf von Kosten, keine Fremdwährung. Alle Beträge in ganzen
 * Cent; gerechnet wird nichts hier — die Seite zeigt an, was die reinen
 * Funktionen entschieden haben (ARCHITECTURE §1). Nur lesend: Geschrieben
 * werden hier allein die eigenen Kostenposten (KostenSheet, unverändert).
 */
export default async function AdminFinanzenPage({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string }>
}): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const { monat: gewuenscht } = await searchParams
  // Ungültiges still verwerfen und den laufenden Monat zeigen (ARCHITECTURE §4):
  // Eine Adresszeile ist Fremdtext, kein Grund für eine Fehlerseite.
  const monat = typeof gewuenscht === 'string' && istMonatsschluessel(gewuenscht) ? gewuenscht : aktuellerFinanzMonat()

  let daten: FinanzenDaten | null = null
  try {
    daten = await getFinanzen(monat)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'finanzen' } })
  }

  if (!daten) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel="Finanzen" satz="Wir konnten die Finanzen gerade nicht laden." nochmal="/admin/finanzen" />
      </div>
    )
  }

  const { einnahmen, kosten } = daten
  const ergebnisCents = einnahmen.gezaehltCents - kosten.cents
  const geschafft = daten.brauchtBestellungen

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-5')}>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className={SEITEN_TITEL}>Finanzen</h1>
        {/* Links statt Knöpfe: Der Monat steht in der Adresse, also ist er
            teilbar und der Zurück-Pfeil des Browsers tut das Richtige. */}
        <nav aria-label="Monat wählen" className="flex items-center gap-1.5">
          <MonatsPfeil monat={daten.vorigerMonat} richtung="zurueck" />
          <span className="min-w-[9.5rem] text-center text-[15px] font-semibold text-foreground" aria-current="page">
            {daten.bezeichnung}
          </span>
          <MonatsPfeil monat={daten.naechsterMonat} richtung="vor" />
        </nav>
      </header>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kachel titel={EINNAHMEN_ONLINE_LABEL} betragCents={einnahmen.eingezogenCents} satz={`bereits einbehalten · ${STRIPE_HINWEIS}`} />
        <Kachel titel={EINNAHMEN_VOR_ORT_LABEL} betragCents={einnahmen.geschuldetCents} satz="noch offen · schulden die Höfe" />
        <Kachel titel="Kosten" betragCents={kosten.cents} satz={kosten.anzahl === 1 ? '1 Posten' : `${kosten.anzahl} Posten`} />
        <Kachel
          titel="Ergebnis"
          betragCents={ergebnisCents}
          vorzeichen
          satz={ergebnisCents < 0 ? 'noch nicht gedeckt' : 'trägt sich'}
          ton={ergebnisCents < 0 ? 'offen' : 'fertig'}
        />
      </dl>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <section aria-labelledby="traegt-titel" className={cn(KARTE, 'flex flex-col gap-4 p-4 md:p-[18px]')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="traegt-titel" className="font-heading text-[17px] font-semibold text-foreground">
              Wann trägt sich die Plattform?
            </h2>
            <DiagrammLegende />
          </div>
          <FinanzenDiagramm punkte={daten.verlauf} />
          <p className="text-[14px] leading-relaxed text-foreground">
            {kostendeckungSatz({
              schnittCents: daten.schnittCents,
              brauchtBestellungen: daten.brauchtBestellungen,
              bezeichnung: daten.bezeichnung,
              bestellungen: einnahmen.bestellungen,
            })}
          </p>
          {geschafft !== null && geschafft > 0 && (
            <ProgressBar
              beschriftung={`${einnahmen.bestellungen} von ${geschafft} Bestellungen`}
              wert={Math.min(einnahmen.bestellungen, geschafft)}
              max={geschafft}
            />
          )}
        </section>

        <KostenListe monat={daten.monat} bezeichnung={daten.bezeichnung} posten={daten.posten} summeCents={kosten.cents} />
      </div>

      <section aria-labelledby="einnahmen-titel" className={cn(KARTE, 'p-4 md:p-[18px]')}>
        <h2 id="einnahmen-titel" className={KICKER}>
          Einnahmen im Einzelnen
        </h2>
        <dl className="mt-2 text-[14px] [&>div]:flex [&>div]:items-baseline [&>div]:justify-between [&>div]:gap-3 [&>div]:border-t [&>div]:border-border [&>div]:py-2.5">
          <div>
            <dt className="text-foreground">{EINNAHMEN_ONLINE_LABEL}</dt>
            <dd className="font-semibold text-foreground tabular-nums">{formatEuro(centsAlsEuro(einnahmen.eingezogenCents))}</dd>
          </div>
          <div>
            <dt className="text-foreground">{EINNAHMEN_VOR_ORT_LABEL}</dt>
            <dd className="font-semibold text-foreground tabular-nums">{formatEuro(centsAlsEuro(einnahmen.geschuldetCents))}</dd>
          </div>
          {/* „Provision" nur, wenn sie im Monat nicht 0 ist: Farm.platformFeePercent
              steht im Pilot auf 0, und eine Nullzeile ist Rauschen. */}
          {einnahmen.provisionCents !== 0 && (
            <div>
              <dt className="text-foreground">{EINNAHMEN_PROVISION_LABEL}</dt>
              <dd className="font-semibold text-foreground tabular-nums">{formatEuro(centsAlsEuro(einnahmen.provisionCents))}</dd>
            </div>
          )}
        </dl>
        <p className={cn('mt-1 text-[13px]', LEISE)}>
          erwartet: {formatEuro(centsAlsEuro(einnahmen.erwartetCents))} aus{' '}
          {einnahmen.offeneBestellungen === 1 ? '1 offenen Bestellung' : `${einnahmen.offeneBestellungen} offenen Bestellungen`}
        </p>
      </section>

      <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{FINANZEN_FUSSZEILE}</p>
    </div>
  )
}

/** Ein Monatspfeil — oder ein stiller Platzhalter, wo es nichts mehr gibt. */
function MonatsPfeil({ monat, richtung }: { monat: string | null; richtung: 'zurueck' | 'vor' }): React.JSX.Element {
  const Symbol = richtung === 'zurueck' ? ChevronLeft : ChevronRight
  if (monat === null) {
    // Kein ausgegrauter Knopf, der nichts tut: Die Fläche bleibt, damit der
    // Monatsname nicht springt, aber es gibt nichts zu treffen.
    return <span aria-hidden="true" className="block size-11" />
  }
  return (
    <Link
      href={`/admin/finanzen?monat=${monat}`}
      aria-label={richtung === 'zurueck' ? 'Vorheriger Monat' : 'Nächster Monat'}
      className={cn('flex size-11 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted', FOKUS_RAHMEN)}
    >
      <Symbol className="size-4" strokeWidth={1.7} aria-hidden="true" />
    </Link>
  )
}

function Kachel({
  titel,
  betragCents,
  satz,
  vorzeichen = false,
  ton,
}: {
  titel: string
  betragCents: number
  satz: string
  /** „+ € 35,10" — nur beim Ergebnis. */
  vorzeichen?: boolean
  /** Grün = trägt sich, Orange = noch nicht (kein Rot, Register O1). */
  ton?: 'fertig' | 'offen'
}): React.JSX.Element {
  const betrag = formatEuro(centsAlsEuro(betragCents))
  return (
    <div className={cn(KARTE, 'min-w-0 px-4 py-3.5')}>
      <dt className={KICKER}>{titel}</dt>
      <dd
        className={cn(
          'mt-1 font-heading text-[24px] leading-tight font-semibold tabular-nums md:text-[26px]',
          ton === 'fertig' ? 'text-status-fertig' : ton === 'offen' ? 'text-status-offen' : 'text-foreground'
        )}
      >
        {vorzeichen && betragCents > 0 ? `+ ${betrag}` : betrag}
      </dd>
      <dd className={cn('mt-0.5 text-[12.5px]', LEISE)}>{satz}</dd>
    </div>
  )
}
