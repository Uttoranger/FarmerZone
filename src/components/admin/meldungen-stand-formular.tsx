'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { setzeBuendelStandAction } from '@/server/actions/admin'
import {
  BUENDEL_STAND_LABEL,
  BUENDEL_STAND_STATUS,
  BUENDEL_STAND_WAHL,
  STATUS_TON,
  WUENSCHE_TEXT,
  buendelVorschau,
  type BuendelStand,
  type BuendelStandWahl,
} from '@/lib/meldung'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, KICKER, KNOPF_GRUEN, LEISE, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'

type Bescheid = 'hoefe' | 'niemand'

/**
 * „Stand für alle" eines Bündels (Register N14, Ergänzung; Nr. 101; Mockup
 * admin-postfach-wuensche): Gesammelt · Geplant (mit „Geplant in") ·
 * Umgesetzt (setzt normal das Deployment) · Nicht geplant (Antwort Pflicht),
 * die Antwort an die Höfe mit Vorschau, wie der Hof sie in „Meine Meldungen"
 * liest (dieselbe Marke wie dort: oeffentlicherStatus und STATUS_TON), und
 * wem Bescheid geht. Gespeichert wird über setzeBuendelStandAction — eine
 * Transaktion für das ganze Bündel; Pflicht und Grenzen prüft der Server noch
 * einmal. Fehler stehen im Formular.
 */
export function StandFormular({
  clusterKey,
  anzahl,
  stand,
  sprintName,
  hoefe,
  kundinnenMitAdresse,
}: {
  clusterKey: string
  anzahl: number
  stand: BuendelStand
  sprintName: string | null
  hoefe: number
  kundinnenMitAdresse: number
}): React.JSX.Element {
  const router = useRouter()
  const start = {
    wahl: (BUENDEL_STAND_WAHL as readonly string[]).includes(stand) ? (stand as BuendelStandWahl) : 'gesammelt',
    sprint: sprintName ?? '',
    antwort: '',
    bescheid: (hoefe + kundinnenMitAdresse > 0 ? 'hoefe' : 'niemand') as Bescheid,
  }
  const [wahl, setWahl] = useState<BuendelStandWahl>(start.wahl)
  const [sprint, setSprint] = useState(start.sprint)
  const [antwort, setAntwort] = useState(start.antwort)
  const [bescheid, setBescheid] = useState<Bescheid>(start.bescheid)
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const empfaenger = hoefe + kundinnenMitAdresse

  function zuruecksetzen(): void {
    setWahl(start.wahl)
    setSprint(start.sprint)
    setAntwort(start.antwort)
    setBescheid(start.bescheid)
    setFehler(null)
  }

  function speichern(e: React.FormEvent): void {
    e.preventDefault()
    setFehler(null)
    starte(async () => {
      const ergebnis = await setzeBuendelStandAction({ clusterKey, stand: wahl, sprintName: sprint, antwort, bescheid })
      if ('error' in ergebnis) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(WUENSCHE_TEXT.gespeichert(ergebnis.meldungen))
      router.refresh()
    })
  }

  const vorschau = buendelVorschau(wahl)
  return (
    <form onSubmit={speichern} className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <fieldset>
        <legend className={cn(KICKER, 'mb-2')}>{WUENSCHE_TEXT.standFuerAlle(anzahl)}</legend>
        <div className="flex flex-wrap gap-2">
          {BUENDEL_STAND_WAHL.map((w) => (
            <label
              key={w}
              className={cn(
                'relative inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-[13.5px] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                wahl === w ? 'border-foreground bg-foreground font-semibold text-background' : 'border-border bg-card text-foreground hover:bg-muted'
              )}
            >
              <input type="radio" name="stand" value={w} checked={wahl === w} onChange={() => setWahl(w)} className="sr-only" />
              {BUENDEL_STAND_LABEL[w]}
            </label>
          ))}
        </div>
      </fieldset>

      {wahl === 'geplant' && (
        <div>
          <label htmlFor="stand-sprint" className={FELD_LABEL}>
            {WUENSCHE_TEXT.geplantIn}
          </label>
          <input id="stand-sprint" value={sprint} onChange={(e) => setSprint(e.target.value)} placeholder={WUENSCHE_TEXT.geplantInBeispiel} className={FELD} />
        </div>
      )}
      {wahl === 'umgesetzt' && <p className={cn('text-[12.5px]', LEISE)}>{WUENSCHE_TEXT.umgesetztHinweis}</p>}

      <div>
        <label htmlFor="stand-antwort" className={FELD_LABEL}>
          {WUENSCHE_TEXT.antwort}
        </label>
        <textarea id="stand-antwort" value={antwort} onChange={(e) => setAntwort(e.target.value)} rows={3} aria-required={wahl === 'nichtGeplant' || bescheid === 'hoefe'} className={cn(FELD, 'resize-y')} />
      </div>

      <section aria-label={WUENSCHE_TEXT.soSiehtEsDerHof} className="rounded-xl bg-muted px-3.5 py-3">
        <p className={cn('mb-1.5 text-[12.5px] font-semibold', LEISE)}>{WUENSCHE_TEXT.soSiehtEsDerHof}</p>
        <div className="flex flex-wrap items-start gap-2">
          <StatusBadge status={STATUS_TON[BUENDEL_STAND_STATUS[wahl]]}>{vorschau}</StatusBadge>
          {antwort.trim() !== '' && <p className="min-w-0 flex-1 text-[13px] break-words whitespace-pre-line text-foreground">„{antwort.trim()}“</p>}
        </div>
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className={cn(KICKER, 'mb-1')}>{WUENSCHE_TEXT.bescheid}</legend>
        {empfaenger > 0 && (
          <label className={cn('flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl px-1 py-1.5', FOKUS_RAHMEN)}>
            <input type="radio" name="bescheid" value="hoefe" checked={bescheid === 'hoefe'} onChange={() => setBescheid('hoefe')} className="mt-1 size-4 accent-accent" />
            <span className="flex flex-col">
              <span className="text-[13.5px] font-semibold text-foreground">{WUENSCHE_TEXT.bescheidHoefe(hoefe, kundinnenMitAdresse)}</span>
              <span className={cn('text-[12.5px]', LEISE)}>{WUENSCHE_TEXT.bescheidHoefeSatz(kundinnenMitAdresse)}</span>
            </span>
          </label>
        )}
        <label className={cn('flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl px-1 py-1.5', FOKUS_RAHMEN)}>
          <input type="radio" name="bescheid" value="niemand" checked={bescheid === 'niemand'} onChange={() => setBescheid('niemand')} className="mt-1 size-4 accent-accent" />
          <span className="flex flex-col">
            <span className="text-[13.5px] font-semibold text-foreground">{WUENSCHE_TEXT.bescheidNiemand}</span>
            <span className={cn('text-[12.5px]', LEISE)}>{WUENSCHE_TEXT.bescheidNiemandSatz}</span>
          </span>
        </label>
      </fieldset>

      <DialogFehler text={fehler} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        <button type="button" onClick={zuruecksetzen} disabled={laeuft} className={TEXT_GRUEN}>
          {WUENSCHE_TEXT.abbrechen}
        </button>
        <button type="submit" disabled={laeuft} className={cn(KNOPF_GRUEN, 'w-full rounded-[14px] sm:w-auto sm:rounded-full')}>
          {laeuft ? WUENSCHE_TEXT.speichert : WUENSCHE_TEXT.speichern(bescheid === 'hoefe' ? hoefe : 0)}
        </button>
      </div>
    </form>
  )
}
