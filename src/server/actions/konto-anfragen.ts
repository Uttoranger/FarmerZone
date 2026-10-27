'use server'

import { createHmac } from 'crypto'
import { revalidatePath, updateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { APP_URL } from '@/lib/umgebung-server'
import { genauesIlikeMuster } from '@/lib/ilike-muster'
import { verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { einmalTokenHash, erzeugeEinmalLink, loeseEinmalLinkEin } from '@/server/geraete'
import { EINMAL_LINK_ART, einmalLinkZweck, nichtIchLink } from '@/lib/geraete'
import { ADMIN_GRUND_FEHLER, PLATTFORM_BEZUG } from '@/schemas/admin-aktion'
import {
  auskunftHofSchema,
  auskunftKundinSchema,
  emailAendernSchema,
  emailBestaetigenSchema,
  kontoSchliessenSchema,
  kontoWiederOeffnenSchema,
} from '@/schemas/konto-anfragen'
import {
  EMAIL_AENDERN_ART,
  EMAIL_AENDERN_TAGE,
  EMAIL_BESTAETIGEN_TEXT,
  KONTO_ANFRAGE_TEXT,
  emailBestaetigenLink,
  hofnameBestaetigt,
  normalisiereAdresse,
  schliessenSperre,
  wiederOeffnenMoeglich,
} from '@/lib/konto-anfragen'
import { auskunftDateiname, auskunftHof, auskunftKundin } from '@/lib/auskunft'
import { zaehleOffenesFuerSchliessen } from '@/lib/konto-schliessen'
import { ADMIN_HOEFE_HREF, adminHofHref } from '@/lib/admin-hof-akte'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'

/*
 * Konto-Anfragen eines Hofs (Register N36, Nachtlauf Nr. 190): Anmelde-E-Mail
 * ändern, Auskunft exportieren, Konto schließen und wieder öffnen.
 *
 * Jede Admin-Action ist heikel (N20): frisch mit Passkey — die EINE Wache
 * verlangeFrischeBestaetigung({ recht }) als erste Anweisung — und schreibt
 * nach der Wirkung ins Protokoll (N33), nie Adresse, Name oder Token.
 * Antworten verraten nie, ob es zu einer Adresse ein Konto gibt (Freigabe
 * Lauf 26, §2).
 *
 * `bestaetigeEmailAenderung` ist KEINE Admin-Action: Sie löst den Link aus
 * der Mail an die neue Adresse ein (Seite /konto/email-bestaetigen).
 */

type Ergebnis = { ok: true } | { error: string }
export type AuskunftErgebnis = { ok: true; dateiname: string; inhalt: string } | { error: string }

/** Die Meldung bei ungültiger Eingabe — ein Grund mit Adresse oder Telefonnummer bekommt seinen eigenen Satz. */
function eingabeFehler(issues: ReadonlyArray<{ message: string }>, sonst: string): { error: string } {
  return { error: issues.some((i) => i.message === ADMIN_GRUND_FEHLER) ? ADMIN_GRUND_FEHLER : sonst }
}

/** Der Bezug des Einmal-Links: HMAC der neuen Adresse — die Adresse selbst steht nie in der Datenbank. */
function adressHash(adresse: string): string {
  return createHmac('sha256', env.BETTER_AUTH_SECRET).update(`email-aendern:${normalisiereAdresse(adresse)}`).digest('hex')
}

/** Hat ein ANDERES Konto diese Adresse? Groß-/Kleinschreibung zählt nicht (wie die Anmeldung). */
async function adresseVergeben(adresse: string, ausser: string | null): Promise<boolean> {
  const treffer = await prisma.user.count({
    where: { email: { equals: genauesIlikeMuster(adresse), mode: 'insensitive' }, ...(ausser ? { id: { not: ausser } } : {}) },
  })
  return treffer > 0
}

function meldeNachlauf(aufgabe: string, err: unknown): void {
  const meldung = new Error(`Konto-Anfragen: ${aufgabe}`)
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'konto-anfragen', aufgabe } })
}

function revalidiere(farmId: string, slug: string | null): void {
  revalidatePath(ADMIN_HOEFE_HREF)
  revalidatePath(adminHofHref(farmId))
  if (slug) revalidatePath(`/${slug}`)
  updateTag(HOEFE_CACHE_TAG)
}

