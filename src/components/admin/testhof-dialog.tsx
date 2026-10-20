'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { markiereAlsTesthof, nimmTesthofZurueck } from '@/server/actions/gruendung'
import { GRUENDUNG_AUSNEHMEN_TEXT, TESTHOF_TEXT, type TesthofAenderung } from '@/lib/admin-hoefe-seite'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/** Ein Hof, wie die Bestätigung ihn braucht — Satz und Haken fertig vom Server (testhofAenderung). */
export type TesthofHof = { id: string; name: string; aenderung: TesthofAenderung }

/**
 * Die Bestätigung „Als Testhof markieren?“ bzw. „Nicht mehr als Testhof
 * führen?“ (Register N21, Nr. 119) — im Muster der Bestätigung zum Ausnehmen
 * (gruendung-ausnehmen-dialog.tsx): ab 768 px ein Dialog, am Handy ein Blatt.
 * Der eigene Haken „Das ist ein Testhof, kein echter Hof.“ steht nur, wenn der
 * Hof gerade einen Platz hält — den Schutz gibt die Action.
 */
export function TesthofDialog({ hof, onClose }: { hof: TesthofHof | null; onClose: () => void }): React.JSX.Element {
  // Der Haken startet bei jedem Hof frisch — deshalb hängt der Schlüssel am Hof.
  return <Bestaetigung key={hof?.id ?? 'zu'} hof={hof} onClose={onClose} />
}

function Bestaetigung({ hof, onClose }: { hof: TesthofHof | null; onClose: () => void }): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const [bestaetigt, setBestaetigt] = useState(false)
  const aenderung = hof?.aenderung ?? null

  function bestaetigen() {
    if (!hof || !aenderung) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis =
        aenderung.richtung === 'markieren'
          ? await markiereAlsTesthof({ farmId: hof.id, bestaetigt: aenderung.haken && bestaetigt })
          : await nimmTesthofZurueck({ farmId: hof.id })
      if ('error' in ergebnis) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(TESTHOF_TEXT.erledigt[aenderung.richtung])
      onClose()
    })
  }

  return (
    <BestellDialog
      offen={hof !== null}
      onOffenChange={(offen) => {
        if (!offen) onClose()
      }}
      titel={aenderung?.titel ?? ''}
      hauptaktion={{
        text: aenderung?.knopf ?? '',
        onClick: bestaetigen,
        ton: aenderung?.richtung === 'zuruecknehmen' ? 'gruen' : 'orange',
        laeuft,
        gesperrt: aenderung === null || (aenderung.haken && !bestaetigt),
      }}
    >
      {aenderung && (
        <div className="flex flex-col gap-3.5">
          <p className="text-[14px] leading-relaxed text-foreground">{aenderung.satz}</p>
          {aenderung.haken && (
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-[13.5px] leading-snug text-foreground">
              <input
                type="checkbox"
                checked={bestaetigt}
                onChange={(e) => {
                  setBestaetigt(e.target.checked)
                  setFehler(null)
                }}
                className={cn('mt-0.5 size-5 shrink-0 accent-accent', FOKUS_RAHMEN)}
              />
              <span>
                {TESTHOF_TEXT.haken} <span className="text-muted-foreground">{GRUENDUNG_AUSNEHMEN_TEXT.hakenGrund}</span>
              </span>
            </label>
          )}
          <DialogFehler text={fehler} />
        </div>
      )}
    </BestellDialog>
  )
}
