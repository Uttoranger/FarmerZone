'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Banknote,
  BarChart3,
  CalendarCheck,
  ChevronDown,
  Home,
  LifeBuoy,
  LogOut,
  Megaphone,
  MoreHorizontal,
  Package,
  PackagePlus,
  Plus,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { signOut } from '@/lib/auth-client'
import { hofInitialen } from '@/lib/hof-initialen'
import { FarmIdentityCard } from '@/components/farmer/farm-identity-card'
import { ThemeUmschalter, ThemeUmschalterZeile } from '@/components/shared/theme-umschalter'
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuLinkItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  ABMELDEN_LABEL,
  HANDY_LEISTE,
  VERKAUF_UND_KUNDEN_TITEL,
  aktiverPunkt,
  ariaAktuell,
  fuerNutzer,
  mehrAktiv,
  type NavPunkt,
  type NavPunktId,
  type NeuId,
  type NeuPunkt,
} from '@/lib/bauern-navigation'
import { cn } from '@/lib/utils'

/*
 * Die Ordnung (welcher Punkt wohin, wann aktiv, Admin nur für den Betreiber)
 * steht in src/lib/bauern-navigation.ts und ist dort getestet. Hier nur
 * Symbole und Zeichnung — Handy und Browser lesen dieselbe Konfiguration.
 */

const SYMBOL: Record<NavPunktId, LucideIcon> = {
  heute: CalendarCheck,
  bestellungen: ReceiptText,
  // Ein Paket: Produkte sind Tagesgeschäft und haben ihren eigenen Platz.
  produkte: Package,
  // Ein Haus: „Mein Hof" bündelt Hofseite und Beiträge.
  'mein-hof': Home,
  kunden: Users,
  verkaeufe: Tag,
  auswertung: BarChart3,
  einstellungen: SlidersHorizontal,
  // Ein Rettungsring: Hilfe holen und Rückmeldung geben, an einem Ort.
  hilfe: LifeBuoy,
  admin: ShieldCheck,
}

const NEU_SYMBOL: Record<NeuId, LucideIcon> = {
  'verkauf-eintragen': Banknote,
  'status-posten': Megaphone,
  'produkt-anlegen': PackagePlus,
}

const AKTIV: CSSProperties = { background: 'var(--app-bar-ink)', color: 'var(--app-bar)', fontWeight: 600 }
const RUHIG: CSSProperties = { color: 'var(--app-bar-ink-soft)' }
/** Fokusrahmen auf der dunklen Leiste — Outline statt Ring, weil einige Knöpfe ihren Schatten inline tragen. */
const FOKUS = 'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-bar-ink'

interface FarmerNavProps {
  farmName: string
  userName: string
  ordersBadge?: number
  /** Hof-Logo für die Identitätskarte; null = Initialen. */
  farmLogoUrl?: string | null
  /** approvedAt === null — für den ruhigen Status-Punkt an der Karte. */
  farmPending?: boolean
  /** Betreiber-Konto: zeigt den Menüpunkt „Admin" (frisch aus der DB, nie aus der Sitzung). */
  isAdmin?: boolean
  /** Meldungen, die auf den Betreiber warten (Neu + Vermutlich Wunsch) — Zahl am Menüpunkt „Admin". */
  adminBadge?: number
}

/**
 * Die Zahl an einem Punkt — offene Bestellungen oder Meldungen für den
 * Betreiber. Dunkle Schrift (accent-foreground): Weiß auf dem Orange erreicht
 * bei 11 px nur etwa 3:1, verlangt sind 4,5:1 (CODING_STANDARDS §7).
 */
function Zahl({ anzahl, wofuer, klein = false }: { anzahl?: number; wofuer: string; klein?: boolean }) {
  if (!anzahl) return null
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-accent font-bold leading-none text-accent-foreground',
        klein ? 'absolute -top-1.5 -right-2 h-4 min-w-[16px] px-1 text-[9px]' : 'ml-auto h-5 min-w-[20px] px-1.5 text-[11px]'
      )}
    >
      {anzahl > 99 ? '99+' : anzahl}
      <span className="sr-only"> {wofuer}</span>
    </span>
  )
}

/** Überschrift einer Gruppe in Blatt und Seitenleiste. */
function Gruppe({ children }: { children: string }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider" style={RUHIG}>
      {children}
    </div>
  )
}

