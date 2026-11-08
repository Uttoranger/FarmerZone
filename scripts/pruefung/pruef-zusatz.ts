/**
 * Die Ergänzungen des Prüf-Seeds (Nr. 262, Auftrag Lauf 33 6.1 a–l) — nur in
 * der Wegwerf-DB, nach der Loopback-Sperre und nach dem Seed. Wird erst NACH
 * der Sperre dynamisch geladen (pruef-seed.ts), weil die Module der App hier
 * Prisma und env laden.
 *
 * Daten erfunden (pruef-daten.ts); Zeiten relativ zum Seed-Lauf (`jetzt`).
 * Beträge nur über die Funktionen der Kasse (`bestellSnapshot`, Gebührenlage
 * über `ladeGebuehrLage`), Gründungs-Zusagen über `festschreibenListe`,
 * Mail-Aufträge über `stelleEinOhneRisiko` mit `bestellMailAuftrag`, Links mit
 * den Signier-Funktionen der App. Kein Hand-SQL für Geld oder Zusagen.
 */
import { Prisma, type PrismaClient } from '@prisma/client'
import { ladeGebuehrLage, HOF_FUER_GEBUEHR_LAGE } from '../../src/server/queries/plattform-einstellung'
import { ladeHoefeFuerFestschreiben, leseGruendungEinstellung } from '../../src/server/queries/admin'
import { GRUENDUNGSPLAETZE_SPERRE, bildeGruendungBis, festschreibenBrauchtPlaetze, festschreibenListe } from '../../src/lib/gruendungshof'
import { stelleEinOhneRisiko } from '../../src/server/mail-warteschlange'
import { bestellMailAuftrag } from '../../src/server/mail-arten/bestellung'
import { artikelFehltRechnung, nachFehlendemArtikel, type ArtikelFehltBestellung } from '../../src/lib/artikel-fehlt'
import { alsCents, decimalZuCents } from '../../src/lib/order-totals'
import { bestellPositionsName } from '../../src/lib/eingabegrenzen'
import { nachrichtArtVon } from '../../src/lib/postfach'
import { kalendertagInWien, wienerMitternacht } from '../../src/lib/wiener-tag'
import { barBestaetigungsPfad, bestaetigungsPfad, bestellungPfad, widerrufPfad } from '../../src/lib/bestell-link'
import { neuerBarToken } from '../../src/lib/bar-bestaetigung'
import { SEED_KONTEN } from '../../prisma/seed-daten'
import {
  PRUEF_BESTELLUNGEN,
  PRUEF_BRENNHOLZ,
  PRUEF_FUTTER_FAMILIE,
  PRUEF_GRUENDUNG_PLAETZE,
  PRUEF_HOF_WARTET,
  PRUEF_KONTEN,
  PRUEF_POSTFACH,
  PRUEF_WHATSAPP_ABO,
  bestellSnapshot,
  stripePlatzhalter,
  type PruefBestellung,
} from './pruef-daten'

type Db = PrismaClient
type Auth = { api: { signUpEmail(eingabe: { body: { email: string; password: string; name: string } }): Promise<{ user?: { id: string } | null } | null> } }
export type LinkEintrag = { pfad: string | null; zustand: string; hinweis?: string }

const STUNDE_MS = 60 * 60 * 1000
const TAG_MS = 24 * STUNDE_MS
const vor = (jetzt: Date, stunden: number) => new Date(jetzt.getTime() - stunden * STUNDE_MS)

/** Mittag des Wiener Kalendertags `tage` nach `jetzt` — wie die Kasse, die den Abholtag auf Mittag legt. */
function abholMittag(jetzt: Date, tage: number): Date {
  const tag = kalendertagInWien(new Date(jetzt.getTime() + tage * TAG_MS))
  const mitternacht = wienerMitternacht(tag)
  if (!mitternacht) throw new Error('Abholtag nicht bestimmbar')
  return new Date(mitternacht.getTime() + 12 * STUNDE_MS)
}

