'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DezimalFeld } from '@/components/shared/dezimal-feld'
import {
  KOSTEN_KATEGORIEN,
  KOSTEN_KATEGORIE_LABEL,
  KOSTEN_RHYTHMEN,
  KOSTEN_RHYTHMUS_KURZ,
  type KostenKategorieWert,
  type KostenRhythmusWert,
} from '@/lib/finanzen'
import { centsAlsEuro, type Monatsschluessel } from '@/lib/servicegebuehr'
import {
  kostenpostenAendern,
  kostenpostenAnlegen,
  kostenpostenBeenden,
  kostenpostenLoeschen,
} from '@/server/actions/finanzen'
import type { KostenpostenZeile } from '@/server/queries/finanzen'
import { cn } from '@/lib/utils'
import { MonatWahl } from './monat-wahl'

/**
 * Ein Kostenposten anlegen oder ändern — und beim Ändern auch beenden oder
 * löschen. EIN Sheet für alles, was mit einem Posten zu tun ist: Bei 375 px ist
 * jede weitere Ebene ein Grund, sich zu verlaufen.
 *
 * BEENDEN steht vor LÖSCHEN und ist die ruhige Handlung: Es setzt den letzten
 * Monat und lässt die Vergangenheit richtig. Löschen fragt nach und sagt dazu,
 * was es anrichtet — vergangene Monate sehen danach besser aus, als sie waren.
 *
 * Der Entwurf lebt in `useState`, nicht in react-hook-form: fünf Felder, keine
 * Querprüfung, und derselbe Aufbau wie die Triage-Maske des Admin-Bereichs.
 */

type Entwurf = {
  name: string
  kategorie: KostenKategorieWert
  betrag: number | null
  rhythmus: KostenRhythmusWert
  ab: Monatsschluessel
  notiz: string
}

export type SheetZustand =
  | { art: 'neu' }
  | { art: 'bearbeiten'; posten: KostenpostenZeile }
  | null

