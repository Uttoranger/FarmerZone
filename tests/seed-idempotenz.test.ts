/**
 * Tests des Testdatensatzes (prisma/seed-daten.ts) und seines Laufs
 * (prisma/seed-lauf.ts).
 *
 * ZWEI AUSSAGEN:
 *
 * 1. **Ein zweiter Lauf erzeugt keine Dubletten.** Geprüft nicht daran, dass
 *    irgendwo `upsert` steht, sondern an einem Speicher mit echter
 *    Upsert-Semantik: `seed()` läuft zweimal, danach stehen genau so viele
 *    Zeilen da wie nach dem ersten Lauf. Vor diesem Sprint legte jeder
 *    `pnpm db:seed` zwei Abholzeiten und drei Handverkäufe erneut an —
 *    `createMany({ skipDuplicates })` überspringt nur, was einen EINDEUTIGEN
 *    Index verletzt, und `PickupSlot` wie `ManualSale` haben keinen.
 *
 * 2. **Der Datensatz deckt die Fälle ab, für die er da ist.** Alle vier
 *    Futter-Kategorien, alle neun Lebensmittel-Kategorien, beide
 *    Gebindeklassen beim Wiesenheu, jeder OrderStatus, jede Zahlungsart, die
 *    Umkreisstufen einzeln trennbar — und nichts, was nach echten Daten
 *    aussieht. Diese Zusicherungen sind der Grund, warum der Datensatz nicht
 *    beim nächsten Anfassen auseinanderfällt.
 *
 * Kein echter Prisma-Client, keine Datenbank, kein Better Auth: Der Lauf nimmt
 * beides als Parameter (siehe Kommentar in seed-lauf.ts).
 */
import { describe, it, expect, vi } from 'vitest'
import { seed, type SeedAuth, type SeedPrisma } from '../prisma/seed-lauf'
import {
  SEED_BESTELLUNGEN,
  SEED_HANDVERKAEUFE,
  SEED_HOEFE,
  SEED_KONTEN,
  SEED_KOSTENPOSTEN,
  SEED_MELDUNGEN,
} from '../prisma/seed-daten'
import { UMKREIS_STUFEN, entfernungKm } from '@/lib/hofuebersicht'

/** Die Grenzen des Umkreis-Reglers (10, 25, 50 km) — aus derselben Quelle wie /hoefe. */
const UMKREIS_GRENZEN_KM = UMKREIS_STUFEN.filter((s): s is 10 | 25 | 50 => s !== null)
import { bereichVon, istGrossgebinde, unterkategorienVon } from '@/lib/taxonomie'

const JETZT = new Date('2026-09-26T10:00:00.000Z')

// ─── Ein Speicher mit echter Upsert-Semantik ─────────────────────────────────

type Zeile = Record<string, unknown>

/**
 * Bildet `upsert` so nach, wie Postgres es tut: Der `where`-Schlüssel
 * entscheidet, ob `create` oder `update` gilt. Mehr braucht der Beweis nicht —
 * und weniger würde ihn wertlos machen.
 */
