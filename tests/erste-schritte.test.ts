/**
 * Tests für die Einstiegs-Checkliste (src/lib/erste-schritte.ts).
 *
 * Beweist an der echten Funktion:
 *  - Ein frisch registrierter Hof steht bei 0 von 5, alle Punkte offen.
 *  - Jeder Punkt hängt an genau der Bedingung, die er behauptet — einzeln
 *    geprüft, damit eine vertauschte Zuordnung auffällt.
 *  - Die Reihenfolge liegt fest (sie ist die Arbeitsreihenfolge).
 *  - Ist alles erledigt, ist jeder Schritt erledigt; ein einziger offener
 *    genügt, damit wieder etwas offen ist. Ob die Karte „Zu tun" dann steht
 *    oder ganz verschwindet, entscheidet zuTun (tests/zu-tun.test.ts).
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
import { ONLINE_ZAHLUNG_EINRICHTEN_SATZ, ONLINE_ZAHLUNG_EINRICHTEN_TITEL } from '@/lib/konditionen'

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

/** Die erledigten bzw. offenen Schritte, als IDs in Listenreihenfolge. */
const erledigte = (daten: ErsteSchritteDaten) => ersteSchritte(daten).filter((s) => s.erledigt).map((s) => s.id)
const offene = (daten: ErsteSchritteDaten) => ersteSchritte(daten).filter((s) => !s.erledigt).map((s) => s.id)

/** Status eines einzelnen Punktes, kurz abgefragt. */
function statusVon(daten: ErsteSchritteDaten, id: string): boolean {
  const schritt = ersteSchritte(daten).find((s) => s.id === id)
  if (!schritt) throw new Error(`Schritt ${id} gibt es nicht`)
  return schritt.erledigt
}

describe('frisch registrierter Hof', () => {
  it('steht bei 0 von 5 — alle Punkte offen', () => {
    const schritte = ersteSchritte(FRISCH)

    expect(schritte).toHaveLength(5)
    expect(erledigte(FRISCH)).toEqual([])
    expect(schritte.every((s) => !s.erledigt)).toBe(true)
  })

  it('gibt jedem offenen Punkt ein Ziel und einen Nutzen-Satz', () => {
    for (const schritt of ersteSchritte(FRISCH)) {
      expect(schritt.href.startsWith('/')).toBe(true)
      expect(schritt.titel.length).toBeGreaterThan(0)
      expect(schritt.nutzen.length).toBeGreaterThan(0)
    }
  })
})

describe('Reihenfolge', () => {
  it('liegt fest: Profil, Auftritt, Produkt, Abholzeiten, Zahlung', () => {
    expect(ersteSchritte(FRISCH).map((s) => s.id)).toEqual([
      'profil',
      'auftritt',
      'produkt',
      'abholzeiten',
      'zahlung',
    ])
  })

  it('bleibt gleich, egal was schon erledigt ist', () => {
    const gemischt = ersteSchritte({ ...FRISCH, produkte: 3, zahlungBereit: true })

    expect(gemischt.map((s) => s.id)).toEqual(
      ersteSchritte(FRISCH).map((s) => s.id)
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
    const zahlung = ersteSchritte(FRISCH).find((s) => s.id === 'zahlung')

    // Ein Schritt wie jeder andere: offen, solange Stripe nicht bereit ist —
    // ohne „(optional)" und ohne Ausweg „geht auch ohne".
    expect(zahlung?.titel).toBe(ONLINE_ZAHLUNG_EINRICHTEN_TITEL)
    expect(zahlung?.nutzen).toBe(ONLINE_ZAHLUNG_EINRICHTEN_SATZ)
    expect(`${zahlung?.titel} ${zahlung?.nutzen}`).not.toMatch(/optional|auch ohne/i)
    expect(statusVon(FRISCH, 'zahlung')).toBe(false)
    expect(statusVon({ ...FRISCH, zahlungBereit: true }, 'zahlung')).toBe(true)
  })

  it('kein Schritt ist optional, keiner sagt „geht auch ohne" — es gibt kein Merkmal „optional" mehr', () => {
    const schritte = ersteSchritte(FRISCH)

    expect(schritte.map((s) => `${s.titel} ${s.nutzen}`).join(' ')).not.toMatch(/optional|auch ohne/i)
    for (const schritt of schritte) expect(Object.keys(schritt).sort()).toEqual(['erledigt', 'href', 'id', 'nutzen', 'titel'])
  })
})

describe('Zwischenstände', () => {
  it('zählt eine Kombination richtig: drei von fünf erledigt, genau die richtigen', () => {
    // Profil (Beschreibung + Kartenpunkt), Produkt und Abholzeiten erledigt —
    // Auftritt und Zahlung offen
    const daten = {
      ...FRISCH,
      hatBeschreibung: true,
      hatKoordinaten: true,
      produkte: 2,
      aktiveAbholzeiten: 1,
    }

    expect(erledigte(daten)).toEqual(['profil', 'produkt', 'abholzeiten'])
    expect(offene(daten)).toEqual(['auftritt', 'zahlung'])
  })

  it('nur noch die Zahlung offen: vier von fünf erledigt', () => {
    expect(erledigte({ ...FERTIG, zahlungBereit: false })).toHaveLength(4)
    expect(offene({ ...FERTIG, zahlungBereit: false })).toEqual(['zahlung'])
  })
})

describe('vollständig eingerichteter Hof', () => {
  it('jeder Schritt ist erledigt — „Zu tun" hat aus den Ersten Schritten nichts mehr', () => {
    expect(erledigte(FERTIG)).toHaveLength(5)
    expect(offene(FERTIG)).toEqual([])
  })

  it('genau ein offener Punkt genügt, damit wieder etwas offen ist', () => {
    // Zum Beispiel, wenn der Bauer sein letztes Produkt löscht
    expect(offene({ ...FERTIG, produkte: 0 })).toEqual(['produkt'])
    expect(offene({ ...FERTIG, aktiveAbholzeiten: 0 })).toEqual(['abholzeiten'])
    expect(offene({ ...FERTIG, hatLogo: false })).toEqual(['auftritt'])
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
    // Die Liste „Zu tun" sagt, ob etwas offen ist (zuTun → anzeigen).
    const offen = { anzeigen: true }
    const fertig = { anzeigen: false }
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
    // Seit Nr. 53 blendet derselbe Cookie die eine Liste „Zu tun" aus.
    const seite = readFileSync(join(process.cwd(), 'src/app/(hof)/dashboard/page.tsx'), 'utf8')
    expect(seite).toContain('cookieJar.get(ERSTE_SCHRITTE_AUS_COOKIE)?.value')
    expect(seite).toContain("zuTun: zuTunZeigen === 'karte'")
    expect(seite).toContain("zuTunZeigen === 'zeile' && (")
    expect(seite).not.toContain('localStorage')
  })
})
