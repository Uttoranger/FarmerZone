/**
 * Der Briefkasten im Admin (Nachtlauf Nr. 22f; Mockups admin-briefkasten,
 * admin-meldung-entscheiden): Filter, Marken und die Zeile „woher". Rein und
 * ohne Datenbank prüfbar (tests/admin-briefkasten.test.ts).
 *
 * Die Triage selbst (Status, Bündel, Antwort) bleibt in triageMeldungAction;
 * hier wird nur entschieden, wie die Liste sie zeigt. Meldungstexte und
 * Browserangaben sind Fremdtext: Sie werden gekürzt und als Text gezeigt,
 * nie als Markup gedeutet.
 */
import {
  MELDUNG_STATUS,
  STATUS_ABGESCHLOSSEN,
  STATUS_INTERN,
  STATUS_OFFEN,
  STATUS_ZU_ENTSCHEIDEN,
  type MeldungArt,
  type MeldungStatus,
  type MeldungTon,
} from '@/lib/meldung'
import { seitenPfad } from '@/lib/fremdtext'
import { geraetKurz } from '@/lib/hof-hilfe'

export const BRIEFKASTEN_HREF = '/admin/meldungen'

/**
 * Der Ton des internen Status — dieselbe Farbwelt wie die alten Admin-Marken
 * (STATUS_MARKE_FARBE): Orange = wartet auf dich, Grün = läuft, neutral =
 * abgeschlossen.
 */
export const ADMIN_STATUS_TON: Record<MeldungStatus, MeldungTon> = {
  NEU: 'offen',
  VERMUTLICH_WUNSCH: 'offen',
  GEPRUEFT: 'fertig',
  GEPLANT: 'fertig',
  ERLEDIGT: 'neutral',
  KEIN_FEHLER: 'neutral',
  DUPLIKAT: 'neutral',
}

/** „Vermutlich Wunsch · KI" (der Vorschlag ist von der KI), „Geplant · Sprint 14". */
export function adminStatusText(status: MeldungStatus, sprintName: string | null): string {
  if (status === 'VERMUTLICH_WUNSCH') return `${STATUS_INTERN[status]} · KI`
  const sprint = sprintName?.trim()
  if (status === 'GEPLANT' && sprint) return `${STATUS_INTERN[status]} · ${sprint}`
  return STATUS_INTERN[status]
}

export type StatusGruppeId = 'zu-entscheiden' | 'offen' | 'abgeschlossen' | 'alle'

export type StatusGruppe = {
  id: StatusGruppeId
  label: string
  /** Der Wert für `?status=` — undefined heißt Voreinstellung „Zu entscheiden". */
  wert: string | undefined
  status: readonly MeldungStatus[]
}

/** Die Status-Filter (Mockup: Zu entscheiden · Offen · Abgeschlossen), dazu Alle. */
export const STATUS_GRUPPEN: readonly StatusGruppe[] = [
  { id: 'zu-entscheiden', label: 'Zu entscheiden', wert: undefined, status: STATUS_ZU_ENTSCHEIDEN },
  { id: 'offen', label: 'Offen', wert: STATUS_OFFEN.join(','), status: STATUS_OFFEN },
  { id: 'abgeschlossen', label: 'Abgeschlossen', wert: STATUS_ABGESCHLOSSEN.join(','), status: STATUS_ABGESCHLOSSEN },
  { id: 'alle', label: 'Alle', wert: MELDUNG_STATUS.join(','), status: MELDUNG_STATUS },
]

function gleicheMenge(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((s) => b.includes(s))
}

/**
 * Welcher Status-Filter gerade gilt — null, wenn die Adresse einen anderen
 * Satz nennt (z. B. `?status=GEPLANT` aus einem alten Link: die Liste filtert
 * dann genau so, nur kein Chip leuchtet).
 */
export function aktiveStatusGruppe(roh: string | undefined, status: readonly MeldungStatus[]): StatusGruppeId | null {
  if (!roh) return 'zu-entscheiden'
  return STATUS_GRUPPEN.find((g) => g.id !== 'zu-entscheiden' && gleicheMenge(g.status, status))?.id ?? null
}

/** Die Zahl hinter jedem Status-Filter, aus den Zählungen je Status. */
export function zaehleStatusGruppen(jeStatus: Partial<Record<MeldungStatus, number>>): Record<StatusGruppeId, number> {
  const summe = (status: readonly MeldungStatus[]) => status.reduce((s, st) => s + (jeStatus[st] ?? 0), 0)
  return {
    'zu-entscheiden': summe(STATUS_ZU_ENTSCHEIDEN),
    offen: summe(STATUS_OFFEN),
    abgeschlossen: summe(STATUS_ABGESCHLOSSEN),
    alle: summe(MELDUNG_STATUS),
  }
}

export type BriefkastenSuche = { status?: string; art?: string }

/** Ein Link auf den Briefkasten mit geändertem Filter — der Rest bleibt erhalten. */
export function briefkastenAdresse(basis: BriefkastenSuche, aenderung: BriefkastenSuche): string {
  const naechste = { status: basis.status, art: basis.art, ...aenderung }
  const parameter = new URLSearchParams()
  if (naechste.status) parameter.set('status', naechste.status)
  if (naechste.art) parameter.set('art', naechste.art)
  const q = parameter.toString()
  return q ? `${BRIEFKASTEN_HREF}?${q}` : BRIEFKASTEN_HREF
}

/** Der Art-Chip schaltet um: ein zweiter Tipp auf die gewählte Art zeigt wieder alle. */
export function artUmschalten(aktiv: MeldungArt | null, art: MeldungArt): MeldungArt | undefined {
  return aktiv === art ? undefined : art
}

/**
 * Die Zeile „woher" unter dem Titel (Mockup: „Hof Müller · /products ·
 * iPhone"): Absender, Seite ohne Herkunft und Abfrage, Gerät in Worten. Eine
 * Kundin steht ohne Adresse da — die E-Mail bleibt im Detail.
 */
export function herkunftZeile(m: {
  hofName: string | null
  customerEmail: string | null
  seiteUrl: string
  userAgent: string
}): string {
  const wer = m.hofName ?? (m.customerEmail ? 'Kundin' : 'Anonym')
  const teile = [wer]
  if (m.seiteUrl.trim() !== '') teile.push(seitenPfad(m.seiteUrl, 60))
  if (m.userAgent.trim() !== '') teile.push(geraetKurz(m.userAgent))
  return teile.join(' · ')
}

/** „390 × 844" statt „390x844" — leer bleibt ein Strich. */
export function bildschirmText(viewport: string): string {
  const v = viewport.trim()
  if (v === '') return '–'
  return v.replace(/\s*[x×]\s*/i, ' × ')
}

/** Der Satz unter der Wunschliste (Mockup). */
export const WUNSCHLISTE_SATZ = 'Gleiche Wünsche zählen zusammen – so siehst du, was am meisten gebraucht wird.'
