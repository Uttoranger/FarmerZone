/**
 * „Zu tun" auf Heute (freigabe.md §13 Nr. 53, Register F4 mit dem Vermerk vom
 * 10.10.2026): Erste Schritte (src/lib/erste-schritte.ts) und die Liste der
 * Hofseite (src/lib/hofseite-fortschritt.ts) werden EINE Liste.
 *
 * Beweist an den echten Funktionen — ohne Datenbank, ohne Mock; beide Listen
 * entstehen aus einem Hof so, wie getHeute sie baut:
 *  - Jede Aufgabe steht einmal. Wo die Hofseiten-Liste feiner zählt als die
 *    Ersten Schritte (Hofprofil = Kurzbeschreibung + Standort, Auftritt =
 *    Titelbild + Logo) oder dasselbe zählt (Abholzeiten), steht die Aufgabe
 *    nur einmal — und für JEDEN Hof gilt: ein Schritt ist offen genau dann,
 *    wenn eine seiner Zeilen in der Liste steht.
 *  - Was der Kasten oben zeigt (Online-Zahlung einrichten bzw. pausiert),
 *    steht nicht noch einmal da; ohne Kasten steht „Online-Zahlung
 *    einrichten" höchstens einmal.
 *  - Erledigtes verschwindet; ist alles erledigt, verschwindet die Liste.
 *  - Reihenfolge: erst, was Bestellungen möglich macht (Produkt, Abholzeiten,
 *    Online-Zahlung), dann die Hofseite in ihrer eigenen Reihenfolge.
 *  - Titel, Satz und Ziel kommen aus den beiden Quellen — keine dritte Fassung.
 */
import { describe, it, expect } from 'vitest'
import {
  ersteSchritte,
  ersteSchritteAnzeige,
  ersteSchritteDaten,
  zuTun,
  type HofFuerErsteSchritte,
  type ZuTun,
} from '@/lib/erste-schritte'
import {
  EINSTELLUNG_FUER_ZEILE,
  hofseiteFortschritt,
  hofseiteStand,
} from '@/lib/hofseite-fortschritt'
import { ONLINE_ZAHLUNG_EINRICHTEN_SATZ, ONLINE_ZAHLUNG_EINRICHTEN_TITEL } from '@/lib/konditionen'

/** Ein Hof, in der Form, in der getHeute ihn lädt — für beide Quellen derselbe. */
type Hof = Parameters<typeof hofseiteStand>[0] & HofFuerErsteSchritte

/** Ein fertig eingerichteter Hof. */
const FERTIG: Hof = {
  name: 'Hof Test',
  description: 'Gemüse und Eier aus Musterdorf',
  aboutText: 'Seit drei Generationen bauen wir Gemüse an.',
  logoUrl: 'https://bilder.example/logo.webp',
  bannerType: 'PHOTO',
  bannerUrl: 'https://bilder.example/titel.jpg',
  farmPhotos: [{ id: 'foto-1' }],
  address: 'Musterweg 1',
  postalCode: '4900',
  city: 'Musterdorf',
  latitude: 48.2,
  longitude: 13.5,
  pickupSlots: [{ dayOfWeek: 5, startTime: '15:00', endTime: '18:00' }],
  acceptsOnline: true,
  stripeAccountReady: true,
  phone: '+43 660 0000000',
  email: 'hof@example.com',
  isPaused: false,
  sectionsConfig: [
    { key: 'about', visible: true, order: 1 },
    { key: 'products', visible: true, order: 2 },
  ],
}

/** Alles offen: frisch registriert, nichts eingerichtet. */
const FRISCH: Hof = {
  ...FERTIG,
  description: '',
  aboutText: null,
  logoUrl: null,
  bannerType: 'GRADIENT',
  bannerUrl: null,
  farmPhotos: [],
  latitude: null,
  longitude: null,
  pickupSlots: [],
  stripeAccountReady: false,
  phone: '',
}

/** Beide Quellen aus EINEM Hof — wie getHeute (queries/heute.ts) — und daraus die Liste. */
function bauen(hof: Hof, { produkte = 3, stripeImKasten = false }: { produkte?: number; stripeImKasten?: boolean } = {}) {
  const schritte = ersteSchritte(ersteSchritteDaten(hof, { produkte, aktiveAbholzeiten: hof.pickupSlots.length }))
  const fortschritt = hofseiteFortschritt(hofseiteStand(hof, hof))
  return { schritte, fortschritt, liste: zuTun(schritte, fortschritt, { stripeImKasten }) }
}

const ids = (liste: ZuTun) => liste.aufgaben.map((a) => a.id)

