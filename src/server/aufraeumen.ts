import { prisma } from '@/lib/prisma'
import { aufraeumGrenzen } from '@/lib/betrieb'
import { einmalLinkAufraeumGrenze } from '@/lib/geraete'
import { BAR_HASH_PRAEFIX } from '@/lib/bar-bestaetigung'
import { MELDE_VERMERK_TYP } from '@/server/erstattung-gescheitert'
import { sichereGesendeteBeitragsMails } from '@/server/mail-arten/beitrag'
import { adminProtokollGrenze } from '@/server/admin-protokoll'

/*
 * Das tägliche Aufräumen (Register N18, Nr. 104) — im bestehenden Ablauf
 * „Aufräumen“ (api/cron/cleanup-reservations). Genau sieben Tabellen, je EIN
 * deleteMany mit fester Grenze aus src/lib/betrieb.ts (`aufraeumGrenzen`) bzw.
 * src/lib/geraete.ts:
 *
 *  - Session: 7 Tage nach Ablauf — sie trägt IP-Adresse und Browserangabe;
 *    eine gültige Sitzung (laufender Login) bleibt immer.
 *  - Verification: 1 Tag nach Ablauf (Anmelde- und Bestätigungscodes).
 *  - WebhookEvent: nach 30 Tagen, OHNE die Melde-Vermerke — sie verhindern
 *    eine zweite Mail „Erstattung gescheitert“ und bleiben.
 *  - BetriebMessung: nach 400 Tagen.
 *  - EinmalLink (E7, Ergänzung; Nr. 114): abgelaufen, oder seit 7 Tagen
 *    benutzt. Ein offener, gültiger Link bleibt immer.
 *  - MailAuftrag (N26, Nr. 158): Zeilen der Warteschlange und des Protokolls
 *    nach 90 Tagen, gleich welcher Stand. VOR dem Löschen schreibt
 *    `sichereGesendeteBeitragsMails` (Nr. 170) an jeden betroffenen Beitrag die
 *    Zahl der gesendeten Mails — sonst zeigte „n per E-Mail“ danach die Zahl
 *    der eingestellten Aufträge.
 *  - AdminAktion (N33, Nr. 188): Einträge des Admin-Protokolls nach 5 Jahren
 *    (adminProtokollGrenze, src/server/admin-protokoll.ts).
 *
 * Aufträge, die ein abgebrochener Worker „in Arbeit“ hinterließ, fasst das
 * Aufräumen NICHT an (Nr. 170): Der Worker holt sie selbst und erkennt sie an
 * ihrer alten Belegung (`vorherBelegtBis`) — nur so gehen sie mit dem
 * Idempotenz-Schlüssel des abgebrochenen Laufs hinaus, und Resend verschickt
 * sie nicht ein zweites Mal.
 *
 * Dazu EIN updateMany, kein Löschen (Nr. 164, Register S17): Bestellungen, deren
 * `confirmationToken` noch im Klartext steht (ohne das Präfix des Hashs),
 * bekommen null. Der Link taugt dann nicht mehr; die Bestellung selbst und
 * jeder andere Wert bleiben. Ein Hash und null bleiben, wie sie sind.
 *
 * Nie Bestellungen löschen, nie Konten oder Höfe, nie eine Datei im Bild-Speicher
 * (Quelltext-Wache tests/aufraeumen.test.ts). Ins Ergebnis kommen nur Zahlen.
 */

export type AufraeumErgebnis = {
  sitzungen: number
  codes: number
  webhookEreignisse: number
  messungen: number
  einmalLinks: number
  klartextTokens: number
  mailAuftraege: number
  adminAktionen: number
}

export async function raeumeAltesAuf(jetzt: Date = new Date()): Promise<AufraeumErgebnis> {
  const grenze = aufraeumGrenzen(jetzt)
  const sitzungen = await prisma.session.deleteMany({ where: { expiresAt: { lt: grenze.sitzungen } } })
  const codes = await prisma.verification.deleteMany({ where: { expiresAt: { lt: grenze.codes } } })
  const webhookEreignisse = await prisma.webhookEvent.deleteMany({
    where: { createdAt: { lt: grenze.webhookEreignisse }, type: { not: MELDE_VERMERK_TYP } },
  })
  const messungen = await prisma.betriebMessung.deleteMany({ where: { tag: { lt: grenze.messungen } } })
  const einmalLinks = await prisma.einmalLink.deleteMany({
    where: { OR: [{ ablaufAm: { lt: jetzt } }, { benutztAm: { lt: einmalLinkAufraeumGrenze(jetzt) } }] },
  })
  // Nur ein Wert, kein Löschen. Die Bedingung `not: null` steht ausdrücklich da: In SQL ist
  // NOT (null LIKE 'h1:%') nicht wahr, ohne sie fiele die Absicht nicht auf.
  const klartextTokens = await prisma.order.updateMany({
    where: { confirmationToken: { not: null }, NOT: { confirmationToken: { startsWith: BAR_HASH_PRAEFIX } } },
    data: { confirmationToken: null },
  })
  // Erst die Zahl sichern, dann löschen: Scheitert das Sichern, wirft der Lauf und löscht nichts.
  await sichereGesendeteBeitragsMails(grenze.mailAuftraege)
  const mailAuftraege = await prisma.mailAuftrag.deleteMany({ where: { erstelltAm: { lt: grenze.mailAuftraege } } })
  const adminAktionen = await prisma.adminAktion.deleteMany({ where: { wann: { lt: adminProtokollGrenze(jetzt) } } })
  return {
    sitzungen: sitzungen.count,
    codes: codes.count,
    webhookEreignisse: webhookEreignisse.count,
    messungen: messungen.count,
    einmalLinks: einmalLinks.count,
    klartextTokens: klartextTokens.count,
    mailAuftraege: mailAuftraege.count,
    adminAktionen: adminAktionen.count,
  }
}
