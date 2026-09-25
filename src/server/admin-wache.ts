import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { isAdminUser } from '@/server/queries/admin'

/**
 * Die Admin-Prüfung — EINE Stelle für Seiten und Aktionen.
 *
 * Vorher lag sie an vier Stellen und in zwei Fassungen: dreimal wortgleich in
 * den Admin-Seiten und einmal als privates `requireAdmin` in
 * src/server/actions/admin.ts, das `isAdminUser` nicht benutzte, sondern die
 * Abfrage selbst wiederholte. Zwei Implementierungen derselben Frage sind eine
 * Einladung, dass eine davon irgendwann anders antwortet — und die Frage
 * lautet „darf dieser Mensch die Plattform verwalten?".
 *
 * Das Admin-Recht wird IMMER frisch aus der Datenbank gelesen, nie aus der
 * Session: `isAdmin` steckt bewusst nicht in den Better-Auth-additionalFields,
 * damit ein zurückgenommenes Recht sofort greift und nicht bis zum Ablauf des
 * Session-Cookies weiterwirkt (isAdminUser in src/server/queries/admin.ts).
 *
 * Zwei Ausgänge, weil eine Seite und eine Aktion verschieden scheitern:
 * Die Seite wirft (`redirect`/`notFound`), die Aktion gibt einen Satz zurück.
 * Eine Seite schützt die Ansicht, eine Aktion schützt die Wirkung — beides
 * muss geprüft werden, nie nur eines.
 *
 * Kein `server-only`-Import: Die Datei lebt ohnehin nur hinter Server
 * Components und `'use server'`, und `next/navigation` bringt die Grenze mit.
 */

/**
 * Die Wache einer Admin-SEITE. Gibt die Nutzer-ID zurück oder kehrt nie
 * zurück: nicht angemeldet → `/login`, angemeldet ohne Recht → 404.
 *
 * `notFound()` statt `redirect` oder 403: Der Bereich soll sich Unbefugten
 * nicht einmal zu erkennen geben — für sie existiert /admin schlicht nicht.
 */
export async function verlangeAdminSeite(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  if (!(await isAdminUser(session.user.id))) notFound()
  return session.user.id
}

/**
 * Die Wache einer Admin-AKTION. Kein Wurf, sondern die Antwortform der
 * Server Actions ({ ok } | { error }) — der Aufrufer gibt den Satz an die
 * Oberfläche weiter, statt eine Navigation auszulösen.
 */
export async function verlangeAdminAktion(): Promise<
  { ok: true; userId: string } | { error: string }
> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet.' }
  if (!(await isAdminUser(session.user.id))) return { error: 'Kein Zugriff.' }
  return { ok: true, userId: session.user.id }
}
