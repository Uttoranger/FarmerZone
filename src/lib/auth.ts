import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { magicLink } from 'better-auth/plugins'
import { prisma } from '@/lib/prisma'

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    // Better-Auth-Default, jetzt sichtbar konfiguriert — muss zur Zod-Regel
    // min(8) in src/schemas/register.ts und zur Checkliste (password-rules) passen
    minPasswordLength: 8,
  },

  plugins: [
    magicLink({
      expiresIn: 900, // 15 Minuten
      sendMagicLink: async ({ email, url }) => {
        try {
          const { sendMagicLinkEmail } = await import('@/lib/email')
          await sendMagicLinkEmail(email, url)
        } catch (err) {
          console.error('[Magic Link] E-Mail-Fehler:', err)
          console.log(`[DEV] Magic Link für ${email}: ${url}`)
        }
      },
    }),
  ],

  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'CUSTOMER',
        input: false,
      },
      phone: {
        type: 'string',
        required: false,
        input: true,
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 Tage
    updateAge: 60 * 60 * 24,      // täglich auffrischen
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'],
})

export type Session = typeof auth.$Infer.Session
export type AuthUser = typeof auth.$Infer.Session.user
