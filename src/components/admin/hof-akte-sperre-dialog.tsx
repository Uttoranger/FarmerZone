'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { sperreHof, hebeHofSperreAuf } from '@/server/actions/admin-hof'
import { SPERRE_TEXT } from '@/lib/admin-hof-akte'
import { HOF_GESPERRT_SATZ } from '@/lib/bereiche-anzeige'
import { ADMIN_GRUND_MAX } from '@/schemas/admin-aktion'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL } from '@/components/hof-bestellungen/stil'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'

export type HofSperreWahl = { farmId: string; name: string; richtung: 'sperren' | 'aufheben' }

/**
 * „Vorübergehend sperren …“ bzw. „Sperre aufheben“ (Register N34, Nr. 187) —
 * ab 768 px ein Dialog, am Handy ein Blatt (BestellDialog). Sperren fragt nach
 * dem Grund (sieht der Hof im Postfach); der Satz für die Kundschaft ist fest
 * und neutral. Beide Wege sind heikel: frisch mit Passkey (useFrischBestaetigt).
 */
export function HofSperreDialog({ wahl, onClose }: { wahl: HofSperreWahl | null; onClose: () => void }): React.JSX.Element {
  // Grund und Fehler starten bei jedem Öffnen frisch.
  return <Inhalt key={wahl ? `${wahl.farmId}-${wahl.richtung}` : 'zu'} wahl={wahl} onClose={onClose} />
}

function Inhalt({ wahl, onClose }: { wahl: HofSperreWahl | null; onClose: () => void }): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const frischSperren = useFrischBestaetigt(sperreHof)
  const frischAufheben = useFrischBestaetigt(hebeHofSperreAuf)
  const sperren = wahl?.richtung !== 'aufheben'

  function bestaetigen() {
    if (!wahl) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = sperren
        ? await frischSperren.ausfuehren({ farmId: wahl.farmId, grund })
        : await frischAufheben.ausfuehren({ farmId: wahl.farmId })
      if ('error' in ergebnis) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(sperren ? SPERRE_TEXT.erledigt : SPERRE_TEXT.aufgehoben)
      onClose()
    })
  }

  return (
    <>
      {/* Die Passkey-Dialoge neben, nicht in dem Dialog: Sie müssen auch erscheinen, wenn er sich schließt (Nr. 188, Runde 2). */}
      {frischSperren.dialog}
      {frischAufheben.dialog}
      <BestellDialog
        offen={wahl !== null}
        onOffenChange={(offen) => {
          if (!offen) onClose()
        }}
        titel={sperren ? SPERRE_TEXT.titel : SPERRE_TEXT.aufhebenTitel}
        unterzeile={wahl?.name}
        hauptaktion={{
          text: sperren ? SPERRE_TEXT.bestaetigen : SPERRE_TEXT.aufheben,
          onClick: bestaetigen,
          ton: sperren ? 'orange' : 'gruen',
          laeuft,
          gesperrt: sperren && grund.trim() === '',
        }}
      >
        <div className="flex flex-col gap-3.5">
          {sperren ? (
            <>
              <p className="text-[14px] leading-relaxed text-foreground">{SPERRE_TEXT.erklaerung}</p>
              <div>
                <label htmlFor="sperre-grund" className={FELD_LABEL}>
                  {SPERRE_TEXT.grundLabel}
                </label>
                <textarea
                  id="sperre-grund"
                  value={grund}
                  maxLength={ADMIN_GRUND_MAX}
                  rows={3}
                  aria-describedby="sperre-grund-hilfe"
                  aria-invalid={fehler !== null || undefined}
                  onChange={(e) => {
                    setGrund(e.target.value)
                    setFehler(null)
                  }}
                  className={FELD}
                />
                <p id="sperre-grund-hilfe" className="mt-1 text-[12.5px] text-muted-foreground">
                  {SPERRE_TEXT.grundHilfe}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted px-3 py-2.5 text-[13.5px]">
                <p className="text-[12.5px] font-semibold text-muted-foreground">{SPERRE_TEXT.kundeLabel}</p>
                <p className="text-foreground">{HOF_GESPERRT_SATZ}</p>
              </div>
              <p className="text-[13px] text-muted-foreground">{SPERRE_TEXT.laufende}</p>
            </>
          ) : (
            <p className="text-[14px] leading-relaxed text-foreground">{SPERRE_TEXT.aufhebenSatz}</p>
          )}
          <DialogFehler text={fehler} />
        </div>
      </BestellDialog>
    </>
  )
}