describe('Reihenfolge und Inhalt', () => {
  it('frischer Hof ohne Kasten: erst was Bestellungen möglich macht, dann die Hofseite in ihrer Reihenfolge', () => {
    expect(ids(bauen(FRISCH, { produkte: 0 }).liste)).toEqual([
      'produkt',
      'abholzeiten',
      'zahlung',
      'titelbild',
      'logo',
      'name',
      'ueber-uns',
      'fotos',
      'adresse',
      'kontakt',
    ])
  })

  it('Hofprofil und Auftritt stehen nie als eigene Aufgabe — ihre Teile zählt die Hofseiten-Liste einzeln', () => {
    const { liste } = bauen(FRISCH, { produkte: 0 })
    expect(ids(liste)).not.toContain('profil')
    expect(ids(liste)).not.toContain('auftritt')
  })

  it('Zustände sind keine Aufgabe: pausiert, Abschnitte und die Zahlungszeile der Hofseite fehlen', () => {
    const { liste } = bauen({ ...FRISCH, isPaused: true, acceptsOnline: false }, { produkte: 0, stripeImKasten: true })
    expect(ids(liste)).not.toContain('bestellungen')
    expect(ids(liste)).not.toContain('abschnitte')
    expect(ids(liste)).not.toContain('zahlung')
  })

  it('Titel, Satz und Ziel kommen aus den beiden Quellen, keine dritte Fassung', () => {
    const { schritte, fortschritt, liste } = bauen(FRISCH, { produkte: 0 })
    const zeilen = fortschritt.gruppen.flatMap((g) => g.zeilen)
    for (const aufgabe of liste.aufgaben) {
      const schritt = schritte.find((s) => s.id === aufgabe.id)
      if (schritt && ['produkt', 'abholzeiten', 'zahlung'].includes(aufgabe.id)) {
        expect(aufgabe, aufgabe.id).toEqual({ id: aufgabe.id, titel: schritt.titel, satz: schritt.nutzen, href: schritt.href })
        continue
      }
      const zeile = zeilen.find((z) => z.id === aufgabe.id)
      expect(zeile, aufgabe.id).toBeDefined()
      expect(aufgabe, aufgabe.id).toEqual({
        id: aufgabe.id,
        titel: zeile?.titel,
        satz: zeile?.wert,
        href: EINSTELLUNG_FUER_ZEILE[aufgabe.id as keyof typeof EINSTELLUNG_FUER_ZEILE],
      })
    }
  })

  it('die Online-Zahlung sagt den Satz aus konditionen.ts und führt in die Zahlungs-Einstellungen', () => {
    const zahlung = bauen(FRISCH, { produkte: 0 }).liste.aufgaben.find((a) => a.id === 'zahlung')
    expect(zahlung).toEqual({
      id: 'zahlung',
      titel: ONLINE_ZAHLUNG_EINRICHTEN_TITEL,
      satz: ONLINE_ZAHLUNG_EINRICHTEN_SATZ,
      href: '/settings/payments',
    })
  })
})

describe('was der Kasten zeigt, nicht noch einmal (Register F4, Vermerk 10.10.2026)', () => {
  const zahlungsTitel = (liste: ZuTun) => liste.aufgaben.filter((a) => a.titel === ONLINE_ZAHLUNG_EINRICHTEN_TITEL).length

  it('neuer Hof ohne Stripe, freigeschaltet: der Kasten sagt es — die Liste nicht', () => {
    const neu = { ...FERTIG, logoUrl: null, bannerType: 'GRADIENT', aboutText: null, farmPhotos: [], stripeAccountReady: false }
    const { liste } = bauen(neu, { stripeImKasten: true })
    expect(zahlungsTitel(liste)).toBe(0)
    expect(ids(liste)).toEqual(['titelbild', 'logo', 'ueber-uns', 'fotos'])
  })

  it('ohne Kasten (wartet auf Freischaltung): genau einmal in der Liste', () => {
    const { liste } = bauen({ ...FERTIG, stripeAccountReady: false }, { stripeImKasten: false })
    expect(zahlungsTitel(liste)).toBe(1)
    expect(ids(liste)).toEqual(['zahlung'])
  })

  it('steht nur die Online-Zahlung aus und zeigt sie der Kasten, verschwindet die Liste', () => {
    const { liste } = bauen({ ...FERTIG, stripeAccountReady: false }, { stripeImKasten: true })
    expect(liste.aufgaben).toEqual([])
    expect(liste.anzeigen).toBe(false)
  })

  it('mit fertigem Stripe steht nichts zur Zahlung da — auch ohne Online an (keine neue Aufgabe)', () => {
    expect(ids(bauen({ ...FERTIG, acceptsOnline: false }).liste)).toEqual([])
  })
})

