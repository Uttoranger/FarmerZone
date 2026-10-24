'use server'

import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { verlangeAdminAktion, verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { beginneMessung, messeUndPruefe } from '@/server/betrieb'
import { arbeiteWarteschlange, stelleMailEin, type EinstellAuftrag } from '@/server/mail-warteschlange'
import { letzteMessungAm } from '@/server/queries/betrieb'
import { ladeGescheiterteDerArt, ladeNochmalStand, problemBedingung, zaehleNochmalHeute } from '@/server/queries/mails'
import { ladeBestellungFuerMail } from '@/server/mail-arten/bestellung'
import { baueMailVorschau } from '@/server/mail-arten/vorschau'
import { ADMIN_BETRIEB_HREF, BETRIEB_TEXT, fehlerKlasse } from '@/lib/betrieb'
import {
  ALLE_MAILS_TEXT,
  CODES_OHNE_JETZT_SCHICKEN,
  MAIL_TEXT,
  NOCHMAL_JE_TAG,
  NOCHMAL_STAENDE,
  adresseQuelle,
  artName,
  nochmalErlaubt,
  nochmalNieGrund,
  passtNochmal,
} from '@/lib/betrieb-mails'
import { neuerBarToken } from '@/lib/bar-bestaetigung'
import { uhrzeitInWien } from '@/lib/fristen'
import { VORRANG, bezugSchemaFuer, mailArtSchema } from '@/schemas/mail-auftrag'
import { mailArtEingabeSchema, mailAuswahlSchema, mailEinzelnSchema, type MailAuswahl } from '@/schemas/betrieb-mails'

/**
 * „Jetzt messen“ in Admin › Betrieb (Register N18, Nr. 103). Nur für den
 * Betreiber — das Admin-Recht ist die Besitzprüfung (`verlangeAdminAktion`,
 * frisch aus der Datenbank). Keine Eingabe, also kein Schema.
 *
 * Liegt die letzte Messung weniger als 10 Minuten zurück, misst sie nicht neu:
 * Jede Messung listet den Bild-Speicher, und jede Auflistung ist ein
 * Bild-Vorgang bei Vercel. Seit Nr. 113 entscheidet das EINE Anweisung
 * (`beginneMessung`) — zwei gleichzeitige Klicks messen nur einmal. Danach
 * prüft sie die Grenzen wie der Mess-Lauf; die Warn-Mail geht erst nach der
 * Antwort hinaus (`nachher`), der Knopf wartet nicht auf den Versand.
 *
 * Ein unerwarteter Fehler (die Messungen ließen sich nicht schreiben) wirft
 * und geht nach Sentry; eine Quelle, die scheitert (lokal: der Bild-Speicher
 * ohne Schlüssel), hält die anderen nicht auf — das sagt die Kachel.
 */
export async function messeJetztAction(): Promise<{ ok: true; satz: string } | { error: string }> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return { error: wache.error }

  const jetzt = new Date()
  if (!(await beginneMessung(jetzt))) {
    // Eine Messung begann vor weniger als 10 Minuten — ihre Uhrzeit (die Zeile ist sicher da, sonst hätte die Anweisung getroffen).
    const letzte = await letzteMessungAm(true)
    return { ok: true, satz: BETRIEB_TEXT.geradeGemessen(uhrzeitInWien(letzte ?? jetzt)) }
  }

  await messeUndPruefe(jetzt, { nachher: true })
  revalidatePath(ADMIN_BETRIEB_HREF)
  return { ok: true, satz: BETRIEB_TEXT.gemessen }
}

// ─── E-Mails: Jetzt schicken und Verwerfen (Nr. 161, Register N26, N20) ──────

/**
 * Ein Auftrag über seine Kennung; „alle einer Art“ nur die, die in „Braucht
 * dich“ stehen (`problemBedingung`, dieselbe wie die Liste) — nie eine Mail,
 * die gerade normal wartet, und nie eine, die vor mehr als 24 Stunden
 * gescheitert ist. Das n auf dem Knopf und die Zahl der geänderten Zeilen
 * kommen so aus derselben Bedingung.
 */
