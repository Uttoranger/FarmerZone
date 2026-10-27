import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Marke } from '@/components/ui/marke'
import { KARTE, KICKER, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { HEUTE_TEXT, WAS_TUN, type AufgabeBereich, type WasTun } from '@/lib/admin-aufgaben'
import { NotbremseFreigeben } from '@/components/admin/heute-notbremse'

/** Ein Eintrag fertig für die Anzeige — Frist schon als Text (die Seite rechnet mit ihrer Uhr). */
export type BrauchtDichEintrag = {
  schluessel: string
  bereich: AufgabeBereich
  titel: string
  frist: string
  ueberfaellig: boolean
  bezug: string
  satz: string
  wasTun: WasTun
  ziel: string
}

/**
 * „Braucht dich“ auf Admin › Heute (Register N32, Nr. 185; Mockups
 * admin-heute, mobil-admin-heute): eine Liste aus allen Quellen, nach Frist
 * sortiert. „überfällig“ steht als Wort in einer Marke (tun), nie nur als
 * Farbe; je Eintrag EIN Knopf aus WAS_TUN — ein Link, nur „Freigeben“ der
 * Notbremse (Nr. 189) ist eine Aktion mit Passkey.
 */
export function HeuteBrauchtDich({ eintraege, zahl }: { eintraege: readonly BrauchtDichEintrag[]; zahl: string }): React.JSX.Element {
  return (
    <section aria-labelledby="braucht-dich" className={cn(KARTE, 'flex min-w-0 flex-col p-4 md:p-5')}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 pb-2">
        <h2 id="braucht-dich" className="font-heading text-[19px] font-semibold text-foreground">
          {HEUTE_TEXT.brauchtDich}
        </h2>
        <span className={cn('text-[13px]', LEISE)}>{zahl}</span>
      </div>
      {eintraege.length === 0 ? (
        <p className={cn('py-3 text-[14px]', LEISE)}>{HEUTE_TEXT.leer}</p>
      ) : (
        <ul>
          {eintraege.map((e) => (
            <li key={e.schluessel} className="flex flex-col gap-2 border-t border-border py-3.5 first:border-t-0 md:flex-row md:items-center md:gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className={KICKER}>{e.bereich}</span>
                  <span className="text-[15px] font-semibold break-words text-foreground">{e.titel}</span>
                  {e.ueberfaellig ? (
                    <Marke art="tun">{e.frist}</Marke>
                  ) : (
                    <span className={cn('text-[12.5px]', LEISE)}>{e.frist}</span>
                  )}
                </div>
                <p className={cn('mt-0.5 text-[13px] break-words', LEISE)}>{e.bezug}</p>
                <p className="mt-1 text-[13.5px] leading-snug text-foreground">{e.satz}</p>
              </div>
              {e.wasTun === 'freigeben' ? (
                <NotbremseFreigeben text={WAS_TUN.freigeben} className="self-start md:self-center" />
              ) : (
                <Link href={e.ziel} className={cn(KNOPF_RAHMEN, 'self-start md:self-center')}>
                  {WAS_TUN[e.wasTun]}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className={cn('border-t border-border pt-3 text-[12.5px] leading-relaxed', LEISE)}>{HEUTE_TEXT.regel}</p>
    </section>
  )
}