describe('Erledigtes verschwindet', () => {
  it('fertig eingerichteter Hof: keine Aufgabe, die Liste verschwindet ganz', () => {
    const { liste } = bauen(FERTIG)
    expect(liste).toEqual({ aufgaben: [], anzeigen: false })
    expect(ersteSchritteAnzeige(liste, false)).toBe('nichts')
    expect(ersteSchritteAnzeige(liste, true)).toBe('nichts')
  })

  it('eine offene Aufgabe genügt, damit die Liste steht; weggeklickt kommt die Zeile zum Einblenden', () => {
    const { liste } = bauen({ ...FERTIG, farmPhotos: [] })
    expect(ids(liste)).toEqual(['fotos'])
    expect(liste.anzeigen).toBe(true)
    expect(ersteSchritteAnzeige(liste, false)).toBe('karte')
    expect(ersteSchritteAnzeige(liste, true)).toBe('zeile')
  })

  it('Logo da, Titelbild fehlt: nur das Titelbild steht noch da', () => {
    expect(ids(bauen({ ...FERTIG, bannerType: 'GRADIENT' }).liste)).toEqual(['titelbild'])
  })

  it('Standort gesetzt, Kurzbeschreibung leer: nur die Kurzbeschreibung steht noch da', () => {
    expect(ids(bauen({ ...FERTIG, description: '   ' }).liste)).toEqual(['name'])
  })
})

/**
 * Jede Kombination der zehn Bedingungen (2^10 Höfe, je mit und ohne Kasten):
 * Die Liste steht so, wie die beiden Quellen es sagen — nicht mehr und nicht
 * weniger, und keine Aufgabe zweimal.
 */
describe('jede Aufgabe einmal — für jeden Hof', () => {
  const schalter: ((hof: Hof) => Hof)[] = [
    (h) => ({ ...h, description: '' }),
    (h) => ({ ...h, latitude: null, longitude: null }),
    (h) => ({ ...h, logoUrl: '' }),
    (h) => ({ ...h, bannerType: 'GRADIENT' }),
    (h) => ({ ...h, aboutText: null }),
    (h) => ({ ...h, farmPhotos: [] }),
    (h) => ({ ...h, pickupSlots: [] }),
    (h) => ({ ...h, stripeAccountReady: false }),
    (h) => ({ ...h, email: '' }),
  ]
  const faelle: { hof: Hof; produkte: number }[] = []
  for (let maske = 0; maske < 2 ** (schalter.length + 1); maske++) {
    const hof = schalter.reduce((h, s, i) => (maske & (1 << i) ? s(h) : h), FERTIG)
    faelle.push({ hof, produkte: maske & (1 << schalter.length) ? 0 : 2 })
  }

  it.each([false, true])('stripeImKasten=%s: offen in den Quellen ⇔ in der Liste, keine Aufgabe doppelt', (stripeImKasten) => {
    expect(faelle).toHaveLength(1024)
    for (const { hof, produkte } of faelle) {
      const { schritte, fortschritt, liste } = bauen(hof, { produkte, stripeImKasten })
      const offen = new Set(ids(liste))
      expect(offen.size, 'doppelt').toBe(liste.aufgaben.length)

      const schritt = (id: string) => schritte.find((s) => s.id === id)
      const zeile = (id: string) => fortschritt.gruppen.flatMap((g) => g.zeilen).find((z) => z.id === id)

      // Ein Schritt der Ersten Schritte ist offen ⇔ eine seiner Aufgaben steht da.
      expect(!schritt('profil')?.erledigt).toBe(offen.has('name') || offen.has('adresse'))
      expect(!schritt('auftritt')?.erledigt).toBe(offen.has('titelbild') || offen.has('logo'))
      expect(!schritt('produkt')?.erledigt).toBe(offen.has('produkt'))
      expect(!schritt('abholzeiten')?.erledigt).toBe(offen.has('abholzeiten'))
      expect(!schritt('zahlung')?.erledigt && !stripeImKasten).toBe(offen.has('zahlung'))

      // Jede Zeile der Hofseite: nicht fertig ⇔ sie steht da (die Zahlungszeile zählt dort immer als fertig).
      for (const id of ['titelbild', 'logo', 'name', 'ueber-uns', 'fotos', 'adresse', 'abholzeiten', 'kontakt'] as const) {
        expect(!zeile(id)?.fertig, id).toBe(offen.has(id))
      }

      // „Online-Zahlung einrichten" höchstens einmal, nie neben dem Kasten.
      const zahlung = liste.aufgaben.filter((a) => a.titel === ONLINE_ZAHLUNG_EINRICHTEN_TITEL).length
      expect(zahlung).toBeLessThanOrEqual(stripeImKasten ? 0 : 1)
      expect(liste.anzeigen).toBe(liste.aufgaben.length > 0)
    }
  })
})