function auswahlBedingung(auswahl: MailAuswahl, jetzt: Date): Prisma.MailAuftragWhereInput {
  return 'id' in auswahl ? { id: auswahl.id } : { AND: [{ art: auswahl.art }, problemBedingung(jetzt)] }
}

/** Der Worker nach der Antwort — wie nach dem Einstellen; ein Fehler geht nach Sentry, die Zeile wartet auf den nächsten Lauf. */
function arbeiteNachher(): void {
  nachDerAntwort(async () => {
    try {
      await arbeiteWarteschlange({ biszeitMs: 45_000 })
    } catch (err) {
      const meldung = new Error('Betrieb: Worker nach „Jetzt schicken“ gescheitert')
      meldung.name = fehlerKlasse(err)
      Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'admin', seite: 'betrieb-mails' } })
    }
  })
}

/**
 * „Jetzt schicken“ (Wortliste N8): für eine Mail, die noch nie hinausging —
 * offen (wartet auf den nächsten Versuch) oder gescheitert. Setzt DIESELBE
 * Zeile auf offen, `versuche = 0`, `naechsterVersuchAm = jetzt`; der Worker
 * läuft gleich danach. Nur über die Warteschlange (nicht Sofort), nie eine
 * Zeile in Arbeit, nie mit einem Code, bei dem es nicht hilft
 * (`CODES_OHNE_JETZT_SCHICKEN`, dieselbe Liste wie der Knopf). Alles in der
 * Bedingung EINER Anweisung — ein Auftrag, den der Worker inzwischen geholt
 * hat, bleibt unberührt. „Nochmal schicken“ (neue Zeile) ist Nr. 167.
 *
 * Heikel (N20): frische Bestätigung mit Passkey; sonst ändert sich nichts.
 */
export async function schickeMailJetztAction(eingabe: unknown): Promise<{ ok: true; satz: string } | { error: string }> {
  const frisch = await verlangeFrischeBestaetigung()
  if ('error' in frisch) return frisch
  const auswahl = mailAuswahlSchema.safeParse(eingabe)
  if (!auswahl.success) return { error: MAIL_TEXT.eingabeUngueltig }

  const jetzt = new Date()
  const { count } = await prisma.mailAuftrag.updateMany({
    where: {
      ...auswahlBedingung(auswahl.data, jetzt),
      vorrang: { gt: VORRANG.sofort },
      status: { in: ['offen', 'gescheitert'] },
      OR: [{ fehlerCode: null }, { fehlerCode: { notIn: [...CODES_OHNE_JETZT_SCHICKEN] } }],
    },
    data: { status: 'offen', versuche: 0, naechsterVersuchAm: jetzt, belegtBis: null },
  })
  revalidatePath(ADMIN_BETRIEB_HREF)
  if (count === 0) return { ok: true, satz: MAIL_TEXT.nichtsGeaendert }
  arbeiteNachher()
  return { ok: true, satz: MAIL_TEXT.geschickt(count) }
}

/**
 * „Verwerfen“: Die Mail geht nicht mehr hinaus. Nur offene und gescheiterte
 * Zeilen, nie eine in Arbeit; Fehlercode und Zeiten bleiben stehen — die
 * Zeile bleibt im Protokoll sichtbar (verworfen), bis das Aufräumen sie nach
 * 90 Tagen löscht. Heikel (N20): frische Bestätigung mit Passkey.
 */
