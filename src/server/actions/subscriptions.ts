'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'
import { bestaetigteAdresse } from '@/server/kunden-adresse'

// Abos hängen an der Adresse, nicht an einem Konto. Ändern oder löschen darf
// sie nur, wer die Adresse mit Code bewiesen hat (E8, Nr. 17a) — frisch aus
// der Datenbank geprüft, nie aus der Sitzung (bestaetigteAdresse).
const ADRESSE_UNBESTAETIGT = 'Melde dich bitte mit dem Code aus deiner E-Mail an, dann kannst du deine Abos ändern.'
const KONTO_ADRESSE_UNBESTAETIGT = 'Melde dich bitte mit dem Code aus deiner E-Mail an, dann kannst du dein Konto löschen.'

export type ActionResult = { error?: string }

export async function updateSubscription(
  farmId: string,
  optInEmail: boolean,
  optInWhatsApp: boolean,
): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }
  const customerEmail = await bestaetigteAdresse(session.user.id)
  if (!customerEmail) return { error: ADRESSE_UNBESTAETIGT }

  // Keine Telefonnummer aus dem Konto: Sie kann aus einer Registrierung mit
  // Passwort stammen, die die Adresse nie bewiesen hat — Better Auth behält
  // sie beim ersten Code. Die Nummer eines Abos kommt nur aus dem Checkout.
  await prisma.customerFarmSubscription.upsert({
    where: { customerEmail_farmId: { customerEmail, farmId } },
    create: { customerEmail, farmId, optInEmail, optInWhatsApp, customerPhone: null },
    update: { optInEmail, optInWhatsApp },
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

  await prisma.customerFarmSubscription.deleteMany({ where: { customerEmail: email } })
  await prisma.user.delete({ where: { id: session.user.id } })

  return {}
}
