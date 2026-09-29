import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { LandingNav } from '@/components/landing/landing-nav'
import { hoefeLink } from '@/lib/bereiche-anzeige'
import { KONTAKT_EMAIL } from '@/lib/support'

// Futter steht im Titel und in der Beschreibung: Wer „Heu kaufen" sucht, soll
// die Startseite finden, nicht erst eine Hofseite. Open Graph sagt dasselbe,
// damit ein geteilter Link dieselbe Karte zeigt.
const SEITEN_TITEL = 'FarmerZone — Lebensmittel und Futter direkt vom Hof'
const SEITEN_BESCHREIBUNG =
  'Lebensmittel für die Küche, Heu, Stroh und Futter für den Stall — direkt von den Höfen der Region bestellen und abholen. Pilotbetrieb mit ausgewählten Höfen.'

export const metadata: Metadata = {
  title: SEITEN_TITEL,
  description: SEITEN_BESCHREIBUNG,
  openGraph: { title: SEITEN_TITEL, description: SEITEN_BESCHREIBUNG, type: 'website', siteName: 'FarmerZone' },
}

// Alle Texte als Konstanten statt als JSX-Text: so stehen die Wortlaute an
// einer Stelle, und deutsche Anführungszeichen brauchen keine HTML-Entities.

// Editorial-Zeilen „Für Höfe": Bild links / Text rechts, dann gespiegelt.
//
// Jede Zeile trägt drei Ebenen: die Kurzformel als optischen Anker, die
// Überschrift mit dem Nutzen, und darunter zwei bis drei Stichpunkte, die
// den Satz konkret machen. Die Formeln („24/7", „1×", „Planbar.") gab es
// früher schon als typografische Panels, als noch keine Fotos vorlagen —
// sie kommen hier neben dem Bild zurück, weil die Textspalte sonst neben
// der Bildfläche leer wirkt.
//
// Die Stichpunkte beschreiben ausschließlich Funktionen, die es gibt.
// Nichts davon ist ein Versprechen auf die Zukunft.
//
// AUSTAUSCH der Bilder: nur die image/alt-Zeile tauschen, sonst ändert sich
// nichts. Der alt-Text MUSS beschreiben, was tatsächlich zu sehen ist —
// beim Bildtausch also immer mit anpassen.
const FARM_BENEFITS: {
  image: string
  alt: string
  formel: string
  title: string
  desc: string
  details: string[]
}[] = [
  {
    image: '/landing/row-1.jpg',
    alt: 'Fertig gepackte Papiertüten mit Anhängern neben einem Korb mit Gemüse und Eiern',
    formel: '24/7',
    title: 'Bestellungen sammeln sich von selbst',
    desc: 'Kundinnen bestellen rund um die Uhr online; du siehst alles gebündelt nach Abholtag, mit fertiger Packliste — statt Zettel, Anrufe und Chat-Verläufe zu sortieren.',
    details: ['Nach Abholtag gruppiert', 'Fertige Packliste', 'Fertig-melden mit einem Tipp'],
  },
  {
    image: '/landing/row-2.jpg',
    alt: 'Bauer blickt im Scheunentor auf sein Telefon',
    formel: '1×',
    title: 'Einmal schreiben, alle erreichen',
    desc: 'Ein kurzes Update („Frische Eier ab Freitag") geht an alle deine Kundinnen auf einmal — statt dreißig Einzelnachrichten.',
    details: ['E-Mail an alle Kundinnen', 'WhatsApp-Erinnerung', 'Foto und Text in einem Update'],
  },
  {
    image: '/landing/row-3.jpg',
    alt: 'Beschriftete Holzkisten mit Obst und Gemüse, daneben ein aufgeschlagenes Buch',
    formel: 'Planbar.',
    title: 'Planbar statt Überraschung',
    desc: 'Feste Abholzeiten, Bestellungen im Voraus, online oder bar bezahlt: Du weißt vor dem Abholtag, was gebraucht wird.',
    details: ['Feste Abholzeiten', 'Online oder bar bezahlt', 'Bestand wird beim Bestellen reserviert'],
  },
]

