import { createHash } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { PRODUCT_CATEGORY_VALUES, istFuttermittel } from '@/lib/taxonomie'
import {
  MELDUNG_STATUS_OFFEN_IM_EINGANG,
  empfaengerArtAus,
  istNeuFuer,
  offenGesamt,
  rundschreibenGelesen,
  type EingangFilter,
  type EingangMeldungRoh,
  type EingangRoh,
  type EingangZahlen,
  type EmpfaengerArt,
  type EmpfaengerHof,
  type ErstattungAufgabeRoh,
  type FadenNachricht,
  type FadenRoh,
  type HofAufgabeRoh,
} from '@/lib/postfach'
import {
  ZUSTELL_STANDARD,
  empfaengerFuer,
  empfaengerZustand,
  zustellRegelnAus,
  type EmpfaengerZustand,
  type ZustellArt,
  type ZustellRegeln,
} from '@/lib/zustellung'
import { PLATTFORM_EINSTELLUNG_ID } from '@/lib/plattform-einstellung'
import { MELDUNG_STATUS, STATUS_INTERN, kurznummer } from '@/lib/meldung'
import { hatRegistrierung } from '@/lib/futter-registrierung'
import { hofseiteFortschritt, hofseiteStand } from '@/lib/hofseite-fortschritt'
import { bestaetigungOffen } from '@/lib/email-bestaetigung'
import { platzBeiFreischaltung } from '@/lib/admin-hoefe-seite'
import { stornoBetraege } from '@/lib/storno'
import { alsCents } from '@/lib/order-totals'
import { monatsgrenzenWien } from '@/lib/servicegebuehr'
import { DEFAULT_SECTIONS, type SectionConfig } from '@/server/queries/appearance'
import { ladeHoefeFuerGruendung, leseGruendungEinstellung } from '@/server/queries/admin'
import { getMeldungenFuerAdmin } from '@/server/queries/meldung'
import { HOF_SICHTBAR_WO } from '@/lib/hof-sichtbar'

/*
 * Lesen rund um das Postfach (Register N12, Nachtlauf Nr. 87). Regeln
 * (ungelesen, Heute, Empfänger) stehen rein in src/lib/postfach.ts; hier wird
 * nur gelesen. Der Hof liest nur Fäden mit seiner farmId in der WHERE-Klausel
 * — die Kennung aus der Adresse allein öffnet nichts. Nachrichtentexte sind
 * Fremdtext: Sie gehen nur als Text an die Oberfläche, nie nach Sentry.
 */

/** Mehr Fäden zeigt die Liste des Hofs nie auf einmal. */
const HOF_LISTE_MAX = 100
/** Mehr Unterhaltungen bzw. Rundschreiben zeigt der Admin nie auf einmal. */
const ADMIN_LISTE_MAX = 200
const RUNDSCHREIBEN_MAX = 50

const FUTTER_KATEGORIEN = PRODUCT_CATEGORY_VALUES.filter((k) => istFuttermittel(k))

const NACHRICHT_FELDER = { id: true, vonFarmId: true, text: true, linkUrl: true, art: true, createdAt: true } as const

// ─── Hof ─────────────────────────────────────────────────────────────────────

/**
 * Die Fäden eines Hofs für Liste und Heute: je Faden Titel, Lesestand des
 * Hofs, die neueste Nachricht vom Team und die neueste des Hofs.
 */
