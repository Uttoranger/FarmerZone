'use client'

import { cloneElement, isValidElement } from 'react'
import { Check, Lock, Plus, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { ABHOLHINWEIS_SYMBOL, ABHOLHINWEIS_TEXT, ABHOLHINWEIS_VALUES, ABHOLUNG_ABSCHNITT, schalteAbholhinweis, type AbholhinweisValue } from '@/lib/abholhinweise'
import { feldFehlerAttribute, fehlerKennung, hilfeKennung } from '@/components/shared/formular-meldungen'
import { cn } from '@/lib/utils'

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
  satz,
  hinweis,
  speichernText,
  speichert,
  onSpeichern,
  children,
}: {
  open: boolean
  onClose: () => void
  titel: string
  satz: string
  /** Satz über den Knöpfen, z. B. was sofort online geht (speichernHinweis). */
  hinweis?: string | null
  speichernText: string
  speichert: boolean
  onSpeichern: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !speichert && onClose()}>
      <DialogContent
        data-app-palette="neu"
        className="flex h-[100dvh] max-h-[100dvh] max-w-full flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[92dvh] sm:max-w-[760px] sm:rounded-2xl"
      >
        <div className="shrink-0 px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
          <DialogTitle className="pr-10 font-heading text-xl font-semibold text-foreground md:text-2xl">{titel}</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-muted-foreground">{satz}</DialogDescription>
        </div>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            onSpeichern()
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-8 sm:px-6">
            <div className="flex flex-col gap-6">{children}</div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-card px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
            {hinweis && (
              <p className="text-[12.5px] leading-snug text-muted-foreground" aria-live="polite">
                {hinweis}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={onClose} disabled={speichert} className="min-h-11">
                Abbrechen
              </Button>
              <Button type="submit" disabled={speichert} className="min-h-11 w-full rounded-xl sm:w-auto sm:min-w-[160px] sm:rounded-full">
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
      <label htmlFor={id} className={cn('text-[13px] font-medium text-foreground', labelKlasse)}>
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

export function FeldFehler({ id, children }: { id?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <p id={id} role="alert" className="text-xs font-medium text-status-offen">
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