function macheSpeicher() {
  const tabellen = new Map<string, Map<string, Zeile>>()
  /** Jedes `update`-Nutzlast-Objekt, zur Prüfung auf verschachtelte Anlagen. */
  const updates: Array<{ tabelle: string; daten: Zeile }> = []
  /** Jedes `create`-Nutzlast-Objekt — daran hängen die Zusicherungen über Werte. */
  const creates: Array<{ tabelle: string; daten: Zeile }> = []

  function tabelle(name: string): Map<string, Zeile> {
    const vorhanden = tabellen.get(name)
    if (vorhanden) return vorhanden
    const neu = new Map<string, Zeile>()
    tabellen.set(name, neu)
    return neu
  }

  function upsert(name: string) {
    return vi.fn(async (argumente: unknown) => {
      const a = argumente as { where: Zeile; create: Zeile; update: Zeile }
      const t = tabelle(name)
      const schluessel = JSON.stringify(a.where)
      const vorhanden = t.get(schluessel)
      if (vorhanden) {
        updates.push({ tabelle: name, daten: a.update })
        t.set(schluessel, { ...vorhanden, ...a.update })
      } else {
        creates.push({ tabelle: name, daten: a.create })
        t.set(schluessel, { ...a.create })
      }
      const zeile = t.get(schluessel)!
      // Die Rückgabe, die der Lauf braucht — für Höfe auch die
      // Gebühreneinstellung, aus der er die Bestellgebühren rechnet.
      return {
        id: `id-${String(a.create['slug'] ?? a.create['id'] ?? schluessel)}`,
        slug: String(a.create['slug'] ?? ''),
        name: String(zeile['name'] ?? ''),
        serviceFeePercent: zeile['serviceFeePercent'] ?? '4.90',
        serviceFeeMinCents: zeile['serviceFeeMinCents'] ?? 50,
        serviceFeeActiveFrom: zeile['serviceFeeActiveFrom'] ?? null,
        latitude: zeile['latitude'] ?? null,
        longitude: zeile['longitude'] ?? null,
        betriebsnummer: zeile['betriebsnummer'] ?? null,
      }
    })
  }

  const konten = new Map<string, string>()

  const prisma = {
    user: {
      findUnique: vi.fn(async (argumente: unknown) => {
        const email = (argumente as { where: { email?: string } }).where.email
        const id = email === undefined ? undefined : konten.get(email)
        return id === undefined ? null : { id }
      }),
      update: vi.fn(async () => ({})),
    },
    farm: {
      findUnique: vi.fn(async (argumente: unknown) => {
        const a = argumente as { where: Zeile }
        return tabelle('farm').get(JSON.stringify(a.where)) ?? null
      }),
      upsert: upsert('farm'),
    },
    product: { upsert: upsert('product') },
    pickupSlot: { upsert: upsert('pickupSlot') },
    manualSale: { upsert: upsert('manualSale') },
    order: { upsert: upsert('order') },
    kostenposten: { upsert: upsert('kostenposten') },
    meldung: { upsert: upsert('meldung') },
  } as unknown as SeedPrisma

  const signUpEmail = vi.fn(async (eingabe: { body: { email: string } }) => {
    const id = `user-${konten.size + 1}`
    konten.set(eingabe.body.email, id)
    return { user: { id } }
  })
  const auth = { api: { signUpEmail } } as unknown as SeedAuth

  return {
    prisma,
    auth,
    signUpEmail,
    zahl: (name: string) => tabelle(name).size,
    updates,
    creates,
    /** Einen Hof vorab hinstellen — für den Fall „existiert schon in Dev". */
    stelleHofHin: (slug: string, zeile: Zeile) =>
      tabelle('farm').set(JSON.stringify({ slug }), zeile),
  }
}

// ─── 1. Idempotenz ───────────────────────────────────────────────────────────

