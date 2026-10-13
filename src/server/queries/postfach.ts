import { prisma } from '@/lib/prisma'
import { PRODUCT_CATEGORY_VALUES, istFuttermittel } from '@/lib/taxonomie'
import {
  empfaengerArtAus,
  istNeuFuer,
  rundschreibenGelesen,
  type EmpfaengerArt,
  type EmpfaengerHof,
  type FadenNachricht,
  type FadenRoh,
} from '@/lib/postfach'

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
  rundschreiben: { gesendetAm: Date; perMail: boolean; wichtig: boolean; empfaenger: number } | null
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
      rundschreiben: { select: { titel: true, gesendetAm: true, perMail: true, art: true, empfaenger: true } },
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
    rundschreiben: { titel: string; gesendetAm: Date; perMail: boolean; art: 'INFO' | 'WICHTIG'; empfaenger: number } | null
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
      rundschreiben: { select: { titel: true, gesendetAm: true, perMail: true, art: true, empfaenger: true } },
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
}

/** Die gesendeten Rundschreiben mit Lesequote — neueste zuerst. */
export async function ladeRundschreibenListe(): Promise<GesendetesRundschreiben[]> {
  const liste = await prisma.rundschreiben.findMany({
    orderBy: { gesendetAm: 'desc' },
    take: RUNDSCHREIBEN_MAX,
    select: { id: true, titel: true, art: true, empfaengerRegel: true, empfaenger: true, gesendetAm: true },
  })
  const staende = liste.length
    ? await prisma.unterhaltungStand.findMany({
        where: { seite: 'HOF', unterhaltung: { rundschreibenId: { in: liste.map((r) => r.id) } } },
        select: { gelesenBis: true, unterhaltung: { select: { rundschreibenId: true } } },
      })
    : []
  return liste.map((r) => ({
    id: r.id,
    titel: r.titel,
    wichtig: r.art === 'WICHTIG',
    empfaengerArt: empfaengerArtAus(r.empfaengerRegel),
    empfaenger: r.empfaenger,
    gelesen: staende.filter((s) => s.unterhaltung.rundschreibenId === r.id && rundschreibenGelesen(s.gelesenBis, r.gesendetAm)).length,
    gesendetAm: r.gesendetAm,
  }))
}

/**
 * Die Höfe, die ein Rundschreiben bekommen können: nicht stillgelegt
 * (wartende eingeschlossen — „Online-Zahlung einrichten" betrifft gerade
 * sie), mit dem, was die Filter brauchen. Ohne Person und ohne E-Mail.
 */
export async function ladeEmpfaengerHoefe(): Promise<EmpfaengerHof[]> {
  const hoefe = await prisma.farm.findMany({
    where: { archivedAt: null },
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

/** Für den Mailversand nach der Antwort: die Adresse des Kontos hinter dem Hof eines Fadens. */
export async function ladeMailEmpfaenger(unterhaltungIds: readonly string[]): Promise<{ unterhaltungId: string; email: string; titel: string | null }[]> {
  const faeden = await prisma.unterhaltung.findMany({
    where: { id: { in: [...unterhaltungIds] }, farm: { archivedAt: null } },
    select: { id: true, rundschreiben: { select: { titel: true } }, farm: { select: { owner: { select: { email: true } } } } },
  })
  return faeden.map((f) => ({ unterhaltungId: f.id, email: f.farm.owner.email, titel: f.rundschreiben?.titel ?? null }))
}
