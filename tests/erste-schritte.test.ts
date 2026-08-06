/**
 * Tests für die Einstiegs-Checkliste (src/lib/erste-schritte.ts).
 *
 * Beweist an der echten Funktion:
 *  - Ein frisch registrierter Hof steht bei 0 von 5, alle Punkte offen.
 *  - Jeder Punkt hängt an genau der Bedingung, die er behauptet — einzeln
 *    geprüft, damit eine vertauschte Zuordnung auffällt.
 *  - Die Reihenfolge liegt fest (sie ist die Arbeitsreihenfolge).
 *  - Ist alles erledigt, sagt `anzeigen` false — die Karte verschwindet
 *    vollständig statt ein „Alles erledigt" stehen zu lassen.
 *
 * Ohne Datenbank: die Funktion bekommt nur Zählwerte und Ja/Nein.
 */
import { describe, it, expect } from 'vitest'
import { ersteSchritte, type ErsteSchritteDaten } from '@/lib/erste-schritte'

/** Ein Hof direkt nach der Registrierung: nichts eingerichtet. */
const FRISCH: ErsteSchritteDaten = {
  hatBeschreibung: false,
  hatLogo: false,
  hatTitelbild: false,
  produkte: 0,
  aktiveAbholzeiten: 0,
  zahlungBereit: false,
}

/** Ein eingespielter Hof: alles erledigt, auch die Online-Zahlung. */
const FERTIG: ErsteSchritteDaten = {
  hatBeschreibung: true,
  hatLogo: true,
  hatTitelbild: true,
  produkte: 4,
  aktiveAbholzeiten: 2,
  zahlungBereit: true,
}

/** Status eines einzelnen Punktes, kurz abgefragt. */
function statusVon(daten: ErsteSchritteDaten, id: string): boolean {
  const schritt = ersteSchritte(daten).schritte.find((s) => s.id === id)
  if (!schritt) throw new Error(`Schritt ${id} gibt es nicht`)
  return schritt.erledigt
}

describe('frisch registrierter Hof', () => {
  it('steht bei 0 von 5 und zeigt die Karte', () => {
    const ergebnis = ersteSchritte(FRISCH)

    expect(ergebnis.erledigt).toBe(0)
    expect(ergebnis.gesamt).toBe(5)
    expect(ergebnis.prozent).toBe(0)
    expect(ergebnis.anzeigen).toBe(true)
    expect(ergebnis.schritte.every((s) => !s.erledigt)).toBe(true)
  })

  it('gibt jedem offenen Punkt ein Ziel und einen Nutzen-Satz', () => {
    for (const schritt of ersteSchritte(FRISCH).schritte) {
      expect(schritt.href.startsWith('/')).toBe(true)
      expect(schritt.titel.length).toBeGreaterThan(0)
      expect(schritt.nutzen.length).toBeGreaterThan(0)
    }
  })
})

describe('Reihenfolge', () => {
  it('liegt fest: Profil, Auftritt, Produkt, Abholzeiten, Zahlung', () => {
    expect(ersteSchritte(FRISCH).schritte.map((s) => s.id)).toEqual([
      'profil',
      'auftritt',
      'produkt',
      'abholzeiten',
      'zahlung',
    ])
  })

  it('bleibt gleich, egal was schon erledigt ist', () => {
    const gemischt = ersteSchritte({ ...FRISCH, produkte: 3, zahlungBereit: true })

    expect(gemischt.schritte.map((s) => s.id)).toEqual(
      ersteSchritte(FRISCH).schritte.map((s) => s.id)
    )
  })
})

describe('einzelne Bedingungen', () => {
  it('Hofprofil hängt an der Beschreibung', () => {
    expect(statusVon(FRISCH, 'profil')).toBe(false)
    expect(statusVon({ ...FRISCH, hatBeschreibung: true }, 'profil')).toBe(true)
  })

  it('Auftritt verlangt Logo UND Titelbild — eines allein genügt nicht', () => {
    expect(statusVon({ ...FRISCH, hatLogo: true }, 'auftritt')).toBe(false)
    expect(statusVon({ ...FRISCH, hatTitelbild: true }, 'auftritt')).toBe(false)
    expect(statusVon({ ...FRISCH, hatLogo: true, hatTitelbild: true }, 'auftritt')).toBe(true)
  })

  it('Produkt genügt schon bei einem einzigen', () => {
    expect(statusVon({ ...FRISCH, produkte: 1 }, 'produkt')).toBe(true)
  })

  it('Abholzeiten zählen nur aktive', () => {
    expect(statusVon(FRISCH, 'abholzeiten')).toBe(false)
    expect(statusVon({ ...FRISCH, aktiveAbholzeiten: 1 }, 'abholzeiten')).toBe(true)
  })

  it('Online-Zahlung hängt an der Stripe-Bereitschaft und ist als optional gekennzeichnet', () => {
    const zahlung = ersteSchritte(FRISCH).schritte.find((s) => s.id === 'zahlung')

    expect(zahlung?.optional).toBe(true)
    expect(statusVon(FRISCH, 'zahlung')).toBe(false)
    expect(statusVon({ ...FRISCH, zahlungBereit: true }, 'zahlung')).toBe(true)
  })

  it('kennzeichnet ausschließlich die Online-Zahlung als optional', () => {
    const optionale = ersteSchritte(FRISCH).schritte.filter((s) => s.optional)

    expect(optionale.map((s) => s.id)).toEqual(['zahlung'])
  })
})

describe('Zwischenstände', () => {
  it('zählt eine Kombination richtig und rechnet den Anteil aus', () => {
    // Profil, Produkt und Abholzeiten erledigt — Auftritt und Zahlung offen
    const ergebnis = ersteSchritte({
      ...FRISCH,
      hatBeschreibung: true,
      produkte: 2,
      aktiveAbholzeiten: 1,
    })

    expect(ergebnis.erledigt).toBe(3)
    expect(ergebnis.prozent).toBe(60)
    expect(ergebnis.anzeigen).toBe(true)
    expect(ergebnis.schritte.filter((s) => s.erledigt).map((s) => s.id)).toEqual([
      'profil',
      'produkt',
      'abholzeiten',
    ])
  })

  it('hält die Karte, solange nur noch die optionale Zahlung offen ist', () => {
    const ergebnis = ersteSchritte({ ...FERTIG, zahlungBereit: false })

    expect(ergebnis.erledigt).toBe(4)
    expect(ergebnis.prozent).toBe(80)
    expect(ergebnis.anzeigen).toBe(true)
  })
})

describe('vollständig eingerichteter Hof', () => {
  it('blendet die Karte aus, statt „alles erledigt" stehen zu lassen', () => {
    const ergebnis = ersteSchritte(FERTIG)

    expect(ergebnis.erledigt).toBe(5)
    expect(ergebnis.prozent).toBe(100)
    expect(ergebnis.anzeigen).toBe(false)
  })

  it('reicht genau ein offener Punkt, damit die Karte wieder erscheint', () => {
    // Zum Beispiel, wenn der Bauer sein letztes Produkt löscht
    expect(ersteSchritte({ ...FERTIG, produkte: 0 }).anzeigen).toBe(true)
    expect(ersteSchritte({ ...FERTIG, aktiveAbholzeiten: 0 }).anzeigen).toBe(true)
    expect(ersteSchritte({ ...FERTIG, hatLogo: false }).anzeigen).toBe(true)
  })
})
