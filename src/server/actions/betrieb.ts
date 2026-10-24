'use server'

import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { verlangeAdminAktion, verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { beginneMessung, messeUndPruefe } from '@/server/betrieb'
import { arbeiteWarteschlange } from '@/server/mail-warteschlange'
import { letzteMessungAm } from '@/server/queries/betrieb'
import { problemBedingung } from '@/server/queries/mails'
import { ADMIN_BETRIEB_HREF, BETRIEB_TEXT, fehlerKlasse } from '@/lib/betrieb'
import { CODES_OHNE_JETZT_SCHICKEN, MAIL_TEXT } from '@/lib/betrieb-mails'
import { uhrzeitInWien } from '@/lib/fristen'
import { VORRANG } from '@/schemas/mail-auftrag'
import { mailAuswahlSchema, type MailAuswahl } from '@/schemas/betrieb-mails'

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
