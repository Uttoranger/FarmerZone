import { datumLang } from '@/lib/heute'
import { MEIN_HOF_KOPF_TEXT } from '@/lib/mein-hof'
import { cn } from '@/lib/utils'

/**
 * Die Zeile unter der Überschrift der Hof-Werkzeuge (Lauf 31, Nr. 238; Boards s1-/w1-einstellungen,
 * s1-/w1-region, s2-/w2-auswertung, -kunden, -verkaeufe, -postfach, -meldungen): am Handy
 * „<Hof> · Stand <Wochentag, Datum>“ wie im Kopf von Mein Hof (derselbe Text aus
 * `MEIN_HOF_KOPF_TEXT.unterzeile`), ab 768 px nur der Hofname. Nie gekürzt — ein langer Name
 * bricht um.
 *
 * Steht hier, weil `src/components/ui/` nicht in der Grenze von Nr. 238 lag; zusammen mit dem
 * festen Kopf am Handy (Zurück, Titel, diese Zeile) gehört sie als Baustein nach ui/ (Bericht 238,
 * „Bedarf ui/“).
 */
export function HofUnterzeile({ hofName, jetzt, className }: { hofName: string; jetzt: Date; className?: string }): React.JSX.Element {
  return (
    <p className={cn('text-[13px] leading-snug break-words text-muted-foreground md:text-sm', className)} data-hof-unterzeile="">
      <span className="md:hidden">{MEIN_HOF_KOPF_TEXT.unterzeile(hofName, datumLang(jetzt))}</span>
      <span className="hidden md:inline">{hofName}</span>
    </p>
  )
}
