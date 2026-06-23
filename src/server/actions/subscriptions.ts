'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyUnsubscribeToken } from '@/lib/unsubscribe'

export type ActionResult = { error?: string }

export async function updateSubscription(
  farmId: string,
  optInEmail: boolean,
  optInWhatsApp: boolean,
): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }

  const customerEmail = session.user.email.toLowerCase()
  const customerPhone = (session.user as typeof session.user & { phone?: string }).phone ?? null

  await prisma.customerFarmSubscription.upsert({
    where: { customerEmail_farmId: { customerEmail, farmId } },
    create: { customerEmail, farmId, optInEmail, optInWhatsApp, customerPhone },
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

  const email = session.user.email.toLowerCase()

  await prisma.customerFarmSubscription.deleteMany({ where: { customerEmail: email } })
  await prisma.user.delete({ where: { id: session.user.id } })

  return {}
}
