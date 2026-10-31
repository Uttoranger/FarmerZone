'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ExternalLink, ShieldCheck } from 'lucide-react'
import type { HofAkteAnsicht as AkteDaten } from '@/lib/admin-hof-akte'
import { ADMIN_HOEFE_HREF, AKTE_PROTOKOLL_LEER, SPERRE_TEXT } from '@/lib/admin-hof-akte'
import type { HofZustand } from '@/lib/admin-hoefe-liste'
import { GRUENDUNG_AUSNEHMEN_TEXT } from '@/lib/admin-hoefe-seite'
import { NUMMER_HINWEIS, SERVICEGEBUEHR_NUR_NEUE } from '@/lib/admin-hoefe'
import { GRUENDUNG_AUSGENOMMEN_MARKE, GRUENDUNG_BIS_MARKE, GRUENDUNG_BIS_TITEL, TESTHOF_MARKE } from '@/lib/gruendungshof'
import { ADMIN_POSTFACH_HREF } from '@/lib/postfach'
import { formatEuro } from '@/lib/format'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import { EmptyState } from '@/components/ui/empty-state'
import { KARTE, KICKER, KNOPF_GRUEN, KNOPF_ORANGE_RAHMEN, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HofKachel, SEITEN_TITEL } from './admin-teile'
import type { AdminHof } from './hoefe-ansicht'
import { HofAktionDialog, type HofAktion } from './hof-aktion-dialog'
import { ServicegebuehrDialog } from './servicegebuehr-dialog'
import { GruendungBisDialog, type GruendungsHof } from './gruendung-bis-dialog'
import { GruendungAusnehmenDialog, type GruendungAusnehmenHof } from './gruendung-ausnehmen-dialog'
import { TesthofDialog, type TesthofHof } from './testhof-dialog'
import { HofSperreDialog, type HofSperreWahl } from './hof-akte-sperre-dialog'
import { HofAkteKonto, type HofKontoDaten } from './hof-akte-konto'
import { KONTO_ANFRAGE_TEXT } from '@/lib/konto-anfragen'

/**
 * Die Akte eines Hofs (Register N32, N33, N34; Nachtlauf Nr. 187; Mockup
 * admin-hof-akte): Kopf mit Zustand, dann Kontakt, Aktivität, Zustand
 * („was Kundinnen erleben“), Eingreifen und die Akte aus dem Protokoll.
 * Freischalten, Gründung, Testhof und Servicegebühr sind aus der Liste
 * hierher gezogen — dieselben Actions und Dialoge. Neu: „Vorübergehend
 * sperren …“ / „Sperre aufheben“. Darunter die Konto-Anfragen (Anmelde-E-Mail
 * ändern, Auskunft, Konto schließen; Nr. 190, hof-akte-konto.tsx).
 */
