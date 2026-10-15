import Link from 'next/link'
import { ChevronRight, Inbox, Lightbulb } from 'lucide-react'
import { MELDUNG_ART_LABEL, kiBegruendung, kurznummer, prLink, type MeldungTon } from '@/lib/meldung'
import { ADMIN_STATUS_TON, WUNSCHLISTE_LEER, WUNSCHLISTE_SATZ, adminStatusText, bildschirmText } from '@/lib/admin-briefkasten'
import { MELDUNG_ART_TON, OHNE_IP_UND_COOKIES, geraetKurz } from '@/lib/hof-hilfe'
import { eingangMeldungAdresse } from '@/lib/postfach'
import { seitenPfad } from '@/lib/fremdtext'
import { wienKalendertag } from '@/lib/kalender'
import { datumKurz } from '@/lib/verkauf-eintragen'
import { cn } from '@/lib/utils'
import type { AdminMeldungDetail } from '@/server/queries/meldung'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KARTE, KICKER, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
// Die Formulare bleiben, wo sie seit Nr. 22f liegen; seit Nr. 95 stehen sie als Spalte im Eingang (Nacharbeit: nach components ziehen).
import { TriageForm, type TriageWerte } from '@/app/admin/meldungen/[id]/triage-form'
import { KiVorschlag } from '@/app/admin/meldungen/[id]/ki-vorschlag'

/*
 * Die Teile des Briefkastens im Admin (Nachtlauf Nr. 22f, Mockup
 * admin-briefkasten): die Liste der Meldungen und die gebündelte Wunschliste.
 * Meldungstexte sind Fremdtext — sie stehen als Text da, gekürzt, mit dem
 * vollen Wortlaut im `title`; nie als Markup.
 */

export type BriefkastenZeile = {
  id: string
  art: string
  artTon: MeldungTon
  titel: string
  herkunft: string
  datum: string
  status: string
  statusTon: MeldungTon
}

export function MeldungListe({
  zeilen,
  leer,
}: {
  zeilen: BriefkastenZeile[]
  /** Leer-Zustand: Titel, Satz und ein Ausweg. */
  leer: { titel: string; satz: string; ausweg?: { text: string; href: string } }
}): React.JSX.Element {
  if (zeilen.length === 0) {
    return (
      <EmptyState
        symbol={Inbox}
        titel={leer.titel}
        satz={leer.satz}
        ausweg={
          leer.ausweg ? (
            <Link href={leer.ausweg.href} className={KNOPF_RAHMEN}>
              {leer.ausweg.text}
            </Link>
          ) : {
            ohne: 'Den Ausweg gibt der Aufrufer mit: /admin/meldungen tut es immer (voreingestellt „Offene Meldungen zeigen“, mit Filter „Zu entscheiden zeigen“); nur ein Aufrufer ohne Ausweg landet hier',
          }
        }
      />
    )
  }
  return (
    <ul aria-label="Meldungen" className={cn(KARTE, 'overflow-hidden [&>li+li]:border-t [&>li+li]:border-border')}>
      {zeilen.map((z) => (
        <li key={z.id}>
          <Link
            href={eingangMeldungAdresse(z.id)}
            className={cn(
              'grid min-h-[60px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted md:grid-cols-[76px_minmax(0,1fr)_96px_auto_auto]',
              FOKUS_RAHMEN_INNEN
            )}
          >
            <StatusBadge status={z.artTon} className="justify-self-start">
              {z.art}
            </StatusBadge>
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] font-semibold text-foreground" title={z.titel}>
                {z.titel}
              </span>
              <span className={cn('block truncate text-[12.5px]', LEISE)} title={z.herkunft}>
                {z.herkunft}
              </span>
            </span>
            <span className={cn('hidden text-[13px] whitespace-nowrap md:block', LEISE)}>{z.datum}</span>
            <span className="col-start-2 flex flex-wrap items-center gap-2 md:col-start-auto">
              <span className={cn('text-[12.5px] whitespace-nowrap md:hidden', LEISE)}>{z.datum}</span>
              <StatusBadge status={z.statusTon}>{z.status}</StatusBadge>
            </span>
            <ChevronRight
              className="col-start-3 row-span-2 row-start-1 size-4 text-muted-foreground md:col-start-auto md:row-span-1"
              strokeWidth={1.7}
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  )
}

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
export function MeldungEntscheidenSpalte({ m, jetzt }: { m: AdminMeldungDetail; jetzt: Date }): React.JSX.Element {
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

      {m.status === 'VERMUTLICH_WUNSCH' && <KiVorschlag key={`ki-${m.id}`} meldungId={m.id} gespeichert={gespeichert} begruendung={kiBegruendung(m.triageNotiz)} />}

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
