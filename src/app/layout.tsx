import type { Metadata, Viewport } from 'next'
import { Geist, Fraunces, Instrument_Sans } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { CookieBanner } from '@/components/cookie-banner'
import { UmgebungsBanner } from '@/components/shared/umgebungs-banner'
import { RueckwegMerker } from '@/components/shared/rueckweg-merker'
import { UMGEBUNG, ZEIGE_UMGEBUNGSBANNER } from '@/lib/umgebung-server'
import { metadatenBasis } from '@/lib/vorschaubild'
import './globals.css'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

// Beide Schriften des Design-Systems (docs/ai/DESIGN_SYSTEM.md) kommen über
// next/font: beim Build geladen, vom eigenen Ursprung ausgeliefert — der
// Browser spricht nie mit Google. Die <link>-Schriften in docs/mockups/ sind
// nur Referenz. Fraunces für Überschriften und Kennzahlen, Instrument Sans
// für den übrigen Text im neuen Design (globals.css, --font-sans-aktiv);
// Geist bleibt, bis die letzte Route umgestellt ist.
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
})

const instrumentSans = Instrument_Sans({
  variable: '--font-instrument-sans',
  subsets: ['latin'],
  display: 'swap',
  // Noch nicht vorladen: Bis die erste Route in eine Shell des neuen Designs
  // umzieht (data-design="neu"), nutzt nur die interne Vorschau die Schrift —
  // jede Bestandsseite lüde sonst eine woff2 umsonst. Das Gate, das die erste
  // Route umstellt, setzt preload auf true.
  preload: false,
})

// In der Testumgebung trägt JEDER Browser-Tab das Präfix „[TEST] " — auch
// Seiten mit festem Titel, weil das Präfix hier als Vorlage wirkt und nicht in
// jeder Seite einzeln stehen muss. Das Banner scrollt weg, der Tab bleibt.
const TITEL_PRAEFIX = ZEIGE_UMGEBUNGSBANNER ? '[TEST] ' : ''

export function generateMetadata(): Metadata {
  return {
    // Löst relative Bildpfade der Vorschau (openGraph.images, src/lib/vorschaubild.ts)
    // zu vollen Adressen auf — Messenger laden nur absolute URLs. Die Adresse
    // der Umgebung (Produktion, Preview-Branch, lokal); ist keine bekannt
    // oder ungültig, bleibt es bei Nexts eigener Vercel-Adresse.
    metadataBase: metadatenBasis(UMGEBUNG.appUrl),
    title: {
      default: `${TITEL_PRAEFIX}FarmerZone`,
      template: `${TITEL_PRAEFIX}%s`,
    },
    description: 'Regionale Lebensmittel direkt vom Bauern',
  }
}

// Färbt die Browserleiste auf dem Handy wie den Seitenhintergrund. Die Werte
// sind die sRGB-Entsprechungen von --background aus globals.css (:root und
// [data-theme="dark"]). Die Media-Query folgt der Systemeinstellung — wer im Konto von Hand
// auf Hell oder Dunkel stellt, behält die Leiste des Systems. Das lässt sich
// ohne JavaScript im <head> nicht anders lösen und ist bewusst so.
const THEME_COLOR_PRODUKTION: Viewport['themeColor'] = [
  { media: '(prefers-color-scheme: light)', color: '#F8F2E5' },
  { media: '(prefers-color-scheme: dark)', color: '#040B05' },
]

export function generateViewport(): Viewport {
  return {
    width: 'device-width',
    initialScale: 1,
    // In der Testumgebung ist die Browserleiste die Warnfarbe des Banners —
    // Bernstein, bei Widersprüchen Rot —, damit das Handy es auch dann zeigt,
    // wenn das Banner längst weggescrollt ist. Feste Werte, unabhängig vom Modus.
    themeColor: ZEIGE_UMGEBUNGSBANNER
      ? UMGEBUNG.warnungen.length > 0
        ? '#B91C1C'
        : '#FBBF24'
      : THEME_COLOR_PRODUKTION,
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    // suppressHydrationWarning: next-themes setzt data-theme per Inline-Skript
    // im <head> vor dem ersten Paint — Erstbesuch nach prefers-color-scheme,
    // danach die gemerkte Wahl (localStorage „theme"). Der Server kann den
    // Wert nicht kennen, deshalb weicht das <html>-Element planmäßig ab —
    // nur hier, nicht im Inhalt.
    <html
      lang="de"
      suppressHydrationWarning
      className={`${geist.variable} ${fraunces.variable} ${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        {/* Vor dem ThemeProvider: Der Balken folgt keinem Modus. */}
        <UmgebungsBanner />
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          {/* Merkt, ob vor der Seite eine eigene steht — für „Zurück" der
              Kundenseiten. Hier im Root-Layout, damit auch der Weg von der
              Startseite zählt. Rendert nichts. */}
          <RueckwegMerker />
          <Toaster richColors position="top-center" />
          <CookieBanner />
        </ThemeProvider>
        {/* Vercel Web Analytics: cookielose Reichweitenmessung ohne
            Wiedererkennung — rendert nichts Sichtbares und setzt nichts
            auf dem Gerät (deshalb auch nicht Teil des Cookie-Banners). */}
        <Analytics />
      </body>
    </html>
  )
}
