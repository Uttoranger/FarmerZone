'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImagePlus,
  Info,
  LayoutGrid,
  Megaphone,
  Plus,
  Save,
  Sprout,
  Tag,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import type { StartseiteVorlage } from '@prisma/client'
import {
  ABSCHNITT_TEXT,
  ADMIN_STARTSEITE_TEXT as T,
  BLOCK_ZUSTAND_TEXT,
  HOEFE_AUSWAHL_MAX,
  LINK_TEXT_MAX,
  NEUER_BLOCK,
  TEXT_MAX,
  TITEL_MAX,
  UEBERZEILE_MAX,
  VORLAGEN,
  VORLAGE_TEXT,
  blockZustand,
  darfVerschieben,
  istFest,
  verschiebe,
  wienerEingabe,
  zeitpunktAusEingabe,
  zeitraumText,
  type BlockZustand,
  type StartseitenBlockDaten,
} from '@/lib/startseite-gestalten'
import { PRODUCT_CATEGORY_VALUES, KATEGORIE_LABEL, illustrationPfad } from '@/lib/taxonomie'
import type { MarkeArt } from '@/lib/marke-art'
import { cn } from '@/lib/utils'
import type { AdminStartseite, AdminStartseitenZeile } from '@/server/queries/startseite'
import { loescheStartseitenBlock, speichereStartseite } from '@/server/actions/startseite'
import { startseitenBlockSchema, type StartseitenBlockEingabe } from '@/schemas/startseite'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Marke } from '@/components/ui/marke'
import { StatusBadge } from '@/components/ui/status-badge'
import { Segment } from '@/components/ui/segment'
import { ZeichenZaehler } from '@/components/shared/zeichen-zaehler'
import { useImageUpload } from '@/components/shared/image-upload'
import { StartseitenBlock } from '@/components/startseite/bloecke/startseiten-block'
import { KARTE, KNOPF_GRUEN, KNOPF_RAHMEN, LEISE, FELD as FELD_BASIS, FELD_LABEL } from '@/components/hof-bestellungen/stil'
import { Seitenkopf } from './seitenkopf'
import { StartseiteVorschau } from './startseite-vorschau'

/*
 * Admin › Startseite (Register N16, Nr. 96; Mockups admin-startseite-gestalten
 * und admin-startseite-vorschau). Links die Abschnittsliste (Pfeile =
 * Reihenfolge, Auge = aus/ein, „Block einfügen"), rechts der Block in
 * Bearbeitung mit Vorschau-Kachel und die Vorlagen-Bibliothek. Der Umschalter
 * oben zeigt statt der Bearbeitung die echte Startseite (StartseiteVorschau).
 *
 * Alles bleibt hier im Browser, bis „Speichern" Reihenfolge, Auge und den
 * Block in EINER Aktion schickt (speichereStartseite). Welche Bewegung erlaubt
 * ist, entscheidet dieselbe Regel wie am Server (darfVerschieben).
 */

type Zeile = AdminStartseitenZeile

/** Der Block im Formular — Felder als Text, wie sie in den Eingaben stehen. */
type Entwurf = {
  zeilenId: string
  id?: string
  vorlage: StartseiteVorlage
  ueberzeile: string
  titel: string
  text: string
  bildUrl: string
  linkUrl: string
  linkText: string
  farmIds: string[]
  kategorie: string
  liveAbTag: string
  liveAbUhrzeit: string
  liveBisTag: string
  liveBisUhrzeit: string
}

type Meldung = { art: 'ok' | 'fehler'; text: string } | null

const UEBERSCHRIFT = 'font-heading text-lg font-semibold text-foreground'
/** Eingaben mindestens 44 px hoch (Tippfläche). */
const FELD = cn(FELD_BASIS, 'min-h-11')
const SYMBOL_KNOPF = cn(
  'inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[250ms] hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent',
  FOKUS_RAHMEN
)

