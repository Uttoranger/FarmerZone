'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  productAnlegenSchema,
  productFormSchema,
  kategorieSetzenSchema,
  sichtbarkeitSchema,
  type ProductFormData,
} from '@/schemas/product'
import { bereinigeSiegel, istFuttermittel } from '@/lib/taxonomie'
import { mwstStandard } from '@/lib/mwst'
import { dualUseHinweis, normiereProduktname, DUAL_USE_MIN_ZEICHEN } from '@/lib/dual-use'
import { dualUseAnfrageSchema } from '@/schemas/product'
import { getFarmForUser } from '@/server/queries/dashboard'
import { istWiederDa } from '@/lib/produkte-hof'
import {
  FUTTER_BESTAETIGUNG_NEU,
  FUTTER_NUR_UEBER_FORMULAR,
  brauchtNeueBestaetigung,
  gebindeSperre,
  noetigeRegistrierung,
  type Gebinde,
} from '@/lib/futter-registrierung'
import {
  futterDaten,
  ladeHofRegistrierung,
  revalidiereProdukte,
  type GepruefteKennzeichnung,
} from '@/server/produkte-schreiben'
import { formatZahl } from '@/lib/format'
import { bestandVorherSchema, vorratSetzenSchema } from '@/schemas/vorrat'
import { BILD_NICHT_UEBERNOMMEN, bildUrlErlaubt } from '@/server/bild-url'

async function getAuthenticatedFarm() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Nicht eingeloggt')
  const farm = await getFarmForUser(session.user.id)
  if (!farm) throw new Error('Kein Hof gefunden')
  return farm
}

/** Alles neu laden, was Produkte dieses Hofs zeigt (src/server/produkte-schreiben.ts). */
function revalidate(farmSlug: string) {
  revalidiereProdukte(farmSlug)
}

/**
 * GEAENDERT: Der Vorrat hat sich seit dem Öffnen geändert — `vorrat` ist der
 * aktuelle Stand. GESPERRT: Diese Größe darf ohne die nötige Futtermittel-
 * Registrierung nicht in den Shop (S7) — `error` nennt den Grund.
 * BESTAETIGUNG: Angaben eines Futtermittels geändert, aber nicht neu bestätigt
 * (E10a) — der Dialog öffnet den Haken.
 * `hinweis` nach dem Speichern: gespeichert, aber als Entwurf, weil gesperrt.
 */
export type ProduktErgebnis =
  | {
      ok: true
      hinweis?: string
      /**
       * Nur beim Anlegen (createProduct): das neue Produkt und ob es sofort im
       * Shop steht — Anlass des Teilen-Moments „gespeichert" (Nr. 30).
       */
      angelegt?: { id: string; online: boolean }
    }
  | { error: string; code?: 'GEAENDERT' | 'GESPERRT' | 'BESTAETIGUNG'; vorrat?: number }


/**
 * Die Produktspalten aus dem geprüften Formular — für create und update
 * dieselben. OHNE den Vorrat: Den schreibt createProduct beim Anlegen und
 * updateProduct nur bedingt (siehe dort) — ein blindes Setzen überschriebe
 * eine Bestellung, die während des Bearbeitens kam.
 */
function produktDaten(v: ProductFormData) {
  return {
    name: v.name,
    description: v.description || null,
    imageUrl: v.imageUrl || null,
    category: v.category ?? null,
    subcategory: v.subcategory ?? null,
    labels: bereinigeSiegel(v.labels),
    abgabe: v.abgabe,
    countsTowardLimit: v.countsTowardLimit,
    price: v.price,
    vatRate: v.vatRate,
    unit: v.unit,
    unitSize: v.unitSize ?? null,
    isAvailable: v.isAvailable,
    allergens: v.allergens,
    // isOrganic wird bewusst NICHT mehr geschrieben — Bio lebt in labels.
    requiresCool: v.requiresCool,
    requiresFreezer: v.requiresFreezer,
    seasonStart: v.seasonStart ?? null,
    seasonEnd: v.seasonEnd ?? null,
    unavailableReason: v.unavailableReason || null,
  }
}

