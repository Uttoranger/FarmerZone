import Link from 'next/link'
import { Check, Info, MailCheck } from 'lucide-react'
import { warteStand, type EinrichtenSchritt, type EinrichtenStand } from '@/lib/einrichten'
import { KONDITIONEN_UEBERGANG, PRO_MONAT, tarifKarte, vollerWarenpreis, type TarifId } from '@/lib/konditionen'
import type { GebuehrModell } from '@/lib/plattformgebuehr'
import { KONTAKT_EMAIL } from '@/lib/support'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HofAnlegenFormular } from '@/components/einrichten/hof-anlegen-formular'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { ErneutSendenKnopf } from '@/components/email-bestaetigung/erneut-senden'
import { AgbZustimmenKarte } from '@/components/heute/agb-karte'
import type { AgbKartenStichtag } from '@/lib/agb-zustimmung'
import type { AgbKennung } from '@/lib/rechtstexte/agb-fassung'
import { WarteBalken } from '@/components/hofbereich/hof-balken'
import { textlinkKlassen } from '@/components/ui/textlink'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
// Umriss 52 px, 16 px fett (Board w2-registrieren „E-Mail schreiben“) — dieselbe Quelle wie Anmelden und Passwort.
import { KNOPF_UMRISS_KRAEFTIG } from '@/components/anmelden/stil'

/*
 * „Hof einrichten" (/onboarding, Gate 5 Nr. 15) nach den Mockups
 * web-h1-einrichten und mobil-h1-einrichten: Kopf, Fortschritt, sechs
 * Schritte als Karten, rechts Tarif und Hilfe. Was ein Schritt sagt und
 * wohin er führt, entscheidet src/lib/einrichten.ts — hier wird gezeichnet.
 *
 * Seit Lauf 30 (Boards s2/w2-registrieren): EINE h1 je Seite — in der HofShell
 * „Hof einrichten“ mit dem Hofnamen und dem Warte-Balken darunter, in der
 * Fokus-Shell trägt die Shell die h1; der Gruß „Willkommen“ ist immer h2.
 * Der Stand steht in Worten neben jedem Schritt, die Schritte als eine Liste.
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
  // Board s2-/w2-registrieren, Bild 5/6: offen und später als leerer Kreis ohne Ziffer, der Hinweis (Lastschrift) als „i“.
  if (schritt.zustand === 'hinweis') {
    return (
      // Liste Lauf 32 (registrieren): eine graue Scheibe statt eines Umrisses.
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Info className="size-4" strokeWidth={2} />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn('size-7 shrink-0 rounded-full border-2', schritt.zustand === 'offen' ? 'border-status-offen' : 'border-border')}
    />
  )
}

function SchrittKarte({ schritt, person }: { schritt: EinrichtenSchritt; person: { name: string } }) {
  const offen = schritt.zustand === 'offen'
  const leise = schritt.zustand === 'gesperrt' || schritt.zustand === 'wartet' || schritt.zustand === 'hinweis'
  const aktion = schritt.aktion
  // Der Hinweis (Lastschrift) nennt statt eines Stands, wofür er gilt (Board: „für Barbestellungen“).
  const standWort = schritt.zustand === 'hinweis' ? schritt.textKurz : ZUSTAND_TEXT[schritt.zustand]
  return (
    <li aria-current={offen && aktion?.art === 'formular' ? 'step' : undefined} className="p-4 md:px-5">
      <div className="flex items-start gap-3">
        <Zeichen schritt={schritt} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className={cn('min-w-0 text-[15px] font-semibold', leise && schritt.zustand !== 'hinweis' && 'text-muted-foreground')}>
              {schritt.titel}
            </h3>
            {/* Der Stand in Worten, nicht nur als Farbe (Board: „erledigt“, „offen“, „kommt später“). */}
            <span className="shrink-0 text-[12.5px] text-muted-foreground">{standWort}</span>
          </div>
          <p className="mt-0.5 text-[13px] leading-snug break-words text-muted-foreground">{schritt.text}</p>
          {aktion?.art === 'link' && (
            <Link
              href={aktion.href}
              className={cn(
                // Der Textlink unterstrichen wie im Board (Liste Lauf 32, registrieren: „Link nicht unterstrichen“).
                aktion.primaer ? KNOPF_ORANGE : schritt.zustand === 'hinweis' ? cn(textlinkKlassen({ ton: 'gruen' }), 'underline') : KNOPF_UMRISS,
                'mt-2.5'
              )}
            >
              {aktion.label}
            </Link>
          )}
        </div>
      </div>
      {aktion?.art === 'formular' && <HofAnlegenFormular personName={person.name} />}
    </li>
  )
}

