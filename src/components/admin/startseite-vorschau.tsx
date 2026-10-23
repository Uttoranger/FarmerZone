'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, CalendarDays, Info } from 'lucide-react'
import { ADMIN_STARTSEITE_TEXT as T, STAND_TEXT, type StandWahl } from '@/lib/startseite-gestalten'
import { ENTWURF_TEXT, scrollNachNeuladen, vorschauQuelleText, vorschauRahmen } from '@/lib/startseite-fassung'
import { uhrzeitInWien } from '@/lib/fristen'
import { VORSCHAU_HANDY_HOEHE, VORSCHAU_SEITENBREITE, vorschauMassstab, type VorschauGeraet } from '@/lib/hofseite-vorschau'
import { useElementGroesse } from '@/lib/use-element-groesse'
import { cn } from '@/lib/utils'
import type { VorschauQuelle } from '@/schemas/startseite'
import { beendeStartseitenVorschau, erzeugeStartseitenVorschau } from '@/server/actions/startseite'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Segment } from '@/components/ui/segment'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetBlatt, SheetClose, SheetTitle } from '@/components/ui/sheet'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { LEISE } from '@/components/hof-bestellungen/stil'

/*
 * „So sieht’s die Kundin" in Admin › Startseite (Register N16, Nr. 96;
 * seit Nr. 99 nach admin-startseite-entwurf): die ECHTE Startseite im Rahmen —
 * Handy 304 px (390 CSS-px verkleinert) oder Web (1 440 CSS-px auf die Breite
 * des Panels), dieselben Maße wie die Vorschau in Mein Hof
 * (src/lib/hofseite-vorschau.ts).
 *
 * Entwurf | Live wählt die Quelle (Standard Entwurf), „Stand am" den Tag:
 * heute, in einer Woche, der Beginn des nächsten Blocks oder der Termin der
 * nächsten Planung. Die Adresse holt die Action (erzeugeStartseitenVorschau):
 * signiert, mit der Quelle im signierten Teil, eine Stunde gültig, und sie
 * schaltet für diesen Browser den Draft Mode ein. Oben im Rahmen ein Band,
 * damit niemand den Entwurf für die echte Seite hält. „Vorschau öffnen" führt
 * über die Route /admin/startseite/vorschau (anderes Gerät mit
 * Admin-Sitzung), mit derselben Quelle. Verschwindet die Vorschau, schaltet
 * beendeStartseitenVorschau den Draft Mode wieder aus.
 *
 * Neu laden ohne leeren Rahmen (Register N16, Ergänzung Nr. 106): Nach jeder
 * Speicherung kommt eine neue Adresse. Der sichtbare Rahmen bleibt stehen, die
 * neue lädt unsichtbar daneben (vorschauRahmen); ist sie fertig, scrollt sie
 * dorthin, wo der alte stand (scrollNachNeuladen — gleicher Ursprung, also
 * lesbar), und erst dann tauschen die beiden. Darunter „Vorschau aktualisiert
 * · hh:mm" (Wiener Zeit), während des Ladens ein Punkt über dem Rahmen.
 */

const HANDY_SCHIRM = 304
const WEB_RAHMEN_HOEHE = 760

/** `quelle`: für welche Quelle die Adresse erzeugt wurde — der Titel des Rahmens folgt ihr erst, wenn sie sichtbar ist. */
type Link = { pfad: string; link: string; stand: string; quelle: VorschauQuelle } | { fehler: string }

export type VorschauBand = 'entwurf' | 'live' | 'geplant'

const BAND: Record<VorschauBand, { text: string; klasse: string }> = {
  // Bild-Overlay: im neuen Design sind primary/accent samt Schrift in beiden Themes gleich (DESIGN_SYSTEM „Farbtokens“).
  entwurf: { text: ENTWURF_TEXT.bandEntwurf, klasse: 'bg-primary text-primary-foreground' },
  live: { text: ENTWURF_TEXT.bandLive, klasse: 'bg-accent text-accent-foreground' },
  geplant: { text: ENTWURF_TEXT.bandGeplant, klasse: 'bg-accent text-accent-foreground' },
}

/** Wo ein Rahmen gerade steht — null, wenn der Browser nicht hineinsehen lässt (im Rahmen eine Seite anderer Herkunft geöffnet). */
function lageIm(rahmen: HTMLIFrameElement | undefined): { pfadname: string; scrollY: number } | null {
  try {
    const fenster = rahmen?.contentWindow
    return fenster ? { pfadname: fenster.location.pathname, scrollY: fenster.scrollY } : null
  } catch {
    // Fremde Herkunft wirft beim Lesen (SecurityError): dann beginnt der neue Rahmen oben.
    return null
  }
}

