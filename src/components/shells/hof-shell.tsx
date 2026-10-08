'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Compass,
  Eye,
  Home,
  LifeBuoy,
  LogOut,
  MoreHorizontal,
  Package,
  Plus,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { signOut } from '@/lib/auth-client'
import { fuehreAbmeldenAus } from '@/lib/abmelden'
import { hofInitialen } from '@/lib/hof-initialen'
import { vorschauLink } from '@/lib/hofseite-vorschau'
import {
  EINSTELLUNG_KONTO,
  HOF_NEU_ANDERES_TITEL,
  HOF_NEU_TITEL,
  VERKAUF_UND_KUNDEN_TITEL,
  ABMELDEN_LABEL,
  hofAriaAktuell,
  hofMehrAktiv,
  hofNavigation,
  type HofNavId,
  type HofNavPunkt,
  type HofNeuPunkt,
} from '@/lib/bauern-navigation'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { BottomNav, BottomNavLink, BottomNavMitte, bottomNavEintragKlassen, mittelknopfKlassen } from '@/components/ui/bottom-nav'
import { SidebarEintrag, SidebarGruppe } from '@/components/ui/sidebar-gruppe'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { Zaehler } from '@/components/ui/zaehler'
import { Sheet, SheetBlatt, SheetClose, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeUmschalterZeile } from '@/components/shared/theme-umschalter'
import { INHALT_ID, SprungLink } from '@/components/shells/sprung-link'
import { NEU_SYMBOL } from '@/components/hofbereich/neu-symbol'

/*
 * Die Shell des Hofbereichs im neuen Design (Gate 2). Ordnung, aktive Punkte
 * und „Admin nur für Betreiber" kommen aus src/lib/bauern-navigation.ts
 * (hofNavigation) — Seitenleiste und Handy lesen dieselbe Quelle. Hier nur
 * Symbole und Zeichnung nach den Mockups system-komponente-seitenleiste-hof,
 * mobil-h3-heute-mit-teilen-karte und mobil-h5-mehr-auswertung-region-mein-hof.
 *
 * Die Shell setzt data-design="neu" und damit die Tokens des Design-Systems
 * für das ganze Dokument. Noch nutzt sie keine Route (kein Big Bang): Der
 * Bauern-Bereich läuft weiter über (farmer)/layout.tsx mit farmer-nav.tsx.
 */

const SYMBOL: Record<HofNavId, LucideIcon> = {
  heute: CalendarCheck,
  bestellungen: ReceiptText,
  produkte: Package,
  'mein-hof': Home,
  kunden: Users,
  verkaeufe: Tag,
  auswertung: BarChart3,
  region: Compass,
  einstellungen: SlidersHorizontal,
  hilfe: LifeBuoy,
  admin: ShieldCheck,
}


export type HofShellProps = {
  hofName: string
  /** Für „Hofseite ansehen" — führt in die Vorschau der echten Hofseite. */
  hofSlug: string
  /** Wer angemeldet ist; leer = „Dein Konto". */
  personName: string
  /** Frisch aus der Datenbank (isAdminUser), nie aus der Sitzung. */
  isAdmin: boolean
  /** Offene Bestellungen und Meldungen, die auf den Betreiber warten. */
  zahlen?: { bestellungen?: number; admin?: number }
  /**
   * Nur für die Vorschau unter /intern: ersetzt das echte Abmelden, damit der
   * Admin vor der Vorschau angemeldet bleibt. Echte Routen lassen es weg.
   */
  onAbmelden?: () => void
  children: ReactNode
}

function zahlFuer(punkt: HofNavPunkt, zahlen: HofShellProps['zahlen']): number | undefined {
  if (punkt.zahl === 'bestellungen') return zahlen?.bestellungen
  if (punkt.zahl === 'admin') return zahlen?.admin
  return undefined
}

function zahlWofuer(punkt: HofNavPunkt): string {
  return punkt.zahl === 'admin' ? 'Meldungen zu entscheiden' : 'offene Bestellungen'
}

