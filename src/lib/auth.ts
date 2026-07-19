import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { magicLink } from 'better-auth/plugins'
import { prisma } from '@/lib/prisma'

// Franz-tauglich: 10 Login-Versuche pro Minute pro IP sperren keinen echten
// Nutzer aus (auch nicht bei Tippfehlern), bremsen aber Passwort-Rater.
// Better-Auth wendet das Limit auf alle /api/auth/*-Endpunkte an.
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60
const AUTH_RATE_LIMIT_MAX = 10

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  rateLimit: {
    // nur in Produktion — lokales pnpm dev bleibt ungebremst
    enabled: process.env.NODE_ENV === 'production',
    window: AUTH_RATE_LIMIT_WINDOW_SECONDS,
    max: AUTH_RATE_LIMIT_MAX,
    customRules: {
      // KEIN Limit fürs Session-Lesen: die Routen-Wache (src/proxy.ts) ruft
      // get-session bei JEDER geschützten Navigation per HTTP auf — mit dem
      // 10/min-Limit war Franz nach wenigen Seitenwechseln ausgesperrt
      // (im E2E-Test gegen lokale DB gefunden). Session-Lesen ist kein
      // Brute-Force-Ziel; Login/Registrierung behalten die 10/min.
      '/get-session': false,
    },
  },

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
