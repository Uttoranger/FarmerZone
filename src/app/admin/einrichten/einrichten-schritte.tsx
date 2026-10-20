'use client'

import { useId, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, KeyRound, Loader2, Lock } from 'lucide-react'
import { ADMIN_PFAD, EINRICHTEN_TEXT, passkeyFehlerText, type EinrichtenZustand } from '@/lib/admin-anmeldung'
import { passkeyEinrichten } from '@/lib/auth-client-passkey'
import { signOut } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FELD, FELD_LABEL, KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'
import { erstelleErsatzcodes, pruefeEinrichtungscode, pruefeFrischFuerPasskey, schickeEinrichtungscode } from '@/server/actions/admin-anmeldung'
import { ErsatzcodesAnzeige } from './ersatzcodes-anzeige'

export type EinrichtenAnsicht = {
  zustand: EinrichtenZustand
  /** „heute, 13:52 – gilt 15 Minuten …" — fertig vom Server. */
  bestaetigtText: string | null
  /** Der Satz mit dem Ende des 24-Stunden-Fensters, fertig vom Server; null = kein Fenster. */
  fensterText: string | null
  codeOffen: boolean
  ersatzcodes: number
  /** Zeitpunkt für die Datei der Ersatzcodes („19.10. um 14:32"). */
  jetztText: string
  /** Die Sitzung entstand aus einem Ersatzcode (auch schon eingelöst) — Schritt 1 sagt dann das, nicht „Passwort und Code". */
  mitErsatzcode: boolean
}

type SchrittArt = 'fertig' | 'aktiv' | 'spaeter'

function Schritt({ art, titel, satz, children }: { art: SchrittArt; titel: string; satz?: string | null; children?: React.ReactNode }): React.JSX.Element {
  return (
    // Kommende Schritte gedämpft nur über Tokens (Seitenfläche, gestrichelter Kreis, Schloss) wie im
    // Mockup — keine Deckkraft: Sie zöge die Nebenzeile unter 4,5:1 Kontrast (Axe, Runde 1).
    <li className={cn('flex gap-3.5 rounded-2xl border p-4', art === 'aktiv' ? 'border-accent/45 bg-card' : art === 'fertig' ? 'border-border bg-card' : 'border-border bg-background')}>
      <span
        aria-hidden="true"
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full border',
          art === 'fertig' ? 'border-accent bg-accent text-accent-foreground' : 'border-border text-muted-foreground',
          art === 'spaeter' && 'border-2 border-dashed'
        )}
      >
        {art === 'fertig' ? <Check className="size-4" strokeWidth={2.2} /> : art === 'spaeter' ? <Lock className="size-3.5" strokeWidth={1.8} /> : <KeyRound className="size-4" strokeWidth={1.8} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold break-words text-foreground">{titel}</p>
          {satz && <p className="text-[13px] leading-snug break-words text-muted-foreground">{satz}</p>}
        </div>
        {children}
      </div>
    </li>
  )
}

/**
 * Die Schritte der Pflichtseite (Register N20; Mockup system-admin-
 * anmeldung-passkey, Schritte 4 und 5): bestätigt mit Passwort und Code per
 * E-Mail → Passkey einrichten → Ersatzcodes sichern → zweiter Passkey
 * (empfohlen). Was gilt, entscheidet der Server (einrichtenZustand); nach
 * jedem Schritt lädt die Seite neu.
 */
