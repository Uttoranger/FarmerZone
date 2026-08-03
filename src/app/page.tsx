import type { ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { Leaf, ShoppingBasket, Users, ArrowRight, ChevronDown } from 'lucide-react'
import { KONTAKT_EMAIL } from '@/lib/support'

export const metadata: Metadata = {
  title: 'FarmerZone — Regionale Lebensmittel direkt vom Bauern',
  description: 'Regionale Lebensmittel direkt vom Bauern bestellen und abholen. Pilotbetrieb mit ausgewählten Höfen.',
}

// Alle Texte als Konstanten statt als JSX-Text: so stehen die Wortlaute an
// einer Stelle, und deutsche Anführungszeichen brauchen keine HTML-Entities.

// Editorial-Zeilen „Für Höfe": Medium links / Text rechts, dann gespiegelt.
// Jede Zeile trägt ein typografisches Panel — bewusst KEINE Fotos, solange
// keine in guter Qualität existieren. Das Panel-Motiv greift die Aussage der
// Zeile auf (rund um die Uhr / einmal statt dreißigmal / Planbarkeit).
//
// AUSTAUSCH-KONVENTION: Sobald ein echtes Foto vorliegt, wird aus
//     { panel: '24/7', … }
// ein
//     { image: '/landing/row-hoefe.jpg', alt: '…', … }
// — eine Zeile in den Daten, sonst ändert sich nichts: <FarmRow> rendert
// Panel und Foto über dieselbe Zeilen-Geometrie, <RowImage> steht bereit.
// Dateinamen der Reihe nach: row-hoefe.jpg, row-hoefe-2.jpg, row-hoefe-3.jpg.
//
// QUALITÄTSLATTE für solche Fotos: Tageslicht, ruhiger Hintergrund, EIN
// Motiv. Ein Schnappschuss mit unruhigem Umfeld ist schlechter als das
// Panel — im Zweifel bleibt das Panel stehen.
type FarmRowMedia = { panel: string } | { image: string; alt: string }

const FARM_BENEFITS: (FarmRowMedia & { title: string; desc: string })[] = [
  {
    panel: '24/7',
    title: 'Bestellungen sammeln sich von selbst',
    desc: 'Kundinnen bestellen rund um die Uhr online; du siehst alles gebündelt nach Abholtag, mit fertiger Packliste — statt Zettel, Anrufe und Chat-Verläufe zu sortieren.',
  },
  {
    panel: '1×',
    title: 'Einmal schreiben, alle erreichen',
    desc: 'Ein kurzes Update („Frische Eier ab Freitag") geht an alle deine Kundinnen auf einmal — statt dreißig Einzelnachrichten.',
  },
  {
    panel: 'Planbar.',
    title: 'Planbar statt Überraschung',
    desc: 'Feste Abholzeiten, Bestellungen im Voraus, online oder bar bezahlt: Du weißt vor dem Abholtag, was gebraucht wird.',
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
  'Der Hof teilt seinen persönlichen Link (WhatsApp, Aushang, Marktstand).',
  'Du bestellst online in wenigen Minuten.',
  'Abholen am vereinbarten Tag — fertig gepackt.',
]

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
// Kein zweiter CTA für Kundinnen — die kommen über den Link ihres Hofes.
const CTA_HEADLINE = 'Du führst einen Hof und willst dabei sein?'
const CTA_BUTTON = 'Hof anmelden'
const CTA_NOTE =
  'Die Registrierung läuft mit einem persönlichen Einladungscode — schreib uns kurz, dann melden wir uns bei dir.'
const CTA_MAILTO = `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent('Mein Hof auf FarmerZone')}`

/** Kleine Versalzeile über einer Überschrift. `tone` für das dunkle Vision-Band. */
function Kicker({ children, tone = 'dark' }: { children: string; tone?: 'dark' | 'light' }) {
  return (
    <p
      className="mb-3 text-xs font-semibold uppercase tracking-[0.18em]"
      style={{ color: tone === 'light' ? 'rgba(255,255,255,0.75)' : '#4F6F57' }}
    >
      {children}
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
      <span className="mt-6 block h-px w-12 rounded-full" style={{ backgroundColor: '#7BAE85' }} />
    </div>
  )
}

/** Editorial-Bild einer „Für Höfe"-Zeile — bereit für den Austausch gegen ein Panel. */
function RowImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-full min-h-44 overflow-hidden rounded-2xl">
      <Image src={src} alt={alt} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
    </div>
  )
}

/**
 * Typografisches Panel — ruhige Sand-Fläche mit einem großen Fraunces-Motiv.
 * Bewusst ohne Icons und Emojis.
 *
 * `h-full` statt fester Höhe: Die Zeile ist auf `items-stretch` gestellt, also
 * bestimmt der Textblock die Zeilenhöhe und das Panel füllt sie genau aus. So
 * kann es auf Desktop nie höher werden als der Text daneben; `min-h-24` ist
 * nur die Untergrenze, damit das Motiv Luft behält.
 */
