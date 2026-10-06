import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import {
  ERNEUT_SENDEN,
  bestaetigungOffen,
  bestaetigungPflichtig,
  erneutSendenEntscheidung,
  leseVersandZeiten,
  restWartezeitErneut,
  schreibeVersandZeiten,
  versandKennung,
} from '@/lib/email-bestaetigung'

/*
 * E-Mail-Bestätigung gegen die Datenbank (S3, Nachtlauf Nr. 17b). Was gilt,
 * entscheidet src/lib/email-bestaetigung.ts; hier wird gelesen, gesperrt und
 * geschrieben.
 *
 * Der Stand kommt IMMER frisch aus der Datenbank, nie aus der Sitzung: Better
 * Auth hält den Nutzer bis zu fünf Minuten im Cookie-Cache (src/lib/auth.ts)
 * — nach dem Bestätigen stünde dort noch „unbestätigt" (ARCHITECTURE §5).
 */

export type BestaetigungsStand = {
  email: string
  emailVerified: boolean
  /** Konto ab dem Stichtag — sonst ist nichts zu bestätigen. */
  pflichtig: boolean
  /** Pflichtig und unbestätigt: Foto-Uploads und Freischaltung gesperrt. */
  offen: boolean
}

export async function ladeBestaetigungsStand(userId: string): Promise<BestaetigungsStand | null> {
  const konto = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, emailVerified: true, createdAt: true },
  })
  if (!konto) return null
  return {
    email: konto.email,
    emailVerified: konto.emailVerified === true,
    pflichtig: bestaetigungPflichtig(konto),
    offen: bestaetigungOffen(konto),
  }
}

/**
 * Sind Foto-Uploads und Freischaltung für dieses Konto gesperrt? Ein Konto,
 * das es nicht (mehr) gibt, gilt als gesperrt — die Routen lehnen es ohnehin
 * ab, hier soll nichts offen durchfallen.
 */
export async function emailBestaetigungOffen(userId: string): Promise<boolean> {
  const konto = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, emailVerified: true },
  })
  return konto === null || bestaetigungOffen(konto)
}

async function versandZeiten(identifier: string, jetzt: Date, tx: Pick<typeof prisma, 'verification'> = prisma): Promise<number[]> {
  const zeile = await tx.verification.findFirst({
    where: { identifier, expiresAt: { gt: jetzt } },
    orderBy: { createdAt: 'desc' },
    select: { value: true },
  })
  return zeile ? leseVersandZeiten(zeile.value) : []
}

/**
 * Nimmt einen Platz in der Bremse für „Erneut senden" — oder sagt, wie lange
 * noch zu warten ist. Die Zeile des Kontos wird für die Dauer gesperrt
 * (`SELECT … FOR UPDATE` auf "User"): Zwei gleichzeitige Klicks laufen
 * nacheinander, der zweite sieht den ersten Versand. Die Zeitpunkte stehen in
 * der bestehenden Verification-Tabelle (keine Schema-Änderung) und gelten
 * damit über alle Instanzen.
 */
export async function reserviereBestaetigungsVersand(
  userId: string,
  jetzt: Date = new Date()
): Promise<{ ok: true } | { ok: false; warteSekunden: number }> {
  const identifier = versandKennung(userId)
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
    const entscheidung = erneutSendenEntscheidung(await versandZeiten(identifier, jetzt, tx), jetzt.getTime())
    if (!entscheidung.erlaubt) return { ok: false as const, warteSekunden: entscheidung.warteSekunden }
    await tx.verification.deleteMany({ where: { identifier } })
    await tx.verification.create({
      data: {
        id: randomUUID(),
        identifier,
        value: schreibeVersandZeiten(entscheidung.zeiten),
        expiresAt: new Date(jetzt.getTime() + ERNEUT_SENDEN.fensterSekunden * 1000),
      },
    })
    return { ok: true as const }
  })
}

/** Für die Seite: Sekunden, bis „Erneut senden" wieder geht (0 = sofort). */
export async function restWartezeitBestaetigung(userId: string, jetzt: Date = new Date()): Promise<number> {
  return restWartezeitErneut(await versandZeiten(versandKennung(userId), jetzt), jetzt.getTime())
}
