import { EINSTELLUNG_FUER_ZEILE, type HofseiteFortschritt } from '@/lib/hofseite-fortschritt'
import { schildTon } from '@/lib/mein-hof'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { StatusBadge } from '@/components/ui/status-badge'

/*
 * Die Checkliste von „Mein Hof" unter lg (Mockup mobil-h1-mein-hof):
 * „Zu 7 von 11 fertig", Balken, der Satz zu den fehlenden Teilen und die
 * offenen Punkte als Zeilen mit Link in die bestehenden Einstellungen
 * (EINSTELLUNG_FUER_ZEILE). Dieselbe Liste wie ab lg (hofseiteFortschritt) —
 * dort öffnet jede Zeile ihr Formular direkt; hier steht darunter die
 * Hofseite mit Stiften, deshalb nur die Punkte, die noch etwas brauchen.
 */

export function ChecklisteKompakt({ fortschritt }: { fortschritt: HofseiteFortschritt }): React.JSX.Element {
  const offen = fortschritt.gruppen.flatMap((g) => g.zeilen).filter((z) => z.marke !== null)

  return (
    <section aria-labelledby="checkliste-titel" className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="checkliste-titel" className="font-heading text-[17px] font-semibold text-foreground">
          Zu {fortschritt.erledigt} von {fortschritt.gesamt} fertig
        </h2>
        <p className="shrink-0 text-[13px] font-semibold tabular-nums text-status-fertig">{fortschritt.prozent} %</p>
      </div>
      {/* Der Wert steht daneben als Text; der Balken ist Veranschaulichung. */}
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-accent" style={{ width: `${fortschritt.prozent}%` }} />
      </div>
      <p className="mt-2.5 text-[13.5px] text-muted-foreground">{fortschritt.satz}</p>

      {offen.length > 0 && (
        <ListGruppe beschriftung="Was noch fehlt" className="mt-3">
          {offen.map((zeile) => (
            <ListRow
              key={zeile.id}
              titel={zeile.titel}
              untertitel={zeile.wert}
              href={EINSTELLUNG_FUER_ZEILE[zeile.id]}
              ende={zeile.marke && <StatusBadge status={schildTon(zeile.marke.farbe)}>{zeile.marke.text}</StatusBadge>}
            />
          ))}
        </ListGruppe>
      )}
    </section>
  )
}