export async function ladeFaedenHof(farmId: string): Promise<FadenRoh[]> {
  const faeden = await prisma.unterhaltung.findMany({
    where: { farmId },
    orderBy: { letzteNachrichtAm: 'desc' },
    take: HOF_LISTE_MAX,
    select: {
      id: true,
      letzteNachrichtAm: true,
      rundschreiben: { select: { titel: true, art: true } },
      staende: { where: { seite: 'HOF' }, select: { gelesenBis: true } },
      nachrichten: {
        where: { vonFarmId: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, text: true, linkUrl: true, art: true, createdAt: true },
      },
    },
  })
  // Die neueste eigene Antwort je Faden („Du hast geantwortet · …") — eine Abfrage für alle.
  const eigene = faeden.length
    ? await prisma.nachricht.findMany({
        where: { unterhaltungId: { in: faeden.map((f) => f.id) }, vonFarmId: farmId },
        orderBy: { createdAt: 'desc' },
        distinct: ['unterhaltungId'],
        select: { unterhaltungId: true, text: true, createdAt: true },
      })
    : []
  const eigeneJeFaden = new Map(eigene.map((n) => [n.unterhaltungId, { text: n.text, createdAt: n.createdAt }]))
  return faeden.map((f) => ({
    id: f.id,
    titel: f.rundschreiben?.titel ?? null,
    rundschreibenWichtig: f.rundschreiben?.art === 'WICHTIG',
    letzteNachrichtAm: f.letzteNachrichtAm,
    gelesenBis: f.staende[0]?.gelesenBis ?? null,
    neuesteVomTeam: f.nachrichten[0] ?? null,
    neuesteVomHof: eigeneJeFaden.get(f.id) ?? null,
  }))
}

/**
 * Wie viele Fäden des Hofs etwas Ungelesenes vom Team haben — der Zähler an
 * „Postfach" in der HofShell, auf jeder Seite des Hofbereichs. EINE Abfrage
 * statt der Liste; dieselbe Regel wie zaehleUngelesen (src/lib/postfach.ts),
 * an denselben Zeilen geprüft in tests/integration/postfach.int.test.ts.
 */
export async function zaehleUngelesenHof(farmId: string): Promise<number> {
  const [zeile] = await prisma.$queryRaw<{ anzahl: number }[]>`
    SELECT COUNT(*)::int AS anzahl
    FROM "Unterhaltung" u
    LEFT JOIN "UnterhaltungStand" s ON s."unterhaltungId" = u."id" AND s."seite" = 'HOF'
    WHERE u."farmId" = ${farmId}
      AND EXISTS (
        SELECT 1 FROM "Nachricht" n
        WHERE n."unterhaltungId" = u."id" AND n."vonFarmId" IS NULL
          AND (s."gelesenBis" IS NULL OR n."createdAt" > s."gelesenBis")
      )`
  return zeile?.anzahl ?? 0
}

export type FadenAnsicht = {
  id: string
  titel: string | null
  rundschreiben: { gesendetAm: Date; perMail: boolean; wichtig: boolean; empfaenger: number; antwortMoeglich: boolean } | null
  nachrichten: FadenNachricht[]
  /** Lesestand der anderen Seite — für „gelesen" an den eigenen Nachrichten. */
  gelesenBisAndere: Date | null
  /** Lesestand der eigenen Seite — ob das Öffnen etwas zu lesen hat. */
  gelesenBisEigene: Date | null
}

/** Der Faden eines Hofs — null, wenn er nicht diesem Hof gehört (oder nicht existiert). */
export async function ladeFadenHof(farmId: string, unterhaltungId: string): Promise<FadenAnsicht | null> {
  const faden = await prisma.unterhaltung.findFirst({
    where: { id: unterhaltungId, farmId },
    select: {
      id: true,
      rundschreiben: { select: { titel: true, gesendetAm: true, perMail: true, art: true, empfaenger: true, antwortMoeglich: true } },
      nachrichten: { orderBy: { createdAt: 'asc' }, select: NACHRICHT_FELDER },
      staende: { select: { seite: true, gelesenBis: true } },
    },
  })
  if (!faden) return null
  return alsAnsicht(faden, 'HOF')
}

function alsAnsicht(
  faden: {
    id: string
    rundschreiben: { titel: string; gesendetAm: Date; perMail: boolean; art: 'INFO' | 'WICHTIG'; empfaenger: number; antwortMoeglich: boolean } | null
    nachrichten: FadenNachricht[]
    staende: { seite: 'HOF' | 'TEAM'; gelesenBis: Date }[]
  },
  seite: 'HOF' | 'TEAM'
): FadenAnsicht {
  const stand = (s: 'HOF' | 'TEAM') => faden.staende.find((x) => x.seite === s)?.gelesenBis ?? null
  return {
    id: faden.id,
    titel: faden.rundschreiben?.titel ?? null,
    rundschreiben: faden.rundschreiben
      ? {
          gesendetAm: faden.rundschreiben.gesendetAm,
          perMail: faden.rundschreiben.perMail,
          wichtig: faden.rundschreiben.art === 'WICHTIG',
          empfaenger: faden.rundschreiben.empfaenger,
          antwortMoeglich: faden.rundschreiben.antwortMoeglich,
        }
      : null,
    nachrichten: faden.nachrichten,
    gelesenBisAndere: stand(seite === 'HOF' ? 'TEAM' : 'HOF'),
    gelesenBisEigene: stand(seite),
  }
}

