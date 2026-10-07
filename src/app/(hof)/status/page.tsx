import { redirect } from 'next/navigation'
import { BEITRAEGE_HREF } from '@/lib/bauern-navigation'

/*
 * /status leitet in den Reiter „Beiträge" von Mein Hof um (Register E12,
 * Nachtlauf Nr. 22e). Der Reiter kann seit Nr. 22e alles, was diese Seite
 * konnte (Deaktivieren, Löschen, Als Vorlage, WhatsApp fortsetzen) — zwei
 * Listen derselben Beiträge liefen auseinander.
 *
 * Warum die Route bleibt statt zu verschwinden: Lesezeichen, die installierte
 * App und alte Links (Mails, Chats) zeigen auf /status; E12 hält die Route
 * ausdrücklich fest. Ihre Unterseiten (/status/new, WhatsApp fortsetzen)
 * bleiben eigene Seiten.
 *
 * Warum `redirect` (307) und nicht `permanentRedirect` (308): Browser merken
 * sich eine dauerhafte Umleitung ohne Ablauf. Bekäme /status je wieder eine
 * eigene Seite, landeten diese Geräte weiter im Reiter. Die Anmeldung prüft
 * schon der Proxy (/status/:path*); ohne Sitzung führt er vorher auf /login.
 */
export default function StatusUmleitung(): never {
  redirect(BEITRAEGE_HREF)
}