export function EinrichtenSchritte({ ansicht }: { ansicht: EinrichtenAnsicht }): React.JSX.Element {
  const router = useRouter()
  const codeId = useId()
  const fehlerId = useId()
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [codeGeschickt, setCodeGeschickt] = useState(ansicht.codeOffen)
  const [codes, setCodes] = useState<string[] | null>(null)
  const ersatz = useFrischBestaetigt(erstelleErsatzcodes)
  const zweiter = useFrischBestaetigt(pruefeFrischFuerPasskey)

  function schicken(): void {
    setFehler(null)
    starte(async () => {
      const antwort = await schickeEinrichtungscode()
      if ('error' in antwort) setFehler(antwort.error)
      else setCodeGeschickt(true)
    })
  }

  function pruefen(e: React.FormEvent): void {
    e.preventDefault()
    setFehler(null)
    starte(async () => {
      const antwort = await pruefeEinrichtungscode({ code })
      if ('error' in antwort) setFehler(antwort.error)
      else router.refresh()
    })
  }

  function passkeyAnlegen(vorher?: () => Promise<{ ok: true } | { error: string }>): void {
    setFehler(null)
    starte(async () => {
      if (vorher) {
        const frisch = await vorher()
        if ('error' in frisch) {
          setFehler(frisch.error)
          return
        }
      }
      const { error } = await passkeyEinrichten.addPasskey()
      if (error) {
        setFehler(passkeyFehlerText(error))
        return
      }
      router.refresh()
    })
  }

  function ersatzcodesErstellen(): void {
    setFehler(null)
    starte(async () => {
      const antwort = await ersatz.ausfuehren()
      if ('error' in antwort) setFehler(antwort.error)
      else setCodes(antwort.codes)
    })
  }

  function neuAnmelden(): void {
    starte(async () => {
      await signOut()
      router.push('/login')
    })
  }

  if (codes) {
    return (
      <ErsatzcodesAnzeige
        codes={codes}
        erstellt={ansicht.jetztText}
        onFertig={() => {
          setCodes(null)
          router.refresh()
        }}
      />
    )
  }

  const z = ansicht.zustand
  const fehlerZeile = fehler && (
    <p id={fehlerId} role="alert" className="rounded-xl border border-primary/45 bg-primary/12 px-3.5 py-2.5 text-[13px] font-medium text-foreground">
      {fehler}
    </p>
  )

  if (z === 'gesperrt' || z === 'ersatzcode-abgelaufen') {
    return (
      <Hinweiskarte ton="orange" symbol={Lock} titel={z === 'gesperrt' ? EINRICHTEN_TEXT.gesperrt : EINRICHTEN_TEXT.schrittPasskey}>
        <p>{z === 'gesperrt' ? EINRICHTEN_TEXT.gesperrtSatz : EINRICHTEN_TEXT.ersatzcodeAbgelaufen}</p>
        {z === 'ersatzcode-abgelaufen' && (
          <Link href={ADMIN_PFAD.anmelden} className={cn('mt-2 inline-flex min-h-11 items-center font-semibold text-status-fertig underline underline-offset-2', FOKUS_RAHMEN)}>
            {EINRICHTEN_TEXT.zurAnmeldung}
          </Link>
        )}
      </Hinweiskarte>
    )
  }

  const bestaetigt = z === 'passkey' || z === 'eingerichtet'
  const passkeyDa = z === 'eingerichtet'
  const kannEinrichten = z === 'passkey' || z === 'ersatzcode'

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2.5">
        {z === 'ersatzcode' ? (
          <Schritt art="fertig" titel={EINRICHTEN_TEXT.schrittErsatzcode} satz={EINRICHTEN_TEXT.ersatzcodeSatz} />
        ) : (
          <Schritt
            art={bestaetigt ? 'fertig' : 'aktiv'}
            titel={ansicht.mitErsatzcode ? EINRICHTEN_TEXT.schrittErsatzcode : EINRICHTEN_TEXT.schrittBestaetigt}
            satz={bestaetigt ? ansicht.bestaetigtText : null}
          >
            {z === 'neu-anmelden' && (
              <>
                <p className="text-[13px] leading-snug text-muted-foreground">{EINRICHTEN_TEXT.passwortNoetig}</p>
                <button type="button" onClick={neuAnmelden} disabled={laeuft} className={cn(KNOPF_RAHMEN, 'self-start')}>
                  {EINRICHTEN_TEXT.neuAnmelden}
                </button>
              </>
            )}
            {z === 'bestaetigen' && (
              <div className="flex flex-col gap-2.5">
                {codeGeschickt && (
                  <form onSubmit={pruefen} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex min-w-0 flex-col">
                      <label htmlFor={codeId} className={FELD_LABEL}>
                        {EINRICHTEN_TEXT.codeFeld}
                      </label>
                      <input
                        id={codeId}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        aria-invalid={fehler ? true : undefined}
                        aria-describedby={fehler ? fehlerId : undefined}
                        className={cn(FELD, 'font-mono tracking-[0.3em] sm:w-44')}
                      />
                    </div>
                    <button type="submit" disabled={laeuft} className={KNOPF_GRUEN}>
                      {EINRICHTEN_TEXT.codePruefen}
                    </button>
                  </form>
                )}
                {codeGeschickt && <p className="text-[12.5px] leading-snug text-muted-foreground">{EINRICHTEN_TEXT.codeGeschickt}</p>}
                <button type="button" onClick={schicken} disabled={laeuft} className={cn(codeGeschickt ? KNOPF_RAHMEN : KNOPF_GRUEN, 'self-start')}>
                  {codeGeschickt ? EINRICHTEN_TEXT.codeErneut : EINRICHTEN_TEXT.codeSchicken}
                </button>
              </div>
            )}
          </Schritt>
        )}

        <Schritt art={passkeyDa ? 'fertig' : kannEinrichten ? 'aktiv' : 'spaeter'} titel={passkeyDa ? EINRICHTEN_TEXT.eingerichtet : EINRICHTEN_TEXT.schrittPasskey} satz={EINRICHTEN_TEXT.schrittPasskeySatz}>
          {kannEinrichten && (
            <button type="button" onClick={() => passkeyAnlegen()} disabled={laeuft} aria-busy={laeuft || undefined} className={cn(KNOPF_GRUEN, 'self-start')}>
              {laeuft ? <Loader2 className="size-4 animate-spin" strokeWidth={1.8} aria-hidden="true" /> : <KeyRound className="size-4" strokeWidth={1.8} aria-hidden="true" />}
              {laeuft ? EINRICHTEN_TEXT.einrichtenLaeuft : EINRICHTEN_TEXT.einrichten}
            </button>
          )}
        </Schritt>

        <Schritt
          art={passkeyDa ? (ansicht.ersatzcodes > 0 ? 'fertig' : 'aktiv') : 'spaeter'}
          titel={passkeyDa && ansicht.ersatzcodes > 0 ? EINRICHTEN_TEXT.ersatzcodesGesichert : EINRICHTEN_TEXT.schrittErsatzcodes}
          satz={passkeyDa && ansicht.ersatzcodes > 0 ? null : EINRICHTEN_TEXT.schrittErsatzcodesSatz}
        >
          {passkeyDa && ansicht.ersatzcodes === 0 && (
            <button type="button" onClick={ersatzcodesErstellen} disabled={laeuft} className={cn(KNOPF_GRUEN, 'self-start')}>
              {EINRICHTEN_TEXT.ersatzcodesErstellen}
            </button>
          )}
        </Schritt>

        <Schritt art={passkeyDa ? 'aktiv' : 'spaeter'} titel={EINRICHTEN_TEXT.schrittZweiter} satz={EINRICHTEN_TEXT.schrittZweiterSatz}>
          {passkeyDa && (
            <button type="button" onClick={() => passkeyAnlegen(zweiter.ausfuehren)} disabled={laeuft} className={cn(KNOPF_RAHMEN, 'self-start')}>
              {EINRICHTEN_TEXT.zweiterEinrichten}
            </button>
          )}
        </Schritt>
      </ol>

      {fehlerZeile}
      {ansicht.fensterText && !passkeyDa && <p className="text-[13px] leading-snug text-muted-foreground">{ansicht.fensterText}</p>}
      {passkeyDa && (
        <Link href={ADMIN_PFAD.bereich} className={cn(KNOPF_GRUEN, 'self-start')}>
          {EINRICHTEN_TEXT.fertig}
        </Link>
      )}
      {ersatz.dialog}
      {zweiter.dialog}
    </div>
  )
}