export async function verwirfMailAction(eingabe: unknown): Promise<{ ok: true; satz: string } | { error: string }> {
  const frisch = await verlangeFrischeBestaetigung()
  if ('error' in frisch) return frisch
  const auswahl = mailAuswahlSchema.safeParse(eingabe)
  if (!auswahl.success) return { error: MAIL_TEXT.eingabeUngueltig }

  const { count } = await prisma.mailAuftrag.updateMany({
    where: { ...auswahlBedingung(auswahl.data, new Date()), status: { in: ['offen', 'gescheitert'] } },
    data: { status: 'verworfen', belegtBis: null },
  })
  revalidatePath(ADMIN_BETRIEB_HREF)
  return { ok: true, satz: count === 0 ? MAIL_TEXT.nichtsGeaendert : MAIL_TEXT.verworfen(count) }
}

// ─── Nochmal schicken (Register N27, Nr. 167; N20, S17, E7) ──────────────────

type Antwort = { ok: true; satz: string } | { error: string }

/** Was eine Mail zum Nochmal-Schicken braucht — `bezug` wird nur kopiert, nie angezeigt. */
type NochmalQuelle = { id: string; art: string; status: string; bestellungId: string | null; farmId: string | null; nochmalVon: string | null; bezug: unknown }

/** Nach Sentry nur die Fehlerklasse unter festem Satz — nie Adresse, Bezug oder Token. */
function meldeNochmal(satz: string, err: unknown): void {
  try {
    const meldung = new Error(satz)
    meldung.name = fehlerKlasse(err)
    Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'admin', seite: 'betrieb-mails' } })
  } catch {
    // Telemetrie scheitert leise.
  }
}

/**
 * Die Regeln für EINE Mail (N27), in dieser Reihenfolge: Art in
 * `NOCHMAL_ERLAUBT`, Stand gesendet oder gescheitert, höchstens 3-mal je
 * ursprünglicher Mail in 24 Stunden (`nochmalVon`), und der heutige Stand der
 * Bestellung bzw. des Hofs passt (`passtNochmal`). Gibt den fertigen Auftrag
 * (Weg Wichtig, `ausloeser: 'support'`, Schlüssel `nochmal:<id>:<n>`) oder den
 * Grund zurück. Der Empfänger ist nie ein Feld: Der Renderer lädt die heute
 * hinterlegte Adresse.
 */
async function pruefeNochmal(
  m: NochmalQuelle,
  jetzt: Date
): Promise<{ ok: true; wurzel: string; n: number; stand: Awaited<ReturnType<typeof ladeNochmalStand>> } | { error: string }> {
  if (!nochmalErlaubt(m.art)) return { error: nochmalNieGrund(m.art) }
  if (!(NOCHMAL_STAENDE as readonly string[]).includes(m.status)) return { error: ALLE_MAILS_TEXT.standPasstNicht }
  const wurzel = m.nochmalVon ?? m.id
  const heute = await zaehleNochmalHeute(wurzel, jetzt)
  if (heute >= NOCHMAL_JE_TAG) return { error: ALLE_MAILS_TEXT.grenze }
  const stand = await ladeNochmalStand(m, adresseQuelle(m.art))
  const passt = passtNochmal(m.art, stand, jetzt)
  if (!passt.ok) return { error: passt.grund }
  if (!stand.adresse) return { error: ALLE_MAILS_TEXT.adresseFehlt }
  return { ok: true, wurzel, n: heute + 1, stand }
}

/** Der neue Auftrag: dieselbe Art, derselbe Bezug, Weg Wichtig, Vermerk „vom Support“. */
function nochmalAuftrag(m: NochmalQuelle, wurzel: string, n: number): EinstellAuftrag | null {
  const art = mailArtSchema.safeParse(m.art)
  if (!art.success) return null
  const bezug = bezugSchemaFuer(art.data).safeParse(m.bezug)
  if (!bezug.success) return null
  return {
    art: art.data,
    vorrang: VORRANG.wichtig,
    schluessel: `nochmal:${wurzel}:${n}`,
    bezug: bezug.data,
    ...(m.bestellungId ? { bestellungId: m.bestellungId } : {}),
    ...(m.farmId ? { farmId: m.farmId } : {}),
    ausloeser: 'support',
    nochmalVon: wurzel,
  }
}

