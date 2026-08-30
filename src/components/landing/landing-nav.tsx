'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

/**
 * Die klebende Navigationsleiste der Startseite.
 *
 * Sie bleibt am oberen Rand stehen und legt sich erst beim Scrollen sichtbar
 * über den Inhalt: leichte Sand-Deckung, feine Trennlinie, Weichzeichner —
 * keine harte Kante beim ersten Blick. Die Höhe ist konstant, damit unter ihr
 * nichts springt (die Sprungmarken tragen dafür scroll-mt, siehe page.tsx).
 *
 * KEIN ORANGE: Der eine Akzent der Seite gehört dem CTA-Band; hier führt der
 * Login als ruhige Umriss-Schaltfläche.
 *
 * Unter md liegen die Punkte in einem Panel UNTER der Leiste — bewusst kein
 * Überlagern der ganzen Seite: Wer das Menü öffnet, verliert den Inhalt
 * nicht aus dem Blick. Geschlossen wird per erneutem Tipp, Escape, Tipp
 * außerhalb und nach jeder Auswahl; der Fokus wandert beim Öffnen ins Panel
 * und beim Schließen zurück auf die Schaltfläche.
 *
 * Nur die Startseite trägt diese Leiste — Hofseiten, Rechtsseiten und der
 * eingeloggte Bereich behalten ihre eigenen Köpfe.
 */

const PUNKTE = [
  { href: '/hoefe', text: 'Höfe ansehen' },
  { href: '/konditionen', text: 'Konditionen' },
  // Sprungmarke auf den bestehenden Abschnitt der Startseite (id="weiter").
  { href: '/#weiter', text: 'Für Höfe' },
]

export function LandingNav() {
  const [gescrollt, setGescrollt] = useState(false)
  const [offen, setOffen] = useState(false)
  const schalter = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const leiste = useRef<HTMLElement>(null)

  useEffect(() => {
    const beimScrollen = () => setGescrollt(window.scrollY > 8)
    beimScrollen()
    window.addEventListener('scroll', beimScrollen, { passive: true })
    return () => window.removeEventListener('scroll', beimScrollen)
  }, [])

  // Escape schließt, ein Tipp außerhalb der Leiste ebenso.
  useEffect(() => {
    if (!offen) return
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen()
    }
    const beiZeiger = (e: PointerEvent) => {
      if (leiste.current?.contains(e.target as Node)) return
      // Fokus zurückholen, wenn er im Panel stand — sonst fiele er beim
      // Schließen auf den Seitenanfang.
      if (panel.current?.contains(document.activeElement)) schliessen()
      else setOffen(false)
    }
    document.addEventListener('keydown', beiTaste)
    document.addEventListener('pointerdown', beiZeiger)
    return () => {
      document.removeEventListener('keydown', beiTaste)
      document.removeEventListener('pointerdown', beiZeiger)
    }
  }, [offen])

  // Beim Öffnen wandert der Fokus in das Panel — sonst stünde er weiter auf
  // der Schaltfläche und die Tastatur liefe an den neuen Punkten vorbei.
  useEffect(() => {
    if (offen) panel.current?.querySelector('a')?.focus()
  }, [offen])

  // Wird das Fenster breit, verschwindet das Panel per CSS — der Zustand muss
  // mit, sonst bliebe die Sand-Deckung ganz oben hängen.
  useEffect(() => {
    const breit = window.matchMedia('(min-width: 768px)')
    const beiWechsel = () => {
      if (breit.matches) setOffen(false)
    }
    beiWechsel()
    breit.addEventListener('change', beiWechsel)
    return () => breit.removeEventListener('change', beiWechsel)
  }, [])

  function schliessen() {
    setOffen(false)
    schalter.current?.focus()
  }

  return (
    <header
      ref={leiste}
      className="sticky top-0 z-50 transition-colors duration-200"
      style={
        gescrollt || offen
          ? {
              background: 'rgba(244, 239, 230, 0.85)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderBottom: '1px solid rgba(45, 95, 63, 0.12)',
            }
          : { borderBottom: '1px solid transparent' }
      }
    >
      <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <svg width="32" height="32" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="40" cy="40" r="40" fill="#E8F0E8" />
            <path
              d="M40 64 C40 64 22 53 22 35 C22 24 30 16 40 16 C50 16 58 24 58 35 C58 53 40 64 40 64Z"
              fill="#2D5F3F"
            />
            <path d="M40 64 L40 44" stroke="#7BAE85" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="font-heading text-lg font-bold whitespace-nowrap" style={{ color: '#2D5F3F' }}>
            FarmerZone
          </span>
        </Link>

        {/* Ab md: alle Punkte offen neben dem Logo. */}
        <nav aria-label="Hauptnavigation" className="hidden md:flex md:flex-1 md:items-center md:gap-6 md:pl-8">
          {PUNKTE.map((punkt) => (
            <Link
              key={punkt.href}
              href={punkt.href}
              className="whitespace-nowrap text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: '#2D5F3F' }}
            >
              {punkt.text}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Unter md bleibt der Kunden-Einstieg sichtbar, alles Weitere
              steckt im Menü. */}
          <Link
            href="/hoefe"
            className="whitespace-nowrap text-[13px] font-semibold transition-opacity hover:opacity-80 md:hidden"
            style={{ color: '#2D5F3F' }}
          >
            Höfe ansehen
          </Link>
          <Link
            href="/login"
            className="hidden whitespace-nowrap rounded-lg border px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-white md:inline-flex"
            style={{ borderColor: '#D6E0CE', color: '#2D5F3F', background: 'rgba(255,255,255,0.6)' }}
          >
            Hofbetreiber-Login
          </Link>
          <button
            ref={schalter}
            type="button"
            onClick={() => (offen ? schliessen() : setOffen(true))}
            aria-expanded={offen}
            aria-controls="startseiten-menue"
            aria-label={offen ? 'Menü schließen' : 'Menü öffnen'}
            className="inline-flex size-10 items-center justify-center rounded-lg border transition-colors hover:bg-white md:hidden"
            style={{ borderColor: '#D6E0CE', color: '#2D5F3F', background: 'rgba(255,255,255,0.6)' }}
          >
            {offen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {offen && (
        <div
          id="startseiten-menue"
          ref={panel}
          className="border-t md:hidden"
          style={{ borderColor: 'rgba(45, 95, 63, 0.12)' }}
        >
          <nav aria-label="Menü" className="flex flex-col px-4 py-2 sm:px-6">
            {PUNKTE.map((punkt) => (
              <Link
                key={punkt.href}
                href={punkt.href}
                onClick={() => setOffen(false)}
                className="flex min-h-12 items-center text-sm font-semibold transition-opacity hover:opacity-80"
                style={{ color: '#2D5F3F' }}
              >
                {punkt.text}
              </Link>
            ))}
            <Link
              href="/login"
              onClick={() => setOffen(false)}
              className="my-2 inline-flex min-h-12 items-center justify-center rounded-lg border text-sm font-semibold transition-colors hover:bg-white"
              style={{ borderColor: '#D6E0CE', color: '#2D5F3F', background: 'rgba(255,255,255,0.6)' }}
            >
              Hofbetreiber-Login
            </Link>
          </nav>
        </div>
      )}
    </header>
  )
}
