import Link from 'next/link'
import { Check, Mail, MailCheck } from 'lucide-react'
import type { EinrichtenSchritt, EinrichtenStand } from '@/lib/einrichten'
import { PRO_MONAT, VOLLER_WARENPREIS, tarifKarte, type TarifId } from '@/lib/konditionen'
import { KONTAKT_EMAIL } from '@/lib/support'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HofAnlegenFormular } from '@/components/einrichten/hof-anlegen-formular'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { ErneutSendenKnopf } from '@/components/email-bestaetigung/erneut-senden'

/*
 * „Hof einrichten" (/onboarding, Gate 5 Nr. 15) nach den Mockups
 * web-h1-einrichten und mobil-h1-einrichten: Kopf, Fortschritt, sechs
 * Schritte als Karten, rechts Tarif und Hilfe. Was ein Schritt sagt und
 * wohin er führt, entscheidet src/lib/einrichten.ts — hier wird gezeichnet.
 */

const KNOPF_BASIS = cn(
  'inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-[18px] text-[14px] font-semibold transition-colors duration-[250ms]',
  FOKUS_RAHMEN
)
const KNOPF_ORANGE = cn(KNOPF_BASIS, 'border border-primary-foreground/30 bg-primary text-primary-foreground hover:opacity-90')
const KNOPF_UMRISS = cn(KNOPF_BASIS, 'border border-border font-medium text-foreground hover:bg-muted')

const ZUSTAND_TEXT: Record<EinrichtenSchritt['zustand'], string> = {
  erledigt: 'erledigt',
  offen: 'offen',
  gesperrt: 'kommt später',
  wartet: 'wartet auf uns',
  hinweis: 'nur zur Info',
}

function Zeichen({ schritt }: { schritt: EinrichtenSchritt }) {
  if (schritt.zustand === 'erledigt') {
    return (
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Check className="size-4" strokeWidth={2.2} />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-[12.5px] font-semibold',
        schritt.zustand === 'offen' ? 'border-status-offen text-status-offen' : 'border-border text-muted-foreground'
      )}
    >
      {schritt.nummer}
    </span>
  )
}

function SchrittKarte({ schritt, person }: { schritt: EinrichtenSchritt; person: { name: string; email: string } }) {
  const offen = schritt.zustand === 'offen'
  const leise = schritt.zustand === 'gesperrt' || schritt.zustand === 'wartet' || schritt.zustand === 'hinweis'
  const aktion = schritt.aktion
  return (
    <li
      aria-current={offen && aktion?.art === 'formular' ? 'step' : undefined}
      className={cn('rounded-2xl border bg-card p-4 md:px-5', offen ? 'border-primary/60' : 'border-border')}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Zeichen schritt={schritt} />
          <div className="min-w-0 flex-1">
            <h3 className={cn('text-[15px] font-semibold', leise && 'text-muted-foreground')}>
              <span className="md:hidden">{schritt.titelKurz}</span>
              <span className="hidden md:inline">{schritt.titel}</span>
              <span className="sr-only"> ({ZUSTAND_TEXT[schritt.zustand]})</span>
            </h3>
            <p className="text-[13px] leading-snug break-words text-muted-foreground">
              <span className="md:hidden">{schritt.textKurz}</span>
              <span className="hidden md:inline">{schritt.text}</span>
            </p>
          </div>
        </div>
        {aktion?.art === 'link' && (
          <Link href={aktion.href} className={cn(aktion.primaer ? KNOPF_ORANGE : KNOPF_UMRISS, 'w-full md:w-auto')}>
            {aktion.label}
          </Link>
        )}
      </div>
      {aktion?.art === 'formular' && <HofAnlegenFormular personName={person.name} email={person.email} />}
    </li>
  )
}