/**
 * Bar-Bestätigungslink nochmal (S17, E7): ein neuer Token über dieselbe
 * Erzeugung wie die Kasse, gespeichert NUR sein Hash in `confirmationToken`
 * — nur, wenn dort noch der gelesene Wert steht und die Bestellung noch
 * unbestätigt ist (der Wechsel ist die Sperre: von zwei Klicks gewinnt einer).
 * Ab dann gilt der alte Link nicht mehr; die Frist der Bestellung ändert sich
 * nicht (sie hängt an `createdAt`). Die Mail geht direkt (Sofort) über
 * `sendOnsiteConfirmation`; das Protokoll trägt `nochmalVon`. Der Token steht
 * nie in `MailAuftrag` und verlässt diese Funktion nur in Richtung Mail.
 */
async function schickeBarLinkNochmal(orderId: string, wurzel: string): Promise<Antwort> {
  const vorher = await prisma.order.findUnique({ where: { id: orderId }, select: { confirmationToken: true } })
  if (!vorher) return { error: 'Die Bestellung gibt es nicht mehr.' }
  const { token, hash } = neuerBarToken()
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: 'PENDING_CONFIRMATION', paymentMethod: { not: 'ONLINE' }, confirmationToken: vorher.confirmationToken },
    data: { confirmationToken: hash },
  })
  if (count !== 1) return { ok: true, satz: MAIL_TEXT.nichtsGeaendert }
  const bestellung = await ladeBestellungFuerMail(orderId)
  if (!bestellung) return { ok: true, satz: MAIL_TEXT.nichtsGeaendert }
  try {
    const { sendOnsiteConfirmation } = await import('@/lib/email')
    await sendOnsiteConfirmation(bestellung, token, { nochmalVon: wurzel })
  } catch (err) {
    // Der neue Link ist gespeichert; scheitert der Versand, steht die Zeile im Protokoll.
    meldeNochmal('Betrieb: Bar-Link nochmal gescheitert', err)
  }
  return { ok: true, satz: ALLE_MAILS_TEXT.unterwegs }
}

const NOCHMAL_FELDER = { id: true, art: true, status: true, bestellungId: true, farmId: true, nochmalVon: true, bezug: true } as const

/**
 * „Nochmal schicken“ (Wortliste N8) für EINE Mail. Heikel (N20): frische
 * Bestätigung mit Passkey, sonst geschieht nichts. Auch ein direkter Aufruf
 * mit einer Art aus `NOCHMAL_NIE` endet mit dem Grund — die Prüfung steht
 * hier, nicht im Knopf. Eine andere Adresse gibt es nicht: Die Eingabe ist
 * nur die Kennung.
 */
export async function schickeMailNochmalAction(eingabe: unknown): Promise<Antwort> {
  const frisch = await verlangeFrischeBestaetigung()
  if ('error' in frisch) return frisch
  const gelesen = mailEinzelnSchema.safeParse(eingabe)
  if (!gelesen.success) return { error: MAIL_TEXT.eingabeUngueltig }

  const jetzt = new Date()
  const m = await prisma.mailAuftrag.findUnique({ where: { id: gelesen.data.id }, select: NOCHMAL_FELDER })
  if (!m) return { error: MAIL_TEXT.eingabeUngueltig }
  const pruefung = await pruefeNochmal(m, jetzt)
  if ('error' in pruefung) return pruefung

  let antwort: Antwort
  if (m.art === 'bar-bestaetigungslink') {
    if (!m.bestellungId) return { error: 'Die Bestellung gibt es nicht mehr.' }
    antwort = await schickeBarLinkNochmal(m.bestellungId, pruefung.wurzel)
  } else {
    const auftrag = nochmalAuftrag(m, pruefung.wurzel, pruefung.n)
    if (!auftrag) return { error: MAIL_TEXT.eingabeUngueltig }
    // Zwei Klicks zugleich ergeben denselben Schlüssel — der zweite fällt still weg (die Grenze hält).
    const neu = await stelleMailEin(auftrag)
    antwort = neu === 0 ? { ok: true, satz: MAIL_TEXT.nichtsGeaendert } : { ok: true, satz: ALLE_MAILS_TEXT.unterwegs }
  }
  revalidatePath(ADMIN_BETRIEB_HREF)
  return antwort
}