describe('seed — zweiter Lauf', () => {
  it('legt keine Zeile doppelt an', async () => {
    const s = macheSpeicher()

    await seed(s.prisma, s.auth, JETZT)
    const nachEins = {
      farm: s.zahl('farm'),
      product: s.zahl('product'),
      pickupSlot: s.zahl('pickupSlot'),
      manualSale: s.zahl('manualSale'),
      order: s.zahl('order'),
      kostenposten: s.zahl('kostenposten'),
      meldung: s.zahl('meldung'),
    }

    await seed(s.prisma, s.auth, new Date(JETZT.getTime() + 86_400_000))

    expect({
      farm: s.zahl('farm'),
      product: s.zahl('product'),
      pickupSlot: s.zahl('pickupSlot'),
      manualSale: s.zahl('manualSale'),
      order: s.zahl('order'),
      kostenposten: s.zahl('kostenposten'),
      meldung: s.zahl('meldung'),
    }).toEqual(nachEins)
  })

  it('legt genau die erwartete Zahl an Zeilen an', async () => {
    const s = macheSpeicher()
    await seed(s.prisma, s.auth, JETZT)

    const produkte = SEED_HOEFE.reduce((summe, h) => summe + h.produkte.length, 0)
    const abholzeiten = SEED_HOEFE.reduce((summe, h) => summe + h.abholzeiten.length, 0)

    expect(s.zahl('farm')).toBe(SEED_HOEFE.length)
    expect(s.zahl('product')).toBe(produkte)
    expect(s.zahl('pickupSlot')).toBe(abholzeiten)
    expect(s.zahl('order')).toBe(SEED_BESTELLUNGEN.length)
    expect(s.zahl('manualSale')).toBe(SEED_HANDVERKAEUFE.length)
    expect(s.zahl('kostenposten')).toBe(SEED_KOSTENPOSTEN.length)
    expect(s.zahl('meldung')).toBe(SEED_MELDUNGEN.length)
  })

  it('meldet niemanden zweimal bei Better Auth an', async () => {
    const s = macheSpeicher()
    await seed(s.prisma, s.auth, JETZT)
    const nachEins = s.signUpEmail.mock.calls.length

    await seed(s.prisma, s.auth, JETZT)

    // Ein Konto je Hof plus die drei Konten ohne Hof.
    expect(nachEins).toBe(SEED_HOEFE.length + SEED_KONTEN.length)
    expect(s.signUpEmail.mock.calls.length).toBe(nachEins)
  })

  it('legt beim Aktualisieren einer Bestellung keine Positionen nach', async () => {
    // Positionen hängen an der Bestellung. Stünden sie im `update`, bekäme jede
    // Bestellung bei jedem Lauf dieselbe Ware ein zweites Mal.
    const s = macheSpeicher()
    await seed(s.prisma, s.auth, JETZT)
    await seed(s.prisma, s.auth, JETZT)

    const bestellUpdates = s.updates.filter((u) => u.tabelle === 'order')
    expect(bestellUpdates.length).toBe(SEED_BESTELLUNGEN.length)
    for (const u of bestellUpdates) expect(u.daten['items']).toBeUndefined()
  })

  it('ergänzt beim Pilothof, was fehlt — und nur das', async () => {
    // „Der Pilothof bleibt, wie er ist": Der Hof liegt schon da, ohne
    // Kartenpunkt und ohne Gebühren-Geltung. Beides wird ergänzt, alles andere
    // bleibt unberührt.
    const s = macheSpeicher()
    s.stelleHofHin('hof-mueller', {
      name: 'Hof Müller',
      address: 'Echte Adresse aus Dev',
      description: 'Echter Text aus Dev',
      approvedAt: new Date('2026-01-01T00:00:00.000Z'),
      latitude: null,
      longitude: null,
      betriebsnummer: null,
      serviceFeeActiveFrom: null,
    })

    await seed(s.prisma, s.auth, JETZT)

    const pilot = s.updates.find((u) => u.tabelle === 'farm' && 'latitude' in u.daten)
    expect(pilot).toBeDefined()
    // Die Ortsmitte von Mauerkirchen — die eingetragene Adresse bleibt (siehe unten).
    expect(pilot!.daten['latitude']).toBe(48.1908)
    expect(pilot!.daten['longitude']).toBe(13.1353)
    expect(pilot!.daten['serviceFeeActiveFrom']).toBeInstanceOf(Date)
    // Nicht angefasst:
    expect(pilot!.daten['approvedAt']).toBeUndefined()
    expect(pilot!.daten['address']).toBeUndefined()
    expect(pilot!.daten['description']).toBeUndefined()
    expect(pilot!.daten['name']).toBeUndefined()
    expect(pilot!.daten['postalCode']).toBeUndefined()
    expect(pilot!.daten['city']).toBeUndefined()
    expect(pilot!.daten['country']).toBeUndefined()
  })

  it('legt Hof B in Deutschland an, alle anderen neuen Höfe in Österreich', async () => {
    const s = macheSpeicher()
    await seed(s.prisma, s.auth, JETZT)
    const hoefe = s.creates.filter((c) => c.tabelle === 'farm')
    expect(hoefe.find((c) => c.daten['slug'] === 'hof-bergwiese')?.daten['country']).toBe('DE')
    for (const c of hoefe.filter((c) => c.daten['slug'] !== 'hof-bergwiese')) {
      expect(c.daten['country'], String(c.daten['slug'])).toBe('AT')
    }
  })

  it('schreibt beim Pilothof nichts mehr, wenn nichts fehlt', async () => {
    const s = macheSpeicher()
    s.stelleHofHin('hof-mueller', {
      name: 'Hof Müller',
      address: 'Echte Adresse aus Dev',
      approvedAt: new Date('2026-01-01T00:00:00.000Z'),
      latitude: 47.0,
      longitude: 15.0,
      betriebsnummer: 'LFBIS 9999999',
      serviceFeeActiveFrom: new Date('2026-02-01T00:00:00.000Z'),
      serviceFeePercent: '3.00',
      serviceFeeMinCents: 30,
    })

    await seed(s.prisma, s.auth, JETZT)

    const pilot = s.updates.filter((u) => u.tabelle === 'farm')[0]
    expect(pilot).toBeDefined()
    // Leeres Update: Es fehlte nichts. Der eigene Kartenpunkt bleibt stehen.
    expect(Object.keys(pilot!.daten)).toHaveLength(0)
  })

  it('rechnet die Gebühr aus der Einstellung DES HOFES, nicht aus einer Konstante', async () => {
    // TD-0001: sechs Liter Heumilch à 1,40 € = 8,40 € Warenpreis.
    //   Vorgabe 4,9 % / mind. 50 → 41 Cent, angehoben auf 50.
    //   Dieser Hof: 3,0 % / mind. 30 → 25 Cent, angehoben auf 30.
    // Steht 50 in der Bestellung, rechnet der Seed an der Hofeinstellung vorbei.
    const s = macheSpeicher()
    s.stelleHofHin('hof-mueller', {
      name: 'Hof Müller',
      latitude: 47.0,
      longitude: 15.0,
      betriebsnummer: 'LFBIS 9999999',
      serviceFeeActiveFrom: new Date('2020-01-01T00:00:00.000Z'),
      serviceFeePercent: '3.00',
      serviceFeeMinCents: 30,
    })

    await seed(s.prisma, s.auth, JETZT)

    const erste = s.creates.find(
      (c) => c.tabelle === 'order' && c.daten['orderNumber'] === 'TD-0001'
    )
    expect(erste).toBeDefined()
    expect(erste!.daten['totalAmount']).toBe('8.40')
    expect(erste!.daten['serviceFeeCents']).toBe(30)
    expect(erste!.daten['serviceFeePercentApplied']).toBe('3.00')
  })

  it('nimmt bei einem neuen Hof die Vorgabe 4,9 % / mind. 50 Cent', async () => {
    const s = macheSpeicher()
    await seed(s.prisma, s.auth, JETZT)

    const erste = s.creates.find(
      (c) => c.tabelle === 'order' && c.daten['orderNumber'] === 'TD-0001'
    )
    expect(erste!.daten['serviceFeeCents']).toBe(50)
    expect(erste!.daten['serviceFeePercentApplied']).toBe('4.90')

    const hof = s.creates.find((c) => c.tabelle === 'farm')
    expect(hof!.daten['serviceFeePercent']).toBe('4.90')
    expect(hof!.daten['serviceFeeMinCents']).toBe(50)
  })

  it('setzt paidAt auch bei einer erstatteten Bestellung', async () => {
    // Erstattet werden kann nur, was vorher bezahlt war.
    const s = macheSpeicher()
    await seed(s.prisma, s.auth, JETZT)
    for (const c of s.creates.filter((x) => x.tabelle === 'order')) {
      if (c.daten['paymentStatus'] === 'REFUNDED') expect(c.daten['paidAt']).toBeInstanceOf(Date)
    }
  })

  it('markiert jedes Futtermittel als Urproduktion, sonst nichts', async () => {
    const s = macheSpeicher()
    await seed(s.prisma, s.auth, JETZT)
    const produkte = s.creates.filter((c) => c.tabelle === 'product')
    const urproduktion = produkte.filter((c) => c.daten['countsTowardLimit'] === false)
    // So viele Produkte tragen eine Kennzeichnung.
    const futter = SEED_HOEFE.flatMap((h) => h.produkte).filter((p) => p.futter !== undefined)
    expect(urproduktion).toHaveLength(futter.length)
    // Und kein Lebensmittel bekommt das Feld überhaupt gesetzt.
    for (const c of produkte) {
      if (c.daten['countsTowardLimit'] !== undefined) {
        expect(c.daten['countsTowardLimit']).toBe(false)
      }
    }
  })
})