// ─── Admin ───────────────────────────────────────────────────────────────────

/**
 * Wie viele Fäden eine ungelesene Antwort eines Hofs haben — zusammen mit den
 * Meldungen, die auf das Team warten, die Zahl am Reiter „Postfach".
 */
export async function zaehleUngelesenTeam(): Promise<number> {
  const [zeile] = await prisma.$queryRaw<{ anzahl: number }[]>`
    SELECT COUNT(*)::int AS anzahl
    FROM "Unterhaltung" u
    LEFT JOIN "UnterhaltungStand" s ON s."unterhaltungId" = u."id" AND s."seite" = 'TEAM'
    WHERE EXISTS (
      SELECT 1 FROM "Nachricht" n
      WHERE n."unterhaltungId" = u."id" AND n."vonFarmId" IS NOT NULL
        AND (s."gelesenBis" IS NULL OR n."createdAt" > s."gelesenBis")
    )`
  return zeile?.anzahl ?? 0
}

export type AdminUnterhaltung = {
  id: string
  hofName: string
  hofOrt: string
  titel: string | null
  letzteAntwort: { text: string; createdAt: Date }
  ungelesen: boolean
}

/** Fäden, in denen ein Hof geantwortet hat — neueste zuerst. */
export async function ladeUnterhaltungenAdmin(): Promise<AdminUnterhaltung[]> {
  const faeden = await prisma.unterhaltung.findMany({
    where: { nachrichten: { some: { vonFarmId: { not: null } } } },
    orderBy: { letzteNachrichtAm: 'desc' },
    take: ADMIN_LISTE_MAX,
    select: {
      id: true,
      farm: { select: { name: true, city: true } },
      rundschreiben: { select: { titel: true } },
      staende: { where: { seite: 'TEAM' }, select: { gelesenBis: true } },
      nachrichten: {
        where: { vonFarmId: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { vonFarmId: true, text: true, createdAt: true },
      },
    },
  })
  return faeden.flatMap((f) => {
    const antwort = f.nachrichten[0]
    if (!antwort) return []
    return [
      {
        id: f.id,
        hofName: f.farm.name,
        hofOrt: f.farm.city,
        titel: f.rundschreiben?.titel ?? null,
        letzteAntwort: { text: antwort.text, createdAt: antwort.createdAt },
        ungelesen: istNeuFuer('TEAM', antwort, f.staende[0]?.gelesenBis ?? null),
      },
    ]
  })
}

export type AdminFaden = FadenAnsicht & { hof: { id: string; name: string; ort: string; slug: string } }

/** Ein Faden für den Admin (jeder Hof). */
export async function ladeFadenAdmin(unterhaltungId: string): Promise<AdminFaden | null> {
  const faden = await prisma.unterhaltung.findUnique({
    where: { id: unterhaltungId },
    select: {
      id: true,
      farm: { select: { id: true, name: true, city: true, slug: true } },
      rundschreiben: { select: { titel: true, gesendetAm: true, perMail: true, art: true, empfaenger: true, antwortMoeglich: true } },
      nachrichten: { orderBy: { createdAt: 'asc' }, select: NACHRICHT_FELDER },
      staende: { select: { seite: true, gelesenBis: true } },
    },
  })
  if (!faden) return null
  return { ...alsAnsicht(faden, 'TEAM'), hof: { id: faden.farm.id, name: faden.farm.name, ort: faden.farm.city, slug: faden.farm.slug } }
}

export type GesendetesRundschreiben = {
  id: string
  titel: string
  wichtig: boolean
  empfaengerArt: EmpfaengerArt
  empfaenger: number
  gelesen: number
  gesendetAm: Date
  antwortMoeglich: boolean
  /** In wie vielen Fäden ein Hof geantwortet hat. */
  antworten: number
}

/** Die gesendeten Rundschreiben mit Lesequote — neueste zuerst. */
export async function ladeRundschreibenListe(): Promise<GesendetesRundschreiben[]> {
  const liste = await prisma.rundschreiben.findMany({
    orderBy: { gesendetAm: 'desc' },
    take: RUNDSCHREIBEN_MAX,
    select: { id: true, titel: true, art: true, empfaengerRegel: true, empfaenger: true, gesendetAm: true, antwortMoeglich: true },
  })
  const ids = liste.map((r) => r.id)
  const [staende, beantwortet] = liste.length
    ? await Promise.all([
        prisma.unterhaltungStand.findMany({
          where: { seite: 'HOF', unterhaltung: { rundschreibenId: { in: ids } } },
          select: { gelesenBis: true, unterhaltung: { select: { rundschreibenId: true } } },
        }),
        prisma.unterhaltung.findMany({
          where: { rundschreibenId: { in: ids }, nachrichten: { some: { vonFarmId: { not: null } } } },
          select: { rundschreibenId: true },
        }),
      ])
    : [[], []]
  return liste.map((r) => ({
    id: r.id,
    titel: r.titel,
    wichtig: r.art === 'WICHTIG',
    empfaengerArt: empfaengerArtAus(r.empfaengerRegel),
    empfaenger: r.empfaenger,
    gelesen: staende.filter((s) => s.unterhaltung.rundschreibenId === r.id && rundschreibenGelesen(s.gelesenBis, r.gesendetAm)).length,
    gesendetAm: r.gesendetAm,
    antwortMoeglich: r.antwortMoeglich,
    antworten: beantwortet.filter((u) => u.rundschreibenId === r.id).length,
  }))
}

/** Wie viele Rundschreiben im laufenden Wiener Monat gesendet wurden — die Kennzahl „Rundschreiben". */
export async function zaehleRundschreibenImMonat(jetzt: Date): Promise<number> {
  const monat = monatsgrenzenWien(jetzt)
  return prisma.rundschreiben.count({ where: { gesendetAm: { gte: monat.von, lt: monat.bis } } })
}

/**
 * Die Höfe, die ein Rundschreiben bekommen können: nicht stillgelegt
 * (wartende eingeschlossen — „Online-Zahlung einrichten" betrifft gerade
 * sie), mit dem, was die Filter brauchen. Ohne Person und ohne E-Mail.
 */
export async function ladeEmpfaengerHoefe(): Promise<EmpfaengerHof[]> {
  const hoefe = await prisma.farm.findMany({
    where: { ...HOF_SICHTBAR_WO },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      city: true,
      stripeAccountReady: true,
      betriebsnummer: true,
      betriebsstatus: true,
      products: { where: { isAvailable: true, category: { in: FUTTER_KATEGORIEN } }, select: { id: true }, take: 1 },
    },
  })
  return hoefe.map((h) => ({
    id: h.id,
    name: h.name,
    ort: h.city,
    stripeAccountReady: h.stripeAccountReady,
    betriebsnummer: h.betriebsnummer,
    betriebsstatus: h.betriebsstatus,
    hatFutter: h.products.length > 0,
  }))
}

