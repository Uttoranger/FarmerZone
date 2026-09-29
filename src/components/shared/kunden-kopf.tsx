'use client'

import { useEffect, useState, type MouseEvent, type RefObject } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Menu, Share2, ShoppingCart, X } from 'lucide-react'
import { kopfForm, rueckweg, tippAufRueckweg, type KundenSeite } from '@/lib/kunden-kopf'
import { menuePunkte, type AngezeigterMenuePunkt } from '@/lib/kunden-menue'
import { useWarenkorbKopf } from '@/lib/use-warenkorb-kopf'
import { eigenerVorgaengerJetzt, merkeHinauf } from '@/components/shared/rueckweg-merker'
import { Wortmarke } from '@/components/shared/wortmarke'
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet'

/**
 * Wie weit ein Sprungziel der Hofseite (Übersicht, Fotos, Produkte, Kategorien)
 * unter dem oberen Rand stehen bleibt: unter Kopfleiste (56 px, ab md 64 px)
 * und Sektionsleiste (~45 px). In der Vorschau des Bauern-Bereichs gibt es
 * keine Kopfleiste, dort nur die Sektionsleiste.
 */
export const SPRUNGZIEL_UNTER_KOPF = 'scroll-mt-[6.5rem] md:scroll-mt-28'
export const SPRUNGZIEL_OHNE_KOPF = 'scroll-mt-14'

/**
 * Die Kopfzeile aller Kundenseiten außer der Startseite (die hat LandingNav).
 * Was sie zeigt und wohin „Zurück" führt, entscheidet src/lib/kunden-kopf.ts,
 * die Menüpunkte src/lib/kunden-menue.ts.
 *
 * HANDY (unter md): eine klebende Leiste, 56 px, auf jeder Kundenseite von
 * Anfang an — auch auf der Hofseite, dort ÜBER dem Titelbild. Links Zurück
 * (wo es woanders hinführt als nach Hause) und das F-Icon mit „FarmerZone"
 * als Weg zur Startseite, rechts der Warenkorb und das Menü. Kundenseiten
 * haben keine Leiste unten; diese eine Leiste trägt alle Wege, die im
 * Browser die Kopfzeile trägt. Auf der Hofseite erscheint in der Mitte der
 * Hofname, sobald die Überschrift aus dem Blick ist — dann tritt das Wort
 * „FarmerZone" zurück und nur das F-Icon bleibt als Weg nach Hause.
 *
 * BROWSER (ab md): eine Kopfzeile, 64 px — FarmerZone, Höfe entdecken, Für
 * Höfe, Hofbetreiber-Login, Warenkorb. Wo sie selbst nicht zurückführt
 * (Hofseite, Bestellweg), steht darunter ein Rückweg-Link.
 *
 * Beide kleben (`sticky`) statt fest zu stehen: Das Umgebungsbanner der
 * Testumgebung liegt im Fluss darüber und läge sonst beim Laden über ihnen.
 * Ebene 40: über der Sektionsleiste der Hofseite (30), unter Sheets,
 * Dialogen und der Lightbox (50).
 */
