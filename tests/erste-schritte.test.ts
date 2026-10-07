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
 *  - Weggeklickt wird über einen Cookie mit der Hof-ID: nur genau diese ID
 *    blendet aus; dann kommt statt der Karte die Zeile zum Einblenden, und
 *    ist alles erledigt, keins von beiden.
 *
 * Ohne Datenbank: die Funktion bekommt nur Zählwerte und Ja/Nein.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ERSTE_SCHRITTE_AUS_COOKIE,
  ERSTE_SCHRITTE_AUS_DAUER_S,
  ersteSchritte,
  ersteSchritteAnzeige,
  ersteSchritteAusgeblendet,
  ersteSchritteDaten,
  type ErsteSchritteDaten,
} from '@/lib/erste-schritte'
import { ONLINE_ZAHLUNG_EINRICHTEN_SATZ } from '@/lib/konditionen'

/** Ein Hof direkt nach der Registrierung: nichts eingerichtet. */
const FRISCH: ErsteSchritteDaten = {
  hatBeschreibung: false,
  hatKoordinaten: false,
  hatLogo: false,
  hatTitelbild: false,
  produkte: 0,
  aktiveAbholzeiten: 0,
  zahlungBereit: false,
}

/** Ein eingespielter Hof: alles erledigt, auch die Online-Zahlung. */
const FERTIG: ErsteSchritteDaten = {
  hatBeschreibung: true,
  hatKoordinaten: true,
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
  it('Hofprofil verlangt Beschreibung UND bestätigten Kartenpunkt', () => {
    // Seit dem Standort-Sprint reicht die Beschreibung allein nicht mehr:
    // Kundinnen sollen den Hof später auf einer Karte finden.
    expect(statusVon(FRISCH, 'profil')).toBe(false)
    expect(statusVon({ ...FRISCH, hatBeschreibung: true }, 'profil')).toBe(false)
    expect(statusVon({ ...FRISCH, hatKoordinaten: true }, 'profil')).toBe(false)
    expect(statusVon({ ...FRISCH, hatBeschreibung: true, hatKoordinaten: true }, 'profil')).toBe(
      true
    )
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

  it('Online-Zahlung hängt an der Stripe-Bereitschaft und ist Pflicht, nicht optional (Register Z1)', () => {
    const zahlung = ersteSchritte(FRISCH).schritte.find((s) => s.id === 'zahlung')

    expect(zahlung?.optional).toBe(false)
    expect(zahlung?.nutzen).toBe(ONLINE_ZAHLUNG_EINRICHTEN_SATZ)
    expect(statusVon(FRISCH, 'zahlung')).toBe(false)
    expect(statusVon({ ...FRISCH, zahlungBereit: true }, 'zahlung')).toBe(true)
  })

  it('kein Schritt ist optional, keiner sagt „geht auch ohne"', () => {
    const schritte = ersteSchritte(FRISCH).schritte

    expect(schritte.filter((s) => s.optional)).toEqual([])
    expect(schritte.map((s) => s.nutzen).join(' ')).not.toMatch(/auch ohne/)
  })
})

describe('Zwischenstände', () => {
  it('zählt eine Kombination richtig und rechnet den Anteil aus', () => {
    // Profil (Beschreibung + Kartenpunkt), Produkt und Abholzeiten erledigt —
    // Auftritt und Zahlung offen
    const ergebnis = ersteSchritte({
      ...FRISCH,
      hatBeschreibung: true,
      hatKoordinaten: true,
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

  it('hält die Karte, solange nur noch die Zahlung offen ist', () => {
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

describe('ersteSchritteDaten — Stammdaten des Hofs → Checkliste', () => {
  const HOF = {
    description: 'Wir halten Hühner.',
    latitude: 48.2,
    longitude: 13.0,
    logoUrl: 'https://bilder.example/logo.png',
    bannerType: 'PHOTO',
    bannerUrl: 'https://bilder.example/titel.jpg',
    stripeAccountReady: true,
  }

  it('ein fertiger Hof ergibt eine fertige Liste', () => {
    expect(ersteSchritteDaten(HOF, { produkte: 4, aktiveAbholzeiten: 2 })).toEqual(FERTIG)
  })

  it('leere Beschreibung zählt nicht — die Spalte trägt dann einen leeren String', () => {
    expect(ersteSchritteDaten({ ...HOF, description: '   ' }, { produkte: 0, aktiveAbholzeiten: 0 }).hatBeschreibung).toBe(false)
  })

  it('ein Farbverlauf ist kein Titelbild, auch wenn noch eine alte URL daneben steht', () => {
    expect(ersteSchritteDaten({ ...HOF, bannerType: 'GRADIENT' }, { produkte: 0, aktiveAbholzeiten: 0 }).hatTitelbild).toBe(false)
    expect(ersteSchritteDaten({ ...HOF, bannerUrl: null }, { produkte: 0, aktiveAbholzeiten: 0 }).hatTitelbild).toBe(false)
  })

  it('ohne Hof ist alles offen', () => {
    expect(ersteSchritteDaten(null, { produkte: 0, aktiveAbholzeiten: 0 })).toEqual(FRISCH)
  })
})

describe('ausblenden über den Cookie', () => {
  it('ausgeblendet nur, wenn der Cookie genau diese Hof-ID trägt', () => {
    expect(ersteSchritteAusgeblendet('hof-a', 'hof-a')).toBe(true)
    expect(ersteSchritteAusgeblendet('hof-b', 'hof-a')).toBe(false) // ein anderer Hof im selben Browser
    expect(ersteSchritteAusgeblendet(undefined, 'hof-a')).toBe(false)
    expect(ersteSchritteAusgeblendet('', 'hof-a')).toBe(false)
    expect(ersteSchritteAusgeblendet('hof-a ', 'hof-a')).toBe(false)
  })

  it('Karte, solange offen und nicht weggeklickt; weggeklickt die Zeile; fertig nichts', () => {
    const offen = ersteSchritte(FRISCH)
    const fertig = ersteSchritte(FERTIG)
    expect(ersteSchritteAnzeige(offen, false)).toBe('karte')
    expect(ersteSchritteAnzeige(offen, true)).toBe('zeile')
    expect(ersteSchritteAnzeige(fertig, false)).toBe('nichts')
    expect(ersteSchritteAnzeige(fertig, true)).toBe('nichts')
  })

  it('der Cookie heißt fz-erste-schritte-aus und hält ein Jahr', () => {
    expect(ERSTE_SCHRITTE_AUS_COOKIE).toBe('fz-erste-schritte-aus')
    expect(ERSTE_SCHRITTE_AUS_DAUER_S).toBe(365 * 24 * 60 * 60)
  })

  it('die Action setzt ihn SameSite=Lax mit der Hof-ID der Sitzung, Heute liest ihn auf dem Server', () => {
    const action = readFileSync(join(process.cwd(), 'src/server/actions/erste-schritte.ts'), 'utf8')
    expect(action).toContain("sameSite: 'lax'")
    expect(action).toContain('value: farm.id')
    expect(action).toContain('maxAge: ERSTE_SCHRITTE_AUS_DAUER_S')
    expect(action).toContain("revalidatePath('/dashboard')")
    // Seit Nr. 17 liegt Heute in (hof); ob die Karte kommt, reicht die Seite an heuteAufbau weiter.
    const seite = readFileSync(join(process.cwd(), 'src/app/(hof)/dashboard/page.tsx'), 'utf8')
    expect(seite).toContain('cookieJar.get(ERSTE_SCHRITTE_AUS_COOKIE)?.value')
    expect(seite).toContain("ersteSchritte: ersteSchritteZeigen === 'karte'")
    expect(seite).toContain("ersteSchritteZeigen === 'zeile' && (")
    expect(seite).not.toContain('localStorage')
  })
})
