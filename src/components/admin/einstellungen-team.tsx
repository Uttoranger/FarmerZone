'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ShieldCheck, UserPlus } from 'lucide-react'
import { ADMIN_RECHTE, ADMIN_RECHT_TEXT, type EinstellbaresAdminRecht } from '@/lib/admin-rechte'
import { TEAM_TEXT as T, TEAM_VORLAGEN } from '@/lib/admin-team'
import { einstellungenGruppeHref } from '@/lib/plattform-einstellung'
import { EMAIL_MAX } from '@/lib/eingabegrenzen'
import { cn } from '@/lib/utils'
import { entfernePerson, ladePersonEin, setzeInhaber, setzeTeamRechte } from '@/server/actions/team'
import type { TeamDaten, TeamPerson } from '@/server/queries/team'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, KNOPF_GRUEN, KNOPF_ORANGE_RAHMEN, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { StatusBadge } from '@/components/ui/status-badge'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'

/** Eine leise Zeile unter jedem Recht (Mockup admin-einstellungen-team). */
const RECHT_SATZ: Partial<Record<EinstellbaresAdminRecht, string>> = {
  mails_nochmal: 'mit Passkey',
  adresse_anzeigen: 'mit Grund, steht im Protokoll',
  hof_sperren_storno: 'mit Grund, Hof wird informiert',
  notbremse: 'stoppt alle Höfe',
}

/**
 * Einstellungen › Team (Register N35, Nr. 190; Mockup admin-einstellungen-team)
 * — nur für Inhaber. Links die Personen, rechts die Rechte der gewählten
 * Person als Schalter (`role="switch"`, 44 px) mit den zwei Vorlagen;
 * „ansehen“ immer an, Team und Notfallzugang nur Inhaber. Jede Änderung
 * fragt frisch nach dem Passkey (useFrischBestaetigt) und schickt der Person
 * eine Mail; die Passkey-Dialoge stehen neben den Dialogen.
 */
export function EinstellungenTeam({ daten }: { daten: TeamDaten }): React.JSX.Element {
  const andere = daten.personen.filter((p) => !p.du)
  const [gewaehlt, setGewaehlt] = useState<string | null>(andere[0]?.id ?? null)
  const [einladen, setEinladen] = useState(false)
  const person = daten.personen.find((p) => p.id === gewaehlt) ?? null
  const inhaber = daten.personen.filter((p) => p.inhaber).length

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <p className={cn('text-[13px]', LEISE)}>{T.zeile(inhaber, daten.personen.length - inhaber)}</p>
        <button type="button" onClick={() => setEinladen(true)} className={KNOPF_RAHMEN}>
          <UserPlus className="mr-1.5 size-4" strokeWidth={1.8} aria-hidden="true" />
          {T.einladen}
        </button>
      </div>

      <ul className="flex flex-col gap-2" aria-label={T.titel}>
        {daten.personen.map((p) => (
          <li key={p.id}>
            <PersonZeile person={p} gewaehlt={p.id === gewaehlt} onWaehle={() => setGewaehlt(p.id)} />
          </li>
        ))}
      </ul>
      {andere.length === 0 && <p className={cn('text-[13.5px]', LEISE)}>{T.leer}</p>}

      {/* key: Schalter starten bei jedem Wechsel der Person mit ihrem gespeicherten Stand. */}
      {person && !person.du && <RechteKarte key={`${person.id}-${person.rechte.join(',')}-${person.inhaber}`} person={person} />}

      <p className={cn('text-[12.5px] leading-relaxed', LEISE)}>{T.regel}</p>

      <section aria-labelledby="notfall-titel" className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3.5">
        <h3 id="notfall-titel" className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
          <ShieldCheck className="size-4" strokeWidth={1.8} aria-hidden="true" />
          {T.notfallTitel}
        </h3>
        <p className="text-[13.5px] leading-relaxed text-foreground">{T.notfallSatz}</p>
        <p className={cn('text-[12.5px]', LEISE)}>{T.notfallOffen}</p>
        <Link
          href={einstellungenGruppeHref('anmeldung')}
          className={cn('inline-flex min-h-11 items-center self-start rounded-full text-[14px] font-semibold text-status-fertig underline underline-offset-2', FOKUS_RAHMEN)}
        >
          {T.notfallLink}
        </Link>
      </section>

      <EinladenDialog key={`einladen-${einladen}`} offen={einladen} onClose={() => setEinladen(false)} />
    </div>
  )
}

