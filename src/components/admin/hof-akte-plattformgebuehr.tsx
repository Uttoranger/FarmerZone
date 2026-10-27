'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { speichereHofPlattformgebuehr } from '@/server/actions/admin-plattformgebuehr'
import { abrechnungStandWort } from '@/lib/plattformgebuehr'
import { centsAlsEuro, formatEuro, formatZahl } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FELD, FELD_LABEL, KARTE, KNOPF_GRUEN, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'

/** Was die Akte über die Plattformgebühr zeigt — nur Text, Zahlen und Cent (kein Date an den Browser). */
export type PlattformgebuehrAkteAnzeige = {
  farmId: string
  mandat: boolean
  abrechnungen: Array<{ id: string; monatText: string; barCents: number; onlineCents: number; stand: string }>
  nichtAbgeholt: { bar: number; nicht: number }
  einstellungen: { satz: string; mandatPflicht: boolean; sperreTage: number; abrechnungsTag: number; einzugAb: string; vorgabeEinzugAb: string }
}

const euro = (cents: number): string => formatEuro(centsAlsEuro(cents))

/** „3 von 20 (15 %)“ — ganze Prozent, abgerundet, ohne Gleitkomma. */
function quoteText(bar: number, nicht: number): string {
  if (bar === 0) return 'keine Barbestellungen'
  return `${formatZahl(nicht)} von ${formatZahl(bar)} (${Math.floor((nicht * 100) / bar)} %)`
}

/**
 * Admin › Hof-Akte › „Plattformgebühr“ (Register N38, Nr. 198; Abschnitt aus
 * Nr. 187): Mandat, die letzten Abrechnungen, die Quote „nicht abgeholt bei
 * bar, 90 Tage“ und die Einstellungen je Hof. Speichern verlangt das Recht
 * „Geld“ und frischen Passkey (`speichereHofPlattformgebuehr`); Satz und
 * Einzug gelten nur für neue Bestellungen.
 */
export function HofAktePlattformgebuehr({ daten }: { daten: PlattformgebuehrAkteAnzeige }): React.JSX.Element {
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  const [werte, setWerte] = useState(daten.einstellungen)
  const [fehler, setFehler] = useState<string | null>(null)
  const frisch = useFrischBestaetigt(speichereHofPlattformgebuehr)
  const id = useId()

  function speichern(): void {
    setFehler(null)
    starte(async () => {
      const antwort = await frisch.ausfuehren({
        farmId: daten.farmId,
        satz: werte.satz,
        mandatPflicht: werte.mandatPflicht,
        sperreTage: Number.parseInt(String(werte.sperreTage), 10),
        abrechnungsTag: Number.parseInt(String(werte.abrechnungsTag), 10),
        einzugAb: werte.einzugAb,
      })
      if ('error' in antwort) {
        setFehler(antwort.error)
        return
      }
      toast.success('Plattformgebühr gespeichert. Satz und Einzug gelten für neue Bestellungen.')
      router.refresh()
    })
  }

  return (
    <section aria-labelledby={`${id}-titel`} className={cn(KARTE, 'mx-auto mt-5 flex w-full max-w-5xl flex-col gap-4 p-4 md:p-[18px]')}>
      <h2 id={`${id}-titel`} className="font-heading text-[17px] font-semibold text-foreground">
        Plattformgebühr
      </h2>
      <dl className="grid gap-2 text-[14px] sm:grid-cols-2">
        <div>
          <dt className={cn('text-[12.5px]', LEISE)}>Lastschrift</dt>
          <dd className="text-foreground">{daten.mandat ? 'eingerichtet' : 'keine'}</dd>
        </div>
        <div>
          <dt className={cn('text-[12.5px]', LEISE)}>Nicht abgeholt bei bar, 90 Tage</dt>
          <dd className="text-foreground">{quoteText(daten.nichtAbgeholt.bar, daten.nichtAbgeholt.nicht)}</dd>
        </div>
      </dl>
      <div>
        <h3 className={cn('mb-1 text-[12.5px] font-semibold', LEISE)}>Letzte Abrechnungen</h3>
        {daten.abrechnungen.length === 0 ? (
          <p className={cn('text-[14px]', LEISE)}>Noch keine Monatsabrechnung.</p>
        ) : (
          <ul className="[&>li+li]:border-t [&>li+li]:border-border">
            {daten.abrechnungen.map((a) => (
              <li key={a.id} className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[14px]">
                <span className="min-w-[8rem] font-medium text-foreground">{a.monatText}</span>
                <span className="tabular-nums text-foreground">
                  bar {euro(a.barCents)} · online {euro(a.onlineCents)}
                </span>
                <span className="text-foreground">{abrechnungStandWort(a.stand)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault()
          speichern()
        }}
      >
        <div>
          <label htmlFor={`${id}-satz`} className={FELD_LABEL}>
            Satz in %
          </label>
          <input id={`${id}-satz`} inputMode="decimal" value={werte.satz} onChange={(e) => setWerte({ ...werte, satz: e.target.value })} className={cn(FELD, FOKUS_RAHMEN)} />
        </div>
        <div>
          <label htmlFor={`${id}-tage`} className={FELD_LABEL}>
            Tage bis zur Sperre
          </label>
          <input
            id={`${id}-tage`}
            type="number"
            min={1}
            max={90}
            value={werte.sperreTage}
            onChange={(e) => setWerte({ ...werte, sperreTage: Number.parseInt(e.target.value || '0', 10) })}
            className={cn(FELD, FOKUS_RAHMEN)}
          />
        </div>
        <div>
          <label htmlFor={`${id}-tag`} className={FELD_LABEL}>
            Abrechnungstag (1–28)
          </label>
          <input
            id={`${id}-tag`}
            type="number"
            min={1}
            max={28}
            value={werte.abrechnungsTag}
            onChange={(e) => setWerte({ ...werte, abrechnungsTag: Number.parseInt(e.target.value || '0', 10) })}
            className={cn(FELD, FOKUS_RAHMEN)}
          />
        </div>
        <div>
          <label htmlFor={`${id}-einzug`} className={FELD_LABEL}>
            Einzug ab (Vorgabe {daten.einstellungen.vorgabeEinzugAb})
          </label>
          <div className="flex gap-2">
            <input id={`${id}-einzug`} type="date" value={werte.einzugAb} onChange={(e) => setWerte({ ...werte, einzugAb: e.target.value })} className={cn(FELD, FOKUS_RAHMEN, 'min-w-0 flex-1')} />
            <button type="button" className={KNOPF_RAHMEN} onClick={() => setWerte({ ...werte, einzugAb: '' })} disabled={werte.einzugAb === ''}>
              zurücksetzen
            </button>
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-[14px] text-foreground sm:col-span-2 lg:col-span-1 lg:self-end">
          <input type="checkbox" checked={werte.mandatPflicht} onChange={(e) => setWerte({ ...werte, mandatPflicht: e.target.checked })} className={cn('size-5', FOKUS_RAHMEN)} />
          Lastschrift Pflicht für bar
        </label>
        <div className="sm:col-span-2 lg:col-span-3">
          <button type="submit" disabled={laeuft} aria-busy={laeuft || undefined} className={KNOPF_GRUEN}>
            {laeuft ? 'Speichert …' : 'Mit Passkey speichern'}
          </button>
          <p className={cn('mt-1 text-[12.5px]', LEISE)}>Satz und Einzug gelten nur für neue Bestellungen.</p>
        </div>
      </form>
      <DialogFehler text={fehler} />
      {frisch.dialog}
    </section>
  )
}