export function HofAkteAnsicht({
  hof,
  zustand,
  akte,
  konto,
}: {
  hof: AdminHof
  zustand: HofZustand
  akte: AkteDaten
  /** Die Konto-Knöpfe (Nr. 190); ohne = ausgeblendet (etwa wenn der Stand nicht lesbar war). */
  konto?: HofKontoDaten | null
}): React.JSX.Element {
  const [aktion, setAktion] = useState<HofAktion | null>(null)
  const [gebuehr, setGebuehr] = useState(false)
  const [gruendungHof, setGruendungHof] = useState<GruendungsHof | null>(null)
  const [ausnehmenHof, setAusnehmenHof] = useState<GruendungAusnehmenHof | null>(null)
  const [testhofHof, setTesthofHof] = useState<TesthofHof | null>(null)
  const [sperre, setSperre] = useState<HofSperreWahl | null>(null)
  const wartet = zustand.id === 'wartet'
  const geschlossen = zustand.id === 'geschlossen' || zustand.id === 'stillgelegt'

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Brotkrumen">
        <Link href={ADMIN_HOEFE_HREF} className={cn('inline-flex min-h-11 items-center gap-1 text-[13.5px] text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)}>
          <ChevronLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
          Höfe
        </Link>
      </nav>

      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <HofKachel name={hof.name} />
          <div className="min-w-0">
            <p className={KICKER}>Akte</p>
            <h1 className={cn(SEITEN_TITEL, 'break-words')}>{hof.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px]">
              <StatusBadge status={zustand.ton}>{zustand.text}</StatusBadge>
              {hof.freigeschaltetAm && <span className={LEISE}>freigeschaltet seit {hof.freigeschaltetAm}</span>}
              <StatusBadge status={hof.stripeBereit ? 'fertig' : 'offen'}>{hof.stripeBereit ? 'Stripe eingerichtet' : 'Stripe fehlt'}</StatusBadge>
              {hof.gruendungsplatz !== null && <StatusBadge status="neutral">Gründungshof · Platz {hof.gruendungsplatz}</StatusBadge>}
              {/* Ein Testhof trägt nur seine Marke, nie zusätzlich „ausgenommen“ (Register N21). */}
              {hof.istTesthof ? (
                <StatusBadge status="neutral">{TESTHOF_MARKE}</StatusBadge>
              ) : (
                hof.gruendungAusgenommen && <StatusBadge status="neutral">{GRUENDUNG_AUSGENOMMEN_MARKE}</StatusBadge>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {!geschlossen && !wartet && (
            <a href={`/${hof.slug}`} target="_blank" rel="noopener noreferrer" className={KNOPF_RAHMEN}>
              Hofseite ansehen
              <ExternalLink className="ml-1 size-3.5" strokeWidth={1.7} aria-hidden="true" />
              <span className="sr-only">(öffnet in neuem Tab)</span>
            </a>
          )}
          <Link href={ADMIN_POSTFACH_HREF} className={KNOPF_RAHMEN}>
            Nachricht schreiben
          </Link>
        </div>
      </header>

      {akte.sperre.gesperrt && (
        <p role="status" className="rounded-2xl border border-status-offen/50 bg-card px-4 py-3 text-[14px] text-foreground">
          <span className="font-semibold">{SPERRE_TEXT.gesperrt}</span>
          {akte.sperre.seit && <span className={LEISE}> · seit {akte.sperre.seit}</span>}
          {akte.sperre.grund && <span> · Grund: {akte.sperre.grund}</span>}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Abschnitt titel="Kontakt" satz="nur für Fragen zum Betrieb">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
            <Eintrag titel="Telefon">{akte.kontakt.telefon}</Eintrag>
            <Eintrag titel="Anmeldung">
              <span className="break-all">{akte.kontakt.anmeldung}</span>
              <span className={LEISE}> · bestätigt: {akte.kontakt.emailBestaetigt}</span>
            </Eintrag>
            <Eintrag titel="Hof-E-Mail">{akte.kontakt.hofEmail}</Eintrag>
            <Eintrag titel="Ort">
              {akte.kontakt.ort}
              {/* Ein Hinweis, keine Sperre (Nr. 119) — leise, nie orange. */}
              {hof.kartenpunktZeile && <span className={cn('block text-[12.5px]', LEISE)}>{hof.kartenpunktZeile}</span>}
            </Eintrag>
            {/* Nr. 207 (§ 104 JN, P2B): welcher AGB-Fassung der Hof zugestimmt hat und wann (Wiener Zeit). */}
            <Eintrag titel="AGB">{akte.kontakt.agb}</Eintrag>
            <Eintrag titel="Betriebsnr.">
              {hof.nummer ?? '–'} <span className={LEISE}>· {NUMMER_HINWEIS}</span>
            </Eintrag>
          </dl>
        </Abschnitt>

        <Abschnitt titel="Aktivität" satz="zeigt, ob der Hof Hilfe braucht">
          <dl className="grid grid-cols-2 gap-4 text-[14px]">
            <Kennzahl titel="Bestellungen 30 Tage" wert={String(akte.aktivitaet.bestellungen)} satz={akte.aktivitaet.bestellungenZeile} />
            <Kennzahl
              titel="Umsatz 30 Tage"
              wert={formatEuro(centsAlsEuro(akte.aktivitaet.umsatzCents))}
              satz={`Servicegebühr ${formatEuro(centsAlsEuro(akte.aktivitaet.servicegebuehrCents))}`}
            />
            <Kennzahl titel="Zuletzt angemeldet" wert={akte.aktivitaet.zuletztAngemeldet} satz={akte.aktivitaet.anmeldung} />
            <Kennzahl titel="Antwortzeit Postfach" wert={akte.aktivitaet.antwortzeit} satz={null} />
          </dl>
        </Abschnitt>

        <Abschnitt titel="Zustand" satz="was Kundinnen erleben">
          <dl className="flex flex-col text-[14px] [&>div+div]:border-t [&>div+div]:border-border">
            {akte.zustand.map((z) => (
              <div key={z.titel} className="flex items-center gap-3 py-2">
                <dt className={cn('w-32 shrink-0', LEISE)}>{z.titel}</dt>
                <dd className="min-w-0 flex-1 text-foreground">{z.text}</dd>
                <dd className="shrink-0">
                  <StatusBadge status={z.ton === 'ok' ? 'fertig' : z.ton === 'achtung' ? 'offen' : 'neutral'}>{z.wort}</StatusBadge>
                </dd>
              </div>
            ))}
          </dl>
        </Abschnitt>

        <Abschnitt titel="Eingreifen" satz={SPERRE_TEXT.eingriffSatz}>
          {hof.gruendung && (
            <p className="text-[13.5px] text-foreground">
              {GRUENDUNG_BIS_TITEL} {hof.gruendung.bisText}{' '}
              <span className={LEISE}>· {hof.gruendung.abweichend ? GRUENDUNG_BIS_MARKE.abweichend : GRUENDUNG_BIS_MARKE.standard}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-2.5">
            {wartet && (
              <>
                <button type="button" onClick={() => setAktion({ hof, art: 'approve' })} disabled={hof.sperre !== null} title={hof.sperre ?? undefined} className={KNOPF_GRUEN}>
                  Freischalten
                </button>
                <button type="button" onClick={() => setAktion({ hof, art: 'reject' })} className={KNOPF_RAHMEN}>
                  Ablehnen
                </button>
              </>
            )}
            {!geschlossen &&
              (akte.sperre.gesperrt ? (
                <button type="button" onClick={() => setSperre({ farmId: hof.id, name: hof.name, richtung: 'aufheben' })} className={KNOPF_RAHMEN}>
                  {SPERRE_TEXT.aufheben}
                </button>
              ) : (
                <button type="button" onClick={() => setSperre({ farmId: hof.id, name: hof.name, richtung: 'sperren' })} className={KNOPF_ORANGE_RAHMEN}>
                  {SPERRE_TEXT.knopf}
                </button>
              ))}
            {hof.testhofAenderung && (
              <button type="button" onClick={() => hof.testhofAenderung && setTesthofHof({ id: hof.id, name: hof.name, aenderung: hof.testhofAenderung })} className={KNOPF_RAHMEN}>
                {hof.testhofAenderung.menue}
              </button>
            )}
            <button type="button" onClick={() => setGebuehr(true)} className={KNOPF_RAHMEN}>
              Servicegebühr …<span className="sr-only"> ({hof.satz})</span>
            </button>
            {hof.gruendung && (
              <button type="button" onClick={() => hof.gruendung && setGruendungHof({ id: hof.id, name: hof.name, gruendung: hof.gruendung })} className={KNOPF_RAHMEN}>
                {GRUENDUNG_AUSNEHMEN_TEXT.menueBis}
              </button>
            )}
            {hof.gruendungAenderung && (
              <button
                type="button"
                disabled={hof.gruendungAenderung.gesperrt !== null}
                title={hof.gruendungAenderung.gesperrt ?? undefined}
                onClick={() => hof.gruendungAenderung && setAusnehmenHof({ id: hof.id, name: hof.name, aenderung: hof.gruendungAenderung })}
                className={KNOPF_RAHMEN}
              >
                {hof.gruendungAenderung.menue}
              </button>
            )}
            {!wartet && !geschlossen && (
              <button type="button" onClick={() => setAktion({ hof, art: 'revoke' })} className={KNOPF_RAHMEN}>
                Freigabe zurücknehmen
              </button>
            )}
          </div>
          {hof.gruendungAenderung?.gesperrt && <p className={cn('text-[12.5px]', LEISE)}>{hof.gruendungAenderung.gesperrt}</p>}
          <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>
            {SPERRE_TEXT.erklaerung} {SERVICEGEBUEHR_NUR_NEUE}
          </p>
          {hof.sperre && wartet && <p className="text-[13px] font-medium text-status-offen">{hof.sperre}</p>}
          {hof.gruendungZuletzt && <p className={cn('text-[12px]', LEISE)}>{hof.gruendungZuletzt}</p>}
        </Abschnitt>

        {konto && (
          <Abschnitt titel={KONTO_ANFRAGE_TEXT.titel} satz={KONTO_ANFRAGE_TEXT.satz}>
            <HofAkteKonto konto={konto} />
          </Abschnitt>
        )}
      </div>

      <Abschnitt titel="Akte" satz="Einträge aus dem Protokoll – Team und System">
        {akte.protokoll.length === 0 ? (
          <EmptyState
            symbol={ShieldCheck}
            titel={AKTE_PROTOKOLL_LEER.titel}
            satz={AKTE_PROTOKOLL_LEER.satz}
            ausweg={{ ohne: 'Einträge entstehen erst mit einer Aktion; hier gibt es nichts zu tun' }}
          />
        ) : (
          <ol className="flex flex-col text-[14px] [&>li+li]:border-t [&>li+li]:border-border">
            {akte.protokoll.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                <span className="w-16 shrink-0 font-semibold text-foreground">{e.wer}</span>
                <span className="min-w-0 flex-1 text-foreground">
                  {e.text}
                  {e.grund && <span className={LEISE}> · {e.grund}</span>}
                  {e.mitPasskey && <span className="sr-only"> (mit Passkey bestätigt)</span>}
                </span>
                <span className={cn('shrink-0 text-[12.5px] tabular-nums', LEISE)}>{e.wann}</span>
              </li>
            ))}
          </ol>
        )}
      </Abschnitt>

      <HofAktionDialog aktion={aktion} onClose={() => setAktion(null)} />
      <ServicegebuehrDialog hof={gebuehr ? hof : null} onClose={() => setGebuehr(false)} />
      <GruendungBisDialog hof={gruendungHof} onClose={() => setGruendungHof(null)} />
      <GruendungAusnehmenDialog hof={ausnehmenHof} onClose={() => setAusnehmenHof(null)} />
      <TesthofDialog hof={testhofHof} onClose={() => setTesthofHof(null)} />
      <HofSperreDialog wahl={sperre} onClose={() => setSperre(null)} />
    </div>
  )
}

function Abschnitt({ titel, satz, children }: { titel: string; satz: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section aria-label={titel} className={cn(KARTE, 'flex flex-col gap-3 p-4 md:p-5')}>
      <div>
        <h2 className="text-[16px] font-semibold text-foreground">{titel}</h2>
        <p className={cn('text-[12.5px]', LEISE)}>{satz}</p>
      </div>
      {children}
    </section>
  )
}

function Eintrag({ titel, children }: { titel: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <dt className={LEISE}>{titel}</dt>
      <dd className="min-w-0 text-foreground">{children}</dd>
    </>
  )
}

function Kennzahl({ titel, wert, satz }: { titel: string; wert: string; satz: string | null }): React.JSX.Element {
  return (
    <div>
      <dt className={cn('text-[12.5px]', LEISE)}>{titel}</dt>
      <dd className="font-heading text-[22px] font-semibold text-foreground tabular-nums">{wert}</dd>
      {satz && <dd className={cn('text-[12.5px]', LEISE)}>{satz}</dd>}
    </div>
  )
}
