'use client'

import { useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { CalendarDays, Check, ChevronDown } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetBlatt, SheetTitle } from '@/components/ui/sheet'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { DezimalFeld } from '@/components/shared/dezimal-feld'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { KANAL_SYMBOL } from '@/components/sales/kanal-symbol'
import { DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FeldFehler } from '@/components/checkout/kasse-teile'
import { FELD, FELD_LABEL, KNOPF_ORANGE, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { createManualSale, updateManualSale } from '@/server/actions/manual-sales'
import type { VerkaufDaten, VerkaufProdukt } from '@/lib/hof-verkaeufe'
import { manualSaleFormSchema } from '@/schemas/manual-sale'
import { verkaufskanalSchema, type Verkaufskanal } from '@/schemas/verkaufskanal'
import { NOTIZ_MAX, PRODUKTNAME_MAX } from '@/lib/eingabegrenzen'
import { wienKalendertag } from '@/lib/kalender'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { STANDARD_KANAL, kanalSpeicher, kanalVorauswahl, merkeKanal } from '@/lib/verkaufskanal-speicher'
import {
  HAUPTKANAELE,
  VORRAT_ABZIEHEN,
  datumKurz,
  istOhneProdukt,
  knopfText,
  mengenEinheit,
  produktChips,
  vorratSchalterText,
} from '@/lib/verkauf-eintragen'
import { cn } from '@/lib/utils'

/*
 * „Verkauf eintragen" im neuen Design (Nachtlauf Nr. 22b, Register E13) —
 * dieselbe Funktion wie vorher, nur nach docs/ai/DESIGN_SYSTEM.md gezeichnet:
 * ab 768 px ein Dialog (Titel links, Aktionen rechts unten), darunter ein
 * Blatt von unten mit dem Hauptknopf über die volle Breite und „Abbrechen"
 * als Textknopf („Dialoge und Blätter"). Betrag zuerst (Vorbild GoPay,
 * Expensify, KOHO): oben groß der Betrag, darunter der Weg, alles andere
 * freiwillig. Der Knopf nennt den Betrag.
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
const KLAPPER = cn('inline-flex min-h-11 items-center gap-1.5 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)

type FormularProps = {
  /** Gesetzt = Bearbeiten. */
  verkauf: VerkaufDaten | null
  /** Gesetzt = Wiederholen (neuer Verkauf mit diesen Werten, Tag heute). */
  vorlage: VerkaufDaten | null
  produkte: VerkaufProdukt[]
  /** Die meistverkauften Produkte des Hofs, meistverkauft zuerst (getMeistverkaufteProduktIds). */
  topProduktIds: string[]
  /** Dialog- bzw. Blatt-Titel — er benennt das Fenster für den Screenreader. */
  titel: (text: string) => ReactNode
  onFertig: () => void
  onAbbrechen: () => void
  /** Ab 768 px: Aktionen rechts unten statt Hauptknopf über die volle Breite. */
  breit: boolean
  betragRef?: RefObject<HTMLInputElement | null>
}

