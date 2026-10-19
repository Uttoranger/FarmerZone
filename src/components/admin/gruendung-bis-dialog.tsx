'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { setzeGruendungBisAction } from '@/server/actions/admin'
import {
  GRUENDUNG_BIS_DIALOG,
  GRUENDUNG_BIS_MARKE,
  GRUENDUNG_BIS_TITEL,
  verkuerztGruendungTag,
  type GruendungAnzeige,
} from '@/lib/gruendungshof'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'

/** Ein Gründungshof, wie der Dialog ihn braucht — nur Höfe mit Platz haben ein Ende. */
export type GruendungsHof = { id: string; name: string; gruendung: GruendungAnzeige }

/**
 * „Gründungshof bis" eines Hofs einstellen (Nr. 62, Register K2; Vorbild
 * ServicegebuehrDialog): ein Tag oder leer = Standard. Gespeichert wird über
 * setzeGruendungBisAction, die alles prüft. Liegt der neue Tag vor dem bisher
 * wirksamen, fragt der Dialog nach der Zustimmung des Hofs (K1) und schickt
 * sie mit — der Server verlangt sie ohnehin.
 */
export function GruendungBisDialog({ hof, onClose }: { hof: GruendungsHof | null; onClose: () => void }): React.JSX.Element {
  // Das Feld startet bei jedem Hof frisch — deshalb hängt der Schlüssel am Hof.
  return <Formular key={hof?.id ?? 'zu'} hof={hof} onClose={onClose} />
}

function Formular({ hof, onClose }: { hof: GruendungsHof | null; onClose: () => void }): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  // Leer heißt Standard; ein eigenes Datum steht als Tag im Feld.
  const [tag, setTag] = useState(hof?.gruendung.abweichend ? hof.gruendung.bisTag : '')
  const [zugestimmt, setZugestimmt] = useState(false)
  const verkuerzt = hof !== null && verkuerztGruendungTag(hof.gruendung.bisTag, tag || hof.gruendung.standardTag)

  function aendere(neu: string) {
    setTag(neu)
    // Eine Zustimmung gilt für den Tag, für den sie gegeben wurde.
    setZugestimmt(false)
    setFehler(null)
  }

  function speichern() {
    if (!hof) return
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await setzeGruendungBisAction(hof.id, { gruendungBis: tag, bestaetigt: verkuerzt && zugestimmt })
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(tag ? 'Gründungshof-Ende gespeichert' : 'Auf den Standard zurückgesetzt')
      onClose()
    })
  }

  return (
    <BestellDialog
      offen={hof !== null}
      onOffenChange={(offen) => {
        if (!offen) onClose()
      }}
      titel={GRUENDUNG_BIS_TITEL}
      unterzeile={hof?.name}
      hauptaktion={{ text: 'Speichern', onClick: speichern, ton: 'gruen', laeuft, gesperrt: verkuerzt && !zugestimmt }}
    >
      {hof && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            speichern()
          }}
        >
          <p className="text-[13.5px] text-muted-foreground">
            Jetzt: <span className="text-foreground">{hof.gruendung.bisText}</span>
            {` · ${hof.gruendung.abweichend ? GRUENDUNG_BIS_MARKE.abweichend : GRUENDUNG_BIS_MARKE.standard}`}
          </p>

          <label className="block">
            <span className={FELD_LABEL}>{GRUENDUNG_BIS_DIALOG.feld}</span>
            <input type="date" value={tag} onChange={(e) => aendere(e.target.value)} className={FELD} />
            <span className="mt-1 block text-[12px] text-muted-foreground">{GRUENDUNG_BIS_DIALOG.leer}</span>
          </label>

          {tag !== '' && (
            <button type="button" onClick={() => aendere('')} disabled={laeuft} className={cn(TEXT_GRUEN, 'self-start')}>
              {GRUENDUNG_BIS_DIALOG.zuruecksetzen}
            </button>
          )}

          {verkuerzt && (
            <Hinweiskarte ton="orange" titel={GRUENDUNG_BIS_DIALOG.zustimmung}>
              <p>{GRUENDUNG_BIS_DIALOG.frueher(hof.gruendung.bisText)}</p>
              <label className="mt-1 flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={zugestimmt}
                  onChange={(e) => setZugestimmt(e.target.checked)}
                  className="size-5 shrink-0 accent-accent"
                />
                {GRUENDUNG_BIS_DIALOG.zugestimmt}
              </label>
            </Hinweiskarte>
          )}
          <DialogFehler text={fehler} />
        </form>
      )}
    </BestellDialog>
  )
}