export function KundenKopf({
  seite,
  hofName,
  hofNameUeberschrift,
}: {
  seite: KundenSeite
  /** Hofseite: der Name in der Mitte der Handy-Leiste. Bestellweg: der Rückweg-Link im Browser („‹ {Hofname}"). */
  hofName?: string
  /** Hofseite: die Überschrift mit dem Hofnamen — ist sie aus dem Blick, steht der Name in der Leiste. */
  hofNameUeberschrift?: RefObject<HTMLElement | null>
}) {
  const form = kopfForm(seite)
  const korb = useWarenkorbKopf()
  const nameInLeiste = useUeberschriftWeggescrollt(hofNameUeberschrift) && hofName !== undefined
  const tinte = seite.art === 'hofseite' ? 'text-app-ink' : 'text-foreground'

  // Browser: ein fester Platz für das Symbol, auch solange noch keins da ist
  // (beim Server-Rendern gibt es keinen Korb) — sonst sprängen die Links,
  // sobald es erscheint.
  const warenkorbPlatz =
    form.warenkorb && korb ? (
      <WarenkorbSymbol anzahl={korb.anzahl} href={korb.href} />
    ) : (
      <span className="size-11" aria-hidden="true" />
    )

  return (
    <>
      {/* ── Handy ── */}
      <div className="sticky top-0 z-40 print:hidden md:hidden">
        <div className="relative flex h-14 items-center justify-between gap-1 border-b border-border bg-card px-2">
          <div className={`flex items-center ${form.zurueck ? '' : 'pl-2'}`}>
            {form.zurueck && <ZurueckKnopf seite={seite} />}
            <Link
              href="/"
              aria-label="FarmerZone — zur Startseite"
              className={`flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-1 ${FOKUS}`}
            >
              <FIcon />
              {!nameInLeiste && (
                <span className="whitespace-nowrap font-heading text-lg font-bold text-brand-text">FarmerZone</span>
              )}
            </Link>
          </div>
          {/* Mitte der Leiste, nicht der Restfläche: links stehen Zurück und
              F-Icon, rechts nur das Menü — gleicher Abstand zu beiden Rändern
              (6rem = 8px Rand + zwei 44-px-Knöpfe). Die Schrift der Hofseite
              (app-*), sonst zwei Dunkeltöne übereinander. */}
          {nameInLeiste && (
            <p
              className={`pointer-events-none absolute inset-x-24 top-1/2 -translate-y-1/2 truncate text-center text-[15px] font-semibold ${tinte} motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200`}
            >
              {hofName}
            </p>
          )}
          <div className="flex items-center">
            {form.warenkorb && korb && <WarenkorbSymbol anzahl={korb.anzahl} href={korb.href} />}
            <MenueBlatt tinte={tinte} />
          </div>
        </div>
      </div>

      {/* ── Browser ── */}
      <header className="sticky top-0 z-40 hidden h-16 border-b border-border bg-card print:hidden md:block">
        <div className="mx-auto flex h-full max-w-6xl items-center gap-8 px-6">
          <Link href="/" aria-label="FarmerZone — zur Startseite" className={`rounded-md ${FOKUS}`}>
            <Wortmarke />
          </Link>
          <nav aria-label="Hauptnavigation" className="flex flex-1 items-center gap-6">
            <Link href="/hoefe" className={`${TEXTLINK} ${FOKUS}`}>
              Höfe entdecken
            </Link>
          </nav>
          <div className="flex items-center gap-5">
            {/* Wie auf der Startseite: ein Wort, ein Ziel (landing-nav.tsx). */}
            <Link href="/#weiter" className={`${TEXTLINK} ${FOKUS}`}>
              Für Höfe
            </Link>
            <Link
              href="/login"
              className={`inline-flex h-9 items-center rounded-lg border border-border px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted ${FOKUS}`}
            >
              Hofbetreiber-Login
            </Link>
            {form.warenkorb && warenkorbPlatz}
          </div>
        </div>
      </header>
      {form.rueckwegZeile && <RueckwegZeile seite={seite} hofName={hofName} />}
    </>
  )
}

/**
 * Der Teilen-Knopf über dem Titelbild der Hofseite (Handy). Zurück, der Weg
 * nach Hause und das Menü stehen in der Leiste darüber — über dem Bild bleibt
 * nur, was zum Hof gehört. Gehört in den Behälter des Titelbilds (relative).
 */
export function TitelbildTeilen({ onTeilen }: { onTeilen: () => void }) {
  return (
    <div className="absolute right-3 top-3 z-10 md:hidden">
      <button type="button" onClick={onTeilen} aria-label="Hof teilen" className={RUND}>
        <Share2 className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </button>
    </div>
  )
}

const FOKUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const TEXTLINK = 'rounded-md text-sm font-medium text-foreground/80 transition-colors hover:text-foreground'

