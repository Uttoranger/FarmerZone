import { HAUPT, MEIN_HOF_REITER_HOFBEREICH } from '@/lib/bauern-navigation'

/**
 * Die Brotkrumen „Mein Hof › Beiträge“ in der Unterzeile des Werkzeug-Kopfs (G1) der Beitrags-Seiten —
 * Neuer Beitrag, WhatsApp versenden, QR-Plakat (Liste Lauf 32, beitraege und whatsapp-plakat „Kopf“, Nr. 250).
 * Die Namen kommen aus derselben Navigation wie Leiste und Reiter, nie als zweite Schreibweise.
 */
export const BEITRAEGE_BROTKRUMEN = `${HAUPT.find((p) => p.id === 'mein-hof')?.label ?? ''} › ${
  MEIN_HOF_REITER_HOFBEREICH.find((r) => r.id === 'beitraege')?.label ?? ''
}`

/**
 * Mit `hofName` steht der Hof davor („Hof Müller · Mein Hof › Beiträge“) — so auf WhatsApp versenden und
 * QR-Plakat (Board s2-/w2-whatsapp-plakat Bild 2; Auftrag Lauf 33 Nr. 278 „Unterzeile mit Hofname“).
 */
export function BeitraegeBrotkrumen({ hofName }: { hofName?: string } = {}): React.JSX.Element {
  return (
    <p className="truncate text-[13px] leading-snug text-muted-foreground md:text-sm">
      {hofName ? `${hofName} · ${BEITRAEGE_BROTKRUMEN}` : BEITRAEGE_BROTKRUMEN}
    </p>
  )
}
