import { redirect } from 'next/navigation'
import { umfeldUmleitung } from '@/schemas/umfeld-filter'

/*
 * /analytics/umfeld leitet nach /region um (Nachtlauf Nr. 22c, Gate 8: „alte
 * URL leitet um"). Das Umfeld heißt jetzt „Preise vergleichen" und ist der
 * erste Reiter von Region. Umkreis, Bereich und Karte gehen mit, aber nur in
 * der Form, die das Schema annimmt (`umfeldUmleitung`) — Lesezeichen, die
 * installierte App und Links aus alten Chats landen in derselben Ansicht.
 *
 * Warum `redirect` (307) und nicht `permanentRedirect` (308): wie bei /status
 * (Nr. 22e) — Browser merken sich eine dauerhafte Umleitung ohne Ablauf.
 * Die Anmeldung prüft schon der Proxy (/analytics/:path*).
 */
export default async function UmfeldUmleitung({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<never> {
  redirect(umfeldUmleitung(await searchParams))
}
