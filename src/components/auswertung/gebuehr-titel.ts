import { gebuehrWortFuerZeitraum, hofpreisModellAb, type HofpreisEinstellung } from '@/lib/plattformgebuehr'
import { zeitraumImSatz, type Periodenfenster } from '@/lib/umsatz'

/*
 * Wörter der Auswertung für den gewählten Zeitraum (Nr. 251, Liste Lauf 32 auswertung) — reine
 * Anzeige, ohne Rechnung: der Wochen-Zeitraum mit ausgeschriebenem Monat und der Titel der
 * Gebühren-Karte. Eigene Datei, weil eine Seite unter app/ nur ihre Next-Exporte haben darf.
 */
const MONAT_LANG = new Intl.DateTimeFormat('de-AT', { month: 'long', timeZone: 'UTC' })

/** „2.–8. November“, über die Monatsgrenze „30. November – 6. Dezember“ (Wiener Kalendertage aus dem Fenster). */
export function wocheAusgeschrieben(pf: Periodenfenster): string {
  const tag = (iso: string) => {
    const [j, m, t] = iso.split('-').map(Number)
    const datum = new Date(Date.UTC(j, m - 1, t))
    return { t, monat: MONAT_LANG.format(datum) }
  }
  const [j, m, t] = pf.startTag.split('-').map(Number)
  const ende = new Date(Date.UTC(j, m - 1, t + 6)).toISOString().slice(0, 10)
  const a = tag(pf.startTag)
  const b = tag(ende)
  return a.monat === b.monat ? `${a.t}.–${b.t}. ${b.monat}` : `${a.t}. ${a.monat} – ${b.t}. ${b.monat}`
}

/**
 * Titel der Gebühren-Karte für den gewählten Zeitraum (Liste Lauf 32 auswertung): „Plattformgebühr im
 * Februar“, „… diese Woche“, „… im Jahr 2027“. Das Wort aus `gebuehrWortFuerZeitraum` über die ganze
 * Periode und den Stichtag „Hofpreis-Modell ab“ — keine zweite Datumsregel.
 */
export function gebuehrTitel(pf: Periodenfenster, einstellung: HofpreisEinstellung | null): string {
  const wort = gebuehrWortFuerZeitraum(pf.aktuellGanz.von, pf.aktuellGanz.bis, hofpreisModellAb(einstellung))
  if (pf.periode === 'woche') return `${wort} ${pf.laufend ? 'diese Woche' : wocheAusgeschrieben(pf)}`
  return `${wort} ${zeitraumImSatz(pf)}`
}
