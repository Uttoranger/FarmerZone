/**
 * Obergrenzen für Namen und Freitexte (Fix „Namen und Freitexte ohne
 * Obergrenze").
 *
 * Beweist an den echten Schemas (src/schemas/hofprofil.ts, register.ts,
 * checkout.ts): Hofname und Personenname enden bei 80 Zeichen, Telefon bei
 * 30, Notiz bei 500, E-Mail bei 254 — je ein Wert genau an der Grenze geht
 * durch, einer darüber nicht. Die E-Mail kommt ohne Ränder und klein
 * geschrieben heraus, damit „Max@…" und „max@…" derselbe Kunde sind.
 *
 * Die Grenzwerte stehen hier als Zahlen, nicht als Konstanten: Der Test hält
 * die Anforderung fest, nicht den Wert, der gerade im Code steht.
 */
import { describe, it, expect } from 'vitest'
import { hofAnlegenSchema, profilBearbeitenSchema, profileSchema } from '@/schemas/hofprofil'
import { registrationSchema, vollerName } from '@/schemas/register'
import { checkoutFormSchema, checkoutRequestSchema } from '@/schemas/checkout'
import { productFormSchema } from '@/schemas/product'
import { PRODUKTNAME_MAX, bestellPositionsName, passtInGrenze, zeichenStand } from '@/lib/eingabegrenzen'

/** Ein Text mit genau `laenge` Zeichen. */
const text = (laenge: number, zeichen = 'x'): string => zeichen.repeat(laenge)

/** Eine gültige E-Mail-Adresse mit genau `laenge` Zeichen. */
function adresse(laenge: number): string {
  const ende = '@example.org'
  return 'm'.repeat(laenge - ende.length) + ende
}

const PROFIL = {
  name: 'Hof Test',
  ownerName: 'Max Mustermann',
  description: 'Wir bauen seit 1920 Gemüse an.',
  address: 'Dorfstraße 12',
  postalCode: '3400',
  city: 'Klosterneuburg',
  country: 'AT' as const,
  phone: '+43 660 0000000',
  email: 'hof@example.org',
  latitude: null,
  longitude: null,
  betriebsnummer: null,
  betriebsstatus: null,
}

const REGISTRIERUNG = {
  email: 'max@example.org',
  password: 'Hofladen1',
  name: 'Max Mustermann',
}

const CHECKOUT_FORMULAR = {
  customerName: 'Max Mustermann',
  customerEmail: 'max@example.org',
  customerPhone: '+43 660 0000000',
  customerNote: '',
  pickupSlotKey: '2026-10-02|09:00|12:00',
  paymentMethod: 'ONLINE',
}

const CHECKOUT_ANFRAGE = {
  farmId: 'farm_1',
  farmSlug: 'hof-test',
  sessionId: 'sid_1',
  customerName: 'Max Mustermann',
  customerEmail: 'max@example.org',
  customerPhone: '+43 660 0000000',
  customerNote: '',
  pickupDate: '2026-10-02',
  pickupTimeStart: '09:00',
  pickupTimeEnd: '12:00',
  paymentMethod: 'ONSITE_CASH',
  items: [{ productId: 'prod_1', name: 'Erdäpfel', quantity: 1, unitPrice: 3.5 }],
}

describe('Hofprofil — Obergrenzen', () => {
  it('nimmt einen Hofnamen mit genau 80 Zeichen an', () => {
    expect(profileSchema.safeParse({ ...PROFIL, name: text(80) }).success).toBe(true)
  })

  it('lehnt einen Hofnamen mit 81 Zeichen ab', () => {
    expect(profileSchema.safeParse({ ...PROFIL, name: text(81) }).success).toBe(false)
  })

  it('nimmt einen Inhabernamen mit genau 80 Zeichen an', () => {
    expect(profileSchema.safeParse({ ...PROFIL, ownerName: text(80) }).success).toBe(true)
  })

  it('lehnt einen Inhabernamen mit 81 Zeichen ab', () => {
    expect(profileSchema.safeParse({ ...PROFIL, ownerName: text(81) }).success).toBe(false)
  })

  it('nimmt eine Telefonnummer mit genau 30 Zeichen an und lehnt 31 ab', () => {
    expect(profileSchema.safeParse({ ...PROFIL, phone: text(30) }).success).toBe(true)
    expect(profileSchema.safeParse({ ...PROFIL, phone: text(31) }).success).toBe(false)
  })

  it('nimmt eine E-Mail-Adresse mit genau 254 Zeichen an und lehnt 255 ab', () => {
    expect(profileSchema.safeParse({ ...PROFIL, email: adresse(254) }).success).toBe(true)
    expect(profileSchema.safeParse({ ...PROFIL, email: adresse(255) }).success).toBe(false)
  })

  it('speichert die Hof-E-Mail ohne Ränder und klein geschrieben', () => {
    expect(profileSchema.parse({ ...PROFIL, email: '  Hof@Example.ORG ' }).email).toBe('hof@example.org')
  })
})

