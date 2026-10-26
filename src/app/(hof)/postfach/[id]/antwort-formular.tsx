'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { Lock, SendHorizontal } from 'lucide-react'
import { antworteAlsHof } from '@/server/actions/postfach'
import { POSTFACH_TEXT, TEXT_MAX } from '@/lib/postfach'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * Das Feld „Antwort an das Team …" unter dem Faden (Mockup
 * mobil-h6-unterhaltung). Die Antwort geht nur an das Team (MARKE_TEAM im
 * Hinweis). Am Handy klebt das Feld über der Unterleiste, damit man nach dem
 * Lesen nicht suchen muss; unten 28 px Luft, weil der Neu-Knopf 20 px über die
 * Leiste ragt (`-mt-5` in ui/bottom-nav.tsx) und sonst den Hinweis verdeckte. Kein maxLength: Der Zähler sagt ab 80 % Bescheid,
 * die Grenze prüft der Server (CODING_STANDARDS §8). Fehler stehen am Feld.
 */
export function AntwortFormular({ unterhaltungId }: { unterhaltungId: string }): React.JSX.Element {
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()

  function absenden(ereignis: FormEvent<HTMLFormElement>): void {
    ereignis.preventDefault()
    if (laeuft) return
    starte(async () => {
      const ergebnis = await antworteAlsHof({ unterhaltungId, text })
      if ('error' in ergebnis) {
        setFehler(ergebnis.error)
        return
      }
      setFehler(null)
      setText('')
    })
  }

  return (
    <form
      onSubmit={absenden}
      className="sticky bottom-[calc(68px+env(safe-area-inset-bottom))] -mx-4 mt-5 flex flex-col gap-2 border-t border-border bg-background/95 px-4 pt-3 pb-7 backdrop-blur md:bottom-0 md:mx-0 md:rounded-2xl md:border md:bg-card md:px-4 md:pb-3"
    >
      <div className="flex items-end gap-2">
        <label htmlFor="postfach-antwort" className="sr-only">
          {POSTFACH_TEXT.antwortBeschriftung}
        </label>
        <textarea
          id="postfach-antwort"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={POSTFACH_TEXT.antwortFeld}
          rows={2}
          aria-invalid={fehler !== null}
          aria-describedby={fehler !== null ? 'postfach-antwort-fehler' : 'postfach-antwort-hinweis'}
          className={cn(
            'min-h-[46px] flex-1 resize-y rounded-[14px] border border-input bg-card px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground',
            FOKUS_RAHMEN
          )}
        />
        <button
          type="submit"
          disabled={laeuft}
          aria-busy={laeuft}
          className={cn(
            'flex size-[46px] shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
            FOKUS_RAHMEN
          )}
        >
          <SendHorizontal className="size-5" strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only">{POSTFACH_TEXT.senden}</span>
        </button>
      </div>
      <ZeichenZaehler laenge={text.length} max={TEXT_MAX} />
      {fehler !== null && (
        <p id="postfach-antwort-fehler" role="alert" className="text-[13px] font-medium text-destructive">
          {fehler}
        </p>
      )}
      <p id="postfach-antwort-hinweis" className="flex items-center gap-1.5 text-[11.5px] leading-snug text-muted-foreground">
        <Lock className="size-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        {POSTFACH_TEXT.antwortHinweis}
      </p>
    </form>
  )
}
