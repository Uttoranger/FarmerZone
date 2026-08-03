import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { Leaf, ShoppingBasket, Users, Check, ArrowRight } from 'lucide-react'
import { KONTAKT_EMAIL } from '@/lib/support'

export const metadata: Metadata = {
  title: 'FarmerZone — Regionale Lebensmittel direkt vom Bauern',
  description: 'Regionale Lebensmittel direkt vom Bauern bestellen und abholen. Pilotbetrieb mit ausgewählten Höfen.',
}

// Alle Texte als Konstanten statt als JSX-Text: so stehen die Wortlaute an
// einer Stelle, und deutsche Anführungszeichen brauchen keine HTML-Entities.

const CARD_SHADOW = {
  boxShadow: '0 4px 16px oklch(0.38 0.089 150 / 0.06), 0 1px 3px oklch(0.38 0.089 150 / 0.04)',
}

// Dekorative Bildmarken — die bestehenden Kategorie-Illustrationen aus
// /public/categories, jede genau einmal. Keine neuen Bilder.
const IMAGE_TINT = { backgroundColor: '#F4EFE3' }

const FARM_BENEFITS = [
  {
    image: '/categories/eier.webp',
    title: 'Bestellungen sammeln sich von selbst',
    desc: 'Kundinnen bestellen rund um die Uhr online; du siehst alles gebündelt nach Abholtag, mit fertiger Packliste — statt Zettel, Anrufe und Chat-Verläufe zu sortieren.',
  },
  {
    image: '/categories/milch.webp',
    title: 'Einmal schreiben, alle erreichen',
    desc: 'Ein kurzes Update („Frische Eier ab Freitag") geht an alle deine Kundinnen auf einmal — statt dreißig Einzelnachrichten.',
  },
  {
    image: '/categories/brennholz.webp',
    title: 'Planbar statt Überraschung',
    desc: 'Feste Abholzeiten, Bestellungen im Voraus, online oder bar bezahlt: Du weißt vor dem Abholtag, was gebraucht wird.',
  },
]

const CUSTOMER_POINTS = [
  'Frisch direkt vom Hof in deiner Nähe — ohne Umweg über den Handel.',
  'Bestellen, wann es dir passt; abholen, wenn der Hof geöffnet hat. Vorab online zahlen oder bar vor Ort.',
  'Du weißt, was es diese Woche gibt — der Hof hält dich mit kurzen Updates auf dem Laufenden.',
]

const CUSTOMER_IMAGES = ['/categories/fleisch.webp', '/categories/sonstiges.webp']

const STEPS = [
  'Der Hof teilt seinen persönlichen Link (WhatsApp, Aushang, Marktstand).',
  'Du bestellst online in wenigen Minuten.',
  'Abholen am vereinbarten Tag — fertig gepackt.',
]

const VISION =
  'FarmerZone startet im Innviertel — Hof für Hof. Das Ziel: die Höfe einer Region an einem Ort, ' +
  'damit Direktvermarktung so einfach wird wie der Griff ins Regal — nur ehrlicher. ' +
  'Ohne Zwischenhandel, ohne Abo-Zwang, ohne Schnickschnack.'

const SECTION_TITLES = {
  farms: 'Für Höfe',
  customers: 'Für Kundinnen und Kunden',
  steps: 'So funktioniert’s',
  vision: 'Unsere Vision',
}

// Der eine Orange-Einsatz der Seite (globals.css: „Warmes Orange (CTA, max. 1× pro Seite)").
// Kein zweiter CTA für Kundinnen — die kommen über den Link ihres Hofes.
const CTA_HEADLINE = 'Du führst einen Hof und willst dabei sein?'
const CTA_BUTTON = 'Hof anmelden'
const CTA_NOTE =
  'Die Registrierung läuft mit einem persönlichen Einladungscode — schreib uns kurz, dann melden wir uns bei dir.'
const CTA_MAILTO = `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent('Mein Hof auf FarmerZone')}`

function SectionHeading({ children }: { children: string }) {
  return (
    <div className="mb-8">
      <h2 className="font-heading text-2xl sm:text-3xl font-semibold text-foreground">{children}</h2>
      <span className="mt-3 block h-px w-12 rounded-full" style={{ backgroundColor: '#7BAE85' }} />
    </div>
  )
}

