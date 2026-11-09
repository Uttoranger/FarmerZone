'use client'

import { cloneElement, isValidElement, useId, useState } from 'react'
import { Check, ChevronDown, Lock, Plus, X } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ProduktDialogKopf } from '@/components/produkte/produkt-dialog-kopf'
import { Button } from '@/components/ui/button'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { ABHOLHINWEIS_SYMBOL, ABHOLHINWEIS_TEXT, ABHOLHINWEIS_VALUES, ABHOLUNG_ABSCHNITT, schalteAbholhinweis, type AbholhinweisValue } from '@/lib/abholhinweise'
import { feldFehlerAttribute, fehlerKennung, hilfeKennung } from '@/components/shared/formular-meldungen'
import { cn } from '@/lib/utils'
import { EuroCentFeld, KeinRuecktrittHaken } from '@/components/products/ruecktritt-felder'
import { FREIWILLIG } from '@/lib/profil-meldungen'
import { RUECKTRITT_TEXT, type RuecktrittAngabe } from '@/lib/ruecktritt-angaben'
import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { FORMULAR_PRUEFEN, type SpeicherFehlerAnzeige } from '@/lib/produkte-hof'

/*
 * Bausteine der beiden Formulare mit Verkaufsgrößen (Futter, Brennmaterial;
 * Nachtlauf Nr. 20, Mockups web-h2-neues-futter, mobil-h2-neues-futter-
 * meldung-fehlt, web-h2-neues-brennmaterial, mobil-h2-neues-brennmaterial).
 * Nur Darstellung — was gilt, entscheiden src/lib/futter-registrierung.ts,
 * src/lib/verkaufsgroessen.ts und die Schemas in src/schemas/produktfamilie.ts.
 */

/**
 * Der Rahmen: am Handy über die ganze Fläche (wie der Produktdialog, Mockups
 * mobil-h2-*), ab 640 px ein Dialog. Kopf fest, Inhalt scrollt, Fuß fest mit
 * „Abbrechen" und dem einen orangen Knopf.
 */
