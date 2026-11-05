import { cn } from '@/lib/utils'
import { Marke } from '@/components/ui/marke'
import { LEISE } from '@/components/hof-bestellungen/stil'
import { STAND_MARKE, STAND_TEXT, type AblaufZeile } from '@/lib/betrieb'
import { HEUTE_TEXT, type KommtEintrag, type ProtokollZeile } from '@/lib/admin-aufgaben'

/*
 * Die Inhalte der Karten rechts auf Admin › Heute (Nr. 185; Mockups
 * admin-heute, mobil-admin-heute): „Läuft von selbst“, „Kommt“ und „Zuletzt
 * im Protokoll“. Die Seite legt sie ab 1024 px in offene Karten, am Handy in
 * Klappkarten — der Inhalt ist derselbe.
 */

const ZEILE = 'flex items-center gap-3 border-t border-border py-2.5 first:border-t-0'

/**
 * Die Abläufe mit Stand. `nichtEingerichtet`: das Wort für den Uptime-Dienst
 * ohne je einen Aufruf (NOCH_NICHT_EINGERICHTET aus Admin › Betrieb) statt
 * „noch kein Lauf“.
 */
export function HeuteLaeuft({ zeilen, nichtEingerichtet }: { zeilen: readonly AblaufZeile[]; nichtEingerichtet: string }): React.JSX.Element {
  return (
    <ul>
      {zeilen.map((z) => (
        <li key={z.name} className={ZEILE}>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] font-semibold text-foreground">{z.text}</span>
            <span className={cn('text-[12.5px]', LEISE)}>{`${z.wann} · zuletzt ${z.zuletzt}`}</span>
          </span>
          <Marke art={STAND_MARKE[z.stand]}>{z.name === 'von-aussen' && z.stand === 'nochKeinLauf' ? nichtEingerichtet : STAND_TEXT[z.stand]}</Marke>
        </li>
      ))}
    </ul>
  )
}

export function HeuteKommt({ eintraege }: { eintraege: readonly KommtEintrag[] }): React.JSX.Element {
  if (eintraege.length === 0) return <p className={cn('text-[13.5px]', LEISE)}>{HEUTE_TEXT.kommtLeer}</p>
  return (
    <ul>
      {eintraege.map((e) => (
        <li key={`${e.kalendertag}-${e.titel}`} className={ZEILE}>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[14px] font-semibold text-foreground">{e.titel}</span>
            <span className={cn('text-[12.5px]', LEISE)}>{e.wann}</span>
          </span>
          <Marke art={e.marke.art}>{e.marke.wort}</Marke>
        </li>
      ))}
    </ul>
  )
}

/** Je Eintrag links leise „Wann · Wer“, rechts was getan wurde (Board w3-admin-heute; Wer nur Du/Team/System, N33). */
export function HeuteProtokoll({ zeilen }: { zeilen: readonly ProtokollZeile[] }): React.JSX.Element {
  if (zeilen.length === 0) return <p className={cn('text-[13.5px]', LEISE)}>{HEUTE_TEXT.protokollLeer}</p>
  return (
    <ul>
      {zeilen.map((z, i) => (
        <li key={i} className={ZEILE}>
          <span className={cn('shrink-0 text-[13.5px]', LEISE)}>{protokollWannWer(z)}</span>
          <span className="min-w-0 flex-1 text-right text-[13.5px] break-words text-foreground">{z.text}</span>
        </li>
      ))}
    </ul>
  )
}

/** „heute, 08:31 · Du“ — dieselbe Zeile in der Karte und in der Klappkarte am Handy. */
export function protokollWannWer(z: Pick<ProtokollZeile, 'wann' | 'wer'>): string {
  return `${z.wann} · ${z.wer}`
}
