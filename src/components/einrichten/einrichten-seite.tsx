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
// Karten 16 px wie im Board (G8) — feste Pixel statt der Tailwind-Rundung, die mit --radius wächst.
import { RUNDUNG } from '@/components/ui/rundung'

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
// Der eine orange Knopf am ersten offenen Schritt (Board w2-registrieren, Bild 5 „Weiter“): 44 px, 14 px Rundung, 16 px fett.
const KNOPF_ORANGE = cn(
  'inline-flex min-h-11 shrink-0 items-center justify-center rounded-[14px] bg-primary px-[18px] text-[16px] font-bold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90',
  FOKUS_RAHMEN
)
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
      <span aria-hidden="true" className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Check className="size-4" strokeWidth={2.2} />
      </span>
    )
  }
  // Board s2-/w2-registrieren, Bild 5/6: offen und später als leerer Kreis ohne Ziffer, der Hinweis (Lastschrift) als „i“.
  if (schritt.zustand === 'hinweis') {
    return (
      // Liste Lauf 32 (registrieren): eine graue Scheibe statt eines Umrisses.
      <span aria-hidden="true" className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Info className="size-4" strokeWidth={2} />
      </span>
    )
  }
  return (
    <span
      aria-hidden="true"
      // Offen ein oranger Ring, später gestrichelt im Feldrand (Board w2-registrieren, Bild 5).
      className={cn(
        'size-[26px] shrink-0 rounded-full',
        schritt.zustand === 'offen' ? 'border-2 border-status-offen' : 'border-[1.5px] border-dashed border-input'
      )}
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
    <li aria-current={offen && aktion?.art === 'formular' ? 'step' : undefined} className="px-3.5 py-3">
      <div className="flex items-start gap-3">
        <Zeichen schritt={schritt} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className={cn('min-w-0 text-[15px] font-semibold', leise && schritt.zustand !== 'hinweis' && 'text-muted-foreground')}>
              {schritt.titel}
            </h3>
            {/* Der Stand in Worten, nicht nur als Farbe (Board: „erledigt“, „offen“, „kommt später“). */}
            <span className="shrink-0 text-[13px] text-muted-foreground">{standWort}</span>
          </div>
          <p className="mt-1 text-[14px] leading-snug break-words text-muted-foreground">{schritt.text}</p>
          {aktion?.art === 'link' && (
            <Link
              href={aktion.href}
              className={cn(
                // Der Textlink unterstrichen wie im Board (Liste Lauf 32, registrieren: „Link nicht unterstrichen“).
                aktion.primaer ? KNOPF_ORANGE : schritt.zustand === 'hinweis' ? cn(textlinkKlassen({ ton: 'gruen' }), 'underline') : KNOPF_UMRISS,
                'mt-2'
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
    <section aria-labelledby="einrichten-stand" className={cn('flex flex-col gap-2 border border-border bg-card p-3.5', RUNDUNG.blatt)}>
      <h2 id="einrichten-stand" className="font-heading text-[17px] font-semibold">
        {stand.ueberschrift}
      </h2>
      <div
        role="progressbar"
        aria-labelledby="einrichten-stand"
        aria-valuemin={0}
        aria-valuemax={stand.gesamt}
        aria-valuenow={stand.erledigt}
        aria-valuetext={stand.ueberschrift}
        className="h-2.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${prozent}%` }} />
      </div>
      {!freigeschaltet && (
        <p className="text-[14px] text-muted-foreground">
          Profil und Produkte kannst du in Ruhe vorbereiten. Kundinnen sehen deinen Hof erst nach der Freischaltung.
        </p>
      )}
    </section>
  )
}

function TarifKarte({ tarif, gebuehrModell }: { tarif: TarifId | null; gebuehrModell: GebuehrModell }) {
  const karte = tarifKarte(tarif)
  return (
    <section aria-labelledby="einrichten-tarif" className={cn('border border-border bg-card p-3.5', RUNDUNG.blatt)}>
      <h2 id="einrichten-tarif" className="font-heading text-[17px] font-semibold">
        {karte.titel}
      </h2>
      <ul className="mt-1 flex flex-col divide-y divide-border">
        {karte.tarife.map((t) => (
          <li key={t.id} className="flex min-h-10 items-center justify-between gap-3 py-1.5">
            <span className="text-[15px]">{t.name}</span>
            <span className="text-[15px] whitespace-nowrap">
              {t.preis} <span className="text-muted-foreground">{PRO_MONAT}</span>
            </span>
          </li>
        ))}
      </ul>
      {/* Die Preise gelten erst ab dem Stichtag (Register K1). */}
      <p className="mt-1 text-[14px] leading-normal text-muted-foreground">{KONDITIONEN_UEBERGANG}</p>
      {/* Das Wort der Gebühr je Modell (N38, Nr. 221): ab dem Stichtag die Plattformgebühr. */}
      <p className="mt-1 text-[14px] text-muted-foreground">{vollerWarenpreis(gebuehrModell)}</p>
      <Link href="/konditionen" className={cn(textlinkKlassen({ ton: 'gruen' }), 'mt-1 underline')}>
        Konditionen ansehen
      </Link>
    </section>
  )
}

function HilfeKarte() {
  return (
    <section aria-labelledby="einrichten-hilfe" className={cn('border border-border bg-card p-3.5', RUNDUNG.blatt)}>
      <h2 id="einrichten-hilfe" className="font-heading text-[17px] font-semibold">
        Hilfe
      </h2>
      {/* „Rückruf anfordern" (Mockup) braucht RueckrufAnfrage — nicht freigegeben. */}
      <p className="mt-2 text-[15px]">Fragen beim Einrichten? Schreib uns, wir melden uns.</p>
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
 * Fortschritt. „Erneut senden" als Umriss: Orange bleibt allein der Knopf am
 * ersten offenen Schritt (einrichtenStand, Nr. 275).
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
    // Inhaltsbreite des Boards: 896 px (Antwort 5 der Projektleitung, N48), mit 40 px Rand im Web links bündig an der
    // Seitenleiste wie die übrigen Hof-Seiten des Boards; am Handy 16 px Rand.
    <div className={cn('w-full max-w-[976px] px-4 pt-3 pb-12 md:px-10 md:pt-5', !kopf && 'mx-auto')}>
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
      <div className="mb-3">
        <h2 className="font-heading text-[18px] leading-tight font-semibold break-words">
          {vorname ? `Willkommen, ${vorname}` : 'Willkommen'}
        </h2>
        <p className="mt-1 text-[15px] text-muted-foreground">So wird dein Hof startklar</p>
      </div>
      {/* Zwei Spalten wie im Board: Schritte und rechts 320 px Tarife und Hilfe, 16 px Abstand. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-2.5">
          {emailBestaetigung && <EmailBestaetigenHinweis {...emailBestaetigung} />}
          {agb && <AgbZustimmenKarte fassung={agb.fassung} geaendert={agb.geaendert} stichtag={agb.stichtag} />}
          <Fortschritt stand={stand} freigeschaltet={freigeschaltet} />
          <section aria-labelledby="einrichten-schritte">
            <h2 id="einrichten-schritte" className="sr-only">
              Schritte
            </h2>
            <ol className={cn('flex flex-col divide-y divide-border overflow-hidden border border-border bg-card', RUNDUNG.blatt)}>
              {stand.schritte.map((s) => (
                <SchrittKarte key={s.id} schritt={s} person={person} />
              ))}
            </ol>
          </section>
        </div>
        <div className="flex flex-col gap-2.5">
          <TarifKarte tarif={tarif} gebuehrModell={gebuehrModell} />
          <HilfeKarte />
        </div>
      </div>
    </div>
  )
}