/** Eine Zeile im Mehr-Blatt (Handy) oder in der Seitenleiste (Browser). */
function NavZeile({
  punkt,
  handy,
  istAktiv,
  ariaCurrent,
  anzahl,
  onNavigate,
}: {
  punkt: NavPunkt
  handy: boolean
  istAktiv: boolean
  ariaCurrent: 'page' | 'true' | undefined
  anzahl?: number
  onNavigate?: () => void
}) {
  const Symbol = SYMBOL[punkt.id]
  return (
    <Link
      href={punkt.href}
      onClick={onNavigate}
      aria-current={ariaCurrent}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-[250ms]',
        handy ? 'min-h-[48px] py-2.5' : 'min-h-10 py-2',
        !istAktiv && 'hover:bg-white/10',
        // Im Browser hebt sich der aktive Punkt mit einem leichten Schatten von der Leiste ab.
        istAktiv && !handy && 'shadow-[0_1px_4px] shadow-black/16',
        FOKUS
      )}
      style={istAktiv ? AKTIV : RUHIG}
    >
      <Symbol className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} aria-hidden="true" />
      <span className="flex-1">{punkt.label}</span>
      <Zahl anzahl={anzahl} wofuer={zahlWofuer(punkt)} />
    </Link>
  )
}

function zahlWofuer(punkt: NavPunkt): string {
  return punkt.zahl === 'admin' ? 'Meldungen zu entscheiden' : 'offene Bestellungen'
}

/** Ein Eintrag von „Neu": Symbol, Titel, ein Satz (Muster wie bei Whatnot). */
function NeuInhalt({ punkt }: { punkt: NeuPunkt }) {
  const Symbol = NEU_SYMBOL[punkt.id]
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Symbol className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-snug">{punkt.label}</span>
        <span className="block text-[13px] leading-snug opacity-80">{punkt.satz}</span>
      </span>
    </>
  )
}

/**
 * Wer angemeldet ist — Initialen und Name. Das Menü unten gehört der Person,
 * nicht dem Hof: Einstellungen, Hilfe, Abmelden sind ihre Handlungen; der Hof
 * hat mit „Mein Hof" seinen eigenen Platz in der Leiste. Kein Foto: Es gibt
 * keins, und Initialen sehen aus wie eine Entscheidung, ein Platzhalter wie
 * ein Fehler (hof-initialen.ts — die Ableitung passt für einen Personennamen
 * genauso).
 */
function Person({ name, handy }: { name: string; handy: boolean }) {
  const anzeige = name.trim() || 'Dein Konto'
  return (
    <div className={cn('flex items-center gap-3 px-3', handy ? 'min-h-[48px] py-2' : 'min-h-10 py-2')}>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-xs font-semibold"
        /* Dieselbe Sand-Plakette wie an der Hofkarte (farm-identity-card.tsx),
           bewusst dieselben Werte: Die Leiste ist in beiden Modi dunkel, dafür
           gibt es kein Token — zwei Plaketten in zwei Tönen wären ein Fehler. */
        /* eslint-disable-next-line no-restricted-syntax -- Sand-Plakette auf der in beiden Modi dunklen Leiste, kein Token passt (siehe oben) */
        style={{ background: '#F2E5D3', color: '#8B6B4F' }}
        aria-hidden="true"
      >
        {hofInitialen(anzeige)}
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-widest" style={RUHIG}>
          Angemeldet
        </span>
        <span className="block truncate text-sm" style={{ color: 'var(--app-bar-ink)' }} title={anzeige}>
          {anzeige}
        </span>
      </span>
    </div>
  )
}

function Abmelden({ handy, onClick }: { handy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Rot als Bedeutungsfarbe, ohne dark:-Gegenstück: Die Leiste ist in beiden
      // Modi dunkelgrün, das helle Rot trägt auf ihr in beiden (CODING_STANDARDS §7).
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-[250ms] hover:bg-red-500/15',
        handy ? 'min-h-[48px] py-2.5 text-red-300' : 'min-h-10 py-2 hover:text-red-300',
        FOKUS
      )}
      style={handy ? undefined : RUHIG}
    >
      <LogOut className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.7} aria-hidden="true" />
      {ABMELDEN_LABEL}
    </button>
  )
}

