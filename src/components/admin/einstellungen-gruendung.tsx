'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { bildeGruendungBis, gruendungTagKurz, seitenZahlen, type FestschreibenZeile, type GruendungEinstellung, type GruendungSeiten } from '@/lib/gruendungshof'
import { EINSTELLUNGEN_TEXT, GRUENDUNG_EINSTELLUNG_FEHLER, pruefeGruendungEingabe } from '@/lib/plattform-einstellung'
import { speichereGruendungEinstellung } from '@/server/actions/plattform-einstellung'
import { schreibeZusagenFest } from '@/server/actions/gruendung'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FELD, FELD_LABEL, KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { GruendungSatz } from '@/components/gruendung/satz'
import { GruendungPill } from '@/components/gruendung/pill'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'

const TEXT = EINSTELLUNGEN_TEXT.gruendung

/** Nur lesend sichtbar machen: gedämpfter Grund, kein Textcursor. */
const GESPERRT = 'cursor-default bg-muted'

/** Was die Seite mitgibt — nur Zahlen und Text (CODING_STANDARDS §2: kein Date an Client-Komponenten). */
export type GruendungFormularDaten = {
  gespeichert: {
    plaetze: number
    monate: number
    /** Stichtag als Kalendertag, null = ohne. */
    aktionBisTag: string | null
    anzeige: boolean
    /** Das bisherige Standard-Ende (Übernahme beim Festschreiben) — nicht änderbar. */
    bisTag: string
    /** Wann festgeschrieben wurde (ISO-Text), null = noch nicht. */
    festAm: string | null
  }
  /** Vergebene Plätze: vor dem Festschreiben die Höfe im Rennen (ohne ausgenommene), danach die festgeschriebenen Nummern. */
  vergeben: number
  /** Freigeschaltete Höfe, die nicht für die Gründungsplätze zählen (Register K2, Nr. 109). */
  ausgenommen: number
  /** Der Zeitpunkt der Seite als ISO-Text — „Datum vorbei" entscheidet sich daran, nicht an der Uhr des Browsers. */
  jetzt: string
  protokoll: string
  /** Die Liste „Zusagen festschreiben“ (leer nach dem Festschreiben). */
  festschreiben: FestschreibenZeile[]
  /** Reichen die Plätze fürs Festschreiben nicht: die nötige Zahl. */
  festschreibenPlaetze: number | null
  /** „Zusagen festgeschrieben am …“ — null vorher. */
  festgeschrieben: string | null
}