/** Initialen auf einer runden Plakette — für Hof und Person, keine Fotos (hof-initialen.ts). */
function Plakette({ name, gross = false }: { name: string; gross?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-border font-semibold text-foreground',
        gross ? 'size-9 text-[15px]' : 'size-[30px] text-[11.5px]'
      )}
    >
      {hofInitialen(name)}
    </span>
  )
}

/** Die Hofkarte am Kopf der Seitenleiste bzw. des Mehr-Blatts: der Hof tritt auf. */
function Hofkarte({
  hofName,
  hofSlug,
  meinHof,
  onNavigate,
}: {
  hofName: string
  hofSlug: string
  /** Am Handy ist die Karte zugleich der Punkt „Mein Hof" aus „Mehr". */
  meinHof?: { punkt: HofNavPunkt; aktuell: 'page' | 'true' | undefined }
  onNavigate?: () => void
}) {
  const kopf = (
    <>
      <Plakette name={hofName} gross />
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">Mein Hof</span>
        <span className="block truncate text-[15px] font-semibold text-foreground" title={hofName}>
          {hofName}
        </span>
      </span>
    </>
  )
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-border bg-muted p-3">
      {meinHof ? (
        <Link
          href={meinHof.punkt.href}
          onClick={onNavigate}
          aria-current={meinHof.aktuell}
          className={cn('-m-1 flex items-center gap-2.5 rounded-xl p-1 hover:bg-card', FOKUS_RAHMEN)}
        >
          {kopf}
        </Link>
      ) : (
        <div className="flex items-center gap-2.5">{kopf}</div>
      )}
      <Link
        href={vorschauLink(hofSlug)}
        onClick={onNavigate}
        className={cn(
          'flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border text-[13.5px] font-medium text-foreground transition-colors duration-[250ms] hover:bg-card',
          FOKUS_RAHMEN
        )}
      >
        <Eye className="size-[15px]" strokeWidth={1.7} aria-hidden="true" />
        Hofseite ansehen
      </Link>
    </div>
  )
}

/**
 * Wer angemeldet ist — das Menü unten gehört der Person, nicht dem Hof. Im
 * Mehr-Blatt ist die Zeile seit Nr. 44 ein Link auf „Konto und Sicherheit"
 * (dort Passwort, Darstellung, Hof stilllegen); in der Seitenleiste steht
 * „Einstellungen" gleich darunter, dort bleibt sie Anzeige.
 */
