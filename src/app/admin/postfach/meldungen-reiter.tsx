import { ladeMeldungenAblauf, gruppiereWuensche, type WunschCluster } from '@/server/queries/meldung'
import { MELDUNGEN_TEXT, ablaufStand, suchMeldungVon, type AblaufStand, type SuchMeldung } from '@/lib/meldung'
import type { MeldungenAnsicht } from '@/schemas/meldung'
import { MeldungenWerkzeug } from '@/components/admin/meldungen-werkzeug'
import { AblaufAnsicht, MeldungenKopf, StandBand, WuenscheAnsicht } from '@/components/admin/meldungen-teile'

export type MeldungenDaten = {
  ansicht: MeldungenAnsicht
  stand: AblaufStand
  kandidaten: SuchMeldung[]
  stichwoerter: string[]
  /** Nur in der Ansicht „Wünsche gebündelt". */
  cluster: WunschCluster[] | null
}

/**
 * Die Daten des Reiters „Meldungen" (Register N14, Ergänzung; Nr. 101) — EINE
 * Abfrage über alle Meldungen; Stand-Band, Spalten, Chips und Bündel rechnen
 * die reinen Regeln daraus (ablaufStand, gruppiereWuensche). Wirft bei einem
 * Datenbankfehler; die Seite zeigt dann AdminFehler.
 */
export async function ladeMeldungenReiter(ansicht: MeldungenAnsicht): Promise<MeldungenDaten> {
  const meldungen = await ladeMeldungenAblauf()
  const stichwoerter = [...new Set(meldungen.flatMap((m) => (m.clusterKey?.trim() ? [m.clusterKey.trim()] : [])))].sort((a, b) => a.localeCompare(b))
  return {
    ansicht,
    stand: ablaufStand(meldungen, { art: ansicht.art, von: ansicht.von }),
    kandidaten: meldungen.map((m) => suchMeldungVon(m, MELDUNGEN_TEXT.kundin)),
    stichwoerter,
    // Der Kurztitel genügt für Woraus und die Beispiele — der volle Text bleibt in der Datenbank.
    cluster: ansicht.ansicht === 'wuensche' ? gruppiereWuensche(meldungen.map((m) => ({ ...m, text: m.ersteZeile }))) : null,
  }
}

/*
 * Der Reiter „Meldungen" (Mockups admin-postfach-meldungen-ablauf,
 * admin-postfach-wuensche, admin-postfach-zusammenfassen,
 * mobil-admin-postfach-meldungen): Stand-Band, Umschalter und Filter, darunter
 * der Ablauf bzw. die Wünsche gebündelt. Das Werkzeug (Dialoge) umfasst alles,
 * damit ein Dialog stehen bleibt, wenn eine Karte nach einem Klick wandert.
 */
export function MeldungenReiter({ daten, jetzt }: { daten: MeldungenDaten; jetzt: Date }): React.JSX.Element {
  const { ansicht, stand, kandidaten, stichwoerter, cluster } = daten
  return (
    <MeldungenWerkzeug kandidaten={kandidaten} stichwoerter={stichwoerter}>
      <div className="flex flex-col gap-3 md:gap-4">
        <StandBand stand={stand} />
        <MeldungenKopf ansicht={ansicht} stand={stand} />
        {cluster ? (
          <WuenscheAnsicht cluster={cluster} ansicht={ansicht} jetzt={jetzt} kandidaten={kandidaten} />
        ) : (
          <AblaufAnsicht stand={stand} ansicht={ansicht} jetzt={jetzt} kandidaten={kandidaten} />
        )}
      </div>
    </MeldungenWerkzeug>
  )
}
