/**
 * Der Reiter „Beiträge" in Mein Hof (E12, Nachtlauf Nr. 16): was die Übersicht
 * über die Beiträge des Hofs zeigt. Rein und ohne Datenbank prüfbar
 * (tests/mein-hof-seite.test.ts).
 *
 * Bearbeitet wird weiter auf den bestehenden Seiten unter /status
 * (Deaktivieren, Löschen, Als Vorlage, WhatsApp fortsetzen) — die Übersicht
 * baut keinen zweiten Beitrags-Editor, sie sagt nur, was es gibt.
 */
import { vorWieLange } from '@/lib/hofseite-kunde'
import { aufzaehlung } from '@/lib/hofseite-fortschritt'

/** Was die Übersicht von einem Beitrag braucht — eine Teilmenge von StatusPostSummary. */
export type BeitragQuelle = {
  id: string
  title: string
  isActive: boolean
  isDraft: boolean
  /** ISO-Zeitpunkt der Veröffentlichung; null = nie veröffentlicht. */
  publishedAt: string | null
  sentViaEmail: boolean
  sentViaWhatsApp: boolean
}

/** Der Ton der Marke — dieselben Werte wie StatusBadge (components/ui/status-badge.tsx). */
export type BeitragTon = 'offen' | 'fertig' | 'neutral'

export type BeitragEintrag = {
  id: string
  titel: string
  marke: { text: string; ton: BeitragTon }
  /** „vor 3 Stunden · Nur auf der Hofseite" bzw. „Noch nicht veröffentlicht". */
  zeile: string
}

export type BeitragGruppeId = 'aktiv' | 'entwuerfe' | 'vergangen'

export type BeitraegeUebersicht = {
  gruppen: { id: BeitragGruppeId; titel: string; eintraege: BeitragEintrag[] }[]
  anzahl: number
}

const GRUPPEN: readonly { id: BeitragGruppeId; titel: string }[] = [
  { id: 'aktiv', titel: 'Aktiv' },
  { id: 'entwuerfe', titel: 'Entwürfe' },
  { id: 'vergangen', titel: 'Vergangen' },
]

function gruppeVon(b: BeitragQuelle): BeitragGruppeId {
  if (b.isActive) return 'aktiv'
  if (b.isDraft) return 'entwuerfe'
  return 'vergangen'
}

const MARKE: Record<BeitragGruppeId, BeitragEintrag['marke']> = {
  aktiv: { text: 'Aktiv', ton: 'fertig' },
  entwuerfe: { text: 'Entwurf', ton: 'neutral' },
  vergangen: { text: 'Abgelaufen', ton: 'neutral' },
}

/** „Nur auf der Hofseite", „Hofseite und E-Mail", „Hofseite, E-Mail und WhatsApp". */
function wege(b: BeitragQuelle): string {
  const zusaetzlich = [b.sentViaEmail && 'E-Mail', b.sentViaWhatsApp && 'WhatsApp'].filter((w): w is string => Boolean(w))
  return zusaetzlich.length === 0 ? 'Nur auf der Hofseite' : aufzaehlung(['Hofseite', ...zusaetzlich])
}

/**
 * Die Beiträge in drei Gruppen (Aktiv · Entwürfe · Vergangen), leere fallen
 * weg; innerhalb einer Gruppe die Reihenfolge der Abfrage. „vor …" rechnet
 * vom übergebenen Zeitpunkt — die Seite bestimmt ihn einmal auf dem Server.
 */
export function beitraegeUebersicht(beitraege: readonly BeitragQuelle[], jetztIso: string): BeitraegeUebersicht {
  const gruppen = GRUPPEN.map(({ id, titel }) => ({
    id,
    titel,
    eintraege: beitraege
      .filter((b) => gruppeVon(b) === id)
      .map((b) => ({
        id: b.id,
        titel: b.title,
        marke: MARKE[id],
        zeile: b.isDraft || !b.publishedAt ? 'Noch nicht veröffentlicht' : `${vorWieLange(b.publishedAt, jetztIso)} · ${wege(b)}`,
      })),
  })).filter((g) => g.eintraege.length > 0)
  return { gruppen, anzahl: beitraege.length }
}
