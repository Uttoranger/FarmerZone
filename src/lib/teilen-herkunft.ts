/**
 * Über welchen geteilten Link eine Kundin auf die Hofseite kam (Gate 7, S8) —
 * EINE Stelle für Schlüssel, Lesen und Schreiben im sessionStorage.
 *
 * Warum der sessionStorage: Die Bestellung soll den Kanal kennen
 * (`Order.teilenKanal`), ohne Cookie und ohne Kennung (S8). Der Wert lebt nur
 * in diesem Tab, bis er geschlossen wird, und verlässt den Browser nur als
 * eines von sieben Kürzeln im Checkout. Er ist eine Bequemlichkeit für die
 * Auswertung: Fehlt er (privates Fenster, gesperrte Daten), zählt die
 * Bestellung eben ohne Kanal — deshalb wirft hier nichts, und gelesen wird
 * mit Zod wie jeder Browser-Speicher (CODING_STANDARDS §3).
 */
import { teilenKanalCodeSchema } from '@/schemas/teilen'
import type { TeilenKanalCode } from '@/lib/teilen-kanal'

type Speicher = Pick<Storage, 'getItem' | 'setItem'>

const HERKUNFT_PRAEFIX = 'farmerzone_teilen:'
const GEZAEHLT_PRAEFIX = 'farmerzone_teilen_gezaehlt:'

/** Der Schlüssel der Herkunft je Hof — ein Tab kann mehrere Höfe offen haben. */
export function herkunftSchluessel(slug: string): string {
  return `${HERKUNFT_PRAEFIX}${slug}`
}

function gezaehltSchluessel(slug: string, kanal: TeilenKanalCode): string {
  return `${GEZAEHLT_PRAEFIX}${slug}:${kanal}`
}

/** Der sessionStorage des Browsers — oder null, wo es keinen gibt oder schon der Zugriff wirft. */
export function teilenSpeicher(): Speicher | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    // Gesperrte Website-Daten: Dann zählt die Bestellung ohne Kanal.
    return null
  }
}

/** Das gemerkte Kürzel für diesen Hof, oder null — auch bei allem, was kein gültiges Kürzel ist. */
export function leseTeilenHerkunft(speicher: Speicher | null, slug: string): TeilenKanalCode | null {
  if (!speicher) return null
  try {
    const gelesen = teilenKanalCodeSchema.safeParse(speicher.getItem(herkunftSchluessel(slug)))
    return gelesen.success ? gelesen.data : null
  } catch {
    // Kein Lesezugriff: Dann ohne Kanal.
    return null
  }
}

export type BesuchEntscheidung = { kanal: TeilenKanalCode | null; zaehlen: boolean }

/**
 * Die Hofseite wurde mit `?k=<wert>` geöffnet: merkt das Kürzel (der letzte
 * geteilte Link gewinnt) und sagt, ob der Besuch gezählt werden soll —
 * höchstens einmal je Tab, Hof und Kanal. Ein ungültiger Wert ändert nichts
 * und zählt nicht. Ohne Speicher wird gezählt: Die Seite nimmt das Kürzel
 * danach aus der Adresse, ein Neuladen zählt also trotzdem nicht doppelt.
 */
export function merkeTeilenBesuch(speicher: Speicher | null, slug: string, wert: unknown): BesuchEntscheidung {
  const gelesen = teilenKanalCodeSchema.safeParse(wert)
  if (!gelesen.success) return { kanal: null, zaehlen: false }
  const kanal = gelesen.data
  if (!speicher) return { kanal, zaehlen: true }
  try {
    speicher.setItem(herkunftSchluessel(slug), kanal)
    if (speicher.getItem(gezaehltSchluessel(slug, kanal)) === '1') return { kanal, zaehlen: false }
    speicher.setItem(gezaehltSchluessel(slug, kanal), '1')
    return { kanal, zaehlen: true }
  } catch {
    // Kein Schreibzugriff (voll, gesperrt): zählen wie ohne Speicher.
    return { kanal, zaehlen: true }
  }
}

/** Die Adresse ohne `?k=…` — der Rest (Bereich, Reiter, Anker) bleibt. */
export function adresseOhneKanal(href: string, parameter: string): string | null {
  try {
    const url = new URL(href)
    if (!url.searchParams.has(parameter)) return null
    url.searchParams.delete(parameter)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}
