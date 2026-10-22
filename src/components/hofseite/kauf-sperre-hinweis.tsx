import { CalendarOff, CalendarX, PauseCircle } from 'lucide-react'
import { kaufSperreHinweis, type KaufSperre } from '@/lib/bereiche-anzeige'
import { kundenPausenText } from '@/lib/shop-pause'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'

/**
 * Die Hinweiskarte zur Kaufsperre (Register N24) — EINE Komponente für Hofseite,
 * Produktseite, Mini-Warenkorb und Kasse, an der Stelle, an der vorher nur die
 * Pause-Karte stand:
 *  - Pause: die orange Karte wie bisher, mit dem Text des Hofs (der Hof hat sie
 *    selbst gesetzt — Orange heißt „Offenes“).
 *  - Keine Abholzeit, ausgebucht: dieselbe Gestalt im neutralen Ton (Hinweis ohne
 *    Wertung, DESIGN_SYSTEM „Hinweiskarte“), Wörter aus `kaufSperreHinweis`.
 * `kurz` zeigt nur den Titel: Der Mini-Warenkorb steht auf derselben Seite wie
 * die volle Karte oben, und ein Zustand hat eine Fassung (DESIGN_SYSTEM) — der
 * Satz stünde sonst zweimal da.
 * Ohne Sperre nichts. Nur Tokens über `Hinweiskarte`, beide Themes.
 */
export function KaufSperreHinweis({
  sperre,
  hofName,
  pauseMessage,
  kurz = false,
}: {
  sperre: KaufSperre
  hofName: string
  /** Die Nachricht des Hofs zur Pause (Farm.pauseMessage) — leer heißt Rückfall-Satz. */
  pauseMessage: string | null
  /** Nur der Titel, ohne Satz — für den Mini-Warenkorb neben der vollen Karte. */
  kurz?: boolean
}): React.JSX.Element | null {
  if (sperre === null) return null
  if (sperre === 'pause') {
    return (
      <Hinweiskarte ton="orange" symbol={PauseCircle} titel={`${hofName} pausiert gerade.`}>
        {!kurz && <span className="break-words">{kundenPausenText(pauseMessage)}</span>}
      </Hinweiskarte>
    )
  }
  const { titel, satz } = kaufSperreHinweis(sperre, hofName)
  return (
    <Hinweiskarte ton="neutral" symbol={sperre === 'ausgebucht' ? CalendarX : CalendarOff} titel={titel}>
      {!kurz && <span className="break-words">{satz}</span>}
    </Hinweiskarte>
  )
}