function Rahmen({
  geraet,
  rahmen,
  sichtbar,
  laedt,
  band,
  titel,
  onGeladen,
}: {
  geraet: VorschauGeraet
  /** Die Adressen, die stehen: die sichtbare und ggf. die ladende (vorschauRahmen). */
  rahmen: string[]
  sichtbar: string | null
  laedt: boolean
  band: VorschauBand
  /** Titel des sichtbaren Rahmens, mit der Quelle — eindeutig neben dem ladenden. */
  titel: string
  onGeladen: (pfad: string, neu: HTMLIFrameElement, alt: HTMLIFrameElement | undefined) => void
}): React.JSX.Element {
  const { ref, breite } = useElementGroesse()
  const massstab = geraet === 'web' ? vorschauMassstab({ breite }, 'web') : vorschauMassstab({ breite: HANDY_SCHIRM }, 'handy')
  const hoehe = geraet === 'web' ? Math.round(WEB_RAHMEN_HOEHE / massstab) : VORSCHAU_HANDY_HOEHE
  const seite = VORSCHAU_SEITENBREITE[geraet]
  const fenster = useRef(new Map<string, HTMLIFrameElement>())

  const bandZeile = (
    <p className={cn('flex h-[22px] items-center justify-center px-2 text-center text-[10px] font-bold tracking-[0.08em]', BAND[band].klasse)}>
      {BAND[band].text}
    </p>
  )
  const innen = (
    <div
      className="relative overflow-hidden bg-background"
      style={{ width: Math.round(seite * massstab), height: Math.round(hoehe * massstab) }}
      aria-busy={laedt}
    >
      {sichtbar === null && <div className="absolute inset-0 animate-pulse bg-muted" />}
      {rahmen.map((pfad) => (
        <iframe
          key={pfad}
          ref={(el) => {
            if (el) fenster.current.set(pfad, el)
            return () => {
              fenster.current.delete(pfad)
            }
          }}
          // Der ladende Rahmen hat einen eigenen Titel und ist unsichtbar (visibility: der Browser lädt und scrollt ihn trotzdem).
          title={pfad === sichtbar ? titel : T.vorschauLaedt}
          src={pfad}
          tabIndex={pfad === sichtbar ? undefined : -1}
          onLoad={(e) => onGeladen(pfad, e.currentTarget, sichtbar === null ? undefined : fenster.current.get(sichtbar))}
          className={cn('absolute top-0 left-0 border-0', pfad !== sichtbar && 'pointer-events-none invisible')}
          style={{ width: seite, height: hoehe, transform: `scale(${massstab})`, transformOrigin: 'top left' }}
        />
      ))}
      {laedt && sichtbar !== null && (
        <span className="absolute top-2.5 right-2.5 size-2.5 animate-pulse rounded-full bg-primary ring-2 ring-background" aria-hidden="true" />
      )}
    </div>
  )

  if (geraet === 'handy') {
    // Ein Gerät, kein Teil der Seite: fast schwarz in beiden Modi wie in Mein Hof (hofseite-vorschau-rahmen.tsx).
    return (
      <div className="mx-auto w-fit rounded-[2.4rem] border border-border bg-primary-foreground p-2 shadow-[0_12px_32px] shadow-primary-foreground/30">
        <div className="overflow-hidden rounded-[2rem]">
          {bandZeile}
          {innen}
        </div>
      </div>
    )
  }
  return (
    <div ref={ref} className="w-full overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex h-9 items-center gap-3 border-b border-border bg-muted px-3" aria-hidden="true">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-muted-foreground/50" />
          <span className="size-2.5 rounded-full bg-muted-foreground/50" />
          <span className="size-2.5 rounded-full bg-muted-foreground/50" />
        </span>
        <span className="mx-auto max-w-[70%] truncate rounded-full bg-card px-3 py-0.5 text-[11.5px] text-muted-foreground ring-1 ring-border">/</span>
        <span className="w-9" />
      </div>
      {bandZeile}
      {breite > 0 && innen}
    </div>
  )
}