function PersonZeile({ person, gewaehlt, onWaehle }: { person: TeamPerson; gewaehlt: boolean; onWaehle: () => void }): React.JSX.Element {
  const unterzeile = person.inhaber
    ? [T.inhaber, T.passkeys(person.passkeys), T.ersatzcodes(person.ersatzcodes)]
    : [T.rechteZahl(person.rechte.length), person.eingeladenAm ? T.seit(person.eingeladenAm) : null, person.passkeys === 0 ? T.passkeyFehlt : T.passkeys(person.passkeys)]
  const inhalt = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-foreground">{person.du ? T.du : person.name}</span>
        <span className={cn('block text-[12.5px]', LEISE)}>{unterzeile.filter(Boolean).join(' · ')}</span>
      </span>
      {person.inhaber ? (
        <StatusBadge status="fertig">{T.inhaber}</StatusBadge>
      ) : person.passkeys === 0 ? (
        <StatusBadge status="offen">{T.eingeladenMarke}</StatusBadge>
      ) : null}
    </>
  )
  const rahmen = cn('flex min-h-14 w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left', gewaehlt ? 'border-foreground' : 'border-border')
  // Die eigene Zeile hat nichts zu wählen — eigene Rechte ändert man nicht hier.
  if (person.du) return <div className={rahmen}>{inhalt}</div>
  return (
    <button type="button" onClick={onWaehle} aria-pressed={gewaehlt} className={cn(rahmen, 'hover:bg-muted', FOKUS_RAHMEN)}>
      {inhalt}
    </button>
  )
}