/**
 * Das Schema hat schon entschieden: futter gibt es genau dann, wenn der
 * Bereich Futtermittel ist, und dann mit einer passenden Futtermittelart.
 */
function futterAus(v: ProductFormData): GepruefteKennzeichnung | null {
  if (!istFuttermittel(v.category) || !v.futter) return null
  const { futtermittelart } = v.futter
  if (futtermittelart === null) return null
  return { ...v.futter, futtermittelart }
}

export async function createProduct(data: ProductFormData): Promise<ProduktErgebnis> {
  const farm = await getAuthenticatedFarm()
  // Anlegen ist strenger als Bearbeiten: Kategorie Pflicht, Futter ohne Gebindegröße.
  const geprueft = productAnlegenSchema.safeParse(data)
  if (!geprueft.success) return { error: 'Bitte prüfe deine Eingaben.' }
  const v = geprueft.data
  // Neue Futtermittel nur über das Futter-Formular — nur dort entsteht die
  // Verpackung je Größe, an der die Sperre je Gebinde hängt (S7).
  if (istFuttermittel(v.category)) return { error: FUTTER_NUR_UEBER_FORMULAR }
  // Produktbild nur aus unserem Speicher und dem Ordner dieses Hofes (Nr. 19b).
  if (!(await bildUrlErlaubt(v.imageUrl, farm.id))) return { error: BILD_NICHT_UEBERNOMMEN }

  const neu = await prisma.product.create({
    data: {
      farmId: farm.id,
      ...produktDaten(v),
      stock: v.stock,
    },
    select: { id: true, isAvailable: true },
  })

  revalidate(farm.slug)
  return { ok: true, angelegt: { id: neu.id, online: neu.isAvailable } }
}

/** Der Satz, wenn eine Bestellung den Vorrat geändert hat, während der Hof ihn bearbeitet hat. */
function vorratGeaendertText(aktuell: number): string {
  return `Der Vorrat hat sich inzwischen geändert, zum Beispiel durch eine Bestellung. Er steht jetzt bei ${formatZahl(aktuell)} – bitte prüf ihn noch einmal.`
}

/**
 * Speichert das Produkt und hält die Futter-Kennzeichnung konsistent: im
 * Bereich Futtermittel wird sie angelegt oder aktualisiert, bei jeder anderen
 * Kategorie GELÖSCHT — auch dann, wenn das Produkt vorher ein Futtermittel
 * war (Kategoriewechsel; das Formular fragt vorher nach). Beides in EINER
 * Transaktion, damit nie ein Produkt ohne Kategorie Futtermittel eine
 * Kennzeichnung behält. Der Besitz steht in der WHERE-Klausel des Updates.
 */
