'use client'

import { useId, useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Plus, Send } from 'lucide-react'
import { entferneEmpfaenger, fuegeEmpfaengerHinzu, sendeTestmail, speichereZustellRegeln } from '@/server/actions/postfach'
import {
  SCHALTBARE_ARTEN,
  ZUSTELL_REGEL_REIHENFOLGE,
  ZUSTELL_REGEL_TEXT,
  ZUSTELLUNG_TEXT,
  regelAn,
  type SchaltbareArt,
  type ZustellRegeln,
} from '@/lib/zustellung'
import { cn } from '@/lib/utils'
import { Marke } from '@/components/ui/marke'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KNOPF_GRUEN, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'

/** Eine weitere Adresse, wie die Seite sie zeigt — ohne Token, ohne Ablauf. */
export type EmpfaengerAnzeige = { id: string; email: string; bestaetigt: boolean; zeile: string }

type Meldung = { art: 'ok' | 'fehler'; text: string } | null

const UEBERSCHRIFT = 'font-heading text-lg font-semibold text-foreground'
const FELD = cn('min-h-11 w-full min-w-0 rounded-xl border border-input bg-card px-3.5 text-[15px] text-foreground placeholder:text-muted-foreground', FOKUS_RAHMEN)

function istSchaltbar(art: string): art is SchaltbareArt {
  return (SCHALTBARE_ARTEN as readonly string[]).includes(art)
}

function Satz({ meldung }: { meldung: Meldung }): React.JSX.Element | null {
  if (!meldung) return null
  return (
    <p role={meldung.art === 'fehler' ? 'alert' : 'status'} className={cn('text-[13px]', meldung.art === 'fehler' ? 'font-medium text-destructive' : LEISE)}>
      {meldung.text}
    </p>
  )
}

/**
 * Postfach › Zustellung (Register N14, Nr. 95; Mockup admin-postfach-zustellung).
 * Empfänger: SUPPORT_EMAIL fest, weitere Adressen hinzufügen (Bestätigungslink,
 * 48 h) und sofort entfernen — beides gleich auf dem Server, ohne „Speichern".
 * Regeln: je schaltbare Art ein Haken; „Erstattung offen" ist immer an,
 * Wünsche und Fragen immer nur im Eingang (fest, N14). Gespeichert wird mit
 * „Speichern", „Verwerfen" stellt den gespeicherten Stand wieder her.
 * „Testmail an alle senden" geht an die ganze Liste. Ob etwas geklappt hat,
 * entscheidet der Server — die Sätze darunter sagen es.
 */
