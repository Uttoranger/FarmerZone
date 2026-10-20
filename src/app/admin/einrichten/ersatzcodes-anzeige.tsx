'use client'

import { useId, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { ERSATZCODES_TEXT, ERSATZCODE_DATEINAME, ersatzcodeDatei } from '@/lib/ersatzcodes'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'

/**
 * Die 10 Ersatzcodes, genau einmal nach dem Erstellen (Register N20; Mockup
 * system-admin-anmeldung-passkey, Schritt 5): „Ausdrucken", „Als Datei
 * speichern", der Haken „Ich habe die Codes sicher aufbewahrt" und erst dann
 * „Fertig". Die Codes leben nur im Zustand dieser Ansicht — nach „Fertig" sind
 * sie weg; in der Datenbank steht nur ihr HMAC.
 */
export function ErsatzcodesAnzeige({ codes, erstellt, onFertig }: { codes: readonly string[]; erstellt: string; onFertig: () => void }): React.JSX.Element {
  const hakenId = useId()
  const [gesichert, setGesichert] = useState(false)

  function speichern(): void {
    const datei = new Blob([ersatzcodeDatei(codes, erstellt)], { type: 'text/plain;charset=utf-8' })
    const adresse = URL.createObjectURL(datei)
    const link = document.createElement('a')
    link.href = adresse
    link.download = ERSATZCODE_DATEINAME
    link.click()
    URL.revokeObjectURL(adresse)
  }

  return (
    <section aria-labelledby="ersatzcodes-titel" className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <h2 id="ersatzcodes-titel" className="font-heading text-xl font-semibold text-foreground">
        {ERSATZCODES_TEXT.titel}
      </h2>
      <p className="text-[14px] leading-normal text-muted-foreground">
        {ERSATZCODES_TEXT.satzVor} <strong className="font-semibold text-foreground">{ERSATZCODES_TEXT.einmal}</strong>
        {ERSATZCODES_TEXT.satzNach}
      </p>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-2">
        {codes.map((code) => (
          <li key={code} className="rounded-xl border border-border bg-background px-3 py-2.5 text-center font-mono text-[15px] font-semibold tracking-wider text-foreground">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2.5 print:hidden">
        <button type="button" onClick={() => window.print()} className={KNOPF_RAHMEN}>
          <Printer className="size-4" strokeWidth={1.7} aria-hidden="true" />
          {ERSATZCODES_TEXT.ausdrucken}
        </button>
        <button type="button" onClick={speichern} className={KNOPF_RAHMEN}>
          <Download className="size-4" strokeWidth={1.7} aria-hidden="true" />
          {ERSATZCODES_TEXT.datei}
        </button>
      </div>
      <label htmlFor={hakenId} className={cn('flex min-h-11 items-center gap-3 rounded-xl text-[14px] text-foreground print:hidden', FOKUS_RAHMEN)}>
        <input id={hakenId} type="checkbox" checked={gesichert} onChange={(e) => setGesichert(e.target.checked)} className="size-5 accent-accent" />
        {ERSATZCODES_TEXT.haken}
      </label>
      <button type="button" onClick={onFertig} disabled={!gesichert} className={cn(KNOPF_GRUEN, 'self-start print:hidden')}>
        {ERSATZCODES_TEXT.fertig}
      </button>
      <p className="text-[12.5px] leading-snug text-muted-foreground">{ERSATZCODES_TEXT.nurJetzt}</p>
    </section>
  )
}