export async function updateProduct(
  productId: string,
  data: ProductFormData,
  /**
   * Der Vorrat, den der Dialog beim Öffnen gesehen hat. Hat der Hof ihn
   * geändert, wird nur gesetzt, wenn die Datenbank noch diesen Wert hält —
   * wie setzeVorrat. Unverändert (oder ohne Angabe) bleibt der Vorrat
   * unberührt: Vorher schrieb jedes Speichern den alten Vorrat zurück und
   * machte eine Bestellung, die während des Bearbeitens kam, wieder verfügbar.
   */
  bestandVorher?: number
): Promise<ProduktErgebnis> {
  const farm = await getAuthenticatedFarm()
  const geprueft = productFormSchema.safeParse(data)
  if (!geprueft.success) return { error: 'Bitte prüfe deine Eingaben.' }
  const v = geprueft.data
  if (bestandVorher !== undefined && !bestandVorherSchema.safeParse(bestandVorher).success) {
    return { error: 'Bitte lade die Seite neu und versuch es noch einmal.' }
  }
  // Wie beim Anlegen; ein unverändertes Altbild bleibt speicherbar.
  const bildErlaubt = await bildUrlErlaubt(v.imageUrl, farm.id, async () => {
    const bisher = await prisma.product.findFirst({ where: { id: productId, farmId: farm.id }, select: { imageUrl: true } })
    return bisher?.imageUrl
  })
  if (!bildErlaubt) return { error: BILD_NICHT_UEBERNOMMEN }
  const futter = futterAus(v)
  const vorratSetzen = bestandVorher !== undefined && v.stock !== bestandVorher
  // Futter (S7, Nachbesserung Nr. 20): Gespeichert wird als Futtermittel nur,
  // was in der Datenbank schon eines ist. Ein Wechsel von Nicht-Futter auf
  // Futter hätte keine Verpackung und käme an der Sperre je Gebinde vorbei —
  // neue Futtermittel nur über das Futter-Formular. Auch ausgeblendet nicht,
  // sonst schaltete „Sichtbar" es danach ohne Sperre ein. Gelesen wird mit dem
  // Hof in der WHERE-Klausel; ein fremdes Produkt ist „nicht gefunden".
  let sperre: string | null = null
  const jetzt = new Date()
  // Ob die Kennzeichnung mit diesem Speichern neu bestätigt wird (E10a).
  // Nur dann gilt bestaetigtAm = jetzt; sonst bleibt der alte Zeitpunkt.
  let neuBestaetigt = false
  if (istFuttermittel(v.category)) {
    const bisher = await prisma.product.findFirst({
      where: { id: productId, farmId: farm.id },
      include: { futter: true },
    })
    if (!bisher) return { error: 'Produkt nicht gefunden.' }
    if (!istFuttermittel(bisher.category)) return { error: FUTTER_NUR_UEBER_FORMULAR }
    // Pflicht-Bestätigung (E10a, Nr. 23): Jede inhaltliche Änderung verlangt
    // den Haken neu; nur Preis, Vorrat, Sichtbarkeit und Foto nicht
    // (OHNE_NEUE_BESTAETIGUNG). Verglichen wird, was dieses Speichern schreiben
    // würde, mit genau diesen Spalten aus der Datenbank — ein neues Feld in
    // produktDaten zählt damit von selbst mit.
    if (futter) {
      const neuProdukt: Record<string, unknown> = produktDaten(v)
      const neuKennzeichnung: Record<string, unknown> = futterDaten(futter, jetzt)
      const noetig = brauchtNeueBestaetigung(
        {
          produkt: spaltenAus(bisher, Object.keys(neuProdukt)),
          kennzeichnung: bisher.futter ? spaltenAus(bisher.futter, Object.keys(neuKennzeichnung)) : null,
        },
        { produkt: neuProdukt, kennzeichnung: neuKennzeichnung }
      )
      if (noetig && !futter.bestaetigt) return { error: FUTTER_BESTAETIGUNG_NEU, code: 'BESTAETIGUNG' }
      neuBestaetigt = futter.bestaetigt
    }
    // Sperre je Gebinde: Soll das Futtermittel in den Shop, entscheidet die
    // Verpackung aus der Datenbank mit dem Stand des Hofs von JETZT. Gesperrt
    // wird trotzdem gespeichert — nur als Entwurf.
    if (v.isAvailable) sperre = await sperreFuer(farm.id, { category: v.category, verpackung: bisher.verpackung })
  }
  const daten = sperre ? { ...produktDaten(v), isAvailable: false } : produktDaten(v)

  const ergebnis = await prisma.$transaction(async (tx) => {
    const { count } = await tx.product.updateMany({
      where: vorratSetzen ? { id: productId, farmId: farm.id, stock: bestandVorher } : { id: productId, farmId: farm.id },
      data: vorratSetzen ? { ...daten, stock: v.stock } : daten,
    })
    if (count === 0) {
      if (!vorratSetzen) return 'nicht-gefunden' as const
      // Fehlt das Produkt, oder hat eine Bestellung den Vorrat inzwischen
      // geändert? Der Hof steht auch hier in der WHERE-Klausel.
      const aktuell = await tx.product.findFirst({ where: { id: productId, farmId: farm.id }, select: { stock: true } })
      return aktuell ? ({ geaendert: aktuell.stock } as const) : ('nicht-gefunden' as const)
    }

    if (futter) {
      const daten = futterDaten(futter, jetzt)
      // Nicht neu bestätigt (nur Preis/Vorrat geändert): Die Angaben sind
      // dieselben, der alte Zeitpunkt der Bestätigung bleibt. Angelegt wird
      // ohne gespeicherte Kennzeichnung nie ohne Haken (siehe oben).
      const { bestaetigtAm, ...ohneZeitpunkt } = daten
      await tx.futterKennzeichnung.upsert({
        where: { productId },
        create: { productId, ...daten },
        update: neuBestaetigt ? { ...ohneZeitpunkt, bestaetigtAm } : ohneZeitpunkt,
      })
    } else {
      // deleteMany statt delete: wirft nicht, wenn es nie eine Kennzeichnung gab.
      await tx.futterKennzeichnung.deleteMany({ where: { productId } })
    }
    return 'ok' as const
  })

  if (ergebnis === 'nicht-gefunden') return { error: 'Produkt nicht gefunden.' }
  if (typeof ergebnis === 'object') return { error: vorratGeaendertText(ergebnis.geaendert), code: 'GEAENDERT', vorrat: ergebnis.geaendert }

  revalidate(farm.slug)
  return sperre ? { ok: true, hinweis: `Als Entwurf gespeichert. ${sperre}.` } : { ok: true }
}