const VORLAGE_SYMBOL: Record<StartseiteVorlage, LucideIcon> = {
  SAISONKARTE: Sprout,
  HINWEISBAND: Megaphone,
  HOEFE_AUSWAHL: LayoutGrid,
  KATEGORIE_HINWEIS: Tag,
}

/** Mockup: „Live" orange, „Geplant" grün — als Bedeutung der Marke (Register G5). */
const ZUSTAND_MARKE: Record<BlockZustand, MarkeArt> = { live: 'tun', geplant: 'laeuft', beendet: 'erledigt' }

function neuerEntwurf(vorlage: StartseiteVorlage, jetzt: Date): Entwurf {
  const { tag, uhrzeit } = wienerEingabe(jetzt)
  return {
    zeilenId: NEUER_BLOCK,
    vorlage,
    ueberzeile: '',
    titel: '',
    text: '',
    bildUrl: '',
    linkUrl: '',
    linkText: '',
    farmIds: [],
    kategorie: '',
    liveAbTag: tag,
    liveAbUhrzeit: uhrzeit,
    liveBisTag: '',
    liveBisUhrzeit: '',
  }
}

function entwurfAus(zeile: Zeile): Entwurf | null {
  const b = zeile.block
  if (!b) return null
  const ab = wienerEingabe(new Date(b.liveAb))
  const bis = b.liveBis ? wienerEingabe(new Date(b.liveBis)) : null
  return {
    zeilenId: zeile.id,
    id: b.id,
    vorlage: b.vorlage,
    ueberzeile: b.ueberzeile ?? '',
    titel: b.titel,
    text: b.text ?? '',
    bildUrl: b.bildUrl ?? '',
    linkUrl: b.linkUrl ?? '',
    linkText: b.linkText ?? '',
    farmIds: b.farmIds,
    kategorie: b.kategorie ?? '',
    liveAbTag: ab.tag,
    liveAbUhrzeit: ab.uhrzeit,
    liveBisTag: bis?.tag ?? '',
    liveBisUhrzeit: bis?.uhrzeit ?? '',
  }
}

/** Der Entwurf als Eingabe des Schemas — leere Felder als null (CODING_STANDARDS §8). */
function alsEingabe(e: Entwurf): StartseitenBlockEingabe {
  return {
    ...(e.id ? { id: e.id } : {}),
    vorlage: e.vorlage,
    ueberzeile: e.ueberzeile,
    titel: e.titel,
    text: e.text,
    bildUrl: e.bildUrl === '' ? null : e.bildUrl,
    linkUrl: e.linkUrl,
    linkText: e.linkText,
    farmIds: e.farmIds,
    kategorie: e.kategorie === '' ? null : (e.kategorie as StartseitenBlockEingabe['kategorie']),
    liveAbTag: e.liveAbTag,
    liveAbUhrzeit: e.liveAbUhrzeit,
    liveBisTag: e.liveBisTag === '' ? null : e.liveBisTag,
    liveBisUhrzeit: e.liveBisTag === '' || e.liveBisUhrzeit === '' ? null : e.liveBisUhrzeit,
  }
}

/** Der Entwurf so, wie die Seite einen Block bekommt — für die Vorschau-Kachel und die Liste. */
function alsDaten(e: Entwurf, hofSlugs: readonly string[]): StartseitenBlockDaten & { farmIds: string[] } {
  const ab = zeitpunktAusEingabe(e.liveAbTag, e.liveAbUhrzeit)
  const bis = e.liveBisTag ? zeitpunktAusEingabe(e.liveBisTag, e.liveBisUhrzeit || '23:59') : null
  return {
    id: e.id ?? NEUER_BLOCK,
    vorlage: e.vorlage,
    ueberzeile: e.ueberzeile.trim() || null,
    titel: e.titel.trim() || VORLAGE_TEXT[e.vorlage].titel,
    text: e.text.trim() || null,
    bildUrl: e.bildUrl || null,
    linkUrl: e.linkUrl.trim() || null,
    linkText: e.linkText.trim() || null,
    hofSlugs: [...hofSlugs],
    farmIds: e.farmIds,
    kategorie: (e.kategorie || null) as StartseitenBlockDaten['kategorie'],
    liveAb: (ab ?? new Date(0)).toISOString(),
    liveBis: bis?.toISOString() ?? null,
  }
}

