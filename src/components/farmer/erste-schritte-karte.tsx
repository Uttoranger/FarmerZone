import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Check, ChevronRight } from 'lucide-react'
import { ERSTE_SCHRITTE_WARTET, type ErsteSchritteErgebnis } from '@/lib/erste-schritte'

/**
 * Einstiegs-Checkliste auf der Übersicht.
 *
 * Erledigte Punkte bleiben stehen, aber gedämpft und abgehakt — der wachsende
 * Fortschritt ist die Belohnung. Bei ihnen entfallen Nutzen-Satz und Link:
 * Wer den Schritt hinter sich hat, braucht die Begründung nicht mehr, und die
 * Karte schrumpft mit jedem erledigten Punkt sichtbar zusammen. Am Telefon ist
 * das der Unterschied zwischen einer Liste, die die Seite blockiert, und einer,
 * die sich selbst abbaut.
 *
 * Die Karte wird nur gerendert, wenn `anzeigen` true ist — die Entscheidung
 * darüber trifft die reine Funktion, nicht die Anzeige.
 */
export function ErsteSchritteKarte({
  ergebnis,
  wartetAufFreigabe,
}: {
  ergebnis: ErsteSchritteErgebnis
  wartetAufFreigabe: boolean
}) {
  if (!ergebnis.anzeigen) return null

  const { schritte, erledigt, gesamt, prozent } = ergebnis

  return (
    <Card className="mb-6">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-semibold text-foreground">Erste Schritte</p>
          <p className="shrink-0 text-[13px] font-medium" style={{ color: '#9AA08F' }}>
            {erledigt} von {gesamt} erledigt
          </p>
        </div>

        {/* Fortschrittsbalken — w-full, damit er bei 375px nicht abgeschnitten
            wird. Der Wert steht daneben schon als Text, der Balken ist reine
            Veranschaulichung und deshalb aria-hidden. */}
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${prozent}%`, background: '#2D5F3F' }}
          />
        </div>

        {wartetAufFreigabe && (
          /* `text-muted-foreground` statt #9AA08F: Letzteres erreicht auf
             Kartenweiß nur rund 2,7:1 — unter AA. Das Token liegt bei rund
             4,5:1 und ist dieselbe Farbfamilie. */
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {ERSTE_SCHRITTE_WARTET}
          </p>
        )}

        <ul className="mt-3 -mx-2">
          {schritte.map((schritt) => {
            const zeileninhalt = (
              <>
                <span
                  className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full"
                  style={
                    schritt.erledigt
                      ? { background: '#E8F0E2', color: '#2D5F3F' }
                      : { border: '1.5px solid #D6E0CE' }
                  }
                  aria-hidden="true"
                >
                  {schritt.erledigt && <Check className="size-3" strokeWidth={2.5} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${
                      schritt.erledigt ? 'text-muted-foreground' : 'font-medium text-foreground'
                    }`}
                  >
                    {schritt.titel}
                    {schritt.optional && (
                      <span className="font-normal" style={{ color: '#9AA08F' }}>
                        {' '}
                        (optional)
                      </span>
                    )}
                  </span>
                  {!schritt.erledigt && (
                    <span className="mt-0.5 block text-xs" style={{ color: '#9AA08F' }}>
                      {schritt.nutzen}
                    </span>
                  )}
                </span>

                {!schritt.erledigt && (
                  <ChevronRight
                    className="mt-0.5 size-4 shrink-0"
                    style={{ color: '#9AA08F' }}
                    aria-hidden="true"
                  />
                )}
              </>
            )

            return (
              <li key={schritt.id}>
                {schritt.erledigt ? (
                  // Kein Link mehr: erledigt ist erledigt. Ändern lässt sich
                  // alles weiterhin über die Einstellungen.
                  <div className="flex items-start gap-2.5 px-2 py-2">{zeileninhalt}</div>
                ) : (
                  // Die ganze Zeile ist das Ziel, nicht nur ein Wort darin —
                  // am Telefon ist eine 44px hohe Fläche tippbar, ein Textlink
                  // von 12px Höhe nicht.
                  <Link
                    href={schritt.href}
                    className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                  >
                    {zeileninhalt}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