// ─── 2. Der Datensatz selbst ─────────────────────────────────────────────────

const ALLE_PRODUKTE = SEED_HOEFE.flatMap((h) => h.produkte.map((p) => ({ hof: h, p })))

describe('Testdaten — nichts Echtes', () => {
  it('benutzt ausschließlich @example.com', () => {
    const mails = [
      ...SEED_KONTEN.map((k) => k.email),
      ...SEED_HOEFE.map((h) => h.inhaber.email),
      ...SEED_BESTELLUNGEN.map((b) => b.kundenEmail),
    ]
    for (const mail of mails) expect(mail).toMatch(/@example\.com$/)
  })

  it('benutzt für alle NEUEN Höfe das Nummernschema +43 660 000xxxx', () => {
    for (const h of SEED_HOEFE) {
      if (h.bestandsHof === true) continue
      expect(h.inhaber.telefon, h.slug).toMatch(/^\+43 660 000\d{4}$/)
    }
    for (const k of SEED_KONTEN) expect(k.telefon).toMatch(/^\+43 660 000\d{4}$/)
  })

  it('kennt genau eine Ausnahme vom Nummernschema — den Pilothof aus der Zeit davor', () => {
    // `+43 664 123 4567` und `LFBIS 1234567` stehen seit dem ersten Seed im
    // Repository und sehen echter aus, als sie sind. Sie bleiben, weil „der
    // Pilothof bleibt, wie er ist" — dieser Test hält sie fest, damit die
    // Ausnahme eine benannte Ausnahme ist und nicht eine lasche Regex.
    const bestand = SEED_HOEFE.filter((h) => h.bestandsHof === true)
    expect(bestand).toHaveLength(1)
    expect(bestand[0]!.inhaber.telefon).toBe('+43 664 123 4567')
    expect(bestand[0]!.betriebsnummer).toBe('LFBIS 1234567')
  })

  it('macht Betriebsnummern als Testwerte erkennbar', () => {
    const nummern = SEED_HOEFE.map((h) => h.betriebsnummer).filter((n): n is string => n !== null)
    expect(nummern.length).toBeGreaterThanOrEqual(2)
    // Neue Höfe: TEST-… bzw. die deutsche Form mit Nullen (Hof B); der
    // Pilothof behält seine alte Nummer (eigener Test).
    for (const n of nummern) expect(n).toMatch(/^(TEST-|LFBIS |09 000 000 )/)
  })

  it('vergibt jeden Schlüssel nur einmal', () => {
    const slugs = SEED_HOEFE.map((h) => h.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    const produktIds = ALLE_PRODUKTE.map(({ p }) => p.id)
    expect(new Set(produktIds).size).toBe(produktIds.length)
    const nummern = SEED_BESTELLUNGEN.map((b) => b.nummer)
    expect(new Set(nummern).size).toBe(nummern.length)
    const mails = SEED_HOEFE.map((h) => h.inhaber.email)
    expect(new Set(mails).size).toBe(mails.length)
  })
})

describe('Testdaten — Umkreis', () => {
  const pilot = SEED_HOEFE.find((h) => h.slug === 'hof-mueller')!
  const punkt = { lat: pilot.breite!, lon: pilot.laenge! }
  const km = (slug: string) => {
    const h = SEED_HOEFE.find((x) => x.slug === slug)!
    return entfernungKm(punkt, { lat: h.breite!, lon: h.laenge! })
  }

  it('gibt dem Pilothof einen Kartenpunkt — ohne ihn gibt es keinen Bezugspunkt', () => {
    expect(pilot.breite).not.toBeNull()
    expect(pilot.laenge).not.toBeNull()
  })

  it('trennt die drei Umkreisstufen 10, 25 und 50 km einzeln', () => {
    // Genau das ist der Zweck der Orte: Jede Stufe zeigt einen Hof mehr.
    expect(km('hof-sonnleiten')).toBeLessThan(10)
    expect(km('hof-bergwiese')).toBeGreaterThan(10)
    expect(km('hof-bergwiese')).toBeLessThan(25)
    expect(km('hof-waldrand')).toBeGreaterThan(25)
    expect(km('hof-waldrand')).toBeLessThan(50)
  })

  it('hält jede Entfernung mindestens 2 km von jeder Umkreisgrenze fern — eine ungenaue Ortsmitte rutscht nie in die falsche Stufe', () => {
    // Die Koordinaten sind Ortsmitten (manche nur auf die Bogenminute genau,
    // also bis rund 1 km daneben). Mit 2 km Abstand zu 10, 25 und 50 km
    // wechselt kein Hof die Stufe, wenn jemand die Mitte genauer bestimmt.
    for (const h of SEED_HOEFE) {
      if (h.slug === 'hof-mueller' || h.breite === null || h.laenge === null) continue
      const entfernung = entfernungKm(punkt, { lat: h.breite, lon: h.laenge })
      for (const grenze of UMKREIS_GRENZEN_KM) {
        expect(Math.abs(entfernung - grenze), `${h.slug}: ${entfernung.toFixed(1)} km gegen ${grenze} km`).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('der nicht freigeschaltete Hof läge im 50-km-Umkreis — er fehlt nur wegen der Freischaltung', () => {
    expect(km('hof-wartend')).toBeLessThan(50)
  })

  it('hält jeden Hof innerhalb von 50 km', () => {
    for (const h of SEED_HOEFE) {
      if (h.breite === null || h.laenge === null) continue
      expect(entfernungKm(punkt, { lat: h.breite, lon: h.laenge })).toBeLessThan(50)
    }
  })

  it('hat genau einen Hof ohne Kartenpunkt und genau einen nicht freigeschalteten', () => {
    expect(SEED_HOEFE.filter((h) => h.breite === null).length).toBe(1)
    expect(SEED_HOEFE.filter((h) => !h.freigegeben).length).toBe(1)
  })

  it('gibt dem nicht freigeschalteten Hof Koordinaten — sonst bewiese er nichts', () => {
    // Er muss aus einem anderen Grund unsichtbar sein als „kein Standort".
    const wartend = SEED_HOEFE.find((h) => !h.freigegeben)!
    expect(wartend.breite).not.toBeNull()
    expect(wartend.produkte.length).toBeGreaterThan(0)
  })
})

describe('Testdaten — Bezirk Braunau am Inn, wo der Pilot liegt', () => {
  const hof = (slug: string) => SEED_HOEFE.find((h) => h.slug === slug)!

  it('der Bezugspunkt ist die Ortsmitte von 5270 Mauerkirchen', () => {
    const pilot = hof('hof-mueller')
    expect(pilot.plz).toBe('5270')
    expect(pilot.ort).toBe('Mauerkirchen')
    // Ortsmitte laut Gemeinde-Infobox: 48°11′27″ N, 13°08′07″ E — auf gut 100 m.
    expect(pilot.breite).toBeCloseTo(48.1908, 3)
    expect(pilot.laenge).toBeCloseTo(13.1353, 3)
  })

  it('Hof B liegt in Bayern — die Grenzregion läuft mit', () => {
    const b = hof('hof-bergwiese')
    expect(b.land).toBe('DE')
    expect(b.plz).toMatch(/^\d{5}$/)
    // Aufbau einer deutschen Betriebsnummer (12 Ziffern, 09 = Bayern), mit
    // Nullen im Kreis- und Gemeindeteil erkennbar erfunden.
    expect(b.betriebsnummer).toMatch(/^09 000 000 \d{4}$/)
  })

  it('alle übrigen Höfe liegen in Österreich, im Innviertel — keine steirische Postleitzahl mehr', () => {
    for (const h of SEED_HOEFE) {
      if (h.slug === 'hof-bergwiese') continue
      expect(h.land ?? 'AT', h.slug).toBe('AT')
      // Oberösterreich hat Postleitzahlen ab 4 und 5, die Steiermark ab 8.
      expect(h.plz, h.slug).toMatch(/^[45]\d{3}$/)
    }
  })

  it('kein Testhof in Uttendorf — dort liegt ein echter Hof der Plattform', () => {
    for (const h of SEED_HOEFE) expect(h.ort, h.slug).not.toMatch(/uttendorf/i)
  })
})

describe('Testdaten — Bereiche und Kategorien', () => {
  it('belegt jede Futter-Kategorie mindestens einmal', () => {
    const futter = new Set(
      ALLE_PRODUKTE.filter(({ p }) => bereichVon(p.category) === 'FUTTERMITTEL').map(({ p }) => p.category)
    )
    expect(futter).toEqual(new Set(['HEU_STROH', 'GETREIDE_KOERNER', 'MISCHFUTTER', 'ERGAENZUNGSFUTTER']))
  })

  it('belegt jede Lebensmittel-Kategorie mindestens einmal', () => {
    const lebensmittel = new Set(
      ALLE_PRODUKTE.filter(({ p }) => bereichVon(p.category) === 'LEBENSMITTEL').map(({ p }) => p.category)
    )
    expect(lebensmittel).toEqual(
      new Set(['MILCH', 'EIER', 'FLEISCH', 'FISCH', 'GEMUESE', 'OBST', 'BROT', 'HONIG', 'GETRAENKE'])
    )
  })

  it('setzt eine Unterkategorie, wo die Kategorie eine hat', () => {
    for (const { p } of ALLE_PRODUKTE) {
      const moeglich = unterkategorienVon(p.category)
      if (moeglich.length === 0) {
        expect(p.subcategory).toBeNull()
      } else {
        expect(moeglich).toContain(p.subcategory)
      }
    }
  })

  it('gibt jedem Futtermittel eine vollständige Kennzeichnung — und keinem anderen', () => {
    for (const { p } of ALLE_PRODUKTE) {
      if (bereichVon(p.category) === 'FUTTERMITTEL') {
        expect(p.futter, `${p.id} braucht eine Kennzeichnung`).toBeDefined()
        expect(p.futter!.zielTierarten.length).toBeGreaterThan(0)
        expect(p.futter!.zusammensetzung.length).toBeGreaterThan(0)
        expect(p.futter!.analytischeBestandteile.length).toBeGreaterThan(0)
        expect(p.futter!.nettoMenge).toBeGreaterThan(0)
        expect(p.futter!.gebrauchshinweis.length).toBeGreaterThan(0)
      } else {
        expect(p.futter, `${p.id} darf keine Kennzeichnung haben`).toBeUndefined()
      }
    }
  })

  it('bindet die Futtermittelart an die Kategorie (bereiche.md §2.4)', () => {
    const erlaubt: Record<string, string[]> = {
      HEU_STROH: ['EINZELFUTTERMITTEL'],
      GETREIDE_KOERNER: ['EINZELFUTTERMITTEL'],
      MISCHFUTTER: ['ALLEINFUTTERMITTEL'],
      ERGAENZUNGSFUTTER: ['ERGAENZUNGSFUTTERMITTEL', 'MINERALFUTTERMITTEL'],
    }
    for (const { p } of ALLE_PRODUKTE) {
      if (p.futter === undefined || p.category === null) continue
      expect(erlaubt[p.category], `${p.id}: ${p.category}`).toContain(p.futter.futtermittelart)
    }
  })

  it('führt Wiesenheu bei mindestens drei Höfen, in beiden Gebindeklassen', () => {
    const heu = ALLE_PRODUKTE.filter(({ p }) => p.subcategory === 'WIESENHEU')
    expect(new Set(heu.map(({ hof }) => hof.slug)).size).toBeGreaterThanOrEqual(3)

    const klassen = heu.map(({ p }) => istGrossgebinde(p.futter!.nettoMenge, p.futter!.nettoEinheit))
    expect(klassen).toContain(true)
    expect(klassen).toContain(false)
    // Mindestens zwei Höfe je Klasse — sonst ist die Spanne keine Spanne.
    expect(heu.filter(({ p }) => istGrossgebinde(p.futter!.nettoMenge, p.futter!.nettoEinheit)).length).toBeGreaterThanOrEqual(2)
    expect(heu.filter(({ p }) => !istGrossgebinde(p.futter!.nettoMenge, p.futter!.nettoEinheit)).length).toBeGreaterThanOrEqual(2)
  })

  it('hat ein Big Bag, ein NUR_BETRIEBE-Produkt, ein ausverkauftes und ein abgeschaltetes', () => {
    expect(ALLE_PRODUKTE.some(({ p }) => p.einheit === 'BIGBAG')).toBe(true)
    expect(ALLE_PRODUKTE.some(({ p }) => p.abgabe === 'NUR_BETRIEBE')).toBe(true)
    expect(ALLE_PRODUKTE.some(({ p }) => p.bestand === 0 && p.imShop)).toBe(true)
    expect(ALLE_PRODUKTE.some(({ p }) => !p.imShop && p.bestand > 0)).toBe(true)
  })

  it('zeigt Siegel und Allergene mindestens je einmal', () => {
    expect(ALLE_PRODUKTE.some(({ p }) => p.labels.length > 0)).toBe(true)
    expect(ALLE_PRODUKTE.some(({ p }) => (p.allergene ?? []).length > 0)).toBe(true)
  })

  it('lässt unitSize bei Ballen und Big Bags leer — das Gewicht steht in der Kennzeichnung', () => {
    for (const { p } of ALLE_PRODUKTE) {
      if (p.einheit === 'BALLEN' || p.einheit === 'BIGBAG') expect(p.gebindeGroesse).toBeNull()
    }
  })
})

describe('Testdaten — Bestellungen', () => {
  it('belegt jeden Bestellstatus', () => {
    expect(new Set(SEED_BESTELLUNGEN.map((b) => b.status))).toEqual(
      new Set([
        'PENDING_CONFIRMATION',
        'PAID',
        'CONFIRMED',
        'IN_PREPARATION',
        'READY',
        'PICKED_UP',
        'CANCELLED',
        'NOT_PICKED_UP',
      ])
    )
  })

  it('belegt alle drei Zahlungsarten, alle vier Zahlungsstatus und beide Käuferarten', () => {
    expect(new Set(SEED_BESTELLUNGEN.map((b) => b.zahlart))).toEqual(
      new Set(['ONLINE', 'ONSITE_CASH', 'ONSITE_CARD'])
    )
    expect(new Set(SEED_BESTELLUNGEN.map((b) => b.zahlstatus))).toEqual(
      new Set(['PENDING', 'PAID', 'FAILED', 'REFUNDED'])
    )
    expect(new Set(SEED_BESTELLUNGEN.map((b) => b.kaeuferArt))).toEqual(new Set(['PRIVAT', 'BETRIEB']))
  })

  it('bestellt nur Ware, die es gibt, und nur bei Höfen, die es gibt', () => {
    const produktIds = new Set(ALLE_PRODUKTE.map(({ p }) => p.id))
    const slugs = new Set(SEED_HOEFE.map((h) => h.slug))
    for (const b of SEED_BESTELLUNGEN) {
      expect(slugs).toContain(b.hofSlug)
      expect(b.positionen.length).toBeGreaterThan(0)
      for (const pos of b.positionen) {
        expect(produktIds, `${b.nummer}: ${pos.produktId}`).toContain(pos.produktId)
        // Die Ware muss beim BESTELLTEN Hof liegen, nicht bei irgendeinem.
        const hof = SEED_HOEFE.find((h) => h.produkte.some((p) => p.id === pos.produktId))!
        expect(hof.slug, `${b.nummer}: ${pos.produktId}`).toBe(b.hofSlug)
      }
    }
  })

  it('bezahlt bei einem Hof ohne Online-Zahlung nichts online', () => {
    for (const b of SEED_BESTELLUNGEN) {
      const hof = SEED_HOEFE.find((h) => h.slug === b.hofSlug)!
      if (!hof.nimmtOnline) expect(b.zahlart, b.nummer).not.toBe('ONLINE')
    }
  })

  it('bestellt NUR_BETRIEBE-Ware ausschließlich als Betrieb', () => {
    for (const b of SEED_BESTELLUNGEN) {
      const nurBetriebe = b.positionen.some(({ produktId }) =>
        ALLE_PRODUKTE.some(({ p }) => p.id === produktId && p.abgabe === 'NUR_BETRIEBE')
      )
      if (nurBetriebe) expect(b.kaeuferArt, b.nummer).toBe('BETRIEB')
    }
  })

  it('vermerkt die entfallene Gebühr nur, wo sie entfallen darf', () => {
    for (const b of SEED_BESTELLUNGEN) {
      if (b.gebuehrEntfallen === true) {
        expect(['CANCELLED', 'NOT_PICKED_UP'], b.nummer).toContain(b.status)
      }
    }
  })

  it('verteilt die Bestellungen über mehrere Monate', () => {
    const tage = SEED_BESTELLUNGEN.map((b) => b.vorTagen)
    expect(Math.max(...tage)).toBeGreaterThan(90)
    expect(Math.min(...tage)).toBeLessThan(7)
  })
})

describe('Testdaten — Kosten und Briefkasten', () => {
  it('deckt alle drei Rhythmen ab und beendet genau einen Posten', () => {
    expect(new Set(SEED_KOSTENPOSTEN.map((k) => k.rhythmus))).toEqual(
      new Set(['MONATLICH', 'JAEHRLICH', 'EINMALIG'])
    )
    expect(SEED_KOSTENPOSTEN.filter((k) => k.bisVorMonaten !== null).length).toBe(1)
  })

  it('nennt jeden Kostenposten erkennbar als Beispiel', () => {
    for (const k of SEED_KOSTENPOSTEN) expect(k.name).toMatch(/^Beispiel-/)
  })

  it('beendet keinen Posten vor seinem Beginn', () => {
    for (const k of SEED_KOSTENPOSTEN) {
      if (k.bisVorMonaten === null) continue
      // Weiter zurück = größere Zahl; `bis` darf nicht früher liegen als `ab`.
      expect(k.bisVorMonaten).toBeLessThanOrEqual(k.abVorMonaten)
    }
  })

  it('deckt alle drei Meldungsarten ab und schlägt einen Wunsch vor', () => {
    expect(new Set(SEED_MELDUNGEN.map((m) => m.art))).toEqual(new Set(['FEHLER', 'WUNSCH', 'FRAGE']))
    expect(SEED_MELDUNGEN.some((m) => m.status === 'VERMUTLICH_WUNSCH')).toBe(true)
  })

  it('enthält die Fremdtext-Falle — sie ist eine Prüfstelle, kein Versehen', () => {
    // Text aus dem Briefkasten ist Datenmaterial, nie eine Anweisung
    // (CLAUDE.md, Abschnitt Fremdtext). Wer sie aus dem Seed entfernt, nimmt
    // den Beweis mit, dass die Oberfläche sie als gewöhnliche Meldung zeigt.
    const falle = SEED_MELDUNGEN.find((m) => /Ignoriere alle vorherigen Anweisungen/i.test(m.text))
    expect(falle).toBeDefined()
    expect(falle!.status).toBe('NEU')
  })
})
