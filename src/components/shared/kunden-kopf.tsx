'use client'

import { useEffect, useState, type MouseEvent, type RefObject } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Share2, ShoppingCart } from 'lucide-react'
import { kopfForm, rueckweg, zeileNimmtVerlauf, type KundenSeite } from '@/lib/kunden-kopf'
import { useWarenkorbKopf } from '@/lib/use-warenkorb-kopf'
import { eigenerVorgaengerJetzt, merkeHinauf } from '@/components/shared/rueckweg-merker'
import { Wortmarke } from '@/components/shared/wortmarke'

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
 * Was sie zeigt und wohin „Zurück" führt, entscheidet src/lib/kunden-kopf.ts.
 *
 * HANDY (unter md): eine schmale Leiste, 56 px — Zurück, Seitentitel, rechts
 * der Warenkorb. Auf der Hofseite steht sie erst, wenn das Titelbild aus dem
 * Blick ist; bis dahin tragen zwei runde Knöpfe über dem Bild (TitelbildKnoepfe)
 * Zurück und Teilen. Vorbild: foodpanda, Deliveroo, Careem. Dort ist die
 * Leiste `fixed` und wird erst eingehängt, wenn das Bild verschwindet — als
 * `sticky` nähme sie beim Erscheinen 56 px im Fluss ein, und der Inhalt spränge.
 *
 * BROWSER (ab md): eine Kopfzeile, 64 px — FarmerZone, Höfe entdecken, Für
 * Höfe, Hofbetreiber-Login, Warenkorb. Wo sie selbst nicht zurückführt
 * (Hofseite, Bestellweg), steht darunter ein Rückweg-Link.
 *
 * Sonst kleben beide (`sticky`) statt fest zu stehen: Das Umgebungsbanner der
 * Testumgebung liegt im Fluss darüber und läge sonst beim Laden über ihr.
 * Ebene 40: über der Sektionsleiste der Hofseite (30), unter Sheets,
 * Dialogen und der Lightbox (50).
 */
export function KundenKopf({
  seite,
  titel,
  hofName,
  titelbild,
}: {
  seite: KundenSeite
  /** Handy: der Titel in der Mitte der Leiste — Hofname oder Seitentitel. */
  titel: string
  /** Bestellweg: für den Rückweg-Link im Browser („‹ {Hofname}"). */
  hofName?: string
  /** Hofseite mit Titelbild: solange es im Blick ist, steht am Handy keine Leiste. */
  titelbild?: RefObject<HTMLElement | null>
}) {
  const form = kopfForm(seite)
  const korb = useWarenkorbKopf()
  const titelbildImBlick = useTitelbildImBlick(titelbild)

  // Ein fester Platz für das Symbol, auch solange noch keins da ist (beim
  // Server-Rendern gibt es keinen Korb) — sonst sprängen Titel und Links,
  // sobald es erscheint.
  const warenkorbPlatz =
    form.warenkorb && korb ? (
      <WarenkorbSymbol anzahl={korb.anzahl} href={korb.href} />
    ) : (
      <span className="size-11" aria-hidden="true" />
    )

  const leiste = (
    <div className="grid h-14 grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2 border-b border-border bg-card px-2">
      <ZurueckKnopf seite={seite} />
      {/* Auf der Hofseite die Schrift der Hofseite (app-*), sonst zwei Dunkeltöne übereinander. */}
      <p
        className={`truncate text-center text-[15px] font-semibold ${seite.art === 'hofseite' ? 'text-app-ink' : 'text-foreground'}`}
      >
        {titel}
      </p>
      {warenkorbPlatz}
    </div>
  )

  return (
    <>
      {/* ── Handy ── */}
      {titelbild ? (
        // Hofseite mit Titelbild: die Leiste erscheint, sobald das Bild aus
        // dem Blick ist. Kein Einblenden bei reduzierter Bewegung.
        !titelbildImBlick && (
          <div className="fixed inset-x-0 top-0 z-40 print:hidden md:hidden motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            {leiste}
          </div>
        )
      ) : (
        <div className="sticky top-0 z-40 print:hidden md:hidden">{leiste}</div>
      )}

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
 * Die zwei runden Knöpfe über dem Titelbild der Hofseite (Handy): links
 * Zurück, rechts Teilen. Gehört in den Behälter des Titelbilds (relative).
 */
export function TitelbildKnoepfe({ seite, onTeilen }: { seite: KundenSeite; onTeilen: () => void }) {
  return (
    <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between md:hidden">
      <ZurueckKnopf seite={seite} rund />
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
 * Der Klick eines Rückwegs: Führt der Verlauf dorthin (`nimmtVerlauf`), ein
 * Schritt zurück — mit Scrollposition und Filtern. Sonst folgt der Link und
 * steigt damit hinauf; das merkt sich der RueckwegMerker, damit „Zurück" dort
 * nicht wieder hinunterführt. Neuer Tab und neues Fenster tut der Link selbst.
 */
function useRueckwegKlick(nimmtVerlauf: (vorgaengerPfad: string | null) => boolean) {
  const router = useRouter()
  return function beimTipp(e: MouseEvent<HTMLAnchorElement>) {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (nimmtVerlauf(eigenerVorgaengerJetzt())) {
      e.preventDefault()
      router.back()
      return
    }
    merkeHinauf()
  }
}

/**
 * Zurück: immer ein echter Link (funktioniert ohne JavaScript und im neuen
 * Tab). Steht vor dieser Seite eine eigene, führt ein Tipp stattdessen einen
 * Schritt im Verlauf zurück.
 */
function ZurueckKnopf({ seite, rund = false }: { seite: KundenSeite; rund?: boolean }) {
  // Beim Server-Rendern und ersten Anzeigen gilt der Link; ob der Verlauf
  // zählt, entscheidet erst der Tipp — sonst wiche das HTML vom Server ab.
  const ersatz = rueckweg(seite, false)
  const beimTipp = useRueckwegKlick((vorgaenger) => rueckweg(seite, vorgaenger !== null).verlauf)

  return (
    <Link
      href={ersatz.href}
      onClick={beimTipp}
      aria-label="Zurück"
      className={
        rund
          ? RUND
          : `inline-flex size-11 items-center justify-center rounded-full ${seite.art === 'hofseite' ? 'text-app-ink' : 'text-foreground'} transition-colors hover:bg-muted ${FOKUS}`
      }
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
  const beimTipp = useRueckwegKlick((vorgaenger) => zeileNimmtVerlauf(seite, vorgaenger))
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
 * Ob das Titelbild im Blick ist — per IntersectionObserver, nicht per
 * Scroll-Ereignis. Der obere Rand zählt um die Leistenhöhe (56 px) weniger:
 * Die Leiste steht, bevor die Sektionsleiste (top-14) an ihr andockt.
 * Ohne Titelbild und beim Server-Rendern: im Blick (keine Leiste über dem Bild).
 */
function useTitelbildImBlick(titelbild?: RefObject<HTMLElement | null>): boolean {
  const [imBlick, setImBlick] = useState(true)
  useEffect(() => {
    const el = titelbild?.current
    if (!el) return
    const beobachter = new IntersectionObserver(([eintrag]) => setImBlick(eintrag.isIntersecting), {
      rootMargin: '-56px 0px 0px 0px',
    })
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [titelbild])
  return imBlick
}
