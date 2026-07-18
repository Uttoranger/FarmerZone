'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrationSchema } from '@/schemas/register'

// Single server action for the full registration flow:
// invite code → Zod validation → auth.api.signUpEmail (sets cookie via nextCookies()) → FARMER role
export async function registerFarmer(data: {
  firstName: string
  lastName: string
  email: string
  password: string
  inviteCode: string
}): Promise<{ ok: true } | { error: string }> {
  // 1. Invite code check
  const required = process.env.FARMER_SIGNUP_CODE
  if (required && data.inviteCode.trim() !== required) {
    return { error: 'Ungültiger Einladungscode.' }
  }

  // 2. Zod validation (defense-in-depth, same rules as client checklist)
  const name = `${data.firstName.trim()} ${data.lastName.trim()}`
  const validated = registrationSchema.safeParse({ email: data.email, password: data.password, name })
  if (!validated.success) {
    return { error: validated.error.issues[0].message }
  }

  // 3. Create user record (no cookie set here — client calls signIn.email afterwards)
  let userId: string
  try {
    const result = await auth.api.signUpEmail({
      body: { email: data.email, password: data.password, name },
    })
    userId = result.user.id
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    const lower = message.toLowerCase()
    if (lower.includes('already') || lower.includes('exist') || lower.includes('duplicate') || lower.includes('unique')) {
      return { error: 'Diese E-Mail-Adresse ist bereits registriert.' }
    }
    console.error('[registerFarmer] signUpEmail error:', err)
    return { error: 'Registrierung fehlgeschlagen. Bitte versuche es erneut.' }
  }

  // 4. Set FARMER role (role.input = false prevents setting it via Better Auth client)
  try {
    await prisma.user.update({ where: { id: userId }, data: { role: 'FARMER' } })
  } catch (err) {
    console.error('[registerFarmer] role update error:', err)
    // Non-fatal: user is created and logged in; role can be fixed manually
  }

  return { ok: true }
}

// Kept for potential future use (e.g. admin flow)
export async function setFarmerRole(): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Keine aktive Session gefunden.' }

  try {
    await prisma.user.update({ where: { id: session.user.id }, data: { role: 'FARMER' } })
    return { ok: true }
  } catch (err) {
    console.error('[setFarmerRole] error:', err)
    return { error: 'Rollen-Update fehlgeschlagen.' }
  }
}
