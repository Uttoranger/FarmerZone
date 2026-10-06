import * as Sentry from '@sentry/nextjs'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { emailOTP, magicLink } from 'better-auth/plugins'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { prisma } from '@/lib/prisma'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { ANMELDECODE_PLUGIN_OPTIONEN, GESPERRTE_AUTH_PFADE, codeVersandErlaubt, rolleAusTreffern } from '@/lib/anmeldecode'
import { genauesIlikeMuster } from '@/lib/ilike-muster'
import { erzeugeAnforderungsSperre } from '@/lib/anmeldecode-sperre'
import { nachDerAntwort } from '@/lib/nach-der-antwort'

// Franz-tauglich: 10 Login-Versuche pro Minute pro IP sperren keinen echten
// Nutzer aus (auch nicht bei Tippfehlern), bremsen aber Passwort-Rater.
// Better-Auth wendet das Limit auf alle /api/auth/*-Endpunkte an.
const AUTH_RATE_LIMIT_WINDOW_SECONDS = 60
const AUTH_RATE_LIMIT_MAX = 10

// Höchstens 5 Anmeldecodes je Adresse in 15 Minuten (src/lib/anmeldecode.ts),
// je Instanz — gegen ein Postfach, das von vielen IPs aus zugeschüttet wird.
const codeAnforderungen = erzeugeAnforderungsSperre()

/**
 * Die Rolle hinter einer Adresse, ohne Rücksicht auf Groß-/Kleinschreibung.
 * Better Auth schreibt Adressen klein, ältere oder von Hand angelegte Konten
 * können Großbuchstaben tragen — ein exakter Vergleich hielte einen Hof dann
 * für „unbekannt", schickte ihm einen Code und legte beim Anmelden ein
 * zweites Kundenkonto an. `null` = kein Konto.
 *
 * Genau diese Adresse, keine Platzhalter: Prisma macht aus dem Vergleich ein
 * ILIKE, in dem „_" und „%" sonst ein fremdes Konto träfen — ein Hof
 * „max_hof@…" hielte der Hook für die Kundin „max-hof@…" (die bis Nr. 17a
 * jeder per Checkout anlegen konnte), und der Code meldete den Hof an. ALLE Treffer
 * zählen (rolleAusTreffern), nicht der erste beliebige; das Betreiber-Recht
 * (isAdmin) zählt wie die Rolle ADMIN. Maskiert statt per $queryRaw mit
 * lower(): kein Roh-SQL ohne Not (TECH_STACK.md), typisiert über Prisma, und
 * dieselbe Funktion wie in der Bestellsuche (Nr. 14).
 */
async function rolleZurAdresse(email: string): Promise<string | null> {
  const treffer = await prisma.user.findMany({
    where: { email: { equals: genauesIlikeMuster(email), mode: 'insensitive' } },
    select: { role: true, isAdmin: true },
  })
  // /admin prüft isAdmin, nicht die Rolle (src/server/admin-wache.ts): Ein
  // Betreiber ohne Hof kann CUSTOMER sein und zählt hier trotzdem als Admin.
  return rolleAusTreffern(treffer.map((nutzer) => (nutzer.isAdmin ? 'ADMIN' : nutzer.role)))
}

/**
 * Die Adresse so, wie das emailOTP-Plugin sie liest: in JS klein geschrieben,
 * nicht getrimmt. Beide Hooks prüfen GENAU diese Form — das Kleinschreiben
 * darf nicht der Datenbank überlassen bleiben: JS macht aus dem Kelvin-
 * Zeichen (U+212A) ein „k", eine reine C-Collation nicht. Fragte der Hook
 * mit der getippten Form, hielte er einen Hof für unbekannt, den das Plugin
 * anschließend findet und anmeldet.
 */
function adresseWieDasPlugin(email: string): string {
  return email.toLowerCase()
}

/**
 * Meldet einen gescheiterten Code-Versand an Sentry — nur WAS schiefging,
 * nie Adresse oder Code. Der Text ist fest, vom Fehler geht nur seine Art
 * mit: Ein Datenbank- oder Resend-Fehlertext kann die Adresse tragen, und
 * der Adressfilter in src/lib/sentry-hygiene.ts (beforeSend) erkennt nicht
 * jede Schreibweise. Ohne Meldung bliebe eine Kundin still ohne Code.
 */
