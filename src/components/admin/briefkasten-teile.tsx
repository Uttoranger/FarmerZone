import Link from 'next/link'
import { Lightbulb } from 'lucide-react'
import { MELDUNG_ART_LABEL, WUENSCHE_TEXT, kiBegruendung, kurznummer, prLink, type TriageStand } from '@/lib/meldung'
import { ADMIN_STATUS_TON, WUNSCHLISTE_LEER, WUNSCHLISTE_SATZ, adminStatusText, bildschirmText } from '@/lib/admin-briefkasten'
import { MELDUNG_ART_TON, OHNE_IP_UND_COOKIES, geraetKurz } from '@/lib/hof-hilfe'
import { eingangMeldungAdresse } from '@/lib/postfach'
import { seitenPfad } from '@/lib/fremdtext'
import { wienKalendertag } from '@/lib/kalender'
import { datumKurz } from '@/lib/verkauf-eintragen'
import { cn } from '@/lib/utils'
import type { AdminMeldungDetail, getDuplikateVon } from '@/server/queries/meldung'
import { StatusBadge } from '@/components/ui/status-badge'
import { Marke } from '@/components/ui/marke'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KARTE, KICKER, LEISE } from '@/components/hof-bestellungen/stil'
import { TriageForm, type TriageWerte } from '@/components/admin/meldungen-triage-form'
import { KiVorschlag } from '@/components/admin/meldungen-ki-vorschlag'
import { TrennenKnopf } from '@/components/admin/meldungen-werkzeug'

/*
 * Die Teile der Meldungen im Eingang des Admin-Postfachs (Nachtlauf Nr. 22f,
 * seit Nr. 95 im Eingang, Mockup admin-postfach-meldungen; seit Nr. 101 mit
 * „Woraus", Mockup admin-postfach-zusammenfassen): die gebündelte
 * Wunschliste und „Meldung entscheiden". Die Liste aller Meldungen steht seit
 * Nr. 101 im Reiter „Meldungen". Meldungstexte sind Fremdtext — sie stehen
 * als Text da, gekürzt, mit dem vollen Wortlaut im `title`; nie als Markup.
 */

export type WunschBuendel = {
  schluessel: string
  name: string
  anzahl: number
  beispiele: Array<{ id: string; text: string }>
  weitere: number
}

