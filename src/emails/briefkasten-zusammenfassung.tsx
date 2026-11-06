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
  // „Offen im Eingang: 1 Antwort · …“ — dieselbe Zählung wie im Eingang, als Zeile Beschriftung | Wert.
  const trenner = p.offenZeile.indexOf(': ')
  const offen = trenner > 0 ? { label: p.offenZeile.slice(0, trenner), wert: p.offenZeile.slice(trenner + 2) } : { label: p.offenZeile, wert: '' }
  return (
    <EmailLayout fuss={{ art: 'betrieb' }} previewText={p.offenZeile}>
      <Text style={h1}>{p.lage ? 'Wochenlage' : 'Postfach — Wochenstand'}</Text>
      {/* Board s3/w3-mail-betrieb Bild 4: Zeilen mit der Zahl rechts, kein Kasten. */}
      {p.lage?.map((z) => <BetragsZeile key={z.label} links={z.label} rechts={z.wert} />)}
      {p.lage && <Trenner />}
      <BetragsZeile umbrechen links={offen.label} rechts={offen.wert} />
      <BetragsZeile links="Neue Meldungen" rechts={String(p.neu)} />
      {p.liegenGeblieben > 0 && <BetragsZeile links="Seit mehr als 14 Tagen offen" rechts={String(p.liegenGeblieben)} />}
      <BetragsZeile links="Meldungen offen insgesamt" rechts={String(p.offen)} />

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