// Die Sätze sind unverändert; die Kicker kommen als Orientierung hinzu.
const CUSTOMER_POINTS = [
  {
    kicker: 'Frische',
    text: 'Frisch direkt vom Hof in deiner Nähe — ohne Umweg über den Handel.',
  },
  {
    kicker: 'Deine Zeit',
    text: 'Bestellen, wann es dir passt; abholen, wenn der Hof geöffnet hat. Vorab online zahlen oder bar vor Ort.',
  },
  {
    kicker: 'Auf dem Laufenden',
    text: 'Du weißt, was es diese Woche gibt — der Hof hält dich mit kurzen Updates auf dem Laufenden.',
  },
]

const STEPS = [
  'Hof in der Nähe finden — für den Hofladen oder für Heu und Futter.',
  'Du bestellst online in wenigen Minuten.',
  'Abholen am vereinbarten Tag — fertig gepackt.',
]

// Der Kopf: ein Satz für beide Einstiege, darunter die zwei Wege. Der
// Hofladen bleibt der erste und gefüllte Knopf, Futter der zweite als Umriss.
const HERO_SATZ =
  'Lebensmittel für die Küche, Heu und Futter für den Stall — direkt von den Höfen der Region. Bestellen, abholen, fertig.'
const HERO_HOFLADEN = 'Hofladen entdecken'
const HERO_FUTTER = 'Heu & Futter finden'

// Der zweite Einstieg: Heu, Stroh und Futter. Jeder Punkt beschreibt, was es
// heute schon gibt — der Kilopreis jedes Futtermittels auf der Hofseite
// (formatGrundpreisNetto aus der Nettomenge, auch bei Ballen und Big Bag),
// die Großgebinde BALLEN und BIGBAG, die Kennzeichnung mit Zusammensetzung,
// analytischen Bestandteilen und Betriebsnummer im Produktblatt.
// Bewusst ohne Bild: Es gibt kein eigenes Heu- oder Futterfoto, und fremde
// oder Stockbilder kommen nicht auf die Seite.
const FUTTER = {
  kicker: 'Für Pferdehalter, Tierhalter und Betriebe',
  title: 'Heu, Stroh und Futter vom Nachbarhof',
  punkte: [
    'Fair vergleichen — jeder Ballen und jeder Big Bag mit Kilopreis',
    'Vom Kleinballen bis zum Big Bag',
    'Alle Angaben vor dem Kauf — Zusammensetzung, Inhaltsstoffe und Betriebsnummer stehen schon auf der Hofseite',
  ],
  knopf: 'Futter in der Nähe finden',
}

// „Für Höfe": der Futter-Verkauf als eigener Punkt unter den drei Bildzeilen
// — ohne Bild, aus demselben Grund wie oben. „Nur für Betriebe" ist die
// Abgabe NUR_BETRIEBE, die der Hof je Futtermittel wählt.
const FARM_FUTTER = 'Auch Heu und Futter verkaufen — die Pflichtangaben füllst du Schritt für Schritt aus, auf Wunsch nur für Betriebe.'

const VISION =
  'FarmerZone startet im Innviertel — Hof für Hof. Das Ziel: die Höfe einer Region an einem Ort, ' +
  'damit Direktvermarktung so einfach wird wie der Griff ins Regal — nur ehrlicher. ' +
  'Ohne Zwischenhandel, ohne Abo-Zwang, ohne Schnickschnack.'

// Überschrift + Kicker (die kleine Versalzeile darüber). Die Überschriften
// sind unverändert; die Kicker kommen neu hinzu und wiederholen sie nicht.
const SECTION_TITLES = {
  farms: { kicker: 'Dein Hofladen online', title: 'Für Höfe' },
  customers: { kicker: 'Einkaufen in der Region', title: 'Für Kundinnen und Kunden' },
  steps: { kicker: 'In drei Schritten', title: 'So funktioniert’s' },
  vision: { kicker: 'Wohin wir wollen', title: 'Unsere Vision' },
}

