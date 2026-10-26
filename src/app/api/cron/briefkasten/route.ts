import { NextRequest, NextResponse } from 'next/server'
import { del } from '@vercel/blob'
import { env } from '@/lib/env'
import { cronBerechtigt } from '@/lib/geheimnis'
import { screenshotsVon, waehleZuLoeschende } from '@/lib/meldung'
import { findeHauptmeldungen, findeLoeschKandidaten, loescheMeldungen, zaehleFuerWochenlauf } from '@/server/queries/meldung'
import { zaehleOffenImEingang } from '@/server/queries/postfach'
import { stelleMailEin } from '@/server/mail-warteschlange'
import { betreiberAuftraege, betreiberKennungen } from '@/server/mail-arten/betreiber'
import { mitHerzschlag } from '@/server/betrieb'

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
 *       Ein Duplikat geht erst mit seiner Hauptmeldung (Register N14,
 *       Ergänzung; Nr. 101): Status und Abschluss der Hauptmeldungen lädt
 *       eine zweite Abfrage, die Regel bleibt in waehleZuLoeschende.
 *       Screenshots gehen im Blob-Speicher mit (bester Versuch: ein
 *       verwaistes Bild ist kein kaputter Zustand, eine hängende Löschung
 *       wäre einer).
 *   (a) Zusammenfassung an die Empfängerliste der Zustellung — NUR wenn die
 *       Regel „Wochenbericht" an ist (Register N14, Nr. 95; leere Liste = aus)
 *       UND im Eingang etwas offen ist (zaehleOffenImEingang: ungelesene
 *       Antworten, Meldungen NEU/GEPRUEFT, wartende Höfe, offene
 *       Erstattungen — dieselbe Zählung wie „Offen" und der Reiter). Sonst
 *       keine Mail: eine leere Wochenmail wäre die erste, die keiner mehr
 *       liest. Der Meldungsteil der Mail (neu, liegen geblieben) bleibt.
 * Aufräumen läuft zuerst, damit die Zusammenfassung den Stand danach nennt.
 * Seit Nr. 103 im Herzschlag-Rahmen (Register N18): Admin › Betrieb sieht
 * jeden Lauf, danach prüft er die anderen Abläufe.
 */
export async function GET(request: NextRequest) {
  // Konstante Zeit, fail-closed — wie alle Cron-Routen (ARCHITECTURE §5).
  if (!cronBerechtigt(request.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(await mitHerzschlag('briefkasten', wochenlauf))
}

async function wochenlauf(): Promise<Record<string, unknown>> {
  const jetzt = new Date()

  // (b) Aufräumen
  const kandidaten = await findeLoeschKandidaten()
  const hauptmeldungen = await findeHauptmeldungen(kandidaten.flatMap((m) => (m.status === 'DUPLIKAT' && m.duplikatVonId ? [m.duplikatVonId] : [])))
  const zuLoeschen = waehleZuLoeschende(kandidaten, jetzt, hauptmeldungen)
  for (const url of screenshotsVon(zuLoeschen)) {
    try {
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN })
    } catch {
      // bewusst still — siehe Kopf
    }
  }
  const geloescht = await loescheMeldungen(zuLoeschen.map((m) => m.id))

  // (a) Wochenlage jede Woche, auch wenn im Eingang nichts offen ist (Nr. 192:
  // die Zahlen der Woche zählen auch in einer ruhigen Woche) — je Empfänger
  // ein Auftrag der Warteschlange (Wichtig, Nr. 159). Die Zahlen zählt der
  // Renderer beim Versand frisch; nur „gelöscht" kennt allein dieser Lauf.
  // Der Tag macht den Schlüssel eindeutig: ein zweiter Lauf am selben Tag
  // schreibt nicht noch einmal.
  const [zaehler, eingang] = await Promise.all([zaehleFuerWochenlauf(jetzt), zaehleOffenImEingang()])
  const an = await betreiberKennungen('wochenbericht')
  if (an.length > 0) {
    await stelleMailEin(betreiberAuftraege('wochenbericht', jetzt.toISOString().slice(0, 10), an, { geloeschtAnzahl: String(geloescht) }))
  }

  return {
    zusammenfassung: an.length > 0,
    offenImEingang: eingang.gesamt,
    neu: zaehler.neu,
    liegenGeblieben: zaehler.liegenGeblieben,
    geloescht,
    at: jetzt.toISOString(),
  }
}
