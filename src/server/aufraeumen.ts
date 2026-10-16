import { prisma } from '@/lib/prisma'
import { aufraeumGrenzen } from '@/lib/betrieb'
import { MELDE_VERMERK_TYP } from '@/server/erstattung-gescheitert'

/*
 * Das tägliche Aufräumen (Register N18, Nr. 104) — im bestehenden Ablauf
 * „Aufräumen“ (api/cron/cleanup-reservations). Genau vier Tabellen, je EIN
 * deleteMany mit fester Grenze aus src/lib/betrieb.ts (`aufraeumGrenzen`):
 *
 *  - Session: 7 Tage nach Ablauf — sie trägt IP-Adresse und Browserangabe;
 *    eine gültige Sitzung (laufender Login) bleibt immer.
 *  - Verification: 1 Tag nach Ablauf (Anmelde- und Bestätigungscodes).
 *  - WebhookEvent: nach 30 Tagen, OHNE die Melde-Vermerke — sie verhindern
 *    eine zweite Mail „Erstattung gescheitert“ und bleiben.
 *  - BetriebMessung: nach 400 Tagen.
 *
 * Nie Bestellungen, Konten oder Höfe, nie eine Datei im Bild-Speicher
 * (Quelltext-Wache tests/aufraeumen.test.ts). Ins Ergebnis kommen nur Zahlen.
 */

export type AufraeumErgebnis = { sitzungen: number; codes: number; webhookEreignisse: number; messungen: number }

export async function raeumeAltesAuf(jetzt: Date = new Date()): Promise<AufraeumErgebnis> {
  const grenze = aufraeumGrenzen(jetzt)
  const sitzungen = await prisma.session.deleteMany({ where: { expiresAt: { lt: grenze.sitzungen } } })
  const codes = await prisma.verification.deleteMany({ where: { expiresAt: { lt: grenze.codes } } })
  const webhookEreignisse = await prisma.webhookEvent.deleteMany({
    where: { createdAt: { lt: grenze.webhookEreignisse }, type: { not: MELDE_VERMERK_TYP } },
  })
  const messungen = await prisma.betriebMessung.deleteMany({ where: { tag: { lt: grenze.messungen } } })
  return { sitzungen: sitzungen.count, codes: codes.count, webhookEreignisse: webhookEreignisse.count, messungen: messungen.count }
}