function Fortschritt({ stand, freigeschaltet }: { stand: EinrichtenStand; freigeschaltet: boolean }) {
  const prozent = Math.round((stand.erledigt / stand.gesamt) * 100)
  return (
    <section aria-labelledby="einrichten-stand" className="rounded-2xl border border-border bg-card p-4 md:px-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="einrichten-stand" className="font-heading text-[17px] font-semibold md:text-lg">
          <span className="md:hidden">{stand.ueberschriftKurz}</span>
          <span className="hidden md:inline">{stand.ueberschrift}</span>
        </h2>
        <span className="shrink-0 text-[15px] font-semibold text-status-fertig">
          {stand.erledigt} von {stand.gesamt}
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby="einrichten-stand"
        aria-valuemin={0}
        aria-valuemax={stand.gesamt}
        aria-valuenow={stand.erledigt}
        aria-valuetext={`${stand.erledigt} von ${stand.gesamt} Schritten erledigt`}
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${prozent}%` }} />
      </div>
      {!freigeschaltet && (
        <p className="mt-3 hidden text-[13px] text-muted-foreground md:block">
          Profil und Produkte kannst du in Ruhe vorbereiten. Kunden sehen deinen Hof erst nach der Freischaltung.
        </p>
      )}
    </section>
  )
}

function TarifKarte({ tarif }: { tarif: TarifId | null }) {
  const karte = tarifKarte(tarif)
  return (
    <section aria-labelledby="einrichten-tarif" className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <h2 id="einrichten-tarif" className="text-[12px] font-bold tracking-[1.6px] text-muted-foreground uppercase">
        {karte.titel}
      </h2>
      <ul className="mt-2 flex flex-col gap-1.5">
        {karte.tarife.map((t) => (
          <li key={t.id} className="flex items-baseline justify-between gap-3">
            <span className="font-heading text-lg font-semibold">{t.name}</span>
            <span>
              <span className="font-heading text-lg font-semibold">{t.preis}</span>{' '}
              <span className="text-[12.5px] text-muted-foreground">{PRO_MONAT}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[13px] text-foreground">{VOLLER_WARENPREIS}</p>
      <Link
        href="/konditionen"
        className={cn(
          'mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full text-[14px] font-semibold text-status-fertig hover:underline',
          FOKUS_RAHMEN
        )}
      >
        Konditionen ansehen
      </Link>
    </section>
  )
}

function HilfeKarte() {
  return (
    <section aria-labelledby="einrichten-hilfe" className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <h2 id="einrichten-hilfe" className="text-[12px] font-bold tracking-[1.6px] text-muted-foreground uppercase">
        Hilfe
      </h2>
      {/* „Rückruf anfordern" (Mockup) braucht RueckrufAnfrage — nicht freigegeben. */}
      <p className="mt-2 text-[13.5px]">Fragen beim Einrichten? Schreib uns, wir melden uns.</p>
      <a
        href={`mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent('Fragen beim Einrichten')}`}
        className={cn(KNOPF_UMRISS, 'mt-3 w-full gap-2')}
      >
        <Mail className="size-4" strokeWidth={1.7} aria-hidden="true" />
        E-Mail schreiben
      </a>
    </section>
  )
}

/**
 * „Bestätige deine E-Mail" (S3, Nr. 17b) — kein Mockup, gebaut nach
 * DESIGN_SYSTEM.md als orange Hinweiskarte (Hof, Offenes) über dem
 * Fortschritt. „Erneut senden" als Umriss: Der eine orange Knopf der Seite
 * bleibt „Mit Stripe einrichten".
 */
function EmailBestaetigenHinweis({ email, warteSekunden }: { email: string; warteSekunden: number }): React.JSX.Element {
  return (
    <Hinweiskarte
      ton="orange"
      symbol={MailCheck}
      titel="Bestätige deine E-Mail"
      aktion={<ErneutSendenKnopf warteSekunden={warteSekunden} />}
    >
      <p>
        Wir haben dir einen Link an <strong className="font-semibold break-all">{email}</strong> geschickt. Einrichten
        kannst du schon jetzt – Fotos hochladen und die Freischaltung gehen, sobald die Adresse bestätigt ist.
      </p>
    </Hinweiskarte>
  )
}

export function EinrichtenSeite({
  stand,
  vorname,
  person,
  tarif,
  freigeschaltet,
  emailBestaetigung = null,
}: {
  stand: EinrichtenStand
  vorname: string
  person: { name: string; email: string }
  tarif: TarifId | null
  freigeschaltet: boolean
  /** Nur wenn die Bestätigung aussteht (bestaetigungOffen, frisch aus der Datenbank). */
  emailBestaetigung?: { email: string; warteSekunden: number } | null
}): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pt-5 pb-12 md:px-8 md:pt-8">
      <header className="mb-5">
        <h1 className="font-heading text-[24px] leading-tight font-semibold break-words md:text-[28px]">
          {vorname ? `Willkommen, ${vorname}` : 'Willkommen'}
        </h1>
        <p className="mt-0.5 text-[14px] text-muted-foreground">So wird dein Hof startklar</p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7">
        <div className="flex min-w-0 flex-col gap-3">
          {emailBestaetigung && <EmailBestaetigenHinweis {...emailBestaetigung} />}
          <Fortschritt stand={stand} freigeschaltet={freigeschaltet} />
          <section aria-labelledby="einrichten-schritte">
            <h2 id="einrichten-schritte" className="sr-only">
              Schritte
            </h2>
            <ol className="flex flex-col gap-3">
              {stand.schritte.map((s) => (
                <SchrittKarte key={s.id} schritt={s} person={person} />
              ))}
            </ol>
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <TarifKarte tarif={tarif} />
          <HilfeKarte />
        </div>
      </div>
    </div>
  )
}
