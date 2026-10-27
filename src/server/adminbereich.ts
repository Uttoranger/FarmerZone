import { prisma } from '@/lib/prisma'
import { kontoHatHof } from '@/lib/admin-navigation'
import { verlangeAdminShell } from '@/server/admin-wache'
import { zaehleWartendeHoefe } from '@/server/queries/admin'
import { zaehleOffenImEingang } from '@/server/queries/postfach'
import * as Sentry from '@sentry/nextjs'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { fehlerKlasse, type BetriebHinweis } from '@/lib/betrieb'
import { ladeBetriebHinweis } from '@/server/queries/betrieb'
import { ladeAdminAufgaben } from '@/server/queries/admin-heute'
import { aufgabenLeiste, aufgabenZahl, type AufgabenLeiste } from '@/lib/admin-aufgaben'

export type Adminbereich = {
  personName: string
  /**
   * Ob das Konto einen eigenen Hof hat (kontoHatHof): Nur dann zeigt der Kopf
   * „← Mein Hof" und die Plakette als Link auf „Konto und Sicherheit" —
   * beide Ziele liegen im Hofbereich.
   */
  hatHof: boolean
  /**
   * Die Zähler der Reiter: wartende Höfe; am Postfach alles, was im Eingang offen ist (N14: Antworten, Meldungen, Aufgaben).
   * Fehlt im Pflicht-Zustand und in einer Sitzung ohne Passkey (N20, Nr. 115): keine Daten, auch nicht im Kopf.
   */
  zahlen?: { hoefe: number; briefkasten: number }
  /**
   * Offene Warnungen von Admin › Betrieb für Punkt und Betriebsleiste
   * (Register N15/N18) — nur in der Produktion, sonst null.
   */
  betrieb: BetriebHinweis | null
  /**
   * „n offen · m überfällig – ansehen“ rechts in der Betriebsleiste (Register
   * N32, Nr. 185) — dieselbe Quelle wie „Braucht dich“ auf Heute. null, wenn
   * nichts offen ist, im Pflicht-Zustand und wenn das Laden scheitert.
   */
  aufgaben: AufgabenLeiste | null
}

/**
 * Punkt und Hinweis dürfen den Admin nie aufhalten: Scheitert die schlanke
 * Abfrage, fehlt nur der Punkt (Sentry mit festem Satz, nur die Klasse).
 */
async function ladeBetriebHinweisSicher(): Promise<BetriebHinweis | null> {
  if (!UMGEBUNG.vercelProduktion) return null
  try {
    return await ladeBetriebHinweis(new Date())
  } catch (err) {
    const meldung = new Error('Betrieb: Hinweis der Shell nicht gelesen')
    meldung.name = fehlerKlasse(err)
    Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'betrieb', grund: 'shell-hinweis' } })
    return null
  }
}

/** Wie der Punkt: Die Zahl darf den Admin nie aufhalten — scheitert eine Quelle, fehlt nur die Zeile (Sentry, nur die Klasse). */
async function ladeAufgabenLeisteSicher(jetzt: Date): Promise<AufgabenLeiste | null> {
  try {
    return aufgabenLeiste(aufgabenZahl(await ladeAdminAufgaben(jetzt, { mitBetrieb: UMGEBUNG.vercelProduktion })))
  } catch (err) {
    const meldung = new Error('Heute: Zahl der Betriebsleiste nicht gelesen')
    meldung.name = fehlerKlasse(err)
    Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'admin', grund: 'shell-aufgaben' } })
    return null
  }
}

/**
 * Was das Layout von /admin für die AdminShell braucht (Nachtlauf Nr. 22f) —
 * das Gegenstück zu ladeHofbereich (src/server/hofbereich.ts).
 *
 * ZUERST die Admin-Wache: Ein Layout rendert parallel zur Seite, und ohne
 * eigene Prüfung zeigte es einem Unbefugten Kopf und Zähler, während die Seite
 * noch ihr notFound() wirft. Die Seiten prüfen trotzdem selbst
 * (verlangeAdminSeite als erste Anweisung): Ein Layout rendert beim Wechsel
 * zwischen Unterseiten nicht neu, eine Seite schon.
 *
 * Ob es einen eigenen Hof gibt, liest dieselbe Abfrage mit (Rolle und nur die
 * Kennung des Hofs, Register N1 / Nr. 41) — frisch aus der Datenbank wie das
 * Admin-Recht, nicht aus der Sitzung.
 */
export async function ladeAdminbereich(): Promise<Adminbereich> {
  // Das Layout umhüllt auch die Pflichtseite (/admin/einrichten). Im
  // Pflicht-Zustand und in einer Sitzung ohne Passkey nur die Shell mit Name —
  // keine Zähler, kein Betriebshinweis (N20, Nr. 115); die Seiten prüfen selbst.
  const { userId, inhaltOffen } = await verlangeAdminShell()
  if (!inhaltOffen) {
    const nutzer = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true, farm: { select: { id: true } } } })
    return { personName: nutzer?.name ?? '', hatHof: kontoHatHof({ rolle: nutzer?.role, hofVorhanden: nutzer?.farm != null }), betrieb: null, aufgaben: null }
  }
  const [nutzer, hoefe, offen, betrieb, aufgaben] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, role: true, farm: { select: { id: true } } } }),
    zaehleWartendeHoefe(),
    zaehleOffenImEingang(),
    ladeBetriebHinweisSicher(),
    ladeAufgabenLeisteSicher(new Date()),
  ])
  // Ein Postfach, eine Zahl (Register N14): dieselbe Zählung wie „Offen" im Eingang —
  // ungelesene Antworten, Meldungen NEU/GEPRUEFT, wartende Höfe, offene Erstattungen.
  const briefkasten = offen.gesamt
  return {
    personName: nutzer?.name ?? '',
    hatHof: kontoHatHof({ rolle: nutzer?.role, hofVorhanden: nutzer?.farm != null }),
    zahlen: { hoefe, briefkasten },
    betrieb,
    aufgaben,
  }
}
