import { CalendarCheck, Clock, Eye, Plus, Printer, Share2 } from 'lucide-react'
import { hofNavigation, VERKAUF_UND_KUNDEN_TITEL } from '@/lib/bauern-navigation'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'

/*
 * „Heute" als Bild der App für /fuer-hoefe (Gate 5: „Eingebettete echte
 * Heute-Ansicht als Bild der App"). Nachgebaut aus Tokens und Bausteinen statt
 * eines Screenshots:
 *  - Heute steht seit Nr. 17 im neuen Design, aber ein Bildschirmfoto
 *    veraltete beim nächsten Umbau und zeigte Daten eines echten Hofs.
 *  - Ein Bild folgt keinem Theme; diese Zeichnung steht hell wie dunkel richtig.
 *  - Nur erfundene Daten, kein Hof aus der Datenbank: Die Seite ist statisch
 *    und zeigt nichts, was einem echten Hof gehört.
 * Die Navigation links liest dieselbe Quelle wie die HofShell (hofNavigation),
 * damit das Bild nicht von der App wegläuft. `role="img"`: Der Inhalt ist
 * Anschauung, kein Bedienelement — der Screenreader hört eine Beschreibung.
 */

const BILD_BESCHREIBUNG =
  'Beispielbild der App: die Seite „Heute" eines Hofs mit Packliste, Bestellungen des Tages, Umsatz und nächster Abholung.'

type Zeile = { nr: number; name: string; artikel: string; cents: number; gepackt: boolean }

// Erfundene Bestellungen — keine echten Namen (CLAUDE.md, „Sicherheit").
const PACKLISTE: readonly Zeile[] = [
  { nr: 1047, name: 'Anna Muster', artikel: '10 Eier · 1 Bauernbrot', cents: 1030, gepackt: false },
  { nr: 1046, name: 'Familie Beispiel', artikel: 'Gemüsekiste groß · 6 Eier', cents: 2160, gepackt: false },
  { nr: 1045, name: 'Max Mustermann', artikel: '2 Bauernbrot', cents: 1160, gepackt: true },
  { nr: 1044, name: 'Erika Musterfrau', artikel: 'Gemüsekiste klein · Honig 500 g', cents: 2190, gepackt: true },
  { nr: 1043, name: 'Lukas Probe', artikel: '20 Eier', cents: 900, gepackt: false },
]

const KENNZAHLEN = [
  { titel: 'Bestellungen heute', wert: '8', offen: false },
  { titel: 'Noch zu packen', wert: '5', offen: true },
  { titel: 'Umsatz heute', wert: formatEuro(centsAlsEuro(18640)), offen: false },
  { titel: 'Neue Kunden', wert: '2', offen: false },
] as const

// Wochensäulen in Prozent der höchsten — reine Zeichnung.
const WOCHE = [
  { tag: 'Do', hoehe: 45 },
  { tag: 'Fr', hoehe: 70 },
  { tag: 'Sa', hoehe: 35 },
  { tag: 'So', hoehe: 80 },
  { tag: 'Mo', hoehe: 55 },
  { tag: 'Di', hoehe: 95 },
  { tag: 'Mi', hoehe: 75, heute: true },
] as const

const ABHOLUNG = 'Abholung heute, 15–18 Uhr'
const HOFNAME = 'Beispielhof'