function meldeCodeVersandFehler(grund: 'resend_fehler' | 'nachlauf_fehler', err?: unknown): void {
  const kontext = { tags: { aufgabe: 'anmeldecode', grund } }
  if (err === undefined) {
    Sentry.captureMessage('Anmeldecode-Mail nicht verschickt', { level: 'error', ...kontext })
    return
  }
  const meldung = new Error('Anmeldecode-Mail nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, kontext)
}

/**
 * Dieselbe Antwort wie bei einem falschen Code — Form und Text so, wie das
 * emailOTP-Plugin sie wirft (EMAIL_OTP_ERROR_CODES.INVALID_OTP, nicht
 * exportiert). Wer eine Hof-Adresse probiert, soll nicht erfahren, dass sie
 * einem Hof gehört.
 */
function falscherCodeFehler(): APIError {
  return APIError.from('BAD_REQUEST', { code: 'INVALID_OTP', message: 'Invalid OTP' })
}

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

  // ROLLEN-TRENNUNG (E7): Höfe und Admins melden sich NIE mit Code an. Das
  // muss vor dem Plugin passieren: Es legt den Code an, BEVOR es
  // sendVerificationOTP ruft, und /sign-in/email-otp fragt nach keiner Rolle.
  // Ein unterdrückter Mailversand allein hieße: Der Code liegt gültig in der
  // Datenbank, wer rät, ist als Hof angemeldet — und einem unbestätigten Hof
  // nähme Better Auth dabei das Passwort (revokeUnprovenAccountAccess).
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-in/email-otp') {
        const body = ctx.body as { email?: unknown } | undefined
        if (typeof body?.email !== 'string') return
        // Antwort wie bei falschem Code; der Code (falls einer liegt) bleibt
        // unberührt und läuft nach 10 Minuten ab.
        if (!codeVersandErlaubt(await rolleZurAdresse(adresseWieDasPlugin(body.email)))) throw falscherCodeFehler()
        return
      }

      if (ctx.path !== '/email-otp/send-verification-otp') return
      // Nur die Anmeldung. Der Typ „forget-password" schickte sonst einem Hof
      // einen Code fürs Passwort, „email-verification" eine Bestätigung, die
      // es in dieser App nicht gibt.
      const body = ctx.body as { type?: unknown; email?: unknown } | undefined
      if (body?.type !== 'sign-in') {
        throw new APIError('BAD_REQUEST', { message: 'Unbekannte Anfrage.' })
      }
      if (typeof body.email !== 'string') return
      // Wie alle Speicher-Grenzen nur in Produktion (src/lib/rate-limit.ts).
      // Vor der Rollenprüfung: Ein Hof wird genauso gebremst wie eine Kundin.
      if (process.env.NODE_ENV === 'production' && !codeAnforderungen.erlaubt(body.email)) {
        throw new APIError('TOO_MANY_REQUESTS', { message: 'Zu viele Anfragen.' })
      }
      // Hof oder Admin: KEIN Code wird angelegt — der Hook antwortet selbst,
      // genau wie das Plugin bei einer Kundin ({ success: true }), und der
      // Endpunkt läuft gar nicht erst. Die Adresse geht so in die Abfrage,
      // wie das Plugin sie prüft (klein geschrieben, nicht getrimmt): Eine
      // Adresse, die das Plugin als ungültig ablehnte, soll auch hier nicht
      // anders antworten.
      const email = adresseWieDasPlugin(body.email)
      if (!codeVersandErlaubt(await rolleZurAdresse(email))) {
        // Ein Code aus der Zeit vor dieser Sperre verschwindet dabei — und
        // die Datenbank schreibt einmal, wie bei einer Kundin (Antwortzeit).
        await prisma.verification.deleteMany({ where: { identifier: `sign-in-otp-${email}` } })
        return ctx.json({ success: true })
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
        // Die Mail erst NACH der Antwort (CODING_STANDARDS „nachDerAntwort"):
        // Sonst antwortete eine Kunden-Adresse um die Dauer von Rendern und
        // Resend langsamer als eine Hof-Adresse (die der Hook oben ohne Mail
        // beantwortet) — die Antwortzeit verriete, wer ein Hof ist. Better
        // Auth läuft im Routen-Handler (app/api/auth/[...all]), dort greift
        // after(); `advanced.backgroundTasks` hätte dasselbe geleistet, gälte
        // aber für alle Hintergrundaufgaben von Better Auth.
        nachDerAntwort(async () => {
          // Alles im try, auch die Rollenabfrage: Ein Fehler darf nicht als
          // unbehandelte Ablehnung in after() enden, sondern muss gemeldet
          // werden — sonst wartet eine Kundin auf einen Code, und niemand
          // erfährt davon.
          try {
            // Zweite Sicherung, falls der Hook je umgangen würde: kein Code
            // an einen Hof. (Der Hook legt für Höfe gar keinen an.)
            if (!codeVersandErlaubt(await rolleZurAdresse(email))) return
            const { sendAnmeldeCodeEmail } = await import('@/lib/email')
            const ergebnis = await sendAnmeldeCodeEmail(email, otp)
            // sendRaw wirft nie, ein Resend-Fehler kommt als { error } zurück.
            if (ergebnis.error) meldeCodeVersandFehler('resend_fehler')
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
            meldeCodeVersandFehler('nachlauf_fehler', err)
          }
        })
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
