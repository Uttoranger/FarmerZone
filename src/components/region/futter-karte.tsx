'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { KARTE, KNOPF_GRUEN } from '@/components/hof-bestellungen/stil'
import { Abholzeile } from '@/components/hoefe/abholzeile'
import { Vorschaubild } from '@/components/hoefe/hof-vorschaubild'
import { FutterSchild } from '@/components/produkte/futter-schild'
import { Groessenkachel, GroessenWahl } from '@/components/ui/groessenkachel'
import { FUTTER_KARTE_TEXT, bestellenText, type FutterAngebot, type FutterGroesse } from '@/lib/futter-kaufen'
import { ABHOLHINWEIS_TEXT } from '@/lib/abholhinweise'
import { hofMitEntfernung } from '@/lib/umfeld'

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
 * Seit Nr. 272 (Board s1-/w1-region Bild 2, Liste Lauf 32 region „Futterkarte
 * anders, ohne Größenwahl“): Titel ist das Produkt, darunter „Hof · km“ (ohne
 * PLZ und Ort), die Abholzeile mit den Abholhinweisen dahinter (Wortlaut nach
 * N23), „ab € … / kg“ fett mit dem Schild (E9), „Größe“ und die Größen als
 * Optionen über die Größenkachel G5 (`GroessenWahl form="zeile"`: Radio links,
 * Name, darunter der Kilopreis bzw. „gerade nicht da“, Preis rechts; eine leere
 * Größe zeigt ihren Preis und ist nicht wählbar). Die Marke „günstigster
 * Kilopreis“ entfällt mit der Kachel (das Board zeigt sie nicht).
 */
export function FutterKarte({ angebot, jetzt }: { angebot: FutterAngebot; jetzt: string }): React.JSX.Element {
  const [gewaehlt, setGewaehlt] = useState(angebot.vorgewaehlt)
  const groesse = angebot.groessen.find((g) => g.id === gewaehlt) ?? angebot.groessen[0]
  return (
    <article aria-label={angebot.name} className={cn(KARTE, 'flex flex-col gap-2.5 px-4 py-3.5')}>
      <div className="flex items-start gap-3">
        <Vorschaubild
          foto={angebot.bild.foto}
          ausschnitt={angebot.bild.ausschnitt}
          illustration={angebot.bild.illustration}
          sizes="48px"
          gedaempft={false}
          className="size-12 rounded-[10px] dark:ring-1 dark:ring-border"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="line-clamp-2 text-[15px] font-semibold break-words text-foreground" title={angebot.name}>
            {angebot.name}
          </h2>
          <p className="truncate text-[14px] text-foreground tabular-nums" title={`${angebot.hof.name}, ${angebot.hof.postalCode} ${angebot.hof.city}`}>
            {hofMitEntfernung(angebot.hof)}
          </p>
        </div>
      </div>

      <FutterAbholung angebot={angebot} jetzt={jetzt} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {angebot.grundpreis && <p className="text-[14px] font-semibold text-foreground tabular-nums">{angebot.grundpreis}</p>}
        {angebot.schild && <FutterSchild text={angebot.schild} />}
      </div>

      {angebot.groessen.length > 1 ? (
        <FutterGroessen groessen={angebot.groessen} gewaehlt={groesse.id} onWahl={setGewaehlt} />
      ) : (
        <p className="text-[13px] text-muted-foreground tabular-nums">
          {/* Heißt die Größe wie das Angebot (Einzelprodukt), steht der Name nicht ein zweites Mal da. */}
          {[groesse.name !== angebot.name ? groesse.name : null, groesse.preis, groesse.kilopreis].filter(Boolean).join(' · ')}
        </p>
      )}

      <Link href={groesse.kaufLink} className={cn(KNOPF_GRUEN, 'min-h-12 w-full text-[15px]')}>
        {bestellenText(angebot, groesse)}
        <span className="sr-only">: {angebot.name}</span>
      </Link>
    </article>
  )
}

/**
 * Die Abholzeile mit den Abholhinweisen dahinter, leise wie im Board („Abholung Sa, 6. März, 9–12 Uhr · …“).
 * Die Hinweise tragen den Wortlaut des Registers (N23: „Anhänger nötig“, „Verladen mit Frontlader“, „Abholung nach
 * Absprache“); gilt einer nur für einzelne Größen, stehen sie davor.
 */
export function FutterAbholung({ angebot, jetzt }: { angebot: Pick<FutterAngebot, 'abholfenster' | 'abholhinweise'>; jetzt: string }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1 text-[13px] leading-snug text-muted-foreground">
      <Abholzeile fenster={angebot.abholfenster} isPaused={false} jetzt={jetzt} className="font-normal text-muted-foreground" />
      {angebot.abholhinweise.map(({ hinweis, groessen }) => (
        <span key={hinweis}>
          <span aria-hidden="true">· </span>
          {groessen ? `${groessen}: ${ABHOLHINWEIS_TEXT[hinweis]}` : ABHOLHINWEIS_TEXT[hinweis]}
        </span>
      ))}
    </div>
  )
}

/** Die Größen als Optionen über die Größenkachel (G5, Variante „zeile“) — mit sichtbarem „Größe“ darüber. */
export function FutterGroessen({
  groessen,
  gewaehlt,
  onWahl,
}: {
  groessen: readonly FutterGroesse[]
  gewaehlt: string
  onWahl: (id: string) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p aria-hidden="true" className="text-[14px] font-semibold text-foreground">
        {FUTTER_KARTE_TEXT.groesse}
      </p>
      <GroessenWahl beschriftung={FUTTER_KARTE_TEXT.groesse} wert={gewaehlt} onWertChange={onWahl} form="zeile">
        {groessen.map((g) => (
          <Groessenkachel
            key={g.id}
            wert={g.id}
            name={g.name}
            preis={g.preis}
            grundpreis={g.kilopreis ?? undefined}
            zustand={g.kaufbar ? 'normal' : 'ausverkauft'}
            form="zeile"
          />
        ))}
      </GroessenWahl>
    </div>
  )
}
