'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { EINGANG_TEXT } from '@/lib/postfach'
import { ADMIN_BESTELLUNG_TEXT } from '@/lib/admin-bestellung'
import { ADMIN_GRUND_MAX } from '@/schemas/admin-aktion'
import { markiereErstattungErledigt } from '@/server/actions/admin-bestellung'
import { cn } from '@/lib/utils'
import { FELD, FELD_LABEL, KNOPF_GRUEN, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'

/**
 * „Erstattung erledigt" in der Aufgabe „Erstattung offen" (Register N14,
 * Ergänzung; Nr. 105): Umriss-Knopf, darunter die Rückfrage in der Seite —
 * kein Dialog, kein window.confirm. Erst „Ja, erstattet" ruft die Action;
 * sie ändert nur das Merkmal der Bestellung. Danach lädt die Seite neu: Die
 * Aufgabe ist weg, „Davon Geld" zählt eins weniger. Seit Nr. 186 dieselbe
 * Aktion wie „Außerhalb erstattet …“ in Admin › Bestellungen, darum mit
 * Grund (Pflicht); Nr. 193 nimmt den Knopf hier weg.
 */
export function ErstattungErledigt({ orderId }: { orderId: string }): React.JSX.Element {
  const router = useRouter()
  const [fragt, setFragt] = useState(false)
  const [grund, setGrund] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()
  const frage = useRef<HTMLParagraphElement>(null)
  const knopf = useRef<HTMLButtonElement>(null)
  const warOffen = useRef(false)
  // „Erstattung erledigt" ist heikel (Register N20): frisch mit Passkey bestätigt.
  const frischErledigt = useFrischBestaetigt(markiereErstattungErledigt)
  const ohneGrund = grund.trim() === '' || [...grund.trim()].length > ADMIN_GRUND_MAX

  // Der Fokus folgt der Rückfrage und kehrt beim Abbrechen zum Knopf zurück.
  useEffect(() => {
    if (fragt) frage.current?.focus()
    else if (warOffen.current) knopf.current?.focus()
    warOffen.current = fragt
  }, [fragt])

  if (!fragt) {
    return (
      <button ref={knopf} type="button" onClick={() => setFragt(true)} className={cn(KNOPF_RAHMEN, 'self-start')}>
        {EINGANG_TEXT.erstattungErledigt}
      </button>
    )
  }

  function bestaetige(): void {
    setFehler(null)
    starte(async () => {
      const ergebnis = await frischErledigt.ausfuehren({ orderId, grund })
      if ('error' in ergebnis) {
        setFehler(ergebnis.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3.5">
      <p ref={frage} tabIndex={-1} className="text-[14px] leading-relaxed text-foreground outline-none">
        {EINGANG_TEXT.erstattungErledigtFrage}
      </p>
      <div>
        <label htmlFor={`erledigt-grund-${orderId}`} className={FELD_LABEL}>
          {ADMIN_BESTELLUNG_TEXT.grund}
        </label>
        <textarea id={`erledigt-grund-${orderId}`} rows={2} value={grund} onChange={(e) => setGrund(e.target.value)} className={cn(FELD, 'min-h-[72px] resize-none')} />
        <p className={cn('mt-1 text-[12.5px]', LEISE)}>{ADMIN_BESTELLUNG_TEXT.grundHilfe}</p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={() => setFragt(false)} disabled={laeuft} className={KNOPF_RAHMEN}>
          {EINGANG_TEXT.erstattungErledigtAbbrechen}
        </button>
        <button type="button" onClick={bestaetige} disabled={laeuft || ohneGrund} className={KNOPF_GRUEN}>
          {EINGANG_TEXT.erstattungErledigtJa}
        </button>
      </div>
      {frischErledigt.dialog}
      {fehler && (
        <p role="alert" className="text-[13px] text-destructive">
          {fehler}
        </p>
      )}
    </div>
  )
}