// Der eine Orange-Einsatz der Seite (globals.css: „Warmes Orange (CTA, max. 1× pro Seite)").
// Kundinnen haben seit der Hofübersicht einen eigenen Weg (/hoefe) — im Kopf
// seit dem Futter-Einstieg als Knopfpaar in Crème und Weiß, im CTA-Band und
// im Fuß als ruhiger Textlink, nie als zweiter Orange-Knopf.
const CTA_HEADLINE = 'Du führst einen Hof und willst dabei sein?'
const CTA_BUTTON = 'Hof anmelden'
const CTA_NOTE =
  'Registrieren dauert zwei Minuten — sichtbar wird dein Hof nach einer kurzen persönlichen Freischaltung.'
// Die Farbe, in die der Hero unten ausläuft — und zugleich die Farbe, die der
// Seitenhintergrund an dieser Stelle bereits erreicht hat. EINE Konstante für
// beide, sonst entsteht genau die sichtbare Kante, die es vorher gab.
//
// Warum nicht var(--color-background): Der Hintergrund unter dem Hero ist nicht
// das Token, sondern der eigene Verlauf dieses Containers. Nachgemessen lag er
// dort bei #e8f0e7 (links) bis #f3f6f1 (rechts) — das Token ist mit #F7F2E7 ein
// warmes Creme und hätte eine andere, wärmere Kante erzeugt. Der Verlauf läuft
// deshalb jetzt senkrecht (180deg statt 160deg, keine seitliche Wanderung mehr)
// und hat diese Farbe schon bei 55% der ersten Bildschirmhöhe erreicht — also
// deutlich oberhalb der Hero-Unterkante bei 70vh. Damit trifft die Ausblendung
// auf jeder Breite exakt denselben Ton.
//
// Der Wert selbst steht seit dem Dark Mode in globals.css als --landing-base
// (Tag: unverändert #EDF2EB, Nacht: der dunkle Grund). Hier bleibt nur der
// Verweis — so bleiben Verlauf, Auslauf und Grundfarbe eine einzige Quelle.
const SEITEN_HINTERGRUND = 'var(--landing-base)'
// Die klebende Leiste lebt in ihrer eigenen Datei (Client-Insel: sie hört auf
// Scrollen und trägt das Menü) — die Startseite selbst bleibt eine Server-Seite.

const CTA_MAILTO = `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent('Mein Hof auf FarmerZone')}`

/** Kleine Versalzeile über einer Überschrift. `tone` für das dunkle Vision-Band und das Waldgrün-Band. */
function Kicker({ children, tone = 'dark' }: { children: string; tone?: 'dark' | 'light' | 'wald' }) {
  return (
    <p
      className={`mb-3 text-xs font-semibold uppercase tracking-[0.18em] ${
        // tone="light" steht auf dem Foto-Band und bleibt in beiden Modi weiß.
        tone === 'light' ? 'text-white/75' : tone === 'wald' ? 'text-landing-wald-ink/75' : 'text-muted-foreground'
      }`}
    >
      {children}
    </p>
  )
}

/**
 * Ein Punkt in der Form „Stichwort — Erklärung": das Stichwort hervorgehoben,
 * der Satz im Wortlaut. Ohne Gedankenstrich ist der ganze Punkt das Stichwort.
 */
function Punkt({ text, tone }: { text: string; tone: 'seite' | 'wald' }) {
  const trenner = text.indexOf(' — ')
  const stichwort = trenner === -1 ? text : text.slice(0, trenner)
  const rest = trenner === -1 ? '' : text.slice(trenner)
  return (
    <p className={`text-base leading-relaxed ${tone === 'wald' ? 'text-landing-wald-ink/80' : 'text-muted-foreground'}`}>
      <strong className={`font-semibold ${tone === 'wald' ? 'text-landing-wald-ink' : 'text-foreground'}`}>
        {stichwort}
      </strong>
      {rest}
    </p>
  )
}

