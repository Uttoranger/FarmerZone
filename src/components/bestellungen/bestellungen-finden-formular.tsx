'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ANMELDECODE_LAENGE, codeVollstaendig, restWartezeitSekunden } from '@/lib/anmeldecode'
import { bestellCodeFehlerText } from '@/lib/bestellungen-finden'
import { bestellCodeAnfordernSchema } from '@/schemas/bestellungen-finden'
import { codeEingabeSchema } from '@/schemas/anmeldecode'
import { fordereBestellCodeAn, zeigeBestellungen } from '@/server/actions/bestellungen-finden'
import { CodeEingabeSchritt, CodeEmailSchritt } from '@/components/anmelden/kunde-code-formular'

/*
 * „Bestellungen finden" (Nr. 14): E-Mail → Code aus der Mail → Liste. Dieselbe
 * Gestalt wie die Kunden-Anmeldung (CodeEmailSchritt, CodeEingabeSchritt aus
 * Nr. 08), aber ein eigener Ablauf über die Server Actions in
 * src/server/actions/bestellungen-finden.ts — ohne Better Auth: kein Konto,
 * keine Sitzung. Nach dem richtigen Code setzt der Server einen Cookie, und
 * die Seite lädt sich neu (router.refresh) — dann zeigt sie die Liste.
 */

type Schritt = 'email' | 'code'

export function BestellungenFindenFormular(): React.JSX.Element {
  const router = useRouter()
  const [schritt, setSchritt] = useState<Schritt>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [laedt, setLaedt] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [gesendetUm, setGesendetUm] = useState<number | null>(null)
  const [jetzt, setJetzt] = useState(() => Date.now())
  const [, startTransition] = useTransition()
  const codeFeldRef = useRef<HTMLInputElement>(null)

  const wartezeit = restWartezeitSekunden(gesendetUm, jetzt)

  useEffect(() => {
    if (wartezeit <= 0) return
    const uhr = setInterval(() => setJetzt(Date.now()), 1000)
    return () => clearInterval(uhr)
  }, [wartezeit])

  async function schickeCode(erneut: boolean): Promise<void> {
    setFehler(null)
    setHinweis(null)
    const geprueft = bestellCodeAnfordernSchema.safeParse({ email })
    if (!geprueft.success) {
      setFehler(geprueft.error.issues[0]?.message ?? 'Bitte gib eine gültige E-Mail-Adresse ein.')
      return
    }
    setLaedt(true)
    try {
      const antwort = await fordereBestellCodeAn({ email: geprueft.data.email })
      if ('error' in antwort) {
        setFehler(antwort.error)
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
      setFehler('Wir konnten dir gerade keinen Code schicken. Probier es gleich noch einmal.')
    } finally {
      setLaedt(false)
    }
  }

  async function pruefe(codeJetzt: string): Promise<void> {
    setFehler(null)
    setHinweis(null)
    if (!codeEingabeSchema.safeParse(codeJetzt).success) {
      setFehler(`Bitte gib alle ${ANMELDECODE_LAENGE} Ziffern aus der E-Mail ein.`)
      return
    }
    setLaedt(true)
    try {
      const antwort = await zeigeBestellungen({ email, code: codeJetzt })
      if ('error' in antwort) {
        setFehler(antwort.error)
        // Leeren: neu getippt wird von vorn, der Fehlertext bleibt stehen.
        setCode('')
        setLaedt(false)
        codeFeldRef.current?.focus()
        return
      }
      // Der Cookie steht — die Seite rendert jetzt die Liste.
      startTransition(() => router.refresh())
    } catch {
      setFehler(bestellCodeFehlerText('UNBEKANNT'))
      setLaedt(false)
      codeFeldRef.current?.focus()
    }
  }

  if (schritt === 'email') {
    return (
      <CodeEmailSchritt
        variante="bestellungen"
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
      variante="bestellungen"
      email={email}
      code={code}
      onCode={(neu) => {
        setCode(neu)
        if (!laedt && codeVollstaendig(neu) && !codeVollstaendig(code)) void pruefe(neu)
      }}
      onAbsenden={() => void pruefe(code)}
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
