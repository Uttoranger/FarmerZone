/**
 * „Hof einrichten" (src/lib/einrichten.ts, Nr. 15): welche Schritte gezeigt
 * werden, was erledigt ist, wohin sie führen.
 */
import { describe, expect, it } from 'vitest'
import { einrichtenStand, vorname, type EinrichtenDaten } from '@/lib/einrichten'

const OHNE_HOF: EinrichtenDaten = { personName: 'Max Mustermann', email: 'max@example.com', hof: null }

function mitHof(hof: Partial<NonNullable<EinrichtenDaten['hof']>> = {}): EinrichtenDaten {
  return {
    personName: 'Max Mustermann',
    email: 'max@example.com',
    hof: {
      name: 'Hof Test',
      hofseite: { erledigt: 7, gesamt: 11, fehlend: ['Logo', 'Über uns', 'Fotos', 'Titelbild'] },
      produkte: 0,
      stripeBereit: false,
      freigeschaltet: false,
      ...hof,
    },
  }
}

const schritt = (daten: EinrichtenDaten, id: string) => {
  const s = einrichtenStand(daten).schritte.find((x) => x.id === id)
  if (!s) throw new Error(`Schritt ${id} fehlt`)
  return s
}

describe('einrichtenStand — ohne Hof', () => {
  it('sechs Schritte, Schritt 2 ist „Hof anlegen" mit dem Formular', () => {
    const stand = einrichtenStand(OHNE_HOF)
    expect(stand.schritte.map((s) => s.id)).toEqual(['konto', 'hof', 'produkte', 'zahlung', 'sepa', 'freischaltung'])
    expect(stand.schritte.map((s) => s.nummer)).toEqual([1, 2, 3, 4, 5, 6])
    expect(schritt(OHNE_HOF, 'hof')).toMatchObject({ zustand: 'offen', aktion: { art: 'formular' } })
  })

  it('Produkte, Zahlung und Freischaltung warten auf den Hof — ohne Link ins Leere', () => {
    for (const id of ['produkte', 'zahlung', 'freischaltung']) {
      expect(schritt(OHNE_HOF, id)).toMatchObject({ zustand: 'gesperrt', aktion: null })
    }
  })

  it('das Konto ist erledigt und zeigt die Adresse', () => {
    expect(schritt(OHNE_HOF, 'konto')).toMatchObject({ zustand: 'erledigt', text: 'max@example.com' })
  })

  it('zählt fünf Schritte (SEPA nicht), einer davon erledigt', () => {
    const stand = einrichtenStand(OHNE_HOF)
    expect(stand.erledigt).toBe(1)
    expect(stand.gesamt).toBe(5)
    expect(stand.ueberschrift).toBe('Noch 4 Schritte bis zum ersten Verkauf')
  })
})

describe('einrichtenStand — mit Hof', () => {
  it('Hofseite: Stand aus „Mein Hof", Link dorthin, solange etwas fehlt', () => {
    const s = schritt(mitHof(), 'hofseite')
    expect(s.zustand).toBe('offen')
    expect(s.text).toBe('7 von 11 fertig – es fehlen Logo, Über uns, Fotos und Titelbild')
    expect(s.textKurz).toBe('7 von 11 fertig')
    expect(s.aktion).toEqual({ art: 'link', href: '/farm-page', label: 'Weiter', primaer: false })
  })

  it('Hofseite vollständig: erledigt, ohne Aktion', () => {
    const s = schritt(mitHof({ hofseite: { erledigt: 11, gesamt: 11, fehlend: [] } }), 'hofseite')
    expect(s).toMatchObject({ zustand: 'erledigt', aktion: null })
  })

  it('Produkte: ohne Produkt Link zum Anlegen, mit Produkt erledigt mit Zahl', () => {
    expect(schritt(mitHof(), 'produkte').aktion).toMatchObject({ href: '/products?neu=1' })
    expect(schritt(mitHof({ produkte: 1 }), 'produkte')).toMatchObject({ zustand: 'erledigt', text: '1 Produkt angelegt' })
    expect(schritt(mitHof({ produkte: 2 }), 'produkte').text).toBe('2 Produkte angelegt')
  })

  it('Zahlung: führt nur in die bestehende Stripe-Einrichtung — der eine orange Knopf', () => {
    const stand = einrichtenStand(mitHof())
    const primaer = stand.schritte.filter((s) => s.aktion?.art === 'link' && s.aktion.primaer)
    expect(primaer.map((s) => s.id)).toEqual(['zahlung'])
    expect(schritt(mitHof(), 'zahlung').aktion).toMatchObject({ href: '/settings/payments', label: 'Mit Stripe einrichten' })
    expect(schritt(mitHof({ stripeBereit: true }), 'zahlung')).toMatchObject({ zustand: 'erledigt', aktion: null })
  })

  it('SEPA ist ein Hinweis ohne Eingabe und zählt nie mit', () => {
    const s = schritt(mitHof(), 'sepa')
    expect(s).toMatchObject({ zustand: 'hinweis', aktion: null })
    expect(s.text).toContain('Jetzt ist nichts zu tun')
    // Keine Zusage, für die es keinen Weg gibt (Nachbesserung 1): Ob und wann
    // eine Monatsabrechnung kommt, ist noch nicht entschieden.
    expect(s.text).not.toMatch(/melden uns|bevor/)
  })

  it('Freischaltung wartet auf den Betreiber, bis approvedAt gesetzt ist', () => {
    expect(schritt(mitHof(), 'freischaltung')).toMatchObject({ zustand: 'wartet', aktion: null })
    expect(schritt(mitHof({ freigeschaltet: true }), 'freischaltung').zustand).toBe('erledigt')
  })

  it('alles erledigt: „Alles erledigt" — auch ohne SEPA-Mandat', () => {
    const stand = einrichtenStand(
      mitHof({ hofseite: { erledigt: 11, gesamt: 11, fehlend: [] }, produkte: 3, stripeBereit: true, freigeschaltet: true })
    )
    expect(stand.erledigt).toBe(stand.gesamt)
    expect(stand.ueberschrift).toBe('Alles erledigt – dein Hof ist startklar')
  })

  it('ein offener Schritt heißt „ein Schritt"', () => {
    const stand = einrichtenStand(mitHof({ hofseite: { erledigt: 11, gesamt: 11, fehlend: [] }, produkte: 3, stripeBereit: true }))
    expect(stand.ueberschriftKurz).toBe('Noch ein Schritt')
  })

  it('Konto zeigt Hofname und Adresse', () => {
    expect(schritt(mitHof(), 'konto').text).toBe('Hof Test · max@example.com')
  })
})

describe('vorname', () => {
  it('nimmt das erste Wort, verträgt Leerzeichen und leere Namen', () => {
    expect(vorname('  Max   Mustermann ')).toBe('Max')
    expect(vorname('')).toBe('')
  })
})
