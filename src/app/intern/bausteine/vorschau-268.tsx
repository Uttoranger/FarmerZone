'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { RUNDUNG } from '@/components/ui/rundung'
import { Segment } from '@/components/ui/segment'
import { MeldungFormularAnsicht } from '@/components/ui/meldung-formular-ansicht'
import type { MeldungFormular } from '@/components/shared/use-meldung-formular'
import { MeineMeldungen } from '@/components/hof-hilfe/meine-meldungen'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'
import { PROBLEM_MELDEN_SATZ_HOF, PROBLEM_MELDEN_SATZ_KUNDE, type MeldungZeile } from '@/lib/hof-hilfe'
import type { MeldungArt } from '@/lib/meldung'

/**
 * Einhängepunkt der Nr. 268 (Lauf 33) in der Bausteine-Vorschau: das Meldeformular mit Variante je Welt
 * (Board s3-/w3-problem-melden bzw. s2-/w2-meldungen) und „Meine Meldungen“ mit Art-Marke und Kopf-Aktion.
 * Nr. 268 ändert nur diese Datei und hängt sie mit einer Import- und einer Einhäng-Zeile am Ende von
 * bausteine-vorschau.tsx ein. Kein Aufruf des Servers: der Zustand ist ein Beispiel (TESTING_GUIDELINES §5),
 * „Absenden“ zeigt nur den Dank.
 */

export type Variante268 = 'kunde' | 'kunde-hof' | 'hof'

const VARIANTEN: readonly { wert: Variante268; label: string; satz: string }[] = [
  { wert: 'kunde', label: 'Kundschaft', satz: 'Ohne Sitzung: Karte, Zähler rechts, E-Mail, Satz „Mitgeschickt: …“.' },
  { wert: 'kunde-hof', label: 'Kundschaft mit Hof-Sitzung', satz: 'Satz statt Karte; „+ Bildschirmfoto hinzufügen“ gestrichelt nach der Fehlernummer.' },
  { wert: 'hof', label: 'Hof', satz: 'Frei auf dem Grund; Bildschirmfoto vor der Fehlernummer, Hilfetext, Karte „Das schicken wir automatisch mit“.' },
]

/** Beispielzeilen für „Meine Meldungen“ — erfunden. */
export const BEISPIEL_ZEILEN_268: readonly MeldungZeile[] = [
  { id: 'v268-1', kurznummer: '4F8M2Q', art: 'Fehler', artTon: 'offen', titel: 'Die Packliste druckt die Abholzeit doppelt.', datum: 'Heute', status: 'Eingegangen', statusTon: 'neutral', antwort: null },
  { id: 'v268-2', kurznummer: '7K2QAB', art: 'Frage', artTon: 'neutral', titel: 'Wann kommt die erste Monatsabrechnung?', datum: 'Gestern', status: 'Beantwortet', statusTon: 'fertig', antwort: 'Am Monatsersten per E-Mail.' },
]

function useBeispielFormular(): MeldungFormular {
  const [art, setArt] = useState<MeldungArt>('FEHLER')
  const [text, setText] = useState('')
  const [kennung, setKennung] = useState('3141592653')
  const [email, setEmail] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [website, setWebsite] = useState('')
  const [kurznummer, setKurznummer] = useState<string | null>(null)
  return {
    art, setArt, text, setText, kennung, setKennung, email, setEmail, screenshotUrl, setScreenshotUrl, website, setWebsite,
    fehler: '',
    kurznummer,
    isPending: false,
    kontext: { seiteUrl: '', userAgent: '', viewport: '' },
    upload: { fileInput: null, openFilePicker: () => {}, isUploading: false, progress: null } as unknown as MeldungFormular['upload'],
    absenden: (e) => {
      e.preventDefault()
      setKurznummer('4F8M2Q')
    },
    nochEtwas: () => setKurznummer(null),
  }
}

/** Eine Variante des Meldeformulars — eigene Funktion, damit der Render-Test jede einzeln zeichnen kann. */
export function MeldungVariante268({ variante }: { variante: Variante268 }): React.JSX.Element {
  const formular = useBeispielFormular()
  const welt = variante === 'hof' ? 'hof' : 'kunde'
  return (
    <MeldungFormularAnsicht
      formular={formular}
      welt={welt}
      alsHof={variante !== 'kunde'}
      abbrechenHref="/intern/bausteine#meldung-268"
      titel={welt === 'kunde' ? PROBLEM_MELDEN : undefined}
      satz={welt === 'kunde' ? PROBLEM_MELDEN_SATZ_KUNDE : undefined}
      einleitung={welt === 'hof' ? PROBLEM_MELDEN_SATZ_HOF : undefined}
      hofName={variante !== 'kunde' ? 'Hof Müller' : undefined}
    />
  )
}

function Abschnitt268({ id, titel, satz, children }: { id: string; titel: string; satz: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titel`} className={cn('flex min-w-0 flex-col gap-3 border border-border bg-card p-4 md:p-5', RUNDUNG.karte)}>
      <div>
        <h2 id={`${id}-titel`} className="font-heading text-lg font-semibold">
          {titel}
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{satz}</p>
      </div>
      {children}
    </section>
  )
}

export function Vorschau268(): React.JSX.Element {
  // Eine Variante zur Zeit: sonst stünden die Felder (meldung-text, meldung-kennung) mehrfach mit derselben id da.
  const [variante, setVariante] = useState<Variante268>('kunde')
  const satz = VARIANTEN.find((v) => v.wert === variante)?.satz ?? ''
  return (
    <>
      <Abschnitt268 id="meldung-268" titel="Meldeformular je Welt (Nr. 268)" satz={satz}>
        <Segment
          beschriftung="Variante"
          optionen={VARIANTEN.map((v) => ({ wert: v.wert, label: v.label }))}
          wert={variante}
          onWertChange={(w) => setVariante(w as Variante268)}
        />
        <MeldungVariante268 key={variante} variante={variante} />
      </Abschnitt268>
      <Abschnitt268 id="meine-meldungen-268" titel="Meine Meldungen (Nr. 268)" satz="Art als Marke vor dem Tag; „Neue Meldung“ im Web oben rechts im Kopf, am Handy über der Liste.">
        <MeineMeldungen zeilen={[...BEISPIEL_ZEILEN_268]} />
      </Abschnitt268>
    </>
  )
}