// ─── Anmelde-E-Mail ändern ──────────────────────────────────────────────────

/**
 * „Anmelde-E-Mail ändern …“: legt einen Einmal-Link (24 Stunden, Zweck
 * `email-aendern:<Hash der neuen Adresse>`) an und schickt ihn an die NEUE
 * Adresse. Hat schon ein anderes Konto die Adresse, entsteht kein Link und
 * keine Mail — die Antwort ist dieselbe. Bis zum Klick bleibt alles, wie es ist.
 */
export async function aendereAnmeldeEmail(eingabe: unknown): Promise<Ergebnis> {
  const frisch = await verlangeFrischeBestaetigung({ recht: 'hoefe_freischalten' })
  if ('error' in frisch) return { error: frisch.error }

  const parsed = emailAendernSchema.safeParse(eingabe)
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === 'neueAdresse')) return { error: KONTO_ANFRAGE_TEXT.email.ungueltig }
    return eingabeFehler(parsed.error.issues, KONTO_ANFRAGE_TEXT.eingabe)
  }
  const { farmId, neueAdresse, grund } = parsed.data

  const hof = await prisma.farm.findUnique({ where: { id: farmId }, select: { name: true, ownerId: true, owner: { select: { email: true } } } })
  if (!hof) return { error: KONTO_ANFRAGE_TEXT.nichtGefunden }
  if (normalisiereAdresse(hof.owner.email) === neueAdresse) return { error: KONTO_ANFRAGE_TEXT.email.gleich }

  if (!(await adresseVergeben(neueAdresse, hof.ownerId))) {
    const jetzt = new Date()
    const token = await erzeugeEinmalLink({
      userId: hof.ownerId,
      zweck: einmalLinkZweck(EMAIL_AENDERN_ART, adressHash(neueAdresse)),
      jetzt,
      tage: EMAIL_AENDERN_TAGE,
    })
    const { sendEmailAendernLink } = await import('@/lib/email')
    // Ohne RESEND_API_KEY schreibt sendRaw nur Betreff und Empfänger (gekürzt) ins Log — nie den Link.
    const versand = await sendEmailAendernLink(neueAdresse, { hof: hof.name, link: emailBestaetigenLink(APP_URL, token) })
    if (versand.error && process.env.RESEND_API_KEY) return { error: KONTO_ANFRAGE_TEXT.email.mailFehler }
  }

  await protokolliere({ wer: frisch.userId, art: 'anmelde_email_angefragt', bezugArt: 'hof', bezugId: farmId, grund, mitPasskey: frisch.mitPasskey })
  revalidatePath(adminHofHref(farmId))
  return { ok: true }
}

export type EmailBestaetigenErgebnis = { ok: true } | { error: string; ungueltig?: true }

/**
 * Löst den Link aus der Mail an die neue Adresse ein — die Person tippt die
 * neue Adresse noch einmal (sie steht weder in der Datenbank noch im Link).
 * In EINER Transaktion: Link genau einmal einlösen (nur mit passender
 * Adresse), Adresse setzen und als bestätigt markieren, alle Sitzungen
 * löschen. Danach (Nachlauf) die Sicherheitsmail an die ALTE Adresse mit
 * „Das war ich nicht“ und der Eintrag im Protokoll.
 */