export function PostfachZustellung({
  supportEmail,
  regeln,
  empfaenger,
}: {
  supportEmail: string
  regeln: ZustellRegeln
  empfaenger: readonly EmpfaengerAnzeige[]
}): React.JSX.Element {
  const id = useId()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [entwurf, setEntwurf] = useState<ZustellRegeln>(regeln)
  const [listenSatz, setListenSatz] = useState<Meldung>(null)
  const [regelSatz, setRegelSatz] = useState<Meldung>(null)
  const [laeuft, starte] = useTransition()
  // Einen Empfänger hinzufügen ist heikel (Register N20, Ergänzung 23.10.2026): frisch mit Passkey bestätigt.
  const frischHinzufuegen = useFrischBestaetigt(fuegeEmpfaengerHinzu)
  const geaendert = SCHALTBARE_ARTEN.some((art) => entwurf[art] !== regeln[art])

  function hinzufuegen(ereignis: FormEvent<HTMLFormElement>): void {
    ereignis.preventDefault()
    if (laeuft) return
    starte(async () => {
      const ergebnis = await frischHinzufuegen.ausfuehren({ email })
      if ('error' in ergebnis) {
        setListenSatz({ art: 'fehler', text: ergebnis.error })
        return
      }
      setListenSatz({ art: 'ok', text: ZUSTELLUNG_TEXT.unterwegs(ergebnis.email) })
      setEmail('')
      router.refresh()
    })
  }

  function entfernen(empfaengerId: string): void {
    if (laeuft) return
    starte(async () => {
      const ergebnis = await entferneEmpfaenger({ id: empfaengerId })
      setListenSatz('error' in ergebnis ? { art: 'fehler', text: ergebnis.error } : null)
      router.refresh()
    })
  }

  function speichern(): void {
    if (laeuft) return
    starte(async () => {
      const ergebnis = await speichereZustellRegeln(Object.fromEntries(SCHALTBARE_ARTEN.map((art) => [art, entwurf[art]])))
      setRegelSatz('error' in ergebnis ? { art: 'fehler', text: ergebnis.error } : { art: 'ok', text: ZUSTELLUNG_TEXT.gespeichert })
      if (!('error' in ergebnis)) router.refresh()
    })
  }

  function testmail(): void {
    if (laeuft) return
    starte(async () => {
      const ergebnis = await sendeTestmail()
      setRegelSatz('error' in ergebnis ? { art: 'fehler', text: ergebnis.error } : { art: 'ok', text: ZUSTELLUNG_TEXT.testmailUnterwegs(ergebnis.empfaenger) })
    })
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-[18px]">
      <section aria-labelledby={`${id}-empfaenger`} className={cn(KARTE, 'flex min-w-0 flex-col gap-3 px-4 py-4 md:px-5 dark:ring-1 dark:ring-border')}>
        {frischHinzufuegen.dialog}
        <div>
          <h2 id={`${id}-empfaenger`} className={UEBERSCHRIFT}>
            {ZUSTELLUNG_TEXT.empfaengerTitel}
          </h2>
          <p className={cn('mt-0.5 text-[13px]', LEISE)}>{ZUSTELLUNG_TEXT.empfaengerSatz}</p>
        </div>
        <ul aria-label={ZUSTELLUNG_TEXT.empfaengerBeschriftung} className="flex flex-col">
          <li className="flex min-h-11 items-center gap-3 border-t border-border py-2.5 first:border-t-0">
            <Mail className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-foreground" title={supportEmail}>
                {supportEmail}
              </span>
              <span className={cn('text-[12.5px]', LEISE)}>{ZUSTELLUNG_TEXT.festSatz}</span>
            </span>
            <Marke art="erledigt" className="shrink-0">
              {ZUSTELLUNG_TEXT.fest}
            </Marke>
          </li>
          {empfaenger.map((e) => (
            <li key={e.id} className="flex min-h-11 items-center gap-3 border-t border-border py-2.5">
              <Mail className={cn('size-4 shrink-0', e.bestaetigt ? 'text-muted-foreground' : 'text-zustand-tun')} strokeWidth={1.8} aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-foreground" title={e.email}>
                  {e.email}
                </span>
                <span className={cn('text-[12.5px] break-words', LEISE)}>{e.zeile}</span>
              </span>
              <button type="button" onClick={() => entfernen(e.id)} disabled={laeuft} aria-label={ZUSTELLUNG_TEXT.entfernenSr(e.email)} className={cn(KNOPF_RAHMEN, 'shrink-0')}>
                {ZUSTELLUNG_TEXT.entfernen}
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={hinzufuegen} onInput={() => setListenSatz(null)} className="flex flex-col gap-2 border-t border-border pt-3">
          <label htmlFor={`${id}-email`} className="text-[13px] font-semibold text-foreground">
            {ZUSTELLUNG_TEXT.hinzufuegenTitel}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={ZUSTELLUNG_TEXT.platzhalter}
              aria-describedby={`${id}-hinweis`}
              className={FELD}
            />
            <button type="submit" disabled={laeuft || email.trim() === ''} aria-busy={laeuft} className={cn(KNOPF_GRUEN, 'shrink-0')}>
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              {ZUSTELLUNG_TEXT.hinzufuegen}
            </button>
          </div>
          <p id={`${id}-hinweis`} className={cn('text-[12.5px] leading-relaxed', LEISE)}>
            {ZUSTELLUNG_TEXT.hinweis}
          </p>
          <Satz meldung={listenSatz} />
        </form>
      </section>

      <section aria-labelledby={`${id}-regeln`} className={cn(KARTE, 'flex min-w-0 flex-col gap-3 px-4 py-4 md:px-5 dark:ring-1 dark:ring-border')}>
        <div>
          <h2 id={`${id}-regeln`} className={UEBERSCHRIFT}>
            {ZUSTELLUNG_TEXT.regelnTitel}
          </h2>
          <p className={cn('mt-0.5 text-[13px]', LEISE)}>{ZUSTELLUNG_TEXT.regelnSatz}</p>
        </div>
        <fieldset className="flex flex-col">
          <legend className="sr-only">{ZUSTELLUNG_TEXT.regelnTitel}</legend>
          {ZUSTELL_REGEL_REIHENFOLGE.map((art) => {
            const schaltbar = istSchaltbar(art)
            return (
              <label key={art} className="flex min-h-11 items-start gap-2.5 border-t border-border py-2.5 first:border-t-0">
                <input
                  type="checkbox"
                  checked={schaltbar ? entwurf[art] : regelAn(art, entwurf)}
                  disabled={!schaltbar || laeuft}
                  onChange={(e) => {
                    if (!schaltbar) return
                    setRegelSatz(null)
                    setEntwurf((stand) => ({ ...stand, [art]: e.target.checked }))
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span className={cn('text-sm', schaltbar ? 'text-foreground' : LEISE)}>{ZUSTELL_REGEL_TEXT[art]}</span>
              </label>
            )
          })}
        </fieldset>
        <Satz meldung={regelSatz} />
        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button type="button" onClick={testmail} disabled={laeuft} className={cn(KNOPF_RAHMEN, 'sm:mr-auto')}>
            <Send className="size-4" strokeWidth={1.8} aria-hidden="true" />
            {ZUSTELLUNG_TEXT.testmail}
          </button>
          <button
            type="button"
            onClick={() => {
              setEntwurf(regeln)
              setRegelSatz(null)
            }}
            disabled={laeuft || !geaendert}
            className={KNOPF_RAHMEN}
          >
            {ZUSTELLUNG_TEXT.verwerfen}
          </button>
          <button type="button" onClick={speichern} disabled={laeuft || !geaendert} aria-busy={laeuft} className={KNOPF_GRUEN}>
            {ZUSTELLUNG_TEXT.speichern}
          </button>
        </div>
      </section>
    </div>
  )
}