export function FamilienDialog({
  open,
  onClose,
  titel,
  art,
  satz,
  hinweis,
  speichernText,
  speichert,
  onSpeichern,
  meldung,
  children,
}: {
  open: boolean
  onClose: () => void
  titel: string
  /** Die Produktart als Unterzeile am Handy (Liste Lauf 32, produkt-neu 390). */
  art: string
  satz: string
  /** Satz über den Knöpfen, z. B. was sofort online geht (speichernHinweis). */
  hinweis?: string | null
  speichernText: string
  speichert: boolean
  onSpeichern: () => void
  /** Die orange Karte über den Feldern (V17): „Bitte prüfe die markierten Felder." oder ein Speicherfehler. */
  meldung?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !speichert && onClose()}>
      <DialogContent
        data-app-palette="neu"
        className="flex h-[100dvh] max-h-[100dvh] max-w-full flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[92dvh] sm:max-w-[760px] sm:rounded-[16px]"
        showCloseButton={false}
      >
        <ProduktDialogKopf titel={titel} art={art} satz={satz} zurueckGesperrt={speichert} />
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onSpeichern()
          }}
          className={cn('flex min-h-0 flex-1 flex-col', FELD_FEHLER_IM_FORMULAR)}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-8 sm:px-6">
            <div className="flex flex-col gap-6">
              {meldung}
              {children}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-card px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
            {hinweis && (
              <p className="text-[13px] leading-snug text-muted-foreground" aria-live="polite">
                {hinweis}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={speichert} className="min-h-11">
                Abbrechen
              </Button>
              <Button type="submit" disabled={speichert} className="min-h-12 w-full rounded-[10px] text-[15px] font-bold sm:min-h-11 sm:w-auto sm:min-w-[160px] sm:rounded-full">
                {speichert ? 'Speichere …' : speichernText}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Ein Abschnitt mit Überschrift und optionalem Satz darunter. */
export function Abschnitt({
  titel,
  satz,
  children,
  id,
}: {
  titel: string
  satz?: string
  children: React.ReactNode
  id?: string
}): React.JSX.Element {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div>
        <h3 id={id} className="text-[15px] font-semibold text-foreground">
          {titel}
        </h3>
        {satz && <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{satz}</p>}
      </div>
      {children}
    </section>
  )
}

/**
 * Eine aufklappbare Karte wie die Abschnitte des Produktdialogs (Board s1-/w1-produkt-neu, Bild 3 und 4; Abnahme
 * Lauf 32, Nr. 277): Kopf als Knopf mit Titel und Kurzstand („Pflicht · noch offen“), darunter der Inhalt. Zu
 * steht unter dem Kopf ein Satz und der Knopf, der sie öffnet („Angaben eintragen“). `immerOffen` öffnet sie
 * von außen — nach einem Fehler darin muss das Feld sichtbar sein, sonst findet der Sprung zum Feld nichts.
 * Der Inhalt bleibt eingehängt (nur `hidden`), damit Eingaben beim Zuklappen nie verloren gehen.
 */
export function KlappKarte({
  titel,
  stand,
  satz,
  oeffnenText,
  anfangsOffen = false,
  immerOffen = false,
  fehler = false,
  children,
}: {
  titel: string
  /** Die Zeile unter dem Titel — offen wie zu (Liste Lauf 32, produkt-neu: Kartenköpfe mit Zusammenfassung). */
  stand: string
  /** Steht zugeklappt unter dem Kopf. */
  satz?: string
  /** Der Knopf der zugeklappten Karte; ohne ihn öffnet nur der Kopf. */
  oeffnenText?: string
  anfangsOffen?: boolean
  immerOffen?: boolean
  /** Ein Feld darin hat einen Fehler: der Kurzstand wird orange (wie „Bitte prüfen“ im Produktdialog). */
  fehler?: boolean
  children: React.ReactNode
}): React.JSX.Element {
  const [offenGewaehlt, setOffenGewaehlt] = useState(anfangsOffen)
  const offen = offenGewaehlt || immerOffen
  const id = useId()
  return (
    <section aria-labelledby={`${id}-titel`} className="rounded-[14px] border border-border bg-card px-4">
      <h3 id={`${id}-titel`} className="m-0">
        <button
          type="button"
          aria-expanded={offen}
          aria-controls={`${id}-inhalt`}
          onClick={() => setOffenGewaehlt(!offen)}
          className={cn('flex min-h-14 w-full items-center gap-3 rounded-md py-3 text-left', FOKUS_RAHMEN)}
        >
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[16px] font-bold text-foreground">{titel}</span>
            <span className={cn('text-[13px]', fehler ? 'font-semibold text-status-offen' : 'text-muted-foreground')}>{stand}</span>
          </span>
          <ChevronDown className={cn('size-5 shrink-0 text-muted-foreground transition-transform', offen && 'rotate-180')} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </h3>
      {!offen && (satz || oeffnenText) && (
        <div className="flex flex-col gap-3 pb-4">
          {satz && <p className="text-[14px] leading-snug text-muted-foreground">{satz}</p>}
          {oeffnenText && (
            <button
              type="button"
              onClick={() => setOffenGewaehlt(true)}
              className={cn(
                'inline-flex min-h-[52px] w-full items-center justify-center rounded-[14px] border-[1.5px] border-foreground/70 bg-card px-4 text-[15px] font-bold text-foreground transition-colors duration-[250ms] hover:bg-muted',
                FOKUS_RAHMEN
              )}
            >
              {oeffnenText}
            </button>
          )}
        </div>
      )}
      <div id={`${id}-inhalt`} hidden={!offen} className="flex flex-col gap-4 pb-4">
        {children}
      </div>
    </section>
  )
}

/**
 * Ein Feld mit Beschriftung, Hilfe und Fehler. Fehler orange (Register O1:
 * Fehlertext bis zum eigenen Token als `text-status-offen`).
 */
/** Die Kennung des Eingabefelds zu einem Feld-Schlüssel („groessen.0.price" → „feld-groessen-0-price"). */
export function feldId(feld: string): string {
  return `feld-${feld.replace(/\./g, '-')}`
}

export function Feld({
  feld,
  label,
  hilfe,
  fehler,
  children,
  labelKlasse,
  labelZusatz,
}: {
  /** Für Screenreader hinter der Beschriftung — „Preis" steht je Größe einmal, das nennt welche. */
  labelZusatz?: string
  /** Schlüssel wie im Schema („name", „groessen.0.price") — Sprungziel beim ersten Fehler. */
  feld: string
  label: string
  hilfe?: string
  fehler?: string
  children: React.ReactNode
  labelKlasse?: string
}): React.JSX.Element {
  const id = feldId(feld)
  // Fehler bzw. Hilfe gehören zum Eingabefeld, nicht nur daneben: aria-invalid und aria-describedby
  // setzt der Rahmen selbst, so tragen alle Felder beider Formulare sie (WCAG 3.3.1).
  const verbindung = feldFehlerAttribute(id, Boolean(fehler), !fehler && Boolean(hilfe))
  const eingabe = isValidElement<Record<string, unknown>>(children) && Object.keys(verbindung).length > 0 ? cloneElement(children, verbindung) : children
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-feld={feld}>
      {/* Fett und 15 px wie im Board s1-produkt-neu (Lauf 31). */}
      <label htmlFor={id} className={cn('text-[15px] font-semibold text-foreground', labelKlasse)}>
        {label}
        {labelZusatz && <span className="sr-only"> {labelZusatz}</span>}
      </label>
      {eingabe}
      {fehler ? (
        <FeldFehler id={fehlerKennung(id)}>{fehler}</FeldFehler>
      ) : hilfe ? (
        <p id={hilfeKennung(id)} className="text-xs text-muted-foreground">
          {hilfe}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Der orange Rand jedes Felds mit Fehler im Formular (V17; Board s1/w1-produkt-neu, Bild 5): 2 px
 * `status-offen` über `aria-invalid` — für alle Felder darunter, auch DezimalFeld und Textarea, deren
 * Grundbausteine sonst rot zeichnen. Wie FELD_FEHLER_RAHMEN (ui/feld-fehler.tsx), nur für einen
 * ganzen Teilbaum; wichtig (`!`), weil die Grundbausteine dieselbe Spezifität tragen. Den Fokusring
 * nimmt `ring-0!` nur ohne Fokus: Mit der Tastatur darauf zeigt das Feld ihn wieder (WCAG 2.4.7).
 */
export const FELD_FEHLER_IM_FORMULAR =
  '[&_[aria-invalid=true]]:border-2! [&_[aria-invalid=true]]:border-status-offen! [&_[aria-invalid=true]]:ring-0! [&_[aria-invalid=true]:focus-visible]:ring-2! [&_[aria-invalid=true]:focus-visible]:ring-ring!'

/**
 * Die eine orange Karte über den Feldern (V17; Board s1/w1-produkt-neu, Bild 5 und 6): ein
 * Speicherfehler (mit „Nochmal", wo er wiederholbar ist) geht vor „Bitte prüfe die markierten
 * Felder." — beides nie als Toast. Ohne Anlass nichts.
 */
export function FormularMeldung({
  pruefen,
  fehler,
  onNochmal,
  laeuft,
}: {
  /** Nach einem Versuch mit markierten Feldern. */
  pruefen: boolean
  fehler: SpeicherFehlerAnzeige | null
  onNochmal?: () => void
  laeuft?: boolean
}): React.JSX.Element | null {
  if (fehler) {
    return (
      <HinweiskarteFehler titel={fehler.titel} nochmal={fehler.nochmal ? onNochmal : undefined} laeuft={laeuft}>
        {fehler.satz}
      </HinweiskarteFehler>
    )
  }
  if (pruefen) return <HinweiskarteFehler titel={FORMULAR_PRUEFEN} />
  return null
}

/** Der Satz unter dem Feld: orange, 14 px halbfett, mit role="alert" (V17, wie FeldMitFehler). */
export function FeldFehler({ id, children }: { id?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <p id={id} role="alert" className="text-[14px] leading-snug font-semibold text-status-offen">
      {children}
    </p>
  )
}

/**
 * Eine Wahl als Pille (Kategorie, Art, Holzart, Größen-Vorlage …): 44 px,
 * gewählt grün umrandet wie die Karten-Knöpfe im neuen Design, mit Haken
 * statt Farbe allein.
 */
export function Wahl({
  aktiv,
  onClick,
  children,
  rolle = 'pressed',
  disabled,
}: {
  aktiv: boolean
  onClick: () => void
  children: React.ReactNode
  /** 'radio' in einer radiogroup (genau eine Wahl), sonst Umschalter. */
  rolle?: 'pressed' | 'radio'
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...(rolle === 'radio' ? { role: 'radio', 'aria-checked': aktiv } : { 'aria-pressed': aktiv })}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[13.5px] font-medium transition-colors duration-[250ms] disabled:cursor-not-allowed disabled:opacity-50',
        aktiv ? 'border-[1.5px] border-accent bg-accent/15 text-foreground' : 'border-border bg-background text-foreground hover:bg-muted',
        FOKUS_RAHMEN
      )}
    >
      {aktiv && <Check className="size-3.5 shrink-0 text-status-fertig" strokeWidth={2} aria-hidden="true" />}
      {children}
    </button>
  )
}

/**
 * Der Abschnitt „Abholung" (Register N23, Nr. 123; Board
 * system-h5-region-eigene-teile §3): drei Ankreuzfelder als Chips in einem
 * fieldset mit legend, je 44 px, gewählt wie `Wahl` mit Haken. Darunter der
 * Satz, dass die Kundschaft die Abholzeit wie immer selbst wählt. Im
 * Futter-Formular (neue Familie, alle Größen) und im Produktdialog
 * (Bearbeiten) derselbe Baustein — Wörter und Symbole aus
 * src/lib/abholhinweise.ts.
 */
export function AbholhinweisWahl({
  wert,
  onWert,
}: {
  wert: readonly AbholhinweisValue[]
  onWert: (neu: AbholhinweisValue[]) => void
}): React.JSX.Element {
  return (
    <fieldset className="flex min-w-0 flex-col gap-2" data-feld="abholhinweise">
      <legend className="text-[15px] font-semibold text-foreground">{ABHOLUNG_ABSCHNITT.titel}</legend>
      <div className="flex flex-wrap gap-2">
        {ABHOLHINWEIS_VALUES.map((hinweis) => {
          const aktiv = wert.includes(hinweis)
          const Symbol = ABHOLHINWEIS_SYMBOL[hinweis]
          return (
            <label
              key={hinweis}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[13.5px] font-medium text-foreground transition-colors duration-[250ms]',
                aktiv ? 'border-[1.5px] border-accent bg-accent/15' : 'border-border bg-background hover:bg-muted',
                // Der Fokus liegt auf dem verborgenen Ankreuzfeld — sichtbar wird er an der Pille.
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-solid'
              )}
            >
              <input type="checkbox" className="sr-only" checked={aktiv} onChange={() => onWert(schalteAbholhinweis(wert, hinweis))} />
              {aktiv ? (
                <Check className="size-3.5 shrink-0 text-status-fertig" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Symbol className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
              )}
              {ABHOLHINWEIS_TEXT[hinweis]}
            </label>
          )
        })}
      </div>
      <p className="text-[12.5px] leading-snug text-muted-foreground">{ABHOLUNG_ABSCHNITT.satz}</p>
    </fieldset>
  )
}

