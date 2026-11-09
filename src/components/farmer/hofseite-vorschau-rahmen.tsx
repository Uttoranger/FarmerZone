'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, X } from 'lucide-react'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import {
  VORSCHAU_HANDY_HOEHE,
  VORSCHAU_SEITENBREITE,
  vorschauAdresse,
  vorschauLink,
  vorschauMassstab,
  type VorschauGeraet,
} from '@/lib/hofseite-vorschau'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { useVorschauMarkierung } from '@/components/farmer/use-vorschau-markierung'
import { useElementGroesse } from '@/lib/use-element-groesse'
import { RUNDUNG } from '@/components/ui/rundung'

/**
 * Die Vorschau im Editor ab lg: die echte öffentliche Hofseite im
 * Vorschau-Modus (?vorschau=1) — inklusive ihrer Navigation, im selben
 * data-design-Zustand wie die Live-Route, weil es dieselbe Route ist.
 *
 * Der Umschalter bedeutet GERÄT (Mockups hof-mein-hof-v2-*): Handy ist der
 * Telefonrahmen, 390 CSS-px breit und verkleinert; Web ist die Desktop-Seite,
 * 1440 CSS-px breit, in einem Browser-Rähmchen, skaliert auf die Breite des
 * Panels — der Maßstab wird gemessen und gerechnet (vorschauMassstab), nie
 * hart codiert. Beide Geräte teilen sich EIN iframe: Beim Umschalten ändert
 * sich nur seine Breite, die Seite legt sich neu, nichts lädt neu.
 * „Vergrößern" bedeutet GRÖSSE: dasselbe im Overlay (hof-vorschau-vergroessert-overlay).
 * Unter 1280 px Fensterbreite passt Web nicht neben die Bearbeitung — dann
 * öffnet „Web" das Overlay (der Editor sagt mit `webInlineMoeglich`, was geht).
 *
 * Seit Nr. 274 nach Board w1-mein-hof: die Vorschau ist eine schlichte Karte
 * („Vorschau“, daneben Handy | Web als gefüllte bzw. umrandete Pillen ohne
 * Symbol), das Handy ohne Gerät drumherum — nur der Schirm, abgerundet und
 * umrandet (Liste Lauf 32 mein-hof: „Vorschau im Handy-Rahmen …“).
 *
 * `stand` steckt in der Adresse: Jedes Speichern zählt hoch, der Rahmen lädt
 * neu. Die geöffnete Zeile geht per postMessage an den Rahmen
 * (useVorschauMarkierung — derselbe Weg wie „So sieht’s die Kundin" unter lg).
 */

/**
 * Schirmbreite des Handys im Panel — 304 px (Register N16/N7: die Vorschau gehört zu Mein Hof, Handy 304 px,
 * Web 1 408 px). Die Karte darum hat 12 px Polster; der Schirm rückt dafür seitlich ins Polster (-mx-1.5), und sein
 * Rand ist ein Ring, der keinen Platz nimmt — so passt er in die 320-px-Spalte.
 */
const HANDY_SCHIRM_BREITE = 304
/** Sichtbare Höhe des Browser-Rähmchens im Panel; die Seite darin scrollt. */
const WEB_RAHMEN_HOEHE = 680
/** Höhe der Kopfleiste des Browser-Rähmchens (Klasse h-9) — im Overlay geht sie von der Fläche für die Seite ab. */
const BROWSER_LEISTE_HOEHE = 36
/** Ohne Gerät bleibt um den Schirm nur ein Ring, der keinen Platz nimmt — im Overlay geht nichts vom Schirm ab. */
const HANDY_RAHMEN_DICKE = 0

const GERAETE: { id: VorschauGeraet; label: string }[] = [
  { id: 'handy', label: 'Handy' },
  { id: 'web', label: 'Web' },
]

/**
 * Handy | Web — zwei gedrückte Knöpfe, kein Tab: Die Bearbeitung daneben bleibt, nur das Gerät wechselt.
 * Wie im Board w1-mein-hof: das gewählte Gerät gefüllt in der Textfarbe, das andere umrandet; ohne Symbol.
 */
