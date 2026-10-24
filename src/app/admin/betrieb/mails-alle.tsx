import * as Sentry from '@sentry/nextjs'
import { ChevronLeft, CircleAlert, Clock, Info, Inbox, X } from 'lucide-react'
import { ADMIN_BETRIEB_HREF, ADMIN_BETRIEB_MAILS_HREF } from '@/lib/betrieb'
import {
  ALLE_MAILS_TEXT,
  MAIL_TEXT,
  STAND_NAME,
  WEG_FILTER_NAME,
  ZEITRAUM_NAME,
  adresseQuelle,
  alleMailZeile,
  alleMailsHref,
  artAuswahl,
  cursorVon,
  filterZeile,
  kannWartenZeile,
  mailDetail,
  maskiereAdresse,
  suchErgebnis,
  type AlleMailZeile,
  type MailDetail,
  type SuchErgebnis,
} from '@/lib/betrieb-mails'
import { uhrzeitInWien } from '@/lib/fristen'
import { cn } from '@/lib/utils'
import { MAIL_STAENDE, MAIL_WEGE, MAIL_ZEITRAEUME, type AlleMailsFilter, type AlleMailsParameter, type MailSuche } from '@/schemas/betrieb-mails'
import { MAIL_WEG } from '@/schemas/mail-auftrag'
import { ladeAlleMails, ladeHofAuswahl, ladeKannWartenSummen, ladeMailDetail, sucheMails, zaehleProbleme } from '@/server/queries/mails'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Marke } from '@/components/ui/marke'
import { Chip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FELD, FELD_LABEL, KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { BetriebUnterreiter, Karte, Klappkarte } from './betrieb-teile'
import { SuchTreffer } from './mails-ansicht'
import { DetailBlatt, NochmalKnopf, VorschauKnopf } from './mails-nochmal'
import { MinutenNachladen } from './minuten-nachladen'

/*
 * Admin › Betrieb › E-Mails › Alle Mails (Register N27, Nr. 167; Mockups
 * admin-betrieb-mails-alle bei 1440 px, mobil-admin-betrieb-mails-alle und
 * mobil-admin-betrieb-mails-nochmal bei 390 px). `?reiter=mails&liste=alle`.
 *
 * Oben Suche (dieselbe Abfrage wie die Übersicht, `sucheMails`) und Filter;
 * darunter die einzelnen Mails (Sofort und Wichtig, neueste zuerst, 50 je
 * Seite) und „Kann warten“ nur als Summe je Beitrag, Rundschreiben oder
 * Bescheid. Die gewählte Mail (`&mail=`) steht am Bildschirm als Seitenleiste
 * rechts, am Handy als Blatt von unten. Angezeigt wird nie eine volle Adresse
 * (nur gekürzt im Detail und in der Suche), nie ein Name, nie ein Inhalt —
 * außer in der Vorschau auf Knopfdruck, dort mit unkenntlichen Links.
 * Entschieden wird nichts hier: Zeilen, Detail und Knopf kommen aus
 * src/lib/betrieb-mails.ts, die Regeln prüft die Action noch einmal.
 */

const LINK = cn('inline-flex min-h-11 items-center rounded-md font-semibold text-status-fertig underline-offset-2 hover:underline', FOKUS_RAHMEN)
const H2 = 'font-heading text-[17px] font-semibold text-foreground'

/** Ein Teil, das nicht geladen werden konnte: nur die Klasse nach Sentry, der Teil zeigt den Satz. */
async function sicher<T>(teil: string, laden: () => Promise<T>): Promise<T | null> {
  try {
    return await laden()
  } catch (err) {
    Sentry.captureException(err, { level: 'warning', tags: { bereich: 'admin', seite: 'betrieb-mails-alle', teil } })
    return null
  }
}

function TeilFehler(): React.JSX.Element {
  return (
    <Hinweiskarte ton="orange" symbol={CircleAlert}>
      {MAIL_TEXT.ladefehler}
    </Hinweiskarte>
  )
}

// ─── Suche und Filter ────────────────────────────────────────────────────────

function SuchForm({ wert }: { wert: string }): React.JSX.Element {
  return (
    <form role="search" action={ADMIN_BETRIEB_HREF} method="get" className="flex min-w-0 flex-1 flex-col gap-1">
      <input type="hidden" name="reiter" value="mails" />
      <input type="hidden" name="liste" value="alle" />
      <label htmlFor="suche-alle" className={FELD_LABEL}>
        {MAIL_TEXT.sucheLabel}
      </label>
      <div className="flex gap-2">
        <input id="suche-alle" name="suche" type="search" defaultValue={wert} autoComplete="off" spellCheck={false} className={cn(FELD, 'min-h-11')} />
        <button type="submit" className={cn(KNOPF_RAHMEN, 'font-semibold')}>
          {MAIL_TEXT.sucheKnopf}
        </button>
      </div>
    </form>
  )
}

function Auswahl({ id, name, label, wert, optionen }: { id: string; name: string; label: string; wert: string; optionen: ReadonlyArray<{ wert: string; name: string }> }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className={FELD_LABEL}>
        {label}
      </label>
      <select id={id} name={name} defaultValue={wert} className={cn(FELD, 'min-h-11 pr-8')}>
        {optionen.map((o) => (
          <option key={o.wert} value={o.wert}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Die Filter als Formular (GET, ohne Skript): Art, Weg, Stand, Zeitraum, Hof, „nur vom Support“. Am Handy in einer Klappkarte. */
function FilterForm({ praefix, f, hoefe }: { praefix: string; f: AlleMailsFilter; hoefe: ReadonlyArray<{ id: string; name: string }> | null }): React.JSX.Element {
  const alle = { wert: '', name: ALLE_MAILS_TEXT.alle }
  return (
    <form action={ADMIN_BETRIEB_HREF} method="get" className="flex flex-col gap-3">
      <input type="hidden" name="reiter" value="mails" />
      <input type="hidden" name="liste" value="alle" />
      <div role="group" aria-label={ALLE_MAILS_TEXT.filter} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Auswahl id={`${praefix}-art`} name="art" label={ALLE_MAILS_TEXT.filterArt} wert={f.art ?? ''} optionen={[alle, ...artAuswahl()]} />
        <Auswahl id={`${praefix}-weg`} name="weg" label={ALLE_MAILS_TEXT.filterWeg} wert={f.weg ?? ''} optionen={[alle, ...MAIL_WEGE.map((w) => ({ wert: w, name: WEG_FILTER_NAME[w] }))]} />
        <Auswahl id={`${praefix}-stand`} name="stand" label={ALLE_MAILS_TEXT.filterStand} wert={f.stand ?? ''} optionen={[alle, ...MAIL_STAENDE.map((s) => ({ wert: s, name: STAND_NAME[s] }))]} />
        <Auswahl id={`${praefix}-zeitraum`} name="zeitraum" label={ALLE_MAILS_TEXT.filterZeitraum} wert={f.zeitraum} optionen={MAIL_ZEITRAEUME.map((z) => ({ wert: z, name: ZEITRAUM_NAME[z] }))} />
        <Auswahl id={`${praefix}-hof`} name="hof" label={ALLE_MAILS_TEXT.filterHof} wert={f.hof ?? ''} optionen={[alle, ...(hoefe ?? []).map((h) => ({ wert: h.id, name: h.name }))]} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="inline-flex min-h-11 items-center gap-2 text-[13.5px] text-foreground">
          <input type="checkbox" name="support" value="1" defaultChecked={f.support} className="size-5 accent-primary" />
          {ALLE_MAILS_TEXT.nurSupport}
        </label>
        <button type="submit" className={cn(KNOPF_RAHMEN, 'font-semibold')}>
          {ALLE_MAILS_TEXT.filterAnwenden}
        </button>
        <a href={alleMailsHref({})} className={cn(LINK, 'text-[13px]')}>
          {ALLE_MAILS_TEXT.filterZuruecksetzen}
        </a>
      </div>
    </form>
  )
}

// ─── Liste ───────────────────────────────────────────────────────────────────

function SupportZeichen(): React.JSX.Element {
  return <Chip className="font-semibold">{ALLE_MAILS_TEXT.vomSupport}</Chip>
}

function ListeTabelle({ zeilen, gewaehlt, href }: { zeilen: readonly AlleMailZeile[]; gewaehlt: string | null; href: (id: string) => string }): React.JSX.Element {
  const s = ALLE_MAILS_TEXT.spalten
  const zelle = 'px-3 py-2.5 align-top'
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[13px]">
        <caption className="sr-only">{ALLE_MAILS_TEXT.listeCaption}</caption>
        <thead>
          <tr className={cn('border-b border-border text-[12px]', LEISE)}>
            {[s.zeit, s.art, s.weg, s.bezug, s.stand].map((t) => (
              <th key={t} scope="col" className="px-3 py-2 text-left font-semibold">
                {t}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 text-right font-semibold">
              {s.versuche}
            </th>
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              {s.support}
            </th>
          </tr>
        </thead>
        <tbody>
          {zeilen.map((z) => (
            <tr key={z.id} className={cn('border-b border-border last:border-0', gewaehlt === z.id && 'bg-muted')}>
              <td className={cn(zelle, 'whitespace-nowrap tabular-nums', LEISE)}>{z.zeit}</td>
              <th scope="row" className={cn(zelle, 'text-left font-semibold')}>
                <a href={href(z.id)} aria-current={gewaehlt === z.id ? 'true' : undefined} className={cn('rounded-sm text-foreground underline-offset-2 hover:underline', FOKUS_RAHMEN)}>
                  {z.name}
                </a>
                {z.hinweis && <span className={cn('block text-[12px] font-normal', LEISE)}>{z.hinweis}</span>}
              </th>
              <td className={cn(zelle, LEISE)}>{z.weg}</td>
              <td className={cn(zelle, 'tabular-nums')}>{z.bezug}</td>
              <td className={zelle}>
                <Marke art={z.stand.art}>{z.stand.wort}</Marke>
              </td>
              <td className={cn(zelle, 'text-right tabular-nums')}>{z.versuche}</td>
              <td className={zelle}>{z.vomSupport ? <SupportZeichen /> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ListeKarten({ zeilen, gewaehlt, href }: { zeilen: readonly AlleMailZeile[]; gewaehlt: string | null; href: (id: string) => string }): React.JSX.Element {
  return (
    <ul className="flex flex-col gap-2">
      {zeilen.map((z) => (
        <li key={z.id}>
          <a
            href={href(z.id)}
            aria-current={gewaehlt === z.id ? 'true' : undefined}
            className={cn(KARTE, 'flex min-h-11 min-w-0 items-start gap-3 p-3.5 aria-[current=true]:border-primary/60', FOKUS_RAHMEN)}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-foreground">{z.name}</span>
              <span className={cn('text-[12.5px] leading-snug', LEISE)}>
                {z.weg} · {z.bezug} · {z.zeit}
                {z.vomSupport ? ` · ${ALLE_MAILS_TEXT.vomSupport}` : ''}
              </span>
              {z.hinweis && <span className={cn('text-[12px] leading-snug', LEISE)}>{z.hinweis}</span>}
            </span>
            <Marke art={z.stand.art}>{z.stand.wort}</Marke>
          </a>
        </li>
      ))}
    </ul>
  )
}

// ─── Detail ──────────────────────────────────────────────────────────────────

function DetailInhalt({ d, href }: { d: MailDetail; href: (id: string) => string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Chip className="font-semibold">{d.weg}</Chip>
        <Marke art={d.stand.art}>{d.stand.wort}</Marke>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13px]">
        <dt className={LEISE}>{ALLE_MAILS_TEXT.an}</dt>
        <dd className="break-words text-foreground">{d.an}</dd>
        {d.bestellung && (
          <>
            <dt className={LEISE}>{ALLE_MAILS_TEXT.bestellung}</dt>
            <dd className="break-words text-foreground">
              <a href={alleMailsHref({}, { suche: d.bestellung.nummer })} className={cn('font-semibold text-status-fertig underline-offset-2 hover:underline', FOKUS_RAHMEN)}>
                {d.bestellung.nummer}
              </a>{' '}
              · {d.bestellung.hof}
            </dd>
          </>
        )}
        {!d.bestellung && d.hofName && (
          <>
            <dt className={LEISE}>{ALLE_MAILS_TEXT.hof}</dt>
            <dd className="break-words text-foreground">{d.hofName}</dd>
          </>
        )}
        <dt className={LEISE}>{ALLE_MAILS_TEXT.nochmal}</dt>
        <dd className="text-foreground">{d.nochmalText}</dd>
      </dl>

      <section aria-labelledby={`verlauf-${d.id}`} className="flex flex-col gap-2">
        <h3 id={`verlauf-${d.id}`} className="text-[14px] font-semibold text-foreground">
          {ALLE_MAILS_TEXT.verlauf}
        </h3>
        <ol className="flex flex-col gap-2 border-l border-border pl-4">
          {d.verlauf.map((v, i) => (
            <li key={`${v.titel}-${i}`} className="text-[13px] leading-snug text-foreground">
              {v.id ? (
                <a href={href(v.id)} className={cn('font-semibold text-status-fertig underline-offset-2 hover:underline', FOKUS_RAHMEN)}>
                  {v.titel}
                </a>
              ) : (
                <b className="font-semibold">{v.titel}</b>
              )}{' '}
              <span className={LEISE}>
                {v.zeit}
                {v.zusatz ? ` · ${v.zusatz}` : ''}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {d.zugestellt && (
        <p className="flex items-start gap-2 text-[12.5px] leading-snug text-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
          {ALLE_MAILS_TEXT.zugestelltHinweis}
        </p>
      )}
      {d.abgelehnt && (
        <Hinweiskarte ton="orange" symbol={CircleAlert}>
          {ALLE_MAILS_TEXT.abgelehntHinweis}
        </Hinweiskarte>
      )}

      {d.knopf.darf ? (
        <NochmalKnopf
          id={d.id}
          texte={{
            knopf: ALLE_MAILS_TEXT.nochmalKnopf,
            heute: d.knopf.heute,
            dialogTitel: d.knopf.dialogTitel,
            punkte: d.knopf.punkte,
            spam: d.knopf.spam ? ALLE_MAILS_TEXT.dialogSpam : null,
            bestaetigen: ALLE_MAILS_TEXT.dialogKnopf,
            fehler: MAIL_TEXT.aktionFehler,
          }}
        />
      ) : d.knopf.heute === null ? (
        <p className={cn('text-[13px] leading-snug', LEISE)}>{d.knopf.grund}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button type="button" disabled aria-describedby={`grund-${d.id}`} className={cn(KNOPF_RAHMEN, 'min-h-11 font-semibold')}>
              {ALLE_MAILS_TEXT.nochmalKnopf}
            </button>
            <span className={cn('text-[12.5px]', LEISE)}>{d.knopf.heute}</span>
          </div>
          <p id={`grund-${d.id}`} className="text-[13px] leading-snug text-foreground">
            {d.knopf.grund}
          </p>
        </div>
      )}

      {d.zeigtVorschau && (
        <section aria-labelledby={`vorschau-${d.id}`} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 id={`vorschau-${d.id}`} className="text-[14px] font-semibold text-foreground">
              {ALLE_MAILS_TEXT.vorschauTitelKurz}
            </h3>
            <span className={cn('text-[12.5px]', LEISE)}>{ALLE_MAILS_TEXT.vorschauZusatz}</span>
          </div>
          <VorschauKnopf id={d.id} texte={{ knopf: ALLE_MAILS_TEXT.vorschauKnopf, fehler: MAIL_TEXT.aktionFehler }} />
        </section>
      )}
    </div>
  )
}

// ─── Ansicht ─────────────────────────────────────────────────────────────────

/**
 * Lädt „Alle Mails“ (je Teil abgesichert) und zeichnet sie. `suche` ist schon
 * geprüft (`mailSucheAus`), `p` aus `alleMailsAus` — ein ungültiger Wert ist
 * der Standard, eine ungültige Suche fragt die Datenbank nie.
 */
export async function MailsAlle({ jetzt, p, suche, sucheRoh }: { jetzt: Date; p: AlleMailsParameter; suche: MailSuche; sucheRoh: string }): Promise<React.JSX.Element> {
  const sucht = suche.art === 'bestellung' || suche.art === 'adresse'
  const [liste, summen, hoefe, gefunden, detailRoh, offen] = await Promise.all([
    sucht ? Promise.resolve(null) : sicher('liste', () => ladeAlleMails(p.filter, p.nach, jetzt)),
    sucht ? Promise.resolve(null) : sicher('summen', () => ladeKannWartenSummen(p.filter, jetzt)),
    sicher('hoefe', () => ladeHofAuswahl()),
    sucht ? sicher('suche', () => sucheMails(suche, jetzt)) : Promise.resolve(null),
    p.mail ? sicher('detail', () => ladeMailDetail(p.mail ?? '', adresseQuelle, jetzt)) : Promise.resolve(null),
    sicher('zahl', () => zaehleProbleme(jetzt)),
  ])

  const seite = p.nach ? `${p.nach.am.getTime()}.${p.nach.id}` : undefined
  const zurueck = alleMailsHref(p.filter, { suche: sucht ? sucheRoh : undefined, nach: seite })
  const href = (id: string): string => alleMailsHref(p.filter, { suche: sucht ? sucheRoh : undefined, nach: seite, mail: id })

  const ergebnis: SuchErgebnis | null =
    suche.art === 'leer'
      ? { art: 'leer' }
      : suche.art === 'ungueltig'
        ? { art: 'hinweis', satz: MAIL_TEXT.sucheUngueltig }
        : gefunden === null
          ? null
          : suchErgebnis({ ...gefunden, adresse: suche.art === 'adresse' ? suche.adresse : null }, jetzt)

  const zeilen = liste ? liste.zeilen.map((m) => alleMailZeile(m, liste, jetzt)) : null
  const detail =
    detailRoh && p.mail
      ? mailDetail(
          {
            mail: detailRoh.mail,
            nochmal: detailRoh.nochmal,
            heute: detailRoh.heute,
            stand: detailRoh.stand,
            adresse: detailRoh.stand.adresse,
            bestellung: detailRoh.stand.bestellung
              ? { id: detailRoh.stand.bestellung.id, nummer: detailRoh.stand.bestellung.orderNumber, hof: detailRoh.stand.bestellung.farm.name }
              : null,
            hofName: detailRoh.stand.hofName,
          },
          jetzt
        )
      : null
  const hofName = p.filter.hof ? (hoefe?.find((h) => h.id === p.filter.hof)?.name ?? null) : null
  const nurKannWarten = p.filter.weg === 'kannWarten' || (p.filter.art !== null && MAIL_WEG[p.filter.art] === 'kannWarten')
  const trefferzahl = sucht
    ? gefunden
      ? ALLE_MAILS_TEXT.trefferSuche(gefunden.mails.length, gefunden.bestellungen.length)
      : null
    : liste
      ? ALLE_MAILS_TEXT.treffer(liste.anzahl)
      : null

  const detailFehlt = p.mail !== null && detailRoh === null
  const detailTeil = (): React.JSX.Element | null => {
    if (!p.mail) return null
    if (!detail) return <p className={cn('text-[13px]', LEISE)}>{detailFehlt ? ALLE_MAILS_TEXT.detailFehlt : MAIL_TEXT.ladefehler}</p>
    return <DetailInhalt d={detail} href={href} />
  }

  const listenTeil = sucht ? (
    <section aria-labelledby="treffer-titel" className="flex min-w-0 flex-col gap-3">
      <h2 id="treffer-titel" className={H2}>
        {ALLE_MAILS_TEXT.trefferZu(suche.art === 'adresse' ? maskiereAdresse(suche.adresse) : suche.nummer)}
      </h2>
      <SuchTreffer ergebnis={ergebnis} gewaehlt={p.mail} detail={href} />
      <p className={cn('text-[12.5px] leading-snug', LEISE)}>{ALLE_MAILS_TEXT.keinTrefferAnruf}</p>
    </section>
  ) : (
    <div className="flex min-w-0 flex-col gap-4">
      <Karte titel={ALLE_MAILS_TEXT.listeTitel} zusatz={ALLE_MAILS_TEXT.listeZusatz}>
        {zeilen === null ? (
          <TeilFehler />
        ) : zeilen.length === 0 ? (
          <EmptyState
            symbol={Inbox}
            titel={ALLE_MAILS_TEXT.leer}
            satz={nurKannWarten ? ALLE_MAILS_TEXT.leerKannWarten : ALLE_MAILS_TEXT.leerSatz}
            ausweg={<a href={alleMailsHref({})} className={LINK}>{ALLE_MAILS_TEXT.filterZuruecksetzen}</a>}
            className="py-6"
          />
        ) : (
          <>
            <div className="hidden md:block">
              <ListeTabelle zeilen={zeilen} gewaehlt={p.mail} href={href} />
            </div>
            <div className="md:hidden">
              <ListeKarten zeilen={zeilen} gewaehlt={p.mail} href={href} />
            </div>
          </>
        )}
        {liste && (liste.weiter || p.nach) && (
          <p className="flex flex-wrap gap-x-4">
            {liste.weiter && (
              <a href={alleMailsHref(p.filter, { nach: cursorVon(liste.weiter) })} className={LINK}>
                {ALLE_MAILS_TEXT.weiter}
              </a>
            )}
            {p.nach && (
              <a href={alleMailsHref(p.filter)} className={LINK}>
                {ALLE_MAILS_TEXT.vonVorn}
              </a>
            )}
          </p>
        )}
      </Karte>
      {summen !== null && (summen.length > 0 || nurKannWarten) && (
        <Karte titel={ALLE_MAILS_TEXT.summenTitel} zusatz={ALLE_MAILS_TEXT.summenZusatz}>
          {summen.length === 0 ? (
            <p className={cn('text-[13px]', LEISE)}>{ALLE_MAILS_TEXT.summenLeer}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {summen.map((s) => {
                const z = kannWartenZeile(s, jetzt)
                return (
                  <li key={`${s.art}-${s.gruppe ?? 'ohne'}`} className="flex min-w-0 flex-col gap-0.5 py-2.5">
                    <span className="text-[13.5px] font-semibold break-words text-foreground">{z.titel}</span>
                    <span className={cn('text-[12.5px] leading-snug', LEISE)}>
                      {WEG_FILTER_NAME.kannWarten} · {z.zeit} · {z.zahlen}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Karte>
      )}
      {summen === null && <TeilFehler />}
    </div>
  )

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-4 lg:gap-[18px]')}>
      <MinutenNachladen />
      <nav aria-label={ALLE_MAILS_TEXT.pfad} className={cn('hidden text-[13px] lg:block', LEISE)}>
        <a href={ADMIN_BETRIEB_HREF} className={cn('rounded-sm underline-offset-2 hover:underline', FOKUS_RAHMEN)}>
          {ALLE_MAILS_TEXT.pfadBetrieb}
        </a>
        {' › '}
        <a href={ADMIN_BETRIEB_MAILS_HREF} className={cn('rounded-sm underline-offset-2 hover:underline', FOKUS_RAHMEN)}>
          {ALLE_MAILS_TEXT.pfadMails}
        </a>
        {' › '}
        <span aria-current="page" className="text-foreground">
          {ALLE_MAILS_TEXT.titel}
        </span>
      </nav>
      <a href={ADMIN_BETRIEB_MAILS_HREF} className={cn(LINK, '-mb-2 self-start text-[13.5px] lg:hidden')}>
        <ChevronLeft className="size-4" aria-hidden="true" />
        {ALLE_MAILS_TEXT.zurueck}
      </a>
      <Seitenkopf
        titel={ALLE_MAILS_TEXT.titel}
        satz={ALLE_MAILS_TEXT.satz}
        rechts={
          <span className={cn('inline-flex items-center gap-1.5 text-[13px]', LEISE)}>
            <Clock className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            {MAIL_TEXT.stand(uhrzeitInWien(jetzt))}
          </span>
        }
      />
      <BetriebUnterreiter aktiv="mails" offen={offen}>
        <div className="flex flex-col gap-4 lg:gap-[18px]">
          <div className={cn(KARTE, 'flex flex-col gap-4 p-4 md:p-5')}>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <SuchForm wert={sucheRoh} />
              {trefferzahl && (
                <p role="status" className="text-[13px] font-semibold text-foreground tabular-nums">
                  {trefferzahl}
                </p>
              )}
            </div>
            {!sucht && (
              <div className="hidden lg:block">
                <FilterForm praefix="filter" f={p.filter} hoefe={hoefe} />
              </div>
            )}
          </div>
          {!sucht && (
            <div className="lg:hidden">
              <Klappkarte titel={ALLE_MAILS_TEXT.filter} zeile={filterZeile(p.filter, hofName)}>
                <FilterForm praefix="filter-handy" f={p.filter} hoefe={hoefe} />
              </Klappkarte>
            </div>
          )}

          <div className={cn('grid gap-[18px]', p.mail && 'lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start')}>
            {listenTeil}
            {p.mail && (
              <aside aria-label={ALLE_MAILS_TEXT.detail} className={cn(KARTE, 'hidden min-w-0 flex-col gap-3 p-4 md:p-5 lg:flex')}>
                <div className="flex min-w-0 items-start gap-2">
                  <h2 className={cn(H2, 'min-w-0 flex-1 break-words')}>{detail?.name ?? ALLE_MAILS_TEXT.detail}</h2>
                  <a href={zurueck} aria-label={ALLE_MAILS_TEXT.schliessen} className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-muted', FOKUS_RAHMEN)}>
                    <X className="size-4" aria-hidden="true" />
                  </a>
                </div>
                {detailTeil()}
              </aside>
            )}
          </div>
          {p.mail && (
            <div className="lg:hidden">
              <DetailBlatt titel={detail?.name ?? ALLE_MAILS_TEXT.detail} zurueck={zurueck} schliessen={ALLE_MAILS_TEXT.schliessen}>
                {detailTeil()}
              </DetailBlatt>
            </div>
          )}

          <p className={cn('text-[12.5px] leading-snug', LEISE)}>{ALLE_MAILS_TEXT.regel}</p>
        </div>
      </BetriebUnterreiter>
    </div>
  )
}