/**
 * Der Abschnitt „Rücktritt" (Nr. 218, Nacharbeit zu 214): Haken „Verdirbt
 * schnell" und geschätzte Rücksendekosten für die ganze Familie — dieselben
 * Bausteine und Texte wie im Produktdialog (ruecktritt-felder.tsx,
 * src/lib/ruecktritt-angaben.ts), hier im Rahmen `Feld`, weil die Formulare mit
 * Verkaufsgrößen ohne react-hook-form arbeiten. Der Wert sind ganze Cent; der
 * Fehlersatz kommt aus dem Schema (ruecksendekostenSchema).
 */
export function RuecktrittAbschnitt({
  id,
  wert,
  onWert,
  fehler,
}: {
  id: string
  wert: RuecktrittAngabe
  onWert: (teil: Partial<RuecktrittAngabe>) => void
  fehler?: string
}): React.JSX.Element {
  return (
    <Abschnitt id={id} titel={RUECKTRITT_TEXT.abschnitt}>
      <div data-feld="keinRuecktritt">
        <KeinRuecktrittHaken
          name="keinRuecktritt"
          checked={wert.keinRuecktritt}
          onChange={(haken) => onWert({ keinRuecktritt: haken })}
          className="border border-border p-3"
        />
      </div>
      <Feld
        feld="ruecksendekostenCents"
        label={`${RUECKTRITT_TEXT.ruecksendekosten} ${FREIWILLIG}`}
        labelKlasse="leading-snug"
        hilfe={RUECKTRITT_TEXT.ruecksendekostenErklaerung}
        fehler={fehler}
      >
        <EuroCentFeld
          id={feldId('ruecksendekostenCents')}
          name="ruecksendekostenCents"
          value={wert.ruecksendekostenCents}
          onChange={(cents) => onWert({ ruecksendekostenCents: cents })}
        />
      </Feld>
    </Abschnitt>
  )
}

