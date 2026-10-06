'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'
import { bestaetigteAdresse } from '@/server/kunden-adresse'
import { aboAenderungSchema } from '@/schemas/abo'

// Abos hängen an der Adresse, nicht an einem Konto. Ändern oder löschen darf
// sie nur, wer die Adresse mit Code bewiesen hat (E8, Nr. 17a) — frisch aus
// der Datenbank geprüft, nie aus der Sitzung (bestaetigteAdresse).
const ADRESSE_UNBESTAETIGT = 'Melde dich bitte mit dem Code aus deiner E-Mail an, dann kannst du deine Abos ändern.'
const KONTO_ADRESSE_UNBESTAETIGT = 'Melde dich bitte mit dem Code aus deiner E-Mail an, dann kannst du dein Konto löschen.'
const KONTO_NUR_KUNDIN = 'Ein Hof-Konto lässt sich hier nicht löschen. Schreib uns, wir helfen dir weiter.'

export type ActionResult = { error?: string }

export async function updateSubscription(
  farmId: string,
  optInEmail: boolean,
  optInWhatsApp: boolean,
): Promise<ActionResult> {
  // Die Argumente kommen aus dem Browser — erst prüfen, dann lesen (Nr. 19b).
  const eingabe = aboAenderungSchema.safeParse({ farmId, optInEmail, optInWhatsApp })
  if (!eingabe.success) return { error: 'Das hat nicht geklappt. Bitte lade die Seite neu und versuch es noch einmal.' }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }
  const customerEmail = await bestaetigteAdresse(session.user.id)
  if (!customerEmail) return { error: ADRESSE_UNBESTAETIGT }

  // Keine Telefonnummer aus dem Konto: Sie kann aus einer Registrierung mit
  // Passwort stammen, die die Adresse nie bewiesen hat — Better Auth behält
  // sie beim ersten Code. Die Nummer eines Abos kommt nur aus dem Checkout.
  const geprueft = eingabe.data
  await prisma.customerFarmSubscription.upsert({
    where: { customerEmail_farmId: { customerEmail, farmId: geprueft.farmId } },
    create: {
      customerEmail,
      farmId: geprueft.farmId,
      optInEmail: geprueft.optInEmail,
      optInWhatsApp: geprueft.optInWhatsApp,
      customerPhone: null,
    },
    update: { optInEmail: geprueft.optInEmail, optInWhatsApp: geprueft.optInWhatsApp },
  })

  return {}
}

export async function unsubscribeWithToken(token: string): Promise<ActionResult> {
  const data = verifyUnsubscribeToken(token)
  if (!data) return { error: 'Ungültiger oder abgelaufener Link' }

  await prisma.customerFarmSubscription.updateMany({
    where: { customerEmail: data.email.toLowerCase(), farmId: data.farmId },
    data: { optInEmail: false, optInWhatsApp: false },
  })

  return {}
}

export async function deleteCustomerAccount(): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  // Wie vor 17a: Konto und Abos der Adresse gehen zusammen. Ohne bewiesene
  // Adresse gehören die Abos womöglich jemand anderem — dann wird gar nichts
  // gelöscht, statt das Konto zu löschen und die Abos stehen zu lassen.
  const email = await bestaetigteAdresse(session.user.id)
  if (!email) return { error: KONTO_ADRESSE_UNBESTAETIGT }

  // Nur Kundinnen-Konten (Nr. 17b). Seit neue Höfe ihre E-Mail bestätigen,
  // reicht die bestätigte Adresse als Schutz nicht mehr: Ein Hof löschte
  // sonst die Abos zu seiner Adresse und scheiterte danach am Konto
  // (Farm.ownerId ist RESTRICT); ein Betreiber-Konto (isAdmin) gehört nie
  // hierher. Frisch aus der Datenbank, nie aus der Sitzung.
  const konto = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isAdmin: true } })
  if (konto?.role !== 'CUSTOMER' || konto.isAdmin) return { error: KONTO_NUR_KUNDIN }

  // Zusammen oder gar nicht — nie Abos weg und Konto noch da (oder umgekehrt).
  await prisma.$transaction([
    prisma.customerFarmSubscription.deleteMany({ where: { customerEmail: email } }),
    prisma.user.delete({ where: { id: session.user.id } }),
  ])

  return {}
}
