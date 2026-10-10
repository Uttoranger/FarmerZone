'use client'

import Link from 'next/link'
import { CheckCircle2, ChevronRight, CircleDashed, ExternalLink, Info, Lock, Mail, Phone } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import {
  BAES_FUTTERMITTEL_URL,
  BAES_KONTAKT,
  BAES_KONTAKT_MAILTO,
  BAES_KONTAKT_TEL,
  BAES_KONTAKT_VORLESEN,
  BAES_LINK_TEXT,
  DEUTSCHLAND_HINWEIS,
  ORIENTIERUNG_HINWEIS,
  HAUPT_FAELLE,
  REGISTRIERUNGS_FAELLE,
  fallStand,
  fallZeile,
  hatRegistrierung,
  registrierungsSaetze,
  type FallStand,
  type HofRegistrierung,
  type RegistrierungsFall,
} from '@/lib/futter-registrierung'
import { BETRIEBSNUMMER_ANKER } from '@/lib/taxonomie'
import { cn } from '@/lib/utils'

/*
 * „Deine Futtermittel-Registrierungen" im Futter-Formular (Mockups
 * web-h2-neues-futter, mobil-h2-neues-futter-meldung-fehlt; Register E9, E10).
 * Was der Hof mit seinem Stand anbieten kann; die zwei Fälle, die das
 * Formular entscheidet, offen, die übrigen fünf unter „Alle Futterarten".
 * Eingetragen wird im Hofprofil (Nummer und Status, Rückfrage F6) — die
 * Plattform prüft nichts (E9), hier wird nur angezeigt. Darüber steht seit
 * Nr. 23 der Kopfhinweis zur Orientierung (ORIENTIERUNG_HINWEIS) mit dem Link
 * zum BAES (E10a): Die Texte gehen ohne Gegenlesen live. Seit Nr. 36 nennt
 * er dazu E-Mail und Telefon des BAES (BAES_KONTAKT) — als Links, damit der
 * Hof am Handy direkt schreiben oder anrufen kann.
 */

/** Ein Link im Kopfhinweis: eigene Zeile mit 44 px Trefferfläche, Fokus sichtbar. */
const KOPF_LINK = cn(
  'inline-flex min-h-11 items-center gap-1.5 rounded-md text-[13px] font-semibold text-brand-text underline-offset-4 hover:underline',
  FOKUS_RAHMEN
)

/** Wo Nummer und Status stehen — der Abschnitt im Hofprofil (Einstellungen, Nr. 22d). */
export const REGISTRIERUNG_EINSTELLEN_HREF = `/settings/profile#${BETRIEBSNUMMER_ANKER}`

const STAND_SYMBOL: Record<FallStand, typeof CheckCircle2> = {
  erfuellt: CheckCircle2,
  fehlt: Lock,
  info: CircleDashed,
}