/** „+ Eigene Größe" — gestrichelt wie im Mockup. */
export function EigeneGroesseKnopf({ onClick, disabled }: { onClick: () => void; disabled?: boolean }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-dashed border-border px-4 text-[13.5px] font-medium text-brand-text hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
        FOKUS_RAHMEN
      )}
    >
      <Plus className="size-4" strokeWidth={1.7} aria-hidden="true" />
      Eigene Größe
    </button>
  )
}

/** Größe entfernen — ein Knopf nur mit Symbol, also mit Namen für Screenreader. */
export function EntfernenKnopf({ name, onClick }: { name: string; onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name || 'Größe'} entfernen`}
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground', FOKUS_RAHMEN)}
    >
      <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
    </button>
  )
}

/** Das Schloss an einer gesperrten Größe, mit Begründung (DESIGN_SYSTEM „Futtermittel und Brennmaterial"). */
export function SperrZeile({ grund }: { grund: string }): React.JSX.Element {
  return (
    <p className="flex items-start gap-1.5 text-xs font-medium text-status-offen">
      <Lock className="mt-px size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      <span>{grund}</span>
    </p>
  )
}

/** Eingabe-Klassen wie im Bestand (Input), 44 px hoch, 16 px am Handy (kein Zoom unter iOS). */
export const EINGABE = cn(
  'h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground md:text-sm',
  FOKUS_RAHMEN
)

/** Zum ersten fehlerhaften Feld scrollen und es fokussieren (Muster aus dem Produktdialog). */
export function springeZuFeld(feld: string | undefined): void {
  if (!feld) return
  window.setTimeout(() => {
    const ziel = document.querySelector<HTMLElement>(`[data-feld="${CSS.escape(feld)}"]`)
    if (!ziel) return
    ziel.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const eingabe = ziel.querySelector<HTMLElement>('input, textarea, select, button')
    // Erst nach dem Scrollen fokussieren, sonst springt der Browser noch einmal.
    window.setTimeout(() => eingabe?.focus({ preventScroll: true }), 120)
  }, 50)
}
