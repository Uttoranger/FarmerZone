/**
 * Konto schließen: die zwei Sätze zu Stufe 2 (Nr. 304 Punkt 6; Wortlaut von
 * Recht, R-Prüfung Teil 3, ohne „Name“, AGB 29.3 und 29.4). Beweist:
 *  - beide Sätze stehen Zeichen für Zeichen wie im Auftrag;
 *  - kein „Name“ mehr in der Liste dessen, was gelöscht wird, und kein
 *    „sobald die Liste dafür freigegeben ist“;
 *  - der Satz „Bestellungen bleiben …“ steht danach unverändert genau einmal.
 */
import { describe, expect, it } from 'vitest'
import { KONTO_ANFRAGE_TEXT } from '@/lib/konto-anfragen'

const ERKLAERUNG_NEU =
  'Schließen nimmt die Hofseite offline; nach 30 Tagen sind Kontakt, Fotos und Texte des Hofs zu löschen. Das läuft noch nicht von selbst: Du bekommst dann eine Aufgabe in Heute.'
const SPAETER_NEU =
  'Kontakt, Fotos und Texte des Hofs werden gelöscht bzw. unkenntlich; Bestellungen und Abrechnungen bleiben, solange das Gesetz es verlangt. Das läuft noch nicht von selbst: Nach 30 Tagen bekommst du eine Aufgabe in Heute.'
const BESTELLUNGEN_BLEIBEN = 'Bestellungen bleiben, solange die Aufbewahrungspflicht gilt.'

describe('Konto schließen: Sätze zu Stufe 2 (Nr. 304 Punkt 6)', () => {
  it('Erklärung: der neue Satz wörtlich, danach „Bestellungen bleiben …“ unverändert genau einmal', () => {
    const e = KONTO_ANFRAGE_TEXT.erklaerung
    expect(e).toBe(`E-Mail ändern schickt einen Bestätigungslink an die neue Adresse. ${ERKLAERUNG_NEU} ${BESTELLUNGEN_BLEIBEN}`)
    expect(e.split(BESTELLUNGEN_BLEIBEN)).toHaveLength(2)
    expect(e.indexOf(ERKLAERUNG_NEU)).toBeLessThan(e.indexOf(BESTELLUNGEN_BLEIBEN))
  })

  it('Dialog „Nach 30 Tagen, endgültig“: der erste Punkt wörtlich, ohne „Name“; die übrigen Punkte bleiben', () => {
    const punkte = KONTO_ANFRAGE_TEXT.schliessen.spaeterPunkte
    expect(punkte[0]).toBe(SPAETER_NEU)
    expect(punkte.slice(1)).toEqual([
      'Bestellungen und Beträge bleiben, solange die Aufbewahrungspflicht gilt – ohne Kontakt des Hofs.',
      'Das Stripe-Konto gehört dem Hof; offene Auszahlungen laufen dort weiter.',
    ])
  })

  it('nirgends mehr „Name, Kontakt“ oder „sobald die Liste dafür freigegeben ist“', () => {
    const alles = JSON.stringify(KONTO_ANFRAGE_TEXT)
    expect(alles).not.toContain('Name, Kontakt')
    expect(alles).not.toMatch(/Liste dafür freigegeben/)
    expect(alles).not.toContain('unkenntlich gemacht')
  })
})
