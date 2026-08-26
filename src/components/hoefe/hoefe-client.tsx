'use client'

import { useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { List, Map as MapIcon } from 'lucide-react'
import { CATEGORY_OPTIONS } from '@/schemas/product'
import type { ProductCategoryValue } from '@/schemas/product'
import { filtereHoefe, formatiereAbholung } from '@/lib/hofuebersicht'
import { hofInitialen } from '@/lib/hof-initialen'
import type { HofUebersichtEintrag } from '@/server/queries/farm'

// Nur clientseitig: Leaflet greift beim Import auf window zu (Muster wie die
// Profilkarte, profile-form.tsx). Die Karte wird zudem erst EINGEHÄNGT, wenn
// der Karten-Reiter offen ist — wer nur die Liste liest, lädt keine Kacheln.
const HoefeKarte = dynamic(() => import('@/components/hoefe/hoefe-karte'), { ssr: false })

/**
 * Die öffentliche Hofübersicht: LISTE ZUERST, die Karte ist ein gleichwertiger
 * zweiter Reiter auf denselben Daten. Im Karten-Reiter steht dieselbe
 * nummerierte Liste UNTER der Karte — nur so trägt das Wechselspiel: Ein Pin
 * hebt seinen Listeneintrag hervor, die Nummer eines Eintrags fährt die Karte
 * auf seinen Pin. Der Kategorie-Filter wirkt auf beide Ansichten, rein
 * clientseitig auf den geladenen Daten.
 */
export function HoefeClient({ hoefe }: { hoefe: HofUebersichtEintrag[] }) {
  const [ansicht, setAnsicht] = useState<'liste' | 'karte'>('liste')
  const [gewaehlt, setGewaehlt] = useState<ProductCategoryValue[]>([])
  const [ausgewaehlt, setAusgewaehlt] = useState<string | null>(null)
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

  function kategorieUmschalten(wert: ProductCategoryValue) {
    setGewaehlt((bisher) =>
      bisher.includes(wert) ? bisher.filter((k) => k !== wert) : [...bisher, wert]
    )
  }

  /** Pin angetippt → Eintrag hervorheben und in den Blick rollen. */
  function pinGewaehlt(slug: string) {
    setAusgewaehlt(slug)
    eintraege.current.get(slug)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  /** Nummer eines Eintrags angetippt → Pin hervorheben und anfahren. */
  function eintragGewaehlt(slug: string) {
    setAusgewaehlt(slug)
    setFokus((f) => f + 1)
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

  return (
    <div>
      {/* Umschalter oben rechts; die Liste ist die Voreinstellung. */}
      <div className="mt-5 flex justify-end">
        <div className="inline-flex rounded-xl bg-muted p-1" role="group" aria-label="Ansicht wählen">
          {umschalterKnopf('liste', 'Liste', List)}
          {umschalterKnopf('karte', 'Karte', MapIcon)}
        </div>
      </div>

      {/* Kategorie-Textmarken: Mehrfachauswahl, wirkt auf Liste UND Karte. */}
      {angebotene.length > 0 && (
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
      )}

      {ansicht === 'karte' && (
        <div className="mt-4">
          <HoefeKarte
            hoefe={gefiltert
              .map((hof, index) => ({ hof, nummer: index + 1 }))
              .filter(({ hof }) => hof.latitude != null && hof.longitude != null)
              .map(({ hof, nummer }) => ({
                slug: hof.slug,
                nummer,
                lat: hof.latitude as number,
                lon: hof.longitude as number,
              }))}
            ausgewaehlt={ausgewaehlt}
            fokus={fokus}
            onAuswahl={pinGewaehlt}
          />
          {ohneKoordinaten > 0 && (
            // Höfe ohne Koordinaten erscheinen nie als Pin — nur die Liste
            // führt alle; die Karte sagt es ruhig dazu.
            <p className="mt-2 text-xs text-muted-foreground">
              {ohneKoordinaten === 1
                ? 'Ein Hof hat noch keinen Kartenpunkt — du findest ihn in der Liste darunter.'
                : `${ohneKoordinaten} Höfe haben noch keinen Kartenpunkt — du findest sie in der Liste darunter.`}
            </p>
          )}
        </div>
      )}

      {gefiltert.length === 0 ? (
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
              className={`relative rounded-2xl border bg-card p-4 transition-shadow ${
                ausgewaehlt === hof.slug ? 'border-primary ring-2 ring-primary/30' : 'border-border'
              }`}
            >
              {/* Die GANZE Karte verlinkt auf die Hofseite (gestreckter Link);
                  nur die Nummer liegt darüber und steuert im Karten-Reiter
                  den Pin an. */}
              <Link
                href={`/${hof.slug}`}
                aria-label={`${hof.name} ansehen`}
                className="absolute inset-0 rounded-2xl"
              />
              <div className="flex items-start gap-3">
                {ansicht === 'karte' ? (
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
      )}
    </div>
  )
}