export async function bestaetigeEmailAenderung(eingabe: unknown): Promise<EmailBestaetigenErgebnis> {
  const parsed = emailBestaetigenSchema.safeParse(eingabe)
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === 'token')) return { error: EMAIL_BESTAETIGEN_TEXT.ungueltigTitel, ungueltig: true }
    return { error: EMAIL_BESTAETIGEN_TEXT.falscheAdresse }
  }
  const { token, adresse } = parsed.data
  const jetzt = new Date()
  const zweck = einmalLinkZweck(EMAIL_AENDERN_ART, adressHash(adresse))

  type Ausgang = { art: 'ok'; userId: string; alteAdresse: string; hof: { id: string; name: string } | null } | { art: 'falsch' } | { art: 'vergeben' }
  let ausgang: Ausgang
  try {
    ausgang = await prisma.$transaction(async (tx) => {
      const treffer = await loeseEinmalLinkEin(token, zweck, jetzt, tx)
      if (!treffer) return { art: 'falsch' } as const
      const vergeben = await tx.user.count({ where: { email: { equals: genauesIlikeMuster(adresse), mode: 'insensitive' }, id: { not: treffer.userId } } })
      // Der Link bleibt verbraucht: Mit dieser Adresse taugt er nie mehr.
      if (vergeben > 0) return { art: 'vergeben' } as const
      const vorher = await tx.user.findUniqueOrThrow({ where: { id: treffer.userId }, select: { email: true, farm: { select: { id: true, name: true } } } })
      await tx.user.update({ where: { id: treffer.userId }, data: { email: adresse, emailVerified: true } })
      await tx.session.deleteMany({ where: { userId: treffer.userId } })
      return { art: 'ok', userId: treffer.userId, alteAdresse: vorher.email, hof: vorher.farm } as const
    })
  } catch (err) {
    // Eindeutige Adresse (P2002): Ein anderes Konto kam dazwischen — derselbe Satz wie „vergeben“.
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === 'P2002') return { error: EMAIL_BESTAETIGEN_TEXT.nichtVerwendbar }
    meldeNachlauf('bestaetigen', err)
    return { error: EMAIL_BESTAETIGEN_TEXT.fehler }
  }
  if (ausgang.art === 'falsch') {
    // Gilt der Link mit irgendeiner Adresse noch? Dann war nur die Adresse falsch — sonst ist der Link weg.
    const offen = await prisma.einmalLink.count({ where: { tokenHash: einmalTokenHash(token), benutztAm: null, ablaufAm: { gt: jetzt } } })
    return offen > 0 ? { error: EMAIL_BESTAETIGEN_TEXT.falscheAdresse } : { error: EMAIL_BESTAETIGEN_TEXT.ungueltigTitel, ungueltig: true }
  }
  if (ausgang.art === 'vergeben') return { error: EMAIL_BESTAETIGEN_TEXT.nichtVerwendbar }

  await sagEsDerAltenAdresse(ausgang.userId, ausgang.alteAdresse, ausgang.hof?.name ?? null, jetzt)
  await protokolliere({ wer: null, art: 'anmelde_email_geaendert', bezugArt: ausgang.hof ? 'hof' : 'person', bezugId: ausgang.hof?.id ?? ausgang.userId, mitPasskey: false })
  return { ok: true }
}

/** Sicherheitsmail an die alte Adresse mit „Das war ich nicht“ — Nachlauf: Ein Fehler nimmt die Änderung nie zurück. */
async function sagEsDerAltenAdresse(userId: string, alteAdresse: string, hof: string | null, jetzt: Date): Promise<void> {
  try {
    const token = await erzeugeEinmalLink({ userId, zweck: einmalLinkZweck(EINMAL_LINK_ART.nichtIch, 'email-geaendert'), jetzt })
    const { sendEmailGeaendertHinweis } = await import('@/lib/email')
    const versand = await sendEmailGeaendertHinweis(alteAdresse, { hof, zeitpunkt: jetzt, link: nichtIchLink(APP_URL, token) })
    if (versand.error && process.env.RESEND_API_KEY) meldeNachlauf('hinweis_resend', new Error('resend'))
  } catch (err) {
    meldeNachlauf('hinweis', err)
  }
}

// ─── Auskunft ───────────────────────────────────────────────────────────────

const POSITIONEN = { select: { productName: true, quantity: true, unitPrice: true, totalPrice: true } } as const

