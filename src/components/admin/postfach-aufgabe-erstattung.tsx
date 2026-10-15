import { ExternalLink } from 'lucide-react'
import { EINGANG_TEXT, type ErstattungAufgabeRoh } from '@/lib/postfach'
import { formatEuro } from '@/lib/format'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { wienKalendertag } from '@/lib/kalender'
import { datumKurz } from '@/lib/verkauf-eintragen'
import { cn } from '@/lib/utils'
import { KICKER, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'

/**
 * Die Aufgabe „Erstattung offen" im Eingang (Register N14, Nr. 95; Mockup
 * admin-postfach): Beträge nur anzeigen, erstattet wird im bestehenden Weg
 * (Stripe). Gezeigt wird, was die Bestellung hergibt („online bezahlt",
 * stornoBetraege) — der offene Betrag und die Handanweisung je Weg sind nicht
 * gespeichert; der Satz darunter verweist auf die Mail mit genau ihrem
 * Betreff (EINGANG_TEXT.erstattungKopf, dieselbe Quelle wie sendErstattungOffen).
 * „Zur Bestellung" führt zur Zahlung im Stripe-Dashboard des laufenden
 * Modus; ohne Kennung steht der Ausweg da.
 */
export function PostfachErstattungSpalte({
  e,
  zahlungAdresse,
  jetzt,
}: {
  e: ErstattungAufgabeRoh
  zahlungAdresse: string | null
  jetzt: Date
}): React.JSX.Element {
  const betreff = EINGANG_TEXT.erstattungKopf(e.bestellnummer)
  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      <div className="min-w-0">
        <p className={KICKER}>{EINGANG_TEXT.aufgabe}</p>
        <h2 className="mt-1 font-heading text-[19px] leading-snug font-semibold break-words text-foreground">{betreff}</h2>
        <p className={cn('mt-0.5 text-[13px] break-words', LEISE)}>{EINGANG_TEXT.offenSeit(e.hofName, datumKurz(wienKalendertag(e.seit), wienKalendertag(jetzt)))}</p>
      </div>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 text-[14px] [&>dd]:border-t [&>dd]:border-border [&>dd]:py-2 [&>dt]:border-t [&>dt]:border-border [&>dt]:py-2">
        <dt className={LEISE}>{EINGANG_TEXT.bezahlt}</dt>
        <dd className="text-right font-semibold text-foreground tabular-nums">{e.bezahltCents === null ? '–' : formatEuro(centsAlsEuro(e.bezahltCents))}</dd>
        {e.schonErstattetCents > 0 && (
          <>
            <dt className={LEISE}>{EINGANG_TEXT.schonErstattet}</dt>
            <dd className="text-right text-foreground tabular-nums">{formatEuro(centsAlsEuro(e.schonErstattetCents))}</dd>
          </>
        )}
      </dl>
      <p className="text-[14px] leading-relaxed text-foreground">{EINGANG_TEXT.erstattungMail(betreff)}</p>
      <p className={cn('text-[13px] leading-relaxed', LEISE)}>{EINGANG_TEXT.erstattungAnweisung}</p>
      {zahlungAdresse ? (
        <a href={zahlungAdresse} target="_blank" rel="noopener noreferrer" className={cn(KNOPF_RAHMEN, 'self-start')}>
          {EINGANG_TEXT.zurBestellung}
          <ExternalLink className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </a>
      ) : (
        <p className={cn('text-[13px]', LEISE)}>{EINGANG_TEXT.ohneZahlung}</p>
      )}
    </div>
  )
}
