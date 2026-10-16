'use client'

import { useId } from 'react'
import Image from 'next/image'
import { Check, ImagePlus, LayoutGrid, Megaphone, Plus, Sprout, Tag, Trash2, type LucideIcon } from 'lucide-react'
import type { StartseiteVorlage } from '@prisma/client'
import {
  ABSCHNITT_TEXT,
  ADMIN_STARTSEITE_TEXT as T,
  BLOCK_ZUSTAND_TEXT,
  HOEFE_AUSWAHL_MAX,
  LINK_TEXT_MAX,
  TEXT_MAX,
  TITEL_MAX,
  UEBERZEILE_MAX,
  VORLAGEN,
  VORLAGE_TEXT,
  blockZustand,
  type BlockZustand,
} from '@/lib/startseite-gestalten'
import { PRODUCT_CATEGORY_VALUES, KATEGORIE_LABEL, illustrationPfad } from '@/lib/taxonomie'
import type { MarkeArt } from '@/lib/marke-art'
import { cn } from '@/lib/utils'
import type { AdminStartseite } from '@/server/queries/startseite'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Marke } from '@/components/ui/marke'
import { Segment } from '@/components/ui/segment'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { useImageUpload } from '@/components/shared/image-upload'
import { StartseitenBlock } from '@/components/startseite/bloecke/startseiten-block'
import { KARTE, KNOPF_GRUEN, KNOPF_RAHMEN, LEISE, FELD as FELD_BASIS, FELD_LABEL } from '@/components/hof-bestellungen/stil'
import { alsDaten, type BlockWerte, type Zeile } from './startseite-entwurf'

/*
 * Das Block-Formular und die Vorlagen-Bibliothek von Admin › Startseite
 * (Register N16, Nr. 96; seit Nr. 99 ohne „Speichern“: jede Eingabe landet
 * nach kurzer Ruhe im Entwurf, src/components/admin/startseite-entwurf.tsx).
 */

export const UEBERSCHRIFT = 'font-heading text-lg font-semibold text-foreground'
/** Eingaben mindestens 44 px hoch (Tippfläche). */
const FELD = cn(FELD_BASIS, 'min-h-11')

export const VORLAGE_SYMBOL: Record<StartseiteVorlage, LucideIcon> = {
  SAISONKARTE: Sprout,
  HINWEISBAND: Megaphone,
  HOEFE_AUSWAHL: LayoutGrid,
  KATEGORIE_HINWEIS: Tag,
}

/** Mockup: „Live" orange, „Geplant" grün — als Bedeutung der Marke (Register G5). */
export const ZUSTAND_MARKE: Record<BlockZustand, MarkeArt> = { live: 'tun', geplant: 'laeuft', beendet: 'erledigt' }

export function titelVon(zeile: Zeile): string {
  return zeile.art === 'BLOCK' ? (zeile.block?.titel ?? VORLAGE_TEXT.SAISONKARTE.titel) : ABSCHNITT_TEXT[zeile.art].titel
}

function Feld({
  label,
  id,
  laenge,
  max,
  hinweis,
  children,
}: {
  label: string
  id: string
  laenge?: number
  max?: number
  hinweis?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className={FELD_LABEL}>
          {label}
        </label>
        {laenge !== undefined && max !== undefined && (
          <span className={cn('text-[12px] tabular-nums', LEISE)} aria-hidden="true">
            {laenge}/{max}
          </span>
        )}
      </div>
      {children}
      {laenge !== undefined && max !== undefined && <ZeichenZaehler laenge={laenge} max={max} />}
      {hinweis && <p className={cn('mt-1 text-[12px]', LEISE)}>{hinweis}</p>}
    </div>
  )
}

function BildFeld({ wert, onWert }: { wert: string; onWert: (url: string) => void }): React.JSX.Element {
  const hochladen = useImageUpload({ variant: 'startseite', onUploaded: (url) => onWert(url) })
  return (
    <div className="flex min-w-0 flex-col">
      <span className={FELD_LABEL}>Bild</span>
      <div className="flex items-center gap-2.5">
        {wert && (
          <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
            <Image src={wert} alt="" fill sizes="44px" className="object-cover" />
          </span>
        )}
        <button type="button" onClick={hochladen.openFilePicker} disabled={hochladen.isUploading} className={cn(KNOPF_RAHMEN, 'px-3.5')}>
          <ImagePlus className="size-4" strokeWidth={1.8} aria-hidden="true" />
          {hochladen.isUploading ? 'Lädt …' : wert ? 'Anderes Bild' : 'Bild wählen'}
        </button>
        {wert && !hochladen.isUploading && (
          <button type="button" onClick={() => onWert('')} className={cn(KNOPF_RAHMEN, 'px-3.5')}>
            Entfernen
          </button>
        )}
      </div>
      {hochladen.fileInput}
      <p className={cn('mt-1 text-[12px]', LEISE)}>{T.bildHinweis}</p>
    </div>
  )
}

