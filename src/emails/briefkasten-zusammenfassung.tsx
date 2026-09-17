import * as React from 'react'
import { Text, Link } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, highlightBox, highlightLabel, highlightValue, ctaButton } from './_layout'

export interface BriefkastenZusammenfassungProps {
  neu: number
  liegenGeblieben: number
  offen: number
  neueste: Array<{ kurznummer: string; art: string; ersteZeile: string; hofName: string | null }>
  geloescht: number
  adminUrl: string
}

/** Wochen-Zusammenfassung an den Betreiber — nur, wenn es etwas zu sagen gibt. */
export function BriefkastenZusammenfassungEmail(p: BriefkastenZusammenfassungProps) {
  return (
    <EmailLayout previewText={`Briefkasten: ${p.neu} neu, ${p.liegenGeblieben} liegen länger als 14 Tage`}>
      <Text style={h1}>Briefkasten — Wochenstand</Text>
      <Text style={bodyText}>
        {p.neu === 1 ? 'Eine neue Meldung' : `${p.neu} neue Meldungen`} seit der letzten Sichtung.{' '}
        {p.liegenGeblieben > 0 && (
          <>
            <strong>{p.liegenGeblieben}</strong>{' '}
            {p.liegenGeblieben === 1 ? 'Meldung steht' : 'Meldungen stehen'} seit mehr als 14 Tagen auf
            &bdquo;Neu&ldquo; oder &bdquo;Geprüft&ldquo;.{' '}
          </>
        )}
        Offen insgesamt: {p.offen}.
      </Text>

      {p.neueste.length > 0 && (
        <div style={highlightBox}>
          <Text style={highlightLabel}>Die jüngsten neuen Meldungen</Text>
          {p.neueste.map((m) => (
            <Text key={m.kurznummer} style={{ ...highlightValue, fontSize: '14px' }}>
              <span style={{ fontFamily: 'monospace' }}>{m.kurznummer}</span> · {m.art} ·{' '}
              {m.hofName ?? 'Kundin'} — {m.ersteZeile}
            </Text>
          ))}
        </div>
      )}

      <Link href={p.adminUrl} style={ctaButton}>Briefkasten öffnen →</Link>

      <Text style={mutedText}>
        Aufgeräumt: {p.geloescht === 0 ? 'nichts' : `${p.geloescht} erledigte ${p.geloescht === 1 ? 'Meldung' : 'Meldungen'}`}{' '}
        älter als 90 Tage gelöscht.
      </Text>
    </EmailLayout>
  )
}
