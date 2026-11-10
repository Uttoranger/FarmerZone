'use client'

import { useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { Dialog, DialogMitte } from '@/components/ui/dialog'
import { Sheet, SheetBlatt, SheetTitle } from '@/components/ui/sheet'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { DezimalFeld } from '@/components/shared/dezimal-feld'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { SpeicherFehler, fokussiereErstesFehlerfeld } from '@/components/shared/formular-meldungen'
import { FeldFehler } from '@/components/checkout/kasse-teile'
import { FELD, FELD_LABEL, KNOPF_ORANGE } from '@/components/hof-bestellungen/stil'
import { createManualSale, updateManualSale } from '@/server/actions/manual-sales'
import type { VerkaufDaten, VerkaufProdukt } from '@/lib/hof-verkaeufe'
import { manualSaleFormSchema } from '@/schemas/manual-sale'
import { UNIT_LABELS } from '@/schemas/product'
import { verkaufskanalSchema, type Verkaufskanal } from '@/schemas/verkaufskanal'
import { NOTIZ_MAX, PRODUKTNAME_MAX } from '@/lib/eingabegrenzen'
import { wienKalendertag } from '@/lib/kalender'
import { formatTagKurz } from '@/lib/format'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { STANDARD_KANAL, kanalSpeicher, kanalVorauswahl, merkeKanal } from '@/lib/verkaufskanal-speicher'
import {
  HAUPTKANAELE,
  VORRAT_ABZIEHEN,
  datumKurz,
  istOhneProdukt,
  knopfText,
  produktChips,
  vorratSchalterText,
} from '@/lib/verkauf-eintragen'
import { cn } from '@/lib/utils'
import { MARKE } from '@/lib/marke'
import { RUNDUNG } from '@/components/ui/rundung'

/*
 * „Verkauf eintragen" im neuen Design (Nachtlauf Nr. 22b, Register E13) —
 * dieselbe Funktion wie vorher, nur nach docs/ai/DESIGN_SYSTEM.md gezeichnet:
 * ab 768 px der zentrierte Dialog (`DialogMitte`: abgedunkelt, nicht
 * verwischt, „Abbrechen“ oben rechts, keine Fußleiste), darunter ein Blatt von
 * unten (höchstens 86 % hoch) mit dem Hauptknopf über die volle Breite. Betrag
 * zuerst (Vorbild GoPay, Expensify, KOHO): oben groß der Betrag, darunter der
 * Weg, alles andere freiwillig. Der Knopf nennt den Betrag und ist nie
 * deaktiviert (G6) — geprüft wird beim Absenden (Nr. 272, Board s2-/w2-verkaeufe).
 *
 * Das Formular hängt nur, solange Dialog bzw. Blatt offen sind — jedes
 * Öffnen beginnt mit frischen Werten (auch der gemerkte Weg, der erst im
 * Browser feststeht), ohne Effekt zum Zurücksetzen.
 */

type FormWerte = {
  totalAmount: number | null
  channel: Verkaufskanal
  productId: string | null
  /** Freier Name — nur, wenn „Anderes" statt eines Produkts gewählt ist. */
  freierName: boolean
  productName: string
  quantity: number | null
  unit: string | null
  saleDate: string
  note: string
  /** Schalter „Vorrat abziehen" (Register D1) — Standard ein, gilt nur beim Eintragen mit Produkt. */
  vorratAbziehen: boolean
}

function startWerte(verkauf: VerkaufDaten | null, vorlage: VerkaufDaten | null, heute: string): FormWerte {
  const quelle = verkauf ?? vorlage
  if (!quelle) {
    return {
      totalAmount: null,
      channel: kanalVorauswahl(kanalSpeicher()),
      productId: null,
      freierName: false,
      productName: '',
      quantity: null,
      unit: null,
      saleDate: heute,
      note: '',
      vorratAbziehen: true,
    }
  }
  const ohne = istOhneProdukt(quelle)
  return {
    totalAmount: quelle.totalAmount,
    // PLATFORM oder ein unbekannter Wert kommt aus der Liste nie — sonst gilt der Standard.
    channel: verkaufskanalSchema.catch(STANDARD_KANAL).parse(quelle.channel),
    productId: quelle.productId,
    freierName: quelle.productId === null && !ohne,
    productName: ohne ? '' : quelle.productName,
    // „1" ist bei einem Verkauf ohne Produkt nur der Platzhalter der Datenbank.
    quantity: ohne && quelle.quantity === 1 ? null : quelle.quantity,
    unit: quelle.unit,
    // Wiederholen trägt heute ein, Bearbeiten behält den Tag.
    saleDate: verkauf ? verkauf.saleTag : heute,
    note: quelle.note ?? '',
    vorratAbziehen: true,
  }
}

const WAHL_AN = 'border-foreground bg-foreground text-background'
const WAHL_AUS = 'border-border bg-card text-foreground hover:bg-muted'
/** Unterstrichener Textknopf in Textfarbe („Anderes“ neben „Wo verkauft?“, „Notiz ergänzen“; Board s2-/w2-verkaeufe Bild 2). */
const TEXT_LINK = cn('inline-flex min-h-11 items-center rounded-sm text-[15px] font-semibold text-foreground underline decoration-1 underline-offset-4', FOKUS_RAHMEN)

/**
 * Der Tag als Chip unter dem Titel (Board s2-/w2-verkaeufe Bild 2: „Heute, Mi 3. März“): bei heute und gestern
 * das Wort vorn, danach Wochentag und Datum; sonst nur Wochentag und Datum. Nur Anzeige, der Tag steht schon fest.
 */
export function datumChipText(tag: string, heute: string): string {
  const wort = datumKurz(tag, heute)
  // formatTagKurz schreibt „Mi, 3. Mär“ — im Chip ohne Komma nach dem Wochentag, damit nur eines dasteht.
  const datum = formatTagKurz(tag).replace(', ', ' ')
  return wort === 'Heute' || wort === 'Gestern' ? `${wort}, ${datum}` : datum
}

/** Der Satz, wenn das Speichern scheitert: kein „Nochmal“ — ein zweiter Versuch könnte doppelt buchen (D1, Liste Lauf 32 C). */
export const VERKAUF_SPEICHERN_FEHLER =
  'Wir konnten den Verkauf nicht speichern. Deine Angaben sind noch da. Schau in der Liste nach, ob er schon dasteht, bevor du es noch einmal versuchst.'

type FormularProps = {
  /** Gesetzt = Bearbeiten. */
  verkauf: VerkaufDaten | null
  /** Gesetzt = Wiederholen (neuer Verkauf mit diesen Werten, Tag heute). */
  vorlage: VerkaufDaten | null
  produkte: VerkaufProdukt[]
  /** Die meistverkauften Produkte des Hofs, meistverkauft zuerst (getMeistverkaufteProduktIds). */
  topProduktIds: string[]
  /** Nur im Blatt: Titel und „Abbrechen“ stehen im Formular. Im Dialog trägt `DialogMitte` beides. */
  kopf?: { titel: (text: string) => ReactNode; onAbbrechen: () => void }
  onFertig: () => void
  /** Meldet, solange gespeichert wird — der Rahmen lässt sich dann nicht schließen (kein unsichtbarer Doppel-Eintrag). */
  onSpeichern?: (laeuft: boolean) => void
  /** Ab 768 px: Hauptknopf rechts am Ende statt über die volle Breite. */
  breit: boolean
  betragRef?: RefObject<HTMLInputElement | null>
}

export function VerkaufFormular({
  verkauf,
  vorlage,
  produkte,
  topProduktIds,
  kopf,
  onFertig,
  onSpeichern,
  breit,
  betragRef,
}: FormularProps): React.JSX.Element {
  const bearbeiten = verkauf !== null
  // Der Tag des Browsers beim Öffnen: Wer die Seite über Nacht offen lässt, trägt morgens trotzdem „heute" ein.
  const [heute] = useState(() => wienKalendertag(new Date()))
  const [start] = useState(() => startWerte(verkauf, vorlage, heute))
  const [notizOffen, setNotizOffen] = useState(start.note !== '')
  const [datumOffen, setDatumOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  // Synchrone Sperre gegen ein zweites Absenden, solange das erste läuft (Prüfung und Speichern).
  const sperre = useRef(false)
  const [serverFehler, setServerFehler] = useState<string | null>(null)

  const form = useForm<FormWerte>({ defaultValues: start })
  // Alle Felder haben Startwerte — der Teil-Typ von useWatch trifft hier nie zu.
  const werte = useWatch({ control: form.control }) as FormWerte
  const chips = produktChips(topProduktIds, produkte, werte.productId)
  const knopf = knopfText(werte.totalAmount, bearbeiten)
  const fehler = form.formState.errors
  // Das gewählte Produkt aus dem Sortiment — nur dann gibt es einen Vorrat abzuziehen.
  const gewaehlt = werte.productId ? produkte.find((p) => p.id === werte.productId) : undefined
  const einheit = werte.unit ? (UNIT_LABELS[werte.unit] ?? werte.unit) : undefined
  // D1 regelt nur das Eintragen: Beim Bearbeiten gibt es den Schalter nicht (und keine Gegenbuchung).
  const vorratSchalter = !bearbeiten && gewaehlt !== undefined
  const vorratTextId = useId()
  const woId = useId()
  const datumText = datumChipText(werte.saleDate, heute)

  function waehleProdukt(produkt: VerkaufProdukt | null) {
    const abwaehlen = produkt ? werte.productId === produkt.id : werte.freierName
    form.setValue('productId', abwaehlen || !produkt ? null : produkt.id)
    form.setValue('freierName', !abwaehlen && !produkt)
    form.setValue('productName', '')
    form.setValue('unit', abwaehlen || !produkt ? null : produkt.unit)
  }

  async function absenden(w: FormWerte, formular: HTMLFormElement) {
    setServerFehler(null)
    const geprueft = manualSaleFormSchema.safeParse({
      productId: w.productId,
      productName: w.freierName ? w.productName : undefined,
      quantity: w.quantity,
      unit: w.unit,
      totalAmount: w.totalAmount,
      channel: w.channel,
      saleDate: w.saleDate,
      note: w.note,
      vorratAbziehen: vorratSchalter && w.vorratAbziehen,
    })
    if (!geprueft.success) {
      let feldFehler = false
      for (const issue of geprueft.error.issues) {
        const feld = issue.path[0]
        if (feld === 'totalAmount' || feld === 'quantity' || feld === 'productName' || feld === 'note') {
          form.setError(feld, { message: issue.message })
          if (feld === 'note') setNotizOffen(true)
          feldFehler = true
        } else {
          if (feld === 'saleDate') setDatumOffen(true)
          setServerFehler(issue.message)
        }
      }
      // G6: Fokus ins erste markierte Feld — erst nach dem Zeichnen, dann trägt es aria-invalid.
      if (feldFehler) requestAnimationFrame(() => fokussiereErstesFehlerfeld(formular))
      return
    }

    setLaeuft(true)
    onSpeichern?.(true)
    try {
      const antwort = bearbeiten ? await updateManualSale(verkauf.id, geprueft.data) : await createManualSale(geprueft.data)
      if ('error' in antwort) {
        setServerFehler(antwort.error)
        return
      }
      if (!bearbeiten) merkeKanal(kanalSpeicher(), geprueft.data.channel)
      // Der Satz zum Vorrat kommt vom Server (vorratHinweis) — reichte der Vorrat nicht, als Hinweis, der länger stehen bleibt.
      if (antwort.vorrat?.knapp) toast.warning(antwort.vorrat.text, { duration: 10000 })
      else toast.success(antwort.vorrat?.text ?? (bearbeiten ? 'Verkauf gespeichert' : 'Verkauf eingetragen'))
      onFertig()
    } catch {
      setServerFehler(VERKAUF_SPEICHERN_FEHLER)
    } finally {
      setLaeuft(false)
      onSpeichern?.(false)
    }
  }

  const hauptKnopf = (
    <button
      type="submit"
      aria-busy={laeuft || undefined}
      className={cn(KNOPF_ORANGE, 'min-w-[150px] tabular-nums', breit ? 'self-end' : 'w-full rounded-[14px]')}
    >
      {laeuft ? 'Einen Moment …' : knopf.text}
    </button>
  )

  return (
    <form
      onSubmit={(e) => {
        // Der Knopf ist nie deaktiviert (G6). Die Sperre greift deshalb synchron beim ersten Absenden — ein State käme
        // erst nach der (asynchronen) Prüfung, und ein Doppeltipp buchte zweimal und zöge den Vorrat zweimal ab (D1).
        if (sperre.current) {
          e.preventDefault()
          return
        }
        sperre.current = true
        // Das Formular vorher festhalten: Nach der Prüfung (asynchron) ist currentTarget des Ereignisses schon leer.
        const formular = e.currentTarget
        return form.handleSubmit((w) => absenden(w, formular))(e).finally(() => {
          sperre.current = false
        })
      }}
      noValidate className="flex flex-col gap-4">
      {/* Im Blatt: „Abbrechen“ oben rechts neben dem Titel (V11). Im Dialog trägt DialogMitte Titel und „Abbrechen“. */}
      {kopf && (
        <div className="flex w-full items-start justify-between gap-3">
          <div className="min-w-0 pt-2">{kopf.titel(bearbeiten ? 'Verkauf bearbeiten' : 'Verkauf eintragen')}</div>
          <button
            type="button"
            onClick={kopf.onAbbrechen}
            className={cn('-mr-2 inline-flex min-h-11 shrink-0 items-center rounded-full px-2 text-[15px] font-semibold text-foreground hover:bg-muted', FOKUS_RAHMEN)}
          >
            Abbrechen
          </button>
        </div>
      )}
      {/* Der Tag als Chip unter dem Titel, ohne Symbole (Board s2-/w2-verkaeufe Bild 2); ein Tipp öffnet das Datumsfeld. */}
      <button
        type="button"
        onClick={() => setDatumOffen((o) => !o)}
        aria-expanded={datumOffen}
        aria-controls="verkauf-datum-feld"
        aria-label={`Tag: ${datumText} — ändern`}
        className={cn(
          'inline-flex min-h-11 w-fit shrink-0 items-center rounded-full border border-input bg-card px-4 text-[14px] font-semibold text-foreground hover:bg-muted',
          FOKUS_RAHMEN
        )}
      >
        {datumText}
      </button>

      {datumOffen && (
        <div id="verkauf-datum-feld">
          <label htmlFor="verkauf-datum" className={FELD_LABEL}>
            An welchem Tag?
          </label>
          <input
            id="verkauf-datum"
            type="date"
            max={heute}
            value={werte.saleDate}
            onChange={(e) => e.target.value && form.setValue('saleDate', e.target.value)}
            className={cn(FELD, 'min-h-11 appearance-none')}
          />
        </div>
      )}

      {/* Der Betrag — groß in der Grundschrift, nur mit Unterstrich (Board: kein Kasten, keine Serife); Komma oder Punkt (DezimalFeld). */}
      <div>
        <label htmlFor="verkauf-betrag" className="mb-1 block text-[15px] font-semibold text-foreground">
          Betrag in Euro
        </label>
        <div
          className={cn(
            'flex items-center gap-2 border-b-2 border-status-fertig px-1 transition-colors',
            fehler.totalAmount && 'border-status-offen'
          )}
        >
          <span aria-hidden="true" className="text-[30px] font-bold text-foreground">
            €
          </span>
          <DezimalFeld
            id="verkauf-betrag"
            ref={betragRef}
            value={werte.totalAmount}
            onChange={(wert) => {
              form.setValue('totalAmount', wert)
              form.clearErrors('totalAmount')
            }}
            stellen={2}
            placeholder="0,00"
            aria-invalid={fehler.totalAmount ? true : undefined}
            aria-describedby={fehler.totalAmount ? 'verkauf-betrag-fehler' : undefined}
            className="h-16 rounded-none border-0 bg-transparent px-1 font-sans text-[34px] font-bold text-foreground tabular-nums shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring focus-visible:outline-solid md:text-[34px] dark:bg-transparent"
          />
        </div>
        {fehler.totalAmount?.message && <FeldFehler id="verkauf-betrag-fehler">{fehler.totalAmount.message}</FeldFehler>}
      </div>

      {/* Wo verkauft? — „Anderes“ als unterstrichener Link rechts neben der Frage (Board s2-/w2-verkaeufe Bild 2). */}
      <div role="group" aria-labelledby={woId} className="min-w-0">
        <div className="mb-1 flex items-center justify-between gap-3">
          <p id={woId} className="text-[15px] font-semibold text-foreground">
            Wo verkauft?
          </p>
          <button
            type="button"
            aria-pressed={werte.channel === 'OTHER'}
            onClick={() => form.setValue('channel', 'OTHER')}
            className={cn(TEXT_LINK, werte.channel === 'OTHER' && 'decoration-2')}
          >
            Anderes
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {/* Ohne Symbole (Liste Lauf 32 verkaeufe: „Kanal-Knöpfe mit Symbolen“). */}
          {HAUPTKANAELE.map((k) => {
            const aktiv = werte.channel === k.value
            return (
              <button
                key={k.value}
                type="button"
                aria-pressed={aktiv}
                onClick={() => form.setValue('channel', k.value)}
                className={cn(
                  'flex min-h-12 min-w-0 items-center justify-center border px-1 py-2 text-center transition-colors duration-[250ms]',
                  RUNDUNG.feld,
                  aktiv ? WAHL_AN : WAHL_AUS,
                  FOKUS_RAHMEN
                )}
              >
                <span className="max-w-full truncate text-[14px] font-semibold">{k.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Was hast du verkauft? — optional (Board s2/w2-verkaeufe) */}
      <fieldset className="min-w-0">
        <legend className="mb-2 text-[15px] font-semibold text-foreground">
          Was hast du verkauft? <span className="font-normal text-muted-foreground">(optional)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {chips.map((p) => {
            const aktiv = werte.productId === p.id
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={aktiv}
                title={p.name}
                onClick={() => waehleProdukt(p)}
                className={cn('min-h-11 max-w-full truncate rounded-full border px-4 text-sm font-semibold transition-colors duration-[250ms]', aktiv ? WAHL_AN : WAHL_AUS, FOKUS_RAHMEN)}
              >
                {p.name}
              </button>
            )
          })}
          <button
            type="button"
            aria-pressed={werte.freierName}
            onClick={() => waehleProdukt(null)}
            className={cn(
              'min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors duration-[250ms]',
              werte.freierName ? WAHL_AN : cn(WAHL_AUS, 'border-dashed'),
              FOKUS_RAHMEN
            )}
          >
            Anderes
          </button>
        </div>
        {werte.freierName && (
          <div className="mt-2.5">
            <label htmlFor="verkauf-name" className="sr-only">
              Was hast du verkauft?
            </label>
            <input
              id="verkauf-name"
              autoFocus
              placeholder="Was hast du verkauft?"
              aria-invalid={fehler.productName ? true : undefined}
              aria-describedby={fehler.productName ? 'verkauf-name-fehler' : undefined}
              className={cn(FELD, 'min-h-11')}
              {...form.register('productName', { onChange: () => form.clearErrors('productName') })}
            />
            <ZeichenZaehler laenge={werte.productName.length} max={PRODUKTNAME_MAX} />
            {fehler.productName?.message && <FeldFehler id="verkauf-name-fehler">{fehler.productName.message}</FeldFehler>}
          </div>
        )}
      </fieldset>

      {/* Menge vor dem Vorrat und ohne Klappe: schmales Feld, daneben „Stück · Notiz ergänzen“ (Board s2-/w2-verkaeufe Bild 2). */}
      <div>
        <label htmlFor="verkauf-menge" className={FELD_LABEL}>
          Menge
        </label>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <DezimalFeld
            id="verkauf-menge"
            value={werte.quantity}
            onChange={(wert) => {
              form.setValue('quantity', wert)
              form.clearErrors('quantity')
            }}
            aria-invalid={fehler.quantity ? true : undefined}
            aria-describedby={fehler.quantity ? 'verkauf-menge-fehler' : undefined}
            className={cn(FELD, 'w-[120px] shadow-none focus-visible:ring-0 dark:bg-background')}
          />
          <span className="flex items-center gap-1.5 text-[14px] text-muted-foreground">
            {einheit && (
              <>
                <span>{einheit}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <button
              type="button"
              aria-expanded={notizOffen}
              aria-controls="verkauf-notiz-feld"
              onClick={() => setNotizOffen((o) => !o)}
              className={cn(TEXT_LINK, 'text-[14px]')}
            >
              Notiz ergänzen
            </button>
          </span>
        </div>
        {fehler.quantity?.message && <FeldFehler id="verkauf-menge-fehler">{fehler.quantity.message}</FeldFehler>}
        {notizOffen && (
          <div id="verkauf-notiz-feld" className="mt-3">
            <label htmlFor="verkauf-notiz" className={FELD_LABEL}>
              Notiz
            </label>
            <textarea
              id="verkauf-notiz"
              placeholder="z. B. Stammkundin, Rechnung folgt"
              rows={2}
              aria-invalid={fehler.note ? true : undefined}
              aria-describedby={fehler.note ? 'verkauf-notiz-fehler' : undefined}
              className={cn(FELD, 'h-auto resize-none py-2.5')}
              {...form.register('note', { onChange: () => form.clearErrors('note') })}
            />
            <ZeichenZaehler laenge={werte.note.length} max={NOTIZ_MAX} />
            {fehler.note?.message && <FeldFehler id="verkauf-notiz-fehler">{fehler.note.message}</FeldFehler>}
          </div>
        )}
      </div>

      {/* Vorrat abziehen (D1) — nur beim Eintragen mit einem Produkt aus dem Sortiment, nach der Menge. Die ganze Zeile
          ist der Schalter (44 px, role="switch") wie „Teilen-Hinweise zeigen"; fester Name, der Satz darunter beschreibt. */}
      {vorratSchalter && (
        <button
          type="button"
          role="switch"
          aria-checked={werte.vorratAbziehen}
          aria-label={VORRAT_ABZIEHEN}
          aria-describedby={vorratTextId}
          onClick={() => form.setValue('vorratAbziehen', !werte.vorratAbziehen)}
          className={cn('-my-1 flex min-h-11 w-full items-center gap-3 rounded-xl py-1 text-left', FOKUS_RAHMEN)}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-foreground">{VORRAT_ABZIEHEN}</span>
            <span id={vorratTextId} className="block text-[13px] leading-normal break-words text-muted-foreground">
              {vorratSchalterText(werte.vorratAbziehen, gewaehlt, werte.quantity, werte.unit)}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={cn('relative block h-6 w-10 shrink-0 rounded-full transition-colors duration-[250ms]', werte.vorratAbziehen ? 'bg-accent' : 'bg-border')}
          >
            <span
              className={cn(
                'absolute top-[3px] block size-[18px] rounded-full transition-transform duration-[250ms]',
                werte.vorratAbziehen ? 'translate-x-[19px] bg-accent-foreground' : 'translate-x-[3px] bg-muted-foreground'
              )}
            />
          </span>
        </button>
      )}

      <p className="text-[13px] leading-normal text-muted-foreground">
        Nur Verkäufe, die nicht über {MARKE} bestellt wurden. Bestellungen zählt die Auswertung von selbst – auch die mit &bdquo;Bar bei
        Abholung&ldquo;.
      </p>

      {/* Speicherfehler als Kasten in der Warnfarbe (G6), ohne „Nochmal“ (D1, Liste Lauf 32 C). */}
      <SpeicherFehler text={serverFehler} />

      {/* Genau ein „Abbrechen“ (oben rechts); unten nur der Hauptknopf, ohne abgesetzte Fußleiste. Im Blatt bleibt er
          beim Scrollen unten stehen (Board s2-verkaeufe Bild 2: der Knopf ist immer zu sehen). */}
      {breit ? hauptKnopf : <div className="sticky bottom-0 -mx-1 bg-popover px-1 pt-2">{hauptKnopf}</div>}
    </form>
  )
}

/**
 * Der Rahmen um das Formular: ab 768 px der zentrierte Dialog (`DialogMitte`), darunter das Blatt (höchstens
 * 86 % hoch, DESIGN_SYSTEM „Dialoge und Blätter“). Neu trägt der Fokus gleich ins Betragsfeld (am Handy geht die
 * Zifferntastatur auf).
 */
export function VerkaufDialog({
  offen,
  verkauf,
  vorlage,
  produkte,
  topProduktIds,
  onSchliessen,
}: {
  offen: boolean
  verkauf: VerkaufDaten | null
  vorlage: VerkaufDaten | null
  produkte: VerkaufProdukt[]
  topProduktIds: string[]
  onSchliessen: () => void
}): React.JSX.Element {
  const breit = useMindestbreite(768)
  const betragRef = useRef<HTMLInputElement>(null)
  // Solange gespeichert wird, schließen weder „Abbrechen“ noch Escape noch ein Tipp daneben: Wer schließt und neu öffnet,
  // trüge sonst ein zweites Mal ein, und ein Fehlschlag bliebe unsichtbar. Sichtbar gesperrt wird nichts (G6).
  const [speichert, setSpeichert] = useState(false)
  const schliessen = (): void => {
    if (!speichert) onSchliessen()
  }
  const fokus = verkauf ? undefined : betragRef
  // Ein anderer Verkauf ist ein anderes Formular — nie Werte des vorigen.
  const schluessel = `${verkauf?.id ?? ''}|${vorlage?.id ?? ''}`
  const formular = (kopf?: FormularProps['kopf']) => (
    <VerkaufFormular
      key={schluessel}
      verkauf={verkauf}
      vorlage={vorlage}
      produkte={produkte}
      topProduktIds={topProduktIds}
      kopf={kopf}
      onFertig={onSchliessen}
      onSpeichern={setSpeichert}
      breit={breit}
      betragRef={betragRef}
    />
  )

  if (breit) {
    return (
      <Dialog open={offen} onOpenChange={(o) => !o && schliessen()}>
        <DialogMitte titel={verkauf ? 'Verkauf bearbeiten' : 'Verkauf eintragen'} schliessen="Abbrechen" initialFocus={fokus} className="max-w-[560px]">
          {formular()}
        </DialogMitte>
      </Dialog>
    )
  }

  return (
    <Sheet open={offen} onOpenChange={(o) => !o && schliessen()}>
      <SheetBlatt initialFocus={fokus} className="max-h-[86dvh]">
        {formular({
          titel: (text) => <SheetTitle className="font-heading text-xl leading-tight font-semibold break-words">{text}</SheetTitle>,
          onAbbrechen: schliessen,
        })}
      </SheetBlatt>
    </Sheet>
  )
}
