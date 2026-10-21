'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { ProductCategoryValue } from '@/schemas/product'
import {
  formatiereEntfernung,
  waehleVorschauImBereich,
  type ImBereich,
  type MitEntfernung,
} from '@/lib/hofuebersicht'
import { hofseitenLink, istBestellbar } from '@/lib/bereiche-anzeige'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import { formatAbGrundpreis } from '@/lib/format'
import { HoefeProduktzeilen } from '@/components/hoefe/hoefe-produktzeilen'
import { HofBildflaeche } from '@/components/hoefe/hof-bildflaeche'
import { Abholzeile } from '@/components/hoefe/abholzeile'
import { BeitragMarke } from '@/components/hoefe/beitrag-marke'
import { hofIllustrationen, zentrierterIndex } from '@/lib/hoefe-anzeige'
import type { HofUebersichtEintrag } from '@/server/queries/farm'

/**
 * Das mobile Hofkarten-Karussell am unteren Kartenrand (nur Kartenmodus
 * unterhalb lg). Reines Scroll-Snap, KEIN Karussell-Paket: horizontales
 * Scrollen mit einer Karte je Rastpunkt; die Snap-Erkennung (welche Karte
 * ist zentriert?) ist die reine Funktion zentrierterIndex.
 *
 * ZENTRIER-MATHEMATIK: Das Zentrier-Polster ist calc(50% − halbe
 * Kartenbreite) — Prozent VOM SCROLLER, nicht vom Viewport (50vw wäre bei
 * gedeckelter Spaltenbreite um bis zu SCHRITT/2 daneben und ließe die
 * falsche Karte einrasten). Damit liegen die Rastpunkte für JEDE Breite
 * exakt auf n·SCHRITT, und scrollLeft ↔ Index rechnen verlustfrei um.
 *
 * Es erscheinen NUR Höfe MIT Koordinaten (die Pin-Menge, in Pin-Reihenfolge)
 * — Höfe ohne bleiben Listen-only wie in #79. Ohne Auswahl ist das Karussell
 * hinausgeglitten (der Eltern-Wrapper clippt es, zusätzlich fängt es dann
 * keine Zeiger-Eingaben); ein Pin-Tipp holt es samt passender Karte herein.
 *
 * Seit Nr. 120 nach dem Board system-k1-entdecken-v2 (Register N22): etwa
 * 346 px breit, rundes Bild 40 px (erstes Foto, sonst die Illustration der
 * ersten Kategorie — keine Initialen), zwei Produktzeilen, die Abholzeile wie
 * in der Liste, keine Kategorie-Chips. Im Handy-Hochformat (390 px) bleiben
 * links und rechts 22 px — die Nachbarkarten blitzen hervor.
 */

const KARTEN_BREITE = 346
const KARTEN_ABSTAND = 12
const SCHRITT = KARTEN_BREITE + KARTEN_ABSTAND