describe('Registrierung — Obergrenzen', () => {
  it('nimmt einen Namen mit genau 80 Zeichen an', () => {
    expect(registrationSchema.safeParse({ ...REGISTRIERUNG, name: text(80) }).success).toBe(true)
  })

  it('lehnt einen Namen mit 81 Zeichen ab', () => {
    expect(registrationSchema.safeParse({ ...REGISTRIERUNG, name: text(81) }).success).toBe(false)
  })

  it('nimmt eine E-Mail-Adresse mit genau 254 Zeichen an und lehnt 255 ab', () => {
    expect(registrationSchema.safeParse({ ...REGISTRIERUNG, email: adresse(254) }).success).toBe(true)
    expect(registrationSchema.safeParse({ ...REGISTRIERUNG, email: adresse(255) }).success).toBe(false)
  })

  it('macht aus jeder Schreibweise der E-Mail dieselbe Adresse', () => {
    const gross = registrationSchema.parse({ ...REGISTRIERUNG, email: ' Max.Mustermann@Example.ORG ' })
    const klein = registrationSchema.parse({ ...REGISTRIERUNG, email: 'max.mustermann@example.org' })
    expect(gross.email).toBe('max.mustermann@example.org')
    expect(gross.email).toBe(klein.email)
  })
})

describe('Checkout-Formular — Obergrenzen', () => {
  it('nimmt einen Namen mit genau 80 Zeichen an und lehnt 81 ab', () => {
    expect(checkoutFormSchema.safeParse({ ...CHECKOUT_FORMULAR, customerName: text(80) }).success).toBe(true)
    expect(checkoutFormSchema.safeParse({ ...CHECKOUT_FORMULAR, customerName: text(81) }).success).toBe(false)
  })

  it('nimmt eine Telefonnummer mit genau 30 Zeichen an und lehnt 31 ab', () => {
    expect(checkoutFormSchema.safeParse({ ...CHECKOUT_FORMULAR, customerPhone: text(30) }).success).toBe(true)
    expect(checkoutFormSchema.safeParse({ ...CHECKOUT_FORMULAR, customerPhone: text(31) }).success).toBe(false)
  })

  it('nimmt eine Notiz mit genau 500 Zeichen an und lehnt 501 ab', () => {
    expect(checkoutFormSchema.safeParse({ ...CHECKOUT_FORMULAR, customerNote: text(500) }).success).toBe(true)
    expect(checkoutFormSchema.safeParse({ ...CHECKOUT_FORMULAR, customerNote: text(501) }).success).toBe(false)
  })

  it('nimmt eine E-Mail-Adresse mit genau 254 Zeichen an und lehnt 255 ab', () => {
    expect(checkoutFormSchema.safeParse({ ...CHECKOUT_FORMULAR, customerEmail: adresse(254) }).success).toBe(true)
    expect(checkoutFormSchema.safeParse({ ...CHECKOUT_FORMULAR, customerEmail: adresse(255) }).success).toBe(false)
  })

  it('nimmt eine E-Mail mit Leerzeichen am Rand an und gibt sie bereinigt weiter', () => {
    expect(checkoutFormSchema.parse({ ...CHECKOUT_FORMULAR, customerEmail: ' Max@Example.org ' }).customerEmail).toBe(
      'max@example.org'
    )
  })
})