export function StartseiteVorschau({
  quelle: festeQuelle,
  blockMoeglich,
  termin,
  blockEntwurfId,
  neuLaden,
  geraetStandard = 'web',
  standStandard = 'heute',
  band: festesBand,
  hinweis,
  onStandWechsel,
}: {
  /** Fest (Zeitplan) — sonst wählt das Segment Entwurf | Live. */
  quelle?: VorschauQuelle
  /** Ob „nächster Block" je Quelle einen Tag hat (sonst fehlt die Wahl). */
  blockMoeglich: { entwurf: boolean; live: boolean }
  /** Der Termin der nächsten Planung (ISO) — nur dann gibt es „geplanter Termin". */
  termin: string | null
  blockEntwurfId: string | null
  /** Ändert sich nach jedem gespeicherten Entwurf — der Rahmen lädt dann neu. */
  neuLaden?: number
  geraetStandard?: VorschauGeraet
  standStandard?: StandWahl
  band?: VorschauBand
  /**
   * Die Zeile unter dem Rahmen beim Bearbeiten (Nr. 155, vorschauHinweis):
   * je nach gezeigtem Tag — nur für den Entwurf, live zeigt nur, was live ist.
   */
  hinweis?: (stand: StandWahl) => string | null
  /** „Stand am“ gewechselt — die Zeile nach „Fertig“ gilt bis dahin. */
  onStandWechsel?: () => void
}): React.JSX.Element {
  const [geraet, setGeraet] = useState<VorschauGeraet>(geraetStandard)
  const [gewaehlt, setGewaehlt] = useState<'entwurf' | 'live'>('entwurf')
  const [stand, setStand] = useState<StandWahl>(standStandard)
  const [link, setLink] = useState<Link | null>(null)
  const [sichtbar, setSichtbar] = useState<string | null>(null)
  const [sichtbareQuelle, setSichtbareQuelle] = useState<VorschauQuelle | null>(null)
  const [aktualisiert, setAktualisiert] = useState<string | null>(null)
  const quelle: VorschauQuelle = festeQuelle ?? gewaehlt
  // Das Band folgt wie der Titel dem, was der Rahmen zeigt (`sichtbareQuelle`), nicht der Wahl im Segment (Nr. 127):
  // Solange die neue Adresse lädt, steht noch der alte Stand da – und heißt auch so.
  const band: VorschauBand = festesBand ?? ((sichtbareQuelle ?? quelle) === 'entwurf' ? 'entwurf' : 'live')

  const optionen = (['heute', 'woche', 'block', 'termin'] as const).filter(
    (w) => (w !== 'block' || (quelle === 'entwurf' ? blockMoeglich.entwurf : blockMoeglich.live)) && (w !== 'termin' || termin !== null)
  )
  // Fällt die gewählte Wahl weg (andere Quelle ohne Block), gilt heute.
  const standGilt: StandWahl = optionen.includes(stand) ? stand : 'heute'

  useEffect(() => {
    let gueltig = true
    // Der Block in Bearbeitung zählt nur im Entwurf — live zeigt nur, was live ist.
    void erzeugeStartseitenVorschau({ stand: standGilt, quelle, blockEntwurfId: quelle === 'entwurf' ? blockEntwurfId : null }).then((ergebnis) => {
      if (!gueltig) return
      setLink('error' in ergebnis ? { fehler: ergebnis.error } : { pfad: ergebnis.pfad, link: ergebnis.link, stand: ergebnis.stand, quelle })
    })
    return () => {
      gueltig = false
    }
  }, [standGilt, quelle, blockEntwurfId, neuLaden])

  // Nur beim Aushängen: Sonst rendert dieser Browser jede statische Seite bis
  // zum Ende der Sitzung ohne Cache. Actions laufen nacheinander — ein
  // späteres Einschalten (wieder „So sieht's die Kundin") gewinnt.
  useEffect(
    () => () => {
      void beendeStartseitenVorschau()
    },
    []
  )

  const hinweisText = quelle === 'entwurf' ? (hinweis?.(standGilt) ?? null) : null
  const oeffnen = link && 'link' in link ? link.link : null
  const gewuenscht = link && 'pfad' in link ? link.pfad : null
  const gewuenschteQuelle = link && 'pfad' in link ? link.quelle : quelle
  const { rahmen, laedt } = vorschauRahmen(sichtbar, gewuenscht)

  /** Die neue Adresse ist fertig: an die Stelle des alten Rahmens scrollen, dann tauschen. */
  function geladen(pfad: string, neu: HTMLIFrameElement, alt: HTMLIFrameElement | undefined): void {
    // Der sichtbare Rahmen lädt selbst neu (Gerät gewechselt, Klick im Rahmen) oder eine überholte Adresse: nichts zu tauschen.
    if (pfad === sichtbar || pfad !== gewuenscht) return
    neu.contentWindow?.scrollTo({ top: scrollNachNeuladen(lageIm(alt)), behavior: 'instant' })
    setSichtbar(pfad)
    // Der Titel wechselt mit dem neuen Stand, nicht mit der Wahl im Segment: Bis dahin zeigt der Rahmen noch die alte Quelle.
    setSichtbareQuelle(gewuenschteQuelle)
    setAktualisiert(uhrzeitInWien(new Date()))
  }

  return (
    <section aria-labelledby="kundin-titel" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="kundin-titel" className="font-heading text-lg font-semibold text-foreground">
          {T.kundin}
        </h2>
        <Segment
          beschriftung="Gerät der Vorschau"
          optionen={[
            { wert: 'handy', label: 'Handy' },
            { wert: 'web', label: 'Web' },
          ]}
          wert={geraet}
          onWertChange={(w) => setGeraet(w as VorschauGeraet)}
        />
        <span className="flex-1" />
        {!festeQuelle && (
          <Segment
            beschriftung={ENTWURF_TEXT.quelleBeschriftung}
            optionen={[
              { wert: 'entwurf', label: ENTWURF_TEXT.entwurf },
              { wert: 'live', label: ENTWURF_TEXT.live },
            ]}
            wert={gewaehlt}
            onWertChange={(w) => setGewaehlt(w as 'entwurf' | 'live')}
          />
        )}
        <span className={cn('inline-flex items-center gap-1.5 text-[13px]', LEISE)}>
          <CalendarDays className="size-4" strokeWidth={1.8} aria-hidden="true" />
          am <span className="font-semibold text-foreground">{link && 'stand' in link ? link.stand : '–'}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segment
          beschriftung="Stand am"
          optionen={optionen.map((w) => ({ wert: w, label: STAND_TEXT[w] }))}
          wert={standGilt}
          onWertChange={(w) => {
            setStand(w as StandWahl)
            onStandWechsel?.()
          }}
        />
        <span className="flex-1" />
        {oeffnen && (
          <a
            href={oeffnen}
            target="_blank"
            rel="noopener noreferrer"
            title={T.vorschauLinkSatz}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-status-fertig transition-colors hover:bg-muted',
              FOKUS_RAHMEN
            )}
          >
            {T.vorschauOeffnen}
            <ArrowUpRight className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            <span className="sr-only"> (öffnet in neuem Tab)</span>
          </a>
        )}
      </div>
      {link && 'fehler' in link && (
        <p role="alert" className="text-[12.5px] font-medium text-destructive">
          {link.fehler}
        </p>
      )}
      <Rahmen
        geraet={geraet}
        rahmen={rahmen}
        sichtbar={sichtbar}
        laedt={laedt}
        band={band}
        titel={`${T.rahmenTitel} · ${vorschauQuelleText(sichtbareQuelle ?? quelle)}`}
        onGeladen={geladen}
      />
      {hinweisText && (
        <p role="status" className="flex items-start gap-1.5 text-[12.5px] leading-snug font-medium text-status-offen">
          <Info className="mt-px size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {hinweisText}
        </p>
      )}
      <p role="status" className="min-h-[1.25rem] text-[12.5px] font-medium text-foreground">
        {aktualisiert && T.vorschauAktualisiert(aktualisiert)}
      </p>
      <p className={cn('-mt-2 text-[12px] leading-normal', LEISE)}>{T.vorschauSatz}</p>
    </section>
  )
}