/**
 * „Alle nochmal schicken“ in „Braucht dich“: die gescheiterten Mails EINER
 * Art (Weg Wichtig, `problemBedingung`), höchstens 100 je Klick, mit denselben
 * Regeln je Mail wie einzeln. Der Bar-Bestätigungslink ist nicht dabei (Sofort,
 * je Mail ein neuer Token — nur einzeln). Alle Aufträge in EINEM Einstellen.
 */
export async function schickeArtNochmalAction(eingabe: unknown): Promise<Antwort> {
  const frisch = await verlangeFrischeBestaetigung()
  if ('error' in frisch) return frisch
  const gelesen = mailArtEingabeSchema.safeParse(eingabe)
  if (!gelesen.success) return { error: MAIL_TEXT.eingabeUngueltig }
  if (!nochmalErlaubt(gelesen.data.art) || gelesen.data.art === 'bar-bestaetigungslink') return { error: nochmalNieGrund(gelesen.data.art) }

  const jetzt = new Date()
  const kandidaten = await ladeGescheiterteDerArt(gelesen.data.art, jetzt)
  const auftraege: EinstellAuftrag[] = []
  const schonDabei = new Set<string>()
  for (const m of kandidaten) {
    const pruefung = await pruefeNochmal(m, jetzt)
    if ('error' in pruefung || schonDabei.has(pruefung.wurzel)) continue
    const auftrag = nochmalAuftrag(m, pruefung.wurzel, pruefung.n)
    if (!auftrag) continue
    schonDabei.add(pruefung.wurzel)
    auftraege.push(auftrag)
  }
  const neu = await stelleMailEin(auftraege)
  revalidatePath(ADMIN_BETRIEB_HREF)
  if (neu === 0) return { ok: true, satz: ALLE_MAILS_TEXT.nichtsNochmal }
  return { ok: true, satz: neu === 1 ? ALLE_MAILS_TEXT.unterwegs : ALLE_MAILS_TEXT.unterwegsViele(neu) }
}

/**
 * Die Vorschau einer Mail (N27): „so ginge sie heute hinaus“, Links
 * unkenntlich, Adressen gekürzt. Nur lesend — Admin-Recht genügt, nichts wird
 * gespeichert, protokolliert oder verschickt. Nur für Arten aus
 * `NOCHMAL_ERLAUBT`.
 */
export async function zeigeMailVorschauAction(eingabe: unknown): Promise<{ ok: true; titel: string; betreff: string; html: string } | { error: string }> {
  const wache = await verlangeAdminAktion()
  if ('error' in wache) return { error: wache.error }
  const gelesen = mailEinzelnSchema.safeParse(eingabe)
  if (!gelesen.success) return { error: MAIL_TEXT.eingabeUngueltig }
  const m = await prisma.mailAuftrag.findUnique({ where: { id: gelesen.data.id }, select: { art: true, bezug: true, bestellungId: true } })
  if (!m) return { error: MAIL_TEXT.eingabeUngueltig }
  try {
    const gebaut = await baueMailVorschau(m)
    if ('nie' in gebaut) return { error: ALLE_MAILS_TEXT.vorschauNie }
    if ('verworfen' in gebaut) return { error: ALLE_MAILS_TEXT.vorschauVerworfen }
    return { ok: true, titel: ALLE_MAILS_TEXT.vorschauTitel(artName(m.art)), betreff: gebaut.betreff, html: gebaut.html }
  } catch (err) {
    meldeNochmal('Betrieb: Vorschau einer Mail gescheitert', err)
    return { error: MAIL_TEXT.aktionFehler }
  }
}