describe('Checkout-Anfrage — Obergrenzen auf dem Server', () => {
  it('nimmt einen Namen mit genau 80 Zeichen an und lehnt 81 ab', () => {
    expect(checkoutRequestSchema.safeParse({ ...CHECKOUT_ANFRAGE, customerName: text(80) }).success).toBe(true)
    expect(checkoutRequestSchema.safeParse({ ...CHECKOUT_ANFRAGE, customerName: text(81) }).success).toBe(false)
  })

  it('nimmt eine Telefonnummer mit genau 30 Zeichen an und lehnt 31 ab', () => {
    expect(checkoutRequestSchema.safeParse({ ...CHECKOUT_ANFRAGE, customerPhone: text(30) }).success).toBe(true)
    expect(checkoutRequestSchema.safeParse({ ...CHECKOUT_ANFRAGE, customerPhone: text(31) }).success).toBe(false)
  })

  it('nimmt eine Notiz mit genau 500 Zeichen an und lehnt 501 ab', () => {
    expect(checkoutRequestSchema.safeParse({ ...CHECKOUT_ANFRAGE, customerNote: text(500) }).success).toBe(true)
    expect(checkoutRequestSchema.safeParse({ ...CHECKOUT_ANFRAGE, customerNote: text(501) }).success).toBe(false)
  })

  it('nimmt eine E-Mail-Adresse mit genau 254 Zeichen an und lehnt 255 ab', () => {
    expect(checkoutRequestSchema.safeParse({ ...CHECKOUT_ANFRAGE, customerEmail: adresse(254) }).success).toBe(true)
    expect(checkoutRequestSchema.safeParse({ ...CHECKOUT_ANFRAGE, customerEmail: adresse(255) }).success).toBe(false)
  })

  it('kürzt den Positionsnamen auf 100 Zeichen, statt die Bestellung abzulehnen', () => {
    // Ein Produkt, dessen Name vor der Grenze länger gespeichert wurde, muss
    // kaufbar bleiben — nur die Momentaufnahme in der Bestellung wird gekürzt.
    // Der Name kommt aus Product.name (route.ts), nicht aus dem Request.
    expect(bestellPositionsName(text(100))).toBe(text(100))
    expect(bestellPositionsName(text(130))).toBe(text(100))
  })

  it('kürzt den Positionsnamen nicht mitten in einem Emoji', () => {
    expect(bestellPositionsName(`${text(99)}🥕🥕`)).toBe(`${text(99)}🥕`)
  })

  it('items.name im Request ist nur geduldet: fehlt er, ist die Anfrage gültig', () => {
    const ohneName = { ...CHECKOUT_ANFRAGE, items: [{ productId: CHECKOUT_ANFRAGE.items[0].productId, quantity: 1, unitPrice: 5 }] }
    expect(checkoutRequestSchema.safeParse(ohneName).success).toBe(true)
  })

  it('gibt die E-Mail ohne Ränder und klein geschrieben an den Handler weiter', () => {
    expect(
      checkoutRequestSchema.parse({ ...CHECKOUT_ANFRAGE, customerEmail: ' Max.Mustermann@Example.ORG ' }).customerEmail
    ).toBe('max.mustermann@example.org')
  })

  it('lässt jeden Namen durch, den das Produktformular annimmt — beide Grenzen sind dieselbe', () => {
    const laengsterProduktname = text(PRODUKTNAME_MAX)
    const produkt = productFormSchema.safeParse({ name: laengsterProduktname, price: '5', unit: 'KG' })
    const position = checkoutRequestSchema.safeParse({
      ...CHECKOUT_ANFRAGE,
      items: [{ ...CHECKOUT_ANFRAGE.items[0], name: laengsterProduktname }],
    })
    expect(produkt.success).toBe(true)
    expect(position.success).toBe(true)
  })

  it('das Produktformular meldet einen zu langen Namen auf Deutsch', () => {
    const r = productFormSchema.safeParse({ name: text(PRODUKTNAME_MAX + 1), price: '5', unit: 'KG' })
    expect(r.success).toBe(false)
    expect(r.error?.issues.find((i) => i.path[0] === 'name')?.message).toBe(
      'Der Produktname darf höchstens 100 Zeichen haben.'
    )
  })
})

// ── Bearbeiten: Altwerte über der Grenze ─────────────────────────────────────

describe('passtInGrenze — der gespeicherte Altwert', () => {
  it('lässt einen Wert bis zur Grenze immer durch', () => {
    expect(passtInGrenze(text(80), 80)).toBe(true)
    expect(passtInGrenze(text(80), 80, 'anderer Wert')).toBe(true)
  })

  it('lässt einen längeren Wert ohne gespeicherten Stand nicht durch', () => {
    expect(passtInGrenze(text(81), 80)).toBe(false)
    expect(passtInGrenze(text(81), 80, null)).toBe(false)
  })

  it('lässt einen längeren Altwert durch, solange er unverändert bleibt', () => {
    expect(passtInGrenze(text(95), 80, text(95))).toBe(true)
  })

  it('lässt einen geänderten Wert über der Grenze nicht durch, auch wenn er kürzer als der Altwert ist', () => {
    expect(passtInGrenze(text(90), 80, text(95))).toBe(false)
  })
})

