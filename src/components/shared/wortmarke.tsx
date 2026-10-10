import { cn } from '@/lib/utils'

/**
 * Bildmarke und „FarmerZone" — für die Kopfzeile der Kundenseiten.
 *
 * Auch die KundeShell und der Fuß der Startseite zeigen sie. `wortKlasse`
 * kann das Wort auf schmalen Handys ausblenden, wo der Kopf sonst
 * überliefe; die Bildmarke bleibt (der Link darum trägt den Namen).
 */
export function Wortmarke({ wortKlasse }: { wortKlasse?: string } = {}): React.JSX.Element {
  return (
    <span className="flex min-w-0 items-center gap-2">
      {/* Die Bildmarke behält ihre Farben in beiden Modi — ein Logo, das je
          nach Einstellung anders aussieht, ist kein Logo mehr. Der helle Kreis
          trägt sich auf dunklem Grund wie ein Aufkleber. */}
      <svg width="32" height="32" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="40" cy="40" r="40" fill="#E8F0E8" />
        <path
          d="M40 64 C40 64 22 53 22 35 C22 24 30 16 40 16 C50 16 58 24 58 35 C58 53 40 64 40 64Z"
          fill="#2D5F3F"
        />
        <path d="M40 64 L40 44" stroke="#7BAE85" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className={cn('whitespace-nowrap font-heading text-lg font-bold text-brand-text', wortKlasse)}>FarmerZone</span>
    </span>
  )
}
