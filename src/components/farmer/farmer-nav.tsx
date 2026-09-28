'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu } from '@base-ui/react/menu'
import {
  Banknote,
  BarChart3,
  Bug,
  CalendarCheck,
  Home,
  Inbox,
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
import { FarmIdentityCard } from '@/components/farmer/farm-identity-card'
import { ThemeUmschalter, ThemeUmschalterZeile } from '@/components/shared/theme-umschalter'
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  ABMELDEN_LABEL,
  HANDY_LEISTE,
  aktiverPunkt,
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
  produkte: Package,
  hofseite: Home,
  kunden: Users,
  verkaeufe: Tag,
  auswertung: BarChart3,
  status: Megaphone,
  einstellungen: SlidersHorizontal,
  'fehler-melden': Bug,
  meldungen: Inbox,
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
  anzahl,
  onNavigate,
}: {
  punkt: NavPunkt
  handy: boolean
  istAktiv: boolean
  anzahl?: number
  onNavigate?: () => void
}) {
  const Symbol = SYMBOL[punkt.id]
  return (
    <Link
      href={punkt.href}
      onClick={onNavigate}
      aria-current={istAktiv ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-[250ms]',
        handy ? 'min-h-[48px] py-2.5' : 'min-h-10 py-2',
        !istAktiv && 'hover:bg-white/10',
        FOKUS
      )}
      style={istAktiv ? { ...AKTIV, ...(handy ? {} : { boxShadow: '0 1px 4px rgba(0,0,0,0.16)' }) } : RUHIG}
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
    borderTop: '1px solid rgba(255,255,255,0.10)',
    boxShadow: '0 -8px 24px rgba(0,0,0,0.25)',
  }
  const blattKlasse = 'gap-0 rounded-t-2xl border-t-0 px-3 pt-3 pb-3 max-h-[calc(100dvh-5rem)] overflow-y-auto md:hidden'

  return (
    <>
      {/* ===== HANDY: Leiste mit fünf Plätzen ===== */}
      <nav
        aria-label="Hauptnavigation"
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
                  aria-current={aktiv === punkt.id ? 'page' : undefined}
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
                        '-mt-4 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground',
                        FOKUS
                      )}
                      style={{ boxShadow: '0 0 0 4px var(--app-bar), 0 6px 16px rgba(0,0,0,0.28)' }}
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
                  {/* Kopf des Blatts: die Hof-Visitenkarte, daneben Hell/Dunkel
                      und Schließen — wie bisher. */}
                  <div className="mb-1 flex items-start justify-between gap-2 px-1 pt-1">
                    <div className="min-w-0 flex-1">
                      <FarmIdentityCard
                        farmName={farmName}
                        logoUrl={farmLogoUrl}
                        wartetAufFreigabe={farmPending}
                        onNavigate={schliessen}
                      />
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
                  <Gruppe>Dein Hof</Gruppe>
                  {nav.deinHof.map((punkt) => (
                    <NavZeile key={punkt.id} punkt={punkt} handy istAktiv={aktiv === punkt.id} anzahl={zahlVon(punkt)} onNavigate={schliessen} />
                  ))}
                  <div className="my-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.10)' }} />
                  {nav.unten.map((punkt) => (
                    <NavZeile key={punkt.id} punkt={punkt} handy istAktiv={aktiv === punkt.id} anzahl={zahlVon(punkt)} onNavigate={schliessen} />
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
        className="hidden md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-56 md:flex-col print:hidden"
        style={{ background: 'var(--app-bar)', borderRight: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Hof-Visitenkarte am Kopf. Der Nutzername darunter sagt, WER
            angemeldet ist — das beantwortet die Karte nicht. */}
        <div className="shrink-0 px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
          <FarmIdentityCard farmName={farmName} logoUrl={farmLogoUrl} wartetAufFreigabe={farmPending} />
          <div className="mt-2.5 truncate text-xs" style={{ color: 'var(--app-bar-ink-soft)', opacity: 0.7 }}>
            {userName}
          </div>
        </div>

        {/* Alles darunter scrollt als eine Spalte: Auf niedrigen Bildschirmen
            bleibt so jeder Punkt erreichbar, auf hohen sitzt der Rest unten. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="px-2 pt-3">
            <Menu.Root>
              <Menu.Trigger
                className={cn(
                  'flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover',
                  FOKUS
                )}
              >
                <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
                Neu
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50 outline-none">
                  <Menu.Popup className="w-72 origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                    {nav.neu.map((punkt) => (
                      <Menu.LinkItem
                        key={punkt.id}
                        closeOnClick
                        render={<Link href={punkt.href} />}
                        className="flex items-center gap-3 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-muted"
                      >
                        <NeuInhalt punkt={punkt} />
                      </Menu.LinkItem>
                    ))}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>

          <nav aria-label="Hauptnavigation" className="space-y-0.5 px-2 py-3">
            {nav.haupt.map((punkt) => (
              <NavZeile key={punkt.id} punkt={punkt} handy={false} istAktiv={aktiv === punkt.id} anzahl={zahlVon(punkt)} />
            ))}
            <Gruppe>Dein Hof</Gruppe>
            {nav.deinHof.map((punkt) => (
              <NavZeile key={punkt.id} punkt={punkt} handy={false} istAktiv={aktiv === punkt.id} anzahl={zahlVon(punkt)} />
            ))}
          </nav>

          <div className="mt-auto space-y-0.5 px-2 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            {nav.unten.map((punkt) => (
              <NavZeile key={punkt.id} punkt={punkt} handy={false} istAktiv={aktiv === punkt.id} anzahl={zahlVon(punkt)} />
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