function GeraetUmschalter({ wert, onWert }: { wert: VorschauGeraet; onWert: (g: VorschauGeraet) => void }): React.JSX.Element {
  return (
    <div role="group" aria-label="Gerät der Vorschau" className="flex shrink-0 gap-2">
      {GERAETE.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-pressed={wert === id}
          onClick={() => onWert(id)}
          className={cn(
            'inline-flex min-h-11 items-center rounded-full px-3.5 text-[14px] font-semibold whitespace-nowrap transition-colors duration-[250ms]',
            FOKUS_RAHMEN,
            wert === id ? 'bg-foreground text-background' : 'border border-muted-foreground bg-card text-foreground hover:bg-muted'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** „Vergrößern“ und „Neuer Tab“ unter der Vorschau — Umriss-Knöpfe nebeneinander wie im Board. */
const VORSCHAU_KNOPF = cn(
  'inline-flex min-h-11 flex-1 items-center justify-center gap-1 border border-muted-foreground bg-card px-3.5 text-[14px] font-bold text-foreground transition-colors hover:bg-muted',
  RUNDUNG.karte,
  FOKUS_RAHMEN
)

/**
 * Das iframe mit der Hofseite: Breite nach Gerät, Höhe nach Rahmen, per
 * transform verkleinert. Hier sitzen Neuladen, Markierung und Bereit-Meldung.
 */
function VorschauSeite({
  slug,
  stand,
  markiert,
  geraet,
  massstab,
  hoehe,
  titel,
}: {
  slug: string
  stand: number
  markiert: HofseiteZeileId | null
  geraet: VorschauGeraet
  massstab: number
  /** Höhe der Seite in ihren eigenen CSS-Pixeln (vor dem Verkleinern). */
  hoehe: number
  titel: string
}): React.JSX.Element {
  const rahmen = useRef<HTMLIFrameElement>(null)

  // Der erste Stand steht im src; jeder weitere ersetzt die Adresse im
  // Rahmen (location.replace), statt src zu ändern — ein neues src legte im
  // gemeinsamen Verlauf des Browsers einen Eintrag an, und „Zurück" führte
  // erst durch alle alten Stände der Vorschau.
  const [anfang] = useState(stand)
  useEffect(() => {
    if (stand === anfang) return
    rahmen.current?.contentWindow?.location.replace(vorschauAdresse(slug, stand))
  }, [slug, stand, anfang])

  useVorschauMarkierung(rahmen, markiert)

  const breite = VORSCHAU_SEITENBREITE[geraet]
  return (
    <div className="relative overflow-hidden bg-card" style={{ width: Math.round(breite * massstab), height: Math.round(hoehe * massstab) }}>
      <iframe
        ref={rahmen}
        title={titel}
        src={vorschauAdresse(slug, anfang)}
        className="absolute left-0 top-0 border-0"
        style={{ width: breite, height: hoehe, transform: `scale(${massstab})`, transformOrigin: 'top left' }}
      />
    </div>
  )
}

/** Die Kopfleiste des Browser-Rähmchens: drei Punkte, die Adresse der Hofseite. */
function BrowserLeiste({ adresse }: { adresse: string }): React.JSX.Element {
  return (
    <div className="flex h-9 items-center gap-3 border-b border-border bg-muted px-3" aria-hidden="true">
      <span className="flex gap-1.5">
        <span className="size-2.5 rounded-full bg-muted-foreground/50" />
        <span className="size-2.5 rounded-full bg-muted-foreground/50" />
        <span className="size-2.5 rounded-full bg-muted-foreground/50" />
      </span>
      <span className="mx-auto max-w-[70%] truncate rounded-full bg-card px-3 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
        {adresse}
      </span>
      <span className="w-9" />
    </div>
  )
}

/** Handyrahmen oder Browser-Rähmchen um die Seite — beide um dasselbe iframe, damit ein Wechsel nichts neu lädt. */
function Geraeterahmen({
  geraet,
  adresse,
  children,
}: {
  geraet: VorschauGeraet
  adresse: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div
      className={cn(
        geraet === 'handy'
          ? // Kein Gerät drumherum (Board w1-mein-hof, Nr. 274): nur der Schirm, abgerundet und umrandet.
            cn('mx-auto w-fit overflow-hidden bg-background ring-1 ring-border', RUNDUNG.blatt)
          : cn('w-full overflow-hidden border border-border bg-card', RUNDUNG.blatt)
      )}
    >
      {geraet === 'web' && <BrowserLeiste adresse={adresse} />}
      <div>{children}</div>
    </div>
  )
}

type SeitenProps = { slug: string; stand: number; markiert: HofseiteZeileId | null; hofName: string; adresse: string }

/** Die vergrößerte Vorschau: Handy in echter Größe oder Web auf Overlay-Breite, Umschalter mittig. */
function VorschauOverlay({
  slug,
  stand,
  markiert,
  hofName,
  adresse,
  geraet,
  onGeraet,
  onSchliessen,
  ausloeser,
}: SeitenProps & {
  geraet: VorschauGeraet
  onGeraet: (g: VorschauGeraet) => void
  onSchliessen: () => void
  /** Das Element, das das Overlay geöffnet hat („Vergrößern" oder „Web" ohne Platz) — beim Schließen geht der Fokus dorthin zurück. */
  ausloeser: React.RefObject<HTMLElement | null>
}): React.JSX.Element {
  const { ref: flaeche, breite, hoehe } = useElementGroesse()
  // Web füllt die Breite, die Kopfleiste geht von der Höhe ab; das Handy passt
  // samt Rahmen in Breite UND Höhe (vorschauMassstab rechnet beides).
  const massstab =
    geraet === 'web'
      ? vorschauMassstab({ breite }, 'web')
      : vorschauMassstab({ breite: breite - HANDY_RAHMEN_DICKE, hoehe: hoehe - HANDY_RAHMEN_DICKE }, 'handy')
  const seitenHoehe = geraet === 'web' ? Math.max(0, Math.round((hoehe - BROWSER_LEISTE_HOEHE) / massstab)) : VORSCHAU_HANDY_HOEHE

  return (
    <Dialog
      open
      onOpenChange={(offen) => {
        if (!offen) onSchliessen()
      }}
    >
      <DialogContent
        showCloseButton={false}
        finalFocus={ausloeser}
        className="flex h-[92vh] w-[calc(100vw-2rem)] max-w-[1440px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1440px]"
      >
        <div className="flex shrink-0 items-center gap-4 border-b border-border px-6 py-3">
          <div className="flex min-w-0 items-baseline gap-2.5">
            <DialogTitle className="font-heading text-[17px] font-semibold text-foreground">Vorschau</DialogTitle>
            <DialogDescription className="truncate text-[13.5px] text-muted-foreground">{hofName} · so sehen Kunden deine Hofseite</DialogDescription>
          </div>
          <div className="flex flex-1 justify-center">
            <GeraetUmschalter wert={geraet} onWert={onGeraet} />
          </div>
          <a
            href={vorschauLink(slug)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-muted', FOKUS_RAHMEN)}
          >
            In neuem Tab öffnen
            <ArrowUpRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            <span className="sr-only"> (öffnet in neuem Tab)</span>
          </a>
          <DialogClose
            aria-label="Vorschau schließen"
            className={cn('inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', FOKUS_RAHMEN)}
          >
            <X className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </DialogClose>
        </div>
        <div ref={flaeche} className="flex min-h-0 flex-1 items-start justify-center overflow-hidden bg-background p-4">
          {/* Erst messen, dann rendern: ein iframe ohne Maß lüde die Seite in 0 × 0. */}
          {breite > 0 && (
            <Geraeterahmen geraet={geraet} adresse={adresse}>
              <VorschauSeite
                slug={slug}
                stand={stand}
                markiert={markiert}
                geraet={geraet}
                massstab={massstab}
                hoehe={seitenHoehe}
                titel="Vergrößerte Vorschau deiner Hofseite"
              />
            </Geraeterahmen>
          )}
        </div>
        <p className="shrink-0 border-t border-border px-6 py-2 text-center text-xs text-muted-foreground">
          Scrollt wie im Browser · Der Umschalter oben wechselt zwischen Handy und Web
        </p>
      </DialogContent>
    </Dialog>
  )
}

export function HofseiteVorschauRahmen({
  slug,
  stand,
  markiert,
  hofName,
  adresse,
  geraet,
  onGeraet,
  webInlineMoeglich,
}: SeitenProps & {
  geraet: VorschauGeraet
  onGeraet: (g: VorschauGeraet) => void
  /** Ob die Web-Vorschau neben die Bearbeitung passt (Fenster ≥ 1280 px) — sonst geht „Web" ins Overlay. */
  webInlineMoeglich: boolean
}): React.JSX.Element {
  const [overlay, setOverlay] = useState<VorschauGeraet | null>(null)
  // Wer das Overlay öffnet, bekommt beim Schließen den Fokus zurück — „Vergrößern" oder „Web".
  const ausloeser = useRef<HTMLElement | null>(null)
  const { ref: panel, breite: panelBreite } = useElementGroesse()

  function oeffneOverlay(g: VorschauGeraet) {
    ausloeser.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setOverlay(g)
  }

  const webInline = geraet === 'web' && webInlineMoeglich
  const angezeigt: VorschauGeraet = webInline ? 'web' : 'handy'
  // Web: Faktor = Panelbreite ÷ 1440, gemessen. Handy: fester Schirm (HANDY_SCHIRM_BREITE, 304 px), Faktor 304 ÷ 390.
  const massstab = angezeigt === 'web' ? vorschauMassstab({ breite: panelBreite }, 'web') : vorschauMassstab({ breite: HANDY_SCHIRM_BREITE }, 'handy')
  const seitenHoehe = angezeigt === 'web' ? Math.round(WEB_RAHMEN_HOEHE / massstab) : VORSCHAU_HANDY_HOEHE

  function waehle(g: VorschauGeraet) {
    // Web ohne Platz daneben: die Vorschau bleibt Handy, das Overlay zeigt Web.
    if (g === 'web' && !webInlineMoeglich) {
      oeffneOverlay('web')
      return
    }
    onGeraet(g)
  }

  return (
    <aside className={cn('sticky top-6 flex flex-col gap-2.5 border border-border bg-card p-3', RUNDUNG.blatt)} aria-label="Vorschau">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase">Vorschau</h2>
        <GeraetUmschalter wert={angezeigt} onWert={waehle} />
      </div>
      <div ref={panel} className={cn(angezeigt === 'handy' && '-mx-1.5')}>
        {/* Handy braucht keine Messung (feste 304 px, HANDY_SCHIRM_BREITE, Register N16); Web wartet auf die Panelbreite. */}
        {(angezeigt === 'handy' || panelBreite > 0) && (
          <Geraeterahmen geraet={angezeigt} adresse={adresse}>
            <VorschauSeite
              slug={slug}
              stand={stand}
              markiert={markiert}
              geraet={angezeigt}
              massstab={massstab}
              hoehe={seitenHoehe}
              titel="Vorschau deiner Hofseite"
            />
          </Geraeterahmen>
        )}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => oeffneOverlay(angezeigt)} className={VORSCHAU_KNOPF}>
          Vergrößern
        </button>
        <a href={vorschauLink(slug)} target="_blank" rel="noopener noreferrer" className={VORSCHAU_KNOPF}>
          Neuer Tab
          {/* Der Pfeil des Boards als Symbol: Das Zeichen „↗“ verbietet tests/keine-emojis.test.ts. */}
          <ArrowUpRight className="size-4" strokeWidth={2} aria-hidden="true" />
          <span className="sr-only"> (öffnet in neuem Tab)</span>
        </a>
      </div>
      <p className="text-xs leading-[1.45] text-muted-foreground">
        {angezeigt === 'web'
          ? 'So sieht deine Hofseite im Browser aus. Du kannst darin blättern; nach dem Speichern zeigt sie den neuen Stand.'
          : 'Echte Kundenseite, inklusive Navigation. Die gerade geöffnete Zeile leuchtet in der Vorschau auf.'}
      </p>
      {overlay && (
        <VorschauOverlay
          slug={slug}
          stand={stand}
          markiert={markiert}
          hofName={hofName}
          adresse={adresse}
          geraet={overlay}
          onGeraet={setOverlay}
          onSchliessen={() => setOverlay(null)}
          ausloeser={ausloeser}
        />
      )}
    </aside>
  )
}