// ─── Eingang (Register N12-Änderung, N14; Nr. 95) ────────────────────────────

/**
 * Wartend heißt: noch nicht freigeschaltet und nicht stillgelegt (wie die
 * Gründungsplätze auf den Seiten, gruendungFuerSeiten) — ein stillgelegter Hof
 * kommt nie dran und ist keine Aufgabe.
 */
const WARTENDER_HOF = { approvedAt: null, ...HOF_SICHTBAR_WO } as const

/**
 * Was im Eingang offen ist, gezählt — die EINE Zählung für die Zahl am Reiter
 * „Postfach" (adminbereich.ts) und „Offen" im Eingang: ungelesene Antworten
 * (dieselbe SQL wie bisher), Meldungen NEU/GEPRUEFT, wartende Höfe und
 * Bestellungen mit offener Erstattung. Vier Zählungen, keine Listen.
 */
export async function zaehleOffenImEingang(): Promise<EingangZahlen & { gesamt: number }> {
  const [antworten, meldungen, hoefe, erstattungen] = await Promise.all([
    zaehleUngelesenTeam(),
    prisma.meldung.count({ where: { status: { in: [...MELDUNG_STATUS_OFFEN_IM_EINGANG] } } }),
    prisma.farm.count({ where: WARTENDER_HOF }),
    prisma.order.count({ where: { erstattungOffenSeit: { not: null } } }),
  ])
  const zahlen = { antworten, meldungen, hoefe, erstattungen }
  return { ...zahlen, gesamt: offenGesamt(zahlen) }
}

