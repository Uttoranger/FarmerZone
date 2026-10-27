import { ladeZustellungReiter } from '@/server/queries/postfach'
import { ZUSTELLUNG_TEXT, type ZustellRegeln } from '@/lib/zustellung'
import { SUPPORT_EMAIL } from '@/lib/support'
import { formatTagKurz } from '@/lib/format'
import { wienKalendertag } from '@/lib/kalender'
import { cn } from '@/lib/utils'
import { LEISE } from '@/components/hof-bestellungen/stil'
import { PostfachZustellung, type EmpfaengerAnzeige } from '@/components/admin/postfach-zustellung'

export type BenachrichtigungenDaten = { regeln: ZustellRegeln; empfaenger: EmpfaengerAnzeige[] }

/**
 * Die Daten des Reiters — wirft bei einem Datenbankfehler; die Seite zeigt
 * dann AdminFehler. An die Client-Komponente gehen nur Text und Kennungen:
 * Datum fertig geschrieben (Wiener Kalendertag), kein Token, kein Ablauf.
 */
export async function ladeBenachrichtigungen(jetzt: Date): Promise<BenachrichtigungenDaten> {
  const { regeln, empfaenger } = await ladeZustellungReiter(jetzt)
  return {
    regeln,
    empfaenger: empfaenger.map((e) => {
      const datum = formatTagKurz(wienKalendertag(e.createdAt))
      const zeile =
        e.zustand === 'bestaetigt'
          ? ZUSTELLUNG_TEXT.bestaetigtAm(formatTagKurz(wienKalendertag(e.bestaetigtAm ?? e.createdAt)))
          : e.zustand === 'ausstehend'
            ? ZUSTELLUNG_TEXT.ausstehend(datum)
            : ZUSTELLUNG_TEXT.abgelaufen(datum)
      return { id: e.id, email: e.email, bestaetigt: e.zustand === 'bestaetigt', zeile }
    }),
  }
}

/*
 * Die Gruppe „Benachrichtigungen" in Admin › Einstellungen (seit Nr. 193,
 * Register N32; bis dahin der Reiter „Zustellung" im Postfach, Register N14,
 * Nr. 95; Mockup admin-postfach-zustellung): die Empfängerliste —
 * SUPPORT_EMAIL fest, weitere Adressen erst nach Bestätigung — und die Regel
 * je Art. Dieselben Teile wie vorher; nur der Ort ist neu.
 */
export function BenachrichtigungenGruppe({ daten }: { daten: BenachrichtigungenDaten }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <PostfachZustellung supportEmail={SUPPORT_EMAIL} regeln={daten.regeln} empfaenger={daten.empfaenger} />
      <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{ZUSTELLUNG_TEXT.regel}</p>
    </div>
  )
}