describe('profilBearbeitenSchema — Hof mit zu langem Altbestand', () => {
  const BESTAND = { name: text(95, 'h'), ownerName: text(85, 'o'), phone: text(40, '1') }
  const schema = profilBearbeitenSchema(BESTAND)

  it('nimmt das Profil mit den unveränderten Altwerten an — der Hof bleibt speicherbar', () => {
    expect(schema.safeParse({ ...PROFIL, ...BESTAND }).success).toBe(true)
  })

  it('verlangt die Grenze für jeden geänderten Wert', () => {
    const r = schema.safeParse({ ...PROFIL, ...BESTAND, name: text(81, 'h') })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.path).toEqual(['name'])
    expect(r.error?.issues[0]?.message).toContain('höchstens 80 Zeichen')
  })

  it('verlangt sie auch für Inhabername und Telefon', () => {
    expect(schema.safeParse({ ...PROFIL, ...BESTAND, ownerName: text(81, 'o') }).success).toBe(false)
    expect(schema.safeParse({ ...PROFIL, ...BESTAND, phone: text(31, '1') }).success).toBe(false)
  })

  it('das strenge Schema kennt keinen Altbestand', () => {
    expect(profileSchema.safeParse({ ...PROFIL, ...BESTAND }).success).toBe(false)
  })
})

// ── Onboarding und Registrierung ────────────────────────────────────────────

describe('hofAnlegenSchema — der erste Schritt des Onboardings', () => {
  const ANLAGE = {
    name: 'Hof Test',
    ownerName: 'Max Mustermann',
    description: '',
    address: 'Dorfstraße 12',
    postalCode: '3400',
    city: 'Klosterneuburg',
    phone: '+43 660 0000000',
    email: '',
  }

  it('zählt den Hofnamen ohne Ränder — wie er gespeichert wird', () => {
    const r = hofAnlegenSchema.safeParse({ ...ANLAGE, name: `  ${text(80)}  ` })
    expect(r.success).toBe(true)
    expect(r.data?.name).toBe(text(80))
  })

  it('lehnt 81 Zeichen Hofname mit einer Meldung ab, die sagt, was zu tun ist', () => {
    const r = hofAnlegenSchema.safeParse({ ...ANLAGE, name: text(81) })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('Der Hofname darf höchstens 80 Zeichen haben — bitte kürzen.')
  })

  it('lässt die freiwillige Hof-E-Mail leer', () => {
    expect(hofAnlegenSchema.parse(ANLAGE).email).toBe('')
    expect(hofAnlegenSchema.parse({ ...ANLAGE, email: '   ' }).email).toBe('')
  })

  it('lehnt eine Hof-E-Mail ohne gültiges Format ab — mit Ausweg', () => {
    const r = hofAnlegenSchema.safeParse({ ...ANLAGE, email: 'hof at example' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe('Bitte gib eine gültige Hof-E-Mail an — oder lass das Feld leer.')
  })
})

describe('vollerName — Vor- und Nachname für Registrierung und Zähler', () => {
  it('setzt genau ein Leerzeichen zwischen die bereinigten Teile', () => {
    expect(vollerName('  Max ', ' Mustermann  ')).toBe('Max Mustermann')
  })
})

// ── Zeichenzähler ───────────────────────────────────────────────────────────

describe('zeichenStand — der Zähler unter dem Feld', () => {
  it('bleibt unter 80 % Füllung unsichtbar', () => {
    expect(zeichenStand(63, 80)).toEqual({ sichtbar: false })
    expect(zeichenStand(0, 80)).toEqual({ sichtbar: false })
  })

  it('erscheint bei genau 80 % Füllung', () => {
    expect(zeichenStand(64, 80)).toEqual({ sichtbar: true, zuLang: false, text: '64 / 80' })
  })

  it('zeigt an der Grenze noch keinen Hinweis', () => {
    expect(zeichenStand(80, 80)).toEqual({ sichtbar: true, zuLang: false, text: '80 / 80' })
  })

  it('sagt über der Grenze „Bitte kürzen"', () => {
    expect(zeichenStand(81, 80)).toEqual({ sichtbar: true, zuLang: true, text: '81 / 80 · Bitte kürzen' })
  })

  it('rechnet die Schwelle auch bei krummen 80 % richtig', () => {
    // 80 % von 254 sind 203,2 — der Zähler erscheint ab 204.
    expect(zeichenStand(203, 254).sichtbar).toBe(false)
    expect(zeichenStand(204, 254).sichtbar).toBe(true)
    // 80 % von 30 sind genau 24.
    expect(zeichenStand(23, 30).sichtbar).toBe(false)
    expect(zeichenStand(24, 30).sichtbar).toBe(true)
  })
})