function Fortschritt({ stand, freigeschaltet }: { stand: EinrichtenStand; freigeschaltet: boolean }) {
  const prozent = Math.round((stand.erledigt / stand.gesamt) * 100)
  return (
    <section aria-labelledby="einrichten-stand" className="rounded-2xl border border-border bg-card p-4 md:px-5">
      <h2 id="einrichten-stand" className="font-heading text-[17px] font-semibold md:text-lg">
        {stand.ueberschrift}
      </h2>
      <div
        role="progressbar"
        aria-labelledby="einrichten-stand"
        aria-valuemin={0}
        aria-valuemax={stand.gesamt}
        aria-valuenow={stand.erledigt}
        aria-valuetext={stand.ueberschrift}
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${prozent}%` }} />
      </div>
      {!freigeschaltet && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Profil und Produkte kannst du in Ruhe vorbereiten. Kundinnen sehen deinen Hof erst nach der Freischaltung.
        </p>
      )}
    </section>
  )
}

function TarifKarte({ tarif, gebuehrModell }: { tarif: TarifId | null; gebuehrModell: GebuehrModell }) {
  const karte = tarifKarte(tarif)
  return (
    <section aria-labelledby="einrichten-tarif" className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <h2 id="einrichten-tarif" className="font-heading text-[17px] font-semibold">
        {karte.titel}
      </h2>
      <ul className="mt-2 flex flex-col divide-y divide-border">
        {karte.tarife.map((t) => (
          <li key={t.id} className="flex items-baseline justify-between gap-3 py-2.5">
            <span className="text-[14px]">{t.name}</span>
            <span className="text-[14px]">
              {t.preis} <span className="text-muted-foreground">{PRO_MONAT}</span>
            </span>
          </li>
        ))}
      </ul>
      {/* Die Preise gelten erst ab dem Stichtag (Register K1). */}
      <p className="mt-2 text-[13px] leading-normal text-muted-foreground">{KONDITIONEN_UEBERGANG}</p>
      {/* Das Wort der Gebühr je Modell (N38, Nr. 221): ab dem Stichtag die Plattformgebühr. */}
      <p className="mt-2 text-[13px] text-muted-foreground">{vollerWarenpreis(gebuehrModell)}</p>
      <Link href="/konditionen" className={cn(textlinkKlassen({ ton: 'gruen' }), 'mt-1 underline')}>
        Konditionen ansehen
      </Link>
    </section>
  )
}

function HilfeKarte() {
  return (
    <section aria-labelledby="einrichten-hilfe" className="rounded-2xl border border-border bg-card p-4 md:p-5">
      <h2 id="einrichten-hilfe" className="font-heading text-[17px] font-semibold">
        Hilfe
      </h2>
      {/* „Rückruf anfordern" (Mockup) braucht RueckrufAnfrage — nicht freigegeben. */}
      <p className="mt-2 text-[13.5px]">Fragen beim Einrichten? Schreib uns, wir melden uns.</p>
      {/* Liste Lauf 32 (registrieren): kräftiger Rand, fett, ohne Symbol — wie „E-Mail schreiben“ beim Registrieren. */}
      <a
        href={`mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent('Fragen beim Einrichten')}`}
        className={cn(KNOPF_UMRISS_KRAEFTIG, 'mt-3')}
      >
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
  gebuehrModell,
  kopf = null,
  emailBestaetigung = null,
  agb = null,
}: {
  stand: EinrichtenStand
  vorname: string
  person: { name: string; email: string }
  tarif: TarifId | null
  freigeschaltet: boolean
  /** Modell der Gebühr heute (gebuehrModellFuer) — das Wort in der Tarif-Karte (N38). */
  gebuehrModell: GebuehrModell
  /**
   * Nur in der HofShell: Titel „Hof einrichten“ als h1 mit dem Hofnamen und,
   * solange der Hof nicht freigeschaltet ist, der Warte-Balken (N42 e). Ohne
   * Kopf trägt die Fokus-Shell die h1.
   */
  kopf?: { hofName: string; warten: { farmId: string; farmName: string; country: string } | null } | null
  /** Nur wenn die Bestätigung aussteht (bestaetigungOffen, frisch aus der Datenbank). */
  emailBestaetigung?: { email: string; warteSekunden: number } | null
  /** Nr. 207: Der Hof hat der aktuellen AGB-Fassung noch nicht zugestimmt — die Karte „AGB bestätigen“ (ohne Hof: null). */
  agb?: { fassung: AgbKennung; geaendert: boolean; stichtag: AgbKartenStichtag } | null
}): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pt-5 pb-12 md:px-8 md:pt-8">
      {/* Liste Lauf 32 (registrieren Bild 5): der Werkzeug-Kopf (G1) — am Handy die feste Leiste, im Web h1 und Hofname;
          darunter in der Inhaltsspalte der Hinweiskasten (G3). Einen Rückweg zeigt er, sobald `elternseite` einen kennt. */}
      {kopf && (
        <header className="mb-4">
          <WerkzeugKopf
            titel="Hof einrichten"
            unterzeile={<p className="truncate text-[13px] leading-snug text-muted-foreground md:text-sm">{kopf.hofName}</p>}
          />
          {kopf.warten && (
            <div className="print:hidden">
              <WarteBalken {...kopf.warten} stand={warteStand(stand)} />
            </div>
          )}
        </header>
      )}
      <div className="mb-5">
        <h2 className="font-heading text-[20px] leading-tight font-semibold break-words md:text-[22px]">
          {vorname ? `Willkommen, ${vorname}` : 'Willkommen'}
        </h2>
        <p className="mt-0.5 text-[14px] text-muted-foreground">So wird dein Hof startklar</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-7">
        <div className="flex min-w-0 flex-col gap-3">
          {emailBestaetigung && <EmailBestaetigenHinweis {...emailBestaetigung} />}
          {agb && <AgbZustimmenKarte fassung={agb.fassung} geaendert={agb.geaendert} stichtag={agb.stichtag} />}
          <Fortschritt stand={stand} freigeschaltet={freigeschaltet} />
          <section aria-labelledby="einrichten-schritte">
            <h2 id="einrichten-schritte" className="sr-only">
              Schritte
            </h2>
            <ol className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
              {stand.schritte.map((s) => (
                <SchrittKarte key={s.id} schritt={s} person={person} />
              ))}
            </ol>
          </section>
        </div>
        <div className="flex flex-col gap-4">
          <TarifKarte tarif={tarif} gebuehrModell={gebuehrModell} />
          <HilfeKarte />
        </div>
      </div>
    </div>
  )
}
