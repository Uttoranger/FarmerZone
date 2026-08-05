'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { approveFarmAction, revokeFarmApprovalAction } from '@/server/actions/admin'
import {
  gruendungshofLabel,
  KEIN_GRUENDUNGSPLATZ,
  GRUENDUNGS_KONDITIONEN,
  MAX_GRUENDUNGSHOEFE,
} from '@/lib/gruendungshof'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

type Farm = {
  id: string
  name: string
  slug: string
  ownerEmail: string
  createdAt: Date
  approvedAt: Date | null
  archivedAt: Date | null
  /** Belegter Platz (1-basiert) oder null — serverseitig berechnet. */
  gruendungsplatz: number | null
}

function statusOf(farm: Farm): { label: string; className: string } {
  if (farm.archivedAt) return { label: 'stillgelegt', className: 'bg-muted text-muted-foreground' }
  if (farm.approvedAt === null) return { label: 'wartet', className: 'bg-sky-100 text-sky-900' }
  return { label: 'freigeschaltet', className: 'bg-primary/10 text-primary' }
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function AdminFarmList({
  farms,
  vergebenePlaetze,
}: {
  farms: Farm[]
  vergebenePlaetze: number
}) {
  // Bekäme ein jetzt freigeschalteter Hof noch einen Platz? Die 12 sind eine
  // Konditions-, keine Zugangsgrenze — Freischalten bleibt in jedem Fall
  // möglich, der Dialog sagt nur, was es für die Konditionen bedeutet.
  const plaetzeFrei = vergebenePlaetze < MAX_GRUENDUNGSHOEFE
  const [isPending, startTransition] = useTransition()
  // Der Hof, für den gerade eine Rückfrage offen ist — plus die Richtung.
  const [dialog, setDialog] = useState<{ farm: Farm; action: 'approve' | 'revoke' } | null>(null)

  function run() {
    if (!dialog) return
    const { farm, action } = dialog
    startTransition(async () => {
      const result =
        action === 'approve'
          ? await approveFarmAction(farm.id)
          : await revokeFarmApprovalAction(farm.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(action === 'approve' ? `${farm.name} freigeschaltet` : `Freigabe für ${farm.name} zurückgenommen`)
      }
      setDialog(null)
    })
  }

  if (farms.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch kein Hof registriert.</p>
  }

  return (
    <>
      {/* Am Telefon stapeln die Höfe als Karten, ab sm steht mehr nebeneinander —
          bewusst keine echte Tabelle, die bei 375px seitlich wegläuft. */}
      <ul className="space-y-3">
        {farms.map((farm) => {
          const status = statusOf(farm)
          return (
            <li key={farm.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground break-words">{farm.name}</p>
                  <p className="text-xs text-muted-foreground break-all">/{farm.slug}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                  {status.label}
                </span>
              </div>

              <dl className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="flex gap-1.5 min-w-0">
                  <dt className="shrink-0">Hof-ID:</dt>
                  <dd className="font-mono break-all">{farm.id}</dd>
                </div>
                <div className="flex gap-1.5 min-w-0">
                  <dt className="shrink-0">Inhaber:</dt>
                  <dd className="break-all">{farm.ownerEmail}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="shrink-0">Registriert:</dt>
                  <dd>{formatDate(farm.createdAt)}</dd>
                </div>
                {farm.approvedAt && (
                  <div className="flex gap-1.5">
                    <dt className="shrink-0">Freigeschaltet:</dt>
                    <dd>{formatDate(farm.approvedAt)}</dd>
                  </div>
                )}
                {/* Nur bei freigeschalteten Höfen: ein wartender Hof hat noch
                    keinen Platz, ein stillgelegter belegt keinen mehr. */}
                {farm.approvedAt && !farm.archivedAt && (
                  <div className="flex gap-1.5 min-w-0">
                    <dt className="shrink-0">Gründungsplatz:</dt>
                    <dd
                      className={
                        farm.gruendungsplatz !== null && farm.gruendungsplatz <= MAX_GRUENDUNGSHOEFE
                          ? 'font-medium text-primary'
                          : undefined
                      }
                    >
                      {farm.gruendungsplatz !== null && farm.gruendungsplatz <= MAX_GRUENDUNGSHOEFE
                        ? gruendungshofLabel(farm.gruendungsplatz)
                        : KEIN_GRUENDUNGSPLATZ}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-3">
                {farm.approvedAt === null ? (
                  <Button
                    size="sm"
                    disabled={isPending}
                    onClick={() => setDialog({ farm, action: 'approve' })}
                  >
                    Freischalten
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setDialog({ farm, action: 'revoke' })}
                  >
                    Freigabe zurücknehmen
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialog?.action === 'approve' ? 'Hof freischalten?' : 'Freigabe zurücknehmen?'}
            </DialogTitle>
          </DialogHeader>
          {dialog?.action === 'approve' ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">{dialog.farm.name}</strong> wird sofort
                öffentlich erreichbar und kann Bestellungen entgegennehmen.
              </p>
              {plaetzeFrei ? (
                <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-foreground">
                  Dieser Hof belegt {gruendungshofLabel(vergebenePlaetze + 1)}.
                  <br />
                  {GRUENDUNGS_KONDITIONEN}
                </p>
              ) : (
                <p className="rounded-lg border border-border bg-muted p-3">
                  Alle {MAX_GRUENDUNGSHOEFE} Gründungsplätze sind vergeben — dieser Hof bekommt
                  keinen Gründungsplatz. Freischalten ist trotzdem möglich.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Die Hofseite von <strong className="text-foreground">{dialog?.farm.name}</strong> ist
              danach nicht mehr erreichbar und Bestellungen werden abgelehnt. Es wird nichts
              gelöscht — der Bauer behält Zugang zu allen Daten.
              {dialog !== null &&
                dialog.farm.gruendungsplatz !== null &&
                dialog.farm.gruendungsplatz <= MAX_GRUENDUNGSHOEFE && (
                  <>
                    {' '}
                    Sein Gründungsplatz wird frei, die nachfolgenden Höfe rücken auf.
                  </>
                )}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={isPending}>
              Abbrechen
            </Button>
            <Button
              variant={dialog?.action === 'approve' ? 'default' : 'destructive'}
              onClick={run}
              disabled={isPending}
            >
              {isPending
                ? 'Moment…'
                : dialog?.action === 'approve'
                  ? 'Freischalten'
                  : 'Zurücknehmen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