/** Genau diese Spalten aus einer gelesenen Zeile — als Vergleichsstand für brauchtNeueBestaetigung. */
function spaltenAus(zeile: object, spalten: readonly string[]): Record<string, unknown> {
  const werte = zeile as Record<string, unknown>
  return Object.fromEntries(spalten.map((s) => [s, werte[s]]))
}

/**
 * Der Sperrgrund einer Größe, wenn sie in den Shop soll — null, wenn sie darf.
 * Den Hof fragt nur, wer überhaupt eine Registrierung braucht. Ohne
 * Verpackung ist es Altbestand (schon vor Nr. 20 Futter), den die Regel
 * nicht sperrt (src/lib/futter-registrierung.ts).
 */
async function sperreFuer(farmId: string, gebinde: Gebinde): Promise<string | null> {
  if (noetigeRegistrierung(gebinde) === null) return null
  return gebindeSperre(gebinde, await ladeHofRegistrierung(farmId))?.grund ?? null
}

/**
 * Kategorie eines Bestandsprodukts ohne Kategorie setzen — der Chip
 * „… übernehmen" in der Produktliste. Bewusst NICHT über updateProduct: Das
 * schriebe das ganze Produkt aus den Listendaten zurück, samt einem Bestand,
 * den eine Bestellung inzwischen gesenkt haben kann.
 *
 * Schreibt nur, solange die Kategorie noch leer ist (Bedingung in der
 * WHERE-Klausel, zusammen mit dem Besitz) — ein zweiter Tipp oder eine
 * inzwischen gewählte Kategorie wird nie überschrieben. Futtermittel sind
 * ausgeschlossen (Schema): Sie brauchen eine Kennzeichnung, die nur der
 * Dialog erfasst.
 */
export async function setzeKategorie(input: unknown): Promise<ProduktErgebnis> {
  const geprueft = kategorieSetzenSchema.safeParse(input)
  if (!geprueft.success) return { error: 'Diese Kategorie passt nicht. Bitte wähle sie im Produkt selbst.' }
  const { productId, category, subcategory } = geprueft.data

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }

  // MwSt wie im Formular: Stand noch der Vorschlag für „ohne Kategorie", gilt
  // jetzt der der neuen Kategorie. Einen selbst gesetzten Satz fasst das nicht an.
  const basis = { id: productId, farmId: farm.id, category: null }
  const mitMwst = await prisma.product.updateMany({
    where: { ...basis, vatRate: mwstStandard(null) },
    data: { category, subcategory, vatRate: mwstStandard(category) },
  })
  if (mitMwst.count === 0) {
    const ohneMwst = await prisma.product.updateMany({ where: basis, data: { category, subcategory } })
    if (ohneMwst.count === 0) return { error: 'Das Produkt hat schon eine Kategorie. Lade die Seite neu.' }
  }

  revalidate(farm.slug)
  return { ok: true }
}

