'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CATEGORY_OPTIONS, type ProductCategoryValue } from '@/schemas/product'
import {
  formatiereAbholung,
  formatiereEntfernung,
  waehleVorschauProdukte,
  type MitEntfernung,
} from '@/lib/hofuebersicht'
import { HoefeProduktzeilen } from '@/components/hoefe/hoefe-produktzeilen'
import { zentrierterIndex } from '@/lib/hoefe-anzeige'
import { hofInitialen } from '@/lib/hof-initialen'
import type { HofUebersichtEintrag } from '@/server/queries/farm'

/**
 * Das mobile Hofkarten-Karussell am unteren Kartenrand (nur Karten-Reiter
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
 */

const KARTEN_BREITE = 260
const KARTEN_ABSTAND = 12
const SCHRITT = KARTEN_BREITE + KARTEN_ABSTAND

export default function HoefeKarussell({
  hoefe,
  ausgewaehlt,
  sichtbar,
  gewaehlteKategorien = [],
  onZentriert,
  bandRef,
}: {
  /** Nur Höfe mit Koordinaten, in Pin-Reihenfolge. */
  hoefe: MitEntfernung<HofUebersichtEintrag>[]
  ausgewaehlt: string | null
  sichtbar: boolean
  /** Der gesetzte Kategoriefilter — die Produktvorschau folgt ihm hier
   *  genauso wie auf der Hofkarte. */
  gewaehlteKategorien?: ProductCategoryValue[]
  /** Nach dem Snappen: dieser Hof ist jetzt zentriert. */
  onZentriert: (slug: string) => void
  /** Lässt den Aufrufer die HÖHE des Bandes messen — die Karte hält ihre
   *  Pins darüber frei (fitBounds-Polster in hoefe-client.tsx). */
  bandRef?: (el: HTMLDivElement | null) => void
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
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-[calc(50%-130px)] pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 [scrollbar-width:none]"
      >
        {hoefe.map((hof) => (
          <article
            key={hof.slug}
            className="relative w-[260px] shrink-0 snap-center rounded-2xl border border-border bg-card p-3 shadow-lg"
          >
            {/* Tipp auf die Karte selbst → Hofseite (gestreckter Link);
                „Zum Hof" darunter ist derselbe Weg, nur ausgeschrieben. */}
            <Link
              href={`/${hof.slug}`}
              aria-label={`${hof.name} ansehen`}
              tabIndex={sichtbar ? 0 : -1}
              className="absolute inset-0 rounded-2xl"
            />
            <div className="flex items-center gap-2.5">
              {/* NUR das erste Foto als stilles Vorschaubild — kein Karussell
                  im Karussell; ohne Fotos wie bisher Logo bzw. Initialen. */}
              {hof.fotos.length > 0 ? (
                <Image
                  src={hof.fotos[0]}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-lg object-cover"
                />
              ) : hof.logoUrl ? (
                <Image
                  src={hof.logoUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full font-heading text-xs font-semibold"
                  style={{ background: '#F3EFE6', color: '#2D5F3F' }}
                >
                  {hofInitialen(hof.name)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate font-heading text-base font-semibold text-foreground">
                  {hof.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {hof.postalCode} {hof.city}
                  {/* Auch hier die Entfernung, sobald es einen Bezugspunkt
                      gibt — wer mobil die Karte nutzt, sieht sonst nie eine. */}
                  {hof.entfernungKm != null && (
                    <span className="ml-1.5 font-medium" style={{ color: '#2D5F3F' }}>
                      {formatiereEntfernung(hof.entfernungKm)}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {hof.kategorien.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-1">
                {hof.kategorien.slice(0, 3).map((k) => (
                  <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
                    {CATEGORY_OPTIONS.find((o) => o.value === k)?.label ?? k}
                  </span>
                ))}
              </p>
            )}

            {/* DIESELBE Komponente wie auf der Hofkarte, mit denselben 48er
                Bildern — nur ZWEI Zeilen statt drei und OHNE die
                „+ n weitere"-Zeile: Diese Karte liegt über der Landkarte und
                darf um höchstens zwei Zeilen wachsen (gemessen: 110 px = 2 ×
                (48 + 6)). Die Restzahl steht auf der Hofkarte der Liste, wo
                Platz dafür ist; hier fräße sie eine dritte Zeile. */}
            {(() => {
              const vorschau = waehleVorschauProdukte(
                hof.produkte,
                gewaehlteKategorien,
                hof.produkteGesamt,
                2
              )
              return <HoefeProduktzeilen produkte={vorschau.produkte} weitere={0} />
            })()}

            {hof.naechsteAbholung && (
              <p className="mt-1.5 truncate text-xs text-foreground">
                Abholung: <span className="font-medium">{formatiereAbholung(hof.naechsteAbholung)}</span>
              </p>
            )}
            {hof.isPaused && (
              <p className="mt-1.5 text-xs" style={{ color: '#9A6B2F' }}>
                Macht gerade Pause
              </p>
            )}

            <p className="mt-2">
              <span className="pointer-events-none inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">
                Zum Hof
              </span>
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
