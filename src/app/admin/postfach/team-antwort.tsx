'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'
import { SendHorizontal } from 'lucide-react'
import { antworteAlsTeam } from '@/server/actions/postfach'
import { ADMIN_POSTFACH_TEXT, POSTFACH_TEXT, TEXT_MAX } from '@/lib/postfach'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

const FELD = cn('rounded-xl border border-input bg-card px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground', FOKUS_RAHMEN)
const HAKEN = 'flex min-h-11 items-center gap-2 text-[13px] text-foreground'

/**
 * Das Antwortfeld unter einem Faden im Admin (Mockup admin-postfach): „Als
 * Wichtig markieren", „Link einfügen", „Auch per E-Mail (Betriebsmitteilung)".
 * Ob die E-Mail wirklich geht, entscheidet der Server (höchstens eine je Faden
 * und Stunde) — der Satz danach sagt es ehrlich.
 */
export function TeamAntwort({ unterhaltungId, hofName }: { unterhaltungId: string; hofName: string }): React.JSX.Element {
  const id = useId()
  const [text, setText] = useState('')
  const [wichtig, setWichtig] = useState(false)
  const [mitLink, setMitLink] = useState(false)
  const [link, setLink] = useState('')
  const [perMail, setPerMail] = useState(false)
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [laeuft, starte] = useTransition()

  function absenden(ereignis: FormEvent<HTMLFormElement>): void {
    ereignis.preventDefault()
    if (laeuft) return
    starte(async () => {
      const ergebnis = await antworteAlsTeam({ unterhaltungId, text, wichtig, link: mitLink ? link : null, perMail })
      if ('error' in ergebnis) {
        setMeldung({ art: 'fehler', text: ergebnis.error })
        return
      }
      setMeldung({
        art: 'ok',
        text: ergebnis.mail === 'unterwegs' ? ADMIN_POSTFACH_TEXT.mitMail : ergebnis.mail === 'gedrosselt' ? ADMIN_POSTFACH_TEXT.gedrosselt : ADMIN_POSTFACH_TEXT.gespeichert,
      })
      setText('')
      setWichtig(false)
      setMitLink(false)
      setLink('')
      setPerMail(false)
    })
  }

  return (
    <form onSubmit={absenden} onInput={() => setMeldung(null)} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <label htmlFor={`${id}-text`} className="sr-only">
          {POSTFACH_TEXT.antwortBeschriftung}
        </label>
        <textarea
          id={`${id}-text`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={ADMIN_POSTFACH_TEXT.antwortFeld(hofName)}
          rows={2}
          className={cn(FELD, 'min-h-[46px] flex-1 resize-y')}
        />
        <button
          type="submit"
          disabled={laeuft}
          aria-busy={laeuft}
          className={cn(
            'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
            FOKUS_RAHMEN
          )}
        >
          <SendHorizontal className="size-4" strokeWidth={1.8} aria-hidden="true" />
          {POSTFACH_TEXT.senden}
        </button>
      </div>
      <ZeichenZaehler laenge={text.length} max={TEXT_MAX} />
      <div className="flex flex-wrap gap-x-5 gap-y-0.5">
        <label className={HAKEN}>
          <input type="checkbox" checked={wichtig} onChange={(e) => setWichtig(e.target.checked)} className="size-4 accent-primary" />
          {ADMIN_POSTFACH_TEXT.alsWichtig}
        </label>
        <label className={HAKEN}>
          <input type="checkbox" checked={mitLink} onChange={(e) => setMitLink(e.target.checked)} className="size-4 accent-primary" />
          {ADMIN_POSTFACH_TEXT.linkEinfuegen}
        </label>
        <label className={HAKEN}>
          <input type="checkbox" checked={perMail} onChange={(e) => setPerMail(e.target.checked)} className="size-4 accent-primary" />
          {ADMIN_POSTFACH_TEXT.auchPerMail}
        </label>
      </div>
      {mitLink && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-link`} className="text-[13px] font-medium text-foreground">
            {ADMIN_POSTFACH_TEXT.linkFeld}
          </label>
          <input id={`${id}-link`} value={link} onChange={(e) => setLink(e.target.value)} placeholder="/products" className={cn(FELD, 'min-h-11')} />
          <p className="text-xs text-muted-foreground">{ADMIN_POSTFACH_TEXT.linkHinweis}</p>
        </div>
      )}
      {meldung && (
        <p role={meldung.art === 'fehler' ? 'alert' : 'status'} className={cn('text-[13px]', meldung.art === 'fehler' ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          {meldung.text}
        </p>
      )}
    </form>
  )
}
