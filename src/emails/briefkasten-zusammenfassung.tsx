import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, BetragsZeile, Knopf, KnopfReihe, Trenner, h1, bodyText, kleinText, zwischenTitel } from './_layout'

export interface BriefkastenZusammenfassungProps {
  neu: number
  liegenGeblieben: number
  offen: number
  neueste: Array<{ kurznummer: string; art: string; ersteZeile: string; hofName: string | null }>
  geloescht: number
  /** „Offen im Eingang: 2 Antworten · 1 Meldung · 2 Aufgaben" — dieselbe Zählung wie im Eingang (offenSatz). */
  offenZeile: string
  adminUrl: string
  /** Die Wochenlage (Nr. 192): Wort und Zahl je Zeile, nur Zahlen, nie Personendaten. */
  lage?: Array<{ label: string; wert: string }>
}

/** Wochenlage an den Betreiber (Register N32, Nr. 192): die Zahlen der Woche, darunter der Stand des Postfachs (Register N14). */
export function BriefkastenZusammenfassungEmail(p: BriefkastenZusammenfassungProps) {
  return (
    <EmailLayout fuss={{ art: 'betrieb' }} previewText={p.offenZeile}>
      <Text style={h1}>{p.lage ? 'Wochenlage' : 'Postfach — Wochenstand'}</Text>
      {/* Board s3/w3-mail-betrieb Bild 4: Zeilen mit der Zahl rechts, kein Kasten. */}
      {p.lage?.map((z) => <BetragsZeile key={z.label} links={z.label} rechts={z.wert} />)}
      {p.lage && <Trenner />}
      <Text style={{ ...bodyText, margin: '6px 0 6px' }}>{p.offenZeile}</Text>
      <Text style={bodyText}>
        {`${p.neu === 1 ? 'Eine neue Meldung' : `${p.neu} neue Meldungen`} seit der letzten Sichtung. `}
        {p.liegenGeblieben > 0 &&
          `${p.liegenGeblieben} ${p.liegenGeblieben === 1 ? 'Meldung steht' : 'Meldungen stehen'} seit mehr als 14 Tagen auf „Neu“ oder „Geprüft“. `}
        {`Offen insgesamt: ${p.offen}.`}
      </Text>

      {p.neueste.length > 0 && (
        <>
          <Text style={{ ...zwischenTitel, marginTop: '12px' }}>Die jüngsten neuen Meldungen</Text>
          {p.neueste.map((m) => (
            <Text key={m.kurznummer} style={{ ...bodyText, margin: '0 0 4px' }}>
              {`${m.kurznummer} · ${m.art} · ${m.hofName ?? 'Kundin'} — ${m.ersteZeile}`}
            </Text>
          ))}
        </>
      )}

      <KnopfReihe>
        <Knopf href={p.adminUrl}>Postfach öffnen →</Knopf>
      </KnopfReihe>

      <Text style={kleinText}>
        {`Aufgeräumt: ${p.geloescht === 0 ? 'nichts' : `${p.geloescht} erledigte ${p.geloescht === 1 ? 'Meldung' : 'Meldungen'}`} älter als 90 Tage gelöscht.`}
      </Text>
    </EmailLayout>
  )
}
