import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { emailOTP, magicLink } from 'better-auth/plugins'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { prisma } from '@/lib/prisma'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { ANMELDECODE_PLUGIN_OPTIONEN, GESPERRTE_AUTH_PFADE, codeVersandErlaubt } from '@/lib/anmeldecode'
import { erzeugeAnforderungsSperre } from '@/lib/anmeldecode-sperre'

// Franz-tauglich: 10 Login-Versuche pro Minute pro IP sperren keinen echten
// Nutzer aus (auch nicht bei Tippfehlern), bremsen aber Passwort-Rater.
// Better-Auth wendet das Limit auf alle /api/auth/*-Endpunkte an.
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60
const AUTH_RATE_LIMIT_MAX = 10

// Höchstens 5 Anmeldecodes je Adresse in 15 Minuten (src/lib/anmeldecode.ts),
// je Instanz — gegen ein Postfach, das von vielen IPs aus zugeschüttet wird.
const codeAnforderungen = erzeugeAnforderungsSperre()

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
    // Better-Auth-Default (1 Stunde), jetzt sichtbar konfiguriert — muss zum
    // Gültigkeitshinweis in der Reset-Mail (password-reset.tsx) passen
    resetPasswordTokenExpiresIn: 3600,
    // Nach erfolgreichem Reset fliegen alle alten Sessions
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      try {
        const { sendPasswordResetEmail } = await import('@/lib/email')
        await sendPasswordResetEmail(user.email, url)
      } catch (err) {
        console.error('[Passwort-Reset] E-Mail-Fehler:', err)
        // Der Fallback-Log enthält einen GÜLTIGEN Zugangs-Link samt Adresse —
        // er darf niemals in die Produktions-Logs (Vercel) gelangen.
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[DEV] Passwort-Reset für ${user.email}: ${url}`)
        }
      }
    },
  },

  // Was die App nicht anbietet, ist über HTTP gar nicht erreichbar: das
  // Anfordern neuer Magic Links (E7) und die ungenutzten Code-Wege des
  // emailOTP-Plugins. Begründung je Pfad in src/lib/anmeldecode.ts.
  disabledPaths: [...GESPERRTE_AUTH_PFADE],

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/email-otp/send-verification-otp') return
      // Nur die Anmeldung. Der Typ „forget-password" schickte sonst einem Hof
      // einen Code fürs Passwort, „email-verification" eine Bestätigung, die
      // es in dieser App nicht gibt.
      const body = ctx.body as { type?: unknown; email?: unknown } | undefined
      if (body?.type !== 'sign-in') {
        throw new APIError('BAD_REQUEST', { message: 'Unbekannte Anfrage.' })
      }
      // Wie alle Speicher-Grenzen nur in Produktion (src/lib/rate-limit.ts).
      if (
        process.env.NODE_ENV === 'production' &&
        typeof body.email === 'string' &&
        !codeAnforderungen.erlaubt(body.email)
      ) {
        throw new APIError('TOO_MANY_REQUESTS', { message: 'Zu viele Anfragen.' })
      }
    }),
  },

  plugins: [
    // Kunden-Anmeldung mit Code aus der E-Mail (E7). Länge, Laufzeit,
    // Versuche und Bremsen stehen in src/lib/anmeldecode.ts; die Versuche
    // zählt das Plugin in der Verification-Tabelle — über alle Instanzen.
    emailOTP({
      ...ANMELDECODE_PLUGIN_OPTIONEN,
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== 'sign-in') return
        // Höfe melden sich mit Passwort an — sie bekommen keinen Code. Die
        // Antwort an den Browser bleibt dieselbe (keine Auskunft, wer ein Hof ist).
        const nutzer = await prisma.user.findUnique({ where: { email }, select: { role: true } })
        if (!codeVersandErlaubt(nutzer ? nutzer.role : null)) return
        try {
          const { sendAnmeldeCodeEmail } = await import('@/lib/email')
          const ergebnis = await sendAnmeldeCodeEmail(email, otp)
          // Ohne Versand (lokal ohne RESEND_API_KEY) steht der Code im
          // Terminal, sonst käme niemand an ihn heran. Code und Adresse
          // dürfen NIE in die Produktions-Logs (Vercel) — auch nicht bei
          // einem Resend-Fehler.
          if (!ergebnis.id && process.env.NODE_ENV !== 'production') {
            console.log(`[DEV] Anmeldecode für ${email}: ${otp}`)
          }
        } catch (err) {
          // Nur die Art des Fehlers — sein Text könnte die Adresse tragen.
          console.error('[Anmeldecode] E-Mail-Fehler:', err instanceof Error ? err.name : 'unbekannt')
        }
      },
    }),
    // Übergang: Neue Magic Links gibt es nicht mehr (disabledPaths oben),
    // Links aus Mails, die vor dem Deployment verschickt wurden, prüft
    // /magic-link/verify noch (15 Minuten gültig). Kann in einem späteren
    // Aufräum-PR samt customer-magic-link.tsx entfallen.
    magicLink({
      expiresIn: 900, // 15 Minuten
      sendMagicLink: async ({ email, url }) => {
        try {
          const { sendMagicLinkEmail } = await import('@/lib/email')
          await sendMagicLinkEmail(email, url)
        } catch (err) {
          console.error('[Magic Link] E-Mail-Fehler:', err)
          // Der Fallback-Log enthält einen GÜLTIGEN Login-Link samt Adresse —
          // er darf niemals in die Produktions-Logs (Vercel) gelangen.
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[DEV] Magic Link für ${email}: ${url}`)
          }
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

  // Adresse und vertraute Herkünfte kommen aus der Umgebung (src/lib/umgebung.ts):
  // Produktion nur NEXT_PUBLIC_APP_URL, Previews ihre Vercel-Adressen, lokal
  // localhost. Vorher stand hier NEXT_PUBLIC_APP_URL mit localhost-Ersatz —
  // in Previews war das die Adresse eines fremden Rechners, der Login unmöglich.
  // Fehlt in Produktion die Adresse, bleibt baseURL leer und Better Auth
  // greift auf BETTER_AUTH_URL zurück; eine geratene Herkunft gibt es nicht.
  baseURL: UMGEBUNG.appUrl ?? undefined,
  trustedOrigins: [...UMGEBUNG.trustedOrigins],
})

export type Session = typeof auth.$Infer.Session
export type AuthUser = typeof auth.$Infer.Session.user
