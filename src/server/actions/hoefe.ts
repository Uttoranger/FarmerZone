'use server'

import { headers } from 'next/headers'
import { entdoppleTreffer, kandidatenBeschriftung, sucheOrtspunkt } from '@/lib/geokodierung'
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
 * ÜBER DIE GRENZE: Gesucht wird in Österreich UND Deutschland (Innviertel/
 * Niederbayern). Weil derselbe Ortsname beiderseits der Grenze vorkommt,
 * kommen bis zu DREI Kandidaten zurück statt nur des besten — welcher
 * gemeint war, entscheidet die Kundin an der Landangabe.
 *
 * Ohne Treffer (oder über der Drossel) kommt eine leere Liste zurück; die
 * Seite lässt dann alles, wie es ist — die Hofliste bleibt unverändert.
 */

const ORTSSUCHE_MAX_PRO_MINUTE = 10
const ORTSSUCHE_MAX_ZEICHEN = 60

// Modul-Zustand: eine Drossel für alle Aufrufe dieser Instanz (serverless
// gilt sie damit je Instanz — bewusst, siehe Kaveat in rate-limit.ts).
const drossel = createRateLimiter({ max: ORTSSUCHE_MAX_PRO_MINUTE })

/** Ein Ortstreffer, wie ihn die Auswahlliste im Umkreisfeld zeigt. */
export type OrtsTreffer = { lat: number; lon: number; name: string }

export async function loeseOrtAuf(eingabe: string): Promise<OrtsTreffer[]> {
  if (typeof eingabe !== 'string') return []
  const text = eingabe.trim().slice(0, ORTSSUCHE_MAX_ZEICHEN)
  if (text.length < 2) return []

  // Wie im Hausmuster nur in Produktion — lokales `pnpm dev` bleibt frei.
  if (process.env.NODE_ENV === 'production') {
    const ip = getClientIp(await headers())
    if (!drossel.check(`ortssuche:${ip}`)) return []
  }

  // Entdopplung und Beschriftung entstehen SERVERSEITIG — hier ist das Land
  // der Treffer noch bekannt (die Seite bekommt nur noch Text). Nominatim
  // liefert für eine österreichische Postleitzahl gern mehrere Zeilen
  // desselben Ortes; ohne Entdopplung bekäme der häufige Weg, der vor
  // diesem Sprint einstufig war, eine Rückfrage ohne jede Erkenntnis.
  return entdoppleTreffer(await sucheOrtspunkt(text)).map((k) => ({
    lat: k.lat,
    lon: k.lon,
    name: kandidatenBeschriftung(k),
  }))
}