export function KostenSheet({
  zustand,
  onClose,
  /** Der angezeigte Monat — Vorgabe für „ab" und für „beenden". */
  monat,
}: {
  zustand: SheetZustand
  onClose: () => void
  monat: Monatsschluessel
}) {
  return (
    <Sheet open={zustand !== null} onOpenChange={(offen) => !offen && onClose()}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:mx-auto sm:max-w-lg sm:rounded-t-2xl"
      >
        {/* Bei jedem Öffnen neu aufgebaut: So startet der Entwurf immer beim
            gespeicherten Stand, ohne Effekt zum Zurücksetzen. */}
        {zustand !== null && (
          <SheetInhalt zustand={zustand} onClose={onClose} monat={monat} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function SheetInhalt({
  zustand,
  onClose,
  monat,
}: {
  zustand: NonNullable<SheetZustand>
  onClose: () => void
  monat: Monatsschluessel
}) {
  const router = useRouter()
  const [laeuft, startTransition] = useTransition()
  const vorhanden = zustand.art === 'bearbeiten' ? zustand.posten : null

  const [entwurf, setEntwurf] = useState<Entwurf>({
    name: vorhanden?.name ?? '',
    kategorie: vorhanden?.kategorie ?? 'HOSTING',
    betrag: vorhanden ? centsAlsEuro(vorhanden.betragCents) : null,
    rhythmus: vorhanden?.rhythmus ?? 'MONATLICH',
    ab: vorhanden?.ab ?? monat,
    notiz: vorhanden?.notiz ?? '',
  })
  const [endeMonat, setEndeMonat] = useState<Monatsschluessel>(vorhanden?.bis ?? monat)
  const [loeschenGefragt, setLoeschenGefragt] = useState(false)

  function setze<K extends keyof Entwurf>(feld: K, wert: Entwurf[K]) {
    setEntwurf((e) => ({ ...e, [feld]: wert }))
  }

  /** Jeder Aufruf endet gleich: Fehler als Toast, Erfolg schließt und lädt neu. */
  function fuehreAus(
    aufruf: () => Promise<{ ok: true } | { error: string }>,
    erfolg: string
  ) {
    startTransition(async () => {
      const ergebnis = await aufruf()
      if ('error' in ergebnis) {
        toast.error(ergebnis.error)
        return
      }
      toast.success(erfolg)
      onClose()
      router.refresh()
    })
  }

  function speichern(e: React.FormEvent) {
    e.preventDefault()
    const eingabe = {
      name: entwurf.name,
      kategorie: entwurf.kategorie,
      betrag: entwurf.betrag,
      rhythmus: entwurf.rhythmus,
      ab: entwurf.ab,
      notiz: entwurf.notiz,
    }
    if (vorhanden) {
      fuehreAus(() => kostenpostenAendern({ ...eingabe, id: vorhanden.id }), 'Posten geändert.')
    } else {
      fuehreAus(() => kostenpostenAnlegen(eingabe), 'Posten eingetragen.')
    }
  }

  const beschriftung = 'mb-1 block text-xs font-medium text-muted-foreground'

  return (
    <form onSubmit={speichern}>
      <SheetHeader className="border-b border-border">
        <SheetTitle>{vorhanden ? 'Posten bearbeiten' : 'Kosten eintragen'}</SheetTitle>
      </SheetHeader>

      <div className="space-y-4 p-4">
        <div>
          <label htmlFor="kosten-name" className={beschriftung}>
            Name
          </label>
          <Input
            id="kosten-name"
            value={entwurf.name}
            onChange={(e) => setze('name', e.target.value)}
            placeholder="z. B. Hosting"
            maxLength={60}
            autoComplete="off"
            className="min-h-11"
          />
        </div>

        <div>
          <span className={beschriftung}>Kategorie</span>
          <div className="flex flex-wrap gap-2">
            {KOSTEN_KATEGORIEN.map((k) => (
              <Chip
                key={k}
                aktiv={entwurf.kategorie === k}
                onClick={() => setze('kategorie', k)}
                label={KOSTEN_KATEGORIE_LABEL[k]}
              />
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="kosten-betrag" className={beschriftung}>
            Betrag
          </label>
          <DezimalFeld
            id="kosten-betrag"
            value={entwurf.betrag}
            onChange={(wert) => setze('betrag', wert)}
            praefix="€"
            stellen={2}
            // min-h-11: Das Eingabefeld des Hauses ist 36 px hoch — für eine
            // Maske, die am Handy bedient wird, zu wenig Tippfläche.
            className="min-h-11"
          />
        </div>

        <div>
          <span className={beschriftung}>Rhythmus</span>
          <div className="flex flex-wrap gap-2">
            {KOSTEN_RHYTHMEN.map((r) => (
              <Chip
                key={r}
                aktiv={entwurf.rhythmus === r}
                onClick={() => setze('rhythmus', r)}
                label={KOSTEN_RHYTHMUS_KURZ[r]}
              />
            ))}
          </div>
          {entwurf.rhythmus === 'JAEHRLICH' && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Der Jahresbetrag wird auf zwölf Monate verteilt — auf den Cent genau.
            </p>
          )}
        </div>

        <div>
          <span className={beschriftung}>
            {entwurf.rhythmus === 'EINMALIG' ? 'Monat' : 'Ab Monat'}
          </span>
          <MonatWahl
            wert={entwurf.ab}
            onChange={(m) => setze('ab', m)}
            bezug={monat}
            idPraefix="kosten-ab"
          />
        </div>

        <div>
          <label htmlFor="kosten-notiz" className={beschriftung}>
            Notiz (freiwillig)
          </label>
          <Input
            id="kosten-notiz"
            value={entwurf.notiz}
            onChange={(e) => setze('notiz', e.target.value)}
            maxLength={200}
            autoComplete="off"
            className="min-h-11"
          />
        </div>

        <Button type="submit" disabled={laeuft} className="min-h-11 w-full">
          {vorhanden ? 'Änderungen speichern' : 'Posten eintragen'}
        </Button>
      </div>

      {vorhanden && (
        <div className="space-y-4 border-t border-border p-4">
          <div>
            <span className={beschriftung}>Posten beenden — letzter Monat</span>
            <MonatWahl
              wert={endeMonat}
              onChange={setEndeMonat}
              bezug={monat}
              idPraefix="kosten-bis"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Der Posten zählt in diesem Monat noch, danach nicht mehr. Die Monate davor bleiben,
              wie sie waren.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={laeuft}
              onClick={() =>
                fuehreAus(
                  () => kostenpostenBeenden({ id: vorhanden.id, monat: endeMonat }),
                  'Posten beendet.'
                )
              }
              className="mt-2 min-h-11 w-full"
            >
              Posten beenden
            </Button>
          </div>

          {/* Löschen fragt nach — und sagt, was es anrichtet. */}
          {loeschenGefragt ? (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-xs leading-relaxed text-foreground">
                Löschen entfernt den Posten aus <strong>allen</strong> Monaten, auch aus denen, in
                denen er tatsächlich Geld gekostet hat — vergangene Monate sehen danach besser aus,
                als sie waren. Willst du ihn nur nicht mehr zahlen, dann beende ihn.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={laeuft}
                  onClick={() =>
                    fuehreAus(() => kostenpostenLoeschen({ id: vorhanden.id }), 'Posten gelöscht.')
                  }
                  className="min-h-11 flex-1"
                >
                  Wirklich löschen
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setLoeschenGefragt(false)}
                  className="min-h-11 flex-1"
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLoeschenGefragt(true)}
              className="min-h-11 w-full text-destructive hover:text-destructive"
            >
              Posten löschen
            </Button>
          )}
        </div>
      )}
    </form>
  )
}

function Chip({
  aktiv,
  onClick,
  label,
}: {
  aktiv: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-pressed={aktiv}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-full border px-3 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        aktiv
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted/50'
      )}
    >
      {label}
    </button>
  )
}