/**
 * Die wartenden Höfe mit allem, was Zeile und Prüfliste brauchen — aus
 * vorhandenen Feldern: Hofseite-Fortschritt (dieselbe Liste wie „Mein Hof",
 * hofseiteFortschritt), Stripe, SEPA, LFBIS bei Futtermitteln, Titelbild,
 * E-Mail bestätigt. Der Platz bei sofortiger Freischaltung mit derselben
 * Regel wie Admin › Höfe (platzBeiFreischaltung), mit der Einstellung
 * (Nr. 116: Plätze statt der festen 12; nach dem Stichtag kein Platz).
 * Ohne Inhaber-Adresse und ohne Texte des Hofs: Nur Ja/Nein und Zahlen
 * verlassen diese Funktion.
 */
export async function ladeHofAufgaben(jetzt: Date): Promise<HofAufgabeRoh[]> {
  const [hoefe, imRennen, einstellung] = await Promise.all([
    prisma.farm.findMany({
      where: WARTENDER_HOF,
      orderBy: { createdAt: 'desc' },
      take: ADMIN_LISTE_MAX,
      select: {
        id: true,
        name: true,
        createdAt: true,
        description: true,
        aboutText: true,
        logoUrl: true,
        bannerType: true,
        bannerUrl: true,
        address: true,
        postalCode: true,
        city: true,
        latitude: true,
        longitude: true,
        acceptsOnline: true,
        stripeAccountReady: true,
        phone: true,
        email: true,
        isPaused: true,
        sectionsConfig: true,
        sepaMandatAm: true,
        betriebsnummer: true,
        betriebsstatus: true,
        farmPhotos: { select: { id: true } },
        pickupSlots: { where: { isActive: true }, select: { dayOfWeek: true, startTime: true, endTime: true } },
        products: { where: { isAvailable: true, category: { in: FUTTER_KATEGORIEN } }, select: { id: true }, take: 1 },
        owner: { select: { emailVerified: true, createdAt: true } },
      },
    }),
    ladeHoefeFuerGruendung(),
    leseGruendungEinstellung(prisma),
  ])
  return hoefe.map((h) => {
    const sektionen = h.sectionsConfig
    const fortschritt = hofseiteFortschritt(
      hofseiteStand(
        { ...h, sectionsConfig: Array.isArray(sektionen) && sektionen.length > 0 ? (sektionen as SectionConfig[]) : DEFAULT_SECTIONS },
        { latitude: h.latitude, longitude: h.longitude }
      )
    )
    const titelbild = fortschritt.gruppen.flatMap((g) => g.zeilen).find((z) => z.id === 'titelbild')?.fertig ?? false
    return {
      id: h.id,
      name: h.name,
      createdAt: h.createdAt,
      hofseite: { erledigt: fortschritt.erledigt, gesamt: fortschritt.gesamt },
      stripeBereit: h.stripeAccountReady,
      sepaErteilt: h.sepaMandatAm !== null,
      futter: h.products.length > 0,
      lfbis: hatRegistrierung('LFBIS', h),
      titelbild,
      email: h.owner.emailVerified === true ? 'bestaetigt' : bestaetigungOffen(h.owner) ? 'offen' : 'vor-pflicht',
      platz: platzBeiFreischaltung(h.id, imRennen, jetzt, einstellung),
    }
  })
}