function TypePanel({ children }: { children: string }) {
  return (
    <div
      className="flex h-full min-h-24 items-center justify-center rounded-2xl px-8 py-6"
      style={{ backgroundColor: '#EFE9DC' }}
    >
      <span
        className="font-heading text-5xl md:text-6xl font-semibold text-balance text-center leading-none"
        style={{ color: '#2D5F3F' }}
      >
        {children}
      </span>
    </div>
  )
}

/** Eine Editorial-Zeile: Medium und Text nebeneinander, ab md abwechselnd gespiegelt. */
function FarmRow({
  media,
  title,
  desc,
  flip,
}: {
  media: ReactNode
  title: string
  desc: string
  flip: boolean
}) {
  return (
    <div className="grid items-stretch gap-7 md:grid-cols-2 md:gap-14">
      <div className={flip ? 'md:order-2' : undefined}>{media}</div>
      <div className={flip ? 'md:order-1' : undefined}>
        <h3 className="font-heading text-2xl md:text-3xl font-semibold text-foreground mb-3 text-balance">
          {title}
        </h3>
        <p className="text-base leading-relaxed text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    icon: Leaf,
    title: 'Frisch vom Hof',
    desc: 'Produkte direkt von lokalen Landwirtschaftsbetrieben in deiner Region.',
    iconBg: '#E8F0E8',
    iconColor: '#2D5F3F',
  },
  {
    icon: ShoppingBasket,
    title: 'Einfach bestellen',
    desc: 'Online reservieren und zur vereinbarten Zeit bequem abholen.',
    iconBg: '#F4EFE6',
    iconColor: '#B86A2E',
  },
  {
    icon: Users,
    title: 'Regional stärken',
    desc: 'Unterstütze Bauern in deiner Umgebung und stärke die lokale Wirtschaft.',
    iconBg: '#E8F0E8',
    iconColor: '#2D5F3F',
  },
]