function SectionHeading({ kicker, children }: { kicker: string; children: string }) {
  return (
    <div className="mb-12">
      <Kicker>{kicker}</Kicker>
      <h2 className="font-heading text-3xl md:text-5xl font-semibold text-foreground text-balance">
        {children}
      </h2>
      <span className="mt-6 block h-px w-12 rounded-full bg-landing-green" />
    </div>
  )
}

/**
 * Editorial-Bild einer „Für Höfe"-Zeile.
 *
 * Festes Seitenverhältnis statt `h-full`: Die Zeile ist vertikal mittig
 * statt gestreckt, das Bild kann seine Höhe also nicht vom Textblock
 * beziehen. Ein fester Wert hält die Zeile beim Laden ruhig.
 *
 * 16:10 (1,6) statt der früheren 3:2 (1,5): Die Dateien liegen bei 1,491, es
 * wird also rund 7% der Höhe beschnitten — bei diesen mittig aufgebauten
 * Motiven unkritisch. Der flachere Zuschnitt bringt Bild- und Texthöhe näher
 * zusammen; mit 3:2 stand das Bild in zwei von drei Zeilen 63px über dem
 * Text, jetzt sind es höchstens 37px in die eine oder andere Richtung.
 *
 * Bewusst OHNE `priority`: LCP-Kandidat bleibt der Hero ganz oben. Diese drei
 * Bilder stehen unter dem Falz und laden verzögert (next/image-Standard).
 */
function RowImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl">
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 540px, (min-width: 768px) 50vw, 100vw"
        className="object-cover"
      />
    </div>
  )
}

/**
 * Eine Editorial-Zeile: Bild und Text nebeneinander, ab md abwechselnd
 * gespiegelt. `items-center` statt `items-stretch` — die beiden Hälften sind
 * jetzt zwei ruhige Blöcke nebeneinander, nicht zwei gleich hohe Kacheln.
 *
 * Die Textspalte trägt drei Ebenen: Kurzformel, Überschrift, Beschreibung —
 * darunter die Stichpunkte. Zusammen füllen sie die Spalte so weit, dass sie
 * neben dem Bild nicht mehr leer wirkt; vorher standen dort nur Überschrift
 * und zwei Zeilen neben einer deutlich höheren Bildfläche.
 *
 * Der Spaltenabstand ist enger als zuvor (md:gap-12 lg:gap-16 statt
 * md:gap-16 lg:gap-20), damit Bild und Text als Paar gelesen werden.
 */
