'use client'

import { useEffect, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { HERO_VIDEO_SCHLUESSEL, heroVideoSpielt } from '@/lib/startseite'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/*
 * Das Hintergrundvideo der Startseite mit Pause-Knopf (WCAG 2.2.2: Bewegung, die
 * länger als fünf Sekunden läuft, muss sich anhalten lassen). Es läuft nur, wenn
 * die Person es nicht angehalten hat und kein Datensparmodus an ist; bei
 * „Bewegung reduzieren" lädt es gar nicht erst (Quelle mit media-Bedingung, Knopf
 * unsichtbar). Das Standbild darunter steht immer — pausiert ist das Video ganz
 * weg, es lädt dann nichts nach.
 *
 * Bis die Wahl feststeht (erster Render auf dem Server), steht KEIN Video da: So
 * lädt im Datensparmodus nie ein Byte der 972 KB, bevor die Prüfung lief.
 */

/** Der Fokus auf dem Foto: weiß, denn das Grün des Fokusrings trägt am Tag auf dem dunklen Bild nicht. */
const FOKUS_AUF_FOTO = cn(FOKUS_RAHMEN, 'focus-visible:outline-white')

type Verbindung = { connection?: { saveData?: boolean } }

/** `anfang` stellt den Zustand für Tests (Server-Render) fest; im Browser entscheidet der Effekt. */
export function HeroVideo({ anfang = null }: { anfang?: boolean | null }): React.JSX.Element {
  const [spielt, setSpielt] = useState<boolean | null>(anfang)

  useEffect(() => {
    let gespeichert: string | null = null
    try {
      gespeichert = localStorage.getItem(HERO_VIDEO_SCHLUESSEL)
    } catch {
      // Gesperrter Speicher: Das Video läuft wie sonst, die Wahl gilt nur bis zum Neuladen.
    }
    const sparmodus = (navigator as Navigator & Verbindung).connection?.saveData === true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmal nach dem Lesen von Gerätespeicher und Datensparmodus, die der Server nicht kennt
    setSpielt(heroVideoSpielt({ gespeichert, sparmodus }))
  }, [])

  function umschalten(): void {
    const neu = spielt !== true
    setSpielt(neu)
    try {
      if (neu) localStorage.removeItem(HERO_VIDEO_SCHLUESSEL)
      else localStorage.setItem(HERO_VIDEO_SCHLUESSEL, 'pause')
    } catch {
      // Nicht gemerkt, aber angehalten: Die Wahl gilt für diese Seite.
    }
  }

  const pausiert = spielt === false
  const Symbol = pausiert ? Play : Pause

  return (
    <>
      {/* Stumm, in Schleife, reiner Hintergrund (aria-hidden). Zweimal dieselbe Bedingung: Die Klasse blendet das Element
          nur bei erlaubter Bewegung ein, die media-Bedingung an der Quelle entscheidet, ob das Video überhaupt geladen wird.
          Kein poster: Das Standbild darunter (next/image, verkleinert) zeigt sich durch, solange das Video noch kein Bild
          hat; ein poster lud dasselbe Foto ein zweites Mal im Original. */}
      {spielt === true && (
        <video
          className="absolute inset-0 -z-10 hidden h-full w-full object-cover motion-safe:block"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
        >
          <source media="(prefers-reduced-motion: no-preference)" src="/landing/hero-loop.mp4" type="video/mp4" />
        </video>
      )}
      {/* 44 px, Wahl in aria-pressed (Beschriftung bleibt gleich). Bei „Bewegung reduzieren" gibt es nichts anzuhalten. */}
      <button
        type="button"
        onClick={umschalten}
        aria-pressed={pausiert}
        aria-label="Hintergrundvideo anhalten"
        className={cn(
          'absolute right-4 bottom-2 z-10 hidden size-11 items-center justify-center rounded-full border border-white/70 bg-black/60 text-white transition-colors duration-[250ms] hover:bg-black/75 motion-safe:inline-flex md:right-6 md:bottom-6',
          FOKUS_AUF_FOTO
        )}
      >
        <Symbol className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </button>
    </>
  )
}