function Packzeile({ zeile, kompakt = false }: { zeile: Zeile; kompakt?: boolean }) {
  return (
    <div className="flex items-center gap-2 border-t border-border py-1.5 first:border-t-0">
      {!kompakt && <span className="w-9 shrink-0 text-[9px] text-muted-foreground">#{zeile.nr}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-semibold">{zeile.name}</span>
        <span className="block truncate text-[9px] text-muted-foreground">{zeile.artikel}</span>
      </span>
      <span className="shrink-0 text-[10px] font-semibold">{formatEuro(centsAlsEuro(zeile.cents))}</span>
      {!kompakt && (
        <StatusBadge status={zeile.gepackt ? 'fertig' : 'offen'} className="px-1.5 text-[8.5px]">
          {zeile.gepackt ? 'Gepackt' : 'Zum Packen'}
        </StatusBadge>
      )}
    </div>
  )
}

function Kennzahl({ titel, wert, offen }: { titel: string; wert: string; offen: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-2 py-1.5">
      <span className="block truncate text-[8.5px] text-muted-foreground">{titel}</span>
      <span className={cn('block font-heading text-[13px] font-semibold', offen && 'text-status-offen')}>{wert}</span>
    </div>
  )
}

function Hofseitenstand({ prozent }: { prozent: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <div className="flex items-center justify-between text-[9.5px] font-semibold">
        <span>Deine Hofseite</span>
        <span>{prozent} %</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-muted">
        <div className="h-1 rounded-full bg-accent" style={{ width: `${prozent}%` }} />
      </div>
    </div>
  )
}

/** Browser-Fenster mit Seitenleiste — ab 768 px. */
function WebBild() {
  const navigation = hofNavigation({ isAdmin: false })
  return (
    <div
      role="img"
      aria-label={BILD_BESCHREIBUNG}
      className="hidden overflow-hidden rounded-2xl border border-border bg-background shadow-xl select-none md:block dark:shadow-none"
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-card px-3 py-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 rounded-full bg-border" />
        ))}
      </div>
      <div className="flex text-foreground">
        <div className="hidden w-[150px] shrink-0 flex-col gap-1 border-r border-border bg-card p-2 xl:flex">
          <div className="rounded-lg border border-border bg-muted p-1.5">
            <span className="block text-[7.5px] font-semibold tracking-wide text-muted-foreground uppercase">Mein Hof</span>
            <span className="block truncate text-[10px] font-semibold">{HOFNAME}</span>
            <span className="mt-1 flex items-center justify-center gap-1 rounded-md border border-border py-0.5 text-[8px]">
              <Eye className="size-2.5" aria-hidden="true" />
              Hofseite ansehen
            </span>
          </div>
          <span className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[9.5px] font-semibold text-primary-foreground">
            <Plus className="size-3" aria-hidden="true" />
            Neu
          </span>
          {navigation.haupt.map((punkt, i) => (
            <span
              key={punkt.id}
              className={cn('rounded-md px-2 py-1 text-[9.5px]', i === 0 ? 'bg-foreground font-semibold text-background' : 'text-foreground')}
            >
              {punkt.label}
            </span>
          ))}
          <span className="mt-1 px-2 text-[7.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            {VERKAUF_UND_KUNDEN_TITEL}
          </span>
          {navigation.verkaufUndKunden.map((punkt) => (
            <span key={punkt.id} className="px-2 py-0.5 text-[9.5px]">
              {punkt.label}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1 p-3">
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/45 bg-primary/12 px-2 py-1.5 text-[9px]">
            <Share2 className="size-3 shrink-0 text-status-offen" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">
              <strong className="font-semibold">Diese Woche bei dir:</strong> Eier, Erdäpfel, Heu – Abholung Sa 9–12
            </span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[8.5px] font-semibold text-primary-foreground">Teilen</span>
          </div>
          <div className="mb-2 flex items-end justify-between gap-2">
            <span>
              <span className="block font-heading text-[15px] font-semibold">Heute</span>
              <span className="block text-[9px] text-muted-foreground">Mittwoch, 30. September</span>
            </span>
            <span className="flex items-center gap-1 rounded-full border border-accent/50 bg-accent/18 px-2 py-0.5 text-[8.5px] font-semibold text-foreground">
              <Clock className="size-2.5" aria-hidden="true" />
              {ABHOLUNG}
            </span>
          </div>
          <div className="mb-2 grid grid-cols-4 gap-1.5">
            {KENNZAHLEN.map((k) => (
              <Kennzahl key={k.titel} {...k} />
            ))}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_130px] gap-2">
            <div className="rounded-lg border border-border bg-card px-2 py-1.5">
              <div className="mb-1 flex items-center justify-between text-[10px] font-semibold">
                <span>
                  Packliste für heute <span className="font-normal text-status-offen">5 offen</span>
                </span>
                <span className="flex items-center gap-1 text-[8.5px] font-normal text-muted-foreground">
                  <Printer className="size-2.5" aria-hidden="true" />
                  Packliste drucken
                </span>
              </div>
              {PACKLISTE.map((zeile) => (
                <Packzeile key={zeile.nr} zeile={zeile} />
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <div className="rounded-lg border border-border bg-card p-2">
                <span className="block text-[8.5px] text-muted-foreground">Nächste Abholung</span>
                <span className="block font-heading text-[11px] font-semibold">Heute, 15–18 Uhr</span>
                <span className="block text-[8.5px] text-muted-foreground">8 Bestellungen · Hofladen</span>
              </div>
              <div className="rounded-lg border border-border bg-card p-2">
                <div className="flex items-center justify-between gap-1 text-[8.5px]">
                  <span className="min-w-0 truncate text-muted-foreground">Umsatz diese Woche</span>
                  <span className="shrink-0 font-semibold whitespace-nowrap">{formatEuro(centsAlsEuro(61290))}</span>
                </div>
                <div className="mt-1.5 flex h-10 items-end gap-1">
                  {WOCHE.map((s) => (
                    <span key={s.tag} className="flex flex-1 flex-col items-center gap-0.5">
                      <span
                        className={cn('w-full rounded-sm', 'heute' in s ? 'bg-primary' : 'bg-accent/50')}
                        style={{ height: `${Math.round(s.hoehe * 0.32)}px` }}
                      />
                      <span className="text-[7px] text-muted-foreground">{s.tag}</span>
                    </span>
                  ))}
                </div>
              </div>
              <Hofseitenstand prozent={64} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Telefon mit Unterleiste — unter 768 px. */
function HandyBild() {
  return (
    <div
      role="img"
      aria-label={BILD_BESCHREIBUNG}
      className="mx-auto w-full max-w-[300px] overflow-hidden rounded-[26px] border border-border bg-background p-2.5 text-foreground select-none md:hidden"
    >
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-border bg-muted p-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-border text-[10px] font-semibold">B</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[8px] font-semibold tracking-wide text-muted-foreground uppercase">Mein Hof</span>
          <span className="block truncate text-[11px] font-semibold">{HOFNAME}</span>
        </span>
      </div>
      <div className="mb-2 flex items-center gap-2 rounded-xl border border-primary/45 bg-primary/12 px-2 py-1.5">
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold">Diese Woche teilen</span>
          {/* Keine Besuchszahlen: die Teilen-Zählung kommt erst mit Gate 7. */}
          <span className="block text-[9px] text-muted-foreground">Eier, Erdäpfel, Heu – Sa 9–12</span>
        </span>
        <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground">Teilen</span>
      </div>
      <div className="mb-2 flex items-center justify-between rounded-xl border border-accent/50 bg-accent/12 px-2 py-1.5 text-[10px]">
        <span className="font-semibold">{ABHOLUNG}</span>
        <span>8 Bestellungen</span>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        {KENNZAHLEN.map((k) => (
          <Kennzahl key={k.titel} {...k} />
        ))}
      </div>
      <div className="mb-2 rounded-xl border border-border bg-card px-2 py-1">
        <div className="flex items-center justify-between py-1 text-[10px] font-semibold">
          <span>Packliste</span>
          <span className="font-normal text-status-offen">5 offen</span>
        </div>
        {PACKLISTE.slice(0, 4).map((zeile) => (
          <Packzeile key={zeile.nr} zeile={zeile} kompakt />
        ))}
      </div>
      <Hofseitenstand prozent={64} />
      <div className="mt-2 flex items-center justify-around border-t border-border pt-2 text-[8.5px] text-muted-foreground">
        <span className="flex flex-col items-center font-semibold text-foreground">
          <CalendarCheck className="size-3.5" aria-hidden="true" />
          Heute
        </span>
        <span>Bestellungen</span>
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Plus className="size-3.5" aria-hidden="true" />
        </span>
        <span>Produkte</span>
        <span>Mehr</span>
      </div>
    </div>
  )
}

export function HeuteBild(): React.JSX.Element {
  return (
    <>
      <WebBild />
      <HandyBild />
    </>
  )
}
