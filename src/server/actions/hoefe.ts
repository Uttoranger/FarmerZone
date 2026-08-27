'use server'

import { headers } from 'next/headers'
import { sucheOrtspunkt } from '@/lib/geokodierung'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'

/**
 * Löst eine eingetippte Postleitzahl oder einen Ortsnamen zum Bezugspunkt
 * der Umkreissuche auf (/hoefe).
 *
 * Serverseitig, weil die Nominatim-Anbindung serverseitig lebt (User-Agent
 * mit Kontaktadresse, 5-s-Zeitlimit — src/lib/geokodierung.ts). Auslöser ist
 * AUSSCHLIESSLICH das Absenden des Feldes, nie das Tippen.
 *
 * KEINE Anmeldung nötig: /hoefe ist eine öffentliche Seite. Hinausgeschickt
 * wird nur der GETIPPTE Text — niemals eine vom Gerät gemessene Position
 * (die Entfernungen rechnet der Browser selbst, src/lib/hofuebersicht.ts).
 *
 * DROSSEL, PFLICHT: Eine offene Aktion ohne Anmeldung ist der bequemste Weg,
 * unsere Nominatim-Quote zu verbrennen — und dieselbe Quote trägt die
 * Hof-Geokodierung („Auf der Karte suchen"). Nominatim erlaubt HÖCHSTENS
 * EINE ANFRAGE PRO SEKUNDE je Anwendung; deshalb hier dasselbe Muster wie in
 * /api/checkout und /api/reserve (src/lib/rate-limit.ts): ein Sliding Window
 * je IP. Zehn Suchen pro Minute erreicht keine Kundin beim Stöbern, eine
 * Schleife sofort. Zusätzlich eine Längenkappe — was länger ist als ein
 * österreichischer Ortsname, ist keine Ortssuche.
 *
 * Ohne Treffer (oder über der Drossel) kommt null zurück; die Seite lässt
 * dann alles, wie es ist — die Liste bleibt unverändert.
 */

const ORTSSUCHE_MAX_PRO_MINUTE = 10
const ORTSSUCHE_MAX_ZEICHEN = 60

// Modul-Zustand: eine Drossel für alle Aufrufe dieser Instanz (serverless
// gilt sie damit je Instanz — bewusst, siehe Kaveat in rate-limit.ts).
const drossel = createRateLimiter({ max: ORTSSUCHE_MAX_PRO_MINUTE })

export async function loeseOrtAuf(
  eingabe: string
): Promise<{ lat: number; lon: number; name: string } | null> {
  if (typeof eingabe !== 'string') return null
  const text = eingabe.trim().slice(0, ORTSSUCHE_MAX_ZEICHEN)
  if (text.length < 2) return null

  // Wie im Hausmuster nur in Produktion — lokales `pnpm dev` bleibt frei.
  if (process.env.NODE_ENV === 'production') {
    const ip = getClientIp(await headers())
    if (!drossel.check(`ortssuche:${ip}`)) return null
  }

  const treffer = await sucheOrtspunkt(text)
  if (!treffer) return null
  return { lat: treffer.lat, lon: treffer.lon, name: treffer.anzeigeName }
}
