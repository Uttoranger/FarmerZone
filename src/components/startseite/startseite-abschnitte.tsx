import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { ArrowRight, ChevronDown } from 'lucide-react'
import {
  BEISPIEL_WARENPREIS_CENTS,
  BRENNMATERIAL_KARTE,
  FUTTER_KARTE,
  beispielRechnung,
  startseitenFragen,
  hoefeAdresse,
  type Beispielrechnung,
  type Frage,
  type KurzKarte,
} from '@/lib/startseite'
import type { AbschnittArt } from '@/lib/startseite-gestalten'
import { SERVICEGEBUEHR_BEZEICHNUNG, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
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
import { GEBUEHR_MODELL_HOFPREIS, gebuehrBezeichnungFuer, gebuehrModellFuer, type GebuehrModell } from '@/lib/plattformgebuehr'

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

// Inhalt 1098 px wie im Board (1440 − 2 × 171 px Rand; Liste Lauf 32, startseite 1440).
const CONTAINER = 'mx-auto max-w-[1146px] px-4 md:px-6'


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
    // Board w1-/s1-startseite Bild 3 (Liste Lauf 32): links h2 und die drei Schritte in EINER Karte (nur Titel),
    // rechts die Karte „Warum direkt vom Hof?“ mit drei Punkten und darunter das Beispiel.
    <section id="so-funktionierts" aria-labelledby="so-funktionierts-titel" className="scroll-mt-20 pb-8 md:pb-12">
      <div className={cn(CONTAINER, 'grid items-start gap-4 md:grid-cols-2')}>
        <div className="flex min-w-0 flex-col gap-2.5">
          <h2 id="so-funktionierts-titel" className="font-heading text-[22px] font-semibold text-balance">
            In drei Schritten zum Hofkorb
          </h2>
          <ol className={cn('overflow-hidden border border-border bg-card', RUNDUNG.karte)}>
            {SCHRITTE.map((schritt, i) => (
              <li key={schritt.titel} className="flex min-h-12 items-center gap-3 border-border px-3 py-2 not-first:border-t">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-status-fertig text-[14px] font-bold text-foreground"
                >
                  {i + 1}
                </span>
                <span className="text-[15px] text-foreground">{schritt.titel}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex min-w-0 flex-col gap-2.5">
          <div className={cn('flex flex-col gap-2 border border-border bg-card px-3.5 py-3', RUNDUNG.karte)}>
            <h2 className="text-[16px] font-bold text-foreground">Warum direkt vom Hof?</h2>
            <ul className="flex list-disc flex-col gap-0.5 pl-[18px] text-[14px] text-foreground">
              {warumPunkte(rechnung.modell).map((punkt) => (
                <li key={punkt}>{punkt}</li>
              ))}
            </ul>
          </div>
          <div className={cn('flex flex-col gap-2 border border-border bg-card px-3 py-2.5', RUNDUNG.karte)}>
            <h3 className="text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase">Beispiel</h3>
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
 * Die drei Punkte „Warum direkt vom Hof?“ wörtlich nach dem Board (Liste Lauf 32, startseite; V93): Im
 * Hofpreis-Modell „Der Hof setzt seinen Preis selbst.“, davor „Der Hof bekommt den vollen Preis.“ — dort kommt
 * die Gebühr für die Kundin dazu, der Hof behält seinen Preis.
 */
export function warumPunkte(modell: GebuehrModell | undefined): readonly string[] {
  return [
    'Du weißt, von welchem Hof es kommt.',
    'Kurze Wege – geerntet, gemolken, gebacken in deiner Nähe.',
    modell === 'hofpreis' ? 'Der Hof setzt seinen Preis selbst.' : 'Der Hof bekommt den vollen Preis.',
  ]
}

/**
 * Das Band „Für Höfe" — seit Nr. 252 ohne Orange: ein Umriss-Knopf „Für Höfe" auf
 * einer schlichten Karte (Liste Lauf 32, startseite Bild 3/4); der orange Knopf
 * der Hofwelt steht erst auf /fuer-hoefe. Es trägt die Sprungmarke #fuer-hoefe für die Navigation.
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

/**
 * Das Band selbst — ohne Zahlen (`gruendung` null) ohne den Satz. Seit Nr. 252 (Liste Lauf 32, startseite
 * Bild 3/4) eine schlichte Karte mit einem breiten Knopf „Für Höfe“ (→ /fuer-hoefe, dort Registrieren und
 * Konditionen). Der Satz der Gründungshöfe (K2-Ergänzung) und „Schon dabei? Anmelden“ (N1) bleiben darunter.
 */
export function FuerHoefeBandInhalt({ gruendung = null }: { gruendung?: GruendungSeiten | null }): React.JSX.Element {
  return (
    <section id="fuer-hoefe" aria-labelledby="fuer-hoefe-titel" className="scroll-mt-20 pb-8 md:pb-12">
      <div className={CONTAINER}>
        <div className={cn('flex flex-col gap-2 border border-border bg-card px-3.5 py-3', RUNDUNG.karte)}>
          <h2 id="fuer-hoefe-titel" className="text-[17px] font-bold text-foreground">
            Du hast einen Hof? Dein Hofladen, online.
          </h2>
          <GruendungSatz gruendung={gruendung} />
          <Link
            href="/fuer-hoefe"
            className={cn(
              'flex min-h-[52px] w-full items-center justify-center rounded-[14px] border-[1.5px] border-foreground bg-card px-3 text-center text-[16px] font-bold text-foreground transition-colors duration-[250ms] hover:bg-muted',
              FOKUS_RAHMEN
            )}
          >
            Für Höfe
          </Link>
          <SchonDabei />
        </div>
      </div>
    </section>
  )
}

/**
 * „Gut zu wissen" — <details name="fragen"> ohne Client-Skript; der gemeinsame `name` lässt immer nur eine
 * Frage offen. Seit Nr. 252 (Liste Lauf 32, startseite Bild 4) die drei Fragen des Boards in EINER halbbreiten
 * Karte, Überschrift als leise Überzeile; die Antworten stehen auch zugeklappt im HTML. „Wie bezahle ich?" je
 * Modell (`startseitenFragen`), die Gebühr mit dem Wort des Modells (V62), die Bestellung aus der Antwort zum Konto.
 */
export function gutZuWissen(jetzt: Date, modell: GebuehrModell, rechnung: Beispielrechnung): readonly Frage[] {
  const fragen = startseitenFragen(jetzt, modell)
  const bezahlen = fragen.find((f) => f.frage === 'Wie bezahle ich?')
  // Das Wort der Gebühr je Modell aus derselben Quelle wie Bestellungen (gebuehrBezeichnungFuer, V62).
  const wort = gebuehrBezeichnungFuer({ gebuehrModell: modell === 'hofpreis' ? GEBUEHR_MODELL_HOFPREIS : null })
  const gebuehr = {
    frage: `Was ist die ${wort}?`,
    antwort:
      modell === 'hofpreis'
        ? (rechnung.satz ?? '')
        : `Für dich kommen ${rechnung.prozent} % ${wort} dazu, mindestens ${formatEuro(centsAlsEuro(rechnung.mindestCents))} – offen ausgewiesen. Der Hof bekommt den vollen Preis.`,
  }
  return [
    ...(bezahlen ? [bezahlen] : []),
    gebuehr,
    {
      frage: 'Wo finde ich meine Bestellung?',
      antwort: 'Den Link zu deiner Bestellung bekommst du mit der Bestätigung per E-Mail. Ein Konto brauchst du dafür nicht.',
    },
  ].filter((f) => f.antwort !== '')
}

export function Fragen({
  jetzt,
  modell,
  rechnung = beispielRechnung(jetzt, BEISPIEL_WARENPREIS_CENTS, modell),
}: {
  jetzt: Date
  modell: GebuehrModell
  /** Das Beispiel der Seite — „Was ist die Plattformgebühr?“ antwortet mit seinem Satz. */
  rechnung?: Beispielrechnung
}): React.JSX.Element {
  return (
    <section aria-labelledby="fragen-titel" className="pb-14 md:pb-20">
      <div className={cn(CONTAINER, 'flex flex-col gap-2.5')}>
        <div className="flex flex-col gap-2.5 md:w-1/2 md:pr-2">
          <Kicker ton="leise" als="h2" id="fragen-titel">
            Gut zu wissen
          </Kicker>
          <div className={cn('overflow-hidden border border-border bg-card', RUNDUNG.karte)}>
            {gutZuWissen(jetzt, modell, rechnung).map((eintrag) => (
              <details key={eintrag.frage} name="fragen" className="group border-border not-first:border-t">
                <summary
                  className={cn(
                    // list-none + Marker weg: Der Pfeil rechts ersetzt das Dreieck des Browsers.
                    'flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-left text-[15px] font-semibold text-foreground hover:bg-muted [&::-webkit-details-marker]:hidden',
                    FOKUS_RAHMEN_INNEN
                  )}
                >
                  {eintrag.frage}
                  <ChevronDown
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="px-3 pb-3 text-[14px] leading-normal text-muted-foreground">{eintrag.antwort}</p>
              </details>
            ))}
          </div>
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
                        'inline-flex min-h-11 items-center rounded-md text-[13px] text-muted-foreground underline underline-offset-4 transition-colors duration-[250ms] hover:text-foreground',
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
