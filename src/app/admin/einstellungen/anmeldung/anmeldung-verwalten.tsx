'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, Plus } from 'lucide-react'
import { ANMELDUNG_EINSTELLUNG_TEXT, passkeyFehlerText } from '@/lib/admin-anmeldung'
import { ERSATZCODE_ANZAHL } from '@/lib/ersatzcodes'
import { passkeyEinrichten } from '@/lib/auth-client-passkey'
import { cn } from '@/lib/utils'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { KNOPF_RAHMEN, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'
import { entfernePasskey, erstelleErsatzcodes, pruefeFrischFuerPasskey } from '@/server/actions/admin-anmeldung'
import { ErsatzcodesAnzeige } from '@/app/admin/einrichten/ersatzcodes-anzeige'

export type PasskeyZeile = { id: string; name: string; eingerichtet: string }

const KARTE = 'flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:p-5'
const H2 = 'font-heading text-lg font-semibold text-foreground'

/**
 * Passkeys und Ersatzcodes auf /admin/einstellungen/anmeldung (Register N20;
 * Mockup system-admin-anmeldung-passkey, Schritt 6). Hinzufügen, Entfernen
 * und „Neue erstellen" gehen nur frisch bestätigt (useFrischBestaetigt); den
 * letzten Passkey entfernt der Server nie. Texte aus src/lib/admin-anmeldung.ts.
 */
export function AnmeldungVerwalten({
  passkeys,
  ersatzcodesUebrig,
  ersatzcodeZeile,
  jetztText,
}: {
  passkeys: readonly PasskeyZeile[]
  ersatzcodesUebrig: number
  /** „zuletzt einer benutzt am …" — fertig vom Server. */
  ersatzcodeZeile: string
  jetztText: string
}): React.JSX.Element {
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const [entfernen, setEntfernen] = useState<PasskeyZeile | null>(null)
  const [neueFrage, setNeueFrage] = useState(false)
  const [codes, setCodes] = useState<string[] | null>(null)
  const frischHinzufuegen = useFrischBestaetigt(pruefeFrischFuerPasskey)
  const frischEntfernen = useFrischBestaetigt(entfernePasskey)
  const frischCodes = useFrischBestaetigt(erstelleErsatzcodes)
  const T = ANMELDUNG_EINSTELLUNG_TEXT

  function hinzufuegen(): void {
    setFehler(null)
    starte(async () => {
      const frisch = await frischHinzufuegen.ausfuehren()
      if ('error' in frisch) {
        setFehler(frisch.error)
        return
      }
      const { error } = await passkeyEinrichten.addPasskey()
      if (error) setFehler(passkeyFehlerText(error))
      else router.refresh()
    })
  }

  function entfernenBestaetigt(): void {
    if (!entfernen) return
    const id = entfernen.id
    setFehler(null)
    starte(async () => {
      const antwort = await frischEntfernen.ausfuehren({ id })
      if ('error' in antwort) {
        setFehler(antwort.error)
        return
      }
      setEntfernen(null)
      router.refresh()
    })
  }

  function neueErstellen(): void {
    setFehler(null)
    starte(async () => {
      const antwort = await frischCodes.ausfuehren()
      if ('error' in antwort) {
        setFehler(antwort.error)
        return
      }
      setNeueFrage(false)
      setCodes(antwort.codes)
    })
  }

  if (codes) {
    return (
      <ErsatzcodesAnzeige
        codes={codes}
        erstellt={jetztText}
        onFertig={() => {
          setCodes(null)
          router.refresh()
        }}
      />
    )
  }

  const letzter = passkeys.length <= 1

  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby="passkeys-titel" className={KARTE}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="passkeys-titel" className={H2}>
            {T.passkeys}
          </h2>
          <button type="button" onClick={hinzufuegen} disabled={laeuft} className={TEXT_GRUEN}>
            <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />
            {T.hinzufuegen}
          </button>
        </div>
        <ul className="flex flex-col">
          {passkeys.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-foreground">
                <KeyRound className="size-4" strokeWidth={1.8} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[14.5px] font-semibold break-words text-foreground">{p.name}</span>
                <span className="text-[12.5px] text-muted-foreground">
                  {T.eingerichtet} {p.eingerichtet}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setEntfernen(p)}
                disabled={laeuft || letzter}
                title={letzter ? T.letzter : undefined}
                className={cn(KNOPF_RAHMEN, 'disabled:opacity-60')}
              >
                {T.entfernen}
              </button>
            </li>
          ))}
        </ul>
        {letzter && <p className="text-[12.5px] leading-snug text-muted-foreground">{T.letzter}</p>}
      </section>

      <section aria-labelledby="ersatzcodes-titel-einstellung" className={KARTE}>
        <h2 id="ersatzcodes-titel-einstellung" className={H2}>
          {T.ersatzcodes}
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            <span className="text-[14.5px] font-semibold text-foreground">
              {ersatzcodesUebrig > 0 ? T.uebrig(ersatzcodesUebrig, ERSATZCODE_ANZAHL) : T.keine}
            </span>
            <span className="text-[12.5px] text-muted-foreground">{ersatzcodeZeile}</span>
          </span>
          <button type="button" onClick={() => setNeueFrage(true)} disabled={laeuft} className={KNOPF_RAHMEN}>
            {T.neueErstellen}
          </button>
        </div>
      </section>

      <DialogFehler text={fehler} />

      <BestellDialog
        offen={entfernen !== null}
        onOffenChange={(o) => {
          if (!o) setEntfernen(null)
        }}
        titel={T.entfernenFrage}
        unterzeile={entfernen?.name}
        hauptaktion={{ text: T.entfernen, onClick: entfernenBestaetigt, ton: 'orange', laeuft }}
      >
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">{T.entfernenSatz}</p>
        {frischEntfernen.dialog}
      </BestellDialog>

      <BestellDialog
        offen={neueFrage}
        onOffenChange={setNeueFrage}
        titel={T.neueFrage}
        hauptaktion={{ text: T.neueErstellen, onClick: neueErstellen, ton: 'gruen', laeuft }}
      >
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">{T.neueSatz}</p>
        {frischCodes.dialog}
      </BestellDialog>

      {frischHinzufuegen.dialog}
    </div>
  )
}
