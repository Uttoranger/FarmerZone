import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { ArrowRight, ChevronDown, HandCoins, MapPin } from 'lucide-react'
import {
  BEISPIEL_WARENPREIS_CENTS,
  BRENNMATERIAL_KARTE,
  FUTTER_KARTE,
  beispielRechnung,
  startseitenFragen,
  hoefeAdresse,
  type Beispielrechnung,
  type KurzKarte,
} from '@/lib/startseite'
import type { AbschnittArt } from '@/lib/startseite-gestalten'
import { SERVICEGEBUEHR_BEZEICHNUNG, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { textlinkKlassen } from '@/components/ui/textlink'
import { SchonDabei } from '@/components/shared/schon-dabei'
import { Wortmarke } from '@/components/shared/wortmarke'
import { Kicker } from '@/components/startseite/kicker'
import { MARKE } from '@/lib/marke'
import type { GruendungSeiten } from '@/lib/gruendungshof'
import { gruendungFuerSeiten } from '@/server/queries/plattform-einstellung'
import { GruendungSatz } from '@/components/gruendung/satz'
import { NeuBeiDenHoefen } from '@/components/startseite/neu-bei-den-hoefen'
import { ladeNeuigkeiten } from '@/server/queries/neuigkeiten'
import { schonGemeldet } from '@/server/oeffentlich-lesen'
import { ladeHofpreisEinstellung } from '@/server/queries/plattform-einstellung'
import { gebuehrModellFuer, type GebuehrModell } from '@/lib/plattformgebuehr'

/*
 * Die Abschnitte der Startseite unter „Höfe in deiner Nähe", in der Reihenfolge
 * des Mockups (web-k0-startseite, mobil-k0-startseite): Futter vom Hof und
 * Brennmaterial (nur in der Saison) als kurze Karten (Board w1-startseite,
 * Nr. 234), So funktioniert's + Warum direkt vom Hof,
 * Für Höfe, Fragen, Fuß. Alles Server-Komponenten ohne eigenes Skript — auch
 * die Fragen: <details> klappt der Browser selbst auf und zu.
 *
 * Texte, Links und Rechnungen kommen aus src/lib/startseite.ts.
 */

const CONTAINER = 'mx-auto max-w-[1200px] px-4 md:px-6'
const H2 = 'font-heading text-[22px] font-semibold text-balance md:text-[32px]'

const KNOPF_UMRISS = cn(
  'inline-flex h-11 items-center justify-center rounded-full border border-border px-[18px] text-sm font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted md:h-[46px]',
  FOKUS_RAHMEN
)

/**
 * Eine Kategorie-Illustration (public/categories/): Sie hat einen hellen
 * Crème-Grund und ist kein Foto — nachts gedämpft und gerahmt statt
 * leuchtend (CODING_STANDARDS §7).
 */
export function Illustration({ src, sizes, className }: { src: string | null; sizes: string; className?: string }) {
  return (
    <span className={cn('relative block overflow-hidden bg-muted dark:ring-1 dark:ring-border', className)}>
      {src && <Image src={src} alt="" fill sizes={sizes} className="object-cover dark:brightness-[0.78] dark:saturate-[0.9]" />}
    </span>
  )
}

/**
 * Eine kurze Karte unter den Höfen (Board w1-/s1-startseite, Bild 2 und 3; Nr. 234): die leise
 * Überzeile als Überschrift, darunter in einer Karte ein Satz und der Textlink mit Pfeil. Ohne
 * Bild, ohne Knopf — die Hofkarten darüber sind die Hauptsache. `imPaar`: Die Seite stellt Futter
 * und Brennmaterial nebeneinander (StartseitenInhalt), dann bringt sie den Rahmen der Breite mit.
 */
function KurzKarteAbschnitt({ karte, id, imPaar = false }: { karte: KurzKarte; id: string; imPaar?: boolean }) {
  return (
    <section aria-labelledby={`${id}-titel`} className={cn('flex flex-col gap-2', !imPaar && 'pb-8 md:pb-12')}>
      <div className={cn('flex flex-col gap-2', !imPaar && CONTAINER)}>
        <Kicker ton="leise" als="h2" id={`${id}-titel`}>
          {karte.ueberzeile}
        </Kicker>
        <div className="flex flex-1 flex-col gap-1 rounded-2xl border border-border bg-card px-4 pt-4 pb-2 dark:ring-1 dark:ring-border">
          <p className="text-[16px] leading-snug font-semibold text-foreground">{karte.satz}</p>
          <Link href={karte.adresse} className={cn(textlinkKlassen({ form: 'zeile' }), 'w-fit gap-1 underline')}>
            {karte.link}
            <ArrowRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}

/** „Futter vom Hof" als kurze Karte (FUTTER_KARTE). */
export function FutterAbschnitt({ imPaar = false }: { imPaar?: boolean }): React.JSX.Element {
  return <KurzKarteAbschnitt karte={FUTTER_KARTE} id="futter" imPaar={imPaar} />
}

/**
 * „Brennmaterial vom Hof" als kurze Karte (BRENNMATERIAL_KARTE) — die Seite zeigt sie nur in der
 * Saison (istBrennmaterialSaison, Oktober bis März in Wiener Zeit; die Liste entscheidet das).
 * Raummeter erklärt erst /hoefe bzw. die Produktseite, wo sie vorkommen.
 */
export function BrennmaterialBand({ imPaar = false }: { imPaar?: boolean }): React.JSX.Element {
  return <KurzKarteAbschnitt karte={BRENNMATERIAL_KARTE} id="brennmaterial" imPaar={imPaar} />
}

const SCHRITTE = [
  { titel: 'Hof finden', text: 'Such nach Ort oder Produkt. Du siehst sofort, was es gibt und wann du abholen kannst.' },
  {
    titel: 'Bestellen und Abholtermin wählen',
    text: 'Online oder bar bei Abholung bezahlen. Die Ware ist für dich reserviert, sobald du bestellst.',
  },
  { titel: 'Am Hof abholen', text: 'Zur gewählten Zeit vorbeikommen, Bestellnummer zeigen, mitnehmen. Keine Lieferkosten.' },
] as const

/** Eine Zeile der Beispielrechnung. */
function Zeile({
  name,
  betrag,
  stark = false,
  gruen = false,
  trenner = false,
}: {
  name: string
  betrag: number
  stark?: boolean
  gruen?: boolean
  /** Die Linie über der Summe — als Rand der Zeile, denn in einer <dl> darf nur dt/dd stehen. */
  trenner?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-2',
        stark ? 'text-[15px] font-semibold' : 'text-[13.5px]',
        trenner && 'border-t border-border pt-3'
      )}
    >
      <dt className={stark ? 'text-foreground' : 'text-muted-foreground'}>{name}</dt>
      <dd className={gruen ? 'text-status-fertig' : undefined}>{formatEuro(centsAlsEuro(betrag))}</dd>
    </div>
  )
}

