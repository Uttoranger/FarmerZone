import { CalendarOff, CalendarX, PauseCircle } from 'lucide-react'
import { kaufSperreHinweis, type KaufSperre } from '@/lib/bereiche-anzeige'
import { kundenPausenText } from '@/lib/shop-pause'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'

/** Was bei einer Pause noch geht (Board w1-/s1-hofseite Bild 4) — nur auf Hof- und Produktseite. */
export const PAUSE_ANSEHEN_SAETZE = 'Du kannst dir das Angebot ansehen. Dein Warenkorb bleibt gespeichert.'

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
  hofseite = false,
}: {
  sperre: KaufSperre
  hofName: string
  /** Die Nachricht des Hofs zur Pause (Farm.pauseMessage) — leer heißt Rückfall-Satz. */
  pauseMessage: string | null
  /** Nur der Titel, ohne Satz — für den Mini-Warenkorb neben der vollen Karte. */
  kurz?: boolean
  /**
   * Die Pause auf Hof- und Produktseite in der Gestalt der Boards w1-/s1-hofseite Bild 4:
   * Fläche und Schrift „tun“, ohne Symbol, die Nachricht des Hofs in Anführungszeichen und
   * die zwei Sätze, die der Kundin sagen, was noch geht. Nur Anzeige — die Sperre selbst
   * entscheidet `kaufSperre`. Kasse, Korb-Blatt und Mein Hof bleiben bei der Hinweiskarte.
   */
  hofseite?: boolean
}): React.JSX.Element | null {
  if (sperre === null) return null
  if (sperre === 'pause' && (hofseite || kurz)) {
    const titel = `${hofName} pausiert gerade.`
    // Im Mini-Warenkorb nur der Titel auf der getönten Fläche (Board w1-hofseite Bild 4).
    if (kurz) return <p className="rounded-xl bg-zustand-tun-grund px-3 py-2.5 text-[14px] font-bold text-zustand-tun">{titel}</p>
    const eigene = pauseMessage?.trim()
    return (
      <div className="flex flex-col gap-1.5 rounded-2xl border border-zustand-tun/30 bg-zustand-tun-grund px-3.5 py-3 text-zustand-tun">
        <p className="text-[15px] font-bold">{titel}</p>
        <p className="text-[14px] break-words">
          {eigene ? `„${eigene}“` : kundenPausenText(null)} {PAUSE_ANSEHEN_SAETZE}
        </p>
      </div>
    )
  }
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
