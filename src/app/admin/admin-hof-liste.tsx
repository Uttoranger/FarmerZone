'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { freischaltenAction, freigabeZuruecknehmenAction } from '@/server/actions/admin'
import { gruendungshofLabel, KEIN_GRUENDUNGSPLATZ, GRUENDUNGS_KONDITIONEN } from '@/lib/gruendungshof'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export type AdminHofZeileDaten = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  createdAt: string
  approvedAt: string | null
  archivedAt: string | null
  gruendungsplatz: number | null
}

type Props = {
  hoefe: AdminHofZeileDaten[]
  vergebenePlaetze: number
  maxPlaetze: number
}

type Vorhaben = { hof: AdminHofZeileDaten; art: 'freischalten' | 'zuruecknehmen' }

function datum(iso: string): string {
  return new Date(iso).toLocaleDateString('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function statusText(hof: AdminHofZeileDaten): { text: string; klasse: string } {
  if (hof.archivedAt) return { text: 'stillgelegt', klasse: 'bg-[#F0EDE5] text-[#9AA08F]' }
  if (!hof.approvedAt) return { text: 'wartet', klasse: 'bg-[#FBEEE3] text-[#E8854A]' }
  return { text: 'freigeschaltet', klasse: 'bg-[#E8F0E2] text-[#2D5F3F]' }
}

export function AdminHofListe({ hoefe, vergebenePlaetze, maxPlaetze }: Props) {
  const [vorhaben, setVorhaben] = useState<Vorhaben | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const router = useRouter()

  // Bekäme der Hof bei sofortiger Freischaltung noch einen Gründungsplatz?
  const plaetzeFrei = vergebenePlaetze < maxPlaetze

  async function ausfuehren() {
    if (!vorhaben) return
    setIsBusy(true)
    const result =
      vorhaben.art === 'freischalten'
        ? await freischaltenAction(vorhaben.hof.id)
        : await freigabeZuruecknehmenAction(vorhaben.hof.id)
    setIsBusy(false)

    if (result.error) {
      toast.error(result.error)
      return
    }
    setVorhaben(null)
    toast.success(
      vorhaben.art === 'freischalten' ? 'Hof freigeschaltet' : 'Freigabe zurückgenommen'
    )
    router.refresh()
  }

  return (
    <>
      {/* Karten-Stapel statt breiter Tabelle: am Telefon ist eine Tabelle mit
          sieben Spalten nicht bedienbar. */}
      <ul className="mt-6 space-y-3">
        {hoefe.map((hof) => {
          const status = statusText(hof)
          return (
            <li key={hof.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{hof.name}</p>
                  <p className="text-sm text-muted-foreground break-all">/{hof.slug}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.klasse}`}>
                  {status.text}
                </span>
              </div>

              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Hof-ID:</dt>
                  <dd className="font-mono text-xs break-all text-foreground">{hof.id}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Inhaber:</dt>
                  <dd className="break-all text-foreground">{hof.ownerEmail}</dd>
                </div>
                <div className="flex flex-wrap gap-x-2">
                  <dt className="text-muted-foreground">Registriert:</dt>
                  <dd className="text-foreground">{datum(hof.createdAt)}</dd>
                </div>
                {hof.approvedAt && (
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-muted-foreground">Gründungsplatz:</dt>
                    <dd className="text-foreground">
                      {hof.gruendungsplatz !== null && hof.gruendungsplatz <= maxPlaetze
                        ? gruendungshofLabel(hof.gruendungsplatz)
                        : KEIN_GRUENDUNGSPLATZ}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-4">
                {hof.approvedAt ? (
                  <Button
                    variant="ghost"
                    className="w-full sm:w-auto"
                    onClick={() => setVorhaben({ hof, art: 'zuruecknehmen' })}
                  >
                    Freigabe zurücknehmen
                  </Button>
                ) : (
                  <Button
                    className="w-full sm:w-auto"
                    onClick={() => setVorhaben({ hof, art: 'freischalten' })}
                  >
                    Freischalten
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <Dialog open={vorhaben !== null} onOpenChange={(o) => !o && setVorhaben(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {vorhaben?.art === 'freischalten' ? 'Hof freischalten?' : 'Freigabe zurücknehmen?'}
            </DialogTitle>
          </DialogHeader>

          {vorhaben?.art === 'freischalten' ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">{vorhaben.hof.name}</strong> wird öffentlich
                sichtbar und kann ab sofort Bestellungen entgegennehmen.
              </p>
              {/* Die 12 sind eine Konditions-Grenze, keine Zugangsgrenze:
                  Freischalten bleibt in jedem Fall möglich. */}
              {plaetzeFrei ? (
                <p className="rounded-lg border border-[#D6E0CE] bg-[#E8F0E2] p-3 text-[#2D5F3F]">
                  Dieser Hof belegt {gruendungshofLabel(vergebenePlaetze + 1)}.
                  <br />
                  {GRUENDUNGS_KONDITIONEN}
                </p>
              ) : (
                <p className="rounded-lg border border-border bg-muted p-3">
                  Alle {maxPlaetze} Gründungsplätze sind bereits vergeben — dieser Hof bekommt
                  keinen Gründungsplatz. Freischalten ist trotzdem möglich.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{vorhaben?.hof.name}</strong> ist danach
              öffentlich nicht mehr erreichbar und nimmt keine Bestellungen mehr an. Es wird nichts
              gelöscht — der Bauer behält Zugriff auf alle seine Daten und kann seinen Hof weiter
              einrichten.
            </p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setVorhaben(null)} disabled={isBusy}>
              Abbrechen
            </Button>
            <Button
              variant={vorhaben?.art === 'freischalten' ? 'default' : 'destructive'}
              onClick={ausfuehren}
              disabled={isBusy}
            >
              {isBusy
                ? 'Moment…'
                : vorhaben?.art === 'freischalten'
                  ? 'Freischalten'
                  : 'Zurücknehmen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
