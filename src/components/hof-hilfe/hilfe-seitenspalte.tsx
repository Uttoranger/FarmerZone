import Link from 'next/link'
import { ChevronRight, Mail } from 'lucide-react'
import { MEINE_MELDUNGEN_HREF } from '@/lib/hof-hilfe'
import { KARTE, KNOPF_RAHMEN, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'

/*
 * Die Seitenspalte von „Hilfe und Rückmeldung" ab 1024 px (Nachtlauf Nr. 22e,
 * Mockup web-h6-meldung-abgeben): „Deine Meldungen" mit Offen/Beantwortet und
 * dem Weg zu „Meine Meldungen", darunter der Kontakt per E-Mail.
 *
 * Im Mockup steht dort „Lieber reden? — Rückruf anfordern". Ein Rückruf ist
 * nicht freigegeben (Register O5, kein Schema `RueckrufAnfrage`); der
 * vereinbarte Ersatz ist „E-Mail schreiben" an die Support-Adresse.
 */

export function HilfeSeitenspalte({
  stand,
  mailto,
}: {
  /** null = der Stand ließ sich nicht laden; der Weg zu den Meldungen bleibt. */
  stand: { offen: number; beantwortet: number } | null
  mailto: string
}): React.JSX.Element {
  return (
    <aside aria-label="Deine Meldungen und Kontakt" className="flex flex-col gap-3">
      <section aria-labelledby="hilfe-deine-meldungen" className={cn(KARTE, 'flex flex-col gap-3 px-[18px] py-4')}>
        <h2 id="hilfe-deine-meldungen" className="font-heading text-[17px] font-semibold text-foreground">
          Deine Meldungen
        </h2>
        {stand ? (
          <dl className="flex flex-col gap-2.5 text-[13.5px]">
            <div className="flex items-baseline gap-2">
              <dt className="flex-1 text-muted-foreground">Offen</dt>
              <dd className="text-foreground tabular-nums">{stand.offen}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="flex-1 text-muted-foreground">Beantwortet</dt>
              <dd className="text-foreground tabular-nums">{stand.beantwortet}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-[13px] text-muted-foreground">Den Stand konnten wir gerade nicht laden.</p>
        )}
        <Link href={MEINE_MELDUNGEN_HREF} className={cn(TEXT_GRUEN, 'self-center')}>
          Alle ansehen
          <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </Link>
      </section>

      <section aria-labelledby="hilfe-email" className={cn(KARTE, 'flex flex-col gap-3 px-[18px] py-4')}>
        <h2 id="hilfe-email" className="font-heading text-[17px] font-semibold text-foreground">
          Lieber per E-Mail?
        </h2>
        <p className="text-[13px] leading-normal text-muted-foreground">Schreib uns direkt — wir antworten dir so bald wie möglich.</p>
        <a href={mailto} className={KNOPF_RAHMEN}>
          <Mail className="size-4" strokeWidth={1.7} aria-hidden="true" />
          E-Mail schreiben
        </a>
      </section>
    </aside>
  )
}
