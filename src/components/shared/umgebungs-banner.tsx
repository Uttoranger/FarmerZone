import { bannerZeilen } from '@/lib/umgebung'
import { UMGEBUNG, ZEIGE_UMGEBUNGSBANNER, meldeUmgebungsWarnungen } from '@/lib/umgebung-server'

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
 * Feste Farben, bewusst ohne Token und ohne dark:-Variante: Ein Warnstreifen
 * muss in beiden Modi gleich aussehen, wie ein Absperrband. Bernstein-400 auf
 * Stein-900 liegt bei rund 11:1, Rot-700 auf Weiß bei rund 6,4:1 — beides
 * über den geforderten 4,5:1.
 */
export function UmgebungsBanner(): React.JSX.Element | null {
  meldeUmgebungsWarnungen()
  if (!ZEIGE_UMGEBUNGSBANNER) return null

  const { lang, kurz } = bannerZeilen(UMGEBUNG)
  const warnung = UMGEBUNG.warnungen.length > 0

  return (
    <div
      role="status"
      aria-label="Hinweis auf die Testumgebung"
      className={`relative z-[60] print:hidden pt-[env(safe-area-inset-top)] ${
        warnung ? 'bg-red-700 text-white' : 'bg-amber-400 text-stone-900'
      }`}
    >
      <p className="px-4 py-1.5 text-center text-xs font-bold tracking-wide">
        <span className="hidden sm:inline">{lang}</span>
        <span className="sm:hidden">{kurz}</span>
        {warnung && (
          <span className="font-semibold"> — {UMGEBUNG.warnungen.join(' ')}</span>
        )}
      </p>
    </div>
  )
}
