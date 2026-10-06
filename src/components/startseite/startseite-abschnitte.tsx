import Image from 'next/image'
import Link from 'next/link'
import { Check, ChevronDown, HandCoins, MapPin } from 'lucide-react'
import {
  BRENNMATERIAL_ADRESSE,
  FUTTER_ZIELGRUPPEN,
  STARTSEITE_FRAGEN,
  hoefeAdresse,
  type Beispielrechnung,
} from '@/lib/startseite'
import { BRENNMATERIAL_SAISON_TEXT } from '@/lib/brennmaterial-saison'
import { SERVICEGEBUEHR_BEZEICHNUNG, centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { categoryImagePath } from '@/lib/product-image'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { StatusBadge } from '@/components/ui/status-badge'
import { Wortmarke } from '@/components/shared/wortmarke'
import { Kicker } from '@/components/startseite/kicker'

/*
 * Die Abschnitte der Startseite unter „Höfe in deiner Nähe", in der Reihenfolge
 * des Mockups (web-k0-startseite, mobil-k0-startseite): Futter vom Hof,
 * Brennmaterial (nur in der Saison), So funktioniert's + Warum direkt vom Hof,
 * Für Höfe, Fragen, Fuß. Alles Server-Komponenten ohne eigenes Skript — auch
 * die Fragen: <details> klappt der Browser selbst auf und zu.
 *
 * Texte, Links und Rechnungen kommen aus src/lib/startseite.ts.
 */

const CONTAINER = 'mx-auto max-w-[1200px] px-4 md:px-6'
const H2 = 'font-heading text-[22px] font-semibold text-balance md:text-[32px]'

/** Der grüne Handlungsknopf der Kundenwelt — als Link, denn er führt woanders hin. */
const KNOPF_GRUEN = cn(
  'inline-flex h-11 items-center justify-center rounded-full bg-accent px-[18px] text-sm font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
  FOKUS_RAHMEN
)
const KNOPF_UMRISS = cn(
  'inline-flex h-11 items-center justify-center rounded-full border border-border px-[18px] text-sm font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted md:h-[46px]',
  FOKUS_RAHMEN
)

/**
 * Eine Kategorie-Illustration (public/categories/): Sie hat einen hellen
 * Crème-Grund und ist kein Foto — nachts gedämpft und gerahmt statt
 * leuchtend (CODING_STANDARDS §7).
 */
function Illustration({ src, sizes, className }: { src: string | null; sizes: string; className?: string }) {
  return (
    <span className={cn('relative block overflow-hidden bg-muted dark:ring-1 dark:ring-border', className)}>
      {src && <Image src={src} alt="" fill sizes={sizes} className="object-cover dark:brightness-[0.78] dark:saturate-[0.9]" />}
    </span>
  )
}

export function FutterAbschnitt(): React.JSX.Element {
  return (
    <section aria-labelledby="futter-titel" className="pt-5 pb-[52px] md:pb-[72px]">
      <div className={cn(CONTAINER, 'flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-10')}>
        <div className="flex flex-col justify-center gap-3.5 lg:w-[360px] lg:shrink-0">
          <Kicker>Futter vom Hof</Kicker>
          <h2 id="futter-titel" className={H2}>
            Heu, Stroh und Futter – vom Sackerl bis zum Rundballen
          </h2>
          <p className="text-[13.5px] leading-normal text-muted-foreground md:text-[15px]">
            Frisch aus der Region statt aus dem Zoohandel. Kleine Mengen für Kleintiere, Ballen für Pferde und Nutztiere
            – mit Preis pro kg zum Vergleichen.
          </p>
        </div>
        <ul className="grid flex-1 gap-3 sm:grid-cols-2 md:gap-4">
          {FUTTER_ZIELGRUPPEN.map((gruppe) => (
            <li key={gruppe.knopf} className="flex flex-col overflow-hidden rounded-[20px] border border-border bg-card">
              <Illustration
                src={categoryImagePath(gruppe.bild)}
                sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                className="h-[120px] w-full dark:ring-0"
              />
              <div className="flex flex-1 flex-col gap-2.5 p-[18px]">
                <Kicker>{gruppe.kicker}</Kicker>
                <h3 className="text-lg font-semibold">{gruppe.titel}</h3>
                <ul className="flex flex-col gap-2">
                  {gruppe.punkte.map((punkt) => (
                    <li key={punkt} className="flex items-center gap-2 text-[13.5px] text-foreground">
                      <Check className="size-4 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
                      {punkt}
                    </li>
                  ))}
                </ul>
                <span className="flex-1" />
                <Link href={hoefeAdresse(gruppe.filter)} className={cn(KNOPF_GRUEN, 'mt-1 self-start')}>
                  {gruppe.knopf}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/**
 * Das Brennmaterial-Band — die Seite zeigt es nur in der Saison
 * (istBrennmaterialSaison, Oktober bis März in Wiener Zeit). Raummeter und
 * Schüttraummeter werden beim ersten Vorkommen erklärt (DESIGN_SYSTEM,
 * „Futtermittel und Brennmaterial").
 */
export function BrennmaterialBand(): React.JSX.Element {
  return (
    <section aria-labelledby="brennmaterial-titel" className="pb-[52px] md:pb-[72px]">
      <div className={CONTAINER}>
        <div className="flex flex-col gap-4 rounded-[22px] border border-border bg-card p-4 md:flex-row md:items-center md:gap-7 md:px-[26px] md:py-[22px]">
          <div className="flex items-center gap-3 md:contents">
            <Illustration src={categoryImagePath('BRENNHOLZ')} sizes="110px" className="size-[70px] shrink-0 rounded-[14px] md:size-[110px]" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <Kicker>Brennmaterial vom Hof</Kicker>
                <StatusBadge status="neutral">{BRENNMATERIAL_SAISON_TEXT}</StatusBadge>
              </div>
              <h2 id="brennmaterial-titel" className="font-heading text-lg font-semibold text-balance md:text-2xl">
                Brennholz und Hackschnitzel aus dem eigenen Wald
              </h2>
              <p className="hidden text-sm leading-normal text-muted-foreground md:block">
                Ofenfertiges Brennholz im Sack oder als Raummeter (ein Kubikmeter geschichtetes Holz), Hackschnitzel für
                die Hackschnitzelheizung pro Schüttraummeter (ein Kubikmeter lose geschüttet).
              </p>
            </div>
          </div>
          <Link href={BRENNMATERIAL_ADRESSE} className={cn(KNOPF_GRUEN, 'w-full shrink-0 rounded-[14px] md:w-auto md:rounded-full')}>
            Brennmaterial finden
          </Link>
        </div>
      </div>
    </section>
  )
}

const SCHRITTE = [
  { titel: 'Hof finden', text: 'Such nach Ort oder Produkt. Du siehst sofort, was es gibt und wann du abholen kannst.' },
  {
    titel: 'Bestellen und Zeitfenster wählen',
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
              <p className="text-[13px] leading-normal text-muted-foreground">
                Für dich kommen {rechnung.prozent} % {SERVICEGEBUEHR_BEZEICHNUNG} dazu, mindestens{' '}
                {formatEuro(centsAlsEuro(rechnung.mindestCents))} – offen ausgewiesen.
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
            <p className="text-[11px] font-semibold tracking-[1.1px] text-muted-foreground uppercase">Beispiel</p>
            <dl className="flex flex-col gap-3">
              <Zeile name="Warenpreis" betrag={rechnung.warenpreisCents} />
              <Zeile name={`${SERVICEGEBUEHR_BEZEICHNUNG} · ${rechnung.prozent} %`} betrag={rechnung.gebuehrCents} />
              <Zeile name="Du zahlst" betrag={rechnung.duZahlstCents} stark trenner />
              <Zeile name="Der Hof bekommt" betrag={rechnung.hofBekommtCents} stark gruen />
            </dl>
            <p className="text-xs leading-normal text-muted-foreground">Egal ob online oder bar bei Abholung.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * Das Band „Für Höfe" — der eine orange Knopf der Seite (Hofwelt, DESIGN_SYSTEM
 * „Farbrollen"). Es trägt die Sprungmarke #fuer-hoefe für die Navigation.
 * „Mehr für Höfe" führt zu den Konditionen, bis es eine eigene Seite für Höfe
 * gibt (Mockup web-h0-fuer-hoefe, noch nicht gebaut). Preise nennt das Band
 * keine (E6: dann nur die beschlossenen Tarife).
 */
export function FuerHoefeBand(): React.JSX.Element {
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
              Schnell eingerichtet. Kunden bestellen vorab, du packst und übergibst – und behältst den vollen
              Warenpreis.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 md:flex-row">
            <Link href="/konditionen" className={cn(KNOPF_UMRISS, 'rounded-[14px] md:rounded-full')}>
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
export function Fragen(): React.JSX.Element {
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
          {STARTSEITE_FRAGEN.map((eintrag, i) => (
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

const FUSS_SPALTEN = [
  {
    titel: 'FarmerZone',
    links: [
      { href: hoefeAdresse(), text: 'Höfe entdecken' },
      { href: '/#so-funktionierts', text: 'So funktioniert’s' },
      { href: '/problem-melden', text: 'Problem melden' },
    ],
  },
  {
    titel: 'Für Höfe',
    links: [
      { href: '/register', text: 'Hof registrieren' },
      // Die Anmeldung der Höfe stand bisher in der Kopfleiste der Startseite
      // („Hofbetreiber-Login"); die KundeShell führt zur Kunden-Anmeldung,
      // also bleibt der Weg der Höfe hier.
      { href: '/login', text: 'Anmelden für Höfe' },
      { href: '/konditionen', text: 'Konditionen' },
    ],
  },
  {
    titel: 'Rechtliches',
    links: [
      { href: '/impressum', text: 'Impressum' },
      { href: '/datenschutz', text: 'Datenschutz' },
    ],
  },
] as const

export function StartseiteFuss({ jahr }: { jahr: number }): React.JSX.Element {
  return (
    <footer className="border-t border-border py-10 md:pt-10 md:pb-[46px]">
      <div className={cn(CONTAINER, 'flex flex-col gap-8 md:flex-row md:gap-[70px]')}>
        <div className="flex flex-col gap-2.5 md:w-[300px]">
          <Wortmarke />
          <p className="text-[13px] leading-normal text-muted-foreground">
            Regional einkaufen, direkt beim Hof abholen. Aus Österreich, für Österreich.
          </p>
          <p className="text-xs text-muted-foreground">© {jahr} FarmerZone</p>
        </div>
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:flex md:gap-[70px]">
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