export function FutterRegistrierungen({ registrierung }: { registrierung: HofRegistrierung }): React.JSX.Element {
  const saetze = registrierungsSaetze(registrierung)
  const baesFehlt = !hatRegistrierung('BAES', registrierung)
  const haupt = REGISTRIERUNGS_FAELLE.filter((f) => HAUPT_FAELLE.includes(f.id))
  const weitere = REGISTRIERUNGS_FAELLE.filter((f) => !HAUPT_FAELLE.includes(f.id))

  return (
    <div className="flex flex-col gap-3">
      {/* Kopfhinweis über allem, was folgt (E10a). */}
      <div className="flex gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-snug text-foreground">{ORIENTIERUNG_HINWEIS}</p>
          <a href={BAES_FUTTERMITTEL_URL} target="_blank" rel="noopener noreferrer" className={KOPF_LINK}>
            {BAES_LINK_TEXT}
            <ExternalLink className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
            <span className="sr-only"> (öffnet in einem neuen Tab)</span>
          </a>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{BAES_KONTAKT.satz}</p>
          <div className="flex flex-wrap gap-x-4">
            <a href={BAES_KONTAKT_MAILTO} className={cn(KOPF_LINK, 'min-w-0 break-all')}>
              <Mail className="size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
              <span className="sr-only">{BAES_KONTAKT_VORLESEN.email}</span>
              {BAES_KONTAKT.email}
            </a>
            <a href={BAES_KONTAKT_TEL} className={cn(KOPF_LINK, 'whitespace-nowrap')}>
              <Phone className="size-3.5 shrink-0" strokeWidth={1.7} aria-hidden="true" />
              <span className="sr-only">{BAES_KONTAKT_VORLESEN.telefon}</span>
              {BAES_KONTAKT.telefon}
            </a>
          </div>
        </div>
      </div>

      {saetze.map((s) => (
        <Hinweiskarte key={s.text} ton={s.ton} symbol={s.ton === 'gruen' ? CheckCircle2 : Info}>
          {s.text}
        </Hinweiskarte>
      ))}

      {/* Bestätigt wird im Hofprofil — in einem neuen Tab, damit das Formular hier stehen bleibt. */}
      <Link
        href={REGISTRIERUNG_EINSTELLEN_HREF}
        target="_blank"
        rel="noopener"
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 self-start rounded-md text-[13.5px] font-semibold text-brand-text underline-offset-4 hover:underline',
          FOKUS_RAHMEN
        )}
      >
        {baesFehlt ? 'Meldung eingetragen? Hier bestätigen' : 'Registrierung in den Einstellungen ansehen'}
        <ExternalLink className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
        <span className="sr-only"> (öffnet in einem neuen Tab)</span>
      </Link>

      <ul className="flex flex-col gap-2">
        {haupt.map((f) => (
          <FallZeile key={f.id} fall={f} stand={fallStand(f.id, registrierung)} zeile={fallZeile(f.id, registrierung)} />
        ))}
      </ul>

      <details className="group rounded-xl border border-border">
        <summary
          className={cn(
            'flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-xl px-3.5 text-[13.5px] font-medium text-brand-text [&::-webkit-details-marker]:hidden',
            FOKUS_RAHMEN
          )}
        >
          Alle Futterarten anzeigen (Handel, Mischfutter, BARF …)
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" strokeWidth={1.7} aria-hidden="true" />
        </summary>
        <ul className="flex flex-col gap-2 px-3.5 pb-3.5">
          {weitere.map((f) => (
            <FallZeile key={f.id} fall={f} stand={fallStand(f.id, registrierung)} zeile={null} />
          ))}
        </ul>
        <p className="px-3.5 pb-3.5 text-xs leading-snug text-muted-foreground">{DEUTSCHLAND_HINWEIS}</p>
      </details>
    </div>
  )
}

/** Ein Fall: Titel, Beispiele, was es braucht — und, wo das Modell es weiß, der Stand. */
function FallZeile({ fall, stand, zeile }: { fall: RegistrierungsFall; stand: FallStand; zeile: string | null }): React.JSX.Element {
  const Symbol = STAND_SYMBOL[stand]
  return (
    <li
      className={cn(
        'flex gap-3 rounded-xl border px-3.5 py-3',
        stand === 'erfuellt' ? 'border-accent/45 bg-accent/8' : stand === 'fehlt' ? 'border-primary/45 bg-primary/8' : 'border-border bg-card'
      )}
    >
      <Symbol
        className={cn(
          'mt-0.5 size-[18px] shrink-0',
          stand === 'erfuellt' ? 'text-status-fertig' : stand === 'fehlt' ? 'text-status-offen' : 'text-muted-foreground'
        )}
        strokeWidth={1.7}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-foreground">{fall.titel}</p>
        <p className="text-xs text-muted-foreground">{fall.beispiele}</p>
        <p className="mt-1 text-xs text-foreground">{fall.nachweis}</p>
        {zeile && (
          <p className={cn('mt-1 text-xs font-semibold', stand === 'erfuellt' ? 'text-status-fertig' : 'text-status-offen')}>{zeile}</p>
        )}
        <span className="sr-only">
          {stand === 'erfuellt' ? 'Eingetragen.' : stand === 'fehlt' ? 'Fehlt noch.' : 'Dazu hast du nichts eingetragen.'}
        </span>
      </div>
    </li>
  )
}
