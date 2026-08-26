'use client'

import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { List, Map as MapIcon } from 'lucide-react'
import { CATEGORY_OPTIONS } from '@/schemas/product'
import type { ProductCategoryValue } from '@/schemas/product'
import { filtereHoefe, formatiereAbholung } from '@/lib/hofuebersicht'
import {
  LEERE_LAGE,
  nachLeerTipp,
  nachPinTipp,
  nachZeiger,
  type AuswahlLage,
} from '@/lib/hoefe-anzeige'
import { hofInitialen } from '@/lib/hof-initialen'
import type { HofUebersichtEintrag } from '@/server/queries/farm'
import HoefeKarussell from '@/components/hoefe/hoefe-karussell'

// Nur clientseitig: Leaflet greift beim Import auf window zu (Muster wie die
// Profilkarte, profile-form.tsx). Die Karte wird zudem erst EINGEHÄNGT, wenn
// sie sichtbar sein soll — wer mobil nur die Liste liest, lädt keine Kacheln.
const HoefeKarte = dynamic(() => import('@/components/hoefe/hoefe-karte'), { ssr: false })

/** Ab lg zeigt die Seite den Splitscreen; darunter die Reiter aus #79. */
function useIstBreit(): boolean {
  return useSyncExternalStore(
    (melden) => {
      const abfrage = window.matchMedia('(min-width: 1024px)')
      abfrage.addEventListener('change', melden)
      return () => abfrage.removeEventListener('change', melden)
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    // Server rendert die schmale Gestalt — nach der Hydration springt der
    // Splitscreen ein; die schmale Gestalt ist auf breiten Schirmen kurz
    // sichtbar, aber vollständig bedienbar.
    () => false
  )
}

/**
 * Die öffentliche Hofübersicht. LISTE ZUERST; unterhalb lg ist die Karte der
 * zweite Reiter — als Vollflächen-Karte mit Hofkarten-Karussell am unteren
 * Rand. Ab lg entfällt der Umschalter: Liste links, Karte rechts dauerhaft
 * sichtbar (sticky), Pin und Eintrag heben einander wechselseitig hervor.
 *
 * EINE Quelle der Wahrheit: die AuswahlLage (src/lib/hoefe-anzeige.ts)
 * steuert Desktop-Hervorhebung, Karussell-Position und Pin-Stile. Ein Pin
 * navigiert niemals selbst — zur Hofseite führen nur Listeneintrag,
 * Karussell-Karte und „Zum Hof".
 */
export function HoefeClient({ hoefe }: { hoefe: HofUebersichtEintrag[] }) {
  const istBreit = useIstBreit()
  const [ansicht, setAnsicht] = useState<'liste' | 'karte'>('liste')
  const [gewaehlt, setGewaehlt] = useState<ProductCategoryValue[]>([])
  const [lage, setLage] = useState<AuswahlLage>(LEERE_LAGE)
  // Zählt jede Pin-Anfahrt, damit dieselbe Nummer zweimal hintereinander wirkt.
  const [fokus, setFokus] = useState(0)
  const eintraege = useRef(new Map<string, HTMLLIElement>())

  // Nur Kategorien anbieten, die es hier auch gibt — in Schema-Reihenfolge.
  const angebotene = useMemo(
    () => CATEGORY_OPTIONS.filter((o) => hoefe.some((h) => h.kategorien.includes(o.value))),
    [hoefe]
  )
  const gefiltert = useMemo(() => filtereHoefe(hoefe, gewaehlt), [hoefe, gewaehlt])
  const ohneKoordinaten = gefiltert.filter((h) => h.latitude == null || h.longitude == null).length
  /** Die Pin-Menge: gefilterte Höfe MIT Koordinaten, Nummern = Listenindex. */
  const mitPunkt = useMemo(
    () =>
      gefiltert
        .map((hof, index) => ({ hof, nummer: index + 1 }))
        .filter(({ hof }) => hof.latitude != null && hof.longitude != null),
    [gefiltert]
  )

  function kategorieUmschalten(wert: ProductCategoryValue) {
    setGewaehlt((bisher) =>
      bisher.includes(wert) ? bisher.filter((k) => k !== wert) : [...bisher, wert]
    )
  }

  /** Pin angetippt → Eintrag hervorheben und (Desktop/Liste) in den Blick rollen. */
  function pinGewaehlt(slug: string) {
    setLage((l) => nachPinTipp(l, slug))
    eintraege.current.get(slug)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  /** Nummer eines Eintrags angetippt → Pin hervorheben und anfahren. */
  function eintragGewaehlt(slug: string) {
    setLage((l) => nachPinTipp(l, slug))
    setFokus((f) => f + 1)
  }

  /** Karussell zentriert einen Hof → Auswahl folgt, Karte fliegt zum Pin. */
  function karussellZentriert(slug: string) {
    setLage((l) => nachPinTipp(l, slug))
    setFokus((f) => f + 1)
  }

  function leerGetippt() {
    setLage((l) => nachLeerTipp(l))
  }

  const umschalterKnopf = (wert: 'liste' | 'karte', beschriftung: string, Icon: typeof List) => (
    <button
      type="button"
      onClick={() => setAnsicht(wert)}
      aria-pressed={ansicht === wert}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition-colors ${
        ansicht === wert
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {beschriftung}
    </button>
  )

  const filterMarken = angebotene.length > 0 && (
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Nach Kategorien filtern">
      {angebotene.map((option) => {
        const aktiv = gewaehlt.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => kategorieUmschalten(option.value)}
            aria-pressed={aktiv}
            className={`min-h-9 rounded-full border px-3 text-[13px] font-medium transition-colors ${
              aktiv
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:bg-muted/40'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )

  const koordinatenHinweis = ohneKoordinaten > 0 && (
    // Höfe ohne Koordinaten erscheinen nie als Pin — nur die Liste führt
    // alle; die Karte sagt es ruhig dazu.
    <p className="mt-2 text-xs text-muted-foreground">
      {ohneKoordinaten === 1
        ? 'Ein Hof hat noch keinen Kartenpunkt — du findest ihn in der Liste.'
        : `${ohneKoordinaten} Höfe haben noch keinen Kartenpunkt — du findest sie in der Liste.`}
    </p>
  )

  /** Die nummerierte Hofliste — Desktop-Spalte und Listen-Reiter teilen sie.
   *  `nummernAktiv`: nur wenn die Karte sichtbar ist, steuert die Nummer den
   *  Pin an (Desktop-Split); sonst ist sie stille Ordnungszahl. */
  const liste = (nummernAktiv: boolean) =>
    gefiltert.length === 0 ? (
      <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
        Kein Hof führt gerade etwas aus dieser Auswahl — nimm einen Filter heraus.
      </p>
    ) : (
      <ol className="mt-4 space-y-3">
        {gefiltert.map((hof, index) => (
          <li
            key={hof.slug}
            ref={(el) => {
              if (el) eintraege.current.set(hof.slug, el)
              else eintraege.current.delete(hof.slug)
            }}
            onMouseEnter={() => setLage((l) => nachZeiger(l, hof.slug))}
            onMouseLeave={() => setLage((l) => nachZeiger(l, null))}
            // Tastatur-Pendant zum Zeiger: Fokus auf dem Eintrags-Link hebt
            // denselben Pin hervor.
            onFocus={() => setLage((l) => nachZeiger(l, hof.slug))}
            onBlur={() => setLage((l) => nachZeiger(l, null))}
            className={`relative rounded-2xl border bg-card p-4 transition-colors ${
              lage.ausgewaehlt === hof.slug ? 'border-primary' : 'border-border'
            }`}
            style={lage.ausgewaehlt === hof.slug ? { background: '#F7F4EC' } : undefined}
          >
            {/* Die GANZE Karte verlinkt auf die Hofseite (gestreckter Link);
                nur die Nummer liegt darüber und steuert den Pin an. */}
            <Link
              href={`/${hof.slug}`}
              aria-label={`${hof.name} ansehen`}
              className="absolute inset-0 rounded-2xl"
            />
            <div className="flex items-start gap-3">
              {nummernAktiv ? (
                <button
                  type="button"
                  onClick={() => eintragGewaehlt(hof.slug)}
                  aria-label={`${hof.name} auf der Karte zeigen`}
                  className="relative z-10 mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: '#E8F0E2', color: '#2D5F3F' }}
                >
                  {index + 1}
                </button>
              ) : (
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  style={{ background: '#E8F0E2', color: '#2D5F3F' }}
                >
                  {index + 1}
                </span>
              )}

              {hof.logoUrl ? (
                <Image
                  src={hof.logoUrl}
                  alt=""
                  width={48}
                  height={48}
                  className="size-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                /* Initialen statt kaputtem Bild-Symbol — dasselbe Muster wie
                   die Identitätskarte der Bauern-Navigation. */
                <span
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-full font-heading text-sm font-semibold"
                  style={{ background: '#F3EFE6', color: '#2D5F3F' }}
                >
                  {hofInitialen(hof.name)}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <h2 className="font-heading text-lg font-semibold leading-snug text-foreground">
                  {hof.name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {hof.postalCode} {hof.city}
                </p>

                {hof.kategorien.length > 0 && (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {hof.kategorien.map((k) => (
                      <span
                        key={k}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
                      >
                        {CATEGORY_OPTIONS.find((o) => o.value === k)?.label ?? k}
                      </span>
                    ))}
                  </p>
                )}

                {hof.naechsteAbholung && (
                  <p className="mt-2 text-sm text-foreground">
                    Nächste Abholung:{' '}
                    <span className="font-medium">{formatiereAbholung(hof.naechsteAbholung)}</span>
                  </p>
                )}

                {hof.isPaused && (
                  <p className="mt-2 text-sm" style={{ color: '#9A6B2F' }}>
                    Macht gerade Pause — schau bald wieder vorbei.
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    )

  const kartenHoefe = mitPunkt.map(({ hof, nummer }) => ({
    slug: hof.slug,
    nummer,
    lat: hof.latitude as number,
    lon: hof.longitude as number,
  }))

  if (istBreit) {
    // DESKTOP-SPLITSCREEN: Liste links, Karte rechts dauerhaft sichtbar —
    // diese Anordnung ist mit dem Betreiber entschieden, nicht spiegeln.
    // Der Koordinaten-Hinweis steht ÜBER der Karte: Unter einer Karte von
    // voller Viewporthöhe läge er dauerhaft außerhalb der Sichtkante.
    return (
      <div>
        {filterMarken}
        <div className="mt-1 grid grid-cols-2 items-start gap-6">
          <div>{liste(true)}</div>
          <div className="sticky top-4 mt-4 flex h-[calc(100vh-2rem)] flex-col">
            {koordinatenHinweis && <div className="mb-2">{koordinatenHinweis}</div>}
            <div className="min-h-0 flex-1">
              <HoefeKarte
                hoefe={kartenHoefe}
                lage={lage}
                fokus={fokus}
                hoeheKlasse="h-full"
                onAuswahl={pinGewaehlt}
                onLeerTipp={leerGetippt}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const karussellHoefe = mitPunkt.map(({ hof }) => hof)
  const auswahlMitPunkt =
    lage.ausgewaehlt !== null && karussellHoefe.some((h) => h.slug === lage.ausgewaehlt)

  return (
    <div>
      {/* Umschalter oben rechts; die Liste ist die Voreinstellung. */}
      <div className="mt-5 flex justify-end">
        <div className="inline-flex rounded-xl bg-muted p-1" role="group" aria-label="Ansicht wählen">
          {umschalterKnopf('liste', 'Liste', List)}
          {umschalterKnopf('karte', 'Karte', MapIcon)}
        </div>
      </div>

      {filterMarken}

      {ansicht === 'karte' ? (
        <div className="mt-4">
          {/* Vollflächen-Karte mit Karussell am unteren Rand. Leaflet fängt
              die Gesten in der Karte (kein Seiten-Scroll), das Karussell
              scrollt ausschließlich horizontal. `overflow-hidden` clippt das
              hinausgeglittene Karussell — sonst stünde es sichtbar UNTER der
              Karte und finge dort Tipps. */}
          <div className="relative overflow-hidden rounded-2xl">
            <HoefeKarte
              hoefe={kartenHoefe}
              lage={lage}
              fokus={fokus}
              sanft
              attributionOben
              hoeheKlasse="h-[60vh] min-h-[320px]"
              polsterUnten={176}
              onAuswahl={pinGewaehlt}
              onLeerTipp={leerGetippt}
            />
            {!auswahlMitPunkt && kartenHoefe.length > 0 && (
              <p
                className="pointer-events-none absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[900] mx-auto w-fit rounded-full bg-card/95 px-4 py-2 text-sm text-muted-foreground shadow-md"
                aria-hidden="true"
              >
                Tippe einen Hof an
              </p>
            )}
            <HoefeKarussell
              hoefe={karussellHoefe}
              ausgewaehlt={auswahlMitPunkt ? lage.ausgewaehlt : null}
              sichtbar={auswahlMitPunkt}
              onZentriert={karussellZentriert}
            />
          </div>
          {gefiltert.length === 0 && (
            // Auch der Karten-Reiter braucht die Filter-Leermeldung — eine
            // leere Karte ohne jedes Wort wäre keine Rückmeldung (#79-Regel).
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Kein Hof führt gerade etwas aus dieser Auswahl — nimm einen Filter heraus.
            </p>
          )}
          {koordinatenHinweis}
        </div>
      ) : (
        liste(false)
      )}
    </div>
  )
}