export function BlockFormular({
  werte,
  zeilen,
  daten,
  jetzt,
  fehler,
  loescht,
  onWerte,
  onFertig,
  onLoeschen,
}: {
  werte: BlockWerte
  zeilen: readonly Zeile[]
  daten: AdminStartseite
  jetzt: Date
  fehler: string | null
  loescht: boolean
  onWerte: (w: BlockWerte) => void
  onFertig: () => void
  onLoeschen: () => void
}): React.JSX.Element {
  const id = useId()
  const setze = (teil: Partial<BlockWerte>) => onWerte({ ...werte, ...teil })
  const index = zeilen.findIndex((z) => z.id === werte.zeilenId)
  const davor = index > 0 ? titelVon(zeilen[index - 1]) : null
  const hofSlugs = werte.farmIds.flatMap((farmId) => daten.hoefe.find((h) => h.id === farmId)?.hof.slug ?? [])
  const block = alsDaten(werte, hofSlugs)
  const zeitraum = { liveAb: new Date(block.liveAb), liveBis: block.liveBis ? new Date(block.liveBis) : null }
  const zustand = blockZustand(zeitraum, jetzt)
  const hinweisband = werte.vorlage === 'HINWEISBAND'
  const gewaehlteHoefe = werte.farmIds.flatMap((farmId) => daten.hoefe.find((h) => h.id === farmId)?.hof ?? [])

  return (
    <section aria-labelledby={`${id}-titel`} className={cn(KARTE, 'flex flex-col gap-3.5 px-[18px] py-4')}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 id={`${id}-titel`} className={UEBERSCHRIFT}>
          {werte.id ? T.blockBearbeiten : T.blockNeu}
        </h2>
        <Marke art={ZUSTAND_MARKE[zustand]}>{BLOCK_ZUSTAND_TEXT[zustand]}</Marke>
        <span className="flex-1" />
        <span className={cn('text-[12.5px]', LEISE)}>
          {VORLAGE_TEXT[werte.vorlage].titel}
          {davor ? ` · nach „${davor}“` : ''}
        </span>
      </div>

      <Segment
        beschriftung="Vorlage"
        optionen={VORLAGEN.map((v) => ({ wert: v, label: VORLAGE_TEXT[v].titel }))}
        wert={werte.vorlage}
        onWertChange={(v) => setze({ vorlage: v as StartseiteVorlage })}
        className="flex-wrap rounded-2xl"
      />

      {!hinweisband && (
        <Feld label="Überzeile (freiwillig)" id={`${id}-ueberzeile`} laenge={werte.ueberzeile.length} max={UEBERZEILE_MAX}>
          <input id={`${id}-ueberzeile`} className={FELD} value={werte.ueberzeile} onChange={(e) => setze({ ueberzeile: e.target.value })} />
        </Feld>
      )}
      <Feld label={hinweisband ? 'Satz' : 'Titel'} id={`${id}-titel-feld`} laenge={werte.titel.length} max={TITEL_MAX}>
        <input id={`${id}-titel-feld`} className={FELD} value={werte.titel} onChange={(e) => setze({ titel: e.target.value })} />
      </Feld>
      {!hinweisband && (
        <Feld label="Text (freiwillig)" id={`${id}-text`} laenge={werte.text.length} max={TEXT_MAX}>
          <textarea id={`${id}-text`} rows={2} className={cn(FELD, 'resize-y')} value={werte.text} onChange={(e) => setze({ text: e.target.value })} />
        </Feld>
      )}

      {werte.vorlage === 'SAISONKARTE' && <BildFeld wert={werte.bildUrl} onWert={(url) => setze({ bildUrl: url })} />}

      {werte.vorlage === 'HOEFE_AUSWAHL' && (
        <fieldset className="flex min-w-0 flex-col gap-1">
          <legend className={FELD_LABEL}>Höfe</legend>
          <ul className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
            {daten.hoefe.map(({ id: farmId, hof }) => {
              const gewaehlt = werte.farmIds.includes(farmId)
              const voll = !gewaehlt && werte.farmIds.length >= HOEFE_AUSWAHL_MAX
              return (
                <li key={farmId}>
                  <label className={cn('flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[14px]', voll ? 'opacity-50' : 'hover:bg-muted')}>
                    <input
                      type="checkbox"
                      className="size-4 accent-accent"
                      checked={gewaehlt}
                      disabled={voll}
                      onChange={() => setze({ farmIds: gewaehlt ? werte.farmIds.filter((f) => f !== farmId) : [...werte.farmIds, farmId] })}
                    />
                    <span className="min-w-0 truncate">{hof.name}</span>
                    <span className={cn('ml-auto shrink-0 text-[12px]', LEISE)}>{hof.ort}</span>
                  </label>
                </li>
              )
            })}
          </ul>
          <p className={cn('text-[12px]', LEISE)}>{T.hoefeHinweis}</p>
        </fieldset>
      )}

      {werte.vorlage === 'KATEGORIE_HINWEIS' && (
        <Feld label="Kategorie" id={`${id}-kategorie`}>
          <select id={`${id}-kategorie`} className={cn(FELD, 'min-h-11')} value={werte.kategorie} onChange={(e) => setze({ kategorie: e.target.value })}>
            <option value="">Bitte wählen</option>
            {PRODUCT_CATEGORY_VALUES.map((k) => (
              <option key={k} value={k}>
                {KATEGORIE_LABEL[k]}
              </option>
            ))}
          </select>
        </Feld>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label="Link-Ziel (freiwillig)" id={`${id}-link`} hinweis="Beginnt mit „/“, etwa /hoefe">
          <input id={`${id}-link`} className={FELD} value={werte.linkUrl} placeholder="/hoefe" onChange={(e) => setze({ linkUrl: e.target.value })} />
        </Feld>
        <Feld label="Linktext (freiwillig)" id={`${id}-linktext`} laenge={werte.linkText.length} max={LINK_TEXT_MAX}>
          <input id={`${id}-linktext`} className={FELD} value={werte.linkText} onChange={(e) => setze({ linkText: e.target.value })} />
        </Feld>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className="flex min-w-0 flex-col">
          <legend className={FELD_LABEL}>Live ab</legend>
          <div className="flex gap-2">
            <input type="date" aria-label="Live ab, Tag" className={FELD} value={werte.liveAbTag} onChange={(e) => setze({ liveAbTag: e.target.value })} />
            <input type="time" aria-label="Live ab, Uhrzeit" className={cn(FELD, 'w-[9rem] shrink-0')} value={werte.liveAbUhrzeit} onChange={(e) => setze({ liveAbUhrzeit: e.target.value })} />
          </div>
        </fieldset>
        <fieldset className="flex min-w-0 flex-col">
          <legend className={FELD_LABEL}>Live bis (freiwillig)</legend>
          <div className="flex gap-2">
            <input type="date" aria-label="Live bis, Tag" className={FELD} value={werte.liveBisTag} onChange={(e) => setze({ liveBisTag: e.target.value })} />
            <input type="time" aria-label="Live bis, Uhrzeit" className={cn(FELD, 'w-[9rem] shrink-0')} value={werte.liveBisUhrzeit} placeholder="23:59" onChange={(e) => setze({ liveBisUhrzeit: e.target.value })} />
          </div>
        </fieldset>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{T.vorschauKachel}</span>
        <div className="pointer-events-none max-h-[360px] overflow-hidden rounded-2xl border border-border bg-background" inert>
          <StartseitenBlock block={block} hoefe={gewaehlteHoefe} kategorieBild={block.kategorie ? illustrationPfad(block.kategorie) : null} />
        </div>
      </div>

      <p className={cn('text-[12px] leading-normal', LEISE)}>{T.regel}</p>
      {fehler && (
        <p role="alert" className="text-[13px] font-medium text-destructive">
          {fehler}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={KNOPF_RAHMEN} disabled={loescht} onClick={onLoeschen}>
          {werte.id && <Trash2 className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          {werte.id ? 'Löschen' : 'Verwerfen'}
        </button>
        <button type="button" className={KNOPF_GRUEN} onClick={onFertig}>
          <Check className="size-4" strokeWidth={1.8} aria-hidden="true" />
          {T.fertig}
        </button>
      </div>
    </section>
  )
}

export function Bibliothek({ onVorlage }: { onVorlage: (v: StartseiteVorlage) => void }): React.JSX.Element {
  return (
    <section aria-labelledby="vorlagen-titel" className={cn(KARTE, 'flex flex-col gap-2 px-4 py-3.5')}>
      <h2 id="vorlagen-titel" className={UEBERSCHRIFT}>
        {T.bibliothek}
      </h2>
      <ul className="flex flex-col gap-2">
        {VORLAGEN.map((v) => {
          const Symbol = VORLAGE_SYMBOL[v]
          return (
            <li key={v}>
              <button
                type="button"
                onClick={() => onVorlage(v)}
                className={cn('flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-left transition-colors hover:bg-muted', FOKUS_RAHMEN)}
              >
                <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-accent/14 text-status-fertig">
                  <Symbol className="size-4" strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-foreground">{VORLAGE_TEXT[v].titel}</span>
                  <span className={cn('block text-[12px]', LEISE)}>{VORLAGE_TEXT[v].satz}</span>
                </span>
                <Plus className="ml-auto size-4 shrink-0 text-status-fertig" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
      <p className={cn('mt-0.5 text-[12px]', LEISE)}>{T.bibliothekRegel}</p>
    </section>
  )
}