function Schalter({ an, gesperrt, titel, satz, onUmschalten }: { an: boolean; gesperrt?: boolean; titel: string; satz?: string; onUmschalten?: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      aria-disabled={gesperrt || undefined}
      onClick={gesperrt ? undefined : onUmschalten}
      className={cn('flex min-h-11 w-full items-center gap-3 rounded-xl px-1 py-2 text-left', !gesperrt && 'hover:bg-muted', FOKUS_RAHMEN)}
    >
      <span aria-hidden="true" className={cn('relative block h-6 w-10 shrink-0 rounded-full transition-colors duration-[250ms]', an ? 'bg-accent' : 'bg-border', gesperrt && 'opacity-60')}>
        <span
          className={cn(
            'absolute top-[3px] block size-[18px] rounded-full transition-transform duration-[250ms]',
            an ? 'translate-x-[19px] bg-accent-foreground' : 'translate-x-[3px] bg-muted-foreground'
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-foreground">{titel}</span>
        {satz && <span className={cn('block text-[12.5px]', LEISE)}>{satz}</span>}
      </span>
    </button>
  )
}

function RechteKarte({ person }: { person: TeamPerson }): React.JSX.Element {
  const [rechte, setRechte] = useState<EinstellbaresAdminRecht[]>(person.rechte)
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, startTransition] = useTransition()
  const [frage, setFrage] = useState<'inhaber' | 'entfernen' | null>(null)
  const frischRechte = useFrischBestaetigt(setzeTeamRechte)
  const geaendert = rechte.join(',') !== person.rechte.join(',')

  function umschalten(r: EinstellbaresAdminRecht): void {
    setRechte((alt) => (alt.includes(r) ? alt.filter((x) => x !== r) : ADMIN_RECHTE.filter((x) => x === r || alt.includes(x))))
  }

  function speichern(): void {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await frischRechte.ausfuehren({ userId: person.id, rechte })
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      toast.success(T.gespeichert)
    })
  }

  return (
    <section aria-labelledby="rechte-titel" className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3.5">
      {frischRechte.dialog}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="rechte-titel" className="text-[15px] font-semibold text-foreground">
          {T.rechteVon(person.name)}
        </h3>
        <span className={cn('text-[12.5px]', LEISE)}>{T.rechteSatz}</span>
      </div>
      {!person.inhaber && (
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('text-[13px]', LEISE)}>{T.vorlage}</span>
          {Object.values(TEAM_VORLAGEN).map((v) => (
            <button key={v.name} type="button" onClick={() => setRechte([...v.rechte])} className={KNOPF_RAHMEN}>
              {v.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col [&>*+*]:border-t [&>*+*]:border-border">
        <Schalter an gesperrt titel={T.ansehen} satz={`${T.ansehenSatz} · ${T.immer}`} />
        {ADMIN_RECHTE.map((r) => (
          <Schalter
            key={r}
            an={person.inhaber || rechte.includes(r)}
            gesperrt={person.inhaber}
            titel={ADMIN_RECHT_TEXT[r]}
            satz={RECHT_SATZ[r]}
            onUmschalten={() => umschalten(r)}
          />
        ))}
        <Schalter an={person.inhaber} gesperrt titel={ADMIN_RECHT_TEXT.team} satz={`kann nie weitergegeben werden · ${T.nurInhaber}`} />
        <Schalter an={person.inhaber} gesperrt titel={ADMIN_RECHT_TEXT.notfallzugang} satz={T.nurInhaber} />
      </div>
      <DialogFehler text={fehler} />
      <div className="flex flex-wrap gap-2.5">
        {!person.inhaber && (
          <button type="button" onClick={speichern} disabled={!geaendert || laeuft} aria-busy={laeuft || undefined} className={KNOPF_GRUEN}>
            {laeuft ? 'Einen Moment …' : T.speichern}
          </button>
        )}
        <button type="button" onClick={() => setFrage('inhaber')} className={KNOPF_RAHMEN}>
          {person.inhaber ? T.inhaberEntziehen : T.inhaberMachen}
        </button>
        <button type="button" onClick={() => setFrage('entfernen')} className={KNOPF_ORANGE_RAHMEN}>
          {T.entfernen}
        </button>
      </div>
      <PersonFrage key={`frage-${frage}`} frage={frage} person={person} onClose={() => setFrage(null)} />
    </section>
  )
}

function PersonFrage({ frage, person, onClose }: { frage: 'inhaber' | 'entfernen' | null; person: TeamPerson; onClose: () => void }): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const frischInhaber = useFrischBestaetigt(setzeInhaber)
  const frischEntfernen = useFrischBestaetigt(entfernePerson)
  const machen = !person.inhaber

  function bestaetigen(): void {
    setFehler(null)
    startTransition(async () => {
      const ergebnis =
        frage === 'entfernen' ? await frischEntfernen.ausfuehren({ userId: person.id }) : await frischInhaber.ausfuehren({ userId: person.id, inhaber: machen })
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      toast.success(T.erledigt)
      onClose()
    })
  }

  return (
    <>
      {frischInhaber.dialog}
      {frischEntfernen.dialog}
      <BestellDialog
        offen={frage !== null}
        onOffenChange={(o) => !o && onClose()}
        titel={frage === 'entfernen' ? T.entfernenTitel(person.name) : T.inhaberTitel(person.name, machen)}
        hauptaktion={{ text: T.bestaetigen, onClick: bestaetigen, ton: frage === 'entfernen' || !machen ? 'orange' : 'gruen', laeuft }}
      >
        <div className="flex flex-col gap-3">
          <p className="text-[14px] leading-relaxed text-foreground">{frage === 'entfernen' ? T.entfernenSatz : T.inhaberSatz(machen)}</p>
          <DialogFehler text={fehler} />
        </div>
      </BestellDialog>
    </>
  )
}

function EinladenDialog({ offen, onClose }: { offen: boolean; onClose: () => void }): React.JSX.Element {
  const [laeuft, startTransition] = useTransition()
  const [adresse, setAdresse] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const frisch = useFrischBestaetigt(ladePersonEin)

  function bestaetigen(): void {
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await frisch.ausfuehren({ adresse })
      if ('error' in ergebnis) return setFehler(ergebnis.error)
      toast.success(T.eingeladen)
      onClose()
    })
  }

  return (
    <>
      {frisch.dialog}
      <BestellDialog
        offen={offen}
        onOffenChange={(o) => !o && onClose()}
        titel={T.einladenTitel}
        hauptaktion={{ text: T.einladenKnopf, onClick: bestaetigen, ton: 'gruen', laeuft, gesperrt: adresse.trim() === '' }}
      >
        <div className="flex flex-col gap-3">
          <p className="text-[14px] leading-relaxed text-foreground">{T.einladenSatz}</p>
          <div>
            <label htmlFor="team-adresse" className={FELD_LABEL}>
              {T.einladenFeld}
            </label>
            <input
              id="team-adresse"
              type="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              maxLength={EMAIL_MAX}
              value={adresse}
              aria-invalid={fehler !== null || undefined}
              onChange={(e) => setAdresse(e.target.value)}
              className={cn(FELD, 'min-h-11')}
            />
          </div>
          <DialogFehler text={fehler} />
        </div>
      </BestellDialog>
    </>
  )
}
