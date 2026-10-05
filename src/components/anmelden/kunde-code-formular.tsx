'use client'

import { useEffect, useId, useRef, useState, type Ref } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import {
  ANMELDECODE_GUELTIG_SEKUNDEN,
  ANMELDECODE_LAENGE,
  anmeldeFehlerText,
  codeVollstaendig,
  restWartezeitSekunden,
} from '@/lib/anmeldecode'
import { codeAnfordernSchema, codeEingabeSchema } from '@/schemas/anmeldecode'
import { CodeFeld } from '@/components/anmelden/code-feld'
import { FEHLER_TEXT, FELD, FELD_LABEL, HINWEIS_TEXT, KNOPF_GRUEN, TEXTKNOPF } from '@/components/anmelden/stil'

const MINUTEN = ANMELDECODE_GUELTIG_SEKUNDEN / 60

/*
 * Die Kunden-Anmeldung mit Code (E7, Nr. 08): E-Mail eingeben → Code aus der
 * Mail eingeben → angemeldet, weiter zu `ziel`. Mockups:
 * web-k0-anmelden-kunde-code-hof-passwort (linke Karte),
 * mobil-k0-anmelden-mit-code.
 *
 * Wiederverwendbar für „Bestellungen finden" (Nr. 14): KundeCodeFormular mit
 * eigenem `ziel` — Ablauf, Texte und Bremsen bleiben dieselben. Entschieden
 * wird nichts hier: Fehlertexte, Wartezeit und Code-Form kommen aus
 * src/lib/anmeldecode.ts, die Prüfung macht Better Auth auf dem Server.
 *
 * Die beiden Schritte sind eigene, reine Darstellungen (CodeEmailSchritt,
 * CodeEingabeSchritt) — so lassen sich alle Zustände ohne Browser rendern
 * (tests/anmelden-seite.test.ts).
 */

export type CodeEmailSchrittProps = {
  email: string
  onEmail: (email: string) => void
  onAbsenden: () => void
  laedt: boolean
  fehler: string | null
}

export function CodeEmailSchritt({ email, onEmail, onAbsenden, laedt, fehler }: CodeEmailSchrittProps): React.JSX.Element {
  const feldId = useId()
  const fehlerId = useId()
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onAbsenden()
      }}
      className="flex flex-col gap-3"
    >
      <p className={HINWEIS_TEXT}>
        Kein Passwort nötig. Wir schicken dir einen {ANMELDECODE_LAENGE}-stelligen Code an deine E-Mail-Adresse.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={feldId} className={FELD_LABEL}>
          E-Mail
        </label>
        <input
          id={feldId}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => onEmail(e.target.value)}
          placeholder="name@beispiel.at"
          aria-invalid={fehler ? true : undefined}
          aria-describedby={fehler ? fehlerId : undefined}
          className={FELD}
        />
        {fehler && (
          <p id={fehlerId} role="alert" className={FEHLER_TEXT}>
            {fehler}
          </p>
        )}
      </div>
      <button type="submit" disabled={laedt} className={KNOPF_GRUEN}>
        {laedt ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={1.7} aria-hidden="true" />
            Einen Moment …
          </>
        ) : (
          'Code schicken'
        )}
      </button>
      <LadeStatus laedt={laedt} />
    </form>
  )
}

export type CodeEingabeSchrittProps = {
  email: string
  code: string
  onCode: (code: string) => void
  onAbsenden: () => void
  onErneut: () => void
  onAndereEmail: () => void
  laedt: boolean
  fehler: string | null
  /** Erfolgsmeldung nach „Code erneut senden". */
  hinweis: string | null
  /** Sekunden, bis „Code erneut senden" wieder geht; 0 = jetzt. */
  wartezeit: number
  /** Für den Fokus zurück ins Feld nach einem Fehler. */
  codeFeldRef?: Ref<HTMLInputElement>
}

export function CodeEingabeSchritt({
  email,
  code,
  onCode,
  onAbsenden,
  onErneut,
  onAndereEmail,
  laedt,
  fehler,
  hinweis,
  wartezeit,
  codeFeldRef,
}: CodeEingabeSchrittProps): React.JSX.Element {
  const feldId = useId()
  const meldungId = useId()
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onAbsenden()
      }}
      className="flex flex-col gap-3"
    >
      <p className={HINWEIS_TEXT}>
        Kein Passwort nötig. Wir haben dir einen {ANMELDECODE_LAENGE}-stelligen Code an{' '}
        <strong className="font-semibold break-words text-foreground">{email}</strong> geschickt. Er gilt {MINUTEN}{' '}
        Minuten.
      </p>
      <label htmlFor={feldId} className="sr-only">
        {ANMELDECODE_LAENGE}-stelliger Code aus der E-Mail
      </label>
      <CodeFeld
        id={feldId}
        wert={code}
        onWert={onCode}
        ungueltig={Boolean(fehler)}
        beschreibtVon={fehler || hinweis ? meldungId : undefined}
        gesperrt={laedt}
        feldRef={codeFeldRef}
      />
      {fehler && (
        <p id={meldungId} role="alert" className={FEHLER_TEXT}>
          {fehler}
        </p>
      )}
      {!fehler && hinweis && (
        <p id={meldungId} role="status" className="text-[13.5px] leading-normal text-status-fertig">
          {hinweis}
        </p>
      )}
      <button type="submit" disabled={laedt} className={KNOPF_GRUEN}>
        {laedt ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={1.7} aria-hidden="true" />
            Einen Moment …
          </>
        ) : (
          'Anmelden'
        )}
      </button>
      <LadeStatus laedt={laedt} />
      <div className="flex flex-wrap justify-between gap-x-2">
        <button type="button" onClick={onErneut} disabled={laedt || wartezeit > 0} className={TEXTKNOPF}>
          {wartezeit > 0 ? `Code erneut senden (${wartezeit} s)` : 'Code erneut senden'}
        </button>
        <button type="button" onClick={onAndereEmail} disabled={laedt} className={TEXTKNOPF}>
          Andere E-Mail
        </button>
      </div>
      <p className="text-[12px] leading-normal text-muted-foreground lg:hidden">
        Der Code wird beim Antippen automatisch aus der E-Mail übernommen, wenn dein Telefon das kann.
      </p>
    </form>
  )
}

