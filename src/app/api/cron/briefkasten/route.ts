import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { env } from '@/lib/env'
import { cronBerechtigt } from '@/lib/geheimnis'
import { brauchtZusammenfassung, screenshotsVon, waehleZuLoeschende } from '@/lib/meldung'
import { findeLoeschKandidaten, loescheMeldungen, zaehleFuerWochenlauf } from '@/server/queries/meldung'
import { sendBriefkastenZusammenfassung } from '@/lib/email'
import { ladeBetreiberEmpfaenger } from '@/server/queries/postfach'

/**
 * Wochenlauf des Fehlerbriefkastens (Sprint fehlerbriefkasten, Teil F).
 * Aufruf durch Vercel Cron, montags 07:00 MESZ (vercel.json: `0 5 * * 1`, UTC).
 *
 * Geschützt wie api/cron/cleanup-reservations: Authorization-Header mit
 * CRON_SECRET, fail-closed — ohne konfiguriertes Secret bleibt die Route
 * gesperrt (401), ein Deploy scheitert daran nicht (CRON_SECRET ist in
 * src/lib/env.ts optional).
 *
 * Zwei Schritte:
 *   (b) Aufräumen: abgeschlossene Meldungen (ERLEDIGT, KEIN_FEHLER, DUPLIKAT),
 *       deren Abschluss 90 Tage zurückliegt — die AUSWAHL trifft die reine,
 *       getestete Funktion waehleZuLoeschende; hier wird nur angewendet.
 *       Screenshots gehen im Blob-Speicher mit (bester Versuch: ein
 *       verwaistes Bild ist kein kaputter Zustand, eine hängende Löschung
 *       wäre einer).
 *   (a) Zusammenfassung an die Empfängerliste der Zustellung — NUR wenn die
 *       Regel „Wochenbericht" an ist (Register N14, Nr. 95; leere Liste = aus)
 *       UND es neue Meldungen gibt oder Meldungen länger als 14 Tage in
 *       NEU/GEPRUEFT stehen. Sonst keine Mail: eine leere Wochenmail wäre die
 *       erste, die keiner mehr liest.
 * Aufräumen läuft zuerst, damit die Zusammenfassung den Stand danach nennt.
 */
export async function GET(request: NextRequest) {
  // Konstante Zeit, fail-closed — wie alle Cron-Routen (ARCHITECTURE §5).
  if (!cronBerechtigt(request.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const jetzt = new Date()

  // (b) Aufräumen
  const kandidaten = await findeLoeschKandidaten()
  const zuLoeschen = waehleZuLoeschende(kandidaten, jetzt)
  for (const url of screenshotsVon(zuLoeschen)) {
    try {
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN })
    } catch {
      // bewusst still — siehe Kopf
    }
  }
  const geloescht = await loescheMeldungen(zuLoeschen.map((m) => m.id))

  // (a) Zusammenfassung nur bei Bedarf
  const zaehler = await zaehleFuerWochenlauf(jetzt)
  const zusammenfassung = brauchtZusammenfassung(zaehler)
  const an = zusammenfassung ? await ladeBetreiberEmpfaenger('wochenbericht') : []
  if (an.length > 0) {
    await sendBriefkastenZusammenfassung({ ...zaehler, geloescht }, an)
  }

  return NextResponse.json({
    zusammenfassung: an.length > 0,
    neu: zaehler.neu,
    liegenGeblieben: zaehler.liegenGeblieben,
    geloescht,
    at: jetzt.toISOString(),
  })
}
