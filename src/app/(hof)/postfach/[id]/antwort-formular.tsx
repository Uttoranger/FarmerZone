'use client'

import { useEffect, useState, useTransition, type FormEvent } from 'react'
import { antworteAlsHof } from '@/server/actions/postfach'
import { POSTFACH_TEXT, TEXT_MAX } from '@/lib/postfach'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'
import { FADEN_ENDE_ID, rollVerhalten } from '@/lib/postfach-rollen'

/**
 * Das Feld „Antwort an das Team …" unter dem Faden (Mockup
 * mobil-h6-unterhaltung). Die Antwort geht nur an das Team (MARKE_TEAM im
 * Hinweis). Am Handy klebt das Feld über der Unterleiste, damit man nach dem
 * Lesen nicht suchen muss; unten 28 px Luft, weil der Neu-Knopf 20 px über die
 * Leiste ragt (`-mt-5` in ui/bottom-nav.tsx) und sonst den Hinweis verdeckte. Kein maxLength: Der Zähler sagt ab 80 % Bescheid,
 * die Grenze prüft der Server (CODING_STANDARDS §8). Fehler stehen am Feld.
 *
 * Nach dem Senden rollt die Seite zum Anker unter dem Faden (Nr. 308): Sonst
 * läge die eigene Antwort hinter dem klebenden Feld. Ohne Zeitschaltung, bei
 * „weniger Bewegung“ ohne Gleiten; der Fokus bleibt im Feld.
 */
export function AntwortFormular({ unterhaltungId }: { unterhaltungId: string }): React.JSX.Element {
  const [text, setText] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  // Zählt erfolgreiche Antworten; 0 = noch keine, dann wird nicht gerollt.
  const [antworten, setAntworten] = useState(0)

  useEffect(() => {
    if (antworten === 0) return
    document.getElementById(FADEN_ENDE_ID)?.scrollIntoView({
      block: 'end',
      behavior: rollVerhalten(window.matchMedia('(prefers-reduced-motion: reduce)').matches),
    })
  }, [antworten])

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
      setAntworten((n) => n + 1)
    })
  }

  return (
    <form
      onSubmit={absenden}
      className="sticky bottom-[calc(68px+env(safe-area-inset-bottom))] -mx-4 mt-5 flex flex-col gap-2 border-t border-border bg-background/95 px-4 pt-3 pb-7 backdrop-blur md:bottom-0 md:mx-0 md:rounded-[12px] md:border md:bg-card md:px-4 md:pb-3"
    >
      {/* Board s2/w2-postfach: „Deine Antwort" sichtbar über dem Feld, darunter Hinweis und „Senden" in Orange (V51: Hauptknopf im Hofbereich). */}
      <label htmlFor="postfach-antwort" className="text-[15px] font-semibold text-foreground">
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
          'min-h-[46px] w-full resize-y rounded-[14px] border border-input bg-card px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground',
          FOKUS_RAHMEN
        )}
      />
      <ZeichenZaehler laenge={text.length} max={TEXT_MAX} />
      {fehler !== null && (
        <p id="postfach-antwort-fehler" role="alert" className="text-[14px] font-semibold text-status-offen">
          {fehler}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <p id="postfach-antwort-hinweis" className="flex min-w-0 items-center gap-1.5 text-[12.5px] leading-snug text-muted-foreground">
          {POSTFACH_TEXT.antwortHinweis}
        </p>
        <button
          type="submit"
          disabled={laeuft}
          aria-busy={laeuft}
          className={cn(
            'inline-flex min-h-12 shrink-0 items-center justify-center rounded-[14px] bg-primary px-[22px] text-[16px] font-bold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
            FOKUS_RAHMEN
          )}
        >
          {laeuft ? POSTFACH_TEXT.sendet : POSTFACH_TEXT.senden}
        </button>
      </div>
    </form>
  )
}