/**
 * Bestellungen mit offener Erstattung, älteste zuerst. Der Betrag ist, was
 * die Kundin online bezahlt hat — `stornoBetraege` wie Storno-Dialog und
 * Mail, keine neue Rechnung; die Anweisung je Weg steht in Mail und Sentry.
 * Keine Daten der Kundin.
 */
export async function ladeErstattungAufgaben(): Promise<ErstattungAufgabeRoh[]> {
  const bestellungen = await prisma.order.findMany({
    where: { erstattungOffenSeit: { not: null } },
    orderBy: { erstattungOffenSeit: 'asc' },
    take: ADMIN_LISTE_MAX,
    select: {
      id: true,
      orderNumber: true,
      erstattungOffenSeit: true,
      stripePaymentIntentId: true,
      paymentStatus: true,
      totalAmount: true,
      platformFeeAmount: true,
      serviceFeeCents: true,
      erstattetCents: true,
      farm: { select: { name: true } },
    },
  })
  return bestellungen.flatMap((b) => {
    if (!b.erstattungOffenSeit) return []
    const betraege = stornoBetraege({
      stripePaymentIntentId: b.stripePaymentIntentId,
      paymentStatus: b.paymentStatus,
      warenpreisCents: alsCents(b.totalAmount),
      provisionCents: alsCents(b.platformFeeAmount),
      serviceFeeCents: b.serviceFeeCents,
    })
    return [
      {
        id: b.id,
        bestellnummer: b.orderNumber,
        hofName: b.farm.name,
        seit: b.erstattungOffenSeit,
        bezahltCents: betraege?.erstattetCents ?? null,
        schonErstattetCents: b.erstattetCents,
        zahlungKennung: b.stripePaymentIntentId,
      },
    ]
  })
}

/** Wer eine Meldung schickte, als Wort — nie die Adresse der Kundin. */
function meldungVon(m: { hofName: string | null; customerEmail: string | null }): string {
  return m.hofName ?? (m.customerEmail ? 'Kundin (ohne Konto)' : 'Anonym')
}

/**
 * Die Meldungen des Eingangs: beim Filter „Offen" nur NEU/GEPRUEFT, sonst
 * die jüngsten aller Stände (getMeldungenFuerAdmin, höchstens 200).
 */
async function ladeMeldungenEingang(filter: EingangFilter): Promise<EingangMeldungRoh[]> {
  const status = filter === 'offen' ? [...MELDUNG_STATUS_OFFEN_IM_EINGANG] : [...MELDUNG_STATUS]
  const zeilen = await getMeldungenFuerAdmin({ status, art: null })
  return zeilen.map((m) => ({
    id: m.id,
    art: m.art,
    status: m.status,
    createdAt: m.createdAt,
    ersteZeile: m.ersteZeile,
    wer: meldungVon(m),
    zeile: `${STATUS_INTERN[m.status]} · Nr. ${kurznummer(m.id)}`,
  }))
}

/**
 * Die Rohdaten des Eingangs je Filter — gemischt und sortiert wird rein in
 * src/lib/postfach.ts (eingangEintraege). Was ein Filter nicht zeigt, wird
 * nicht geladen.
 */
export async function ladeEingang(filter: EingangFilter, jetzt: Date): Promise<EingangRoh> {
  const mitAntworten = filter === 'offen' || filter === 'antwort' || filter === 'alle'
  const mitMeldungen = filter === 'offen' || filter === 'meldung' || filter === 'alle'
  const mitAufgaben = filter === 'offen' || filter === 'aufgabe' || filter === 'alle'
  const [antworten, meldungen, hoefe, erstattungen] = await Promise.all([
    mitAntworten ? ladeUnterhaltungenAdmin() : Promise.resolve([]),
    mitMeldungen ? ladeMeldungenEingang(filter) : Promise.resolve([]),
    mitAufgaben ? ladeHofAufgaben(jetzt) : Promise.resolve([]),
    mitAufgaben ? ladeErstattungAufgaben() : Promise.resolve([]),
  ])
  return { antworten, meldungen, hoefe, erstattungen }
}

