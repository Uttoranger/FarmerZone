import * as Sentry from '@sentry/nextjs'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { env } from '@/lib/env'
import { cronBerechtigt } from '@/lib/geheimnis'
import { fehlerKlasse } from '@/lib/betrieb'
import { mitHerzschlag, pruefeAblaeufe, pruefeMailWarnungen } from '@/server/betrieb'
import { arbeiteWarteschlange } from '@/server/mail-warteschlange'
import { fassungFaelligSeit } from '@/server/queries/startseite'

/** Fenster der Startseiten-Prüfung (Nr. 193): fällig seit weniger als 2 Minuten — ein Lauf je Minute, eine Minute Puffer. */
const STARTSEITE_FENSTER_MS = 2 * 60_000

/** Ein Lauf darf eine Minute dauern; der Worker endet nach 50 s, der nächste Lauf beginnt zur nächsten Minute. */
export const maxDuration = 60

/**
 * Der Worker der Mail-Warteschlange (Register N26, Nr. 158): jede Minute
 * (vercel.json `* * * * *`, Vercel Pro), im Herzschlag-Rahmen — Admin › Betrieb
 * sieht jeden Lauf, und ein Ausfall fällt nach 10 Minuten auf. Läuft schon ein
 * Worker (nach einem Einstellen), endet dieser Aufruf sofort.
 *
 * Nach dem Lauf prüft er die anderen Abläufe und die Warnungen der
 * Mail-Warteschlange (`pruefeMailWarnungen`, Nr. 161) — je in eigenem try
 * (Nr. 170): Scheitert eine Prüfung, läuft die andere trotzdem, und Sentry
 * bekommt einen festen Satz mit der Fehlerklasse, nie einen Text.
 *
 * Seit Nr. 193 (Notiz aus der Vormerkung vom 24.10., Bericht 183) VOR dem
 * Worker die Startseite: Ging eine geplante Fassung vor weniger als 2 Minuten
 * live, baut `revalidatePath('/')` die Seite neu — genau ein Aufruf je Lauf,
 * sonst keiner. Eine billige Zählung; scheitert sie, läuft der Worker trotzdem.
 *
 * Geschützt wie alle Cron-Routen: Bearer mit CRON_SECRET, fail-closed (ohne
 * Secret 401), Vergleich in konstanter Zeit (ARCHITECTURE §5).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!cronBerechtigt(request.headers.get('authorization'), env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await fuerSich('Startseite: fällige Fassung nicht geprüft', () => startseitePuenktlich(new Date()))

  // Danach wie jeder Ablauf die anderen prüfen, dazu die Mail-Warnungen (Nr. 161; höchstens alle 10 Minuten, eigene Drossel).
  const danach = async (jetzt: Date): Promise<void> => {
    await fuerSich('Betrieb: Abläufe nach dem Mail-Lauf nicht geprüft', () => pruefeAblaeufe(jetzt))
    await fuerSich('Betrieb: Mail-Warnungen nicht geprüft', () => pruefeMailWarnungen(jetzt))
  }
  const ergebnis = await mitHerzschlag('mails', () => arbeiteWarteschlange({ biszeitMs: 50_000 }), danach)
  return NextResponse.json({ ...ergebnis, at: new Date().toISOString() })
}

/** Eine geplante Fassung geht pünktlich live (Nr. 193): fällig seit < 2 Minuten → die Startseite einmal neu bauen. */
async function startseitePuenktlich(jetzt: Date): Promise<void> {
  if (await fassungFaelligSeit(jetzt, STARTSEITE_FENSTER_MS)) revalidatePath('/')
}

/** Eine Prüfung für sich: Ein Fehler geht mit festem Satz an Sentry und hält die nächste nicht auf. */
async function fuerSich(satz: string, pruefung: () => Promise<unknown>): Promise<void> {
  try {
    await pruefung()
  } catch (err) {
    try {
      const meldung = new Error(satz)
      meldung.name = fehlerKlasse(err)
      Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'betrieb', ablauf: 'mails' } })
    } catch {
      // Telemetrie scheitert leise.
    }
  }
}