export default function HoefeKarussell({
  hoefe,
  ausgewaehlt,
  sichtbar,
  bereich,
  gewaehlteKategorien = [],
  suchbegriffe = [],
  onZentriert,
  bandRef,
  jetzt,
}: {
  /** Nur Höfe mit Koordinaten, in Pin-Reihenfolge. */
  hoefe: MitEntfernung<ImBereich<HofUebersichtEintrag>>[]
  ausgewaehlt: string | null
  sichtbar: boolean
  /** Der gewählte Bereich — Vorschau und Hof-Link folgen ihm wie auf der Hofkarte. */
  bereich: AnzeigeBereich
  /** Der gesetzte Kategoriefilter — die Produktvorschau folgt ihm hier
   *  genauso wie auf der Hofkarte. */
  gewaehlteKategorien?: ProductCategoryValue[]
  /** Aktive Suchbegriffe — Treffer stehen im Schaufenster zuerst, wie auf
   *  der Hofkarte. */
  suchbegriffe?: string[]
  /** Nach dem Snappen: dieser Hof ist jetzt zentriert. */
  onZentriert: (slug: string) => void
  /** Lässt den Aufrufer die HÖHE des Bandes messen — solange ein Hof gewählt
   *  ist, landet sein Pin darüber, und die Übersicht hält Platz dafür frei
   *  (polsterUnten in hoefe-karte.tsx). */
  bandRef?: (el: HTMLDivElement | null) => void
  /** Der Zeitpunkt des Servers beim Bauen der Seite (ISO-Text) — für die Abholzeile. */
  jetzt: string
}) {
  const band = useRef<HTMLDivElement>(null)
  const ruhe = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zentriertRef = useRef(onZentriert)
  const ausgewaehltRef = useRef(ausgewaehlt)
  useEffect(() => {
    zentriertRef.current = onZentriert
    ausgewaehltRef.current = ausgewaehlt
  })

  // Kein Geister-Timer nach dem Abbau: Wer wischt und sofort den Reiter
  // wechselt, darf keine nachträgliche Auswahl mehr auslösen.
  useEffect(() => {
    return () => {
      if (ruhe.current) clearTimeout(ruhe.current)
    }
  }, [])

  // Auswahl von außen (Pin-Tipp) ODER veränderte Hof-Menge (Filterwechsel):
  // zur passenden Karte fahren, damit Karussell-Mitte und Pin nie
  // auseinanderlaufen.
  const signatur = hoefe.map((h) => h.slug).join(',')
  useEffect(() => {
    const leiste = band.current
    if (!leiste || !ausgewaehlt) return
    const index = hoefe.findIndex((h) => h.slug === ausgewaehlt)
    if (index < 0) return
    if (zentrierterIndex(leiste.scrollLeft, SCHRITT, hoefe.length) === index) return
    leiste.scrollTo({ left: index * SCHRITT, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ausgewaehlt, sichtbar, signatur])

  // BEWUSST OHNE „programmatisch"-Stummschaltung: Die Ruheposition zählt
  // IMMER — auch wer eine laufende Anfahrt mit dem Finger unterbricht,
  // bekommt die Karte gemeldet, auf der er wirklich landet. Eine unnötige
  // Meldung der eigenen Anfahrt verhindert der Slug-Vergleich (die Anfahrt
  // endet per Definition auf der schon gewählten Karte).
  function beimScrollen() {
    const leiste = band.current
    if (!leiste) return
    if (ruhe.current) clearTimeout(ruhe.current)
    ruhe.current = setTimeout(() => {
      const index = zentrierterIndex(leiste.scrollLeft, SCHRITT, hoefe.length)
      const hof = hoefe[index]
      if (hof && hof.slug !== ausgewaehltRef.current) zentriertRef.current(hof.slug)
    }, 140)
  }

  if (hoefe.length === 0) return null

  return (
    <div
      ref={bandRef}
      className={`absolute inset-x-0 bottom-0 z-[900] transition-transform duration-300 ${
        sichtbar ? 'translate-y-0' : 'pointer-events-none translate-y-full'
      }`}
      aria-hidden={!sichtbar}
    >
      <div
        ref={band}
        onScroll={beimScrollen}
        // Unten: unter md frei vom erhobenen Warenkorb-Knopf der Unterleiste
        // (--kunde-ueberstand aus der KundeShell, Nr. 52); ab md endet die Karte
        // am Fensterrand, dort zählt der Home-Indicator.
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[calc(50%-173px)] pt-2 pb-[calc(var(--kunde-ueberstand)+0.5rem)] [scrollbar-width:none] md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {hoefe.map((hof) => (
          <article
            key={hof.slug}
            className="relative w-[346px] shrink-0 snap-center rounded-2xl border border-border bg-card p-3 shadow-lg"
          >
            {/* Tipp auf die Karte selbst → Hofseite (gestreckter Link);
                „Zum Hof" darunter ist derselbe Weg, nur ausgeschrieben. */}
            <Link
              href={hofseitenLink(hof.slug, bereich)}
              aria-label={`${hof.name} ansehen`}
              // Die Marke „Neu · vor …“ (Nr. 129): ihr Satz für den Screenreader am Link der Karte.
              aria-describedby={hof.neuerBeitrag ? `beitrag-marke-karussell-${hof.slug}` : undefined}
              // Der Link liegt über dem gekappten Namen und fängt den Zeiger —
              // er trägt deshalb den vollen Namen als title.
              title={hof.name}
              tabIndex={sichtbar ? 0 : -1}
              className="absolute inset-0 rounded-2xl"
            />
            <div className="flex items-center gap-2.5">
              {/* NUR das erste Foto als stilles, rundes Vorschaubild (40 px, Board) — kein
                  Karussell im Karussell; ohne Foto die Illustration der ersten Kategorie. */}
              {hof.fotos.length > 0 ? (
                <Image src={hof.fotos[0]} alt="" width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" />
              ) : (
                <HofBildflaeche
                  bilder={hofIllustrationen(hof.kategorien).slice(0, 1)}
                  sizes="40px"
                  fuellen
                  className="size-10 shrink-0 rounded-full"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-base font-semibold text-foreground">
                  {hof.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {hof.postalCode} {hof.city}
                  {/* Auch hier die Entfernung, sobald es einen Bezugspunkt
                      gibt — wer mobil die Karte nutzt, sieht sonst nie eine. */}
                  {hof.entfernungKm != null && (
                    <span className="ml-1.5 font-medium text-brand-text">
                      {formatiereEntfernung(hof.entfernungKm)}
                    </span>
                  )}
                </p>
              </div>
              {/* Am runden Bild in derselben Zeile — keine zweite Zeile, durchlässig für den Zeiger. */}
              <BeitragMarke beitrag={hof.neuerBeitrag} jetzt={jetzt} beschreibungId={`beitrag-marke-karussell-${hof.slug}`} kompakt className="shrink-0" />
            </div>

            {hof.abGrundpreis && (
              <p className="mt-1.5 text-xs font-semibold text-brand-text">
                {formatAbGrundpreis(hof.abGrundpreis)}
              </p>
            )}

            {/* DIESELBE Komponente wie auf der Hofkarte, mit denselben 48er
                Bildern — nur ZWEI Zeilen statt drei und OHNE die
                „+ n weitere"-Zeile: Diese Karte liegt über der Landkarte und
                darf um höchstens zwei Zeilen wachsen (gemessen: 110 px = 2 ×
                (48 + 6)). Die Restzahl steht auf der Hofkarte der Liste, wo
                Platz dafür ist; hier fräße sie eine dritte Zeile. Niedrige
                Fenster (Handy quer, Nr. 52): ohne Produktzeilen — sonst wäre
                die Karte höher als die Landkarte darunter. */}
            <div className="[@media(max-height:500px)]:hidden">
              {(() => {
                const vorschau = waehleVorschauImBereich(hof, bereich, gewaehlteKategorien, 2, suchbegriffe)
                return <HoefeProduktzeilen produkte={vorschau.produkte} weitere={0} />
              })()}
            </div>

            {/* Dieselbe Abholzeile wie in der Liste und in der Pin-Vorschau (Register N22). */}
            <Abholzeile
              fenster={hof.abholfenster}
              isPaused={hof.isPaused}
              bestellbar={istBestellbar(hof)}
              jetzt={jetzt}
              className="mt-1.5"
            />

            <p className="mt-2">
              {/* Kundenaktion = Grün (DESIGN_SYSTEM, „Farbrollen"); im neuen Design wäre primary Orange. */}
              <span className="pointer-events-none inline-flex min-h-9 items-center rounded-full bg-accent px-3.5 text-xs font-semibold text-accent-foreground">
                Zum Hof
              </span>
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
