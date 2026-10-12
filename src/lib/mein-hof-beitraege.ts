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
import { formatZahl } from '@/lib/format'
import { WHATSAPP_VERSAND_TEXT } from '@/lib/whatsapp-versand'

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
  /** An wie viele Adressen die E-Mail beim Veröffentlichen ging (gespeichert, keine neue Abfrage). */
  emailRecipientCount: number
  /** Wer die Nachricht in WhatsApp geöffnet bekam (Abonnements-IDs, Register W1, /status/[id]/send-whatsapp). */
  whatsappGetippt: readonly string[]
}

/** Der Ton der Marke — dieselben Werte wie StatusBadge (components/ui/status-badge.tsx). */
export type BeitragTon = 'offen' | 'fertig' | 'neutral'

/**
 * Was je Beitrag angeboten wird — dieselben Bedingungen wie früher auf /status:
 * Deaktivieren nur, solange er aktiv ist; Als Vorlage nur für vergangene;
 * WhatsApp nur, solange heutige Abonnentinnen offen sind. Löschen geht immer.
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

/**
 * „Nur auf der Hofseite", „Hofseite und 12 per E-Mail", „Hofseite, 12 per
 * E-Mail und WhatsApp". Die Zahl der E-Mail-Empfänger stand auf der alten
 * Beitragskarte von /status und kam mit Register F6 (22e) zurück in die Zeile;
 * WhatsApp nennt seinen Stand im Knopf „WhatsApp · n von m".
 */
function wege(b: BeitragQuelle): string {
  const email = b.sentViaEmail && `${formatZahl(b.emailRecipientCount)} per E-Mail`
  const zusaetzlich = [email, b.sentViaWhatsApp && 'WhatsApp'].filter((w): w is string => Boolean(w))
  return zusaetzlich.length === 0 ? 'Nur auf der Hofseite' : aufzaehlung(['Hofseite', ...zusaetzlich])
}

/**
 * Register W1: n ist, wer geöffnet bekam, m die Zahl der HEUTIGEN
 * WhatsApp-Abonnentinnen des Hofs (nicht die beim Veröffentlichen
 * eingefrorene). Aktive und vergangene Beiträge zeigen den Knopf, solange
 * m > n; ohne Abonnentinnen keiner.
 */
function aktionen(b: BeitragQuelle, gruppe: BeitragGruppeId, whatsappAbonnentinnen: number): BeitragAktionen {
  const getippt = b.whatsappGetippt.length
  return {
    deaktivieren: gruppe === 'aktiv',
    vorlage: gruppe === 'vergangen' ? `/status/new?from=${b.id}` : null,
    whatsapp:
      gruppe !== 'entwuerfe' && whatsappAbonnentinnen > getippt
        ? { href: `/status/${b.id}/send-whatsapp`, text: WHATSAPP_VERSAND_TEXT.knopf(getippt, whatsappAbonnentinnen) }
        : null,
  }
}

/**
 * Die Beiträge in drei Gruppen (Aktiv · Entwürfe · Vergangen), leere fallen
 * weg; innerhalb einer Gruppe die Reihenfolge der Abfrage. „vor …" rechnet
 * vom übergebenen Zeitpunkt — die Seite bestimmt ihn einmal auf dem Server,
 * ebenso die Zahl der heutigen WhatsApp-Abonnentinnen (Register W1).
 */
export function beitraegeUebersicht(
  beitraege: readonly BeitragQuelle[],
  jetztIso: string,
  whatsappAbonnentinnen: number
): BeitraegeUebersicht {
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
        aktionen: aktionen(b, id, whatsappAbonnentinnen),
      })),
  })).filter((g) => g.eintraege.length > 0)
  return { gruppen, anzahl: beitraege.length }
}
