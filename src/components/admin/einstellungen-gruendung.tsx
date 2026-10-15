'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { bildeGruendungBis, seitenZahlen, type GruendungSeiten } from '@/lib/gruendungshof'
import { EINSTELLUNGEN_TEXT, GRUENDUNG_EINSTELLUNG_FEHLER, plaetzeAusEingabe, pruefeGruendungEingabe } from '@/lib/plattform-einstellung'
import { speichereGruendungEinstellung } from '@/server/actions/plattform-einstellung'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FELD, FELD_LABEL, KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { GruendungSatz } from '@/components/gruendung/satz'
import { GruendungPill } from '@/components/gruendung/pill'

const TEXT = EINSTELLUNGEN_TEXT.gruendung

/** Was die Seite mitgibt — nur Zahlen und Text (CODING_STANDARDS §2: kein Date an Client-Komponenten). */
export type GruendungFormularDaten = {
  gespeichert: { plaetze: number; bisTag: string; anzeige: boolean }
  /** Freigeschaltete, nicht stillgelegte Höfe — die Reihenfolge der Plätze (gruendungsplaetze). */
  imRennen: number
  /** Der Zeitpunkt der Seite als ISO-Text — „Datum vorbei" entscheidet sich daran, nicht an der Uhr des Browsers. */
  jetzt: string
  protokoll: string
}

function Kachel({ titel, wert, zeile, betont = false }: { titel: string; wert: number; zeile?: string; betont?: boolean }): React.JSX.Element {
  return (
    <div className={cn('rounded-xl border bg-background px-3.5 py-3', betont ? 'border-primary/45' : 'border-border')}>
      <div className="text-[12.5px] font-semibold text-muted-foreground">{titel}</div>
      <div className={cn('mt-1 font-heading text-[28px] leading-[1.1] font-semibold', betont ? 'text-status-offen' : 'text-foreground')}>{wert}</div>
      {zeile && <div className="text-[12px] text-muted-foreground">{zeile}</div>}
    </div>
  )
}

/**
 * Die Gruppe Gründungshöfe in Admin › Einstellungen (Register K2-Ergänzung,
 * N15; Mockups admin-einstellungen und admin-mobil-einstellungen): Kacheln
 * Plätze/Vergeben/Frei, die zwei Felder, der Schalter „Auf den Seiten zeigen",
 * die Vorschau von Satz und Pill mit den echten Zahlen, die Regel-Zeile und
 * ein eigenes Speichern. Kacheln und Vorschau folgen dem Formular, bevor
 * gespeichert ist — gerechnet mit derselben Regel wie die Seiten
 * (`seitenZahlen`), geprüft mit derselben wie die Action
 * (`pruefeGruendungEingabe`); den Schutz gibt die Action.
 */