/**
 * Liegt auf dem Foto, nicht auf der Seite: bleibt in beiden Modi eine weiße
 * Marke mit dunkelgrünem Symbol — wie die Knöpfe „Anpassen" im Titelbild
 * (farm-page-view.tsx), CODING_STANDARDS §7 „Was dem Modus NICHT folgt".
 * Der Schatten trägt ihn auch auf hellen Fotos, deren oberer Rand keinen
 * Schleier hat; der Fokusring ist dunkel mit weißem Abstand, damit er auf
 * dem weißen Knopf und auf hellem Himmel sichtbar bleibt.
 */
const RUND =
  'inline-flex size-11 items-center justify-center rounded-full bg-white/90 text-[#2D5F3F] shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5F3F] focus-visible:ring-offset-2 focus-visible:ring-offset-white'

/**
 * Das F-Icon — dasselbe Bild wie das App-Symbol auf dem Startbildschirm.
 * Behält seine Farben in beiden Modi (ein Logo, das je nach Einstellung
 * anders aussieht, ist kein Logo mehr); die dunkelgrüne Fläche trägt sich
 * auf hellem und dunklem Grund.
 */
function FIcon() {
  return (
    <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="size-8 shrink-0 rounded-lg" aria-hidden="true" />
  )
}

/**
 * Das Menü als Blatt von rechts. Escape, ein Tipp daneben und der Schließen-
 * Knopf schließen es; solange es offen ist, bleibt der Fokus darin und geht
 * danach zurück auf den Menü-Knopf (Base UI Dialog). Welche Seite gerade
 * offen ist, liest es erst beim Öffnen aus der Adresse — useSearchParams
 * verlangte auf den statischen Rechtsseiten eine Suspense-Grenze.
 */
