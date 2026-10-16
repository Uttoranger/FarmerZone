'use client'

import { useState, useTransition } from 'react'
import { Info } from 'lucide-react'
import { toast } from 'sonner'
import { nimmAusGruendung, nimmWiederAuf } from '@/server/actions/gruendung'
import { GRUENDUNG_AUSNEHMEN_TEXT, type GruendungAenderung } from '@/lib/admin-hoefe-seite'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/** Ein Hof, wie die Bestätigung ihn braucht — Sätze und Haken fertig vom Server (gruendungAenderung). */
export type GruendungAusnehmenHof = { id: string; name: string; aenderung: GruendungAenderung }

/**
 * Die Bestätigung „Nicht als Gründungshof zählen?“ bzw. „Wieder als
 * Gründungshof zählen?“ (Register K2, Nr. 109; Mockups
 * admin-hoefe-gruendung-ausnehmen und mobil-admin-hoefe-gruendung-ausnehmen):
 * ab 768 px ein Dialog, am Handy ein Blatt (BestellDialog). Die Folgen in
 * Zahlen kommen fertig vom Server; der Haken „Testhof oder Zustimmung“ steht
 * nur, wenn der Hof gerade einen Platz hält — den Schutz gibt die Action.
 */
export function GruendungAusnehmenDialog({ hof, onClose }: { hof: GruendungAusnehmenHof | null; onClose: () => void }): React.JSX.Element {
  // Der Haken startet bei jedem Hof frisch — deshalb hängt der Schlüssel am Hof.
  return <Bestaetigung key={hof?.id ?? 'zu'} hof={hof} onClose={onClose} />
}

function Bestaetigung({ hof, onClose }: { hof: GruendungAusnehmenHof | null; onClose: () => void }): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const [zugestimmt, setZugestimmt] = useState(false)
  const aenderung = hof?.aenderung ?? null

  function bestaetigen() {
    if (!hof || !aenderung) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis =
        aenderung.richtung === 'ausnehmen'
          ? await nimmAusGruendung({ farmId: hof.id, bestaetigt: aenderung.haken && zugestimmt })
          : await nimmWiederAuf({ farmId: hof.id })
      if ('error' in ergebnis) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(GRUENDUNG_AUSNEHMEN_TEXT.erledigt[aenderung.richtung])
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
        ton: aenderung?.richtung === 'aufnehmen' ? 'gruen' : 'orange',
        laeuft,
        gesperrt: aenderung === null || (aenderung.haken && !zugestimmt),
      }}
    >
      {aenderung && (
        <div className="flex flex-col gap-3.5">
          <p className="text-[14px] leading-relaxed text-foreground">{aenderung.saetze.join(' ')}</p>
          <ul className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted/50 px-3.5 py-3 text-[13px] text-foreground">
            {aenderung.hinweise.map((hinweis) => (
              <li key={hinweis} className="flex gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
                <span>{hinweis}</span>
              </li>
            ))}
          </ul>
          {aenderung.haken && (
            <label
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-[13.5px] leading-snug text-foreground"
            >
              <input
                type="checkbox"
                checked={zugestimmt}
                onChange={(e) => {
                  setZugestimmt(e.target.checked)
                  setFehler(null)
                }}
                className={cn('mt-0.5 size-5 shrink-0 accent-accent', FOKUS_RAHMEN)}
              />
              <span>
                {GRUENDUNG_AUSNEHMEN_TEXT.haken} <span className="text-muted-foreground">{GRUENDUNG_AUSNEHMEN_TEXT.hakenGrund}</span>
              </span>
            </label>
          )}
          <DialogFehler text={fehler} />
        </div>
      )}
    </BestellDialog>
  )
}
