'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkFormToken, FORM_EXPIRED_MESSAGE } from '@/lib/form-token'
import { meldungEingabeSchema } from '@/schemas/meldung'
import { MELDUNGEN_PRO_STUNDE, ZU_VIELE_MELDUNGEN, kurznummer } from '@/lib/meldung'
import { darfGeloeschtWerden } from '@/lib/upload-pfade'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { sendMeldungNotification } from '@/lib/email'

/**
 * Eine Meldung in den Fehlerbriefkasten legen (Sprint fehlerbriefkasten, Teil B).
 *
 * GRUNDSATZ: Eingangskanal, kein Befehlskanal — hier wird nur gespeichert und
 * (bei FEHLER) der Betreiber benachrichtigt. Triage findet ausschließlich im
 * Admin-Bereich statt.
 *
 * SPAM-SCHUTZ, dasselbe Muster wie die Registrierung (src/server/actions/register.ts):
 *   Honigtopf     ein für Menschen unsichtbares Feld, das leer bleiben muss.
 *   Zeitschranke  ein signierter Zeitstempel aus dem Seitenaufbau (Zweck
 *                 'meldung' — ein Registrierungs-Token gilt hier nicht).
 *   Beide lehnen STILL ab: dieselbe Erfolgsmeldung samt Kurznummer, aber kein
 *   Datensatz — ein Bot soll nicht lernen, woran er gescheitert ist. Einzige
 *   sichtbare Ablehnung: das abgelaufene Formular (ein Mensch mit offenem Tab).
 *   Stundenzähler  höchstens fünf Meldungen je Stunde je Hof bzw. E-Mail —
 *                 aus der Datenbank gezählt, also über alle Instanzen hinweg.
 *                 Alle Meldungen OHNE Hof-Sitzung zählt zusätzlich der
 *                 bestehende In-Memory-Limiter je IP (nur Produktion, je
 *                 Instanz — die IP wird dafür nur flüchtig gelesen, nie
 *                 gespeichert), weil eine E-Mail frei erfunden werden kann.
 *
 * KONTEXT: farmId kommt aus der SITZUNG, nie aus dem Formular. Screenshots
 * gibt es nur für angemeldete Höfe — der bestehende Upload-Weg verlangt eine
 * Hof-Sitzung (api/upload/token); die URL muss im Zielordner GENAU DIESES
 * Hofes liegen, sonst ließe sich ein fremdes Bild als Screenshot einhängen.
 *
 * BETREIBER-MAIL NUR BEI FEHLER: Wünsche und Fragen bleiben still — sie werden
 * gesammelt, gebündelt und beim Wochenlauf gezählt; eine Mail je Wunsch wäre
 * Lärm, der die Fehlermeldungen entwertet.
 */

export type MeldungErgebnis = { ok: true; kurznummer: string } | { error: string }

export type MeldungFormularDaten = {
  art: string
  text: string
  seiteUrl: string
  userAgent: string
  viewport: string
  diagKennung?: string
  customerEmail?: string
  screenshotUrl?: string
  /** Honigtopf — für Menschen unsichtbar, muss leer bleiben. */
  website: string
  /** Signierter Zeitstempel aus dem Seitenaufbau (Zweck 'meldung'). */
  formToken: string
}

// (Die Meldung ZU_VIELE_MELDUNGEN liegt in lib/meldung.ts — eine "use server"-
//  Datei darf nur async-Funktionen exportieren.)

const STUNDE_MS = 60 * 60 * 1000

// Nur für anonyme Kundinnen ohne E-Mail (siehe Kopf). Ein Limiter je Instanz.
const anonymDrossel = createRateLimiter({ max: MELDUNGEN_PRO_STUNDE, windowMs: STUNDE_MS })

/** Eine glaubwürdige, aber bedeutungslose Kurznummer für die stille Ablehnung. */
function scheinKurznummer(): string {
  return Math.random().toString(36).slice(2, 10).padEnd(8, '0')
}

async function hofDerSitzung(): Promise<{ id: string; name: string } | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const rolle = (session.user as typeof session.user & { role?: string }).role
  if (rolle !== 'FARMER') return null
  return prisma.farm.findUnique({ where: { ownerId: session.user.id }, select: { id: true, name: true } })
}

