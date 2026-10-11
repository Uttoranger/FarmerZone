import { redirect } from 'next/navigation'
import { EINSTELLUNG_MEIN_AUFTRITT } from '@/lib/bauern-navigation'

/*
 * /settings/appearance („Mein Auftritt") leitet seit Nachtlauf Nr. 50 in Mein
 * Hof um, Reiter Hofseite (Register N4: Alles, was Kundinnen auf der Hofseite
 * sehen, wird an EINEM Ort bearbeitet). Logo, Titelbild, Leitspruch,
 * Gründungsjahr, Über uns, Werte, Abschnitte und Fotos stehen dort als
 * Zeilen — unter lg mit Blatt von unten, ab lg im Editor.
 *
 * Warum die Route bleibt statt zu verschwinden: Lesezeichen, die installierte
 * App und alte Links (Mails, Chats) zeigen auf /settings/appearance.
 *
 * Warum `redirect` (307) und nicht `permanentRedirect` (308): wie bei /status
 * (Nr. 22e) — Browser merken sich eine dauerhafte Umleitung ohne Ablauf. Die
 * Anmeldung prüft schon der Proxy (/settings/:path*).
 */
export default function MeinAuftrittUmleitung(): never {
  redirect(EINSTELLUNG_MEIN_AUFTRITT.href)
}
