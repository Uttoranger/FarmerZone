'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  CalendarCheck,
  Compass,
  Info,
  Package,
  Plus,
  ReceiptText,
  SearchX,
  ShoppingBasket,
  SlidersHorizontal,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Chip, FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { Stepper } from '@/components/ui/stepper'
import { Segment } from '@/components/ui/segment'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { ProgressBar } from '@/components/ui/progress-bar'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusBadge } from '@/components/ui/status-badge'
import { GroessenWahl, Groessenkachel } from '@/components/ui/groessenkachel'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { BottomNav, BottomNavLink, BottomNavMitte, mittelknopfKlassen } from '@/components/ui/bottom-nav'
import { SidebarEintrag, SidebarGruppe } from '@/components/ui/sidebar-gruppe'
import { Zaehler } from '@/components/ui/zaehler'
import { Sheet, SheetBlatt, SheetClose, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeUmschalter } from '@/components/shared/theme-umschalter'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { SHELL_VARIANTEN } from './shell/[variante]/varianten'

/*
 * Die Vorschau der Bausteine aus Gate 2. Jeder Baustein steht mit seinen
 * Zuständen da, im Geltungsbereich data-design="neu"; das Theme wechselt der
 * Knopf oben (die Tokens hängen am <html>, deshalb nicht beide Themes
 * nebeneinander). Beispieltexte sind erfunden. tests/bausteine.test.ts prüft,
 * dass jeder Baustein hier eingebunden ist.
 */

const LANGER_NAME = 'Biohof zur alten Linde am Waldrand oberhalb des Mühlbachs in der Gemeinde Beispielberg'

/** Knopf-Gestalt für die Beispiel-Aktionen (Pille, Inhaltsbreite). */
const KNOPF = {
  gruen: cn('inline-flex h-10 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-accent-foreground hover:bg-accent-hover', FOKUS_RAHMEN),
  orange: cn('inline-flex h-10 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90', FOKUS_RAHMEN),
  rand: cn('inline-flex h-10 items-center rounded-full border border-border px-4 text-[14px] font-medium text-foreground hover:bg-muted', FOKUS_RAHMEN),
}

function Abschnitt({ id, titel, satz, children }: { id: string; titel: string; satz: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titel`} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:p-5">
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
        <nav aria-label="Shells ansehen" className="rounded-2xl border border-border bg-card p-4 md:p-5">
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
            id="unterseitenkopf"
            titel="UnterseitenKopf"
            satz="Kopf einer Unterseite im Hofbereich (Nr. 44): am Handy eine feste Leiste mit Pfeil und Elternseite – hier im Kasten scrollen –, im Browser die Zeile „‹ …“, darunter der Titel."
          >
            {/* Ein eigener Scroll-Kasten mit dem Rand der Hof-Rahmen (px-4 pt-5), damit die Leiste hier sichtbar klebt. */}
            <div className="relative h-72 overflow-y-auto rounded-xl border border-border bg-background px-4 pt-5 md:px-8 md:pt-8">
              <UnterseitenKopf pfad="/settings/profile" titel="Hof-Profil" satz="Informationen, die auf deiner öffentlichen Hof-Seite sichtbar sind." />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="mb-3 h-24 rounded-2xl border border-border bg-card" />
              ))}
            </div>
          </Abschnitt>

          <Abschnitt id="status" titel="StatusBadge, Zähler und ProgressBar" satz="Zustände in Orange (offen), Grün (fertig) und neutral; Fortschritt als Balken.">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="offen">Zum Packen</StatusBadge>
              <StatusBadge status="fertig">Gepackt</StatusBadge>
              <StatusBadge status="neutral">Pausiert</StatusBadge>
              <StatusBadge status="fertig" className="max-w-40">
                {LANGER_NAME}
              </StatusBadge>
              <Zaehler anzahl={3} wofuer="offene Bestellungen" />
              <Zaehler anzahl={128} wofuer="Artikel im Korb" ton="gruen" />
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

          <Abschnitt id="hinweis" titel="Hinweiskarte" satz="Grün für Kundensachen und Gutes, Orange für Hofsachen und Offenes.">
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
          </Abschnitt>

          <Abschnitt id="leer" titel="EmptyState" satz="Symbol, ein Satz und immer ein Ausweg.">
            <EmptyState
              symbol={SearchX}
              titel="Keine Höfe im Umkreis"
              satz="Im Umkreis von 10 km bietet gerade niemand Eier an."
              aktion={
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

          <Abschnitt id="sidebar" titel="Sidebar-Gruppe mit Zähler" satz="Die Seitenleiste des Hofbereichs ab 768 px; aktiv in umgekehrter Textfarbe.">
            <div className="w-full max-w-[264px] rounded-2xl border border-border bg-card p-3">
              <SidebarGruppe>
                <SidebarEintrag href="/intern/bausteine" label="Heute" symbol={CalendarCheck} aktuell="page" />
                <SidebarEintrag href="/intern/bausteine#sidebar" label="Bestellungen" symbol={ReceiptText} zahl={3} zahlWofuer="offene Bestellungen" />
              </SidebarGruppe>
              <SidebarGruppe titel="Verkauf und Kunden">
                <SidebarEintrag href="/intern/bausteine#sidebar" label="Kunden" symbol={Users} />
                <SidebarEintrag href="/intern/bausteine#sidebar" label="Auswertung" symbol={BarChart3} />
              </SidebarGruppe>
            </div>
          </Abschnitt>

          <Abschnitt id="bottomnav" titel="BottomNav mit Mittelknopf" satz="Die Unterleiste am Handy; hier ohne feste Position, damit sie in der Vorschau steht.">
            <div className="flex flex-col gap-9 pt-6">
              <BottomNav beschriftung="Beispiel: Unterleiste Kunde" className="relative z-0 rounded-2xl border md:block">
                <BottomNavLink href="/intern/bausteine" label="Entdecken" symbol={Compass} aktuell="page" />
                <BottomNavMitte>
                  <Link href="/intern/bausteine#bottomnav" aria-label="Warenkorb öffnen, 2 Artikel" className={mittelknopfKlassen('gruen')}>
                    <ShoppingBasket className="size-6" strokeWidth={1.7} aria-hidden="true" />
                  </Link>
                </BottomNavMitte>
                <BottomNavLink href="/intern/bausteine#bottomnav" label="Bestellungen" symbol={ReceiptText} />
              </BottomNav>
              <BottomNav beschriftung="Beispiel: Unterleiste Hof" className="relative z-0 rounded-2xl border md:block">
                <BottomNavLink href="/intern/bausteine" label="Heute" symbol={CalendarCheck} aktuell="page" />
                <BottomNavLink href="/intern/bausteine#bottomnav" label="Bestellungen" symbol={ReceiptText} zahl={3} zahlWofuer="offene Bestellungen" />
                <BottomNavMitte>
                  <Link href="/intern/bausteine#bottomnav" aria-label="Neu erstellen" className={mittelknopfKlassen('orange')}>
                    <Plus className="size-6" strokeWidth={2.2} aria-hidden="true" />
                  </Link>
                </BottomNavMitte>
                <BottomNavLink href="/intern/bausteine#bottomnav" label="Produkte" symbol={Package} />
                <BottomNavLink href="/intern/bausteine#bottomnav" label="Mehr" symbol={SlidersHorizontal} />
              </BottomNav>
            </div>
          </Abschnitt>
        </div>
      </main>
    </div>
  )
}