export default function HomePage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      // Der Verlauf ist bewusst auf die erste Bildschirmhöhe festgenagelt: als
      // Element-Verlauf hätte er sich über die nun viel längere Seite gestreckt
      // und den Hero-Hintergrund verändert. Darunter läuft seine Endfarbe weiter.
      style={{
        backgroundImage: 'linear-gradient(160deg, #F4EFE6 0%, #E8F0E8 55%, #FAFAF7 100%)',
        backgroundSize: '100% 100vh',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#FAFAF7',
      }}
    >
      {/* Schlanke Kopfzeile: Login ohne Scrollen erreichbar (einzeilig auf allen Breiten) */}
      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <svg width="32" height="32" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="40" cy="40" r="40" fill="#E8F0E8" />
            <path
              d="M40 64 C40 64 22 53 22 35 C22 24 30 16 40 16 C50 16 58 24 58 35 C58 53 40 64 40 64Z"
              fill="#2D5F3F"
            />
            <path d="M40 64 L40 44" stroke="#7BAE85" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="font-heading text-lg font-bold whitespace-nowrap" style={{ color: '#2D5F3F' }}>
            FarmerZone
          </span>
        </Link>
        <Link
          href="/login"
          className="shrink-0 whitespace-nowrap rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-white"
          style={{ borderColor: '#D6E0CE', color: '#2D5F3F', background: 'rgba(255,255,255,0.6)' }}
        >
          Hofbetreiber-Login
        </Link>
      </header>

      <main className="flex-1">

        {/* Hero — Ambient-Feld-Loop in drei Schichten:
            (1) Standbild als Basis — immer da, damit es die Mobil- und die
                Reduced-Motion-Darstellung ist und als LCP-Kandidat zählt;
            (2) darüber der Loop, rein per CSS eingeblendet (kein Autoplay-JS);
            (3) darüber der Verlauf, der die weiße Schrift lesbar hält. */}
        <section className="relative h-[70vh] min-h-[420px] w-full overflow-hidden">
          <Image
            src="/landing/hero-poster.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />

          {/* Der Loop läuft NUR ab md UND nur bei erlaubter Bewegung — die
              Weiche ist reines Tailwind, kein JavaScript. Rein dekorativ,
              deshalb aria-hidden und ohne Tonspur/Controls. */}
          <video
            className="absolute inset-0 hidden h-full w-full object-cover motion-safe:md:block"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/landing/hero-poster.jpg"
            aria-hidden="true"
          >
            <source
              media="(min-width: 768px) and (prefers-reduced-motion: no-preference)"
              src="/landing/hero-loop.mp4"
              type="video/mp4"
            />
          </video>

          {/* Verlauf von unten/links über beide Schichten */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-tr from-black/75 via-black/45 to-black/10"
          />

          {/* Weicher Auslauf in den Sand-Hintergrund statt harter Kante.
              Der Farbwert entspricht dem Seitenverlauf auf Höhe des unteren
              Hero-Rands (70vh); die Deckkraft steigt erst ganz unten spürbar,
              damit der weiße Scroll-Pfeil darüber lesbar bleibt. */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-28 md:h-36"
            style={{
              background:
                'linear-gradient(to bottom, rgba(238,242,236,0) 0%, rgba(238,242,236,0.15) 55%, rgba(238,242,236,0.6) 82%, #EEF2EC 100%)',
            }}
          />

          {/* Headline und Subline im Wortlaut unverändert, nur in Weiß */}
          <div className="relative flex h-full flex-col justify-end px-6 pb-20 sm:px-10 md:pb-24">
            <h1 className="font-heading text-4xl sm:text-5xl font-semibold text-white mb-4 leading-tight max-w-sm">
              Frisch vom Hof.<br />Direkt zu dir.
            </h1>
            <p className="text-lg text-white/90 max-w-xs leading-relaxed">
              Regionale Lebensmittel von lokalen Bauern — bestellen, abholen, genießen.
            </p>
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

        {/* Aus dem bisherigen Hero übernommen, Wortlaut und Markup unverändert:
            Pilot-Hinweis und die drei Karten. Über dem Video wären sie weder
            lesbar noch mit einem ~70vh hohen Hero vereinbar — gelöscht werden
            sollten sie aber auch nicht, also stehen sie jetzt direkt darunter.
            Blattmarke, Wortmarke und der Login-Knopf sind entfallen: Alle drei
            stehen bereits in der Kopfzeile, und der Hero bekommt keinen Button. */}
        <section
          id="weiter"
          className="flex scroll-mt-4 flex-col items-center px-6 pt-12 text-center sm:pt-16"
        >
          {/* Pilot badge */}
          <div className="inline-flex items-center gap-2 bg-card/80 border border-border rounded-full px-3.5 py-1.5 text-xs text-muted-foreground mb-10">
            <span className="size-1.5 rounded-full bg-[#E8854A] animate-pulse" />
            Pilotbetrieb mit ausgewählten Höfen
          </div>

          {/* Feature cards */}
          <div className="grid sm:grid-cols-3 gap-5 max-w-2xl w-full">
            {FEATURES.map(({ icon: Icon, title, desc, iconBg, iconColor }, i) => (
              <div
                key={title}
                className="bg-card rounded-2xl p-6 text-left transition-[transform,box-shadow] duration-[250ms] ease-out hover:-translate-y-1.5"
                style={{
                  boxShadow: '0 4px 16px oklch(0.38 0.089 150 / 0.06), 0 1px 3px oklch(0.38 0.089 150 / 0.04)',
                  transitionDelay: `${i * 30}ms`,
                }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: iconBg }}
                >
                  <Icon className="w-5 h-5" style={{ color: iconColor }} strokeWidth={1.75} />
                </div>
                <h3 className="font-heading font-semibold text-foreground mb-2 text-base">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* A — Für Höfe: abwechselnde Editorial-Zeilen statt Karten */}
        <section className="px-6 py-20 md:py-28">
          <div className="mx-auto max-w-5xl">
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
                  media={
                    'image' in row
                      ? <RowImage src={row.image} alt={row.alt} />
                      : <TypePanel>{row.panel}</TypePanel>
                  }
                />
              ))}
            </div>
          </div>
        </section>

        {/* B — Für Kundinnen und Kunden: ruhige Typo-Reihe, keine Bilder */}
        <section className="px-6 pb-20 md:pb-28">
          <div className="mx-auto max-w-5xl">
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
          <div className="mx-auto max-w-5xl">
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
                      className="hidden md:block absolute left-16 right-0 top-7 h-px"
                      style={{ backgroundColor: '#D8DFD2' }}
                    />
                  )}
                  <span
                    className="relative font-heading text-5xl md:text-6xl font-semibold leading-none"
                    style={{ color: '#7BAE85' }}
                  >
                    {i + 1}
                  </span>
                  <p className="mt-5 text-base leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* D — Vision als vollbreites Foto-Band: dasselbe Motiv wie der Hero,
            das die Seite unten wieder schließt. Bild rein dekorativ. */}
        <section className="relative isolate overflow-hidden py-24 md:py-32 mb-20 md:mb-28">
          <Image
            src="/landing/hero-poster.jpg"
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            className="-z-10 object-cover"
          />
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
            <a
              href={CTA_MAILTO}
              className="inline-flex items-center gap-2 rounded-full bg-card px-7 py-3.5 text-sm font-semibold text-primary transition-[transform,opacity] duration-[250ms] ease-out hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0"
            >
              {CTA_BUTTON}
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <p className="mt-5 mx-auto max-w-md text-sm leading-relaxed text-accent-foreground/80">
              {CTA_NOTE}
            </p>
          </div>
        </section>
      </main>

      <footer className="py-6 px-6 border-t border-border/50">
        <div className="max-w-2xl mx-auto flex flex-wrap justify-center gap-5 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} FarmerZone</span>
          <Link href="/impressum" className="hover:text-foreground transition-colors duration-[250ms]">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-foreground transition-colors duration-[250ms]">
            Datenschutz
          </Link>
        </div>
      </footer>
    </div>
  )
}