/** (k) Gründungsplätze auf 100; mit `--gruendung-fest` die Zusagen wie „Zusagen festschreiben“ (Admin-Aktion). */
async function gruendung(db: Db, festschreiben: boolean, adminId: string): Promise<string> {
  await db.plattformEinstellung.upsert({
    where: { id: 'plattform' },
    update: { gruendungPlaetze: PRUEF_GRUENDUNG_PLAETZE },
    create: { id: 'plattform', gruendungPlaetze: PRUEF_GRUENDUNG_PLAETZE },
  })
  if (!festschreiben) return `${PRUEF_GRUENDUNG_PLAETZE} Gründungsplätze`
  // Dieselbe Regel wie schreibeZusagenFest (src/server/actions/gruendung.ts): Sperre,
  // bedingt festAm setzen, je Zeile der Liste Platz und Ende — nacheinander in EINER Transaktion.
  // Nachricht und Protokoll der Admin-Aktion entstehen hier nicht.
  const zahl = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`
    const einstellung = await leseGruendungEinstellung(tx)
    if (einstellung.festAm !== null) throw new Error('Zusagen sind schon festgeschrieben.')
    const hoefe = await ladeHoefeFuerFestschreiben(tx)
    const noetig = festschreibenBrauchtPlaetze(hoefe, einstellung)
    if (noetig !== null) throw new Error(`Festschreiben bräuchte ${noetig} Plätze.`)
    const { count } = await tx.plattformEinstellung.updateMany({
      where: { id: 'plattform', gruendungFestAm: null },
      data: { gruendungFestAm: new Date(), geaendertVonUserId: adminId },
    })
    if (count === 0) throw new Error('Zusagen sind schon festgeschrieben.')
    const liste = festschreibenListe(hoefe, einstellung)
    for (const zeile of liste) {
      await tx.farm.update({ where: { id: zeile.id }, data: { gruendungPlatz: zeile.platz, gruendungBis: bildeGruendungBis(zeile.neuTag) } })
    }
    return liste.length
  })
  return `${PRUEF_GRUENDUNG_PLAETZE} Gründungsplätze, ${zahl} Zusagen festgeschrieben`
}

/** (a, b) Futter-Familie und Brennholz je Raummeter am Pilothof. */
async function produkte(db: Db, farmId: string, jetzt: Date): Promise<void> {
  const f = PRUEF_FUTTER_FAMILIE
  // Wie legeFutterFamilieAn: eine gemeinsame Kennung der Familie.
  const familieId = 'familie-pruef-wiesenheu'
  for (const [index, g] of f.groessen.entries()) {
    await db.product.create({
      data: {
        id: g.id,
        farmId,
        name: `${f.name} ${g.bezeichnung}`,
        price: g.preis,
        vatRate: '13.00',
        unit: 'BALLEN',
        stock: g.bestand,
        isAvailable: true,
        category: f.category,
        subcategory: f.subcategory,
        familieId,
        verpackung: 'LOSE_BALLEN',
        abholhinweise: ['ANHAENGER_NOETIG'],
        sortOrder: 100 + index,
        futter: {
          create: {
            zielTierarten: ['PFERD', 'RIND'],
            zusammensetzung: f.zusammensetzung,
            analytischeBestandteile: f.analytischeBestandteile,
            bestaetigtAm: vor(jetzt, 48),
            futtermittelart: 'EINZELFUTTERMITTEL',
            nettoMenge: String(g.nettoKg),
            nettoEinheit: 'KG',
          },
        },
      },
    })
  }
  for (const [index, h] of PRUEF_BRENNHOLZ.entries()) {
    await db.product.create({
      data: {
        id: h.id,
        farmId,
        name: h.name,
        price: h.preis,
        vatRate: '13.00',
        unit: 'RAUMMETER',
        stock: h.bestand,
        isAvailable: true,
        category: 'BRENNHOLZ',
        subcategory: 'BRENNHOLZ_SCHEIT',
        sortOrder: 110 + index,
        brennmaterial: {
          create: {
            holzart: h.holzart,
            scheitlaengeCm: h.scheitlaengeCm,
            trocknung: h.trocknung,
            restfeuchteMax: h.restfeuchteMax,
            ueberdacht: h.ueberdacht,
            gelagertSeit: new Date(jetzt.getTime() - h.gelagertVorTagen * TAG_MS),
          },
        },
      },
    })
  }
}

/** (c) Postfach des Pilothofs: Unterhaltung mit dem Team (letzte Nachricht ungelesen) und ein Rundschreiben. */
async function postfach(db: Db, farmId: string, adminId: string, jetzt: Date): Promise<void> {
  const p = PRUEF_POSTFACH
  const zeiten = p.unterhaltung.map((n) => vor(jetzt, n.vorStunden))
  const letzte = zeiten[zeiten.length - 1] ?? jetzt
  await db.unterhaltung.create({
    data: {
      farmId,
      rundschreibenId: null,
      letzteNachrichtAm: letzte,
      createdAt: zeiten[0],
      nachrichten: { create: p.unterhaltung.map((n, i) => ({ vonFarmId: n.von === 'hof' ? farmId : null, text: n.text, createdAt: zeiten[i] })) },
      // Der Hof hat bis zur Antwort gelesen, die Nachricht danach nicht; das Team alles.
      staende: { create: [{ seite: 'HOF', gelesenBis: zeiten[1] ?? letzte }, { seite: 'TEAM', gelesenBis: letzte }] },
    },
  })
  const gesendet = vor(jetzt, p.rundschreiben.vorStunden)
  // Wie verschickeRundschreiben (src/server/rundschreiben.ts): Rundschreiben, je Empfänger ein Faden mit der ersten Nachricht.
  await db.rundschreiben.create({
    data: {
      titel: p.rundschreiben.titel,
      text: p.rundschreiben.text,
      art: 'INFO',
      perMail: false,
      antwortMoeglich: false,
      empfaengerRegel: { art: 'ausgewaehlt', hofIds: [farmId] },
      empfaenger: 1,
      gesendetAm: gesendet,
      erstelltVonUserId: adminId,
      unterhaltungen: {
        create: {
          farmId,
          letzteNachrichtAm: gesendet,
          nachrichten: { create: { vonFarmId: null, text: p.rundschreiben.text, art: nachrichtArtVon('INFO'), createdAt: gesendet } },
        },
      },
    },
  })
}

/** (g) Ein Hof ohne Produkte, der auf die Freigabe wartet — Konto über Better Auth wie im Seed. */
async function hofWartet(db: Db, auth: Auth, passwort: string): Promise<void> {
  const k = PRUEF_KONTEN[0]
  const h = PRUEF_HOF_WARTET
  const ergebnis = await auth.api.signUpEmail({ body: { email: k.email, password: passwort, name: k.name } })
  const ownerId = ergebnis?.user?.id
  if (!ownerId) throw new Error('Konto des wartenden Hofs nicht angelegt')
  await db.user.update({ where: { id: ownerId }, data: { role: k.rolle, phone: k.telefon, emailVerified: true } })
  await db.farm.create({
    data: {
      slug: h.slug,
      ownerId,
      name: h.name,
      ownerName: k.name,
      description: '',
      address: h.adresse,
      postalCode: h.plz,
      city: h.ort,
      country: 'AT',
      phone: k.telefon,
      email: k.email,
      acceptsOnline: false,
      acceptsOnsite: true,
      approvedAt: null,
    },
  })
}

type Hof = Awaited<ReturnType<typeof ladeHof>>

async function ladeHof(db: Db, slug: string) {
  return db.farm.findUniqueOrThrow({
    where: { slug },
    select: {
      ...HOF_FUER_GEBUEHR_LAGE,
      slug: true,
      serviceFeePercent: true,
      serviceFeeMinCents: true,
      serviceFeeActiveFrom: true,
      platformFeePercent: true,
      pickupSlots: { where: { isActive: true }, select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  })
}

/** Abholfenster für den Tag: das Fenster des Hofs an diesem Wochentag, sonst das erste. */
function fensterFuer(hof: Hof, abholung: Date): { von: string; bis: string } {
  const wochentag = new Date(`${kalendertagInWien(abholung)}T12:00:00.000Z`).getUTCDay()
  const slot = hof.pickupSlots.find((s) => s.dayOfWeek === wochentag) ?? hof.pickupSlots[0]
  return slot ? { von: slot.startTime, bis: slot.endTime } : { von: '15:00', bis: '18:00' }
}

/** (f, h, i) Eine Bestellung mit dem Snapshot der Kasse; null, wenn die Kasse sie abgelehnt hätte. */
async function bestellung(db: Db, hof: Hof, b: PruefBestellung, jetzt: Date): Promise<{ id: string; farmId: string; token: string | null } | { grund: string }> {
  const eingang = vor(jetzt, b.eingangVorStunden)
  const produkte = await db.product.findMany({ where: { id: { in: b.positionen.map((p) => p.produktId) } }, select: { id: true, name: true, price: true, vatRate: true } })
  const jeId = new Map(produkte.map((p) => [p.id, p]))
  const positionen = b.positionen.map((p) => {
    const produkt = jeId.get(p.produktId)
    if (!produkt) throw new Error(`Produkt ${p.produktId} fehlt`)
    return { productId: produkt.id, name: bestellPositionsName(produkt.name), unitPrice: produkt.price, quantity: p.menge, vatRate: produkt.vatRate }
  })
  // Die Lage zum Bestellzeitpunkt — derselbe Lader wie /api/checkout.
  const lage = await ladeGebuehrLage(hof, eingang)
  const snapshot = bestellSnapshot(lage, hof, positionen, b.zahlart, eingang)
  if ('grund' in snapshot) return snapshot

  const kunde = SEED_KONTEN.find((k) => k.email === b.kundenEmail)
  if (!kunde) throw new Error(`Konto ${b.kundenEmail} fehlt`)
  const abholung = abholMittag(jetzt, b.abholTag)
  const fenster = fensterFuer(hof, abholung)
  const online = b.zahlart === 'ONLINE'
  const offen = b.status === 'PENDING_CONFIRMATION'
  const bar = offen && !online ? neuerBarToken() : null
  const { items, ...felder } = snapshot
  const angelegt = await db.order.create({
    data: {
      orderNumber: b.nummer,
      farmId: hof.id,
      customerEmail: kunde.email,
      customerName: kunde.name,
      customerPhone: kunde.telefon,
      status: b.status,
      pickupDate: abholung,
      pickupTimeStart: fenster.von,
      pickupTimeEnd: fenster.bis,
      paymentMethod: b.zahlart,
      paymentStatus: online ? 'PAID' : 'PENDING',
      paidAt: online ? eingang : null,
      stripePaymentIntentId: online ? stripePlatzhalter(b.nummer) : null,
      confirmationToken: bar?.hash ?? null,
      confirmedAt: !online && !offen ? vor(eingang, -1) : null,
      ...felder,
      createdAt: eingang,
      // Decimal-Werte als Text in die Spalten — dieselben Werte, nur die Form, die Prisma annimmt.
      items: { create: items.map((i) => ({ ...i, unitPrice: i.unitPrice.toString(), totalPrice: i.totalPrice.toString(), vatRate: i.vatRate.toString() })) },
    },
    select: { id: true, farmId: true },
  })
  if (b.fehlt !== undefined) await meldeFehlend(db, angelegt.id, b.fehlt, jetzt)
  return { ...angelegt, token: bar?.token ?? null }
}

/**
 * (i) „Artikel fehlt“ mit der Rechnung der App (artikelFehltRechnung,
 * nachFehlendemArtikel): neue Summe, Gebühr und erstatteter Betrag, wie ihn
 * die Teilerstattung gebucht hätte. Stripe wird nicht gerufen.
 */
async function meldeFehlend(db: Db, orderId: string, index: number, jetzt: Date): Promise<void> {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: { orderBy: { id: 'asc' } } } })
  const position = o.items.find((i) => i.productId === PRUEF_BESTELLUNGEN.find((b) => b.nummer === o.orderNumber)?.positionen[index]?.produktId)
  if (!position) throw new Error('Position für „Artikel fehlt“ nicht gefunden')
  const stand: ArtikelFehltBestellung = {
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    stripePaymentIntentId: o.stripePaymentIntentId,
    warenpreisCents: decimalZuCents(o.totalAmount),
    serviceFeeCents: o.serviceFeeCents,
    serviceFeePercentApplied: o.serviceFeePercentApplied === null ? null : o.serviceFeePercentApplied.toNumber(),
    serviceFeeMinCentsApplied: o.serviceFeeMinCentsApplied,
    erstattetCents: o.erstattetCents,
    bestelltAm: o.createdAt,
    gebuehrModell: o.gebuehrModell,
    gebuehrEinzug: o.gebuehrEinzug,
    positionen: o.items.map((i) => ({ id: i.id, betragCents: alsCents(i.totalPrice), fehlt: i.fehltSeit !== null, gebuehrCents: i.gebuehrCents })),
  }
  const rechnung = artikelFehltRechnung(stand, position.id)
  if (rechnung.art !== 'teil') throw new Error(`„Artikel fehlt“ ergab ${rechnung.art}`)
  const neu = nachFehlendemArtikel(stand, position.id, rechnung, rechnung.zahlung === 'online' ? rechnung.erstattungCents : 0)
  await db.$transaction([
    db.orderItem.update({ where: { id: position.id }, data: { fehltSeit: vor(jetzt, 1) } }),
    db.order.update({ where: { id: orderId }, data: { totalAmount: new Prisma.Decimal(neu.warenpreisCents).div(100), serviceFeeCents: neu.serviceFeeCents, erstattetCents: neu.erstattetCents } }),
  ])
}

/** Welche Mail-Aufträge die App bei diesem Stand eingestellt hätte (nur Arten von bestellMailAuftrag). */
function mailArten(b: PruefBestellung): Array<Parameters<typeof bestellMailAuftrag>[0]> {
  const arten: Array<Parameters<typeof bestellMailAuftrag>[0]> = []
  if (b.zahlart === 'ONLINE') arten.push('bestellung-bestaetigung', 'bestellung-bezahlt-hof')
  else if (b.status === 'PENDING_CONFIRMATION') arten.push('bestellung-bar-hof')
  else arten.push('bestellung-bar-hof', 'bestellung-bestaetigung', 'bar-bestaetigt-hof')
  if (b.status === 'READY') arten.push('abholbereit')
  return arten
}

/** Wartet, bis der Worker der Warteschlange (startet in Skripten sofort) die Aufträge losgelassen hat. */
async function warteAufWorker(db: Db, ids: readonly string[]): Promise<void> {
  const ende = Date.now() + 60_000
  let ruhig = 0
  while (Date.now() < ende && ruhig < 3) {
    await new Promise((r) => setTimeout(r, 1000))
    const inArbeit = await db.mailAuftrag.count({ where: { bestellungId: { in: [...ids] }, status: 'in_arbeit' } })
    ruhig = inArbeit === 0 ? ruhig + 1 : 0
  }
}

export type ZusatzOptionen = { gruendungFest: boolean; seedPasswort: string }

/**
 * Schreibt alles aus 6.1 a–l und gibt die zusätzlichen Links zurück. Wirft
 * bei einem Fehler — pruef-seed.ts bricht dann ab (die DB ist Wegwerf).
 */
export async function ergaenzePruefDaten(db: Db, auth: Auth, jetzt: Date, optionen: ZusatzOptionen): Promise<{ links: Record<string, LinkEintrag>; zeilen: string[] }> {
  const zeilen: string[] = []
  const links: Record<string, LinkEintrag> = {}
  const admin = await db.user.findUniqueOrThrow({ where: { email: 'admin@example.com' }, select: { id: true } })
  zeilen.push(await gruendung(db, optionen.gruendungFest, admin.id))

  const hof = await ladeHof(db, PRUEF_FUTTER_FAMILIE.hofSlug)
  await produkte(db, hof.id, jetzt)
  await postfach(db, hof.id, admin.id, jetzt)
  await db.customerFarmSubscription.create({
    data: { customerEmail: PRUEF_WHATSAPP_ABO.email, farmId: hof.id, optInWhatsApp: true, customerPhone: PRUEF_WHATSAPP_ABO.telefon, createdAt: vor(jetzt, 72) },
  })
  await hofWartet(db, auth, optionen.seedPasswort)
  zeilen.push('Futter-Familie, Brennholz je Raummeter, Postfach, WhatsApp-Abo, wartender Hof')

  // (e) Mindestbestellwert: entsteht in der Kasse mit einem Korb unter 10 € Warenwert.
  links['kasse-mindestbestellwert'] = { pfad: `/${hof.slug}`, zustand: 'Hofpreis-Modell', hinweis: 'Korb mit 1 Liter Milch, dann zur Kasse: Mindestbestellwert' }
  links['hof-wartet-auf-freigabe'] = { pfad: '/dashboard', zustand: 'wartet auf Freigabe', hinweis: `Anmelden als ${PRUEF_HOF_WARTET.inhaberEmail} (Seed-Passwort)` }

  const angelegt: Array<{ b: PruefBestellung; id: string; farmId: string }> = []
  for (const b of PRUEF_BESTELLUNGEN) {
    const ergebnis = await bestellung(db, hof, b, jetzt)
    if ('grund' in ergebnis) {
      zeilen.push(`${b.nummer} nicht angelegt: ${ergebnis.grund}`)
      continue
    }
    angelegt.push({ b, id: ergebnis.id, farmId: ergebnis.farmId })
    if (['TP-HP-BAR', 'TP-HP-ONLINE', 'TP-FEHLT'].includes(b.nummer)) {
      links[`bestellung-${b.nummer}`] = { pfad: bestellungPfad(hof.slug, ergebnis.id), zustand: b.zustand }
      links[`bestaetigung-${b.nummer}`] = { pfad: bestaetigungsPfad(hof.slug, ergebnis.id), zustand: b.zustand }
    }
    if (ergebnis.token) links[`bar-bestaetigen-${b.nummer}`] = { pfad: barBestaetigungsPfad(hof.slug, ergebnis.token), zustand: b.zustand }
  }

  // (j) Rücktritt „nicht mehr möglich“: abgeholt außerhalb der Frist und storniert.
  for (const [nummer, zustand] of [
    ['TD-0001', 'abgeholt, Frist vorbei'],
    ['TD-0003', 'storniert'],
  ] as const) {
    const o = await db.order.findUniqueOrThrow({ where: { orderNumber: nummer }, select: { id: true } })
    links[`widerruf-${nummer}`] = { pfad: widerrufPfad(o.id), zustand: `nicht mehr möglich (${zustand})` }
  }

  // (l) Mail-Aufträge wie die App — nach dem Speichern, fail-open.
  for (const { b, id, farmId } of angelegt) {
    for (const art of mailArten(b)) {
      await stelleEinOhneRisiko(art, id, art === 'abholbereit' ? bestellMailAuftrag(art, { id, farmId }, jetzt) : bestellMailAuftrag(art, { id, farmId }))
    }
  }
  await warteAufWorker(db, angelegt.map((a) => a.id))
  zeilen.push(`${angelegt.length} Bestellungen mit Mail-Aufträgen`)
  return { links, zeilen }
}
