import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { ADMIN_POSTFACH_HREF, POSTFACH_FEHLER, POSTFACH_HREF, empfaengerFuer, nachrichtArtVon, type EmpfaengerRegel } from '@/lib/postfach'
import { rundschreibenSchema } from '@/schemas/postfach'
import { ladeEmpfaengerHoefe, ladeMailEmpfaenger } from '@/server/queries/postfach'

/*
 * Der Versand eines Rundschreibens (Register N12, N14) ohne Wache — bewusst
 * KEIN 'use server': Jeder Export einer Server-Action-Datei ist ein
 * öffentlicher Endpunkt (docs/ai/ARCHITECTURE.md). Zwei Wege rufen ihn, jeder
 * mit seiner eigenen Wache davor (Register N20, Ergänzung 23.10.2026):
 *  - sendeRundschreiben (src/server/actions/postfach.ts) nach der frischen
 *    Bestätigung mit Passkey;
 *  - der Bescheid an die Höfe in setzeBuendelStandAction
 *    (src/server/actions/admin.ts) nach verlangeAdminAktion — er verlangt
 *    keine eigene frische Bestätigung.
 * Die Kennung des Admins kommt immer aus der Wache des Aufrufers, nie aus
 * einer Eingabe.
 */

export type RundschreibenErgebnis = { ok: true; empfaenger: number } | { error: string }

const EIGENE_SAETZE = new Set<string>(Object.values(POSTFACH_FEHLER))

/** Nur die eigenen deutschen Sätze aus dem Schema; jeder andere Zod-Text (Englisch) wird zum festen Satz. */
function satzAus(satz: string | undefined): string {
  return satz !== undefined && EIGENE_SAETZE.has(satz) ? satz : POSTFACH_FEHLER.eingabe
}

/** Ein Fehler im Nachlauf geht ohne Text nach Sentry: nur ein fester Satz, die Klasse und Kennungen. */
function meldeNachlauf(err: unknown, kennung: string): void {
  const meldung = new Error('Postfach: E-Mail nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'postfach', aufgabe: 'rundschreiben-mail' }, extra: { kennung } })
}

/**
 * Ein Rundschreiben senden: Die Empfänger rechnet der Server aus der Regel
 * (empfaengerFuer über die nicht stillgelegten Höfe) — nie eine Liste aus dem
 * Browser übernehmen. In EINER Transaktion: das Rundschreiben, je Empfänger
 * genau ein Faden (Unique farmId + rundschreibenId) mit der ersten Nachricht
 * vom Team. Mit Haken gehen danach die E-Mails raus; letzteMailAm belegt die
 * Stunde schon in der Transaktion. Die Eingabe prüft das Schema auch hier —
 * auch der Bescheid läuft durch dieselben Grenzen.
 */
export async function verschickeRundschreiben(eingabe: unknown, userId: string): Promise<RundschreibenErgebnis> {
  const geprueft = rundschreibenSchema.safeParse(eingabe)
  if (!geprueft.success) return { error: satzAus(geprueft.error.issues[0]?.message) }
  const { titel, text, art, link, perMail, antwortMoeglich, empfaenger } = geprueft.data

  const hofIds = empfaengerFuer(empfaenger, await ladeEmpfaengerHoefe())
  if (hofIds.length === 0) return { error: POSTFACH_FEHLER.keineEmpfaenger }
  // Gespeichert wird, wen das Senden wirklich traf — bei „Ausgewählte" die geprüften Kennungen.
  const regel: EmpfaengerRegel = empfaenger.art === 'ausgewaehlt' ? { art: 'ausgewaehlt', hofIds } : empfaenger

  const jetzt = new Date()
  const faeden = await prisma.$transaction(async (tx) => {
    const rundschreiben = await tx.rundschreiben.create({
      data: { titel, text, linkUrl: link, art, perMail, antwortMoeglich, empfaengerRegel: regel, empfaenger: hofIds.length, gesendetAm: jetzt, erstelltVonUserId: userId },
      select: { id: true },
    })
    const angelegt = await tx.unterhaltung.createManyAndReturn({
      data: hofIds.map((farmId) => ({ farmId, rundschreibenId: rundschreiben.id, letzteNachrichtAm: jetzt, letzteMailAm: perMail ? jetzt : null })),
      select: { id: true },
    })
    await tx.nachricht.createMany({
      data: angelegt.map((f) => ({ unterhaltungId: f.id, vonFarmId: null, text, linkUrl: link, art: nachrichtArtVon(art), createdAt: jetzt })),
    })
    return angelegt.map((f) => f.id)
  })

  if (perMail) {
    nachDerAntwort(async () => {
      try {
        const empfaengerListe = await ladeMailEmpfaenger(faeden)
        const { sendPostfachMail } = await import('@/lib/email')
        let gescheitert = 0
        // Nacheinander: Resend begrenzt die Anfragen je Sekunde, und ein Fehler bei einem Hof hält die übrigen nicht auf.
        for (const e of empfaengerListe) {
          const ergebnis = await sendPostfachMail({ art: 'rundschreiben', an: e.email, titel, text, link, unterhaltungId: e.unterhaltungId })
          if (ergebnis.error) gescheitert += 1
        }
        if (gescheitert > 0) meldeNachlauf(new Error(`${gescheitert} gescheitert`), String(faeden.length))
      } catch (err) {
        meldeNachlauf(err, String(faeden.length))
      }
    })
  }

  revalidatePath(ADMIN_POSTFACH_HREF)
  revalidatePath(POSTFACH_HREF)
  revalidatePath('/dashboard')
  return { ok: true, empfaenger: faeden.length }
}