/** Die Wunschliste, gebündelt nach Bündel (clusterKey) — größte zuerst (getWunschCluster). */
export function Wunschliste({ buendel }: { buendel: WunschBuendel[] }): React.JSX.Element {
  return (
    <section aria-labelledby="wunschliste-titel" className={cn(KARTE, 'flex flex-col gap-1 p-4 md:p-[18px]')}>
      <h2 id="wunschliste-titel" className="font-heading text-[17px] font-semibold text-foreground">
        Wunschliste gebündelt
      </h2>
      {buendel.length === 0 ? (
        <EmptyState
          symbol={Lightbulb}
          titel={WUNSCHLISTE_LEER.titel}
          ausweg={{ ohne: 'Die Wunschliste bündelt jeden Wunsch außer Dubletten; Wünsche kommen nur von Höfen und Kundinnen, der Admin legt keinen an' }}
          className="rounded-xl py-6"
        />
      ) : (
        <ul className="[&>li]:border-t [&>li]:border-border">
          {buendel.map((b) => (
            <li key={b.schluessel} className="py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg bg-accent/18 px-1.5 text-[13px] font-semibold text-status-fertig tabular-nums">
                  {b.anzahl}
                  <span className="sr-only">{b.anzahl === 1 ? ' Wunsch' : ' Wünsche'}</span>
                </span>
                <span className="min-w-0 truncate text-[14.5px] text-foreground" title={b.name}>
                  {b.name}
                </span>
              </div>
              <ul className="mt-1.5 pl-10">
                {b.beispiele.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={eingangMeldungAdresse(e.id)}
                      className={cn('flex min-h-11 items-center rounded text-[12.5px] text-muted-foreground hover:text-foreground hover:underline', FOKUS_RAHMEN_INNEN)}
                      title={e.text}
                    >
                      <span className="min-w-0 truncate">{e.text}</span>
                    </Link>
                  </li>
                ))}
                {b.weitere > 0 && <li className={cn('text-[12.5px]', LEISE)}>… und {b.weitere} weitere</li>}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className={cn('pt-1 text-[12.5px] leading-relaxed', LEISE)}>{WUNSCHLISTE_SATZ}</p>
    </section>
  )
}

function uhrzeit(d: Date): string {
  return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' })
}

function zeitpunkt(d: Date): string {
  return d.toLocaleString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Vienna' })
}

/**
 * „Meldung entscheiden" als rechte Spalte des Eingangs (Register N12-Änderung,
 * Nr. 95; Mockup admin-postfach-meldungen) — der Inhalt der bisherigen Seite
 * /admin/meldungen/[id] (Nr. 22f), Logik unverändert: die Meldung mit
 * Bildschirmfoto, der Vorschlag der KI (nur ein Vorschlag), „Entscheiden"
 * (triageMeldungAction mit Ausgangsstand) und was automatisch mitkam.
 * Meldungstext und Browserangabe sind Fremdtext und stehen nur als Text da.
 * Das Formular trägt die Kennung als `key`: Wechselt die Auswahl, beginnt es
 * mit dem gespeicherten Stand der neuen Meldung.
 */
export function MeldungEntscheidenSpalte({
  m,
  jetzt,
  duplikate = [],
}: {
  m: AdminMeldungDetail
  jetzt: Date
  /** Die Duplikate dieser Meldung — „Woraus" mit „Trennen" (Register N14, Ergänzung; Nr. 101). */
  duplikate?: Awaited<ReturnType<typeof getDuplikateVon>>
}): React.JSX.Element {
  const stand: TriageStand = {
    status: m.status,
    art: m.art,
    clusterKey: m.clusterKey,
    triageNotiz: m.triageNotiz,
    duplikatVonId: m.duplikatVonId,
    sprintName: m.sprintName,
    antwortAnMelder: m.antwortAnMelder,
  }
  const gespeichert: TriageWerte = {
    status: m.status,
    clusterKey: m.clusterKey ?? '',
    triageNotiz: m.triageNotiz ?? '',
    duplikatVonId: m.duplikatVonId ? kurznummer(m.duplikatVonId) : '',
    sprintName: m.sprintName ?? '',
    antwortAnMelder: m.antwortAnMelder ?? '',
  }
  const pr = prLink(m.sprintName)
  const tag = datumKurz(wienKalendertag(m.createdAt), wienKalendertag(jetzt))
  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      <article aria-labelledby="meldung-titel" className="flex flex-col gap-3">
        <h2 id="meldung-titel" className="sr-only">
          Meldung {m.kurznummer}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <StatusBadge status={MELDUNG_ART_TON[m.art]}>{MELDUNG_ART_LABEL[m.art]}</StatusBadge>
          <StatusBadge status={ADMIN_STATUS_TON[m.status]}>{adminStatusText(m.status, m.sprintName)}</StatusBadge>
          <span className={cn('min-w-0 break-words', LEISE)}>
            {tag}, {uhrzeit(m.createdAt)} ·{' '}
            {m.farm ? (
              <a href={`/${m.farm.slug}`} target="_blank" rel="noopener noreferrer" className={cn('rounded font-medium text-brand-text hover:underline', FOKUS_RAHMEN)}>
                {m.farm.name}
              </a>
            ) : m.customerEmail ? (
              <span className="break-all">Kundin · {m.customerEmail}</span>
            ) : (
              'Anonym'
            )}
            {' · '}Nr. <span className="font-mono">{m.kurznummer}</span>
          </span>
        </div>
        <p className="text-[15.5px] leading-relaxed break-words whitespace-pre-wrap text-foreground">„{m.text}“</p>
        {m.screenshotUrl && (
          <a href={m.screenshotUrl} target="_blank" rel="noopener noreferrer" className={cn('block self-start rounded-xl', FOKUS_RAHMEN)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- fremde Blob-Adresse, keine Optimierung nötig */}
            <img src={m.screenshotUrl} alt="Bildschirmfoto zur Meldung" className="max-h-72 w-auto max-w-full rounded-xl border border-border" />
          </a>
        )}
      </article>

      {m.status === 'VERMUTLICH_WUNSCH' && <KiVorschlag key={`ki-${m.id}`} meldungId={m.id} stand={stand} begruendung={kiBegruendung(m.triageNotiz)} />}

      {duplikate.length > 0 && (
        <section aria-labelledby="woraus-titel" className={cn(KARTE, 'p-4 md:p-[18px]')}>
          <h3 id="woraus-titel" className={KICKER}>
            {WUENSCHE_TEXT.woraus}
          </h3>
          <ul className="mt-2 [&>li+li]:border-t [&>li+li]:border-border">
            {duplikate.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-semibold text-foreground" title={d.ersteZeile}>
                    {d.ersteZeile || '—'}
                  </span>
                  <span className={cn('text-[12.5px]', LEISE)}>
                    {datumKurz(wienKalendertag(d.createdAt), wienKalendertag(jetzt))} · {d.hofName ?? 'Kundin'} · <span className="font-mono">{d.kurznummer}</span>
                  </span>
                </span>
                <Marke art="erledigt" className="shrink-0">
                  {WUENSCHE_TEXT.duplikat}
                </Marke>
                <TrennenKnopf meldungId={d.id} titel={d.ersteZeile} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="entscheiden-titel" className={cn(KARTE, 'p-4 md:p-[18px]')}>
        <h3 id="entscheiden-titel" className="mb-3 font-heading text-[19px] font-semibold text-foreground">
          Entscheiden
        </h3>
        <TriageForm key={m.id} meldungId={m.id} art={m.art} werte={gespeichert} hatHof={m.farm !== null} />
      </section>

      <section aria-labelledby="mitgeschickt-titel">
        <h3 id="mitgeschickt-titel" className={KICKER}>
          Automatisch mitgeschickt
        </h3>
        <dl className="mt-2 grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] text-[13.5px] md:grid-cols-[140px_minmax(0,1fr)] [&>dd]:border-t [&>dd]:border-border [&>dd]:py-2 [&>dt]:border-t [&>dt]:border-border [&>dt]:py-2">
          <dt className={LEISE}>Seite</dt>
          <dd className="break-all text-foreground">{m.seiteUrl ? seitenPfad(m.seiteUrl) : '–'}</dd>
          <dt className={LEISE}>Gerät</dt>
          <dd className="text-foreground" title={m.userAgent}>
            {geraetKurz(m.userAgent)}
          </dd>
          <dt className={LEISE}>Bildschirm</dt>
          <dd className="text-foreground">{bildschirmText(m.viewport)}</dd>
          <dt className={LEISE}>Fehlernummer</dt>
          <dd className="font-mono text-foreground">{m.diagKennung || '–'}</dd>
          {m.sprintName && (
            <>
              <dt className={LEISE}>Sprint</dt>
              <dd className="text-foreground">
                {pr ? (
                  <a href={pr} target="_blank" rel="noopener noreferrer" className={cn('rounded font-medium text-brand-text hover:underline', FOKUS_RAHMEN)}>
                    {m.sprintName}
                  </a>
                ) : (
                  m.sprintName
                )}
              </dd>
            </>
          )}
          {m.triagedAt && (
            <>
              <dt className={LEISE}>Entschieden</dt>
              <dd className="text-foreground">{zeitpunkt(m.triagedAt)}</dd>
            </>
          )}
          <dt className={LEISE}>Kennung</dt>
          <dd className="font-mono text-[12.5px] break-all text-muted-foreground">{m.id}</dd>
        </dl>
        <p className={cn('mt-2 text-[12.5px]', LEISE)}>{OHNE_IP_UND_COOKIES}</p>
      </section>
    </div>
  )
}
