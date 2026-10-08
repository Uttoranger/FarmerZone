import { bannerZeilen } from '@/lib/umgebung'
import { UMGEBUNG, ZEIGE_UMGEBUNGSBANNER, meldeUmgebungsWarnungen } from '@/lib/umgebung-server'
import { bannerLink } from '@/lib/testumgebung'

/**
 * Das Absperrband: Ein Warnstreifen muss in beiden Modi gleich aussehen. Die
 * einzige Stelle mit diesen Farben — Balken und Link nehmen sie von hier.
 * Bernstein-400 auf Stein-900 liegt bei rund 11:1, Rot-700 auf Weiß bei rund
 * 6,4:1, beides über den geforderten 4,5:1. Rot heißt: Widerspruch in der
 * Umgebung, der Grund steht im Balken.
 */
const ABSPERRBAND = {
  ruhig: { flaeche: 'bg-amber-400', schrift: 'text-stone-900' },
  warnung: { flaeche: 'bg-red-700', schrift: 'text-white' },
} as const

function band(): (typeof ABSPERRBAND)[keyof typeof ABSPERRBAND] {
  return UMGEBUNG.warnungen.length > 0 ? ABSPERRBAND.warnung : ABSPERRBAND.ruhig
}

/**
 * Der Balken, der eine Testumgebung als solche kennzeichnet.
 *
 * Server-Komponente: Die Umgebung wird hier entschieden, an den Browser gehen
 * nur die fertigen Etiketten — nie ein Host, nie ein Schlüssel.
 *
 * In Produktion rendert sie NICHTS, auch nicht bei Widersprüchen (Kundinnen
 * dürfen kein Banner sehen); Widersprüche gehen dort als Warnung an Sentry.
 *
 * Im normalen Fluss, nicht klebend — ein klebender Balken müsste jede
 * klebende Leiste der App (Hofseite, Bauern-Sidebar) nach unten schieben.
 * Dafür ist er über der Seitenleiste des Bauern-Bereichs (z-40) gestapelt,
 * damit er beim Laden nicht hinter ihr verschwindet; danach scrollt er weg,
 * und der Titel-Präfix „[TEST]" bleibt als Erkennungszeichen.
 *
 * Feste Farben aus ABSPERRBAND (oben), bewusst ohne Token und ohne
 * dark:-Variante — die benannte Ausnahme in docs/ai/DESIGN_SYSTEM.md.
 *
 * In der Vorschau (Testumgebung, Register Z3) liegt rechts im Balken „Zur
 * echten Seite" (UmgebungsBannerLink); der Balken hält ihm den Platz frei und
 * ist dann 44 px hoch (Touch-Ziel). Ohne Link bleibt er schmal wie bisher.
 */
export function UmgebungsBanner(): React.JSX.Element | null {
  meldeUmgebungsWarnungen()
  if (!ZEIGE_UMGEBUNGSBANNER) return null

  const { lang, kurz } = bannerZeilen(UMGEBUNG)
  const warnung = UMGEBUNG.warnungen.length > 0
  const mitLink = bannerLink(UMGEBUNG) !== null
  const { flaeche, schrift } = band()

  return (
    <div
      role="status"
      aria-label="Hinweis auf die Testumgebung"
      className={`relative z-[60] print:hidden pt-[env(safe-area-inset-top)] ${flaeche} ${schrift}`}
    >
      <p
        className={`text-center text-xs font-bold tracking-wide ${
          mitLink ? 'py-3.5 pr-28 pl-4 sm:px-28' : 'px-4 py-1.5'
        }`}
      >
        <span className="hidden sm:inline">{lang}</span>
        <span className="sm:hidden">{kurz}</span>
        {warnung && (
          <span className="font-semibold"> — {UMGEBUNG.warnungen.join(' ')}</span>
        )}
      </p>
    </div>
  )
}

/**
 * „Zur echten Seite" (Register Z3) — sichtbar rechts im Balken, im DOM aber
 * am Ende von <body> (src/app/layout.tsx). Stünde der Link vor der Seite,
 * wäre „Zum Inhalt springen" der Shells nicht mehr der erste Link: Mit der
 * Tastatur käme man erst hier vorbei, und Axe zählte den Sprunglink nicht
 * mehr als solchen (Regel „region"). So bleibt die Reihenfolge der Seite, wie
 * sie ist; der Weg zurück kommt zuletzt.
 *
 * Absolut zur Seite (nicht fest), damit er mit dem Balken wegscrollt. Als
 * eigene Navigation „Testumgebung", weil am Ende von <body> sonst Inhalt
 * außerhalb jeder Landmarke stünde. Farbe und Fokusrahmen in der Schriftfarbe
 * des Balkens — der Ring der Tokens wäre auf Bernstein kaum zu sehen.
 */
export function UmgebungsBannerLink(): React.JSX.Element | null {
  if (!ZEIGE_UMGEBUNGSBANNER) return null
  const link = bannerLink(UMGEBUNG)
  if (!link) return null

  return (
    <nav
      aria-label="Testumgebung"
      className={`absolute top-[env(safe-area-inset-top)] right-4 z-[61] print:hidden ${band().schrift}`}
    >
      <a
        href={link.href}
        className="inline-flex min-h-11 items-center text-xs font-bold whitespace-nowrap underline underline-offset-2 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-current"
      >
        {link.text}
      </a>
    </nav>
  )
}