export function PersonZeile({
  name,
  konto,
  onNavigate,
}: {
  name: string
  /** Mit Ziel ein Link (Mehr-Blatt), sonst Anzeige (Seitenleiste). */
  konto?: { label: string; href: string }
  onNavigate?: () => void
}): React.JSX.Element {
  const anzeige = name.trim() || 'Dein Konto'
  const inhalt = (
    <>
      <Plakette name={anzeige} />
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">Angemeldet</span>
        <span className="block truncate text-[13.5px] font-semibold text-foreground" title={anzeige}>
          {anzeige}
        </span>
      </span>
    </>
  )
  if (!konto) return <div className="flex items-center gap-2.5 px-3 pt-1 pb-2">{inhalt}</div>
  return (
    <Link
      href={konto.href}
      onClick={onNavigate}
      className={cn('flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-1.5 transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN)}
    >
      {inhalt}
      {/* Wohin der Link führt — sichtbar zeigt der Pfeil nur, dass es weitergeht. */}
      <span className="sr-only">{`, ${konto.label}`}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
    </Link>
  )
}

/** Ein Eintrag im Neu-Menü: Symbol, Titel, ein Satz. */
function NeuInhalt({ punkt }: { punkt: HofNeuPunkt }) {
  const Symbol = NEU_SYMBOL[punkt.id]
  return (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/14 text-status-offen">
        <Symbol className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-semibold text-foreground">{punkt.label}</span>
        <span className="block text-[12.5px] text-muted-foreground">{punkt.satz}</span>
      </span>
    </>
  )
}

export function HofShell({ hofName, hofSlug, personName, isAdmin, zahlen, onAbmelden, children }: HofShellProps): React.JSX.Element {
  const pathname = usePathname()
  const router = useRouter()
  const nav = hofNavigation({ isAdmin })
  const neuAnlegen = nav.neu.filter((p) => p.gruppe === 'anlegen')
  const neuAnderes = nav.neu.filter((p) => p.gruppe === 'anderes')

  // Höchstens ein Blatt offen: „Neu" oder „Mehr" (Muster aus farmer-nav.tsx).
  const [offen, setOffen] = useState<'neu' | 'mehr' | null>(null)
  const schliessen = () => setOffen(null)
  const wechsle = (welches: 'neu' | 'mehr') => (auf: boolean) =>
    setOffen((jetzt) => (auf ? welches : jetzt === welches ? null : jetzt))

  // Seitenwechsel schließt jedes Blatt.
  const [letzterPfad, setLetzterPfad] = useState(pathname)
  if (pathname !== letzterPfad) {
    setLetzterPfad(pathname)
    setOffen(null)
  }

  // Ab 768 px gibt es Blätter und Leiste nicht — ein offenes Blatt ließe den Schleier allein stehen.
  useEffect(() => {
    const breit = window.matchMedia('(min-width: 768px)')
    const beiWechsel = () => {
      if (breit.matches) setOffen(null)
    }
    breit.addEventListener('change', beiWechsel)
    return () => breit.removeEventListener('change', beiWechsel)
  }, [])

  async function abmelden() {
    await fuehreAbmeldenAus({
      ersatz: onAbmelden,
      abmelden: () => signOut(),
      beiFehler: (satz) => toast.error(satz),
      danach: () => {
        router.push('/login')
        router.refresh()
      },
    })
  }

  const abmeldenKnopf = (klassen: string) => (
    <button
      type="button"
      onClick={abmelden}
      className={cn('flex w-full items-center gap-[11px] text-left text-foreground transition-colors duration-[250ms] hover:bg-muted', klassen)}
    >
      <LogOut className="size-[17px] shrink-0" strokeWidth={1.7} aria-hidden="true" />
      {ABMELDEN_LABEL}
    </button>
  )

  // Das Mehr-Blatt liegt über der Leiste; sie bleibt sichtbar und bedienbar.
  const ueberDerLeiste = 'bottom-[calc(68px+env(safe-area-inset-bottom))] max-h-[calc(100dvh-68px-env(safe-area-inset-bottom)-1rem)] pb-4'

  const meinHofImMehr = nav.mehr.find((p) => p.id === 'mein-hof')
  const vukImMehr = nav.mehr.filter((p) => nav.verkaufUndKunden.some((v) => v.id === p.id))
  const untenImMehr = nav.mehr.filter((p) => nav.unten.some((u) => u.id === p.id))

  return (
    <div data-design="neu" className="min-h-dvh bg-background text-foreground">
      <SprungLink />

      {/* ===== Browser: Seitenleiste ===== */}
      <aside
        aria-label="Hofbereich"
        className="hidden border-r border-border bg-card md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-[264px] md:flex-col print:hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3.5">
          <Hofkarte hofName={hofName} hofSlug={hofSlug} />

          {/* Volle Breite, deshalb Radius 13 statt Pille (DESIGN_SYSTEM „Form"). */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'group mt-3.5 flex min-h-11 w-full items-center gap-[11px] rounded-[13px] border border-primary-foreground/25 bg-primary px-3.5 text-left text-[14.5px] font-semibold text-primary-foreground shadow-[inset_0_-1px_0_0] shadow-primary-foreground/20 transition-colors duration-[250ms] hover:bg-primary/90',
                FOKUS_RAHMEN
              )}
            >
              <Plus className="size-[17px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
              <span className="flex-1">Neu</span>
              <ChevronDown
                className="size-3.5 shrink-0 opacity-75 transition-transform group-data-[popup-open]:rotate-180"
                strokeWidth={2}
                aria-hidden="true"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{HOF_NEU_TITEL}</DropdownMenuLabel>
                {neuAnlegen.map((punkt) => (
                  <DropdownMenuLinkItem key={punkt.id} render={<Link href={punkt.href} />}>
                    <NeuInhalt punkt={punkt} />
                  </DropdownMenuLinkItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{HOF_NEU_ANDERES_TITEL}</DropdownMenuLabel>
                {neuAnderes.map((punkt) => (
                  <DropdownMenuLinkItem key={punkt.id} render={<Link href={punkt.href} />}>
                    <NeuInhalt punkt={punkt} />
                  </DropdownMenuLinkItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <nav aria-label="Hauptnavigation" className="mt-3.5 flex flex-1 flex-col">
            <SidebarGruppe>
              {nav.haupt.map((punkt) => (
                <SidebarEintrag
                  key={punkt.id}
                  href={punkt.href}
                  label={punkt.label}
                  symbol={SYMBOL[punkt.id]}
                  aktuell={hofAriaAktuell(pathname, punkt)}
                  zahl={zahlFuer(punkt, zahlen)}
                  zahlWofuer={zahlWofuer(punkt)}
                />
              ))}
            </SidebarGruppe>
            <SidebarGruppe titel={VERKAUF_UND_KUNDEN_TITEL}>
              {nav.verkaufUndKunden.map((punkt) => (
                <SidebarEintrag
                  key={punkt.id}
                  href={punkt.href}
                  label={punkt.label}
                  symbol={SYMBOL[punkt.id]}
                  aktuell={hofAriaAktuell(pathname, punkt)}
                />
              ))}
            </SidebarGruppe>

            <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
              <PersonZeile name={personName} />
              <SidebarGruppe>
                {nav.unten.map((punkt) => (
                  <SidebarEintrag
                    key={punkt.id}
                    href={punkt.href}
                    label={punkt.label}
                    symbol={SYMBOL[punkt.id]}
                    aktuell={hofAriaAktuell(pathname, punkt)}
                    zahl={zahlFuer(punkt, zahlen)}
                    zahlWofuer={zahlWofuer(punkt)}
                    klein
                  />
                ))}
              </SidebarGruppe>
              <ThemeUmschalterZeile className={cn('min-h-11 gap-[11px] rounded-xl py-2 text-[14px] text-foreground hover:bg-muted', FOKUS_RAHMEN)} />
              {abmeldenKnopf(cn('min-h-11 rounded-xl px-3 text-[14px]', FOKUS_RAHMEN))}
            </div>
          </nav>
        </div>
      </aside>

      <main id={INHALT_ID} tabIndex={-1} className="min-w-0 pb-28 outline-none md:pb-0 md:pl-[264px] print:pb-0 print:pl-0">
        {children}
      </main>

      {/* ===== Handy: Unterleiste ===== */}
      <BottomNav ueberSchleier={offen !== null}>
        {nav.handyLeiste.map((platz) => {
          if (platz.art === 'punkt') {
            const { punkt } = platz
            return (
              <BottomNavLink
                key={punkt.id}
                href={punkt.href}
                label={punkt.label}
                symbol={SYMBOL[punkt.id]}
                aktuell={offen ? undefined : hofAriaAktuell(pathname, punkt)}
                zahl={zahlFuer(punkt, zahlen)}
                zahlWofuer={zahlWofuer(punkt)}
                onNavigate={schliessen}
              />
            )
          }

          if (platz.art === 'neu') {
            return (
              <BottomNavMitte key="neu">
                <Sheet open={offen === 'neu'} onOpenChange={wechsle('neu')}>
                  <SheetTrigger aria-label="Neu erstellen" className={mittelknopfKlassen('orange')}>
                    <Plus
                      className={cn('size-6 motion-safe:transition-transform motion-safe:duration-200', offen === 'neu' && 'rotate-45')}
                      strokeWidth={2.2}
                      aria-hidden="true"
                    />
                  </SheetTrigger>
                  <SheetBlatt className={ueberDerLeiste}>
                    <SheetTitle className="font-heading text-xl font-semibold">{HOF_NEU_TITEL}</SheetTitle>
                    {[neuAnlegen, neuAnderes].map((gruppe, i) => (
                      <ul
                        key={i}
                        aria-label={i === 0 ? HOF_NEU_TITEL : HOF_NEU_ANDERES_TITEL}
                        className={cn('flex flex-col gap-1', i > 0 && 'border-t border-border pt-2')}
                      >
                        {gruppe.map((punkt) => (
                          <li key={punkt.id}>
                            <Link
                              href={punkt.href}
                              onClick={schliessen}
                              className={cn('flex min-h-14 items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted', FOKUS_RAHMEN)}
                            >
                              <NeuInhalt punkt={punkt} />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ))}
                    <SheetClose
                      className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-brand-text hover:bg-muted', FOKUS_RAHMEN)}
                    >
                      Abbrechen
                    </SheetClose>
                  </SheetBlatt>
                </Sheet>
              </BottomNavMitte>
            )
          }

          const mehrAktiv = offen === 'mehr' || (!offen && hofMehrAktiv(pathname))
          return (
            <Sheet key="mehr" open={offen === 'mehr'} onOpenChange={wechsle('mehr')}>
              <SheetTrigger aria-current={!offen && hofMehrAktiv(pathname) ? 'true' : undefined} className={bottomNavEintragKlassen(mehrAktiv)}>
                <MoreHorizontal className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
                <span>Mehr</span>
              </SheetTrigger>
              <SheetBlatt className={ueberDerLeiste}>
                <div className="flex items-center justify-between gap-2">
                  <SheetTitle className="font-heading text-2xl font-semibold">Mehr</SheetTitle>
                  <SheetClose className={cn('min-h-11 rounded-full px-4 text-sm font-semibold text-brand-text hover:bg-muted', FOKUS_RAHMEN)}>
                    Schließen
                  </SheetClose>
                </div>
                {meinHofImMehr && (
                  <Hofkarte
                    hofName={hofName}
                    hofSlug={hofSlug}
                    meinHof={{ punkt: meinHofImMehr, aktuell: hofAriaAktuell(pathname, meinHofImMehr) }}
                    onNavigate={schliessen}
                  />
                )}
                <p aria-hidden="true" className="px-0.5 pt-1 text-[11px] font-semibold tracking-[1.1px] text-muted-foreground uppercase">
                  {VERKAUF_UND_KUNDEN_TITEL}
                </p>
                <ListGruppe beschriftung={VERKAUF_UND_KUNDEN_TITEL}>
                  {vukImMehr.map((punkt) => (
                    <ListRow
                      key={punkt.id}
                      titel={punkt.label}
                      symbol={SYMBOL[punkt.id]}
                      href={punkt.href}
                      aktuell={hofAriaAktuell(pathname, punkt)}
                      onNavigate={schliessen}
                    />
                  ))}
                </ListGruppe>
                <PersonZeile name={personName} konto={EINSTELLUNG_KONTO} onNavigate={schliessen} />
                <ListGruppe beschriftung="Konto und Hilfe">
                  {untenImMehr.map((punkt) => (
                    <ListRow
                      key={punkt.id}
                      titel={punkt.label}
                      symbol={SYMBOL[punkt.id]}
                      href={punkt.href}
                      aktuell={hofAriaAktuell(pathname, punkt)}
                      ende={<Zaehler anzahl={zahlFuer(punkt, zahlen)} wofuer={zahlWofuer(punkt)} />}
                      onNavigate={schliessen}
                    />
                  ))}
                  <li>
                    <ThemeUmschalterZeile className={cn('min-h-[50px] gap-3 rounded-none px-3.5 text-[14.5px] font-medium text-foreground hover:bg-muted', FOKUS_RAHMEN_INNEN)} />
                  </li>
                  <li>{abmeldenKnopf(cn('min-h-[50px] px-3.5 text-[14.5px] font-medium', FOKUS_RAHMEN_INNEN))}</li>
                </ListGruppe>
              </SheetBlatt>
            </Sheet>
          )
        })}
      </BottomNav>
    </div>
  )
}