/**
 * „So funktioniert's" und „Warum direkt vom Hof" als EIN Abschnitt. Er trägt
 * die Sprungmarke #so-funktionierts — die Navigation der KundeShell zeigt
 * dorthin (src/lib/kunden-navigation.ts).
 */
export function SoFunktionierts({ rechnung }: { rechnung: Beispielrechnung }): React.JSX.Element {
  return (
    <section id="so-funktionierts" aria-labelledby="so-funktionierts-titel" className="scroll-mt-20 bg-muted/40 py-10 md:py-16">
      <div className={cn(CONTAINER, 'flex flex-col gap-10 md:flex-row md:items-start md:gap-[60px]')}>
        <div className="flex flex-1 flex-col gap-[18px]">
          <Kicker>{'So funktioniert’s'}</Kicker>
          <h2 id="so-funktionierts-titel" className={H2}>
            In drei Schritten zum Hofkorb
          </h2>
          <ol className="flex flex-col gap-[18px]">
            {SCHRITTE.map((schritt, i) => (
              <li key={schritt.titel} className="flex items-start gap-3.5">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 font-heading text-[17px] font-semibold text-status-fertig"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold">{schritt.titel}</h3>
                  <p className="text-[13.5px] leading-normal text-muted-foreground">{schritt.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <Kicker>Warum direkt vom Hof?</Kicker>
          <h2 className={H2}>Du weißt, woher es kommt</h2>
          <div className="flex items-start gap-[11px]">
            <HandCoins className="mt-0.5 size-5 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
            <div>
              <h3 className="text-[15px] font-semibold">Der Hof bekommt den vollen Preis</h3>
              {/* Im Hofpreis-Modell (N38) der Satz aus Board w1-startseite: Die Gebühr steckt im Preis, das Beispiel rechnet es vor. */}
              <p className="text-[13px] leading-normal text-muted-foreground">
                {rechnung.modell === 'hofpreis' ? (
                  'Der Hof setzt seinen Preis selbst.'
                ) : (
                  <>
                    Für dich kommen {rechnung.prozent} % {SERVICEGEBUEHR_BEZEICHNUNG} dazu, mindestens{' '}
                    {formatEuro(centsAlsEuro(rechnung.mindestCents))} – offen ausgewiesen.
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-[11px]">
            <MapPin className="mt-0.5 size-5 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
            <div>
              <h3 className="text-[15px] font-semibold">Kurze Wege, persönlich</h3>
              <p className="text-[13px] leading-normal text-muted-foreground">
                Die Ware wächst ein paar Kilometer von dir entfernt. Fragen stellst du direkt am Hof.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-[18px] py-4 dark:ring-1 dark:ring-border">
            <p className="text-[12px] font-semibold tracking-[1.1px] text-muted-foreground uppercase">Beispiel</p>
            {/* Im Hofpreis-Modell ein Satz statt der Rechnung (Board w1-startseite, Bild 3): keine eigene Gebührenzeile, online und bar gleich. */}
            {rechnung.modell === 'hofpreis' ? (
              <p data-beispiel="hofpreis" className="text-[15px] leading-normal text-foreground">
                {rechnung.satz}
              </p>
            ) : (
              <>
                <dl className="flex flex-col gap-3">
                  <Zeile name="Warenpreis" betrag={rechnung.warenpreisCents} />
                  <Zeile name={`${SERVICEGEBUEHR_BEZEICHNUNG} · ${rechnung.prozent} %`} betrag={rechnung.gebuehrCents} />
                  <Zeile name="Du zahlst" betrag={rechnung.duZahlstCents} stark trenner />
                  <Zeile name="Der Hof bekommt" betrag={rechnung.hofBekommtCents} stark gruen />
                </dl>
                <p className="text-xs leading-normal text-muted-foreground">{rechnung.fussnote}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Das Band „Für Höfe" — der eine orange Knopf der Seite (Hofwelt, DESIGN_SYSTEM
 * „Farbrollen"). Es trägt die Sprungmarke #fuer-hoefe für die Navigation.
 * „Mehr für Höfe" führt seit Nr. 15 auf die eigene Seite /fuer-hoefe. Preise
 * nennt das Band keine — die stehen nur dort und auf /konditionen
 * (src/lib/konditionen.ts). Darunter „Schon dabei? Anmelden" für Höfe, die
 * schon registriert sind (Register N1, Nr. 41).
 */
/**
 * Das Für-Höfe-Band mit dem Satz der Gründungshöfe (Register K2-Ergänzung,
 * Nr. 93). Es holt die Zahlen selbst, damit die Startseite (page.tsx) so
 * bleibt, wie sie ist; die Seite ist gecacht (revalidate 300), das Speichern
 * in Admin › Einstellungen baut sie neu. Scheitert das Laden, fehlt nur der Satz.
 */
export async function FuerHoefeBand(): Promise<React.JSX.Element> {
  return <FuerHoefeBandInhalt gruendung={await gruendungFuerSeiten()} />
}

/** Das Band selbst — ohne Zahlen (`gruendung` null) ohne den Satz. */
export function FuerHoefeBandInhalt({ gruendung = null }: { gruendung?: GruendungSeiten | null }): React.JSX.Element {
  return (
    <section id="fuer-hoefe" aria-labelledby="fuer-hoefe-titel" className="scroll-mt-20 pt-6 pb-[52px] md:pb-[72px]">
      <div className={CONTAINER}>
        <div className="flex flex-col gap-4 rounded-[18px] border border-primary/45 bg-linear-120 from-primary/16 to-card to-70% p-[18px] md:flex-row md:items-center md:gap-10 md:rounded-3xl md:px-10 md:py-[34px]">
          <div className="flex flex-1 flex-col gap-2.5">
            <Kicker ton="orange">Für Höfe</Kicker>
            <h2 id="fuer-hoefe-titel" className="font-heading text-xl font-semibold text-balance md:text-[30px]">
              Du hast einen Hof? Dein Hofladen, online.
            </h2>
            <p className="text-[13.5px] leading-normal text-foreground md:text-[15px]">
              Schnell eingerichtet. Deine Kundinnen bestellen vorab, du packst und übergibst – und behältst den vollen
              Warenpreis.
            </p>
            {/* Nach der Beschreibung, im Lesefluss — kein zweiter oranger Knopf (K2-Ergänzung, Punkt 1). */}
            <GruendungSatz gruendung={gruendung} className="mt-1" />
          </div>
          <div className="flex flex-col gap-1 md:items-end">
            <div className="flex flex-col gap-2.5 md:flex-row">
              <Link href="/fuer-hoefe" className={cn(KNOPF_UMRISS, 'rounded-[14px] md:rounded-full')}>
                Mehr für Höfe
              </Link>
              <Link
                href="/register"
                className={cn(
                  'inline-flex h-11 items-center justify-center rounded-[14px] border border-primary-foreground/30 bg-primary px-[18px] text-sm font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90 md:h-[46px] md:rounded-full',
                  FOKUS_RAHMEN
                )}
              >
                Hof registrieren
              </Link>
            </div>
            <SchonDabei className="text-center md:text-right" />
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * „Gut zu wissen" — <details name="fragen"> statt des Base-UI-Akkordeons:
 * dasselbe Aussehen ohne Client-Skript (DESIGN_SYSTEM schreibt keinen
 * Baustein vor). Der gemeinsame `name` lässt immer nur eine Frage offen wie
 * beim Akkordeon (Browser ohne Unterstützung öffnen mehrere — harmlos). Die
 * erste steht offen wie im Mockup; die Antworten stehen auch zugeklappt im
 * HTML — für die Suche im Browser und für Suchmaschinen. Tastatur und
 * Bildschirmleser bedienen <summary> wie einen Knopf.
 */
/** `jetzt` von der Seite: „Wie bezahle ich?" nennt die Bar-Ausnahme nur vor dem Stichtag (B1). */
/** „Wie bezahle ich?" je Modell (`startseitenFragen`); `modell` von der Seite (`gebuehrModellFuer`). */
export function Fragen({ jetzt, modell }: { jetzt: Date; modell: GebuehrModell }): React.JSX.Element {
  return (
    <section aria-labelledby="fragen-titel" className="pt-6 pb-14 md:pb-20">
      <div className={cn(CONTAINER, 'flex flex-col gap-4 md:flex-row md:gap-[60px]')}>
        <div className="md:w-[340px] md:shrink-0">
          <Kicker>Fragen</Kicker>
          <h2 id="fragen-titel" className={H2}>
            Gut zu wissen
          </h2>
        </div>
        <div className="flex flex-1 flex-col border-t border-border">
          {startseitenFragen(jetzt, modell).map((eintrag, i) => (
            <details key={eintrag.frage} name="fragen" open={i === 0} className="group border-b border-border last:border-b-0">
              <summary
                className={cn(
                  // list-none + Marker weg: Der Pfeil rechts ersetzt das Dreieck des Browsers.
                  'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-md py-4 text-left text-[15px] font-semibold text-foreground transition-colors hover:text-brand-text [&::-webkit-details-marker]:hidden',
                  FOKUS_RAHMEN
                )}
              >
                {eintrag.frage}
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-4 text-[13.5px] leading-normal text-muted-foreground">{eintrag.antwort}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// Impressum, Datenschutz, AGB und „Problem melden" stehen seit Nr. 120 im
// Seitenfuß der KundeShell (KundeFuss, Register N22) direkt darunter — hier
// nicht noch einmal. Seit Nr. 127 (N22, Ergänzung) hat jede Seite am Computer
// genau einen Fuß: den Seitenfuß, der dort auch „Höfe entdecken", „Für Höfe"
// (→ /fuer-hoefe mit Registrierung und Konditionen) und „So funktioniert's"
// führt; „Anmelden" steht im Kopf. Dieser Fuß gilt darum nur am Handy: Der
// Seitenfuß führt die Wege dort nicht, und die Produktseite hat keine
// Unterleiste. Die AGB bleiben in jedem Fuß erreichbar (O4).
const FUSS_SPALTEN: readonly {
  titel: string
  links: readonly { href: string; text: string }[]
}[] = [
  {
    titel: MARKE,
    links: [
      { href: hoefeAdresse(), text: 'Höfe entdecken' },
      { href: '/#so-funktionierts', text: 'So funktioniert’s' },
    ],
  },
  {
    titel: 'Für Höfe',
    links: [
      { href: '/register', text: 'Hof registrieren' },
      // Seit Nr. 41 (Register N1) steht „Anmelden" (→ /login) auch oben im
      // Kopf, am Handy wie im Browser; der Fuß behält den Weg der Höfe.
      { href: '/login', text: 'Anmelden für Höfe' },
      { href: '/konditionen', text: 'Konditionen' },
    ],
  },
]

/** Der Fuß der Startseite, nur am Handy (ab md verborgen): Am Computer steht der Seitenfuß der KundeShell. */
export function StartseiteFuss({ jahr }: { jahr: number }): React.JSX.Element {
  return (
    <footer className="border-t border-border py-10 md:hidden">
      <div className={cn(CONTAINER, 'flex flex-col gap-8')}>
        <div className="flex flex-col gap-2.5">
          {/* Der Fuß steht nicht im ersten Blick — vorab geladen wird die Marke nur in der Kopfzeile. */}
          <Wortmarke priority={false} />
          <p className="text-[13px] leading-normal text-muted-foreground">
            Regional einkaufen, direkt beim Hof abholen. Aus Österreich, für Österreich.
          </p>
          <p className="text-xs text-muted-foreground">© {jahr} {MARKE}</p>
        </div>
        <div className="grid grid-cols-2 gap-6">
          {FUSS_SPALTEN.map((spalte) => (
            <nav key={spalte.titel} aria-label={spalte.titel} className="flex flex-col gap-1">
              <p className="text-[13px] font-semibold">{spalte.titel}</p>
              <ul className="flex flex-col">
                {spalte.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        'inline-flex min-h-11 items-center rounded-md text-[13px] text-muted-foreground transition-colors duration-[250ms] hover:text-foreground',
                        FOKUS_RAHMEN
                      )}
                    >
                      {link.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  )
}

/** Was ein Abschnitt von der Seite bekommt: den Zeitpunkt (Bau oder „Stand am" der Vorschau). */
export type AbschnittProps = { jetzt: Date }

/**
 * „Neu bei den Höfen“ (Nr. 129) mit seinen Daten aus dem Datencache. Ein
 * Ladefehler nimmt nur den Abschnitt weg, nie die Startseite (wie die
 * Hofkarten in page.tsx); gemeldet wird er trotzdem.
 */
async function NeuBeiDenHoefenGeladen({ jetzt }: AbschnittProps) {
  let neuigkeiten: Awaited<ReturnType<typeof ladeNeuigkeiten>>
  try {
    neuigkeiten = await ladeNeuigkeiten()
  } catch (err) {
    unstable_rethrow(err)
    if (!schonGemeldet(err)) Sentry.captureException(err, { tags: { bereich: 'startseite-neuigkeiten' } })
    return null
  }
  return <NeuBeiDenHoefen neuigkeiten={neuigkeiten} jetzt={jetzt.toISOString()} />
}

/**
 * Das Gebühren-Modell zum Zeitpunkt der Seite (V62, N38): aus dem Stichtag
 * „Hofpreis-Modell ab“ (gecachte Zeile; ladeHofpreisEinstellung wirft nie und
 * fällt auf die Vorgabe zurück). „Stand am“ der Vorschau zählt wie der Bau.
 */
async function modellZu(jetzt: Date): Promise<GebuehrModell> {
  return gebuehrModellFuer(await ladeHofpreisEinstellung(), jetzt)
}

/** „So funktioniert’s“ mit dem Beispiel je Modell — im Hofpreis-Modell über bestellGebuehr (beispielRechnung, Nr. 221). */
async function SoFunktioniertsGeladen({ jetzt }: AbschnittProps) {
  return <SoFunktionierts rechnung={beispielRechnung(jetzt, BEISPIEL_WARENPREIS_CENTS, await modellZu(jetzt))} />
}

/** „Gut zu wissen“ mit „Wie bezahle ich?" je Modell. */
async function FragenGeladen({ jetzt }: AbschnittProps) {
  return <Fragen jetzt={jetzt} modell={await modellZu(jetzt)} />
}

/**
 * Die Abschnitte dieser Datei je Art (Register N16, Nr. 96): page.tsx rendert
 * die Liste aus Admin › Startseite darüber. Kopf und „Höfe in deiner Nähe"
 * stehen in eigenen Dateien und brauchen die Höfe der Seite — die rendert
 * page.tsx selbst. Die Saison-Automatik des Brennmaterial-Bands entscheidet
 * die Liste (zuRendern), nicht diese Tabelle.
 */
export const STARTSEITE_ABSCHNITTE = {
  FUTTER: () => <FutterAbschnitt />,
  BRENNMATERIAL: () => <BrennmaterialBand />,
  SO_FUNKTIONIERTS: ({ jetzt }) => <SoFunktioniertsGeladen jetzt={jetzt} />,
  FUER_HOEFE: () => <FuerHoefeBand />,
  FRAGEN: ({ jetzt }) => <FragenGeladen jetzt={jetzt} />,
  FUSS: ({ jetzt }) => <StartseiteFuss jahr={jetzt.getFullYear()} />,
  NEUIGKEITEN: ({ jetzt }) => (
    <Suspense fallback={null}>
      <NeuBeiDenHoefenGeladen jetzt={jetzt} />
    </Suspense>
  ),
} satisfies Record<Exclude<AbschnittArt, 'KOPF' | 'HOEFE'>, (props: AbschnittProps) => React.ReactNode>