/** Quadratische Bildmarke — rein dekorativ, deshalb leeres alt. */
function CategoryMark({ src, className }: { src: string; className: string }) {
  return (
    <div className={`overflow-hidden rounded-xl ${className}`} style={IMAGE_TINT}>
      <Image src={src} alt="" width={96} height={96} className="h-full w-full object-cover" />
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

        {/* Hero — unverändert; nur die Höhenreserve wandert vom <main> hierher,
            damit der Hero wie bisher die erste Bildschirmhöhe füllt und die
            neuen Abschnitte darunter beginnen. */}
        <section className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-6 py-16 text-center">

          {/* Organic leaf SVG */}
          <div className="mb-8">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="40" cy="40" r="40" fill="#E8F0E8" />
              <path
                d="M40 64 C40 64 22 53 22 35 C22 24 30 16 40 16 C50 16 58 24 58 35 C58 53 40 64 40 64Z"
                fill="#2D5F3F"
              />
              <path
                d="M40 64 L40 44"
                stroke="#7BAE85"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <path
                d="M40 50 C35 47 27 46 24 39"
                stroke="#7BAE85"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M40 44 C45 41 53 40 56 33"
                stroke="#7BAE85"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Wordmark */}
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase mb-3">
            FarmerZone
          </p>

          {/* Headline */}
          <h1 className="font-heading text-4xl sm:text-5xl font-semibold text-foreground mb-4 leading-tight max-w-sm">
            Frisch vom Hof.<br />Direkt zu dir.
          </h1>

          {/* Subline */}
          <p className="text-lg text-muted-foreground max-w-xs mb-5 leading-relaxed">
            Regionale Lebensmittel von lokalen Bauern — bestellen, abholen, genießen.
          </p>

          {/* Pilot badge */}
          <div className="inline-flex items-center gap-2 bg-card/80 border border-border rounded-full px-3.5 py-1.5 text-xs text-muted-foreground mb-14">
            <span className="size-1.5 rounded-full bg-[#E8854A] animate-pulse" />
            Pilotbetrieb mit ausgewählten Höfen
          </div>

          {/* Feature cards */}
          <div className="grid sm:grid-cols-3 gap-5 max-w-2xl w-full mb-14">
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

          {/* CTA */}
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-primary-foreground font-semibold text-sm transition-[transform,opacity,box-shadow] duration-[250ms] ease-out hover:opacity-90 hover:-translate-y-0.5 active:translate-y-0"
            style={{
              backgroundColor: '#2D5F3F',
              boxShadow: '0 4px 16px oklch(0.38 0.089 150 / 0.3), 0 2px 4px oklch(0.38 0.089 150 / 0.15)',
            }}
          >
            Hofbetreiber-Login
          </Link>
        </section>

        {/* A — Für Höfe */}
        <section className="px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <SectionHeading>{SECTION_TITLES.farms}</SectionHeading>
            <div className="grid gap-5 sm:grid-cols-3">
              {FARM_BENEFITS.map(({ image, title, desc }) => (
                <article key={title} className="bg-card rounded-2xl p-6" style={CARD_SHADOW}>
                  <CategoryMark src={image} className="mb-4 size-14" />
                  <h3 className="font-heading font-semibold text-foreground mb-2 text-base">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* B — Für Kundinnen und Kunden */}
        <section className="px-6 pb-16 sm:pb-20">
          <div className="mx-auto max-w-4xl">
            <SectionHeading>{SECTION_TITLES.customers}</SectionHeading>
            <div
              className="bg-card rounded-2xl p-6 sm:p-8 flex flex-col gap-8 md:flex-row md:items-center md:justify-between"
              style={CARD_SHADOW}
            >
              <ul className="space-y-4 md:max-w-lg">
                {CUSTOMER_POINTS.map((point) => (
                  <li key={point} className="flex gap-3">
                    <Check className="size-5 shrink-0 mt-0.5 text-primary" strokeWidth={2} />
                    <span className="text-sm text-muted-foreground leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-3 md:flex-col shrink-0" aria-hidden="true">
                {CUSTOMER_IMAGES.map((src) => (
                  <CategoryMark key={src} src={src} className="size-20 sm:size-24" />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* C — So funktioniert’s */}
        <section className="px-6 pb-16 sm:pb-20">
          <div className="mx-auto max-w-4xl">
            <SectionHeading>{SECTION_TITLES.steps}</SectionHeading>
            <ol className="grid gap-5 sm:grid-cols-3">
              {STEPS.map((text, i) => (
                <li key={text} className="bg-card rounded-2xl p-6" style={CARD_SHADOW}>
                  <span
                    className="inline-flex size-8 items-center justify-center rounded-full font-heading text-sm font-semibold mb-3"
                    style={{ backgroundColor: '#E8F0E8', color: '#2D5F3F' }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* D — Unsere Vision */}
        <section className="px-6 pb-16 sm:pb-20">
          <div
            className="mx-auto max-w-2xl rounded-3xl px-6 py-10 sm:px-10 text-center"
            style={{ backgroundColor: '#E8F0E8' }}
          >
            <h2 className="font-heading text-2xl sm:text-3xl font-semibold mb-4" style={{ color: '#2D5F3F' }}>
              {SECTION_TITLES.vision}
            </h2>
            <p className="text-base leading-relaxed" style={{ color: '#2D5F3F' }}>
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