// ─── Zustellung (Register N14, Nr. 95) ───────────────────────────────────────

/**
 * Der Link der Bestätigungsmail steht nirgends: gespeichert ist nur sein
 * SHA-256. Hier, weil die Action (anlegen) und die Bestätigungsroute (lesen,
 * einlösen) denselben Wert brauchen. Gesucht wird über den eindeutigen Index
 * — kein Vergleich geheimer Werte im Code.
 */
export function empfaengerTokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Regeln und bestätigte Adressen, frisch — ein Lesepfad schreibt nie. */
export async function ladeZustellung(): Promise<{ regeln: ZustellRegeln; bestaetigte: string[] }> {
  const [einstellung, bestaetigte] = await Promise.all([
    prisma.plattformEinstellung.findUnique({ where: { id: PLATTFORM_EINSTELLUNG_ID }, select: { zustellRegeln: true } }),
    prisma.betreiberEmpfaenger.findMany({ where: { bestaetigtAm: { not: null } }, orderBy: { createdAt: 'asc' }, select: { email: true } }),
  ])
  return { regeln: zustellRegelnAus(einstellung?.zustellRegeln), bestaetigte: bestaetigte.map((e) => e.email) }
}

/**
 * Wer die Betreiber-Mail dieser Art bekommt (empfaengerFuer). Scheitert das
 * Lesen der Liste, geht die Mail trotzdem an SUPPORT_EMAIL nach dem heutigen
 * Verhalten — eine offene Erstattung darf nie still bleiben, nur weil die
 * Liste nicht lesbar war. Gemeldet wird ein fester Satz, nie eine Adresse.
 */
export async function ladeBetreiberEmpfaenger(art: ZustellArt): Promise<string[]> {
  try {
    return empfaengerFuer(art, await ladeZustellung())
  } catch (err) {
    Sentry.captureException(new Error('Zustellung nicht lesbar – Mail nur an die feste Adresse'), {
      level: 'warning',
      tags: { bereich: 'zustellung', art, klasse: err instanceof Error ? err.name : 'Unbekannt' },
    })
    return empfaengerFuer(art, { regeln: ZUSTELL_STANDARD, bestaetigte: [] })
  }
}

export type EmpfaengerZeile = { id: string; email: string; zustand: EmpfaengerZustand; createdAt: Date; bestaetigtAm: Date | null }

/** Was der Reiter „Zustellung" zeigt: die Regeln und jede weitere Adresse mit ihrem Stand. */
export async function ladeZustellungReiter(jetzt: Date): Promise<{ regeln: ZustellRegeln; empfaenger: EmpfaengerZeile[] }> {
  const [einstellung, empfaenger] = await Promise.all([
    prisma.plattformEinstellung.findUnique({ where: { id: PLATTFORM_EINSTELLUNG_ID }, select: { zustellRegeln: true } }),
    prisma.betreiberEmpfaenger.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, email: true, bestaetigtAm: true, tokenBis: true, createdAt: true } }),
  ])
  return {
    regeln: zustellRegelnAus(einstellung?.zustellRegeln),
    empfaenger: empfaenger.map((e) => ({ id: e.id, email: e.email, zustand: empfaengerZustand(e, jetzt), createdAt: e.createdAt, bestaetigtAm: e.bestaetigtAm })),
  }
}

/** Der Stand eines Links aus der Bestätigungsmail — die Frist gilt beim Lesen. */
export async function ladeEmpfaengerBestaetigung(token: string, jetzt: Date): Promise<{ zustand: 'offen' | 'abgelaufen' | 'ungueltig' }> {
  const zeile = await prisma.betreiberEmpfaenger.findUnique({ where: { token: empfaengerTokenHash(token) }, select: { tokenBis: true, bestaetigtAm: true } })
  if (!zeile || zeile.bestaetigtAm !== null) return { zustand: 'ungueltig' }
  return { zustand: empfaengerZustand(zeile, jetzt) === 'ausstehend' ? 'offen' : 'abgelaufen' }
}
