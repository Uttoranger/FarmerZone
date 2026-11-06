'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { BarChart3, CalendarCheck, Check, Compass, FlaskConical, Info, Package, Plus, ReceiptText, ShoppingBasket, SlidersHorizontal, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Chip, FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { Stepper } from '@/components/ui/stepper'
import { Segment } from '@/components/ui/segment'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { ProgressBar } from '@/components/ui/progress-bar'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { AusverkauftMarke, Marke } from '@/components/ui/marke'
import { MARKE_ARTEN, type MarkeArt } from '@/lib/marke-art'
import { GroessenWahl, Groessenkachel } from '@/components/ui/groessenkachel'
import { Hinweiskarte, HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { BottomNav, BottomNavLink, BottomNavMitte, mittelflaecheKlassen, mittelknopfFlachKlassen, mittelknopfKlassen } from '@/components/ui/bottom-nav'
import { SidebarEintrag, SidebarGruppe } from '@/components/ui/sidebar-gruppe'
import { Zaehler } from '@/components/ui/zaehler'
import { Sheet, SheetBlatt, SheetClose, SheetDescription, SheetKopf, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Dialog, DialogMitte, DialogTrigger } from '@/components/ui/dialog'
import { FeldMitFehler } from '@/components/ui/feld-fehler'
import { Textlink } from '@/components/ui/textlink'
import { BildPlatzhalter, FotoHinzufuegen } from '@/components/ui/bild-platzhalter'
import { HofkarteRahmen, hofkarteKlassen } from '@/components/ui/hofkarte-rahmen'
import { MeldungFormularAnsicht, type MeldungWelt } from '@/components/ui/meldung-formular-ansicht'
import type { MeldungFormular } from '@/components/shared/use-meldung-formular'
import type { MeldungArt } from '@/lib/meldung'
import { Input } from '@/components/ui/input'
import { ThemeUmschalter } from '@/components/shared/theme-umschalter'
import { UnterDemWerkzeugKopf, WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { RUNDUNG, RUNDUNG_PX, type RundungArt } from '@/components/ui/rundung'
import { HINWEISKASTEN_LINK, Hinweiskasten } from '@/components/ui/hinweiskasten'
import { AKTIONSLEISTE_KNOPF, AKTIONSLEISTE_ZURUECK, FesteAktionsleiste } from '@/components/ui/feste-aktionsleiste'
import { HofBalken } from '@/components/hofbereich/hof-balken'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'
import { Vorschau246 } from '@/app/intern/bausteine/vorschau-246'
import { Vorschau247 } from '@/app/intern/bausteine/vorschau-247'
import { Vorschau248 } from '@/app/intern/bausteine/vorschau-248'
import { KarteLaedt } from '@/components/karte/karte-laedt'
import { KaufZusammenfassung, type ZusammenfassungPosition } from '@/components/checkout/kauf-zusammenfassung'
import { SHELL_VARIANTEN } from './shell/[variante]/varianten'
import { HOF_NEU_KNOPF, HOF_NEU_KNOPF_NAME } from '@/lib/bauern-navigation'
import { TESTHOF_HINWEIS } from '@/lib/testhof'
import { PROBLEM_MELDEN } from '@/lib/fehlerseite'

/*
 * Die Vorschau der Bausteine aus Gate 2. Jeder Baustein steht mit seinen
 * Zuständen da, im Geltungsbereich data-design="neu"; das Theme wechselt der
 * Knopf oben (die Tokens hängen am <html>, deshalb nicht beide Themes
 * nebeneinander). Beispieltexte sind erfunden. tests/bausteine.test.ts prüft,
 * dass jeder Baustein hier eingebunden ist.
 */

/** Ein Wort je Art der Marke — die Wörter, die Bestellliste und Bestellseite tragen. */
const MARKE_BEISPIEL: Record<MarkeArt, string> = { tun: 'Zum Packen', laeuft: 'Gepackt', erledigt: 'Abgeholt', abgebrochen: 'Storniert' }

const LANGER_NAME = 'Biohof zur alten Linde am Waldrand oberhalb des Mühlbachs in der Gemeinde Beispielberg'

/** Erfundene Körbe für `KaufZusammenfassung`: bar mit zwei Waren, online mit sechs (der Rest klappt auf). */
const KORB_BAR: ZusammenfassungPosition[] = [
  { productId: 'eier', name: 'Freilandeier 10er', quantity: 2, unit: 'STUECK', unitSize: null },
  { productId: 'erdaepfel', name: 'Erdäpfel festkochend', quantity: 1, unit: 'KG', unitSize: 5 },
]
const KORB_ONLINE: ZusammenfassungPosition[] = [
  ...KORB_BAR,
  { productId: 'honig', name: 'Blütenhonig', quantity: 1, unit: 'STUECK', unitSize: null },
  { productId: 'kaese', name: 'Bergkäse', quantity: 1, unit: 'STUECK', unitSize: null },
  { productId: 'brot', name: 'Bauernbrot', quantity: 2, unit: 'STUECK', unitSize: null },
  { productId: 'apfelsaft', name: 'Apfelsaft naturtrüb', quantity: 3, unit: 'STUECK', unitSize: null },
]

/** Knopf-Gestalt für die Beispiel-Aktionen (Pille, Inhaltsbreite). */
/** Fester Zeitpunkt der Vorschau — die Unterzeile „Stand …“ hängt nicht an der Uhr (kein Hydration-Unterschied). */
const VORSCHAU_JETZT = new Date('2027-03-03T10:00:00Z')

const KNOPF = {
  gruen: cn('inline-flex h-10 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-accent-foreground hover:bg-accent-hover', FOKUS_RAHMEN),
  orange: cn('inline-flex h-10 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90', FOKUS_RAHMEN),
  rand: cn('inline-flex h-10 items-center rounded-full border border-border px-4 text-[14px] font-medium text-foreground hover:bg-muted', FOKUS_RAHMEN),
}

function Abschnitt({ id, titel, satz, children }: { id: string; titel: string; satz: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titel`} className={cn('flex min-w-0 flex-col gap-3 border border-border bg-card p-4 md:p-5', RUNDUNG.karte)}>
      <div>
        <h2 id={`${id}-titel`} className="font-heading text-lg font-semibold">
          {titel}
        </h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{satz}</p>
      </div>
      {children}
    </section>
  )
}

/** Zustände der Meldungs-Vorschau — gezeigt, nie geschickt. */
type MeldungZustand = 'leer' | 'fehler' | 'danke'

/**
 * Ein Formular-Zustand nur zum Ansehen: Die Vorschau ruft NIE useMeldungFormular — Absenden
 * schickte sonst eine echte Meldung in den Briefkasten. Absenden zeigt hier nur den Dank.
 */
function useVorschauFormular(zustand: MeldungZustand, setZustand: (z: MeldungZustand) => void): MeldungFormular {
  const [art, setArt] = useState<MeldungArt>('FEHLER')
  const [text, setText] = useState('')
  const [kennung, setKennung] = useState('')
  const [email, setEmail] = useState('')
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [website, setWebsite] = useState('')
  return {
    art, setArt, text, setText, kennung, setKennung, email, setEmail, screenshotUrl, setScreenshotUrl, website, setWebsite,
    fehler: zustand === 'fehler' ? 'Wir konnten deine Meldung gerade nicht speichern. Dein Text ist noch da – versuch es bitte gleich noch einmal.' : '',
    kurznummer: zustand === 'danke' ? 'AB12' : null,
    isPending: false,
    kontext: { seiteUrl: '', userAgent: '', viewport: '' },
    upload: { fileInput: null, openFilePicker: () => {}, isUploading: false, progress: null } as unknown as MeldungFormular['upload'],
    absenden: (e) => {
      e.preventDefault()
      setZustand('danke')
    },
    nochEtwas: () => setZustand('leer'),
  }
}

function MeldungVorschau({ welt }: { welt: MeldungWelt }): React.JSX.Element {
  const [zustand, setZustand] = useState<MeldungZustand>('leer')
  const formular = useVorschauFormular(zustand, setZustand)
  return (
    <div className="flex flex-col gap-3">
      <Segment
        beschriftung={welt === 'kunde' ? 'Zustand Kundschaft' : 'Zustand Hof'}
        optionen={[
          { wert: 'leer', label: 'Leer' },
          { wert: 'fehler', label: 'Serverfehler' },
          { wert: 'danke', label: 'Danke' },
        ]}
        wert={zustand}
        onWertChange={(w) => setZustand(w as MeldungZustand)}
      />
      <MeldungFormularAnsicht
        formular={formular}
        welt={welt}
        alsHof={welt === 'hof'}
        abbrechenHref="/intern/bausteine#meldung"
        titel={welt === 'kunde' ? PROBLEM_MELDEN : undefined}
        satz={welt === 'kunde' ? 'Danke, dass du Bescheid gibst. Wir schauen uns das an.' : undefined}
      />
    </div>
  )
}

export function BausteineVorschau({ kategorie }: { kategorie: 'alle' | 'eier' | 'gemuese' | 'futter' }): React.JSX.Element {
  const [menge, setMenge] = useState(1)
  const [geraet, setGeraet] = useState('handy')
  const [groesse, setGroesse] = useState('5kg')
  const filter = (k: typeof kategorie) => (k === 'alle' ? '/intern/bausteine' : `/intern/bausteine?kategorie=${k}`)

  return (
    <div data-design="neu" className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 py-3 md:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[1.1px] text-muted-foreground uppercase">Intern · nur Admin</p>
            <h1 className="font-heading text-2xl font-semibold">Bausteine</h1>
          </div>
          <ThemeUmschalter className={cn('rounded-full border border-border text-foreground hover:bg-muted', FOKUS_RAHMEN)} />
        </div>
      </header>

      <main className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-5 pb-16 md:px-8">
        <nav aria-label="Shells ansehen" className={cn('border border-border bg-card p-4 md:p-5', RUNDUNG.karte)}>
          <h2 className="font-heading text-lg font-semibold">Shells</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            In voller Fenstergröße — am Handy mit Unterleiste, ab 768 px mit Kopfzeile bzw. Seitenleiste.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SHELL_VARIANTEN.map((v) => (
              <li key={v.id}>
                <Link href={`/intern/bausteine/shell/${v.id}`} className={KNOPF.rand}>
                  {v.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid gap-4 lg:grid-cols-2">
          <Abschnitt id="chips" titel="Chip und FilterChip" satz="Merkmale ohne Handlung; Filter sind echte Links mit aria-current.">
            <div className="flex flex-wrap gap-1.5">
              <Chip>Eier</Chip>
              <Chip>Gemüse</Chip>
              <Chip title={LANGER_NAME} className="max-w-48">
                {LANGER_NAME}
              </Chip>
            </div>
            <FilterChipReihe beschriftung="Kategorie">
              <FilterChip href={filter('alle')} aktiv={kategorie === 'alle'}>
                Alle
              </FilterChip>
              <FilterChip href={filter('eier')} aktiv={kategorie === 'eier'}>
                Eier
              </FilterChip>
              <FilterChip href={filter('gemuese')} aktiv={kategorie === 'gemuese'}>
                Gemüse &amp; Obst
              </FilterChip>
              <FilterChip href={filter('futter')} aktiv={kategorie === 'futter'}>
                Futtermittel
              </FilterChip>
            </FilterChipReihe>
          </Abschnitt>

          <Abschnitt id="stepper" titel="Stepper und Segment" satz="Menge mit − und + (Pfeiltasten im Feld); ein Umschalter mit genau einer Wahl.">
            <div className="flex flex-wrap items-center gap-4">
              <Stepper beschriftung="Menge Freilandeier" wert={menge} onWertChange={setMenge} min={0} max={10} />
              <p className="text-[13px] text-muted-foreground" aria-live="polite">
                Menge: {menge}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Segment
                beschriftung="Vorschau-Gerät"
                optionen={[
                  { wert: 'handy', label: 'Handy' },
                  { wert: 'web', label: 'Web' },
                ]}
                wert={geraet}
                onWertChange={setGeraet}
              />
              <Segment
                beschriftung="Umkreis"
                optionen={[
                  { wert: '10', label: '10 km' },
                  { wert: '25', label: '25 km' },
                  { wert: '50', label: '50 km' },
                ]}
                standardWert="25"
              />
            </div>
          </Abschnitt>

          <Abschnitt id="listrow" titel="ListRow" satz="Zeilen auf einer Karte; mit Ziel als Link mit Pfeil, sonst Anzeige. Lange Namen kürzen.">
            <ListGruppe beschriftung="Beispielliste">
              <ListRow titel="Kunden" symbol={Users} href="/intern/bausteine#listrow" />
              <ListRow titel="Auswertung" symbol={BarChart3} href="/intern/bausteine" aktuell="page" />
              <ListRow titel={LANGER_NAME} untertitel="Gemüsekiste klein · Honig 500 g" ende={<span className="text-[13.5px] font-semibold">€ 21,90</span>} />
              <ListRow titel="Admin" symbol={SlidersHorizontal} href="/intern/bausteine#listrow" ende={<Zaehler anzahl={5} wofuer="Meldungen zu entscheiden" />} />
            </ListGruppe>
          </Abschnitt>

          <Abschnitt
            id="werkzeugkopf"
            titel="WerkzeugKopf (G1) mit Hof-Balken (G3)"
            satz="Am Handy die feste Leiste mit „‹“, Titel und Unterzeile – hier im Kasten scrollen –, im Web der grüne Textlink „‹ Elternseite“, h1 und Unterzeile. Der Hof-Balken steht unter dem Kopf in der Inhaltsspalte."
          >
            {/* Ein eigener Scroll-Kasten mit dem Rand der Hof-Rahmen (px-4 pt-5), damit die Leiste hier sichtbar klebt. */}
            <div className={cn('relative h-80 overflow-y-auto border border-border bg-background px-4 pt-5 md:px-8 md:pt-8', RUNDUNG.karte)}>
              <UnterDemWerkzeugKopf
                inhalt={<HofBalken lage="unter-kopf" balken={{ art: 'wartet', farmId: 'farm_vorschau', farmName: 'Hof Beispielberg', country: 'AT', stand: 'einrichten' }} />}
              >
                <WerkzeugKopf pfad="/settings/profile" titel="Hofdaten" unterzeile={<HofUnterzeile hofName="Hof Beispielberg" jetzt={VORSCHAU_JETZT} />} />
              </UnterDemWerkzeugKopf>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={cn('mb-3 h-24 border border-border bg-card', RUNDUNG.karte)} />
              ))}
            </div>
            <div className={cn('relative h-48 overflow-y-auto border border-border bg-background px-4 pt-5 md:px-8 md:pt-8', RUNDUNG.karte)}>
              <WerkzeugKopf
                pfad="/settings"
                titel="Einstellungen"
                unterzeile={<HofUnterzeile hofName="Hof Beispielberg" jetzt={VORSCHAU_JETZT} />}
                aktion={
                  <Link href="/intern/bausteine#werkzeugkopf" className={KNOPF.rand}>
                    Postfach
                  </Link>
                }
              />
              <p className="text-[13px] text-muted-foreground">Ohne Elternseite (Seite der Leiste): kein Rückweg, eine Aktion rechts.</p>
            </div>
          </Abschnitt>

          <Abschnitt
            id="hinweiskasten"
            titel="Hinweiskasten (G3)"
            satz="Braun getönt, Radius 12 px, Titel in status-offen, ohne Symbol und ohne Uhr; die Hof-ID steckt nur im vorausgefüllten Link."
          >
            <HofBalken lage="unter-kopf" balken={{ art: 'wartet', farmId: 'farm_vorschau', farmName: 'Hof Beispielberg', country: 'AT', stand: 'pruefung' }} />
            <HofBalken lage="unter-kopf" balken={{ art: 'stillgelegt' }} />
            <Hinweiskasten
              titel="Online-Zahlung noch nicht eingerichtet"
              aktion={
                <Link href="/intern/bausteine#hinweiskasten" className={HINWEISKASTEN_LINK}>
                  Zahlung einrichten
                </Link>
              }
            >
              Kundinnen können bis dahin nur bar bei Abholung zahlen.
            </Hinweiskasten>
          </Abschnitt>

          <Abschnitt
            id="aktionsleiste"
            titel="Feste Aktionsleiste (G2)"
            satz="Am Handy fest über der Unterleiste, Hauptknopf über die volle Breite, optional „← Zurück“; der Inhalt endet darüber. Im Web am Formularende. Hier ohne feste Position, damit sie in der Vorschau steht."
          >
            <div className={cn('border border-border bg-background p-4', RUNDUNG.karte)}>
              <FesteAktionsleiste className="static" zurueck={<Link href="/intern/bausteine#aktionsleiste" className={AKTIONSLEISTE_ZURUECK}>← Zurück</Link>}>
                <button type="button" className={AKTIONSLEISTE_KNOPF}>
                  Hofdaten speichern
                </button>
              </FesteAktionsleiste>
            </div>
          </Abschnitt>

          <Abschnitt id="rundungen" titel="Rundungen in Pixeln (G8)" satz="RUNDUNG aus ui/rundung.ts statt der Tailwind-Stufen xl und 2xl, die mit --radius wachsen.">
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(RUNDUNG) as RundungArt[]).map((art) => (
                <div key={art} className={cn('flex h-20 flex-col justify-end border border-border bg-muted p-3', RUNDUNG[art])}>
                  <span className="text-[14px] font-semibold">{art}</span>
                  <span className="text-[13px] text-muted-foreground">{RUNDUNG_PX[art]} px</span>
                </div>
              ))}
            </div>
          </Abschnitt>

          <Abschnitt
            id="marke"
            titel="Marke"
            satz="Ein Zustand als Wort auf seiner Bedeutungsfarbe — tun, läuft, erledigt, abgebrochen (Register G5). Schrift und Fläche aus den acht Tokens, Symbol und Wort in einer Zeile, lange Wörter kürzen."
          >
            <div className="flex flex-wrap items-center gap-2">
              {MARKE_ARTEN.map((art) => (
                <Marke key={art} art={art}>
                  {MARKE_BEISPIEL[art]}
                </Marke>
              ))}
              <Marke art="laeuft" symbol={Check}>
                Gepackt
              </Marke>
              <Marke art="abgebrochen" className="max-w-40">
                {LANGER_NAME}
              </Marke>
            </div>
          </Abschnitt>

          <Abschnitt id="status" titel="StatusBadge, Zähler und ProgressBar" satz="Töne der StatusBadge über die Marke: offen → tun, fertig → läuft, neutral → erledigt; Fortschritt als Balken.">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="offen">Zum Packen</StatusBadge>
              <StatusBadge status="fertig">Gepackt</StatusBadge>
              <StatusBadge status="neutral">Pausiert</StatusBadge>
              <StatusBadge status="fertig" className="max-w-40">
                {LANGER_NAME}
              </StatusBadge>
              <Zaehler anzahl={3} wofuer="offene Bestellungen" />
              <Zaehler anzahl={128} wofuer="Artikel im Warenkorb" ton="gruen" />
            </div>
            <ProgressBar beschriftung="Deine Hofseite" wert={64} />
            <ProgressBar beschriftung="Gepackt" wert={3} max={8} ton="orange" />
          </Abschnitt>

          <Abschnitt id="groessen" titel="Groessenkachel" satz="Verkaufsgrößen mit Preis, Grundpreis und Vorrat; knapp orange, ausverkauft gesperrt. Pfeiltasten wählen.">
            <GroessenWahl beschriftung="Größe wählen" wert={groesse} onWertChange={setGroesse} className="sm:grid-cols-4 lg:grid-cols-2">
              <Groessenkachel wert="1kg" name="1 kg-Sackerl" hinweis="für Kleintiere" preis="€ 2,50" grundpreis="€ 2,50/kg" vorrat="noch 20" />
              <Groessenkachel wert="5kg" name="5 kg-Sack" hinweis="für Kleintiere" preis="€ 8,00" grundpreis="€ 1,60/kg" vorrat="noch 10" />
              <Groessenkachel wert="rund" name="Rundballen" hinweis="ca. 250 kg" preis="€ 45,00" grundpreis="€ 0,18/kg" vorrat="nur noch 8" zustand="knapp" />
              <Groessenkachel wert="klein" name="Kleinballen" hinweis="ca. 15 kg" preis="€ 4,50" grundpreis="€ 0,30/kg" vorrat="ausverkauft" zustand="ausverkauft" />
            </GroessenWahl>
          </Abschnitt>

          <Abschnitt
            id="kauf-zusammenfassung"
            titel="KaufZusammenfassung"
            satz="Ware, Abholtermin und Vertragspartner unmittelbar über dem Kaufknopf (§ 8 Abs. 1 FAGG); im Formular als eigene Karte mit Gesamt. Bar ohne Zusatz, online mit der Servicegebühr; ab sechs Waren klappt der Rest auf."
          >
            <KaufZusammenfassung karte positionen={KORB_BAR} abholung="Sa, 10. Okt, 09:00–12:00 Uhr" hofName="Hof Beispielberg" gesamt={{ betrag: '€ 19,80' }} />
            <KaufZusammenfassung
              karte
              positionen={KORB_ONLINE}
              abholung="Mi, 14. Okt (morgen), 15:00–18:00 Uhr"
              hofName={LANGER_NAME}
              gesamt={{ betrag: '€ 52,40', zusatz: 'inkl. Servicegebühr (5 %) € 2,50' }}
            />
          </Abschnitt>

          <Abschnitt id="hinweis" titel="Hinweiskarte" satz="Grün für Kundensachen und Gutes, Orange für Hofsachen und Offenes, Neutral für ruhige Hinweise ohne Wertung.">
            <Hinweiskarte
              ton="gruen"
              symbol={Compass}
              aktion={
                <Link href="/intern/bausteine#hinweis" className={KNOPF.rand}>
                  PLZ eingeben
                </Link>
              }
            >
              Wir zeigen Höfe rund um <b>Beispielstadt</b> – grob geschätzt, nichts wird gespeichert.
            </Hinweiskarte>
            <Hinweiskarte ton="orange" symbol={Info} titel="Online-Zahlung pausiert">
              Kundinnen können gerade nur bar bei Abholung bezahlen.
            </Hinweiskarte>
            <Hinweiskarte ton="neutral" symbol={FlaskConical}>{TESTHOF_HINWEIS}</Hinweiskarte>
          </Abschnitt>

          <Abschnitt id="karte-laedt" titel="Karte lädt" satz="Platzhalter beider Karten, solange die Kartenbibliothek nachlädt — in der Größe der Karte, kein Spinner.">
            <KarteLaedt className={cn('h-[160px] border border-border', RUNDUNG.karte)} />
          </Abschnitt>

          <Abschnitt id="leer" titel="EmptyState" satz="Symbol, ein Satz und immer ein Ausweg.">
            <EmptyState
              titel="Keine Höfe im Umkreis"
              satz="Im Umkreis von 10 km bietet gerade niemand Eier an."
              ausweg={
                <Link href="/intern/bausteine#leer" className={KNOPF.gruen}>
                  Umkreis auf 25 km erweitern
                </Link>
              }
            />
          </Abschnitt>

          <Abschnitt id="blatt" titel="Blatt mit Griff" satz="Die Handy-Form eines Dialogs: Hauptaktion volle Breite, „Abbrechen“ als Textknopf. Escape schließt.">
            <Sheet>
              <SheetTrigger className={KNOPF.rand}>Blatt öffnen</SheetTrigger>
              <SheetBlatt>
                <SheetTitle className="font-heading text-xl font-semibold">Bestellung stornieren?</SheetTitle>
                <SheetDescription>Die Ware kommt zurück in den Vorrat. Bei Barzahlung wird nichts erstattet.</SheetDescription>
                <SheetClose className={cn('h-[50px] w-full rounded-full border border-primary/70 bg-primary/18 text-[15px] font-semibold text-foreground', FOKUS_RAHMEN)}>
                  Stornieren
                </SheetClose>
                <SheetClose className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-brand-text hover:bg-muted', FOKUS_RAHMEN)}>
                  Abbrechen
                </SheetClose>
              </SheetBlatt>
            </Sheet>
          </Abschnitt>

          <Abschnitt
            id="dialog-mitte"
            titel="Dialog zentriert"
            satz="Im Web höchstens 560 px, Titel links, genau ein Schließen-Element rechts (Textknopf, 44 px); am Handy nimmt die Seite das Blatt."
          >
            <Dialog>
              <DialogTrigger className={KNOPF.rand}>Dialog öffnen</DialogTrigger>
              <DialogMitte titel="Vorrat: Freilandeier" schliessen="Abbrechen">
                <p className="text-muted-foreground">Wie viele Packungen à 10 Stück hast du gerade?</p>
                <Stepper beschriftung="Vorrat Freilandeier" standardWert={3} min={0} max={99} />
                <p className="text-[14px] text-muted-foreground">Bei 0 steht „Ausverkauft“, das Produkt bleibt sichtbar.</p>
                <button type="button" className={cn(KNOPF.orange, 'h-12 self-start rounded-[14px] px-5 text-[16px]')}>
                  Speichern
                </button>
              </DialogMitte>
            </Dialog>
          </Abschnitt>

          <Abschnitt
            id="blatt-rechts"
            titel="Blatt rechts (Warenkorb)"
            satz="Am Handy von unten mit Griff, ab 768 px von rechts über die volle Höhe, höchstens 448 px; Kopf mit Titel und „Schließen“."
          >
            <Sheet>
              <SheetTrigger className={KNOPF.rand}>Warenkorb öffnen</SheetTrigger>
              <SheetBlatt seite="rechts">
                <SheetKopf titel="Warenkorb · Hof Beispielberg" />
                <ListGruppe beschriftung="Im Warenkorb">
                  <ListRow titel="Freilandeier, 10 Stk." untertitel="€ 0,48 / Stk." ende={<span className="text-[15px] font-semibold">€ 4,77</span>} />
                  <ListRow titel="Bergkäse, 250 g" untertitel="€ 26,32 / kg" ende={<span className="text-[15px] font-semibold">€ 6,58</span>} />
                </ListGruppe>
                <div className="flex items-baseline justify-between border-t border-border pt-2.5">
                  <strong className="text-base">Gesamt</strong>
                  <strong className="text-[22px]">€ 11,35</strong>
                </div>
                <p className="text-[13px] text-muted-foreground">Inkl. Plattformgebühr · Reservierung gilt 15 Minuten.</p>
                <SheetClose className={cn(KNOPF.gruen, 'h-[52px] w-full justify-center rounded-[14px] text-[16px]')}>Zur Kasse</SheetClose>
              </SheetBlatt>
            </Sheet>
          </Abschnitt>

          <Abschnitt id="ausverkauft" titel="Marke „Ausverkauft“" satz="Neutral (V19): die Art „erledigt“ als Schild, 22 px, ohne Rand — kein Orange, kein Rot.">
            <div className="flex flex-wrap items-center gap-2">
              <AusverkauftMarke />
              <Marke art="laeuft" form="schild">
                Sichtbar
              </Marke>
              <Marke art="tun" form="schild">
                Nur noch 3
              </Marke>
            </div>
          </Abschnitt>

          <Abschnitt id="feldfehler" titel="Feldfehler" satz="Orange am Feld (V17): Rand 2 px, Satz darunter mit role=alert, aria-invalid und aria-describedby am Feld.">
            <div className="grid gap-3 sm:grid-cols-2">
              <FeldMitFehler id="vorschau-einheit" label="Einheit" hilfe="Glas, Stück, kg …">
                {(feld) => <Input {...feld} defaultValue="Glas" />}
              </FeldMitFehler>
              <FeldMitFehler id="vorschau-preis" label="Preis je Glas" fehler="Trag einen Preis ein, z. B. 7,50.">
                {(feld) => <Input {...feld} inputMode="decimal" />}
              </FeldMitFehler>
            </div>
          </Abschnitt>

          <Abschnitt id="textlink" titel="Textlink" satz="Sieht aus wie Text, trifft sich wie ein Knopf (V16): in der Zeile 44 px hoch, im Satz über ::before.">
            <div className="flex flex-wrap items-center gap-4">
              <Textlink href="/intern/bausteine#textlink">Route planen →</Textlink>
              <Textlink href="/intern/bausteine#textlink" ton="orange">
                Hofseite ansehen
              </Textlink>
              <Textlink href="/intern/bausteine#textlink" ton="leise">
                Impressum
              </Textlink>
            </div>
            <p className="text-[14px] text-muted-foreground">
              Fragen zur Abholung? Schreib dem Hof über die{' '}
              <Textlink href="/intern/bausteine#textlink" form="im-satz">
                Bestellseite
              </Textlink>
              .
            </p>
          </Abschnitt>

          <Abschnitt id="bild-platzhalter" titel="Bild-Platzhalter" satz="Ohne Dateinamen (V15), dunkel mit eigenem Verlauf; im Formular „Foto hinzufügen“.">
            <div className="grid grid-cols-3 gap-2">
              <BildPlatzhalter className="h-24" />
              <BildPlatzhalter className="h-24" gedaempft />
              <BildPlatzhalter className="h-24 rounded-none border-0" />
            </div>
            <FotoHinzufuegen />
          </Abschnitt>

          <Abschnitt id="hinweis-fehler" titel="Hinweiskarte mit „Nochmal“" satz="Orange für Fehler, die kein Feld betreffen (V17): Karten-Ablehnung ohne Knopf, Speicherfehler mit „Nochmal“.">
            <HinweiskarteFehler titel="Deine Karte wurde abgelehnt">Es wurde nichts abgebucht. Deine Ware bleibt bis 07:55 Uhr für dich reserviert.</HinweiskarteFehler>
            <HinweiskarteFehler titel="Speichern hat nicht geklappt" nochmal={() => {}}>
              Deine Eingaben sind noch da. Prüf den Empfang und versuch es noch einmal.
            </HinweiskarteFehler>
          </Abschnitt>

          <Abschnitt id="hofkarte" titel="Hofkarte pausiert" satz="V18: ausgegraut, gestrichelt, neutraler Text — der Hof bleibt sichtbar und lesbar.">
            <div className="grid gap-3 sm:grid-cols-2">
              {[false, true].map((pausiert) => (
                <HofkarteRahmen key={String(pausiert)} pausiert={pausiert}>
                  <BildPlatzhalter className="h-24 rounded-none border-0" gedaempft={pausiert} />
                  <div className="flex flex-col gap-1 px-3 py-2.5">
                    <strong className="text-[17px]">{pausiert ? 'Hof am Weiher' : 'Hof am Bach'}</strong>
                    <span className="text-[13px] text-muted-foreground">{pausiert ? '5282 Beispielort · 7 km' : '5280 Beispielort · 4 km'}</span>
                    <span className={hofkarteKlassen(pausiert).abholung}>{pausiert ? 'Macht gerade Pause' : 'Abholung Sa, 6. März, 9–12 Uhr'}</span>
                  </div>
                </HofkarteRahmen>
              ))}
            </div>
          </Abschnitt>

          <Abschnitt id="meldung" titel={PROBLEM_MELDEN} satz="Eine Darstellung, Ton je Welt (V51): Kundschaft grün, Hof orange. Die Logik bleibt useMeldungFormular — hier wird nichts geschickt.">
            <MeldungVorschau welt="kunde" />
          </Abschnitt>

          <Abschnitt id="meldung-hof" titel={`${PROBLEM_MELDEN} im Hofbereich`} satz="Dieselbe Darstellung in Orange; der angemeldete Hof sieht „Bildschirmfoto hinzufügen“ statt der E-Mail.">
            <MeldungVorschau welt="hof" />
          </Abschnitt>

          <Abschnitt id="sidebar" titel="Sidebar-Gruppe mit Zähler" satz="Die Seitenleiste des Hofbereichs ab 768 px; ohne Symbole, aktiv grün getönt (Board w1-mehr-neu).">
            <div className={cn('w-full max-w-[264px] border border-border bg-card p-3', RUNDUNG.karte)}>
              <SidebarGruppe>
                <SidebarEintrag href="/intern/bausteine" label="Heute" aktuell="page" />
                <SidebarEintrag href="/intern/bausteine#sidebar" label="Bestellungen" zahl={3} zahlWofuer="offene Bestellungen" />
              </SidebarGruppe>
              <SidebarGruppe titel="Verkauf und Kunden">
                <SidebarEintrag href="/intern/bausteine#sidebar" label="Kunden" />
                <SidebarEintrag href="/intern/bausteine#sidebar" label="Auswertung" />
              </SidebarGruppe>
            </div>
          </Abschnitt>

          <Abschnitt id="bottomnav" titel="BottomNav mit Mittelknopf" satz="Die Unterleiste am Handy; hier ohne feste Position, damit sie in der Vorschau steht. Aktiv eine getönte Pille (grün bzw. orange). Im Hofbereich ist „Neu“ eine flache orange Fläche mit dem Wort darunter — Fläche und Wort sind ein Knopf.">
            <div className="flex flex-col gap-9 pt-6">
              <BottomNav beschriftung="Beispiel: Unterleiste Kunde" className={cn('relative z-0 border md:block', RUNDUNG.karte)}>
                <BottomNavLink href="/intern/bausteine" label="Entdecken" symbol={Compass} aktuell="page" />
                <BottomNavMitte>
                  <Link href="/intern/bausteine#bottomnav" aria-label="Warenkorb öffnen, 2 Artikel" className={mittelknopfKlassen('gruen')}>
                    <ShoppingBasket className="size-6" strokeWidth={1.7} aria-hidden="true" />
                  </Link>
                </BottomNavMitte>
                <BottomNavLink href="/intern/bausteine#bottomnav" label="Bestellungen" symbol={ReceiptText} />
              </BottomNav>
              <BottomNav beschriftung="Beispiel: Unterleiste Hof" ton="orange" className={cn('relative z-0 border md:block', RUNDUNG.karte)}>
                <BottomNavLink href="/intern/bausteine" label="Heute" symbol={CalendarCheck} aktuell="page" />
                <BottomNavLink href="/intern/bausteine#bottomnav" label="Bestellungen" symbol={ReceiptText} zahl={3} zahlWofuer="offene Bestellungen" />
                <BottomNavMitte flach>
                  <Link href="/intern/bausteine#bottomnav" aria-label={HOF_NEU_KNOPF_NAME} className={mittelknopfFlachKlassen()}>
                    <span className={mittelflaecheKlassen('orange')}>
                      <Plus className="size-[22px]" strokeWidth={2.4} aria-hidden="true" />
                    </span>
                    <span>{HOF_NEU_KNOPF}</span>
                  </Link>
                </BottomNavMitte>
                <BottomNavLink href="/intern/bausteine#bottomnav" label="Produkte" symbol={Package} />
                <BottomNavLink href="/intern/bausteine#bottomnav" label="Mehr" symbol={SlidersHorizontal} />
              </BottomNav>
            </div>
          </Abschnitt>

          {/* Einhängepunkte der Baustein-Nummern 246–248 (Lauf 32): Jede ändert nur ihre eigene vorschau-<nr>.tsx,
              nie diese Datei — so kommen sich die Nummern hier nicht in die Quere. */}
          <Vorschau246 />
          <Vorschau247 />
          <Vorschau248 />
        </div>
      </main>
    </div>
  )
}
