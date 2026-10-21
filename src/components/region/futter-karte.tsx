'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Marke } from '@/components/ui/marke'
import { KARTE, KNOPF_GRUEN } from '@/components/hof-bestellungen/stil'
import { Abholzeile } from '@/components/hoefe/abholzeile'
import { HofKopf } from '@/components/hoefe/hof-kopf'
import { Vorschaubild } from '@/components/hoefe/hof-vorschaubild'
import { FutterSchild } from '@/components/produkte/futter-schild'
import { AbholhinweisZeile } from '@/components/region/futter-abholhinweise'
import { FUTTER_KARTE_TEXT, bestellenText, type FutterAngebot, type FutterGroesse } from '@/lib/futter-kaufen'

/*
 * Die Futterkarte (Register N23, Board system-h5-region-v2 §3 „Futterkarte"
 * und system-h5-region-eigene-teile §3 „wählen, dann ein Knopf"): Bild 48 px,
 * `HofKopf` (Name in Serif, Entfernung, PLZ und Ort), die grüne `Abholzeile`
 * wie auf /hoefe, das Schild (`FutterSchild`, E9), der Grundpreis, die
 * Abholhinweise als Kennzeichen und die Größen als Radiogruppe mit
 * Gebinde- und Kilopreis; darunter EIN Knopf „Bestellen · 5 kg-Sack · € 8,00"
 * — ein Link auf die Produktseite genau dieser Größe. Nur die Wahl der Größe
 * läuft im Browser; ohne JavaScript gilt die vorgewählte (erste kaufbare).
 *
 * Die Größen sind echte Radioknöpfe in fieldset/legend (Pfeiltasten, Ansage
 * „1 von 4" vom Browser), nicht `GroessenWahl`/`Groessenkachel`: Die Kachel hat
 * keinen Platz für die Marke „günstigster Kilopreis", ist 88 px hoch statt
 * 58 px, streicht bei „derzeit aus" den Preis statt den Kilopreis zu ersetzen,
 * und ihre Gruppe trägt ein aria-label statt fieldset/legend (Bericht 123).
 */
export function FutterKarte({ angebot, jetzt }: { angebot: FutterAngebot; jetzt: string }): React.JSX.Element {
  const [gewaehlt, setGewaehlt] = useState(angebot.vorgewaehlt)
  const groesse = angebot.groessen.find((g) => g.id === gewaehlt) ?? angebot.groessen[0]
  return (
    <article aria-label={angebot.name} className={cn(KARTE, 'flex flex-col gap-3 px-4 py-3.5')}>
      <div className="flex items-start gap-3">
        <Vorschaubild
          foto={angebot.bild.foto}
          ausschnitt={angebot.bild.ausschnitt}
          illustration={angebot.bild.illustration}
          sizes="48px"
          gedaempft={false}
          className="size-12 rounded-[10px] dark:ring-1 dark:ring-border"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="line-clamp-2 text-[14.5px] font-semibold break-words text-foreground" title={angebot.name}>
            {angebot.name}
          </h2>
          <div className="flex min-w-0 flex-col">
            <HofKopf hof={angebot.hof} als="p" />
          </div>
          <Abholzeile fenster={angebot.abholfenster} isPaused={false} jetzt={jetzt} />
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        {angebot.schild && <FutterSchild text={angebot.schild} />}
        {angebot.grundpreis && (
          <p className="ml-auto text-right">
            <span className="block text-[11px] text-muted-foreground">{FUTTER_KARTE_TEXT.grundpreis}</span>
            <span className="text-[13.5px] font-semibold text-foreground tabular-nums">{angebot.grundpreis}</span>
          </p>
        )}
      </div>

      {angebot.abholhinweise.length > 0 && <AbholhinweisZeile hinweise={angebot.abholhinweise} />}

      {angebot.groessen.length > 1 ? (
        <GroessenRadios angebot={angebot} gewaehlt={groesse.id} onWahl={setGewaehlt} />
      ) : (
        <p className="text-[12.5px] text-muted-foreground tabular-nums">
          {[groesse.name, groesse.preis, groesse.kilopreis].filter(Boolean).join(' · ')}
        </p>
      )}

      <Link href={groesse.kaufLink} className={cn(KNOPF_GRUEN, 'min-h-12 w-full text-[14px]')}>
        {bestellenText(angebot, groesse)}
        <span className="sr-only">: {angebot.name}</span>
      </Link>
    </article>
  )
}

/** Die Größen als Radiogruppe: zwei Spalten, je Feld mindestens 58 px; „derzeit aus" nicht wählbar. */
function GroessenRadios({
  angebot,
  gewaehlt,
  onWahl,
}: {
  angebot: FutterAngebot
  gewaehlt: string
  onWahl: (id: string) => void
}): React.JSX.Element {
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{FUTTER_KARTE_TEXT.groesse}</legend>
      <div className="grid grid-cols-2 gap-2 pt-2">
        {angebot.groessen.map((g) => (
          <GroessenFeld key={g.id} groesse={g} name={name} gewaehlt={g.id === gewaehlt} onWahl={onWahl} />
        ))}
      </div>
    </fieldset>
  )
}

function GroessenFeld({
  groesse,
  name,
  gewaehlt,
  onWahl,
}: {
  groesse: FutterGroesse
  name: string
  gewaehlt: boolean
  onWahl: (id: string) => void
}): React.JSX.Element {
  return (
    <label
      className={cn(
        'relative flex min-h-[58px] min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors duration-[250ms]',
        groesse.kaufbar ? 'cursor-pointer hover:bg-muted' : 'cursor-not-allowed bg-muted',
        gewaehlt ? 'border-[1.5px] border-accent bg-accent/12 hover:bg-accent/12' : 'border-border',
        // Der Fokus liegt auf dem verborgenen Radioknopf — sichtbar wird er am Feld.
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-solid'
      )}
    >
      <input
        type="radio"
        name={name}
        value={groesse.id}
        checked={gewaehlt}
        disabled={!groesse.kaufbar}
        onChange={() => onWahl(groesse.id)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-[18px] shrink-0 items-center justify-center rounded-full border-2',
          gewaehlt ? 'border-status-fertig' : 'border-muted-foreground'
        )}
      >
        {gewaehlt && <span className="size-2 rounded-full bg-status-fertig" />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12.5px] font-semibold text-foreground" title={groesse.name}>
          {groesse.name}
        </span>
        <span className="text-[12.5px] font-semibold text-foreground tabular-nums">{groesse.preis}</span>
        <span className="text-[11.5px] text-muted-foreground tabular-nums">
          {groesse.kaufbar ? groesse.kilopreis : FUTTER_KARTE_TEXT.derzeitAus}
        </span>
      </span>
      {groesse.guenstigster && (
        <Marke art="erledigt" className="absolute -top-2.5 right-2 px-2 text-[10.5px]">
          {FUTTER_KARTE_TEXT.guenstigster}
        </Marke>
      )}
    </label>
  )
}
