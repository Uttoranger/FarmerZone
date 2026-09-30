'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Maximize2, Monitor, Smartphone, X } from 'lucide-react'
import { MARKIERUNG_TYP, type HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import {
  VORSCHAU_HANDY_HOEHE,
  VORSCHAU_PARAMETER,
  VORSCHAU_SEITENBREITE,
  leseBereit,
  vorschauAdresse,
  vorschauMassstab,
  type VorschauGeraet,
} from '@/lib/hofseite-vorschau'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

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
 * `stand` steckt in der Adresse: Jedes Speichern zählt hoch, der Rahmen lädt
 * neu. Die geöffnete Zeile geht per postMessage an den Rahmen — nur an den
 * eigenen Ursprung. Nach jedem Laden meldet sich die Seite im Rahmen „bereit"
 * (components/farm/vorschau-im-rahmen.tsx), und die Markierung geht noch
 * einmal hin: Ein Neuladen verliert sie, und das `load`-Ereignis des iframes
 * käme womöglich vor ihrem Empfänger.
 */

/** Schirmbreite des Handyrahmens im Panel — 304 px in einem 320-px-Rahmen. */
const HANDY_SCHIRM_BREITE = 304
/** Sichtbare Höhe des Browser-Rähmchens im Panel; die Seite darin scrollt. */
const WEB_RAHMEN_HOEHE = 680
/** Höhe der Kopfleiste des Browser-Rähmchens (Klasse h-9) — im Overlay geht sie von der Fläche für die Seite ab. */
const BROWSER_LEISTE_HOEHE = 36
/** Der Handyrahmen ist rundum 8 px dick (Klasse p-2) — im Overlay geht das vom Platz für den Schirm ab. */
const HANDY_RAHMEN_DICKE = 16

const GERAETE: { id: VorschauGeraet; label: string; Symbol: typeof Smartphone }[] = [
  { id: 'handy', label: 'Handy', Symbol: Smartphone },
  { id: 'web', label: 'Web', Symbol: Monitor },
]

/**
 * Breite und Höhe eines Elements, live per ResizeObserver — 0, solange nichts
 * gemessen ist. Das Element kommt über die Callback-Ref: Im Overlay hängt es
 * erst nach dem Portal des Dialogs im Dokument, eine Objekt-Ref wäre beim
 * ersten Effekt noch leer und die Fläche bliebe für immer 0 × 0.
 */
function useElementGroesse(): { ref: (el: HTMLElement | null) => void; breite: number; hoehe: number } {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [groesse, setGroesse] = useState({ breite: 0, hoehe: 0 })
  useEffect(() => {
    if (!el) return
    const beobachter = new ResizeObserver(([eintrag]) => {
      setGroesse({ breite: Math.round(eintrag.contentRect.width), hoehe: Math.round(eintrag.contentRect.height) })
    })
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [el])
  return { ref: setEl, breite: groesse.breite, hoehe: groesse.hoehe }
}

/** Handy | Web — zwei gedrückte Knöpfe, kein Tab: Die Bearbeitung daneben bleibt, nur das Gerät wechselt. */
function GeraetUmschalter({ wert, onWert }: { wert: VorschauGeraet; onWert: (g: VorschauGeraet) => void }): React.JSX.Element {
  return (
    <div role="group" aria-label="Gerät der Vorschau" className="flex gap-0.5 rounded-full bg-app-trough p-0.5 ring-1 ring-border/60">
      {GERAETE.map(({ id, label, Symbol }) => (
        <button
          key={id}
          type="button"
          aria-pressed={wert === id}
          onClick={() => onWert(id)}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            wert === id ? 'bg-card font-semibold text-app-ink shadow-sm' : 'font-medium text-app-ink-soft hover:text-app-ink'
          )}
        >
          <Symbol className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  )
}

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

  useEffect(() => {
    const sende = () =>
      rahmen.current?.contentWindow?.postMessage({ typ: MARKIERUNG_TYP, abschnitt: markiert }, window.location.origin)
    // Nur die eigene Seite im eigenen Rahmen darf „bereit" sagen.
    const beiNachricht = (ereignis: MessageEvent) => {
      if (ereignis.source !== rahmen.current?.contentWindow) return
      if (leseBereit(ereignis, window.location.origin)) sende()
    }
    sende()
    window.addEventListener('message', beiNachricht)
    return () => window.removeEventListener('message', beiNachricht)
  }, [markiert])

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
    <div className="flex h-9 items-center gap-3 border-b border-border bg-app-trough px-3" aria-hidden="true">
      <span className="flex gap-1.5">
        <span className="size-2.5 rounded-full bg-app-ink-faint/60" />
        <span className="size-2.5 rounded-full bg-app-ink-faint/60" />
        <span className="size-2.5 rounded-full bg-app-ink-faint/60" />
      </span>
      <span className="mx-auto max-w-[70%] truncate rounded-full bg-card px-3 py-0.5 text-[11.5px] text-app-ink-soft ring-1 ring-border/60">
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
          ? // Der Rahmen in der Tintenfarbe: in beiden Modi dunkler als die Karte
            // darunter. Sein Schatten ist schwarz mit Deckkraft wie der der
            // Titelbild-Knöpfe — er liegt auf der Fläche, nicht auf einer Karte.
            'mx-auto w-fit rounded-[2.4rem] bg-app-ink p-2 shadow-[0_12px_32px] shadow-black/25'
          : 'w-full overflow-hidden rounded-2xl bg-card ring-1 ring-border/60 dark:ring-border'
      )}
    >
      {geraet === 'web' && <BrowserLeiste adresse={adresse} />}
      <div className={cn(geraet === 'handy' && 'overflow-hidden rounded-[2rem]')}>{children}</div>
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
            <DialogTitle className="font-heading text-[17px] font-semibold text-app-ink">Vorschau</DialogTitle>
            <DialogDescription className="truncate text-[13.5px] text-app-ink-soft">{hofName} · so sehen Kunden deine Hofseite</DialogDescription>
          </div>
          <div className="flex flex-1 justify-center">
            <GeraetUmschalter wert={geraet} onWert={onGeraet} />
          </div>
          <a
            href={`/${slug}?${VORSCHAU_PARAMETER}=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-medium text-app-ink transition-colors hover:bg-muted/50"
          >
            In neuem Tab öffnen
            <ArrowUpRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            <span className="sr-only"> (öffnet in neuem Tab)</span>
          </a>
          <DialogClose
            aria-label="Vorschau schließen"
            className="inline-flex size-11 items-center justify-center rounded-full text-app-ink-soft transition-colors hover:bg-muted/50 hover:text-app-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </DialogClose>
        </div>
        <div ref={flaeche} className="flex min-h-0 flex-1 items-start justify-center overflow-hidden bg-app-page p-4">
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
        <p className="shrink-0 border-t border-border px-6 py-2 text-center text-xs text-app-ink-soft">
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
  // Web: Faktor = Panelbreite ÷ 1440, gemessen. Handy: fester Schirm, Faktor 304 ÷ 390.
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
    <aside className="sticky top-6" aria-label="Vorschau">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-app-ink-soft">Vorschau</p>
        <GeraetUmschalter wert={angezeigt} onWert={waehle} />
      </div>
      <div ref={panel} className="mt-2">
        {/* Handy braucht keine Messung (feste 304 px); Web wartet auf die Panelbreite. */}
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
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => oeffneOverlay(angezeigt)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-border text-[13px] font-medium text-app-ink transition-colors hover:bg-muted/50 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Maximize2 className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          Vergrößern
        </button>
        <a
          href={`/${slug}?${VORSCHAU_PARAMETER}=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium text-app-ink-soft transition-colors hover:text-app-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Neuer Tab
          <ArrowUpRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          <span className="sr-only"> (öffnet in neuem Tab)</span>
        </a>
      </div>
      <p className="mt-2 px-1 text-xs leading-relaxed text-app-ink-soft">
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