export function VerkaufFormular({
  verkauf,
  vorlage,
  produkte,
  topProduktIds,
  titel,
  onFertig,
  onAbbrechen,
  breit,
  betragRef,
}: FormularProps): React.JSX.Element {
  const bearbeiten = verkauf !== null
  // Der Tag des Browsers beim Öffnen: Wer die Seite über Nacht offen lässt, trägt morgens trotzdem „heute" ein.
  const [heute] = useState(() => wienKalendertag(new Date()))
  const [start] = useState(() => startWerte(verkauf, vorlage, heute))
  const [mehrOffen, setMehrOffen] = useState(start.note !== '' || (start.quantity !== null && start.quantity !== 1))
  const [datumOffen, setDatumOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [serverFehler, setServerFehler] = useState<string | null>(null)

  const form = useForm<FormWerte>({ defaultValues: start })
  // Alle Felder haben Startwerte — der Teil-Typ von useWatch trifft hier nie zu.
  const werte = useWatch({ control: form.control }) as FormWerte
  const chips = produktChips(topProduktIds, produkte, werte.productId)
  const knopf = knopfText(werte.totalAmount, bearbeiten)
  const fehler = form.formState.errors
  // Das gewählte Produkt aus dem Sortiment — nur dann gibt es einen Vorrat abzuziehen.
  const gewaehlt = werte.productId ? produkte.find((p) => p.id === werte.productId) : undefined
  const einheit = werte.unit ? mengenEinheit(werte.unit, gewaehlt?.unitSize ?? null) : undefined
  // D1 regelt nur das Eintragen: Beim Bearbeiten gibt es den Schalter nicht (und keine Gegenbuchung).
  const vorratSchalter = !bearbeiten && gewaehlt !== undefined
  const vorratTextId = useId()
  const datumText = datumKurz(werte.saleDate, heute)

  function waehleProdukt(produkt: VerkaufProdukt | null) {
    const abwaehlen = produkt ? werte.productId === produkt.id : werte.freierName
    form.setValue('productId', abwaehlen || !produkt ? null : produkt.id)
    form.setValue('freierName', !abwaehlen && !produkt)
    form.setValue('productName', '')
    form.setValue('unit', abwaehlen || !produkt ? null : produkt.unit)
  }

  async function absenden(w: FormWerte) {
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
      for (const issue of geprueft.error.issues) {
        const feld = issue.path[0]
        if (feld === 'totalAmount' || feld === 'quantity' || feld === 'productName' || feld === 'note') {
          form.setError(feld, { message: issue.message })
          if (feld === 'quantity' || feld === 'note') setMehrOffen(true)
        } else {
          if (feld === 'saleDate') setDatumOffen(true)
          setServerFehler(issue.message)
        }
      }
      return
    }

    setLaeuft(true)
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
      setServerFehler('Wir konnten den Verkauf nicht speichern. Bitte versuch es noch einmal.')
    } finally {
      setLaeuft(false)
    }
  }

  const hauptKnopf = (
    <button
      type="submit"
      disabled={laeuft || !knopf.aktiv}
      aria-busy={laeuft || undefined}
      className={cn(KNOPF_ORANGE, 'min-w-[150px] tabular-nums', !breit && 'w-full rounded-[14px]')}
    >
      {laeuft ? 'Einen Moment …' : knopf.text}
    </button>
  )

  return (
    <form onSubmit={form.handleSubmit(absenden)} noValidate className={cn('flex min-h-0 flex-col', breit ? 'max-h-[min(92dvh,760px)]' : 'gap-4')}>
      <div className={cn('flex items-start justify-between gap-3', breit && 'px-6 pt-6')}>
        <div className="min-w-0">{titel(bearbeiten ? 'Verkauf bearbeiten' : 'Verkauf eintragen')}</div>
        <button
          type="button"
          onClick={() => setDatumOffen((o) => !o)}
          aria-expanded={datumOffen}
          aria-controls="verkauf-datum-feld"
          aria-label={`Tag: ${datumText} — ändern`}
          className={cn('inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[13px] font-medium text-foreground hover:bg-muted', FOKUS_RAHMEN)}
        >
          <CalendarDays className="size-4 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          {datumText}
          <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', datumOffen && 'rotate-180')} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>

      <div className={cn('flex flex-col gap-5', breit && 'min-h-0 flex-1 overflow-y-auto px-6 py-5')}>
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

        {/* Der Betrag — groß, mit Komma oder Punkt (DezimalFeld). Der Fokus liegt am Rahmen um Feld und Zeichen. */}
        <div>
          <label htmlFor="verkauf-betrag" className="sr-only">
            Betrag in Euro
          </label>
          <div
            className={cn(
              'flex items-center gap-2 border-b-2 border-border px-1 transition-colors focus-within:border-status-fertig',
              'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring focus-within:outline-solid',
              fehler.totalAmount && 'border-status-offen'
            )}
          >
            <span aria-hidden="true" className="font-heading text-3xl font-semibold text-muted-foreground">
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
              className="h-16 rounded-none border-0 bg-transparent px-0 font-heading text-4xl font-bold text-foreground tabular-nums shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 md:text-4xl dark:bg-transparent"
            />
          </div>
          {fehler.totalAmount?.message && <FeldFehler id="verkauf-betrag-fehler">{fehler.totalAmount.message}</FeldFehler>}
        </div>

        {/* Wo verkauft? */}
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-semibold text-foreground">Wo verkauft?</legend>
          <div className="grid grid-cols-4 gap-2">
            {HAUPTKANAELE.map((k) => {
              const Symbol = KANAL_SYMBOL[k.value]
              const aktiv = werte.channel === k.value
              return (
                <button
                  key={k.value}
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() => form.setValue('channel', k.value)}
                  className={cn(
                    'flex min-h-16 min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 py-2.5 text-center transition-colors duration-[250ms]',
                    aktiv ? WAHL_AN : WAHL_AUS,
                    FOKUS_RAHMEN
                  )}
                >
                  <Symbol className="size-5" strokeWidth={1.7} aria-hidden="true" />
                  <span className="max-w-full truncate text-xs font-semibold">{k.label}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            aria-pressed={werte.channel === 'OTHER'}
            onClick={() => form.setValue('channel', 'OTHER')}
            className={cn(
              'mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors duration-[250ms]',
              werte.channel === 'OTHER' ? cn(WAHL_AN, 'font-semibold') : cn(WAHL_AUS, 'border-dashed font-medium'),
              FOKUS_RAHMEN
            )}
          >
            {/* Gewählt sagt aria-pressed — der Haken ist nur fürs Auge. */}
            {werte.channel === 'OTHER' && <Check className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />}
            Anderer Weg
          </button>
        </fieldset>

        {/* Was? — freiwillig */}
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-semibold text-foreground">
            Was? <span className="font-normal text-muted-foreground">— freiwillig</span>
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
                  className={cn('min-h-11 max-w-full truncate rounded-full border px-4 text-sm font-medium transition-colors duration-[250ms]', aktiv ? WAHL_AN : WAHL_AUS, FOKUS_RAHMEN)}
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
                'min-h-11 rounded-full border px-4 text-sm font-medium transition-colors duration-[250ms]',
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

        {/* Vorrat abziehen (D1) — nur beim Eintragen mit einem Produkt aus dem Sortiment. Die ganze Zeile ist der
            Schalter (44 px, role="switch") wie „Teilen-Hinweise zeigen"; fester Name, der Satz darunter beschreibt. */}
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
              <span className="block text-sm font-semibold text-foreground">{VORRAT_ABZIEHEN}</span>
              <span id={vorratTextId} className="block text-[13px] leading-normal break-words text-muted-foreground">
                {vorratSchalterText(werte.vorratAbziehen, gewaehlt, werte.quantity)}
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

        {/* Menge oder Notiz — zugeklappt */}
        <div>
          <button type="button" aria-expanded={mehrOffen} aria-controls="verkauf-mehr" onClick={() => setMehrOffen((o) => !o)} className={KLAPPER}>
            <ChevronDown className={cn('size-4 transition-transform', mehrOffen && 'rotate-180')} strokeWidth={1.7} aria-hidden="true" />
            Menge oder Notiz ergänzen
          </button>
          {mehrOffen && (
            <div id="verkauf-mehr" className="mt-2 flex flex-col gap-3">
              <div>
                <label htmlFor="verkauf-menge" className={FELD_LABEL}>
                  Menge
                </label>
                <DezimalFeld
                  id="verkauf-menge"
                  value={werte.quantity}
                  onChange={(wert) => {
                    form.setValue('quantity', wert)
                    form.clearErrors('quantity')
                  }}
                  suffix={einheit}
                  placeholder="z. B. 2,5"
                  aria-invalid={fehler.quantity ? true : undefined}
                  aria-describedby={fehler.quantity ? 'verkauf-menge-fehler' : undefined}
                  className={cn(FELD, 'h-11 shadow-none focus-visible:ring-0 dark:bg-background')}
                />
                {fehler.quantity?.message && <FeldFehler id="verkauf-menge-fehler">{fehler.quantity.message}</FeldFehler>}
              </div>
              <div>
                <label htmlFor="verkauf-notiz" className={FELD_LABEL}>
                  Notiz
                </label>
                <textarea
                  id="verkauf-notiz"
                  placeholder="z. B. Stammkundin, Rechnung folgt"
                  rows={2}
                  aria-invalid={fehler.note ? true : undefined}
                  aria-describedby={fehler.note ? 'verkauf-notiz-fehler' : undefined}
                  className={cn(FELD, 'resize-none')}
                  {...form.register('note', { onChange: () => form.clearErrors('note') })}
                />
                <ZeichenZaehler laenge={werte.note.length} max={NOTIZ_MAX} />
                {fehler.note?.message && <FeldFehler id="verkauf-notiz-fehler">{fehler.note.message}</FeldFehler>}
              </div>
            </div>
          )}
        </div>

        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Nur Verkäufe, die nicht über FarmerZone bestellt wurden. Bestellungen zählt die Auswertung von selbst — auch die mit &bdquo;Bar bei
          Abholung&ldquo;.
        </p>

        <DialogFehler text={serverFehler} />
      </div>

      {breit ? (
        <div className="flex flex-wrap justify-end gap-2.5 border-t border-border px-6 py-4">
          <button type="button" onClick={onAbbrechen} disabled={laeuft} className={KNOPF_RAHMEN}>
            Abbrechen
          </button>
          {hauptKnopf}
        </div>
      ) : (
        <>
          {hauptKnopf}
          <button
            type="button"
            onClick={onAbbrechen}
            disabled={laeuft}
            className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-status-fertig hover:bg-muted', FOKUS_RAHMEN)}
          >
            Abbrechen
          </button>
        </>
      )}
    </form>
  )
}

/**
 * Der Rahmen um das Formular: ab 768 px Dialog, darunter Blatt. Neu trägt der
 * Fokus gleich ins Betragsfeld (am Handy geht die Zifferntastatur auf).
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
  const fokus = verkauf ? undefined : betragRef
  // Ein anderer Verkauf ist ein anderes Formular — nie Werte des vorigen.
  const schluessel = `${verkauf?.id ?? ''}|${vorlage?.id ?? ''}`
  const formular = (titel: FormularProps['titel']) => (
    <VerkaufFormular
      key={schluessel}
      verkauf={verkauf}
      vorlage={vorlage}
      produkte={produkte}
      topProduktIds={topProduktIds}
      titel={titel}
      onFertig={onSchliessen}
      onAbbrechen={onSchliessen}
      breit={breit}
      betragRef={betragRef}
    />
  )

  if (breit) {
    return (
      <Dialog open={offen} onOpenChange={(o) => !o && onSchliessen()}>
        <DialogContent initialFocus={fokus} showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-[520px]">
          {formular((text) => (
            <DialogTitle className="font-heading text-[22px] leading-tight font-semibold break-words">{text}</DialogTitle>
          ))}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={offen} onOpenChange={(o) => !o && onSchliessen()}>
      <SheetBlatt initialFocus={fokus}>
        {formular((text) => (
          <SheetTitle className="font-heading text-xl leading-tight font-semibold break-words">{text}</SheetTitle>
        ))}
      </SheetBlatt>
    </Sheet>
  )
}
