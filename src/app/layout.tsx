import type { Metadata, Viewport } from 'next'
import { Geist, Fraunces } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from '@/components/ui/sonner'
import { CookieBanner } from '@/components/cookie-banner'
import './globals.css'

const geist = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: 'FarmerZone',
  description: 'Regionale Lebensmittel direkt vom Bauern',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Färbt die Browserleiste auf dem Handy wie den Seitenhintergrund. Die Werte
  // sind die sRGB-Entsprechungen von --background aus globals.css (:root und
  // .dark). Die Media-Query folgt der Systemeinstellung — wer im Konto von Hand
  // auf Hell oder Dunkel stellt, behält die Leiste des Systems. Das lässt sich
  // ohne JavaScript im <head> nicht anders lösen und ist bewusst so.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F2E5' },
    { media: '(prefers-color-scheme: dark)', color: '#040B05' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes setzt die Klasse "dark" per Inline-
    // Skript vor dem ersten Paint. Der Server kann sie nicht kennen, deshalb
    // weicht das <html>-Element planmäßig ab — nur hier, nicht im Inhalt.
    <html
      lang="de"
      suppressHydrationWarning
      className={`${geist.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
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
