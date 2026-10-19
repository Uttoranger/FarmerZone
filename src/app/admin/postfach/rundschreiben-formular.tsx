'use client'

import { useId, useMemo, useState, useTransition, type FormEvent } from 'react'
import { Search, Send, Sprout, X } from 'lucide-react'
import { sendeRundschreiben } from '@/server/actions/postfach'
import {
  ADMIN_POSTFACH_TEXT,
  EMPFAENGER_ARTEN,
  EMPFAENGER_LABEL,
  GERADE_EBEN,
  POSTFACH_TEXT,
  TEXT_MAX,
  TITEL_MAX,
  antwortMoeglichStandard,
  appPfadAusLink,
  gesendetText,
  sendenText,
  type EmpfaengerArt,
  type EmpfaengerRegel,
} from '@/lib/postfach'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

type Hof = { id: string; name: string; ort: string }

const FELD = cn('w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground', FOKUS_RAHMEN)
const BESCHRIFTUNG = 'text-[13px] font-semibold text-foreground'
/** Höchstens so viele Treffer der Hofsuche auf einmal — die Suche grenzt weiter ein. */
const TREFFER_MAX = 8

/** Eine Wahl als Pille (Radio) — sichtbar 36 px, Trefferfläche 44 px wie FilterChip. */
function WahlPille({
  name,
  gewaehlt,
  onWahl,
  children,
}: {
  name: string
  gewaehlt: boolean
  onWahl: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label
      className={cn(
        "relative inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[13.5px] whitespace-nowrap transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-[''] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-ring",
        gewaehlt ? 'border-foreground bg-foreground font-semibold text-background' : 'border-border bg-card font-medium text-foreground hover:bg-muted'
      )}
    >
      <input type="radio" name={name} checked={gewaehlt} onChange={onWahl} className="sr-only" />
      {children}
    </label>
  )
}

/**
 * „Neues Rundschreiben" (Register N12, Nr. 87; Mockup admin-rundschreiben):
 * Empfänger alle / ausgewählte (Hofsuche, auch genau einer) / ohne
 * Online-Zahlung / Futter ohne Nummer, Art Info/Wichtig, Titel, Text, Link,
 * „Antwort möglich" (N14, Nr. 95: Standard nach Art — Wichtig an, Info aus —,
 * beim Wechsel der Art neu gesetzt, danach änderbar), „Auch per E-Mail
 * schicken – Betriebsmitteilung", die Vorschau „So sieht’s der Hof" und „An n
 * Höfe senden". Die Zahlen je Filter kommen vom Server;
 * welche Höfe es trifft, rechnet beim Senden der Server noch einmal. Kein
 * maxLength — die Zähler sagen Bescheid, die Grenzen prüft das Schema.
 */
