'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlignLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  Clock3,
  CreditCard,
  ImageIcon,
  Images,
  LayoutList,
  MapPin,
  PenLine,
  Phone,
  Quote,
  ShoppingBag,
  Stamp,
  type LucideIcon,
} from 'lucide-react'
import type { FarmSettings } from '@/server/queries/farm'
import type { AppearanceData } from '@/server/queries/appearance'
import { type HofseiteFortschritt, type HofseiteZeile } from '@/lib/hofseite-fortschritt'
import type { HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import { VORSCHAU_BEARBEITUNG_BREITE, VORSCHAU_WEB_MINDESTBREITE, type VorschauGeraet } from '@/lib/hofseite-vorschau'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { AbschnittInhalt, SOFORT_GESPEICHERT, type AbschnittHof } from '@/components/mein-hof/abschnitt-inhalt'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { schildTon } from '@/lib/mein-hof'
import { HofseiteVorschauRahmen } from '@/components/farmer/hofseite-vorschau-rahmen'
import { cn } from '@/lib/utils'

/*
 * Der Reiter „Hofseite" von Mein Hof ab lg: links die Hofseite als Liste mit
 * Fortschritt, rechts die echte Seite als Handy-Vorschau. Was die Liste sagt,
 * entscheidet src/lib/hofseite-fortschritt.ts; hier wird gezeichnet.
 *
 * Jede Zeile öffnet ihren Baustein (AbschnittInhalt,
 * components/mein-hof/abschnitt-inhalt.tsx) — seit Nr. 50 dieselben Bausteine
 * wie unter lg im Blatt von unten (components/mein-hof/abschnitte-liste.tsx),
 * dazu Leitspruch/Gründungsjahr und Werte aus dem früheren „Mein Auftritt".
 * Gespeichert wird ausschließlich über die vorhandenen Server-Aktionen, jeder
 * Abschnitt mit frischem Stand vom Server (components/mein-hof/abschnitt-speichern.ts).
 */

type Props = {
  fortschritt: HofseiteFortschritt
  hof: AbschnittHof
  einstellungen: FarmSettings
  auftritt: AppearanceData
}

const SYMBOL: Record<HofseiteZeileId, LucideIcon> = {
  titelbild: ImageIcon,
  logo: Stamp,
  name: PenLine,
  tagline: Quote,
  'ueber-uns': AlignLeft,
  werte: BadgeCheck,
  fotos: Images,
  adresse: MapPin,
  abholzeiten: Clock3,
  zahlung: CreditCard,
  kontakt: Phone,
  bestellungen: ShoppingBag,
  abschnitte: LayoutList,
}

// ── Zeile und Gruppe ──────────────────────────────────────────────────────────

function Zeile({
  zeile,
  offen,
  onToggle,
  children,
}: {
  zeile: HofseiteZeile
  offen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const Zeichen = SYMBOL[zeile.id]
  const inhaltId = `hofseite-zeile-${zeile.id}`
  return (
    <li className={cn('border-t border-border first:border-t-0', offen && 'bg-muted/30')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={offen}
        aria-controls={inhaltId}
        className={cn('flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted', FOKUS_RAHMEN_INNEN)}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-muted text-foreground">
          <Zeichen className="size-4" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{zeile.titel}</span>
          <span className="block truncate text-[13px] text-muted-foreground">{zeile.wert}</span>
        </span>
        {zeile.marke ? (
          <StatusBadge status={schildTon(zeile.marke.farbe)}>{zeile.marke.text}</StatusBadge>
        ) : (
          <>
            <Check className="size-4 shrink-0 text-brand-text" strokeWidth={2.2} aria-hidden="true" />
            <span className="sr-only">fertig</span>
          </>
        )}
        <ChevronRight
          className={cn('size-4 shrink-0 text-muted-foreground transition-transform', offen && 'rotate-90')}
          aria-hidden="true"
        />
      </button>
      {offen && (
        <div id={inhaltId} className="px-4 pb-5 pl-16">
          {children}
        </div>
      )}
    </li>
  )
}

export function HofseiteEditor({ fortschritt, hof, einstellungen, auftritt }: Props): React.JSX.Element {
  const router = useRouter()
  // Nur eine Zeile offen zugleich — und genau die markiert die Vorschau.
  const [offen, setOffen] = useState<HofseiteZeileId | null>(null)
  // Solange ein Foto hochlädt, bleibt die Zeile offen: Das Datei-Feld darf bis
  // zum fertigen Upload nicht aushängen (CODING_STANDARDS §8).
  const [hochladen, setHochladen] = useState(false)
  // Zählt bei jedem erfolgreichen Speichern hoch; die Vorschau lädt dann neu.
  const [stand, setStand] = useState(0)
  // Das Gerät der Vorschau. Web passt erst ab 1280 px neben die Bearbeitung
  // (dann rückt sie auf ~400 px zusammen); darunter zeigt der Rahmen Web im Overlay.
  const [geraet, setGeraet] = useState<VorschauGeraet>('handy')
  const breit = useMindestbreite(VORSCHAU_WEB_MINDESTBREITE)
  const webInline = geraet === 'web' && breit

  // Formulare schließen sich nach dem Speichern: Der Refresh liefert neue
  // Startwerte, und ein offenes Formular hielte die alten fest. Was sofort
  // speichert (Bilder, Abholzeiten, Pause), bleibt offen.
  function gespeichert(id: HofseiteZeileId) {
    setStand((s) => s + 1)
    router.refresh()
    if (!SOFORT_GESPEICHERT.has(id)) setOffen(null)
  }

  function umschalten(id: HofseiteZeileId) {
    if (hochladen) return
    setOffen((jetzt) => (jetzt === id ? null : id))
  }

  return (
    // data-app-palette: Die eingebundenen Formulare der Einstellungen (Abholzeiten,
    // Pause) zeichnen noch mit --app-*; hier nehmen sie die Werte des
    // Design-Systems an (globals.css).
    <div data-app-palette="neu" className="flex items-start gap-6 xl:gap-8">
      <div className="min-w-0 flex-1 space-y-6">
        {/* Fortschritt */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">
              Deine Hofseite ist zu {fortschritt.erledigt} von {fortschritt.gesamt} fertig
            </h2>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">{fortschritt.prozent} %</p>
          </div>
          {/* Der Wert steht daneben als Text; der Balken ist Veranschaulichung. */}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${fortschritt.prozent}%` }} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{fortschritt.satz}</p>
        </div>

        {fortschritt.gruppen.map((gruppe) => (
          <section key={gruppe.id} aria-labelledby={`hofseite-gruppe-${gruppe.id}`}>
            <h3 id={`hofseite-gruppe-${gruppe.id}`} className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {gruppe.titel}
            </h3>
            <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-card">
              {gruppe.zeilen.map((zeile) => (
                <Zeile key={zeile.id} zeile={zeile} offen={offen === zeile.id} onToggle={() => umschalten(zeile.id)}>
                  <AbschnittInhalt
                    id={zeile.id}
                    hof={hof}
                    einstellungen={einstellungen}
                    auftritt={auftritt}
                    darstellung="zeile"
                    onGespeichert={() => gespeichert(zeile.id)}
                    onAbbrechen={() => setOffen(null)}
                    onHochladen={setHochladen}
                  />
                </Zeile>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* Die Vorschau-Spalte: 320 px (ab xl 360 px) fürs Handy; im Web-Modus
          wächst sie auf alles außer ~400 px für die Bearbeitung, mit einer
          kurzen Breiten-Transition — die Liste links rückt zusammen. */}
      <div
        className={cn('w-[320px] shrink-0 transition-[width] duration-200 motion-reduce:transition-none', !webInline && 'xl:w-[360px]')}
        style={webInline ? { width: `calc(100% - ${VORSCHAU_BEARBEITUNG_BREITE}px - 2rem)` } : undefined}
      >
        <HofseiteVorschauRahmen
          slug={hof.slug}
          stand={stand}
          markiert={offen}
          hofName={hof.name}
          adresse={hof.adresse}
          geraet={geraet}
          onGeraet={setGeraet}
          webInlineMoeglich={breit}
        />
      </div>
    </div>
  )
}