/** Eine ganze Zahl aus dem Feld — sonst NaN, das Regel und Schema mit ihrem Satz ablehnen. */
function ganzeZahl(text: string): number {
  return /^\d{1,4}$/.test(text.trim()) ? Number(text.trim()) : Number.NaN
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

function Feld({
  id,
  titel,
  zeile,
  children,
}: {
  id: string
  titel: string
  zeile: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={FELD_LABEL}>
        {titel}
      </label>
      {children}
      <p id={`${id}-zeile`} className="mt-1 text-[12px] leading-snug text-muted-foreground">
        {zeile}
      </p>
    </div>
  )
}

/**
 * Die Gruppe Gründungshöfe in Admin › Einstellungen (Register K2-Ergänzung,
 * N15; seit Nr. 116 die Aktion „100 Gründungshöfe“): Kacheln
 * Plätze/Vergeben/Frei, die Felder Plätze, Monate und „Aktion bis“, der
 * Schalter „Auf den Seiten zeigen", die Vorschau von Satz und Pill mit den
 * echten Zahlen, die Regel-Zeile, ein eigenes Speichern und — solange nicht
 * festgeschrieben ist — der Knopf „Zusagen festschreiben …“ mit der Liste im
 * Dialog. Kacheln und Vorschau folgen dem Formular, bevor gespeichert ist —
 * gerechnet mit derselben Regel wie die Seiten (`seitenZahlen`), geprüft mit
 * derselben wie die Action (`pruefeGruendungEingabe`); den Schutz gibt die
 * Action unter der Sperre.
 */
export function EinstellungenGruendung({ daten }: { daten: GruendungFormularDaten }): React.JSX.Element {
  const router = useRouter()
  const [laeuft, startTransition] = useTransition()
  const [festLaeuft, startFest] = useTransition()
  const g = daten.gespeichert
  const [plaetzeText, setPlaetzeText] = useState(String(g.plaetze))
  const [monateText, setMonateText] = useState(String(g.monate))
  const [aktionBisTag, setAktionBisTag] = useState(g.aktionBisTag ?? '')
  const [anzeige, setAnzeige] = useState(g.anzeige)
  const [fehler, setFehler] = useState<string | null>(null)
  const [festOffen, setFestOffen] = useState(false)
  const [festFehler, setFestFehler] = useState<string | null>(null)
  // „Zusagen festschreiben" ist heikel (Register N20): frisch mit Passkey bestätigt.
  const frischFest = useFrischBestaetigt(schreibeZusagenFest)
  const plaetzeId = useId()
  const monateId = useId()
  const aktionBisId = useId()
  const bisId = useId()
  const hinweisId = useId()
  const schalterSatzId = useId()

  const jetzt = new Date(daten.jetzt)
  const gespeichert: GruendungEinstellung = {
    plaetze: g.plaetze,
    bis: bildeGruendungBis(g.bisTag),
    anzeige: g.anzeige,
    monate: g.monate,
    aktionBisTag: g.aktionBisTag,
    festAm: g.festAm ? new Date(g.festAm) : null,
  }
  const eingabe = { plaetze: ganzeZahl(plaetzeText), monate: ganzeZahl(monateText), aktionBisTag: aktionBisTag === '' ? null : aktionBisTag, anzeige }
  const eingabeFehler = pruefeGruendungEingabe(eingabe, gespeichert, daten.vergeben, jetzt)
  const geaendert =
    eingabe.plaetze !== g.plaetze || eingabe.monate !== g.monate || eingabe.aktionBisTag !== g.aktionBisTag || anzeige !== g.anzeige

  // Kacheln und Beispiel: mit der Eingabe, solange sie gilt, sonst mit dem gespeicherten Stand.
  const stand: GruendungEinstellung = eingabeFehler === null ? { ...gespeichert, ...eingabe } : gespeichert
  const zahlen = seitenZahlen(stand, daten.vergeben, jetzt)
  const aufSeiten: GruendungSeiten = { ...zahlen, voraussichtlicherPlatz: null }

  function verwerfen() {
    setPlaetzeText(String(g.plaetze))
    setMonateText(String(g.monate))
    setAktionBisTag(g.aktionBisTag ?? '')
    setAnzeige(g.anzeige)
    setFehler(null)
  }

  function speichern() {
    if (eingabeFehler !== null) {
      setFehler(eingabeFehler)
      return
    }
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await speichereGruendungEinstellung(eingabe)
      if ('error' in ergebnis) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(TEXT.gespeichert)
      // Die Protokollzeile und der gespeicherte Stand kommen vom Server.
      router.refresh()
    })
  }

  function festschreiben() {
    setFestFehler(null)
    startFest(async () => {
      const ergebnis = await frischFest.ausfuehren({ bestaetigt: true })
      if ('error' in ergebnis) {
        setFestFehler(ergebnis.error)
        return
      }
      toast.success(TEXT.festschreibenFertig)
      setFestOffen(false)
      router.refresh()
    })
  }

  const feldGeaendert = () => setFehler(null)

  return (
    <>
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
        <Kachel
          titel={TEXT.kachelVergeben}
          wert={zahlen.gesamt - zahlen.frei}
          zeile={
            g.festAm !== null
              ? TEXT.kachelVergebenFest
              : daten.ausgenommen > 0
                ? TEXT.kachelVergebenAusgenommen(daten.ausgenommen)
                : TEXT.kachelVergebenZeile
          }
        />
        <Kachel titel={TEXT.kachelFrei} wert={zahlen.frei} zeile={TEXT.kachelFreiZeile} betont={zahlen.frei > 0} />
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
        <Feld id={plaetzeId} titel={TEXT.feldPlaetze} zeile={TEXT.feldPlaetzeZeile}>
          <input
            id={plaetzeId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={plaetzeText}
            onChange={(e) => {
              setPlaetzeText(e.target.value)
              feldGeaendert()
            }}
            aria-describedby={`${plaetzeId}-zeile ${hinweisId}`}
            className={cn(FELD, FOKUS_RAHMEN)}
          />
        </Feld>
        <Feld id={monateId} titel={TEXT.feldMonate} zeile={TEXT.feldMonateZeile}>
          <input
            id={monateId}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={monateText}
            onChange={(e) => {
              setMonateText(e.target.value)
              feldGeaendert()
            }}
            aria-describedby={`${monateId}-zeile ${hinweisId}`}
            className={cn(FELD, FOKUS_RAHMEN)}
          />
        </Feld>
        <Feld id={aktionBisId} titel={TEXT.feldAktionBis} zeile={g.aktionBisTag === null ? TEXT.feldAktionBisZeile : GRUENDUNG_EINSTELLUNG_FEHLER.nieNachHinten}>
          <input
            id={aktionBisId}
            type="date"
            value={aktionBisTag}
            max={g.aktionBisTag ?? undefined}
            onChange={(e) => {
              setAktionBisTag(e.target.value)
              feldGeaendert()
            }}
            aria-describedby={`${aktionBisId}-zeile ${hinweisId}`}
            className={cn(FELD, FOKUS_RAHMEN)}
          />
        </Feld>
      </div>

      {g.festAm === null && (
        <div className="flex flex-col gap-1 md:max-w-[calc((100%-1.75rem)/3)]">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={bisId} className={FELD_LABEL}>
              {TEXT.feldBis}
            </label>
            <span className="text-[12.5px] text-muted-foreground">{TEXT.feldGesperrt}</span>
          </div>
          <input id={bisId} type="text" value={gruendungTagKurz(g.bisTag)} readOnly className={cn(FELD, GESPERRT)} />
        </div>
      )}

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

      {daten.festgeschrieben !== null ? (
        <p className="text-[12.5px] leading-snug text-muted-foreground">{daten.festgeschrieben}</p>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] leading-snug text-muted-foreground">{TEXT.festschreibenSatz}</p>
          <button
            type="button"
            onClick={() => {
              setFestFehler(null)
              setFestOffen(true)
            }}
            className={cn(KNOPF_RAHMEN, 'shrink-0')}
          >
            {TEXT.festschreiben}
          </button>
        </div>
      )}

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
  

    <BestellDialog
      offen={festOffen}
      onOffenChange={(offen) => {
        if (!offen) setFestOffen(false)
      }}
      titel={TEXT.festschreibenTitel}
      breite="breit"
      hauptaktion={{ text: TEXT.festschreibenKnopf, onClick: festschreiben, ton: 'orange', laeuft: festLaeuft }}
    >
      <div className="flex flex-col gap-3 text-[14px] text-muted-foreground">
        <p>{daten.festschreiben.length > 0 ? TEXT.festschreibenDialog(daten.festschreiben.length) : TEXT.festschreibenLeer}</p>
        {daten.festschreibenPlaetze !== null && <DialogFehler text={TEXT.festschreibenPlaetze(daten.festschreibenPlaetze)} />}
        {daten.festschreiben.length > 0 && (
          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-card text-[12px] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">{TEXT.festschreibenSpalten.hof}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{TEXT.festschreibenSpalten.nummer}</th>
                  <th scope="col" className="px-3 py-2 font-semibold">{TEXT.festschreibenSpalten.ende}</th>
                </tr>
              </thead>
              <tbody>
                {daten.festschreiben.map((zeile) => (
                  <tr key={zeile.id} className="border-t border-border">
                    <td className="max-w-[14rem] px-3 py-2 break-words text-foreground">
                      {zeile.name}
                      {zeile.stillgelegt && <span className="ml-1.5 text-[12px] text-muted-foreground">· {TEXT.festschreibenStillgelegt}</span>}
                    </td>
                    <td className="px-3 py-2 text-foreground tabular-nums">{zeile.platz}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {zeile.bisherTag ? gruendungTagKurz(zeile.bisherTag) : TEXT.festschreibenOhne} →{' '}
                      <span className="font-semibold text-foreground">{gruendungTagKurz(zeile.neuTag)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFehler text={festFehler} />
      </div>
      {frischFest.dialog}
    </BestellDialog>
    </>
  )
}