/**
 * Der Schalter „Im Shop" — ein Tipp blendet ein Produkt aus oder ein.
 *
 * Gebaut nach setzeKategorie oben, nicht nach togglePickupSlotActive in
 * farm.ts: Die dortige Vorlage prüft weder mit Zod noch den Treffer und meldet
 * einem fremden Produkt stillschweigend Erfolg. Hier gilt die Hausregel
 * (CODING_STANDARDS, Beispiel 2): Besitz steht in der WHERE-Klausel, nicht in
 * einem vorgelagerten `if` — sonst liegt zwischen Prüfung und Schreiben eine
 * Lücke —, und `count === 0` ist die Antwort auf „gibt es nicht oder gehört
 * nicht dir". Welcher der beiden Fälle es war, erfährt der Browser nicht; das
 * wäre eine Auskunft über fremde Daten.
 *
 * `unavailableReason` wird NICHT angefasst. Der Grund ist die Notiz des Hofes,
 * warum etwas gerade nicht da ist („Saison vorbei, wieder ab November"). Wer
 * ein Produkt kurz abschaltet und wieder einschaltet, soll seine Notiz
 * behalten, statt sie neu tippen zu müssen.
 */
export async function produktSichtbarkeitSetzen(input: unknown): Promise<ProduktErgebnis> {
  const geprueft = sichtbarkeitSchema.safeParse(input)
  if (!geprueft.success) return { error: 'Das hat nicht geklappt. Bitte nochmal.' }
  const { productId, imShop } = geprueft.data

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }

  // Einschalten prüft die Sperre je Gebinde (S7): Ein Futtermittel, dessen
  // Verpackung eine Registrierung verlangt, die der Hof nicht eingetragen hat,
  // bleibt Entwurf. Ausschalten geht immer.
  if (imShop) {
    const produkt = await prisma.product.findFirst({
      where: { id: productId, farmId: farm.id },
      select: { category: true, verpackung: true },
    })
    if (!produkt) return { error: 'Produkt nicht gefunden.' }
    if (noetigeRegistrierung(produkt) !== null) {
      const sperre = gebindeSperre(produkt, await ladeHofRegistrierung(farm.id))
      if (sperre) return { error: `${sperre.grund}.`, code: 'GESPERRT' }
    }
  }

  const { count } = await prisma.product.updateMany({
    where: { id: productId, farmId: farm.id },
    data: { isAvailable: imShop },
  })
  if (count === 0) return { error: 'Produkt nicht gefunden.' }

  revalidate(farm.slug)
  return { ok: true }
}

export type DualUseErgebnis = { hinweis: string | null } | { error: string }

/**
 * Dual-Use-Hinweis beim Tippen des Namens (Konzept 6.1): Gibt es im EIGENEN
 * Hof schon ein Produkt gleichen Namens in einem anderen Bereich? Nur lesend.
 * Das Formular ruft das verzögert auf, nicht je Tastendruck. Der Hof steht in
 * der WHERE-Klausel — fremde Höfe sieht diese Abfrage nie.
 */
export async function pruefeDualUse(eingabe: unknown): Promise<DualUseErgebnis> {
  const geprueft = dualUseAnfrageSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: 'Ungültige Eingabe.' }
  const { name, category, productId } = geprueft.data

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }

  if (category == null || normiereProduktname(name).length < DUAL_USE_MIN_ZEICHEN) return { hinweis: null }

  const vorhandene = await prisma.product.findMany({
    where: {
      farmId: farm.id,
      name: { equals: name.trim(), mode: 'insensitive' },
      // Beim Bearbeiten ist das Produkt selbst kein Zwilling.
      ...(productId ? { id: { not: productId } } : {}),
    },
    select: { name: true, category: true },
    take: 5,
  })

  return { hinweis: dualUseHinweis({ name, category }, vorhandene) }
}

export async function updateProductImageAction(
  productId: string,
  imageUrl: string | null,
): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden' }

  const existing = await prisma.product.findFirst({ where: { id: productId, farmId: farm.id } })
  if (!existing) return { error: 'Produkt nicht gefunden' }
  if (!(await bildUrlErlaubt(imageUrl, farm.id, async () => existing.imageUrl))) return { error: BILD_NICHT_UEBERNOMMEN }

  await prisma.product.update({ where: { id: productId }, data: { imageUrl } })

  revalidate(farm.slug)
  return {}
}

export type VorratErgebnis =
  | { ok: true; vorrat: number; wiederDa: boolean }
  | { error: string; code?: 'GEAENDERT'; vorrat?: number }