function MenueBlatt({ tinte }: { tinte: string }) {
  const [offen, setOffen] = useState(false)
  const [punkte, setPunkte] = useState<AngezeigterMenuePunkt[]>([])

  function beimWechsel(jetztOffen: boolean) {
    if (jetztOffen) setPunkte(menuePunkte(window.location.pathname, window.location.search))
    setOffen(jetztOffen)
  }

  return (
    <Sheet open={offen} onOpenChange={beimWechsel}>
      <button
        type="button"
        onClick={() => beimWechsel(true)}
        aria-haspopup="dialog"
        aria-expanded={offen}
        aria-label="Menü öffnen"
        className={`inline-flex size-11 items-center justify-center rounded-full ${tinte} transition-colors hover:bg-muted ${FOKUS}`}
      >
        <Menu className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </button>
      <SheetContent side="right" showCloseButton={false} className="gap-0 p-0">
        <div className="flex h-14 items-center justify-between border-b border-border pl-5 pr-2">
          <SheetTitle className="text-base font-semibold">Menü</SheetTitle>
          <SheetClose
            aria-label="Menü schließen"
            className={`inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted ${FOKUS}`}
          >
            <X className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </SheetClose>
        </div>
        <nav aria-label="Menü" className="flex flex-col overflow-y-auto px-2 py-2">
          {punkte.map((punkt, i) => (
            <Link
              key={punkt.href}
              href={punkt.href}
              onClick={() => setOffen(false)}
              aria-current={punkt.aktuell ? 'page' : undefined}
              className={`flex min-h-12 items-center rounded-lg px-3 text-[15px] font-semibold transition-colors hover:bg-muted ${
                punkt.aktuell ? 'text-brand-text' : 'text-foreground'
              } ${i > 0 && punkt.gruppe !== punkte[i - 1].gruppe ? 'mt-2 border-t border-border pt-2' : ''} ${FOKUS}`}
            >
              {punkt.text}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Der Klick eines Rückwegs (Entscheidung: tippAufRueckweg): ein Schritt im
 * Verlauf zurück — mit Scrollposition und Filtern —, oder der Link folgt und
 * steigt damit hinauf; das merkt sich der RueckwegMerker, damit „Zurück" dort
 * nicht wieder hinunterführt. Neuer Tab und neues Fenster tut der Link selbst.
 */
function useRueckwegKlick(seite: KundenSeite, form: 'knopf' | 'zeile') {
  const router = useRouter()
  return function beimTipp(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const tipp = tippAufRueckweg(seite, eigenerVorgaengerJetzt(), form)
    if (tipp.aktion === 'verlauf') {
      e.preventDefault()
      router.back()
      return
    }
    merkeHinauf(tipp.ziel)
  }
}

/**
 * Zurück: immer ein echter Link (funktioniert ohne JavaScript und im neuen
 * Tab). Steht vor dieser Seite eine eigene, führt ein Tipp stattdessen einen
 * Schritt im Verlauf zurück.
 */
function ZurueckKnopf({ seite }: { seite: KundenSeite }) {
  // Beim Server-Rendern und ersten Anzeigen gilt der Link; ob der Verlauf
  // zählt, entscheidet erst der Tipp — sonst wiche das HTML vom Server ab.
  const ersatz = rueckweg(seite, false)
  const beimTipp = useRueckwegKlick(seite, 'knopf')

  return (
    <Link
      href={ersatz.href}
      onClick={beimTipp}
      aria-label="Zurück"
      className={`inline-flex size-11 items-center justify-center rounded-full ${seite.art === 'hofseite' ? 'text-app-ink' : 'text-foreground'} transition-colors hover:bg-muted ${FOKUS}`}
    >
      <ArrowLeft className="size-5" strokeWidth={1.7} aria-hidden="true" />
    </Link>
  )
}

/**
 * Browser: der Rückweg unter der Kopfzeile, wo sie selbst nicht zurückführt —
 * nach seinem Ziel benannt. Den Verlauf nimmt er nur, wenn der genau dorthin
 * führt (zeileNimmtVerlauf): Von der gefilterten Hofübersicht kommend geht
 * „‹ Alle Höfe" mit Filtern zurück, von der Startseite kommend zur Übersicht.
 */
function RueckwegZeile({ seite, hofName }: { seite: KundenSeite; hofName?: string }) {
  const href = rueckweg(seite, false).href
  const text = seite.art === 'hofseite' ? 'Alle Höfe' : (hofName ?? 'Zum Hof')
  const beimTipp = useRueckwegKlick(seite, 'zeile')
  return (
    <div className="hidden print:hidden md:block">
      <div className="mx-auto max-w-6xl px-6 pt-4">
        <Link
          href={href}
          onClick={beimTipp}
          className={`rounded-md text-sm font-medium text-brand-text underline-offset-4 hover:underline ${FOKUS}`}
        >
          ‹ {text}
        </Link>
      </div>
    </div>
  )
}

function WarenkorbSymbol({ anzahl, href }: { anzahl: number; href: string }) {
  const text = anzahl > 99 ? '99+' : String(anzahl)
  return (
    <Link
      href={href}
      aria-label={`Warenkorb: ${anzahl} Artikel — zum Hof`}
      className="relative inline-flex size-11 items-center justify-center rounded-full text-brand-text transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ShoppingCart className="size-5" strokeWidth={1.7} aria-hidden="true" />
      <span
        aria-hidden="true"
        className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold tabular-nums text-accent-foreground"
      >
        {text}
      </span>
    </Link>
  )
}

/**
 * Ob die Überschrift nach oben aus dem Blick gescrollt ist — per
 * IntersectionObserver, nicht per Scroll-Ereignis. Der obere Rand zählt um
 * die Leistenhöhe (56 px) weniger: Was unter der Leiste liegt, ist nicht zu
 * sehen. Nur „nach oben weg" zählt; eine Überschrift, die noch unter dem
 * Bildschirm liegt, ist nicht vorbei. Ohne Überschrift und beim
 * Server-Rendern: nicht weggescrollt.
 */
function useUeberschriftWeggescrollt(ueberschrift?: RefObject<HTMLElement | null>): boolean {
  const [weg, setWeg] = useState(false)
  useEffect(() => {
    const el = ueberschrift?.current
    if (!el) return
    const beobachter = new IntersectionObserver(
      ([eintrag]) => setWeg(!eintrag.isIntersecting && eintrag.boundingClientRect.top < 56),
      { rootMargin: '-56px 0px 0px 0px' }
    )
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [ueberschrift])
  return weg
}
