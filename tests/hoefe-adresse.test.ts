/**
 * Der Speicher für die Filter von /hoefe (Register N19): Die Seite ist statisch, die Filter liest
 * der Browser aus der Adresse. Geprüft am Speicher mit einem nachgebauten Fenster — Zustand aus
 * der Adresse beim Start, nach dem Schreiben (replaceState) und nach Zurück/Vor (popstate).
 */
import { describe, it, expect } from 'vitest'
import { ankunftAusAdresse, erstelleAdressSpeicher, type AdressFenster } from '@/components/hoefe/use-hoefe-adresse'

/** Ein Fenster mit Adresse, Verlauf und popstate — so viel, wie der Speicher braucht; auf Wunsch mit Navigation API. */
function fenster(start: string, { mitNavigation = false } = {}) {
  let adresse = new URL(start, 'https://beispiel.test')
  const hoerer = new Set<() => void>()
  const navigationsHoerer = new Set<() => void>()
  const ersetzt: string[] = []
  const f: AdressFenster = {
    location: {
      get pathname() {
        return adresse.pathname
      },
      get search() {
        return adresse.search
      },
    },
    history: {
      replaceState(_zustand, _titel, url) {
        ersetzt.push(url)
        adresse = new URL(url, adresse)
      },
    },
    addEventListener(_typ, h) {
      hoerer.add(h)
    },
    removeEventListener(_typ, h) {
      hoerer.delete(h)
    },
    navigation: mitNavigation
      ? {
          addEventListener(_typ, h) {
            navigationsHoerer.add(h)
          },
          removeEventListener(_typ, h) {
            navigationsHoerer.delete(h)
          },
        }
      : undefined,
  }
  return {
    f,
    ersetzt,
    hoerer,
    navigationsHoerer,
    /** Der Browser geht zurück oder vor: erst die Adresse, dann popstate. */
    gehe(url: string) {
      adresse = new URL(url, adresse)
      for (const h of hoerer) h()
    },
    /** Next schreibt die Adresse selbst (Seitenwechsel im Browser, pushState) — ohne popstate; die Navigation API meldet es sofort. */
    nextSchreibt(url: string) {
      adresse = new URL(url, adresse)
      for (const h of navigationsHoerer) h()
    },
  }
}

describe('der Speicher für die Filter von /hoefe', () => {
  it('beim Start: die Suchparameter der Adresse', () => {
    const { f } = fenster('/hoefe?kat=EIER&ansicht=karte')
    expect(erstelleAdressSpeicher('/hoefe', () => f).lesen()).toBe('?kat=EIER&ansicht=karte')
    // Ohne Parameter: leer, nicht „keine Adresse".
    const { f: nackt } = fenster('/hoefe')
    expect(erstelleAdressSpeicher('/hoefe', () => nackt).lesen()).toBe('')
  })

  it('solange die Adresse noch einer anderen Seite gehört, liest er nichts (null wie auf dem Server)', () => {
    // Seitenwechsel im Browser: Next zeichnet /hoefe, bevor es die Adresse schreibt.
    const n = fenster('/hof-test?bereich=futter')
    const speicher = erstelleAdressSpeicher('/hoefe', () => n.f)
    expect(speicher.lesen()).toBeNull()
    n.nextSchreibt('/hoefe?kat=EIER')
    expect(speicher.lesen()).toBe('?kat=EIER')
  })

  it('nach dem Schreiben: replaceState mit dem Pfad der Seite, alle Abonnenten hören es', () => {
    const n = fenster('/hoefe?kat=EIER')
    const speicher = erstelleAdressSpeicher('/hoefe', () => n.f)
    let gehoert = 0
    const abbestellen = speicher.abonnieren(() => (gehoert += 1))
    speicher.ersetze('siegel=BIO')
    expect(n.ersetzt).toEqual(['/hoefe?siegel=BIO'])
    expect(gehoert).toBe(1)
    expect(speicher.lesen()).toBe('?siegel=BIO')
    // Ohne Filter die nackte /hoefe.
    speicher.ersetze('')
    expect(n.ersetzt.at(-1)).toBe('/hoefe')
    expect(speicher.lesen()).toBe('')
    expect(gehoert).toBe(2)
    // Abbestellt hört niemand mehr zu.
    abbestellen()
    speicher.ersetze('kat=BROT')
    expect(gehoert).toBe(2)
  })

  it('nach Zurück/Vor: popstate meldet die neue Adresse', () => {
    const n = fenster('/hoefe?kat=EIER')
    const speicher = erstelleAdressSpeicher('/hoefe', () => n.f)
    let gehoert = 0
    const abbestellen = speicher.abonnieren(() => (gehoert += 1))
    expect(n.hoerer.size).toBe(1)
    n.gehe('/hoefe?ansicht=karte')
    expect(gehoert).toBe(1)
    expect(speicher.lesen()).toBe('?ansicht=karte')
    abbestellen()
    expect(n.hoerer.size).toBe(0)
    // Gegenprobe: nach dem Abbestellen kommt popstate nicht mehr an.
    n.gehe('/hoefe')
    expect(gehoert).toBe(1)
  })
})

describe('Seitenwechsel auf dieselbe Seite: Next schreibt die Adresse selbst (Entdecken auf /hoefe?kat=…)', () => {
  it('mit Navigation API: gemeldet — aber erst nach der laufenden Aufgabe (Next schreibt in einem useInsertionEffect)', async () => {
    const n = fenster('/hoefe?kat=EIER', { mitNavigation: true })
    const speicher = erstelleAdressSpeicher('/hoefe', () => n.f)
    let gehoert = 0
    const abbestellen = speicher.abonnieren(() => (gehoert += 1))
    n.nextSchreibt('/hoefe')
    // Mitten im Schreiben noch nicht: React darf in einem useInsertionEffect nichts neu planen.
    expect(gehoert).toBe(0)
    await Promise.resolve()
    expect(gehoert).toBe(1)
    expect(speicher.lesen()).toBe('')
    abbestellen()
    expect(n.navigationsHoerer.size).toBe(0)
    n.nextSchreibt('/hoefe?kat=BROT')
    await Promise.resolve()
    expect(gehoert).toBe(1)
  })

  it('ohne Navigation API (ältere Browser): kein Fehler, popstate bleibt der Weg', () => {
    const n = fenster('/hoefe?kat=EIER')
    const speicher = erstelleAdressSpeicher('/hoefe', () => n.f)
    let gehoert = 0
    const abbestellen = speicher.abonnieren(() => (gehoert += 1))
    n.gehe('/hoefe')
    expect(gehoert).toBe(1)
    abbestellen()
  })
})

describe('der Ankunftstext — einmal, und erst, wenn die Adresse feststeht (Nr. 84)', () => {
  it('ohne Adresse (Server, Hydration, Seitenwechsel) noch nichts', () => {
    expect(ankunftAusAdresse(null, null)).toBeNull()
  })

  it('q ohne t=1 ist abgesendet: der Text; mit t=1 schrieb ihn die Seite selbst: leer', () => {
    expect(ankunftAusAdresse(null, '?q=Wels')).toBe('Wels')
    expect(ankunftAusAdresse(null, '?q=Wels&t=1')).toBe('')
    expect(ankunftAusAdresse(null, '')).toBe('')
  })

  it('nur einmal: Ist er einmal gelesen, bleibt es dabei — auch wenn die Adresse wechselt', () => {
    expect(ankunftAusAdresse('', '?q=Linz')).toBe('')
    expect(ankunftAusAdresse('Wels', '?q=Linz')).toBe('Wels')
  })
})