/**
 * Vorrat direkt in der Produkttabelle ändern (Nachtlauf Nr. 18) — Stepper
 * oder eingetippte Zahl.
 *
 * EIN SETZEN, KEIN ADDIEREN, UND NUR BEDINGT. Der Hof meint „jetzt liegen 12
 * da", nicht „12 mehr". Gesetzt wird mit `updateMany`, dessen WHERE-Klausel
 * Produkt, Hof UND den Vorrat nennt, den der Browser gesehen hat (`vorher`).
 * Hat inzwischen der Checkout gebucht (`stock >= Menge`, ebenfalls bedingt,
 * src/app/api/checkout/route.ts) oder ein Storno zurückgebucht, trifft die
 * Bedingung nicht mehr: Es wird nichts geschrieben, und der Hof bekommt den
 * aktuellen Stand zurück (GEAENDERT). So überschreibt ein Setzen nie eine
 * Buchung, die der Hof nicht gesehen hat — und ein blindes increment/decrement
 * (CLAUDE.md) gibt es nicht.
 *
 * Reservierungen (`StockReservation`) buchen keinen Bestand ab
 * (ARCHITECTURE §5): Setzt der Hof den Vorrat unter das, was gerade in
 * Warenkörben liegt, scheitert der Checkout dort an der Bedingung
 * `stock >= Menge` — die Kundin bekommt die bekannte Meldung, der Bestand
 * fällt nie unter 0. Ein Absenken ist genau die Absicht des Hofs.
 */
export async function setzeVorrat(input: unknown): Promise<VorratErgebnis> {
  const geprueft = vorratSetzenSchema.safeParse(input)
  if (!geprueft.success) {
    const amFeld = geprueft.error.issues.find((i) => i.path[0] === 'neu')?.message
    return { error: amFeld ?? 'Bitte eine ganze Zahl ab 0 eintippen.' }
  }
  const { productId, vorher, neu } = geprueft.data

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }

  // Nichts zu ändern — auch kein Schreiben, das eine Buchung überholen könnte.
  if (neu === vorher) return { ok: true, vorrat: neu, wiederDa: false }

  const { count } = await prisma.product.updateMany({
    where: { id: productId, farmId: farm.id, stock: vorher },
    data: { stock: neu },
  })

  if (count === 0) {
    // Fremd oder unbekannt → keine Auskunft; eigen → der aktuelle Stand.
    const aktuell = await prisma.product.findFirst({ where: { id: productId, farmId: farm.id }, select: { stock: true } })
    if (!aktuell) return { error: 'Produkt nicht gefunden.' }
    return { error: vorratGeaendertText(aktuell.stock), code: 'GEAENDERT', vorrat: aktuell.stock }
  }

  revalidate(farm.slug)
  return { ok: true, vorrat: neu, wiederDa: istWiederDa(vorher, neu) }
}

export async function deleteProduct(productId: string) {
  const farm = await getAuthenticatedFarm()

  const existing = await prisma.product.findFirst({
    where: { id: productId, farmId: farm.id },
  })
  if (!existing) throw new Error('Produkt nicht gefunden')

  await prisma.product.delete({ where: { id: productId } })

  revalidate(farm.slug)
}

// Sprint 18: manuelle Reihenfolge per Drag & Drop.
// ids muss GENAU die Produktmenge der eigenen Farm sein (Permutation) —
// fremde, fehlende oder doppelte IDs → Fehler ohne Teiländerung (Transaktion).
export async function reorderProductsAction(ids: string[]): Promise<{ error?: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht eingeloggt' }
  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden' }

  const own = await prisma.product.findMany({
    where: { farmId: farm.id },
    select: { id: true },
  })
  const ownIds = new Set(own.map((p) => p.id))
  const uniqueIds = new Set(ids)

  if (
    ids.length !== uniqueIds.size ||
    ids.length !== ownIds.size ||
    ids.some((id) => !ownIds.has(id))
  ) {
    return { error: 'Ungültige Produktliste' }
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.product.update({ where: { id }, data: { sortOrder: index } })
    )
  )

  revalidate(farm.slug)
  return {}
}