export function EinstellungenGruendung({ daten }: { daten: GruendungFormularDaten }): React.JSX.Element {
  const router = useRouter()
  const [laeuft, startTransition] = useTransition()
  const [plaetzeText, setPlaetzeText] = useState(String(daten.gespeichert.plaetze))
  const [bisTag, setBisTag] = useState(daten.gespeichert.bisTag)
  const [anzeige, setAnzeige] = useState(daten.gespeichert.anzeige)
  const [fehler, setFehler] = useState<string | null>(null)
  const plaetzeId = useId()
  const bisId = useId()
  const hinweisId = useId()
  const schalterSatzId = useId()

  const jetzt = new Date(daten.jetzt)
  // Wie die Action: vergeben mit den Plätzen, die bis jetzt gelten — wer einen Platz hat, behält ihn.
  const vergeben = Math.min(daten.imRennen, daten.gespeichert.plaetze)
  const plaetze = plaetzeAusEingabe(plaetzeText)
  const eingabeFehler = plaetze === null ? GRUENDUNG_EINSTELLUNG_FEHLER.plaetze : pruefeGruendungEingabe({ plaetze, bisTag, anzeige }, vergeben, jetzt)
  const geaendert = plaetzeText.trim() !== String(daten.gespeichert.plaetze) || bisTag !== daten.gespeichert.bisTag || anzeige !== daten.gespeichert.anzeige

  // Kacheln und Beispiel: mit der Eingabe, solange sie gilt, sonst mit dem gespeicherten Stand.
  const stand = eingabeFehler === null && plaetze !== null ? { plaetze, bisTag, anzeige } : daten.gespeichert
  const zahlen = seitenZahlen({ plaetze: stand.plaetze, bis: bildeGruendungBis(stand.bisTag), anzeige: stand.anzeige }, daten.imRennen, jetzt)
  const aufSeiten: GruendungSeiten = { ...zahlen, voraussichtlicherPlatz: null }

  function verwerfen() {
    setPlaetzeText(String(daten.gespeichert.plaetze))
    setBisTag(daten.gespeichert.bisTag)
    setAnzeige(daten.gespeichert.anzeige)
    setFehler(null)
  }

  function speichern() {
    if (plaetze === null || eingabeFehler !== null) {
      setFehler(eingabeFehler)
      return
    }
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await speichereGruendungEinstellung({ plaetze, bisTag, anzeige })
      if ('error' in ergebnis) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(TEXT.gespeichert)
      // Die Protokollzeile und der gespeicherte Stand kommen vom Server.
      router.refresh()
    })
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        speichern()
      }}
    >
      <div className="hidden grid-cols-3 gap-3 sm:grid">
        <Kachel titel={TEXT.kachelPlaetze} wert={zahlen.gesamt} />
        <Kachel titel={TEXT.kachelVergeben} wert={zahlen.gesamt - zahlen.frei} zeile={TEXT.kachelVergebenZeile} />
        <Kachel titel={TEXT.kachelFrei} wert={zahlen.frei} zeile={TEXT.kachelFreiZeile} betont={zahlen.frei > 0} />
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={plaetzeId} className={FELD_LABEL}>
              {TEXT.feldPlaetze}
            </label>
            <span className="text-[12.5px] text-muted-foreground">{TEXT.feldPlaetzeHinweis(vergeben)}</span>
          </div>
          <input
            id={plaetzeId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={plaetzeText}
            onChange={(e) => {
              setPlaetzeText(e.target.value)
              setFehler(null)
            }}
            aria-invalid={plaetze === null || plaetze < vergeben ? true : undefined}
            aria-describedby={hinweisId}
            className={FELD}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={bisId} className={FELD_LABEL}>
              {TEXT.feldBis}
            </label>
            <span className="text-[12.5px] text-muted-foreground">{TEXT.feldBisHinweis}</span>
          </div>
          <input
            id={bisId}
            type="date"
            value={bisTag}
            onChange={(e) => {
              setBisTag(e.target.value)
              setFehler(null)
            }}
            aria-describedby={hinweisId}
            className={FELD}
          />
        </div>
      </div>

      {/* Der erste verletzte Satz schon beim Tippen — leise; erst ein Speicherversuch zeigt ihn als Fehler. */}
      <p id={hinweisId} className={cn('text-[12.5px] leading-snug text-status-offen', (eingabeFehler === null || fehler !== null) && 'sr-only')}>
        {eingabeFehler ?? ''}
      </p>

      <button
        type="button"
        role="switch"
        aria-checked={anzeige}
        // Fester Name; den Zustand liest die Vorlesehilfe aus aria-checked, der Satz ist nur Beschreibung.
        aria-label={TEXT.schalter}
        aria-describedby={schalterSatzId}
        onClick={() => {
          setAnzeige((an) => !an)
          setFehler(null)
        }}
        className={cn('flex min-h-11 w-full items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-3 text-left', FOKUS_RAHMEN)}
      >
        <span aria-hidden="true" className={cn('relative block h-6 w-10 shrink-0 rounded-full transition-colors duration-[250ms]', anzeige ? 'bg-accent' : 'bg-border')}>
          <span
            className={cn(
              'absolute top-[3px] block size-[18px] rounded-full transition-transform duration-[250ms]',
              anzeige ? 'translate-x-[19px] bg-accent-foreground' : 'translate-x-[3px] bg-muted-foreground'
            )}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-foreground">{TEXT.schalter}</span>
          <span id={schalterSatzId} className="hidden text-[12.5px] leading-snug text-muted-foreground lg:block">
            {TEXT.schalterSatz}
          </span>
        </span>
      </button>

      <div className="flex flex-col gap-2">
        <span className="text-[12.5px] font-semibold text-muted-foreground">{TEXT.aufDenSeiten}</span>
        <div className="flex flex-col gap-2.5 rounded-xl border border-dashed border-border bg-background px-3.5 py-3">
          {aufSeiten.zeigen ? (
            <>
              <GruendungSatz gruendung={aufSeiten} />
              <div>
                <GruendungPill gruendung={aufSeiten} />
              </div>
            </>
          ) : (
            <p className="text-[13px] leading-snug text-muted-foreground">{TEXT.aufDenSeitenLeer}</p>
          )}
        </div>
      </div>

      <p className="hidden text-[12.5px] leading-snug text-muted-foreground lg:block">{TEXT.regel}</p>

      <DialogFehler text={fehler} />

      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] leading-snug text-muted-foreground">{daten.protokoll}</p>
        <div className="flex justify-end gap-2.5">
          <button type="button" onClick={verwerfen} disabled={!geaendert || laeuft} className={KNOPF_RAHMEN}>
            {TEXT.verwerfen}
          </button>
          <button type="submit" disabled={!geaendert || laeuft} aria-busy={laeuft || undefined} className={KNOPF_GRUEN}>
            {laeuft ? TEXT.speichert : TEXT.speichern}
          </button>
        </div>
      </div>
    </form>
  )
}