export function RundschreibenFormular({ hoefe, zahlen }: { hoefe: readonly Hof[]; zahlen: Record<EmpfaengerArt, number> }): React.JSX.Element {
  const id = useId()
  const [an, setAn] = useState<EmpfaengerArt>('alle')
  const [gewaehlt, setGewaehlt] = useState<string[]>([])
  const [suche, setSuche] = useState('')
  const [wichtig, setWichtig] = useState(false)
  const [titel, setTitel] = useState('')
  const [text, setText] = useState('')
  const [link, setLink] = useState('')
  const [perMail, setPerMail] = useState(false)
  const [antwortMoeglich, setAntwortMoeglich] = useState(antwortMoeglichStandard('INFO'))
  const [meldung, setMeldung] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null)
  const [laeuft, starte] = useTransition()

  const anzahl = an === 'ausgewaehlt' ? gewaehlt.length : zahlen[an]
  const treffer = useMemo(() => {
    const begriff = suche.trim().toLocaleLowerCase('de')
    if (begriff === '') return []
    return hoefe
      .filter((h) => !gewaehlt.includes(h.id) && `${h.name} ${h.ort}`.toLocaleLowerCase('de').includes(begriff))
      .slice(0, TREFFER_MAX)
  }, [hoefe, gewaehlt, suche])
  const linkFuerHof = link.trim() === '' ? null : appPfadAusLink(link)

  function absenden(ereignis: FormEvent<HTMLFormElement>): void {
    ereignis.preventDefault()
    if (laeuft) return
    const empfaenger: EmpfaengerRegel = an === 'ausgewaehlt' ? { art: 'ausgewaehlt', hofIds: gewaehlt } : { art: an }
    starte(async () => {
      const ergebnis = await sendeRundschreiben({ titel, text, art: wichtig ? 'WICHTIG' : 'INFO', link, perMail, antwortMoeglich, empfaenger })
      if ('error' in ergebnis) {
        setMeldung({ art: 'fehler', text: ergebnis.error })
        return
      }
      setMeldung({ art: 'ok', text: gesendetText(ergebnis.empfaenger) })
      setTitel('')
      setText('')
      setLink('')
      setPerMail(false)
      setWichtig(false)
      setAntwortMoeglich(antwortMoeglichStandard('INFO'))
      setGewaehlt([])
      setSuche('')
    })
  }

  return (
    // Wer weiterschreibt, sieht den Satz zum letzten Senden nicht mehr (Eingaben melden sich hier).
    <form onSubmit={absenden} onInput={() => setMeldung(null)} className="mt-3 flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className={cn(BESCHRIFTUNG, 'mb-2')}>{ADMIN_POSTFACH_TEXT.an}</legend>
        <div className="flex flex-wrap gap-2">
          {EMPFAENGER_ARTEN.map((art) => (
            <WahlPille key={art} name={`${id}-an`} gewaehlt={an === art} onWahl={() => setAn(art)}>
              {EMPFAENGER_LABEL[art]} · {art === 'ausgewaehlt' ? gewaehlt.length : zahlen[art]}
            </WahlPille>
          ))}
        </div>
        {an === 'ausgewaehlt' && (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-suche`} className="sr-only">
              {ADMIN_POSTFACH_TEXT.hofSuchen}
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                id={`${id}-suche`}
                type="search"
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder={ADMIN_POSTFACH_TEXT.hofSuchen}
                className={cn(FELD, 'min-h-11 pl-9')}
              />
            </div>
            {suche.trim() !== '' && (
              <ul aria-label={ADMIN_POSTFACH_TEXT.hofSuchen} className="flex flex-col overflow-hidden rounded-xl border border-border">
                {treffer.length === 0 ? (
                  <li className="px-3.5 py-2.5 text-[13px] text-muted-foreground">{ADMIN_POSTFACH_TEXT.keinTreffer}</li>
                ) : (
                  treffer.map((h) => (
                    <li key={h.id} className="border-t border-border first:border-t-0">
                      <button
                        type="button"
                        onClick={() => {
                          setGewaehlt((liste) => [...liste, h.id])
                          setSuche('')
                        }}
                        className={cn('flex min-h-11 w-full items-center justify-between gap-3 px-3.5 text-left text-sm hover:bg-muted', FOKUS_RAHMEN)}
                      >
                        <span className="truncate font-medium text-foreground">{h.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{h.ort}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
            {gewaehlt.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">{ADMIN_POSTFACH_TEXT.keinHofGewaehlt}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {gewaehlt.map((hofId) => {
                  const hof = hoefe.find((h) => h.id === hofId)
                  return (
                    <li key={hofId}>
                      <button
                        type="button"
                        onClick={() => setGewaehlt((liste) => liste.filter((x) => x !== hofId))}
                        className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-muted px-3 text-[13px] text-foreground hover:bg-card', FOKUS_RAHMEN)}
                      >
                        {hof?.name ?? hofId}
                        <X className="size-3.5" aria-hidden="true" />
                        <span className="sr-only">{ADMIN_POSTFACH_TEXT.entfernen}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={cn(BESCHRIFTUNG, 'mb-2')}>{ADMIN_POSTFACH_TEXT.art}</legend>
        <div className="flex flex-wrap gap-2">
          <WahlPille
            name={`${id}-art`}
            gewaehlt={!wichtig}
            onWahl={() => {
              setWichtig(false)
              setAntwortMoeglich(antwortMoeglichStandard('INFO'))
            }}
          >
            {ADMIN_POSTFACH_TEXT.info}
          </WahlPille>
          <WahlPille
            name={`${id}-art`}
            gewaehlt={wichtig}
            onWahl={() => {
              setWichtig(true)
              setAntwortMoeglich(antwortMoeglichStandard('WICHTIG'))
            }}
          >
            {POSTFACH_TEXT.wichtig}
          </WahlPille>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-titel`} className={BESCHRIFTUNG}>
          {ADMIN_POSTFACH_TEXT.titelFeld}
        </label>
        <input id={`${id}-titel`} value={titel} onChange={(e) => setTitel(e.target.value)} className={cn(FELD, 'min-h-11')} />
        <ZeichenZaehler laenge={titel.length} max={TITEL_MAX} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-text`} className={BESCHRIFTUNG}>
          {ADMIN_POSTFACH_TEXT.textFeld}
        </label>
        <textarea id={`${id}-text`} value={text} onChange={(e) => setText(e.target.value)} rows={5} className={cn(FELD, 'resize-y')} />
        <ZeichenZaehler laenge={text.length} max={TEXT_MAX} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-link`} className={BESCHRIFTUNG}>
          {ADMIN_POSTFACH_TEXT.linkFeld}
        </label>
        <input id={`${id}-link`} value={link} onChange={(e) => setLink(e.target.value)} placeholder={ADMIN_POSTFACH_TEXT.linkBeispiel} className={cn(FELD, 'min-h-11')} aria-describedby={`${id}-link-hinweis`} />
        <p id={`${id}-link-hinweis`} className="text-xs text-muted-foreground">
          {ADMIN_POSTFACH_TEXT.linkHinweis}
        </p>
      </div>

      <label className="flex items-start gap-2.5 rounded-xl border border-border px-3.5 py-3">
        <input type="checkbox" checked={antwortMoeglich} onChange={(e) => setAntwortMoeglich(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{ADMIN_POSTFACH_TEXT.antwortMoeglich}</span>
          <span className="text-[12.5px] text-muted-foreground">{ADMIN_POSTFACH_TEXT.antwortMoeglichSatz}</span>
        </span>
      </label>

      <label className="flex items-start gap-2.5 rounded-xl border border-border px-3.5 py-3">
        <input type="checkbox" checked={perMail} onChange={(e) => setPerMail(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{ADMIN_POSTFACH_TEXT.perMail}</span>
          <span className="text-[12.5px] text-muted-foreground">{ADMIN_POSTFACH_TEXT.perMailSatz}</span>
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <p className={BESCHRIFTUNG}>{ADMIN_POSTFACH_TEXT.soSiehtsDerHof}</p>
        <div className="flex flex-col gap-2 rounded-2xl border border-accent/60 bg-card p-3.5" aria-live="polite">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent/12">
              <Sprout className="size-4 text-brand-text" strokeWidth={1.9} />
            </span>
            <span className="truncate text-[12.5px] font-semibold">{POSTFACH_TEXT.absender}</span>
            {wichtig && <Marke art="tun">{POSTFACH_TEXT.wichtig}</Marke>}
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">{GERADE_EBEN}</span>
          </div>
          <p className="text-base leading-snug font-semibold break-words">{titel.trim() || ADMIN_POSTFACH_TEXT.titelFeld}</p>
          {text.trim() !== '' && <p className="text-sm leading-relaxed break-words whitespace-pre-line">{text}</p>}
          {linkFuerHof && (
            <span className="flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground">{POSTFACH_TEXT.linkKnopf}</span>
          )}
        </div>
      </div>

      {meldung && (
        <p role={meldung.art === 'fehler' ? 'alert' : 'status'} className={cn('text-[13px]', meldung.art === 'fehler' ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          {meldung.text}
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={laeuft || anzahl === 0}
          aria-busy={laeuft}
          className={cn(
            'inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
            FOKUS_RAHMEN
          )}
        >
          <Send className="size-4" strokeWidth={1.8} aria-hidden="true" />
          {sendenText(anzahl)}
        </button>
      </div>
    </form>
  )
}