/** „Auskunft exportieren“ für einen Hof — ohne Daten der Kundschaft (auskunftHof). */
export async function exportiereAuskunftHof(eingabe: unknown): Promise<AuskunftErgebnis> {
  const frisch = await verlangeFrischeBestaetigung({ recht: 'adresse_anzeigen' })
  if ('error' in frisch) return { error: frisch.error }

  const parsed = auskunftHofSchema.safeParse(eingabe)
  if (!parsed.success) return eingabeFehler(parsed.error.issues, KONTO_ANFRAGE_TEXT.eingabe)
  const { farmId, grund } = parsed.data

  const hof = await prisma.farm.findUnique({
    where: { id: farmId },
    select: {
      id: true, slug: true, name: true, ownerName: true, description: true, tagline: true, aboutText: true,
      address: true, postalCode: true, city: true, country: true, phone: true, email: true, betriebsnummer: true,
      createdAt: true, approvedAt: true, archivedAt: true, geschlossenAm: true,
      owner: { select: { id: true, email: true, name: true, phone: true, emailVerified: true, createdAt: true } },
      products: { select: { id: true, name: true, description: true, price: true, unit: true, stock: true, isAvailable: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      pickupSlots: { select: { dayOfWeek: true, startTime: true, endTime: true, isActive: true }, orderBy: { dayOfWeek: 'asc' } },
      statusPosts: { select: { id: true, title: true, body: true, publishedAt: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      unterhaltungen: { select: { id: true, createdAt: true, nachrichten: { select: { vonFarmId: true, text: true, art: true, createdAt: true }, orderBy: { createdAt: 'asc' } } } },
      meldungen: { select: { id: true, art: true, text: true, status: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      orders: {
        select: { id: true, orderNumber: true, status: true, paymentMethod: true, paymentStatus: true, totalAmount: true, createdAt: true, pickupDate: true, items: POSITIONEN },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!hof) return { error: KONTO_ANFRAGE_TEXT.nichtGefunden }
  const { owner, products, pickupSlots, statusPosts, unterhaltungen, meldungen, orders, ...stamm } = hof
  const jetzt = new Date()
  const datei = auskunftHof(
    { konto: owner, hof: stamm, produkte: products, abholzeiten: pickupSlots, beitraege: statusPosts, postfach: unterhaltungen, meldungen, bestellungen: orders },
    jetzt
  )

  await protokolliere({ wer: frisch.userId, art: 'auskunft_exportiert', bezugArt: 'hof', bezugId: farmId, grund, mitPasskey: frisch.mitPasskey })
  return { ok: true, dateiname: auskunftDateiname('hof', farmId, jetzt), inhalt: JSON.stringify(datei, null, 2) }
}

/** Auskunft für eine Adresse der Kundschaft — genau diese Adresse (Suche wie Admin › Bestellungen). */
export async function exportiereAuskunftKundin(eingabe: unknown): Promise<AuskunftErgebnis> {
  const frisch = await verlangeFrischeBestaetigung({ recht: 'adresse_anzeigen' })
  if ('error' in frisch) return { error: frisch.error }

  const parsed = auskunftKundinSchema.safeParse(eingabe)
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === 'adresse')) return { error: KONTO_ANFRAGE_TEXT.email.ungueltig }
    return eingabeFehler(parsed.error.issues, KONTO_ANFRAGE_TEXT.eingabe)
  }
  const { adresse, grund } = parsed.data
  const genau = { equals: genauesIlikeMuster(adresse), mode: 'insensitive' as const }

  const [bestellungen, abos, konto] = await Promise.all([
    prisma.order.findMany({
      where: { customerEmail: genau },
      select: {
        id: true, orderNumber: true, customerEmail: true, customerName: true, customerPhone: true, status: true, paymentMethod: true,
        totalAmount: true, createdAt: true, pickupDate: true, farm: { select: { name: true } }, items: POSITIONEN,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.customerFarmSubscription.findMany({
      where: { customerEmail: genau },
      select: { customerEmail: true, optInEmail: true, optInWhatsApp: true, createdAt: true, farm: { select: { name: true } } },
    }),
    // Sitzungen OHNE IP: ipAddress wird nicht gelesen.
    prisma.user.findFirst({ where: { email: genau }, select: { email: true, sessions: { select: { createdAt: true, expiresAt: true, userAgent: true } } } }),
  ])
  const jetzt = new Date()
  const datei = auskunftKundin(adresse, { bestellungen, abos, konto: konto ? { email: konto.email, sitzungen: konto.sessions } : null }, jetzt)

  // Bezug ohne Adresse: die Plattform; der Grund sagt, wofür (N33).
  await protokolliere({ wer: frisch.userId, art: 'auskunft_exportiert', bezugArt: 'plattform', bezugId: PLATTFORM_BEZUG, grund, mitPasskey: frisch.mitPasskey })
  return { ok: true, dateiname: auskunftDateiname('kundschaft', null, jetzt), inhalt: JSON.stringify(datei, null, 2) }
}

// ─── Konto schließen ────────────────────────────────────────────────────────

/**
 * „Konto schließen …“, Stufe 1 (N36): Hofseite offline (`geschlossenAm`),
 * Anmelden gesperrt (Hook in src/lib/auth.ts), Sitzungen gelöscht, Abos
 * beendet (kein Versand mehr). Nur ohne offene Bestellung oder Erstattung und
 * mit eingetipptem Hofnamen. Bedingt geschrieben — zweimal schließen ändert nichts.
 */
export async function schliesseKonto(eingabe: unknown): Promise<Ergebnis> {
  const frisch = await verlangeFrischeBestaetigung({ recht: 'hoefe_freischalten' })
  if ('error' in frisch) return { error: frisch.error }

  const parsed = kontoSchliessenSchema.safeParse(eingabe)
  if (!parsed.success) return eingabeFehler(parsed.error.issues, KONTO_ANFRAGE_TEXT.eingabe)
  const { farmId, grund, hofname } = parsed.data

  const hof = await prisma.farm.findUnique({ where: { id: farmId }, select: { name: true, slug: true, ownerId: true, geschlossenAm: true } })
  if (!hof) return { error: KONTO_ANFRAGE_TEXT.nichtGefunden }
  if (hof.geschlossenAm) return { error: KONTO_ANFRAGE_TEXT.schliessen.schonGeschlossen }
  if (!hofnameBestaetigt(hofname, hof.name)) return { error: KONTO_ANFRAGE_TEXT.schliessen.bestaetigenFalsch }

  const ergebnis = await prisma.$transaction(async (tx) => {
    // In der Transaktion gezählt: Eine Bestellung, die gerade noch hereinkam, sperrt das Schließen.
    const sperre = schliessenSperre(await zaehleOffenesFuerSchliessen(farmId, tx))
    if (sperre) return { error: sperre }
    const { count } = await tx.farm.updateMany({ where: { id: farmId, geschlossenAm: null }, data: { geschlossenAm: new Date() } })
    if (count === 0) return { error: KONTO_ANFRAGE_TEXT.schliessen.schonGeschlossen }
    await tx.session.deleteMany({ where: { userId: hof.ownerId } })
    await tx.customerFarmSubscription.updateMany({ where: { farmId }, data: { optInEmail: false, optInWhatsApp: false } })
    return { ok: true as const }
  })
  if ('error' in ergebnis) return ergebnis

  await protokolliere({ wer: frisch.userId, art: 'konto_geschlossen', bezugArt: 'hof', bezugId: farmId, grund, mitPasskey: frisch.mitPasskey })
  revalidiere(farmId, hof.slug)
  return { ok: true }
}

/** „Wieder öffnen …“: nur in den ersten 30 Tagen und vor Stufe 2. Abos bleiben beendet. */
export async function oeffneKontoWieder(eingabe: unknown): Promise<Ergebnis> {
  const frisch = await verlangeFrischeBestaetigung({ recht: 'hoefe_freischalten' })
  if ('error' in frisch) return { error: frisch.error }

  const parsed = kontoWiederOeffnenSchema.safeParse(eingabe)
  if (!parsed.success) return eingabeFehler(parsed.error.issues, KONTO_ANFRAGE_TEXT.eingabe)
  const { farmId, grund } = parsed.data

  const hof = await prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true, geschlossenAm: true, endgueltigAm: true } })
  if (!hof) return { error: KONTO_ANFRAGE_TEXT.nichtGefunden }
  const jetzt = new Date()
  if (!hof.geschlossenAm || !wiederOeffnenMoeglich(hof, jetzt)) return { error: KONTO_ANFRAGE_TEXT.wiederOeffnen.zuSpaet }

  // Bedingt: genau der gelesene Zeitpunkt und noch nicht endgültig — sonst lief Stufe 2 dazwischen.
  const { count } = await prisma.farm.updateMany({ where: { id: farmId, geschlossenAm: hof.geschlossenAm, endgueltigAm: null }, data: { geschlossenAm: null } })
  if (count === 0) return { error: KONTO_ANFRAGE_TEXT.wiederOeffnen.zuSpaet }

  await protokolliere({ wer: frisch.userId, art: 'konto_wieder_geoeffnet', bezugArt: 'hof', bezugId: farmId, grund, mitPasskey: frisch.mitPasskey })
  revalidiere(farmId, hof.slug)
  return { ok: true }
}