function FarmRow({
  media,
  formel,
  title,
  desc,
  details,
  flip,
}: {
  media: ReactNode
  formel: string
  title: string
  desc: string
  details: string[]
  flip: boolean
}) {
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
      <div className={flip ? 'md:order-2' : undefined}>{media}</div>
      <div className={flip ? 'md:order-1' : undefined}>
        {/* Optischer Anker der Zeile: groß genug, um die Spalte zu tragen,
            klar kleiner als die Abschnitts-Überschrift. */}
        <p className="font-heading text-3xl md:text-4xl font-semibold leading-none mb-3 text-muted-foreground">
          {formel}
        </p>
        <h3 className="font-heading text-2xl md:text-3xl font-semibold text-foreground mb-4 text-balance">
          {title}
        </h3>
        <p className="max-w-prose text-base leading-relaxed text-muted-foreground">{desc}</p>
        {/* Bewusst ohne Icons und ohne Aufzählungszeichen — nur feine
            Trennlinien, damit die Liste ruhig bleibt und nichts verspricht,
            was sie nicht hält. */}
        <ul className="mt-6 max-w-prose border-t border-border/60">
          {details.map((d) => (
            <li
              key={d}
              className="border-b border-border/60 py-2.5 text-sm text-muted-foreground"
            >
              {d}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      // Der Verlauf ist bewusst auf die erste Bildschirmhöhe festgenagelt: als
      // Element-Verlauf hätte er sich über die nun viel längere Seite gestreckt
      // und den Hero-Hintergrund verändert. Darunter läuft seine Endfarbe weiter.
      style={{
        backgroundImage: `linear-gradient(180deg, var(--landing-top) 0%, ${SEITEN_HINTERGRUND} 55%)`,
        backgroundSize: '100% 100vh',
        backgroundRepeat: 'no-repeat',
        backgroundColor: SEITEN_HINTERGRUND,
      }}
    >
      {/* Klebende Navigationsleiste: Logo, die drei Wege und der Login —
          unter md hinter einer Menü-Schaltfläche (landing-nav.tsx). */}
      <LandingNav />

      <main className="flex-1">

        {/* Hero — Ambient-Feld-Loop in drei Schichten:
            (1) Standbild als Basis — immer da, damit es die Mobil- und die
                Reduced-Motion-Darstellung ist und als LCP-Kandidat zählt;
            (2) darüber der Loop, rein per CSS eingeblendet (kein Autoplay-JS);
            (3) darüber der Verlauf, der die weiße Schrift lesbar hält. */}
        {/* Mindestens 70 % der Bildschirmhöhe, aber mit dem Inhalt wachsend:
            Seit Satz und zwei Knöpfe darin stehen, wäre er auf kleinen Handys
            oben abgeschnitten worden (overflow-hidden). Der Seitenverlauf hat
            seine Endfarbe bei 55 % erreicht — ein höherer Hero trifft sie genauso. */}
        <section className="relative flex min-h-[max(70vh,420px)] w-full flex-col justify-end overflow-hidden">
          <Image
            src="/landing/hero-poster.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />

          {/* Der Loop läuft auf ALLEN Breiten, aber nur bei erlaubter Bewegung.
              Die Weiche ist reines Tailwind bzw. eine media-Bedingung an der
              <source> — kein JavaScript. Beides muss dieselbe Bedingung tragen:
              die Klasse blendet das Element ein, die media-Bedingung entscheidet,
              ob überhaupt eine Quelle geladen wird. Rein dekorativ, deshalb
              aria-hidden und ohne Tonspur/Controls.

              preload="none": Das Standbild darüber ist der LCP-Kandidat und soll
              zuerst da sein; das Video holt sich der Browser erst, wenn das
              Autoplay anläuft. */}
          <video
            className="absolute inset-0 hidden h-full w-full object-cover motion-safe:block"
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster="/landing/hero-poster.jpg"
            aria-hidden="true"
          >
            <source
              media="(prefers-reduced-motion: no-preference)"
              src="/landing/hero-loop.mp4"
              type="video/mp4"
            />
          </video>

          {/* Verlauf von unten/links über beide Schichten */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/25 via-45% to-transparent"
          />

          {/* Weicher Auslauf in den Sand-Hintergrund statt harter Kante.
              Der Farbwert entspricht dem Seitenverlauf am unteren Hero-Rand
              (der Verlauf hat seine Endfarbe schon bei 55vh erreicht, der
              Hero endet frühestens bei 70vh); die Deckkraft steigt erst ganz
              unten spürbar, damit der weiße Scroll-Pfeil darüber lesbar bleibt. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-40 md:h-56"
            style={{
              background: `linear-gradient(to bottom, transparent 0%, color-mix(in srgb, ${SEITEN_HINTERGRUND} 15%, transparent) 55%, color-mix(in srgb, ${SEITEN_HINTERGRUND} 60%, transparent) 80%, ${SEITEN_HINTERGRUND} 94%)`,
            }}
          />

          {/* Headline unverändert; der Satz darunter nennt seit dem
              Futter-Einstieg beide Wege, und die zwei Knöpfe führen hinein. */}
          <div className="relative px-6 pt-24 pb-20 md:pb-24">
            {/* Derselbe zentrierte Container wie die Abschnitte darunter, damit
                Headline und Inhalt auf einer gemeinsamen linken Kante stehen. */}
            <div className="mx-auto w-full max-w-6xl">
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-semibold text-white mb-4 leading-tight max-w-2xl text-balance">
                Frisch vom Hof.<br />Direkt zu dir.
              </h1>
              <p className="text-lg text-white/90 max-w-lg leading-relaxed">{HERO_SATZ}</p>
              {/* Kein Orange: Das gehört einmal pro Seite dem Band „Hof
                  anmelden". Der Hofladen ist der gefüllte Knopf (Crème mit
                  Waldgrün), Futter der Umriss. Beide stehen auf dem Foto und
                  folgen dem Modus deshalb nicht — der Umriss bleibt weiß. */}
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={hoefeLink('LEBENSMITTEL')}
                  className="inline-flex min-h-12 items-center rounded-full bg-landing-wald-ink px-6 text-sm font-semibold text-landing-wald transition-[transform,opacity] duration-[250ms] ease-out hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0"
                >
                  {HERO_HOFLADEN}
                </Link>
                <Link
                  href={hoefeLink('FUTTERMITTEL')}
                  className="inline-flex min-h-12 items-center rounded-full border border-white/80 px-6 text-sm font-semibold text-white transition-colors duration-[250ms] hover:bg-white/10"
                >
                  {HERO_FUTTER}
                </Link>
              </div>
            </div>
          </div>

          {/* Scroll-Hinweis: pulsiert langsam, steht bei Reduced Motion still */}
          <a
            href="#weiter"
            aria-label="Weiter zum Inhalt"
            className="absolute bottom-5 left-1/2 flex size-11 -translate-x-1/2 items-center justify-center rounded-full text-white/85 transition-colors hover:text-white"
          >
            <ChevronDown
              className="size-7 motion-safe:animate-pulse motion-safe:[animation-duration:3s]"
              strokeWidth={1.75}
              aria-hidden="true"
            />
          </a>
        </section>

        {/* A — Für Höfe: abwechselnde Editorial-Zeilen statt Karten.
            Trägt jetzt id="weiter" — das ist das Ziel des Scroll-Pfeils im
            Hero; es saß vorher auf dem entfernten Karten-Block. */}
        {/* scroll-mt-20: Die klebende Leiste ist 56 px hoch — ohne diesen
            Abstand verdeckte sie beim Sprung die Überschrift. */}
        <section id="weiter" className="scroll-mt-20 px-6 pt-14 pb-20 md:pt-20 md:pb-28">
          <div className="mx-auto max-w-6xl">
            {/* Pilot-Hinweis, Wortlaut unverändert — steht jetzt hier oben,
                mittig und mit Luft, damit der Übergang aus dem Hero ruhig
                bleibt und der Abschnitt trotzdem sofort beginnt. */}
            <div className="mb-14 flex justify-center md:mb-20">
              <span className="inline-flex items-center gap-2 bg-card/80 border border-border rounded-full px-3.5 py-1.5 text-xs text-muted-foreground">
                <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                Pilotbetrieb mit ausgewählten Höfen
              </span>
            </div>

            <SectionHeading kicker={SECTION_TITLES.farms.kicker}>
              {SECTION_TITLES.farms.title}
            </SectionHeading>
            <div className="space-y-16 md:space-y-24">
              {FARM_BENEFITS.map((row, i) => (
                <FarmRow
                  key={row.title}
                  flip={i % 2 === 1}
                  title={row.title}
                  desc={row.desc}
                  formel={row.formel}
                  details={row.details}
                  media={<RowImage src={row.image} alt={row.alt} />}
                />
              ))}
            </div>
            {/* Der Futter-Verkauf als ruhiger Punkt unter den Bildzeilen —
                ohne Bild, mit denselben feinen Linien wie die Stichpunkte. */}
            <div className="mt-16 max-w-3xl border-y border-border/60 py-6 md:mt-24">
              <Punkt text={FARM_FUTTER} tone="seite" />
            </div>
          </div>
        </section>

        {/* B — Für Kundinnen und Kunden: ruhige Typo-Reihe, keine Bilder */}
        <section className="px-6 pb-20 md:pb-28">
          <div className="mx-auto max-w-6xl">
            <SectionHeading kicker={SECTION_TITLES.customers.kicker}>
              {SECTION_TITLES.customers.title}
            </SectionHeading>
            <ul className="grid gap-10 md:grid-cols-3 md:gap-12">
              {CUSTOMER_POINTS.map(({ kicker, text }) => (
                <li key={kicker}>
                  <Kicker>{kicker}</Kicker>
                  <p className="text-base leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* C — So funktioniert’s: große Ziffern statt Karten */}
        <section className="px-6 pb-20 md:pb-28">
          <div className="mx-auto max-w-6xl">
            <SectionHeading kicker={SECTION_TITLES.steps.kicker}>
              {SECTION_TITLES.steps.title}
            </SectionHeading>
            <ol className="grid gap-10 md:grid-cols-3 md:gap-12">
              {STEPS.map((text, i) => (
                <li key={text} className="md:relative">
                  {/* dezente Verbindungslinie zwischen den Schritten (ab md) */}
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="hidden md:block absolute left-16 right-0 top-7 h-px bg-border"
                    />
                  )}
                  <span className="relative font-heading text-5xl md:text-6xl font-semibold leading-none text-landing-green">
                    {i + 1}
                  </span>
                  <p className="mt-5 text-base leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* C2 — Heu und Futter: der zweite Einstieg, als Waldgrün-Band.
            Ein gerundeter Block statt eines vollbreiten Bands: Direkt darunter
            folgt die Vision als dunkles Foto-Band, zwei vollbreite dunkle
            Flächen hintereinander wären eine Wand. Ohne Bild (siehe FUTTER).
            Der Knopf ist Crème auf Waldgrün, kein Orange — das gehört dem
            Band „Hof anmelden". */}
        <section className="px-6 pb-20 md:pb-28">
          {/* Nachts trägt der Rahmen die Abgrenzung (CODING_STANDARDS §7, Tiefe). */}
          <div className="mx-auto max-w-6xl rounded-3xl bg-landing-wald px-6 py-12 sm:px-10 md:px-14 md:py-16 dark:ring-1 dark:ring-border">
            <Kicker tone="wald">{FUTTER.kicker}</Kicker>
            <h2 className="font-heading text-3xl md:text-5xl font-semibold text-landing-wald-ink text-balance">
              {FUTTER.title}
            </h2>
            <span className="mt-6 block h-px w-12 rounded-full bg-landing-green" />
            <ul className="mt-10 grid gap-6 md:grid-cols-3 md:gap-10">
              {FUTTER.punkte.map((punkt) => (
                <li key={punkt} className="border-t border-landing-wald-ink/20 pt-4">
                  <Punkt text={punkt} tone="wald" />
                </li>
              ))}
            </ul>
            <Link
              href={hoefeLink('FUTTERMITTEL')}
              className="mt-10 inline-flex min-h-12 items-center gap-2 rounded-full bg-landing-wald-ink px-7 text-sm font-semibold text-landing-wald transition-[transform,opacity] duration-[250ms] ease-out hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0"
            >
              {FUTTER.knopf}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* D — Vision als vollbreites Foto-Band, Bild rein dekorativ.
            Motiv ist corn-2: die Weitaufnahme des Getreidefelds mit Horizont.
            Ein vollbreites Band braucht Tiefe und eine ruhige Fläche; eine
            Nahaufnahme wird auf dieser Breite zur Textur ohne Motiv.
            NICHT row-2 — das zeigt seit dem Bildtausch einen Bauern im
            Scheunentor und wird oben als Bildzeile verwendet; als Band hinter
            Text würde die Person angeschnitten und vom Overlay verdeckt.
            Auch nicht hero-poster: dasselbe Motiv wie ganz oben.
            corn-1/corn-3: ungenutzte Reserve-Standbilder aus dem Hero-Clip —
            sie bleiben als dokumentierte Tausch-Kandidaten liegen. */}
        <section className="relative isolate overflow-hidden py-24 md:py-32 mb-20 md:mb-28">
          <Image
            src="/landing/corn-2.jpg"
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            className="-z-10 object-cover"
          />
          {/* Schleier über dem Foto — bleibt in beiden Modi gleich dunkel:
              das Bild wird nicht abgedunkelt, nur die Schrift lesbar gehalten. */}
          <div aria-hidden="true" className="absolute inset-0 -z-10" style={{ backgroundColor: 'rgba(20,30,22,0.66)' }} />
          <div className="mx-auto max-w-3xl px-6 text-center">
            <Kicker tone="light">{SECTION_TITLES.vision.kicker}</Kicker>
            <h2 className="font-heading text-3xl md:text-5xl font-semibold text-white mb-6 text-balance">
              {SECTION_TITLES.vision.title}
            </h2>
            <p className="font-heading text-lg md:text-2xl leading-relaxed text-white/90 text-balance">
              {VISION}
            </p>
          </div>
        </section>

        {/* E — CTA-Band: der eine Orange-Einsatz der Seite */}
        <section className="px-6 pb-16 sm:pb-20">
          <div className="mx-auto max-w-4xl rounded-3xl bg-accent px-6 py-10 sm:px-10 sm:py-12 text-center">
            <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-accent-foreground mb-6 text-balance">
              {CTA_HEADLINE}
            </h2>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-full bg-card px-7 py-3.5 text-sm font-semibold text-primary transition-[transform,opacity] duration-[250ms] ease-out hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0"
            >
              {CTA_BUTTON}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            {/* Zweitlink, bewusst als Textlink: Der Orange-Akzent gehört dem
                Register-Knopf darüber, ein zweiter Knopf würde ihn entwerten.
                Wer erst nachlesen will, was es kostet, findet hier den Weg. */}
            <p className="mt-4">
              <Link
                href="/konditionen"
                className="inline-flex min-h-11 items-center text-sm font-medium text-accent-foreground/90 underline underline-offset-4 transition-opacity hover:opacity-80"
              >
                Konditionen ansehen
              </Link>
            </p>
            <p className="mt-1 mx-auto max-w-md text-sm leading-relaxed text-accent-foreground/80">
              {CTA_NOTE}
            </p>
            {/* Wer vor der Registrierung ein persönliches Wort will, bekommt
                den alten Weg als leise Zeile — CTA_MAILTO lebt hier weiter. */}
            <p className="mt-1">
              <a
                href={CTA_MAILTO}
                className="inline-flex min-h-11 items-center text-sm font-medium text-accent-foreground/90 underline underline-offset-4 transition-opacity hover:opacity-80"
              >
                Fragen vorab? Schreib uns.
              </a>
            </p>
          </div>
          {/* Der Kunden-Einstieg unter dem Band: Wer hier landet, aber
              einkaufen will, bekommt den ruhigen Zweitweg zur Übersicht —
              der Orange-Akzent bleibt allein beim Registrieren-Knopf. */}
          <p className="mx-auto mt-6 max-w-4xl text-center text-sm text-muted-foreground">
            Du willst einkaufen?{' '}
            <Link
              href="/hoefe"
              className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-80"
            >
              Höfe ansehen
            </Link>
          </p>
        </section>
      </main>

      <footer className="py-6 px-6 border-t border-border/50">
        <div className="max-w-2xl mx-auto flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} FarmerZone</span>
          <Link href="/hoefe" className="hover:text-foreground transition-colors duration-[250ms]">
            Höfe ansehen
          </Link>
          <Link href="/impressum" className="hover:text-foreground transition-colors duration-[250ms]">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-foreground transition-colors duration-[250ms]">
            Datenschutz
          </Link>
          <Link href="/problem-melden" className="hover:text-foreground transition-colors duration-[250ms]">
            Problem melden
          </Link>
        </div>
      </footer>
    </div>
  )
}
