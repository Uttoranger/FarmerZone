import { HAUPT, MEIN_HOF_REITER_HOFBEREICH } from '@/lib/bauern-navigation'

/**
 * Die Brotkrumen „Mein Hof › Beiträge“ in der Unterzeile des Werkzeug-Kopfs (G1) der Beitrags-Seiten —
 * Neuer Beitrag, WhatsApp versenden, QR-Plakat (Liste Lauf 32, beitraege und whatsapp-plakat „Kopf“, Nr. 250).
 * Die Namen kommen aus derselben Navigation wie Leiste und Reiter, nie als zweite Schreibweise.
 */
export const BEITRAEGE_BROTKRUMEN = `${HAUPT.find((p) => p.id === 'mein-hof')?.label ?? ''} › ${
  MEIN_HOF_REITER_HOFBEREICH.find((r) => r.id === 'beitraege')?.label ?? ''
}`

export function BeitraegeBrotkrumen(): React.JSX.Element {
  return <p className="text-[13px] leading-snug text-muted-foreground md:text-sm">{BEITRAEGE_BROTKRUMEN}</p>
}