/**
 * „Einen Moment …" für den Screenreader. Der Knopftext allein wird nicht
 * angesagt — besonders nicht beim automatischen Absenden, wenn der Fokus im
 * Code-Feld steht. Die Region steht immer da (leer, solange nichts lädt),
 * sonst sagen Screenreader die erste Meldung nicht an.
 */
function LadeStatus({ laedt }: { laedt: boolean }): React.JSX.Element {
  return (
    <p role="status" className="sr-only">
      {laedt ? 'Einen Moment …' : ''}
    </p>
  )
}

type Schritt = 'email' | 'code'

/** Fehler aus dem Better-Auth-Client — nur Code und Status zählen (anmeldeFehlerText). */
function fehlerVon(e: { code?: string; status?: number } | null | undefined): { code?: string; status?: number } {
  return { code: e?.code, status: e?.status }
}

export function KundeCodeFormular({ ziel }: { ziel: string }): React.JSX.Element {
  const router = useRouter()
  const [schritt, setSchritt] = useState<Schritt>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [gesendetUm, setGesendetUm] = useState<number | null>(null)
  const [jetzt, setJetzt] = useState(() => Date.now())
  const codeFeldRef = useRef<HTMLInputElement>(null)

  const wartezeit = restWartezeitSekunden(gesendetUm, jetzt)

  // Der Zähler für „Code erneut senden" läuft nur, solange gewartet wird.
  useEffect(() => {
    if (wartezeit <= 0) return
    const uhr = setInterval(() => setJetzt(Date.now()), 1000)
    return () => clearInterval(uhr)
  }, [wartezeit])

  async function schickeCode(erneut: boolean): Promise<void> {
    setFehler(null)
    setHinweis(null)
    const geprueft = codeAnfordernSchema.safeParse({ email })
    if (!geprueft.success) {
      setFehler(geprueft.error.issues[0]?.message ?? anmeldeFehlerText({ code: 'INVALID_EMAIL' }, 'senden'))
      return
    }
    setLaedt(true)
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email: geprueft.data.email, type: 'sign-in' })
      if (error) {
        setFehler(anmeldeFehlerText(fehlerVon(error), 'senden'))
        return
      }
      setEmail(geprueft.data.email)
      setCode('')
      setSchritt('code')
      const zeit = Date.now()
      setGesendetUm(zeit)
      setJetzt(zeit)
      if (erneut) setHinweis('Wir haben dir einen neuen Code geschickt. Der alte gilt nicht mehr.')
    } catch {
      setFehler(anmeldeFehlerText({}, 'senden'))
    } finally {
      setLaedt(false)
    }
  }

  async function melde(codeJetzt: string): Promise<void> {
    setFehler(null)
    setHinweis(null)
    if (!codeEingabeSchema.safeParse(codeJetzt).success) {
      setFehler(`Bitte gib alle ${ANMELDECODE_LAENGE} Ziffern aus der E-Mail ein.`)
      return
    }
    setLaedt(true)
    try {
      const { error } = await authClient.signIn.emailOtp({ email, otp: codeJetzt })
      if (error) {
        setFehler(anmeldeFehlerText(fehlerVon(error), 'pruefen'))
        // Leeren: Das Feld nimmt nur sechs Ziffern, und neu getippt wird von
        // vorn — der Fehlertext bleibt stehen.
        setCode('')
        setLaedt(false)
        // Zurück ins Feld (readOnly hält den Fokus meist schon; nach einem
        // Klick auf „Anmelden" stand er auf dem gesperrten Knopf).
        codeFeldRef.current?.focus()
        return
      }
      // Angemeldet. Das Ziel ist auf dem Server geprüft (zielNachAnmeldung).
      router.replace(ziel)
      router.refresh()
    } catch {
      setFehler(anmeldeFehlerText({}, 'pruefen'))
      setLaedt(false)
      codeFeldRef.current?.focus()
    }
  }

  if (schritt === 'email') {
    return (
      <CodeEmailSchritt
        email={email}
        onEmail={setEmail}
        onAbsenden={() => void schickeCode(false)}
        laedt={laedt}
        fehler={fehler}
      />
    )
  }

  return (
    <CodeEingabeSchritt
      email={email}
      code={code}
      onCode={(neu) => {
        setCode(neu)
        // Kommt die letzte Ziffer dazu (getippt oder vom Telefon eingesetzt),
        // gleich anmelden — wie in den meisten Apps mit Code.
        if (!laedt && codeVollstaendig(neu) && !codeVollstaendig(code)) void melde(neu)
      }}
      onAbsenden={() => void melde(code)}
      onErneut={() => void schickeCode(true)}
      onAndereEmail={() => {
        setSchritt('email')
        setCode('')
        setFehler(null)
        setHinweis(null)
      }}
      laedt={laedt}
      fehler={fehler}
      hinweis={hinweis}
      wartezeit={wartezeit}
      codeFeldRef={codeFeldRef}
    />
  )
}