function blockSatz(block: StartseitenBlockDaten, jetzt: Date): { zustand: BlockZustand; satz: string } {
  const zeitraum = { liveAb: new Date(block.liveAb), liveBis: block.liveBis ? new Date(block.liveBis) : null }
  const zustand = blockZustand(zeitraum, jetzt)
  return { zustand, satz: `${BLOCK_ZUSTAND_TEXT[zustand]} · ${zeitraumText(zeitraum)} · ${VORLAGE_TEXT[block.vorlage].titel}` }
}

function titelVon(zeile: Zeile): string {
  return zeile.art === 'BLOCK' ? (zeile.block?.titel ?? VORLAGE_TEXT.SAISONKARTE.titel) : ABSCHNITT_TEXT[zeile.art].titel
}

// ─── Die Liste ──────────────────────────────────────────────────────────────

function EinfuegePunkt({ onEinfuegen, gesperrt }: { onEinfuegen: () => void; gesperrt: boolean }): React.JSX.Element {
  return (
    <li className="border-t border-dashed border-border">
      <button
        type="button"
        onClick={onEinfuegen}
        disabled={gesperrt}
        className={cn(
          'flex min-h-11 w-full items-center gap-2 px-3.5 text-[13px] font-semibold text-status-fertig transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
          FOKUS_RAHMEN
        )}
      >
        <Plus className="size-4" strokeWidth={1.8} aria-hidden="true" />
        {T.einfuegen}
      </button>
    </li>
  )
}

