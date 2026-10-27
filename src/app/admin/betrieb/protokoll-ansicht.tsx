import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'
import { Download, ScrollText } from 'lucide-react'
import { ladeProtokoll } from '@/server/queries/admin-protokoll'
import { ADMIN_BETRIEB_PROTOKOLL_HREF, BETRIEB_TEXT } from '@/lib/betrieb'
import { PROTOKOLL_TAGE, PROTOKOLL_WER, type ProtokollFilter } from '@/schemas/betrieb-mails'
import { cn } from '@/lib/utils'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FELD, FELD_LABEL, KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { BetriebUnterreiter } from './betrieb-teile'
import { PROTOKOLL_TEXT, protokollArtWahl, protokollExportAdresse, protokollZeilen, type ProtokollZeile } from './protokoll'

function Auswahl({ id, name, label, wert, optionen }: { id: string; name: string; label: string; wert: string; optionen: ReadonlyArray<{ wert: string; text: string }> }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className={FELD_LABEL}>
        {label}
      </label>
      <select id={id} name={name} defaultValue={wert} className={cn(FELD, 'min-h-11 pr-8')}>
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>
            {o.text}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Filter als EIN Formular (GET, ohne Skript): Wer · Art · Zeitraum · nur mit Passkey · Bezug (Mockup admin-protokoll). */
function Filter({ f }: { f: ProtokollFilter }): React.JSX.Element {
  return (
    <form method="get" action="/admin/betrieb" aria-label={PROTOKOLL_TEXT.filterBeschriftung} className={cn(KARTE, 'flex flex-col gap-3 p-3.5 md:p-4')}>
      <input type="hidden" name="reiter" value="protokoll" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Auswahl id="protokoll-wer" name="wer" label={PROTOKOLL_TEXT.wer} wert={f.wer} optionen={PROTOKOLL_WER.map((w) => ({ wert: w, text: PROTOKOLL_TEXT.werLabel[w] }))} />
        <Auswahl id="protokoll-art" name="art" label={PROTOKOLL_TEXT.art} wert={f.art} optionen={[{ wert: 'alle', text: PROTOKOLL_TEXT.artAlle }, ...protokollArtWahl()]} />
        <Auswahl id="protokoll-tage" name="tage" label={PROTOKOLL_TEXT.zeitraum} wert={String(f.tage)} optionen={PROTOKOLL_TAGE.map((t) => ({ wert: String(t), text: PROTOKOLL_TEXT.tageLabel(t) }))} />
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor="protokoll-bezug" className={FELD_LABEL}>
            {PROTOKOLL_TEXT.bezug}
          </label>
          <input
            id="protokoll-bezug"
            name="bezug"
            type="search"
            defaultValue={f.bezug}
            autoComplete="off"
            spellCheck={false}
            aria-describedby="protokoll-bezug-hilfe"
            className={cn(FELD, 'min-h-11')}
          />
          <span id="protokoll-bezug-hilfe" className={cn('text-[12px]', LEISE)}>
            {PROTOKOLL_TEXT.bezugHilfe}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="inline-flex min-h-11 items-center gap-2 text-[13.5px] text-foreground">
          <input type="checkbox" name="passkey" value="1" defaultChecked={f.nurPasskey} className="size-5 accent-primary" />
          {PROTOKOLL_TEXT.nurPasskey}
        </label>
        <button type="submit" className={cn(KNOPF_RAHMEN, 'font-semibold')}>
          {PROTOKOLL_TEXT.anwenden}
        </button>
      </div>
    </form>
  )
}

/** Die Tabelle (Mockup admin-protokoll); scrollt am Handy in ihrem Kasten (Tastatur: region mit Fokus). */
function Tabelle({ zeilen, titel }: { zeilen: readonly ProtokollZeile[]; titel: string }): React.JSX.Element {
  const S = PROTOKOLL_TEXT.spalten
  return (
    <div role="region" aria-label={titel} tabIndex={0} className={cn(KARTE, 'overflow-x-auto dark:ring-1 dark:ring-border', FOKUS_RAHMEN)}>
      <table className="w-full min-w-[720px] text-left text-[13.5px]">
        <caption className="sr-only">{titel}</caption>
        <thead>
          <tr className={cn('border-b border-border text-[12px] font-semibold', LEISE)}>
            <th scope="col" className="px-3.5 py-2.5 font-semibold">
              {S.wann}
            </th>
            <th scope="col" className="px-3.5 py-2.5 font-semibold">
              {S.wer}
            </th>
            <th scope="col" className="px-3.5 py-2.5 font-semibold">
              {S.was}
            </th>
            <th scope="col" className="px-3.5 py-2.5 font-semibold">
              {S.bezug}
            </th>
            <th scope="col" className="px-3.5 py-2.5 font-semibold">
              {S.grund}
            </th>
            <th scope="col" className="px-3.5 py-2.5 font-semibold">
              {S.passkey}
            </th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.id} className="border-b border-border last:border-b-0">
              <td className="px-3.5 py-2.5 whitespace-nowrap tabular-nums">{z.wann}</td>
              <td className="px-3.5 py-2.5">{z.wer}</td>
              <th scope="row" className="px-3.5 py-2.5 font-semibold text-foreground">
                {z.was}
              </th>
              <td className="max-w-[16rem] px-3.5 py-2.5 break-words">{z.bezug}</td>
              <td className="max-w-[20rem] px-3.5 py-2.5 break-words">{z.grund ?? PROTOKOLL_TEXT.ohne}</td>
              <td className="px-3.5 py-2.5 whitespace-nowrap">
                {z.mitPasskey ? (
                  PROTOKOLL_TEXT.bestaetigt
                ) : (
                  <>
                    <span aria-hidden="true">{PROTOKOLL_TEXT.ohne}</span>
                    <span className="sr-only">{PROTOKOLL_TEXT.ohneSr}</span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/*
 * Admin › Betrieb › Protokoll (Register N33, Nr. 193; Mockup admin-protokoll):
 * Filter, Tabelle der letzten Einträge (höchstens 100, neueste zuerst) und
 * „CSV mit Passkey“ (Route mit frischer Bestätigung). Recht „ansehen“ — die
 * Seite hat es mit verlangeAdminSeite schon geprüft. Nur lesend; Wer ist
 * „System“, „Du“ oder „Team“, der Bezug Hofname, Bestellnummer oder Kennung —
 * nie eine Adresse. Scheitert das Laden, steht AdminFehler da.
 */
export async function ProtokollAnsicht({ f, ich, jetzt, mailsOffen }: { f: ProtokollFilter; ich: string; jetzt: Date; mailsOffen: number | null }): Promise<React.JSX.Element> {
  let geladen: Awaited<ReturnType<typeof ladeProtokoll>> | null = null
  try {
    geladen = await ladeProtokoll(f, ich, jetzt)
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'betrieb-protokoll' } })
  }
  if (!geladen) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel={BETRIEB_TEXT.titel} satz={PROTOKOLL_TEXT.ladefehler} nochmal={ADMIN_BETRIEB_PROTOKOLL_HREF} />
      </div>
    )
  }
  const zeilen = protokollZeilen(geladen.zeilen, geladen.namen, ich)
  const titel = PROTOKOLL_TEXT.titel(f.tage)
  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-4 lg:gap-[18px]')}>
      <Seitenkopf titel={BETRIEB_TEXT.titel} satz={PROTOKOLL_TEXT.satz} />
      <BetriebUnterreiter aktiv="protokoll" offen={mailsOffen}>
        <div className="flex flex-col gap-4">
          <Filter f={f} />
          <h2 className="font-heading text-[17px] font-semibold text-foreground">{titel}</h2>
          {zeilen.length === 0 ? (
            <EmptyState
              symbol={ScrollText}
              titel={PROTOKOLL_TEXT.leerTitel}
              satz={PROTOKOLL_TEXT.leerSatz}
              ausweg={
                <Link href={ADMIN_BETRIEB_PROTOKOLL_HREF} className={cn('inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted', FOKUS_RAHMEN)}>
                  {PROTOKOLL_TEXT.leerFilter}
                </Link>
              }
            />
          ) : (
            <Tabelle zeilen={zeilen} titel={titel} />
          )}
          <p className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] leading-snug', LEISE)}>
            <span>{PROTOKOLL_TEXT.zahl(zeilen.length, geladen.gesamt)}</span>
            <a
              href={protokollExportAdresse(f)}
              download
              className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-md font-semibold text-status-fertig underline-offset-2 hover:underline', FOKUS_RAHMEN)}
            >
              <Download className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
              {PROTOKOLL_TEXT.csv}
            </a>
          </p>
          <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{PROTOKOLL_TEXT.regel}</p>
        </div>
      </BetriebUnterreiter>
    </div>
  )
}
