'use server'

import { revalidatePath, updateTag } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { verlangeFrischeBestaetigung } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { ADMIN_GRUND_FEHLER } from '@/schemas/admin-aktion'
import { hofSperrenSchema, hofSperreAufhebenSchema } from '@/schemas/admin-hof'
import { ADMIN_HOEFE_HREF, SPERRE_AUFGEHOBEN_NACHRICHT, SPERRE_TEXT, adminHofHref, sperreNachricht } from '@/lib/admin-hof-akte'
import { POSTFACH_HREF } from '@/lib/postfach'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'

/*
 * Admin-Sperre eines Hofs (Register N34, Nachtlauf Nr. 187): Das Team stoppt
 * neue Bestellungen bei einem Hof, mit Grund. Anders als die Pause
 * (Farm.isPaused, setPause) kann der Hof sie nicht selbst aufheben — es gibt
 * keinen Weg des Hofs, der adminGesperrtAm schreibt (tests/admin-hof-sperre.test.ts).
 *
 * Wirkung: Die Prüfkette (pruefeKaufbarkeitHoefe in src/server/warenkorb.ts,
 * dazu /api/checkout) lehnt mit dem neutralen Satz HOF_GESPERRT_SATZ ab.
 * Laufende Bestellungen, Abholung und Storno bleiben unberührt; die Pause
 * bleibt unabhängig.
 *
 * Heikel (N20): frisch mit Passkey bestätigt — die EINE Wache
 * verlangeFrischeBestaetigung({ recht: 'hof_sperren_storno' }) ist die erste
 * Anweisung (tests/frisch-bestaetigung-wache.test.ts). Danach Protokoll (N33)
 * und eine Nachricht ins Postfach des Hofs (Nachlauf: Ein Fehler darin nimmt
 * die Sperre nie zurück).
 */

type Ergebnis = { ok: true } | { error: string }

/** Hofseite, Admin-Liste und Akte; die Hofliste liest aus ihrem Zwischenspeicher. */
function revalidiere(farmId: string, slug: string): void {
  revalidatePath(ADMIN_HOEFE_HREF)
  revalidatePath(adminHofHref(farmId))
  revalidatePath('/admin')
  revalidatePath(`/${slug}`)
  revalidatePath('/dashboard')
  revalidatePath(POSTFACH_HREF)
  updateTag(HOEFE_CACHE_TAG)
}

/**
 * Die Nachricht an den Hof als eigener Faden (Art SYSTEM, vom Team) — wie die
 * Gründungs-Nachricht in admin.ts. Nachlauf: gemeldet ohne Text, nie geworfen.
 */
async function sagEsDemHof(farmId: string, text: string, anlass: 'gesperrt' | 'aufgehoben'): Promise<void> {
  try {
    const jetzt = new Date()
    await prisma.unterhaltung.create({
      data: {
        farmId,
        rundschreibenId: null,
        letzteNachrichtAm: jetzt,
        nachrichten: { create: { vonFarmId: null, text, art: 'SYSTEM', createdAt: jetzt } },
      },
      select: { id: true },
    })
  } catch (err) {
    const meldung = new Error('Admin-Sperre: Nachricht an den Hof nicht angelegt')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'admin-hof', aufgabe: anlass }, extra: { farmId } })
  }
}

/** „Vorübergehend sperren …“: nur bedingt geschrieben (`adminGesperrtAm: null`) — zweimal sperren ändert nichts. */
export async function sperreHof(eingabe: unknown): Promise<Ergebnis> {
  const frisch = await verlangeFrischeBestaetigung({ recht: 'hof_sperren_storno' })
  if ('error' in frisch) return { error: frisch.error }

  const parsed = hofSperrenSchema.safeParse(eingabe)
  if (!parsed.success) {
    const personendaten = parsed.error.issues.some((i) => i.message === ADMIN_GRUND_FEHLER)
    return { error: personendaten ? ADMIN_GRUND_FEHLER : SPERRE_TEXT.eingabe }
  }
  const { farmId, grund } = parsed.data

  const hof = await prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true } })
  if (!hof) return { error: SPERRE_TEXT.nichtGefunden }

  const { count } = await prisma.farm.updateMany({
    where: { id: farmId, adminGesperrtAm: null },
    data: { adminGesperrtAm: new Date(), adminSperrGrund: grund, adminGesperrtVonUserId: frisch.userId },
  })
  if (count === 0) return { error: SPERRE_TEXT.schonGesperrt }

  await protokolliere({ wer: frisch.userId, art: 'hof_gesperrt', bezugArt: 'hof', bezugId: farmId, grund, mitPasskey: frisch.mitPasskey })
  await sagEsDemHof(farmId, sperreNachricht(grund), 'gesperrt')
  revalidiere(farmId, hof.slug)
  return { ok: true }
}

/** „Sperre aufheben“: nur bei einem gesperrten Hof; Grund und Wer der Sperre werden geleert. */
export async function hebeHofSperreAuf(eingabe: unknown): Promise<Ergebnis> {
  const frisch = await verlangeFrischeBestaetigung({ recht: 'hof_sperren_storno' })
  if ('error' in frisch) return { error: frisch.error }

  const parsed = hofSperreAufhebenSchema.safeParse(eingabe)
  if (!parsed.success) return { error: SPERRE_TEXT.nichtGefunden }
  const { farmId } = parsed.data

  const hof = await prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true } })
  if (!hof) return { error: SPERRE_TEXT.nichtGefunden }

  const { count } = await prisma.farm.updateMany({
    where: { id: farmId, adminGesperrtAm: { not: null } },
    data: { adminGesperrtAm: null, adminSperrGrund: null, adminGesperrtVonUserId: null },
  })
  if (count === 0) return { error: SPERRE_TEXT.nichtGesperrt }

  await protokolliere({ wer: frisch.userId, art: 'hof_sperre_aufgehoben', bezugArt: 'hof', bezugId: farmId, mitPasskey: frisch.mitPasskey })
  await sagEsDemHof(farmId, SPERRE_AUFGEHOBEN_NACHRICHT, 'aufgehoben')
  revalidiere(farmId, hof.slug)
  return { ok: true }
}
