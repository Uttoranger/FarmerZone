import type { Metadata } from 'next'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ladeHoefeFuerGruendung } from '@/server/queries/admin'
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
import {
  FINANZEN_KENNZAHL_KURZ,
  FINANZEN_REITER_OHNE_INHALT,
  FINANZEN_SEITE,
  finanzenAdresse,
  finanzenReiterLabel,
  finanzenUnterreiter,
  grundgebuehrenKachel,
  type FinanzenReiterId,
} from '@/lib/admin-finanzen-seite'
import type { KennzahlDaten } from '@/lib/admin-seiten'
import { vergebeneGruendungsplaetze } from '@/lib/gruendungshof'
import { finanzenReiterAus } from '@/schemas/admin-reiter'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { ProgressBar } from '@/components/ui/progress-bar'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KICKER, LEISE } from '@/components/hof-bestellungen/stil'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { Kennzahlen } from '@/components/admin/kennzahlen'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { Unterreiter } from '@/components/admin/unterreiter'
import { DiagrammLegende, FinanzenDiagramm } from './finanzen-diagramm'
import { KostenListe } from './kosten-liste'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Finanzen — Admin — ${MARKE}` }
// Die Seite zeigt Geld und wird selten aufgerufen — nie aus einem Cache.
export const dynamic = 'force-dynamic'

/**
 * /admin/finanzen — beantwortet EINE Frage: Ab wann trägt sich die Plattform?
 * (Mockup admin-finanzen, im neuen Design seit Nr. 22f; seit Nr. 94 im
 * Admin-Seitenmuster, Register N15: Seitenkopf mit Monat, Kennzahlen,
 * Unterreiter Monat · Kosten · Auszahlungen · Entfallene Gebühren, Regel-Zeile.
 * Inhalt und Beträge sind die von heute, nur neu geordnet — es kommt keine
 * Zahl und keine Rechnung dazu.)
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
  searchParams: Promise<{ monat?: string; reiter?: string }>
}): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const { monat: gewuenscht, reiter: gewaehlterReiter } = await searchParams
  // Auch der Reiter ist Fremdtext aus der Adresse: Unbekanntes ist der Monat (Zod, src/schemas/admin-reiter.ts).
  const reiter = finanzenReiterAus(gewaehlterReiter)
  // Ungültiges still verwerfen und den laufenden Monat zeigen (ARCHITECTURE §4):
  // Eine Adresszeile ist Fremdtext, kein Grund für eine Fehlerseite.
  const monat = typeof gewuenscht === 'string' && istMonatsschluessel(gewuenscht) ? gewuenscht : aktuellerFinanzMonat()

  let daten: FinanzenDaten | null = null
  let gruendungshoefe: number | null = null
  const jetzt = new Date()
  // Die Zahl der Gründungshöfe für die Kachel „Grundgebühren“ — die schmale Abfrage der Platzvergabe, keine neue.
  // Scheitert nur sie, fehlt nur diese Kachel; das Geld der Seite bleibt.
  const [finanzen, platzHoefe] = await Promise.allSettled([getFinanzen(monat), ladeHoefeFuerGruendung()])
  if (finanzen.status === 'fulfilled') daten = finanzen.value
  else Sentry.captureException(finanzen.reason, { tags: { bereich: 'admin', seite: 'finanzen' } })
  if (platzHoefe.status === 'fulfilled') gruendungshoefe = vergebeneGruendungsplaetze(platzHoefe.value)
  else Sentry.captureException(platzHoefe.reason, { tags: { bereich: 'admin', seite: 'finanzen-gruendungshoefe' } })

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

  const grundgebuehren = gruendungshoefe === null ? null : grundgebuehrenKachel(jetzt, gruendungshoefe)
  const kennzahlen: KennzahlDaten[] = [
    {
      id: 'online',
      titel: EINNAHMEN_ONLINE_LABEL,
      titelKurz: FINANZEN_KENNZAHL_KURZ.online,
      wert: formatEuro(centsAlsEuro(einnahmen.eingezogenCents)),
      satz: `bereits einbehalten · ${STRIPE_HINWEIS}`,
      // Dass Stripes Gebühren hier noch nicht abgezogen sind, soll auch am Handy dastehen.
      satzAmHandy: true,
    },
    {
      id: 'vorOrt',
      titel: EINNAHMEN_VOR_ORT_LABEL,
      titelKurz: FINANZEN_KENNZAHL_KURZ.vorOrt,
      wert: formatEuro(centsAlsEuro(einnahmen.geschuldetCents)),
      satz: 'noch offen · schulden die Höfe',
    },
    ...(grundgebuehren
      ? [{ id: 'grundgebuehren', titel: 'Grundgebühren', titelKurz: FINANZEN_KENNZAHL_KURZ.grundgebuehren, wert: grundgebuehren.wert, satz: grundgebuehren.satz }]
      : []),
    {
      id: 'kosten',
      titel: 'Kosten',
      titelKurz: FINANZEN_KENNZAHL_KURZ.kosten,
      wert: formatEuro(centsAlsEuro(kosten.cents)),
      satz: kosten.anzahl === 1 ? '1 Posten' : `${kosten.anzahl} Posten`,
    },
    {
      id: 'ergebnis',
      titel: 'Ergebnis',
      titelKurz: FINANZEN_KENNZAHL_KURZ.ergebnis,
      // „+ € 35,10“ nur beim Ergebnis, wenn es positiv ist.
      wert: ergebnisCents > 0 ? `+ ${formatEuro(centsAlsEuro(ergebnisCents))}` : formatEuro(centsAlsEuro(ergebnisCents)),
      satz: ergebnisCents < 0 ? 'noch nicht gedeckt' : 'trägt sich',
      // Grün = trägt sich, Orange = noch nicht (kein Rot, Register O1).
      ton: ergebnisCents < 0 ? 'tun' : 'laeuft',
    },
  ]

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-5')}>
      <Seitenkopf
        titel={FINANZEN_SEITE.titel}
        satz={FINANZEN_SEITE.satz}
        // Leise, nur wenn eine gezeigte Zahl eine Testzahlung auslässt (finanzseiteLaesstTestzahlungenAus, Register Z4).
        hinweis={daten.testzahlungenHinweis}
        rechts={
          /* Links statt Knöpfe: Der Monat steht in der Adresse, also ist er
             teilbar und der Zurück-Pfeil des Browsers tut das Richtige. */
          <nav aria-label="Monat wählen" className="flex items-center gap-1.5">
            <MonatsPfeil monat={daten.vorigerMonat} reiter={reiter} richtung="zurueck" />
            <span className="min-w-[9.5rem] text-center text-[15px] font-semibold text-foreground" aria-current="page">
              {daten.bezeichnung}
            </span>
            <MonatsPfeil monat={daten.naechsterMonat} reiter={reiter} richtung="vor" />
          </nav>
        }
      />

      <Kennzahlen beschriftung={FINANZEN_SEITE.kennzahlen} eintraege={kennzahlen} />

      <Unterreiter beschriftung={FINANZEN_SEITE.reiter} eintraege={finanzenUnterreiter(daten.monat)} aktiv={reiter} />

      {reiter === 'monat' && (
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
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
        </div>
      )}

      {reiter === 'kosten' && (
        <div className="max-w-[560px]">
          <KostenListe monat={daten.monat} bezeichnung={daten.bezeichnung} posten={daten.posten} summeCents={kosten.cents} />
        </div>
      )}

      {(reiter === 'auszahlungen' || reiter === 'entfallen') && (
        <EmptyState
          symbol={Wallet}
          titel={finanzenReiterLabel(reiter)}
          satz={FINANZEN_REITER_OHNE_INHALT}
          ausweg={{ ohne: 'Zu diesem Reiter hat die Finanzseite keine Zahlen; es gibt nichts, wohin der Weg führen könnte' }}
        />
      )}

      <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{FINANZEN_FUSSZEILE}</p>
    </div>
  )
}

/** Ein Monatspfeil — oder ein stiller Platzhalter, wo es nichts mehr gibt. */
function MonatsPfeil({
  monat,
  reiter,
  richtung,
}: {
  monat: string | null
  /** Der Reiter bleibt beim Blättern stehen. */
  reiter: FinanzenReiterId
  richtung: 'zurueck' | 'vor'
}): React.JSX.Element {
  const Symbol = richtung === 'zurueck' ? ChevronLeft : ChevronRight
  if (monat === null) {
    // Kein ausgegrauter Knopf, der nichts tut: Die Fläche bleibt, damit der
    // Monatsname nicht springt, aber es gibt nichts zu treffen.
    return <span aria-hidden="true" className="block size-11" />
  }
  return (
    <Link
      href={finanzenAdresse({ monat, reiter })}
      aria-label={richtung === 'zurueck' ? 'Vorheriger Monat' : 'Nächster Monat'}
      className={cn('flex size-11 items-center justify-center rounded-full border border-border text-foreground hover:bg-muted', FOKUS_RAHMEN)}
    >
      <Symbol className="size-4" strokeWidth={1.7} aria-hidden="true" />
    </Link>
  )
}