export async function meldungAbsenden(data: MeldungFormularDaten): Promise<MeldungErgebnis> {
  // 0. Bot-Abwehr — VOR jeder Validierung und jedem Schreibzugriff.
  const honigtopfGefuellt = typeof data.website === 'string' && data.website.trim().length > 0
  const zeitschranke = checkFormToken(typeof data.formToken === 'string' ? data.formToken : '', 'meldung')

  if (!honigtopfGefuellt && zeitschranke === 'abgelaufen') {
    return { error: FORM_EXPIRED_MESSAGE }
  }
  if (honigtopfGefuellt || zeitschranke !== 'ok') {
    if (process.env.NODE_ENV !== 'production') {
      const grund = honigtopfGefuellt ? 'Honigtopf' : `Zeitschranke/${zeitschranke}`
      console.log(`[DEV] Meldung still abgewiesen (${grund})`)
    }
    return { ok: true, kurznummer: scheinKurznummer() }
  }

  // 1. Validierung
  const parsed = meldungEingabeSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
  const eingabe = parsed.data

  // 2. Wer meldet? Der Hof aus der Sitzung — nie aus dem Formular.
  const hof = await hofDerSitzung()

  // 3. Screenshot nur vom eigenen Hof-Zielordner; Kundinnen ohne Sitzung
  //    bekommen gar keinen Upload-Weg (siehe Kopf), eine mitgeschickte URL
  //    wird deshalb verworfen statt gespeichert.
  let screenshotUrl: string | null = null
  if (eingabe.screenshotUrl && hof) {
    if (!darfGeloeschtWerden(eingabe.screenshotUrl, hof.id)) {
      return { error: 'Der Screenshot gehört nicht zu diesem Hof.' }
    }
    screenshotUrl = eingabe.screenshotUrl
  }

  // 4. Stundenzähler. Zählen-dann-Schreiben ist nicht atomar — zwei gleichzeitige
  //    Anfragen können beide „4" lesen. Für einen Pilothof reicht das (dieselbe
  //    Abwägung wie der In-Memory-Limiter in lib/rate-limit.ts); ein Schloss
  //    wäre hier teurer als der Schaden einer sechsten Meldung.
  const seit = new Date(Date.now() - STUNDE_MS)
  if (hof) {
    const anzahl = await prisma.meldung.count({ where: { farmId: hof.id, createdAt: { gte: seit } } })
    if (anzahl >= MELDUNGEN_PRO_STUNDE) return { error: ZU_VIELE_MELDUNGEN }
  } else {
    // Kundinnen: die E-Mail ist unverifiziert und frei wählbar — wer je Anfrage
    // eine neue erfindet, käme am E-Mail-Zähler vorbei. Deshalb IMMER zusätzlich
    // die IP-Drossel (nur Produktion, je Instanz, IP nur flüchtig gelesen), und
    // bei angegebener E-Mail obendrein der DB-Zähler über alle Instanzen.
    if (process.env.NODE_ENV === 'production') {
      const ip = getClientIp(await headers())
      if (!anonymDrossel.check(`meldung:${ip}`)) return { error: ZU_VIELE_MELDUNGEN }
    }
    if (eingabe.customerEmail) {
      const anzahl = await prisma.meldung.count({
        where: { customerEmail: eingabe.customerEmail, createdAt: { gte: seit } },
      })
      if (anzahl >= MELDUNGEN_PRO_STUNDE) return { error: ZU_VIELE_MELDUNGEN }
    }
  }

  // 5. Speichern
  const meldung = await prisma.meldung.create({
    data: {
      art: eingabe.art,
      text: eingabe.text,
      seiteUrl: eingabe.seiteUrl,
      userAgent: eingabe.userAgent,
      viewport: eingabe.viewport,
      farmId: hof?.id ?? null,
      // Die E-Mail einer Kundin — bei einem Hof ist die Adresse über den Hof
      // bekannt, das Feld bleibt leer.
      customerEmail: hof ? null : (eingabe.customerEmail ?? null),
      screenshotUrl,
      diagKennung: eingabe.diagKennung ?? null,
    },
    select: { id: true, createdAt: true },
  })

  // 6. Betreiber-Mail NUR bei FEHLER (siehe Kopf). Ein Mail-Fehler darf die
  //    Meldung nicht scheitern lassen — sie ist gespeichert.
  if (eingabe.art === 'FEHLER') {
    try {
      await sendMeldungNotification({
        kurznummer: kurznummer(meldung.id),
        id: meldung.id,
        text: eingabe.text,
        seiteUrl: eingabe.seiteUrl,
        userAgent: eingabe.userAgent,
        viewport: eingabe.viewport,
        diagKennung: eingabe.diagKennung ?? null,
        farmName: hof?.name ?? null,
        screenshotUrl,
        createdAt: meldung.createdAt,
      })
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Meldungs-Mail fehlgeschlagen: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  return { ok: true, kurznummer: kurznummer(meldung.id) }
}
