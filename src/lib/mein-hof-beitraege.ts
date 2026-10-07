/**
 * Der Reiter „Beiträge" in Mein Hof (E12, Nachtlauf Nr. 16, seit Nr. 22e mit
 * allem, was /status konnte): was die Liste über die Beiträge des Hofs zeigt
 * und welche Handlungen je Beitrag angeboten werden. Rein und ohne Datenbank
 * prüfbar (tests/mein-hof-seite.test.ts, tests/beitraege-hilfe.test.ts).
 *
 * Geschrieben wird weiter im bestehenden Ablauf /status/new — der Reiter baut
 * keinen zweiten Beitrags-Editor. Deaktivieren und Löschen laufen über die
 * bestehenden Actions (src/server/actions/status-posts.ts).
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
  /** Wie viele der WhatsApp-Nachrichten schon verschickt sind (je ein Tipp, /status/[id]/send-whatsapp). */
  whatsappSentCount: number
  whatsappRecipientCount: number
}

/** Der Ton der Marke — dieselben Werte wie StatusBadge (components/ui/status-badge.tsx). */
export type BeitragTon = 'offen' | 'fertig' | 'neutral'

/**
 * Was je Beitrag angeboten wird — dieselben Bedingungen wie früher auf /status:
 * Deaktivieren nur, solange er aktiv ist; Als Vorlage nur für vergangene;
 * WhatsApp fortsetzen nur, solange Nachrichten offen sind. Löschen geht immer.
 */
export type BeitragAktionen = {
  deaktivieren: boolean
  /** /status/new?from=<id> — der Ablauf übernimmt Inhalt und Foto, der alte Beitrag bleibt. */
  vorlage: string | null
  whatsapp: { href: string; text: string } | null
}

export type BeitragEintrag = {
  id: string
  titel: string
  marke: { text: string; ton: BeitragTon }
  /** „vor 3 Stunden · Nur auf der Hofseite" bzw. „Noch nicht veröffentlicht". */
  zeile: string
  aktionen: BeitragAktionen
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

function aktionen(b: BeitragQuelle, gruppe: BeitragGruppeId): BeitragAktionen {
  const offen = b.whatsappRecipientCount - b.whatsappSentCount
  return {
    deaktivieren: gruppe === 'aktiv',
    vorlage: gruppe === 'vergangen' ? `/status/new?from=${b.id}` : null,
    whatsapp:
      gruppe !== 'entwuerfe' && b.sentViaWhatsApp && offen > 0
        ? { href: `/status/${b.id}/send-whatsapp`, text: `WhatsApp fortsetzen · ${b.whatsappSentCount} von ${b.whatsappRecipientCount}` }
        : null,
  }
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
        aktionen: aktionen(b, id),
      })),
  })).filter((g) => g.eintraege.length > 0)
  return { gruppen, anzahl: beitraege.length }
}