export function FarmerNav({
  farmName,
  userName,
  ordersBadge,
  farmLogoUrl = null,
  farmPending = false,
  isAdmin = false,
  adminBadge,
}: FarmerNavProps) {
  const pathname = usePathname()
  const router = useRouter()
  const nav = fuerNutzer({ isAdmin })
  const aktiv = aktiverPunkt(pathname)

  // Höchstens ein Blatt offen: „Neu" oder „Mehr".
  const [offen, setOffen] = useState<'neu' | 'mehr' | null>(null)
  const schliessen = () => setOffen(null)
  // Beide Blätter melden Öffnen und Schließen selbst (Escape, Tipp daneben,
  // ihr Knopf). Ein Schließen zählt nur für das eigene Blatt — tippt der Bauer
  // bei offenem „Neu" auf „Mehr", darf das späte Schließen von „Neu" das
  // frisch geöffnete „Mehr" nicht wieder zumachen.
  const wechsle = (welches: 'neu' | 'mehr') => (auf: boolean) =>
    setOffen((jetzt) => (auf ? welches : jetzt === welches ? null : jetzt))

  // Seitenwechsel (auch Zurück im Browser) schließt jedes Blatt.
  const [letzterPfad, setLetzterPfad] = useState(pathname)
  if (pathname !== letzterPfad) {
    setLetzterPfad(pathname)
    setOffen(null)
  }

  // Wird das Tablet bei offenem Blatt ins Querformat gedreht (ab md), gibt
  // es Blatt und Leiste nicht mehr — der Schleier bliebe allein stehen.
  useEffect(() => {
    const breit = window.matchMedia('(min-width: 768px)')
    const beiWechsel = () => {
      if (breit.matches) setOffen(null)
    }
    breit.addEventListener('change', beiWechsel)
    return () => breit.removeEventListener('change', beiWechsel)
  }, [])

  async function handleLogout() {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  function zahlVon(punkt: NavPunkt): number | undefined {
    if (punkt.zahl === 'bestellungen') return ordersBadge
    if (punkt.zahl === 'admin') return adminBadge
    return undefined
  }

  // Blätter über der Leiste: Die Leiste hebt sich über den Schleier, solange
  // eines offen ist — so bleibt das Plus als Kreuz zu sehen und zu tippen.
  // Sonst bleibt sie auf z-50, damit andere Dialoge sie verdecken.
  const blattStil: CSSProperties = {
    bottom: '4rem',
    background: 'var(--app-bar)',
    color: 'var(--app-bar-ink)',
  }
  // Feine helle Oberkante und ein Schatten nach oben, damit sich das Blatt von der Leiste löst.
  const blattKlasse =
    'gap-0 rounded-t-2xl border-t border-white/10 shadow-[0_-8px_24px] shadow-black/25 px-3 pt-3 pb-3 max-h-[calc(100dvh-5rem)] overflow-y-auto md:hidden'

  return (
    <>
      {/* ===== HANDY: Leiste mit fünf Plätzen ===== */}
      <nav
        aria-label="Hauptnavigation"
        // Feste Leiste unten: Der Cookie-Hinweis steht darüber (src/lib/cookie-hinweis.ts).
        data-unten-fest=""
        className={cn(
          'fixed bottom-0 left-0 right-0 border-t border-border md:hidden print:hidden',
          offen ? 'z-[60]' : 'z-50'
        )}
        style={{ background: 'var(--app-bar)' }}
      >
        <div className="flex h-16 items-stretch">
          {HANDY_LEISTE.map((platz) => {
            if (platz.art === 'punkt') {
              const { punkt } = platz
              const Symbol = SYMBOL[punkt.id]
              const istAktiv = aktiv === punkt.id && !offen
              return (
                <Link
                  key={punkt.id}
                  href={punkt.href}
                  onClick={schliessen}
                  aria-current={ariaAktuell(pathname, punkt)}
                  className={cn(
                    'relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-[250ms]',
                    FOKUS
                  )}
                  style={{ color: istAktiv ? 'var(--app-bar-ink)' : 'var(--app-bar-ink-soft)' }}
                >
                  <span className="relative">
                    <Symbol className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                    <Zahl anzahl={zahlVon(punkt)} wofuer={zahlWofuer(punkt)} klein />
                  </span>
                  <span className="leading-none">{punkt.label}</span>
                </Link>
              )
            }

            if (platz.art === 'neu') {
              return (
                <Sheet key="neu" open={offen === 'neu'} onOpenChange={wechsle('neu')}>
                  <div className="flex flex-1 items-start justify-center">
                    {/* Rund, 56 px, in der Akzentfarbe, leicht über die Leiste
                        gehoben. Offen dreht sich das Plus zum Kreuz — bei
                        reduzierter Bewegung ohne Drehbewegung, nur der Wechsel. */}
                    <SheetTrigger
                      aria-label="Neu anlegen"
                      className={cn(
                        // Ein 4-px-Kragen in der Leistenfarbe trennt den Kreis vom Rand, darunter ein Schatten.
                        '-mt-4 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground ring-4 ring-(--app-bar) shadow-[0_6px_16px] shadow-black/28',
                        FOKUS
                      )}
                    >
                      <Plus
                        className={cn(
                          'size-7 motion-safe:transition-transform motion-safe:duration-200',
                          offen === 'neu' && 'rotate-45'
                        )}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </SheetTrigger>
                  </div>
                  <SheetContent side="bottom" showCloseButton={false} className={blattKlasse} style={blattStil}>
                    <div className="flex items-center justify-between px-3 pb-1">
                      <SheetTitle className="font-heading text-base font-semibold" style={{ color: 'var(--app-bar-ink)' }}>
                        Neu
                      </SheetTitle>
                      {/* Das Kreuz in der Leiste schließt für alle, die sehen;
                          dieser Knopf ist für Tastatur und Screenreader da. */}
                      <SheetClose className={cn('sr-only focus-visible:not-sr-only rounded-lg px-2 py-1 text-sm', FOKUS)}>
                        Schließen
                      </SheetClose>
                    </div>
                    {nav.neu.map((punkt) => (
                      <Link
                        key={punkt.id}
                        href={punkt.href}
                        onClick={schliessen}
                        className={cn(
                          'flex min-h-[56px] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/10',
                          FOKUS
                        )}
                        style={{ color: 'var(--app-bar-ink)' }}
                      >
                        <NeuInhalt punkt={punkt} />
                      </Link>
                    ))}
                  </SheetContent>
                </Sheet>
              )
            }

            return (
              <Sheet key="mehr" open={offen === 'mehr'} onOpenChange={wechsle('mehr')}>
                <SheetTrigger
                  // Die Seite liegt im Mehr-Blatt — dasselbe wie aria-current an den Leistenpunkten.
                  aria-current={mehrAktiv(pathname) ? 'true' : undefined}
                  className={cn(
                    'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-xs transition-colors duration-[250ms]',
                    FOKUS
                  )}
                  style={{
                    color: offen === 'mehr' || (!offen && mehrAktiv(pathname)) ? 'var(--app-bar-ink)' : 'var(--app-bar-ink-soft)',
                  }}
                >
                  <MoreHorizontal className="h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                  <span className="leading-none">Mehr</span>
                </SheetTrigger>
                <SheetContent
                  side="bottom"
                  showCloseButton={false}
                  aria-label="Mehr"
                  className={blattKlasse}
                  style={blattStil}
                >
                  {/* Kopf des Blatts: die Person, daneben Hell/Dunkel und
                      Schließen. Die Hofkarte stand hier bis „Mein Hof" seinen
                      Platz in der Leiste bekam — das Blatt ist jetzt Betrieb
                      und Konto, kein zweiter Hof-Auftritt. */}
                  <div className="mb-1 flex items-center justify-between gap-2 px-1 pt-1">
                    <div className="min-w-0 flex-1">
                      <Person name={userName} handy />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <ThemeUmschalter className="rounded-full hover:bg-white/10" style={RUHIG} />
                      <SheetClose
                        aria-label="Schließen"
                        className={cn(
                          'flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/10',
                          FOKUS
                        )}
                        style={RUHIG}
                      >
                        <X className="size-5" strokeWidth={1.7} aria-hidden="true" />
                      </SheetClose>
                    </div>
                  </div>
                  {/* Hauptpunkte ohne Platz in der Leiste — Produkte — stehen zuoberst. */}
                  {nav.nurImMehr.map((punkt) => (
                    <NavZeile key={punkt.id} punkt={punkt} handy istAktiv={aktiv === punkt.id} ariaCurrent={ariaAktuell(pathname, punkt)} anzahl={zahlVon(punkt)} onNavigate={schliessen} />
                  ))}
                  <Gruppe>{VERKAUF_UND_KUNDEN_TITEL}</Gruppe>
                  {nav.verkaufUndKunden.map((punkt) => (
                    <NavZeile key={punkt.id} punkt={punkt} handy istAktiv={aktiv === punkt.id} ariaCurrent={ariaAktuell(pathname, punkt)} anzahl={zahlVon(punkt)} onNavigate={schliessen} />
                  ))}
                  <div className="my-2 border-t border-white/10" />
                  {nav.unten.map((punkt) => (
                    <NavZeile key={punkt.id} punkt={punkt} handy istAktiv={aktiv === punkt.id} ariaCurrent={ariaAktuell(pathname, punkt)} anzahl={zahlVon(punkt)} onNavigate={schliessen} />
                  ))}
                  <Abmelden handy onClick={handleLogout} />
                </SheetContent>
              </Sheet>
            )
          })}
        </div>
      </nav>

      {/* ===== BROWSER: Seitenleiste ===== */}
      <aside
        className="hidden border-r border-white/8 md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-56 md:flex-col print:hidden"
        style={{ background: 'var(--app-bar)' }}
      >
        {/* Hof-Visitenkarte am Kopf: der Hof tritt auf. WER angemeldet ist,
            steht unten bei den Handlungen der Person. */}
        <div className="shrink-0 border-b border-white/10 px-4 py-4">
          <FarmIdentityCard farmName={farmName} logoUrl={farmLogoUrl} wartetAufFreigabe={farmPending} />
        </div>

        {/* Alles darunter scrollt als eine Spalte: Auf niedrigen Bildschirmen
            bleibt so jeder Punkt erreichbar, auf hohen sitzt der Rest unten. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="px-2 pt-3">
            {/* Der Neu-Knopf nach dem Mockup (hof-sidebar-komponente.html): volle
                Breite, deshalb Radius 13 statt Pille (DESIGN_SYSTEM „Form"),
                Symbol links, Pfeil rechts, unten eine dünne dunkle Kante aus
                der Schriftfarbe des Knopfs. Das Menü zeigt die zwei Dinge, die
                auf der Hofseite landen (NEU_BROWSER). */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  // Rand und Unterkante im Ton der Schrift, wie im Mockup: 1 px Rand bei 30 %, innen unten 1 px bei 20 %.
                  'group flex min-h-11 w-full items-center gap-2.5 rounded-[13px] border border-accent-foreground/30 bg-accent px-3.5 text-left text-[14.5px] font-semibold text-accent-foreground shadow-[inset_0_-1px_0_0] shadow-accent-foreground/20 transition-colors hover:bg-accent-hover',
                  FOKUS
                )}
              >
                <Plus className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span className="flex-1">Neu</span>
                <ChevronDown
                  className="size-4 shrink-0 opacity-80 transition-transform group-data-[popup-open]:rotate-180"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72">
                {nav.neuBrowser.map((punkt) => (
                  <DropdownMenuLinkItem key={punkt.id} render={<Link href={punkt.href} />}>
                    <NeuInhalt punkt={punkt} />
                  </DropdownMenuLinkItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <nav aria-label="Hauptnavigation" className="space-y-0.5 px-2 py-3">
            {nav.haupt.map((punkt) => (
              <NavZeile key={punkt.id} punkt={punkt} handy={false} istAktiv={aktiv === punkt.id} ariaCurrent={ariaAktuell(pathname, punkt)} anzahl={zahlVon(punkt)} />
            ))}
            <Gruppe>{VERKAUF_UND_KUNDEN_TITEL}</Gruppe>
            {nav.verkaufUndKunden.map((punkt) => (
              <NavZeile key={punkt.id} punkt={punkt} handy={false} istAktiv={aktiv === punkt.id} ariaCurrent={ariaAktuell(pathname, punkt)} anzahl={zahlVon(punkt)} />
            ))}
          </nav>

          <div className="mt-auto space-y-0.5 border-t border-white/10 px-2 py-3">
            <Person name={userName} handy={false} />
            {nav.unten.map((punkt) => (
              <NavZeile key={punkt.id} punkt={punkt} handy={false} istAktiv={aktiv === punkt.id} ariaCurrent={ariaAktuell(pathname, punkt)} anzahl={zahlVon(punkt)} />
            ))}
            {/* Hell/Dunkel als Zeile wie die Nachbarn — ein Klick von jeder
                Bauern-Seite, ohne den Weg über Einstellungen → Konto. */}
            <ThemeUmschalterZeile className={cn('min-h-10 py-2 duration-[250ms] hover:bg-white/10', FOKUS)} style={RUHIG} />
            <Abmelden handy={false} onClick={handleLogout} />
          </div>
        </div>
      </aside>
    </>
  )
}
