'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { HOFPREIS_RUECKFRAGE_TEXT, HOFPREIS_STICHTAG_TEXT, hofpreisStichtagSatz, pruefeHofpreisStichtag } from '@/lib/plattform-einstellung'
import { speichereHofpreisStichtag } from '@/server/actions/plattform-einstellung'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FELD, FELD_LABEL, KNOPF_GRUEN } from '@/components/hof-bestellungen/stil'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'
import { HOFPREIS_KARTE_ID } from '@/lib/plattformgebuehr'

const TEXT = HOFPREIS_STICHTAG_TEXT

/** Register N40 (Nr. 201): im Testmodus von Stripe — der Stichtag ist eine Vorbedingung des Live-Gangs (docs/betrieb/stripe-live.md). */
export const VOR_LIVE_HINWEIS = 'Vor dem Live-Gang von Stripe auf den Live-Tag oder früher setzen.'

/**
 * Der Stichtag „Hofpreis-Modell ab“ (Register N38, Nr. 197, Punkt 6) — eine
 * Karte in Admin › Einstellungen. Nur Text an den Client (CODING_STANDARDS
 * §2): der gespeicherte Tag, ob er schon erreicht ist, und die Uhr der Seite.
 * Dieselbe Regel wie die Action (`pruefeHofpreisStichtag`); verbindlich prüft
 * die Action mit dem Stand aus der Datenbank, frisch mit Passkey bestätigt.
 * Vor dem Passkey eine Rückfrage (Nr. 303 B1): Der Tag schaltet Preis, AGB und
 * Monatsabrechnung und ist erreicht nicht mehr änderbar — „Stichtag speichern“
 * öffnet sie, erst „Mit Passkey speichern“ ruft die Action.
 */
export function HofpreisStichtag({
  daten,
  stripeTest = false,
}: {
  daten: { tag: string; stichtagIso: string | null; erreicht: boolean; jetzt: string }
  /** Stripe läuft im Testmodus (nur der Wahrheitswert, nie der Schlüssel) — dann der Hinweis vor dem Live-Gang (N40). */
  stripeTest?: boolean
}): React.JSX.Element {
  const router = useRouter()
  const [laeuft, startTransition] = useTransition()
  const [tag, setTag] = useState(daten.tag)
  const [fehler, setFehler] = useState<string | null>(null)
  const [rueckfrage, setRueckfrage] = useState(false)
  const frisch = useFrischBestaetigt(speichereHofpreisStichtag)
  const feldId = useId()
  const satzId = useId()

  const bisher = { hofpreisModellAb: daten.stichtagIso ? new Date(daten.stichtagIso) : null }
  const geaendert = tag !== daten.tag

  /** „Stichtag speichern“: erst die Regel, dann die Rückfrage — noch kein Aufruf. */
  function fragen(): void {
    const regel = pruefeHofpreisStichtag(tag, bisher, new Date(daten.jetzt))
    if (regel !== null) {
      setFehler(regel)
      return
    }
    setFehler(null)
    setRueckfrage(true)
  }

  /** „Mit Passkey speichern“ in der Rückfrage: erst hier läuft die Action. */
  function speichern(): void {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await frisch.ausfuehren({ tag })
      if ('error' in ergebnis) {
        // Der Grund steht in der Rückfrage — sie bleibt offen.
        setFehler(ergebnis.error)
        return
      }
      setRueckfrage(false)
      toast.success(TEXT.gespeichert)
      router.refresh()
    })
  }

  return (
    <section id={HOFPREIS_KARTE_ID} aria-labelledby={`${feldId}-titel`} className="flex scroll-mt-6 flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 lg:p-5">
      <h2 id={`${feldId}-titel`} className="font-heading text-lg font-semibold text-foreground">
        {TEXT.titel}
      </h2>
      {/* Nach dem Stichtag „Seit diesem Tag gilt …“ ohne „Vorher bleibt alles wie heute.“ (V62, Board s3/w3-admin-einstellungen Bild 4). */}
      <p id={satzId} className="text-[13px] leading-snug text-muted-foreground">
        {hofpreisStichtagSatz(daten.erreicht)}
      </p>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          fragen()
        }}
      >
        <div className="flex min-w-0 flex-col sm:w-60">
          <label htmlFor={feldId} className={FELD_LABEL}>
            {TEXT.feld}
          </label>
          <input
            id={feldId}
            type="date"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            disabled={daten.erreicht || laeuft}
            aria-describedby={satzId}
            className={cn(FELD, FOKUS_RAHMEN, 'min-h-11', daten.erreicht && 'cursor-default bg-muted')}
          />
        </div>
        {!daten.erreicht && (
          <button type="submit" disabled={!geaendert || laeuft} aria-busy={laeuft || undefined} className={KNOPF_GRUEN}>
            {laeuft ? TEXT.speichert : TEXT.speichern}
          </button>
        )}
      </form>
      {daten.erreicht && <p className="text-[12.5px] leading-snug text-muted-foreground">{TEXT.erreicht}</p>}
      {stripeTest && !daten.erreicht && <p className="text-[12.5px] leading-snug text-muted-foreground">{VOR_LIVE_HINWEIS}</p>}
      <DialogFehler text={rueckfrage ? null : fehler} />
      <BestellDialog
        offen={rueckfrage}
        onOffenChange={(offen) => {
          if (offen) return
          setRueckfrage(false)
          setFehler(null)
        }}
        titel={HOFPREIS_RUECKFRAGE_TEXT.titel(tag)}
        hauptaktion={{ text: HOFPREIS_RUECKFRAGE_TEXT.knopf, onClick: speichern, ton: 'gruen', laeuft }}
      >
        {frisch.dialog}
        <div className="flex flex-col gap-3 text-[14px] text-muted-foreground">
          <ul className="flex list-disc flex-col gap-1.5 pl-5">
            {HOFPREIS_RUECKFRAGE_TEXT.punkte.map((punkt) => (
              <li key={punkt}>{punkt}</li>
            ))}
          </ul>
          <p>{HOFPREIS_RUECKFRAGE_TEXT.satz}</p>
          <DialogFehler text={fehler} />
        </div>
      </BestellDialog>
    </section>
  )
}
