import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { aktuellerFinanzMonat, getFinanzen } from '@/server/queries/finanzen'
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
import { Marke } from '@/components/ui/marke'
import { cn } from '@/lib/utils'
import { FinanzenDiagramm } from './finanzen-diagramm'
import { KostenListe } from './kosten-liste'

export const metadata: Metadata = { title: 'Finanzen — Admin — FarmerZone' }
// Die Seite zeigt Geld und wird selten aufgerufen — nie aus einem Cache.
export const dynamic = 'force-dynamic'

const CHIP_EINGEZOGEN = 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-200'
const CHIP_OFFEN = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'

/**
 * /admin/finanzen — beantwortet EINE Frage: Ab wann trägt sich die Plattform?
 *
 * Die Einnahmen kommen aus den Bestellungen (die Servicegebühr, in vier Töpfen
 * — src/lib/finanzen.ts), die Kosten trägt der Betreiber selbst ein. Ein
 * Überblick, keine Buchhaltung: keine Abrechnung mit den Höfen, kein
 * automatischer Abruf von Kosten, keine Fremdwährung.
 *
 * Gerechnet wird nichts hier. Diese Datei zeigt an, was die reine Funktion
 * entschieden hat (ARCHITECTURE §1).
 */
export default async function AdminFinanzenPage({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string }>
}) {
  await verlangeAdminSeite()

  const { monat: gewuenscht } = await searchParams
  // Ungültiges still verwerfen und den laufenden Monat zeigen (ARCHITECTURE §4):
  // Eine Adresszeile ist Fremdtext, kein Grund für eine Fehlerseite.
  const monat =
    typeof gewuenscht === 'string' && istMonatsschluessel(gewuenscht)
      ? gewuenscht
      : aktuellerFinanzMonat()

  const daten = await getFinanzen(monat)
  const { einnahmen, kosten } = daten
  const einnahmenCents = einnahmen.gezaehltCents
  const ergebnisCents = einnahmenCents - kosten.cents

  const geschafft = daten.brauchtBestellungen
  const anteil =
    geschafft === null || geschafft === 0
      ? null
      : Math.min(100, Math.round((einnahmen.bestellungen / geschafft) * 100))

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <Link href="/admin" className="text-sm text-primary hover:underline">
          ← Admin
        </Link>

        <h1 className="mt-3 mb-4 text-xl font-semibold text-foreground">Finanzen</h1>

        {/* Monatswahl. Links statt Knöpfe: Der Monat steht in der Adresse, also
            ist er teilbar und der Zurück-Pfeil des Browsers tut das Richtige. */}
        <nav
          aria-label="Monat wählen"
          className="mb-5 flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-1 py-1"
        >
          <MonatsPfeil monat={daten.vorigerMonat} richtung="zurueck" />
          <span className="text-sm font-semibold text-foreground">{daten.bezeichnung}</span>
          <MonatsPfeil monat={daten.naechsterMonat} richtung="vor" />
        </nav>

        {/* Drei Kacheln. Bei 375 px zwei Spalten und das Ergebnis über die
            ganze Breite — drei Beträge nebeneinander brächen dort um. */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kachel
            titel="Einnahmen"
            betragCents={einnahmenCents}
            fussnote={
              einnahmen.bestellungen === 1
                ? '1 Bestellung'
                : `${einnahmen.bestellungen} Bestellungen`
            }
          />
          <Kachel
            titel="Kosten"
            betragCents={kosten.cents}
            fussnote={kosten.anzahl === 1 ? '1 Posten' : `${kosten.anzahl} Posten`}
          />
          <Kachel
            titel="Ergebnis"
            betragCents={ergebnisCents}
            fussnote={ergebnisCents < 0 ? 'noch nicht gedeckt' : 'gedeckt'}
            negativ={ergebnisCents < 0}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        {/* Die Antwort auf die Frage der Seite. Auf der Markenfläche, damit sie
            nicht wie eine weitere Kachel aussieht: `primary` ist im hellen
            Modus das dunkle Waldgrün und im dunklen die helle Entsprechung —
            `primary-foreground` sitzt in beiden darauf (CODING_STANDARDS §7). */}
        <section className="mb-5 rounded-2xl bg-primary px-4 py-4 text-primary-foreground">
          <h2 className="text-sm font-semibold">Wann trägt sich die Plattform?</h2>
          <p className="mt-1.5 text-sm leading-relaxed opacity-95">
            {kostendeckungSatz({
              schnittCents: daten.schnittCents,
              brauchtBestellungen: daten.brauchtBestellungen,
              bezeichnung: daten.bezeichnung,
              bestellungen: einnahmen.bestellungen,
            })}
          </p>

          {anteil !== null && geschafft !== null && (
            <div className="mt-3">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={geschafft}
                aria-valuenow={einnahmen.bestellungen}
                aria-label={`${einnahmen.bestellungen} von ${geschafft} Bestellungen`}
                // Die Wanne steht bewusst leise (2:1 gegen die Fläche): Die
                // Aussage trägt der gefüllte Balken, und darunter steht sie
                // zusätzlich als Zahl — der Fortschritt hängt also nie allein
                // an einem Farbunterschied.
                className="h-2 w-full overflow-hidden rounded-full bg-primary-foreground/25"
              >
                <div
                  className="h-full rounded-full bg-primary-foreground transition-[width]"
                  style={{ width: `${anteil}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs opacity-90 tabular-nums">
                {einnahmen.bestellungen} von {geschafft} Bestellungen
              </p>
            </div>
          )}
        </section>

        <FinanzenDiagramm punkte={daten.verlauf} />

        {/* Einnahmen im Einzelnen */}
        <section className="mb-5 rounded-xl border border-border bg-card">
          <h2 className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Einnahmen
          </h2>

          <Zeile
            titel={EINNAHMEN_ONLINE_LABEL}
            chip="eingezogen"
            chipFarbe={CHIP_EINGEZOGEN}
            betragCents={einnahmen.eingezogenCents}
            // Befund aus Phase 0 d): Die Zahlung entsteht auf dem
            // Plattformkonto, Stripe zieht dort ab — gespeichert wird davon
            // nichts. „Eingezogen" ist deshalb ein Brutto.
            hinweis={STRIPE_HINWEIS}
          />
          <Zeile
            titel={EINNAHMEN_VOR_ORT_LABEL}
            chip="noch offen"
            chipFarbe={CHIP_OFFEN}
            betragCents={einnahmen.geschuldetCents}
            hinweis="schulden die Höfe"
          />
          {/* „Provision" nur, wenn sie im Monat nicht 0 ist: Farm.platformFeePercent
              steht im Pilot auf 0, und eine Nullzeile auf jeder Seite ist Rauschen. */}
          {einnahmen.provisionCents !== 0 && (
            <Zeile titel={EINNAHMEN_PROVISION_LABEL} betragCents={einnahmen.provisionCents} />
          )}

          <p className="px-4 py-2.5 text-xs text-muted-foreground">
            erwartet: {formatEuro(centsAlsEuro(einnahmen.erwartetCents))} aus{' '}
            {einnahmen.offeneBestellungen === 1
              ? '1 offenen Bestellung'
              : `${einnahmen.offeneBestellungen} offenen Bestellungen`}
          </p>
        </section>

        <KostenListe monat={daten.monat} bezeichnung={daten.bezeichnung} posten={daten.posten} />

        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{FINANZEN_FUSSZEILE}</p>
      </div>
    </main>
  )
}

/** Ein Monatspfeil — oder ein stiller Platzhalter, wo es nichts mehr gibt. */
function MonatsPfeil({
  monat,
  richtung,
}: {
  monat: string | null
  richtung: 'zurueck' | 'vor'
}) {
  const Symbol = richtung === 'zurueck' ? ChevronLeft : ChevronRight
  const beschriftung = richtung === 'zurueck' ? 'Vorheriger Monat' : 'Nächster Monat'

  if (monat === null) {
    // Kein ausgegrauter Knopf, der nichts tut: Die Fläche bleibt, damit der
    // Monatsname nicht springt, aber es gibt nichts zu treffen.
    // `block`, weil ein inline-Span keine Größe annimmt.
    return <span aria-hidden="true" className="block size-11" />
  }

  return (
    <Link
      href={`/admin/finanzen?monat=${monat}`}
      aria-label={beschriftung}
      className="flex size-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Symbol className="size-5" aria-hidden="true" />
    </Link>
  )
}

function Kachel({
  titel,
  betragCents,
  fussnote,
  negativ = false,
  className,
}: {
  titel: string
  betragCents: number
  fussnote: string
  negativ?: boolean
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-card px-3 py-3', className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {titel}
      </p>
      <p
        className={cn(
          'mt-0.5 text-lg font-semibold tabular-nums',
          // Bedeutungsfarbe: Ein negatives Ergebnis ist die eine Zahl, die man
          // sofort sehen muss. Heller Wert plus dark:-Entsprechung (§7).
          negativ ? 'text-red-600 dark:text-red-400' : 'text-foreground'
        )}
      >
        {formatEuro(centsAlsEuro(betragCents))}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{fussnote}</p>
    </div>
  )
}

function Zeile({
  titel,
  chip,
  chipFarbe,
  betragCents,
  hinweis,
}: {
  titel: string
  chip?: string
  chipFarbe?: string
  betragCents: number
  hinweis?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-foreground">{titel}</span>
          {chip && chipFarbe && <Marke farbe={chipFarbe}>{chip}</Marke>}
        </div>
        {hinweis && <p className="mt-0.5 text-xs text-muted-foreground">{hinweis}</p>}
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {formatEuro(centsAlsEuro(betragCents))}
      </span>
    </div>
  )
}
