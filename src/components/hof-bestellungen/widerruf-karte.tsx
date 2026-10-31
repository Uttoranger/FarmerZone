'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Undo2 } from 'lucide-react'
import { WIDERRUF_GRENZEN, WIDERRUF_TEXT } from '@/lib/widerruf'
import { erstatteWiderrufAction, lehneWiderrufAbAction } from '@/server/actions/widerruf'
import type { HofWiderruf } from '@/server/widerruf'
import { aktionOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from './bestell-dialog'
import { FELD, FELD_LABEL, KARTE, KICKER, KNOPF_GRUEN, LEISE, TEXT_ORANGE } from './stil'

type Offen = { art: 'erstatten' | 'ablehnen'; id: string } | null

/**
 * Die Widerrufe einer Bestellung im Bestell-Detail des Hofs (Nr. 200, N39):
 * was widerrufen wurde, wann, und die zwei Knöpfe „Rückgabe erhalten –
 * erstatten …“ und „Ablehnen …“ (Grund Pflicht). Gebucht wird auf dem Server
 * (src/server/widerruf.ts, über teilerstattung.ts); hier steht kein Betrag.
 */
export function WiderrufKarte({ widerrufe }: { widerrufe: readonly HofWiderruf[] }): React.JSX.Element | null {
  const [offen, setOffen] = useState<Offen>(null)
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const router = useRouter()
  if (widerrufe.length === 0) return null
  const aktuell = offen ? widerrufe.find((w) => w.id === offen.id) : undefined

  function ausfuehren() {
    if (!offen) return
    setFehler(null)
    if (offen.art === 'ablehnen' && grund.trim() === '') {
      setFehler(WIDERRUF_TEXT.hofGrundFehlt)
      return
    }
    starte(async () => {
      const ergebnis = await aktionOhneWurf(
        () => (offen.art === 'erstatten' ? erstatteWiderrufAction({ widerrufId: offen.id }) : lehneWiderrufAbAction({ widerrufId: offen.id, grund })),
        { unsicher: true }
      )
      if ('error' in ergebnis && ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(offen.art === 'erstatten' ? WIDERRUF_TEXT.hofErstattet : WIDERRUF_TEXT.hofAbgelehnt)
      setOffen(null)
      setGrund('')
      router.refresh()
    })
  }

  return (
    <section aria-labelledby="widerruf-titel" className={cn(KARTE, 'flex flex-col gap-3 border-primary/60 px-4 py-4')}>
      <h2 id="widerruf-titel" className={cn(KICKER, 'flex items-center gap-2 text-foreground')}>
        <Undo2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
        {WIDERRUF_TEXT.hofKarteTitel}
      </h2>
      {widerrufe.map((w) => (
        <div key={w.id} className="flex flex-col gap-2 border-t border-border pt-3 first-of-type:border-t-0 first-of-type:pt-0">
          <p className={cn('text-[12.5px]', LEISE)}>{w.eingegangenAm}</p>
          <ul className="flex flex-col gap-0.5 text-[14px] text-foreground">
            {w.umfang.map((z) => (
              <li key={z} className="break-words">
                {z}
              </li>
            ))}
          </ul>
          <p className={cn('text-[12.5px]', LEISE)}>{WIDERRUF_TEXT.hofAusnahme}</p>
          <div className="flex flex-wrap gap-2">
            {w.erstattbar && (
              <button type="button" onClick={() => setOffen({ art: 'erstatten', id: w.id })} disabled={laeuft} className={KNOPF_GRUEN}>
                {WIDERRUF_TEXT.hofErstatten}
              </button>
            )}
            <button type="button" onClick={() => setOffen({ art: 'ablehnen', id: w.id })} disabled={laeuft} className={TEXT_ORANGE}>
              {WIDERRUF_TEXT.hofAblehnen}
            </button>
          </div>
        </div>
      ))}

      <BestellDialog
        offen={offen?.art === 'erstatten'}
        onOffenChange={(o) => !o && setOffen(null)}
        titel={WIDERRUF_TEXT.hofErstatten.replace(' …', '')}
        unterzeile={aktuell?.bestellnummer}
        hauptaktion={{ text: 'Erstatten', onClick: ausfuehren, ton: 'gruen', laeuft }}
      >
        <div className="flex flex-col gap-2 text-[13.5px]">
          <p>{aktuell?.bar ? WIDERRUF_TEXT.hofBarSatz : WIDERRUF_TEXT.hofErstattenSatz}</p>
          <DialogFehler text={offen?.art === 'erstatten' ? fehler : null} />
        </div>
      </BestellDialog>

      <BestellDialog
        offen={offen?.art === 'ablehnen'}
        onOffenChange={(o) => !o && setOffen(null)}
        titel={WIDERRUF_TEXT.hofAblehnen.replace(' …', '')}
        unterzeile={aktuell?.bestellnummer}
        hauptaktion={{ text: 'Ablehnen', onClick: ausfuehren, ton: 'orange', laeuft }}
      >
        <div className="flex flex-col gap-1.5 text-[13.5px]">
          <label htmlFor="widerruf-grund" className={cn(FELD_LABEL, 'mb-0')}>
            {WIDERRUF_TEXT.hofGrund}
          </label>
          <textarea
            id="widerruf-grund"
            value={grund}
            onChange={(e) => setGrund(e.target.value)}
            maxLength={WIDERRUF_GRENZEN.grund}
            rows={3}
            required
            aria-describedby="widerruf-grund-hinweis"
            className={cn(FELD, 'min-h-[88px] resize-y leading-normal')}
          />
          <p id="widerruf-grund-hinweis" className={cn('text-xs', LEISE)}>
            {WIDERRUF_TEXT.hofGrundHinweis}
          </p>
          <DialogFehler text={offen?.art === 'ablehnen' ? fehler : null} />
        </div>
      </BestellDialog>
    </section>
  )
}
