'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react'
import { ADMIN_ANMELDEN_TEXT, ADMIN_PFAD, passkeyFehlerText } from '@/lib/admin-anmeldung'
import { meldeMitErsatzcodeAn, passkeySignIn } from '@/lib/auth-client-passkey'
import { cn } from '@/lib/utils'
import { FEHLER_TEXT, FELD, FELD_LABEL, KNOPF_GRUEN, TEXTKNOPF } from '@/components/anmelden/stil'

/*
 * Die Karte auf /login/admin (Register N20; Mockup system-admin-anmeldung-
 * passkey, Schritt 1): EIN Knopf „Mit Passkey anmelden" ohne E-Mail-Eingabe —
 * was dann kommt (Handy mit QR-Code, dieser PC, Sicherheitsschlüssel), zeigt
 * der Browser, nicht wir. Darunter „Ersatzcode eingeben" für den Notfall.
 * Nach der Anmeldung geht es nach /admin; dort greift die Pflicht (nach einem
 * Ersatzcode: neuer Passkey).
 */
export function AdminAnmeldungKarte(): React.JSX.Element {
  const router = useRouter()
  const emailId = useId()
  const codeId = useId()
  const fehlerId = useId()
  const [laeuft, setLaeuft] = useState<'passkey' | 'ersatzcode' | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [ersatzOffen, setErsatzOffen] = useState(false)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

  function weiter(): void {
    router.push(ADMIN_PFAD.bereich)
    router.refresh()
  }

  async function mitPasskey(): Promise<void> {
    setLaeuft('passkey')
    setFehler(null)
    try {
      const { error } = await passkeySignIn.passkey()
      if (error) {
        setFehler(passkeyFehlerText(error))
        return
      }
      weiter()
    } finally {
      setLaeuft(null)
    }
  }

  async function mitErsatzcode(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setLaeuft('ersatzcode')
    setFehler(null)
    try {
      const { error } = await meldeMitErsatzcodeAn(email, code)
      if (error) {
        setFehler(passkeyFehlerText(error))
        return
      }
      weiter()
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <section aria-labelledby="admin-anmeldung-titel" className="flex w-full max-w-[470px] flex-col gap-4 rounded-[18px] border border-border bg-card p-6 sm:p-7">
      <h1 id="admin-anmeldung-titel" className="font-heading text-[25px] leading-tight font-semibold text-foreground">
        {ADMIN_ANMELDEN_TEXT.titel}
      </h1>
      <p className="text-[14.5px] leading-normal text-muted-foreground">{ADMIN_ANMELDEN_TEXT.einleitung}</p>

      <button
        type="button"
        onClick={() => void mitPasskey()}
        disabled={laeuft !== null}
        aria-busy={laeuft === 'passkey' || undefined}
        className={cn(KNOPF_GRUEN, 'h-[52px] w-full text-[15.5px]')}
      >
        {laeuft === 'passkey' ? (
          <Loader2 className="size-[19px] animate-spin" strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <KeyRound className="size-[19px]" strokeWidth={1.8} aria-hidden="true" />
        )}
        {laeuft === 'passkey' ? ADMIN_ANMELDEN_TEXT.knopfLaeuft : ADMIN_ANMELDEN_TEXT.knopf}
      </button>

      {fehler && (
        <p id={fehlerId} role="alert" aria-live="polite" className={FEHLER_TEXT}>
          {fehler}
        </p>
      )}

      {!ersatzOffen ? (
        <div className="flex justify-center">
          <button type="button" onClick={() => setErsatzOffen(true)} className={TEXTKNOPF} aria-expanded={false}>
            {ADMIN_ANMELDEN_TEXT.ersatzcodeOeffnen}
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void mitErsatzcode(e)} className="flex flex-col gap-3 border-t border-border pt-4" aria-label={ADMIN_ANMELDEN_TEXT.ersatzcodeTitel}>
          <h2 className="text-[15px] font-semibold text-foreground">{ADMIN_ANMELDEN_TEXT.ersatzcodeTitel}</h2>
          <p className="text-[13px] leading-normal text-muted-foreground">{ADMIN_ANMELDEN_TEXT.ersatzcodeSatz}</p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={emailId} className={FELD_LABEL}>
              {ADMIN_ANMELDEN_TEXT.email}
            </label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              aria-describedby={fehler ? fehlerId : undefined}
              className={FELD}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={codeId} className={FELD_LABEL}>
              {ADMIN_ANMELDEN_TEXT.code}
            </label>
            <input
              id={codeId}
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={ADMIN_ANMELDEN_TEXT.codePlatzhalter}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              required
              aria-describedby={fehler ? fehlerId : undefined}
              className={cn(FELD, 'font-mono tracking-wider uppercase')}
            />
          </div>
          <button type="submit" disabled={laeuft !== null} aria-busy={laeuft === 'ersatzcode' || undefined} className={cn(KNOPF_GRUEN, 'w-full')}>
            {laeuft === 'ersatzcode' && <Loader2 className="size-4 animate-spin" strokeWidth={1.8} aria-hidden="true" />}
            {ADMIN_ANMELDEN_TEXT.ersatzcodeKnopf}
          </button>
        </form>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border border-primary/45 bg-primary/12 px-3.5 py-3 text-[13px] leading-normal text-foreground">
        <ShieldCheck className="mt-px size-4 shrink-0 text-status-offen" strokeWidth={1.8} aria-hidden="true" />
        <span>{ADMIN_ANMELDEN_TEXT.hinweis}</span>
      </div>
    </section>
  )
}