/**
 * Die Vorschau als eigenes Fenster: ab 768 px ein breiter Dialog, am Handy
 * ein Blatt von unten (Mockup mobil-admin-startseite-entwurf, DESIGN_SYSTEM
 * „Dialoge und Blätter"). Für „Vorschau" in der Leiste am Handy und für
 * „Vorschau"/„Ansehen" im Zeitplan.
 */
export function VorschauFenster({
  offen,
  onOffenChange,
  titel,
  children,
}: {
  offen: boolean
  onOffenChange: (offen: boolean) => void
  titel: string
  children: React.ReactNode
}): React.JSX.Element {
  const breit = useMindestbreite(768)
  if (breit) {
    return (
      <Dialog open={offen} onOpenChange={onOffenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto p-5 sm:max-w-[960px]">
          <DialogTitle className="font-heading text-xl leading-tight font-semibold">{titel}</DialogTitle>
          {children}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Sheet open={offen} onOpenChange={onOffenChange}>
      <SheetBlatt>
        <SheetTitle className="font-heading text-xl leading-tight font-semibold">{titel}</SheetTitle>
        {children}
        <SheetClose className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-status-fertig hover:bg-muted', FOKUS_RAHMEN)}>
          Schließen
        </SheetClose>
      </SheetBlatt>
    </Sheet>
  )
}
