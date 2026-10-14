import {
  filterAusParametern,
  getMeldungenFuerAdmin,
  getWunschCluster,
  zaehleMeldungenJeStatus,
  type AdminMeldungFilter,
  type AdminMeldungZeile,
  type WunschCluster,
} from '@/server/queries/meldung'
import { MELDUNG_ARTEN, MELDUNG_ART_LABEL, STATUS_ZU_ENTSCHEIDEN, type MeldungStatus } from '@/lib/meldung'
import { MELDUNG_ART_TON } from '@/lib/hof-hilfe'
import {
  ADMIN_STATUS_TON,
  STATUS_GRUPPEN,
  adminStatusText,
  aktiveStatusGruppe,
  artUmschalten,
  briefkastenAdresse,
  herkunftZeile,
  zaehleStatusGruppen,
  type BriefkastenSuche,
} from '@/lib/admin-briefkasten'
import { meldungenImPostfach } from '@/lib/postfach'
import { wienKalendertag } from '@/lib/kalender'
import { datumKurz } from '@/lib/verkauf-eintragen'
import { cn } from '@/lib/utils'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { LEISE } from '@/components/hof-bestellungen/stil'
import { MeldungListe, Wunschliste, type BriefkastenZeile, type WunschBuendel } from '@/components/admin/briefkasten-teile'

/** Mehr zeigt die Liste nie auf einmal (getMeldungenFuerAdmin). */
const LISTE_MAX = 200

/** Ein Link in diesen Reiter mit geändertem Filter — die Filterlogik bleibt die des bisherigen Briefkastens. */
function adresse(basis: BriefkastenSuche, aenderung: BriefkastenSuche): string {
  return meldungenImPostfach(briefkastenAdresse(basis, aenderung))
}

export type MeldungenDaten = {
  filter: AdminMeldungFilter
  meldungen: AdminMeldungZeile[]
  jeStatus: Partial<Record<MeldungStatus, number>>
  cluster: WunschCluster[]
}

/** Die Daten des Reiters — wirft bei einem Datenbankfehler; die Seite zeigt dann AdminFehler. */
export async function ladeMeldungenReiter(suche: BriefkastenSuche): Promise<MeldungenDaten> {
  const filter = filterAusParametern(suche, STATUS_ZU_ENTSCHEIDEN)
  const [meldungen, jeStatus, cluster] = await Promise.all([getMeldungenFuerAdmin(filter), zaehleMeldungenJeStatus(filter.art), getWunschCluster()])
  return { filter, meldungen, jeStatus, cluster }
}

/*
 * Der Reiter „Meldungen" im Admin-Postfach (Register N12, Nr. 87; Mockup
 * admin-postfach): der bisherige Briefkasten von /admin/meldungen, Logik
 * unverändert — Startansicht „Zu entscheiden" (Neues und die
 * Wunsch-Vorschläge der KI), daneben die gebündelte Wunschliste. Nur die
 * Links tragen jetzt den Reiter (meldungenImPostfach); /admin/meldungen
 * leitet hierher um, die Detailseite /admin/meldungen/[id] bleibt.
 * Eingangskanal, kein Befehlskanal.
 */
export function MeldungenReiter({ suche, daten, jetzt }: { suche: BriefkastenSuche; daten: MeldungenDaten; jetzt: Date }): React.JSX.Element {
  const { filter } = daten
  const heute = wienKalendertag(jetzt)
  const zeilen: BriefkastenZeile[] = daten.meldungen.map((m) => ({
    id: m.id,
    art: MELDUNG_ART_LABEL[m.art],
    artTon: MELDUNG_ART_TON[m.art],
    titel: m.ersteZeile || '—',
    herkunft: `${herkunftZeile(m)} · Nr. ${m.kurznummer}`,
    datum: datumKurz(wienKalendertag(m.createdAt), heute),
    status: adminStatusText(m.status, m.sprintName),
    statusTon: ADMIN_STATUS_TON[m.status],
  }))
  const buendel: WunschBuendel[] = daten.cluster.map((c) => ({
    schluessel: c.clusterKey ?? '__ohne',
    name: c.clusterKey ?? 'Ohne Bündel',
    anzahl: c.anzahl,
    beispiele: c.beispiele.map((b) => ({ id: b.id, text: `${b.kurznummer} · ${b.hofName ?? 'Kundin'} · ${b.ersteZeile || '—'}` })),
    weitere: Math.max(0, c.anzahl - c.beispiele.length),
  }))
  const gruppe = aktiveStatusGruppe(suche.status, filter.status)
  const gruppenZahl = zaehleStatusGruppen(daten.jeStatus)
  const istVoreinstellung = gruppe === 'zu-entscheiden' && filter.art === null

  return (
    <div className="flex flex-col gap-5">
      <p className={cn('text-[13px]', LEISE)}>Wochen-Zusammenfassung montags per E-Mail, wenn etwas wartet</p>

      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-3">
        <FilterChipReihe beschriftung="Nach Stand filtern">
          {STATUS_GRUPPEN.map((g) => (
            <FilterChip key={g.id} href={adresse(suche, { status: g.wert })} aktiv={gruppe === g.id}>
              {g.label}
              <span className="ml-1 tabular-nums">· {gruppenZahl[g.id]}</span>
            </FilterChip>
          ))}
        </FilterChipReihe>
        <span aria-hidden="true" className="hidden h-6 w-px bg-border md:block" />
        <FilterChipReihe beschriftung="Nach Art filtern">
          {MELDUNG_ARTEN.map((a) => (
            <FilterChip key={a} href={adresse(suche, { art: artUmschalten(filter.art, a) })} aktiv={filter.art === a}>
              {MELDUNG_ART_LABEL[a]}
            </FilterChip>
          ))}
        </FilterChipReihe>
      </div>

      {/* grid-cols-1 = eine Spalte minmax(0, 1fr): Ohne sie wüchse die Spalte
          unter lg mit der längsten gekürzten Zeile (Liste, Wunschliste) — bei
          390 px wischte die Seite seitlich (Nr. 54). */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-2">
          <p className={cn('text-[13px]', LEISE)} aria-live="polite">
            {zeilen.length === 1 ? '1 Meldung' : `${zeilen.length} Meldungen`}
            {zeilen.length === LISTE_MAX && ' (die jüngsten 200)'}
          </p>
          <MeldungListe
            zeilen={zeilen}
            leer={
              istVoreinstellung
                ? { titel: 'Nichts zu entscheiden', satz: 'Neue Meldungen und Vorschläge der KI landen hier.', ausweg: { text: 'Offene Meldungen zeigen', href: adresse({}, { status: STATUS_GRUPPEN[1].wert }) } }
                : { titel: 'Keine Meldung passt', satz: 'Mit diesem Filter gibt es keine Meldung.', ausweg: { text: 'Zu entscheiden zeigen', href: adresse({}, {}) } }
            }
          />
        </div>
        <Wunschliste buendel={buendel} />
      </div>
    </div>
  )
}