function ListenZeile({
  zeile,
  index,
  zeilen,
  jetzt,
  aktiv,
  kompakt,
  onVerschieben,
  onAuge,
  onWaehlen,
}: {
  zeile: Zeile
  index: number
  zeilen: readonly Zeile[]
  jetzt: Date
  aktiv: boolean
  kompakt: boolean
  onVerschieben: (richtung: -1 | 1) => void
  onAuge: () => void
  onWaehlen: () => void
}): React.JSX.Element {
  const fest = istFest(zeile.art)
  const titel = titelVon(zeile)
  const block = zeile.art === 'BLOCK' ? zeile.block : null
  const info = block ? blockSatz(block, jetzt) : null
  const satz = info?.satz ?? (zeile.art === 'BLOCK' ? '' : ABSCHNITT_TEXT[zeile.art].satz)
  const Symbol = block ? VORLAGE_SYMBOL[block.vorlage] : null

  return (
    <li className={cn('flex items-center gap-1 border-t border-border px-1.5 py-1', aktiv && 'bg-muted')}>
      {fest ? (
        <span className="w-[88px] shrink-0" aria-hidden="true" />
      ) : (
        <span className="flex shrink-0">
          <button type="button" className={SYMBOL_KNOPF} aria-label={`„${titel}“ nach oben`} disabled={!darfVerschieben(zeilen, index, -1)} onClick={() => onVerschieben(-1)}>
            <ChevronUp className="size-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <button type="button" className={SYMBOL_KNOPF} aria-label={`„${titel}“ nach unten`} disabled={!darfVerschieben(zeilen, index, 1)} onClick={() => onVerschieben(1)}>
            <ChevronDown className="size-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </span>
      )}
      {Symbol && <Symbol className="mr-1 size-4 shrink-0 text-status-fertig" strokeWidth={1.8} aria-hidden="true" />}
      {block ? (
        <button
          type="button"
          onClick={onWaehlen}
          aria-current={aktiv ? 'true' : undefined}
          className={cn('group flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg py-1.5 text-left', !zeile.sichtbar && 'opacity-55', FOKUS_RAHMEN)}
        >
          <span className="block w-full truncate text-[14px] font-semibold text-foreground group-hover:underline">{titel}</span>
          {!kompakt && satz && <span className={cn('block w-full truncate text-[12px]', LEISE)}>{satz}</span>}
        </button>
      ) : (
        <span className={cn('min-w-0 flex-1 py-1.5', !zeile.sichtbar && 'opacity-55')}>
          <span className="block truncate text-[14px] font-semibold text-foreground">{titel}</span>
          {!kompakt && satz && <span className={cn('block truncate text-[12px]', LEISE)}>{satz}</span>}
        </span>
      )}
      <span className="flex shrink-0 items-center gap-1.5">
        {fest && <StatusBadge status="neutral">{T.fest}</StatusBadge>}
        {zeile.art === 'BRENNMATERIAL' && <StatusBadge status="neutral">{T.automatik}</StatusBadge>}
        {info && <Marke art={ZUSTAND_MARKE[info.zustand]}>{BLOCK_ZUSTAND_TEXT[info.zustand]}</Marke>}
        {!fest && (
          <button type="button" className={SYMBOL_KNOPF} aria-label={zeile.sichtbar ? `„${titel}“ ausblenden` : `„${titel}“ einblenden`} onClick={onAuge}>
            {zeile.sichtbar ? <Eye className="size-4" strokeWidth={1.8} aria-hidden="true" /> : <EyeOff className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          </button>
        )}
      </span>
    </li>
  )
}

function AbschnittsListe({
  zeilen,
  jetzt,
  aktivId,
  kompakt,
  onZeilen,
  onWaehlen,
  onEinfuegen,
}: {
  zeilen: readonly Zeile[]
  jetzt: Date
  aktivId: string | null
  kompakt: boolean
  onZeilen: (zeilen: Zeile[]) => void
  onWaehlen: (zeile: Zeile) => void
  onEinfuegen: (nachIndex: number) => void
}): React.JSX.Element {
  const hatNeuen = zeilen.some((z) => z.id === NEUER_BLOCK)
  const hoefeIndex = zeilen.findIndex((z) => z.art === 'HOEFE')
  const fussIndex = zeilen.findIndex((z) => z.art === 'FUSS')
  return (
    <section aria-labelledby="abschnitte-titel" className={cn(KARTE, 'overflow-hidden')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-3">
        <h2 id="abschnitte-titel" className={UEBERSCHRIFT}>
          {T.liste}
        </h2>
        <span className="flex-1" />
        <span className={cn('text-[12px]', LEISE)}>{T.listeHinweis}</span>
      </div>
      <ul>
        {zeilen.map((zeile, index) => (
          <ListenZeileMitPunkt
            key={zeile.id}
            zeile={zeile}
            index={index}
            zeilen={zeilen}
            jetzt={jetzt}
            aktiv={zeile.id === aktivId}
            kompakt={kompakt}
            punktDanach={index === hoefeIndex || index === fussIndex - 1}
            gesperrt={hatNeuen}
            onZeilen={onZeilen}
            onWaehlen={onWaehlen}
            onEinfuegen={onEinfuegen}
          />
        ))}
      </ul>
    </section>
  )
}

function ListenZeileMitPunkt({
  zeile,
  index,
  zeilen,
  punktDanach,
  gesperrt,
  onZeilen,
  onWaehlen,
  onEinfuegen,
  ...rest
}: {
  zeile: Zeile
  index: number
  zeilen: readonly Zeile[]
  jetzt: Date
  aktiv: boolean
  kompakt: boolean
  punktDanach: boolean
  gesperrt: boolean
  onZeilen: (zeilen: Zeile[]) => void
  onWaehlen: (zeile: Zeile) => void
  onEinfuegen: (nachIndex: number) => void
}): React.JSX.Element {
  return (
    <>
      <ListenZeile
        zeile={zeile}
        index={index}
        zeilen={zeilen}
        {...rest}
        onVerschieben={(richtung) => onZeilen(verschiebe(zeilen, index, richtung))}
        onAuge={() => onZeilen(zeilen.map((z, i) => (i === index ? { ...z, sichtbar: !z.sichtbar } : z)))}
        onWaehlen={() => onWaehlen(zeile)}
      />
      {punktDanach && <EinfuegePunkt gesperrt={gesperrt} onEinfuegen={() => onEinfuegen(index)} />}
    </>
  )
}

// ─── Das Formular ───────────────────────────────────────────────────────────

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

function BlockFormular({
  entwurf,
  zeilen,
  daten,
  jetzt,
  meldung,
  pending,
  onEntwurf,
  onSpeichern,
  onLoeschen,
}: {
  entwurf: Entwurf
  zeilen: readonly Zeile[]
  daten: AdminStartseite
  jetzt: Date
  meldung: Meldung
  pending: boolean
  onEntwurf: (e: Entwurf) => void
  onSpeichern: () => void
  onLoeschen: () => void
}): React.JSX.Element {
  const id = useId()
  const setze = (teil: Partial<Entwurf>) => onEntwurf({ ...entwurf, ...teil })
  const index = zeilen.findIndex((z) => z.id === entwurf.zeilenId)
  const davor = index > 0 ? titelVon(zeilen[index - 1]) : null
  const hofSlugs = entwurf.farmIds.flatMap((farmId) => daten.hoefe.find((h) => h.id === farmId)?.hof.slug ?? [])
  const block = alsDaten(entwurf, hofSlugs)
  const zeitraum = { liveAb: new Date(block.liveAb), liveBis: block.liveBis ? new Date(block.liveBis) : null }
  const zustand = blockZustand(zeitraum, jetzt)
  const hinweisband = entwurf.vorlage === 'HINWEISBAND'
  const gewaehlteHoefe = entwurf.farmIds.flatMap((farmId) => daten.hoefe.find((h) => h.id === farmId)?.hof ?? [])

  return (
    <section aria-labelledby={`${id}-titel`} className={cn(KARTE, 'flex flex-col gap-3.5 px-[18px] py-4')}>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 id={`${id}-titel`} className={UEBERSCHRIFT}>
          {entwurf.id ? T.blockBearbeiten : T.blockNeu}
        </h2>
        <Marke art={ZUSTAND_MARKE[zustand]}>{BLOCK_ZUSTAND_TEXT[zustand]}</Marke>
        <span className="flex-1" />
        <span className={cn('text-[12.5px]', LEISE)}>
          {VORLAGE_TEXT[entwurf.vorlage].titel}
          {davor ? ` · nach „${davor}“` : ''}
        </span>
      </div>

      <Segment
        beschriftung="Vorlage"
        optionen={VORLAGEN.map((v) => ({ wert: v, label: VORLAGE_TEXT[v].titel }))}
        wert={entwurf.vorlage}
        onWertChange={(v) => setze({ vorlage: v as StartseiteVorlage })}
        className="flex-wrap rounded-2xl"
      />

      {!hinweisband && (
        <Feld label="Überzeile (freiwillig)" id={`${id}-ueberzeile`} laenge={entwurf.ueberzeile.length} max={UEBERZEILE_MAX}>
          <input id={`${id}-ueberzeile`} className={FELD} value={entwurf.ueberzeile} onChange={(e) => setze({ ueberzeile: e.target.value })} />
        </Feld>
      )}
      <Feld label={hinweisband ? 'Satz' : 'Titel'} id={`${id}-titel-feld`} laenge={entwurf.titel.length} max={TITEL_MAX}>
        <input id={`${id}-titel-feld`} className={FELD} value={entwurf.titel} onChange={(e) => setze({ titel: e.target.value })} />
      </Feld>
      {!hinweisband && (
        <Feld label="Text (freiwillig)" id={`${id}-text`} laenge={entwurf.text.length} max={TEXT_MAX}>
          <textarea id={`${id}-text`} rows={2} className={cn(FELD, 'resize-y')} value={entwurf.text} onChange={(e) => setze({ text: e.target.value })} />
        </Feld>
      )}

      {entwurf.vorlage === 'SAISONKARTE' && <BildFeld wert={entwurf.bildUrl} onWert={(url) => setze({ bildUrl: url })} />}

      {entwurf.vorlage === 'HOEFE_AUSWAHL' && (
        <fieldset className="flex min-w-0 flex-col gap-1">
          <legend className={FELD_LABEL}>Höfe</legend>
          <ul className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
            {daten.hoefe.map(({ id: farmId, hof }) => {
              const gewaehlt = entwurf.farmIds.includes(farmId)
              const voll = !gewaehlt && entwurf.farmIds.length >= HOEFE_AUSWAHL_MAX
              return (
                <li key={farmId}>
                  <label className={cn('flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[14px]', voll ? 'opacity-50' : 'hover:bg-muted')}>
                    <input
                      type="checkbox"
                      className="size-4 accent-accent"
                      checked={gewaehlt}
                      disabled={voll}
                      onChange={() => setze({ farmIds: gewaehlt ? entwurf.farmIds.filter((f) => f !== farmId) : [...entwurf.farmIds, farmId] })}
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

      {entwurf.vorlage === 'KATEGORIE_HINWEIS' && (
        <Feld label="Kategorie" id={`${id}-kategorie`}>
          <select id={`${id}-kategorie`} className={cn(FELD, 'min-h-11')} value={entwurf.kategorie} onChange={(e) => setze({ kategorie: e.target.value })}>
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
          <input id={`${id}-link`} className={FELD} value={entwurf.linkUrl} placeholder="/hoefe" onChange={(e) => setze({ linkUrl: e.target.value })} />
        </Feld>
        <Feld label="Linktext (freiwillig)" id={`${id}-linktext`} laenge={entwurf.linkText.length} max={LINK_TEXT_MAX}>
          <input id={`${id}-linktext`} className={FELD} value={entwurf.linkText} onChange={(e) => setze({ linkText: e.target.value })} />
        </Feld>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <fieldset className="flex min-w-0 flex-col">
          <legend className={FELD_LABEL}>Live ab</legend>
          <div className="flex gap-2">
            <input type="date" aria-label="Live ab, Tag" className={FELD} value={entwurf.liveAbTag} onChange={(e) => setze({ liveAbTag: e.target.value })} />
            <input type="time" aria-label="Live ab, Uhrzeit" className={cn(FELD, 'w-[9rem] shrink-0')} value={entwurf.liveAbUhrzeit} onChange={(e) => setze({ liveAbUhrzeit: e.target.value })} />
          </div>
        </fieldset>
        <fieldset className="flex min-w-0 flex-col">
          <legend className={FELD_LABEL}>Live bis (freiwillig)</legend>
          <div className="flex gap-2">
            <input type="date" aria-label="Live bis, Tag" className={FELD} value={entwurf.liveBisTag} onChange={(e) => setze({ liveBisTag: e.target.value })} />
            <input type="time" aria-label="Live bis, Uhrzeit" className={cn(FELD, 'w-[9rem] shrink-0')} value={entwurf.liveBisUhrzeit} placeholder="23:59" onChange={(e) => setze({ liveBisUhrzeit: e.target.value })} />
          </div>
        </fieldset>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">{T.vorschauKachel}</span>
        <div className="pointer-events-none max-h-[360px] overflow-hidden rounded-2xl border border-border bg-background" inert>
          <StartseitenBlock
            block={block}
            hoefe={gewaehlteHoefe}
            kategorieBild={block.kategorie ? illustrationPfad(block.kategorie) : null}
          />
        </div>
      </div>

      <p className={cn('text-[12px] leading-normal', LEISE)}>{T.regel}</p>
      <Rueckmeldung meldung={meldung} />
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={KNOPF_RAHMEN} disabled={pending} onClick={onLoeschen}>
          {entwurf.id && <Trash2 className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          {entwurf.id ? 'Löschen' : 'Verwerfen'}
        </button>
        <button type="button" className={KNOPF_GRUEN} disabled={pending} onClick={onSpeichern}>
          <Save className="size-4" strokeWidth={1.8} aria-hidden="true" />
          Speichern
        </button>
      </div>
    </section>
  )
}

function Rueckmeldung({ meldung }: { meldung: Meldung }): React.JSX.Element | null {
  if (!meldung) return null
  return (
    <p role={meldung.art === 'fehler' ? 'alert' : 'status'} className={cn('text-[13px]', meldung.art === 'fehler' ? 'font-medium text-destructive' : LEISE)}>
      {meldung.text}
    </p>
  )
}

function Bibliothek({ onVorlage }: { onVorlage: (v: StartseiteVorlage) => void }): React.JSX.Element {
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

// ─── Die Seite ──────────────────────────────────────────────────────────────

type Ansicht = 'bearbeiten' | 'kundin'

export function StartseiteGestalten({ daten, jetzt: jetztText }: { daten: AdminStartseite; jetzt: string }): React.JSX.Element {
  const router = useRouter()
  const jetzt = new Date(jetztText)
  const [basis, setBasis] = useState(daten)
  // Der Stand als Text: Next liefert die Seite auch ohne Änderung neu (etwa
  // nachdem „Vorschau öffnen" den Draft-Mode-Cookie gesetzt hat) — dann bleibt
  // alles offen, wie es ist. Nur ein anderer Stand ersetzt die Liste.
  const stand = JSON.stringify(daten.zeilen)
  const [basisStand, setBasisStand] = useState(stand)
  const [zeilen, setZeilen] = useState<Zeile[]>(daten.zeilen)
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null)
  const [nachLaden, setNachLaden] = useState<string | null>(null)
  const [geaendert, setGeaendert] = useState(false)
  const [ansicht, setAnsicht] = useState<Ansicht>('bearbeiten')
  const [meldung, setMeldung] = useState<Meldung>(null)
  const [pending, startTransition] = useTransition()

  // Neue Daten vom Server (nach dem Speichern): Liste übernehmen, den gespeicherten Block wieder öffnen.
  if (basisStand !== stand) {
    setBasisStand(stand)
    setBasis(daten)
    setZeilen(daten.zeilen)
    setGeaendert(false)
    const wieder = nachLaden ? daten.zeilen.find((z) => z.block?.id === nachLaden) : undefined
    setEntwurf(wieder ? entwurfAus(wieder) : null)
    setNachLaden(null)
  }

  function aendereZeilen(neu: Zeile[]) {
    setZeilen(neu)
    setGeaendert(true)
    setMeldung(null)
  }

  function oeffne(zeile: Zeile) {
    if (zeile.id === NEUER_BLOCK) return
    setEntwurf(entwurfAus(zeile))
    setMeldung(null)
  }

  /** Ein neuer Block nach der Zeile `nachIndex` (Standard: nach „Höfe in deiner Nähe"). */
  function fuegeEin(nachIndex: number, vorlage: StartseiteVorlage = 'SAISONKARTE') {
    if (zeilen.some((z) => z.id === NEUER_BLOCK)) return
    const neu: Zeile = { id: NEUER_BLOCK, art: 'BLOCK', sichtbar: true, block: null }
    aendereZeilen([...zeilen.slice(0, nachIndex + 1), neu, ...zeilen.slice(nachIndex + 1)])
    setEntwurf(neuerEntwurf(vorlage, jetzt))
  }

  function waehleVorlage(vorlage: StartseiteVorlage) {
    if (entwurf) {
      setEntwurf({ ...entwurf, vorlage })
      setGeaendert(true)
      return
    }
    fuegeEin(zeilen.findIndex((z) => z.art === 'HOEFE'), vorlage)
  }

  function aendereEntwurf(neu: Entwurf) {
    setEntwurf(neu)
    setGeaendert(true)
    setMeldung(null)
  }

  /** Verwerfen eines neuen, ungespeicherten Blocks: seine Zeile fällt aus der Liste. */
  function schliesseNeuen() {
    setZeilen(zeilen.filter((z) => z.id !== NEUER_BLOCK))
    setEntwurf(null)
  }

  function speichern() {
    let block: StartseitenBlockEingabe | null = null
    if (entwurf) {
      block = alsEingabe(entwurf)
      const geprueft = startseitenBlockSchema.safeParse(block)
      if (!geprueft.success) {
        setMeldung({ art: 'fehler', text: geprueft.error.issues[0]?.message ?? 'Bitte prüf die Angaben.' })
        return
      }
    }
    const reihenfolge = zeilen.map((z) => ({ id: z.id, sichtbar: z.sichtbar }))
    startTransition(async () => {
      const ergebnis = await speichereStartseite({ reihenfolge, block })
      if ('error' in ergebnis) {
        setMeldung({ art: 'fehler', text: ergebnis.error })
        return
      }
      setMeldung({ art: 'ok', text: T.gespeichert })
      setGeaendert(false)
      setNachLaden(ergebnis.blockId)
      router.refresh()
    })
  }

  function loeschen() {
    if (!entwurf?.id) return
    const blockId = entwurf.id
    startTransition(async () => {
      const ergebnis = await loescheStartseitenBlock({ blockId })
      if ('error' in ergebnis) {
        setMeldung({ art: 'fehler', text: ergebnis.error })
        return
      }
      setMeldung({ art: 'ok', text: T.geloescht })
      router.refresh()
    })
  }

  const aktivId = entwurf?.zeilenId ?? null
  // Die Liste zeigt den neuen Block mit den Werten aus dem Formular.
  const angezeigt = zeilen.map((z) =>
    z.id === NEUER_BLOCK && entwurf && entwurf.zeilenId === NEUER_BLOCK ? { ...z, block: alsDaten(entwurf, []) } : z
  )

  return (
    <div className="flex flex-col gap-4">
      <Seitenkopf
        titel={T.titel}
        satz={T.satz}
        rechts={
          <Segment
            beschriftung="Ansicht"
            optionen={[
              { wert: 'bearbeiten', label: T.bearbeiten },
              { wert: 'kundin', label: T.kundin },
            ]}
            wert={ansicht}
            onWertChange={(w) => setAnsicht(w as Ansicht)}
          />
        }
      />

      <div className="flex flex-col gap-[18px] lg:flex-row lg:items-start">
        <div className={cn('flex w-full shrink-0 flex-col gap-3', ansicht === 'kundin' ? 'lg:w-[440px]' : 'lg:w-[520px]')}>
          <AbschnittsListe
            zeilen={angezeigt}
            jetzt={jetzt}
            aktivId={aktivId}
            kompakt={ansicht === 'kundin'}
            onZeilen={aendereZeilen}
            onWaehlen={oeffne}
            onEinfuegen={(nachIndex) => fuegeEin(nachIndex)}
          />
          {(geaendert || meldung) && !entwurf && (
            <div className={cn(KARTE, 'flex flex-wrap items-center justify-between gap-3 px-4 py-3')}>
              {meldung ? <Rueckmeldung meldung={meldung} /> : <p className={cn('text-[13px]', LEISE)}>{T.ungespeichert}</p>}
              {geaendert && (
                <button type="button" className={KNOPF_GRUEN} disabled={pending} onClick={speichern}>
                  <Save className="size-4" strokeWidth={1.8} aria-hidden="true" />
                  Speichern
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3.5">
          {ansicht === 'kundin' ? (
            <StartseiteVorschau
              zeilen={basis.zeilen}
              jetzt={jetztText}
              blockEntwurfId={entwurf?.id ?? null}
              ungespeichert={geaendert}
            />
          ) : (
            <>
              {entwurf && (
                <BlockFormular
                  entwurf={entwurf}
                  zeilen={angezeigt}
                  daten={daten}
                  jetzt={jetzt}
                  meldung={meldung}
                  pending={pending}
                  onEntwurf={aendereEntwurf}
                  onSpeichern={speichern}
                  onLoeschen={entwurf.id ? loeschen : schliesseNeuen}
                />
              )}
              <Bibliothek onVorlage={waehleVorlage} />
              {!entwurf && (
                <p className={cn('flex items-start gap-2 text-[12px]', LEISE)}>
                  <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  {T.regel}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
