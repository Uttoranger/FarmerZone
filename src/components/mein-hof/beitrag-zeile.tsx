'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CopyPlus, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { deleteStatusPost, expireStatusPost } from '@/server/actions/status-posts'
import type { BeitragEintrag } from '@/lib/mein-hof-beitraege'
import { StatusBadge } from '@/components/ui/status-badge'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { KNOPF_RAHMEN, TEXT_ORANGE } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'

/*
 * Ein Beitrag im Reiter „Beiträge" (Nachtlauf Nr. 22e): Titel, Marke, wann und
 * wohin er ging, darunter die Handlungen, die früher auf /status standen.
 * Welche angeboten werden, entscheidet beitraegeUebersicht
 * (src/lib/mein-hof-beitraege.ts) — hier nur die Gestalt.
 *
 * Deaktivieren geht ohne Rückfrage (wie bisher: der Beitrag bleibt als
 * „Vergangen" und taugt als Vorlage), Löschen fragt nach (Dialog bzw. Blatt
 * wie die Rückfragen der Bestellungen, zerstörend als Orange-Umriss). Fehler
 * stehen inline orange (Register O1), Erfolg als Toast wie im Bestand.
 */

const KLEIN = 'min-h-11 px-4 text-[13.5px]'

export function BeitragZeile({ eintrag }: { eintrag: BeitragEintrag }): React.JSX.Element {
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const [loeschenOffen, setLoeschenOffen] = useState(false)

  function deaktivieren() {
    setFehler(null)
    starte(async () => {
      try {
        const antwort = await expireStatusPost(eintrag.id)
        if (antwort.error) setFehler('Wir konnten den Beitrag nicht deaktivieren. Bitte versuch es noch einmal.')
        else toast.success('Beitrag deaktiviert')
      } catch {
        setFehler('Wir konnten den Beitrag nicht deaktivieren. Bitte versuch es noch einmal.')
      }
    })
  }

  return (
    <li className={cn('px-3.5 py-3 md:px-[18px]', laeuft && 'opacity-60')} aria-busy={laeuft || undefined}>
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold text-foreground" title={eintrag.titel}>
            {eintrag.titel}
          </p>
          {/* Zwei Zeilen statt abgeschnitten: Seit „N per E-Mail" darin steht (F6, 22e),
              fiele am Handy sonst das Ende („und WhatsApp") weg. */}
          <p className="mt-0.5 line-clamp-2 text-[12.5px] break-words text-muted-foreground">{eintrag.zeile}</p>
        </div>
        <StatusBadge status={eintrag.marke.ton} className="mt-0.5 shrink-0">
          {eintrag.marke.text}
        </StatusBadge>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {eintrag.aktionen.deaktivieren && (
          <button
            type="button"
            onClick={deaktivieren}
            disabled={laeuft}
            aria-label={`${eintrag.titel} deaktivieren`}
            className={cn(KNOPF_RAHMEN, KLEIN)}
          >
            Deaktivieren
          </button>
        )}
        {eintrag.aktionen.vorlage && (
          <Link href={eintrag.aktionen.vorlage} className={cn(KNOPF_RAHMEN, KLEIN)}>
            <CopyPlus className="size-4" strokeWidth={1.7} aria-hidden="true" />
            Als Vorlage verwenden
            <span className="sr-only">: {eintrag.titel}</span>
          </Link>
        )}
        {eintrag.aktionen.whatsapp && (
          <Link href={eintrag.aktionen.whatsapp.href} className={cn(KNOPF_RAHMEN, KLEIN)}>
            <MessageSquare className="size-4" strokeWidth={1.7} aria-hidden="true" />
            {eintrag.aktionen.whatsapp.text}
            <span className="sr-only">: {eintrag.titel}</span>
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            setFehler(null)
            setLoeschenOffen(true)
          }}
          disabled={laeuft}
          aria-label={`${eintrag.titel} löschen`}
          className={cn(TEXT_ORANGE, 'ml-auto', KLEIN)}
        >
          Löschen
        </button>
      </div>

      {fehler && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-status-offen">
          {fehler}
        </p>
      )}

      <LoeschenDialog eintrag={eintrag} offen={loeschenOffen} onOffenChange={setLoeschenOffen} />
    </li>
  )
}

function LoeschenDialog({
  eintrag,
  offen,
  onOffenChange,
}: {
  eintrag: BeitragEintrag
  offen: boolean
  onOffenChange: (offen: boolean) => void
}): React.JSX.Element {
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)

  function loeschen() {
    setFehler(null)
    starte(async () => {
      try {
        const antwort = await deleteStatusPost(eintrag.id)
        if (antwort.error) {
          setFehler('Wir konnten den Beitrag nicht löschen. Bitte versuch es noch einmal.')
          return
        }
        toast.success('Beitrag gelöscht')
        onOffenChange(false)
      } catch {
        setFehler('Wir konnten den Beitrag nicht löschen. Bitte versuch es noch einmal.')
      }
    })
  }

  return (
    <BestellDialog
      offen={offen}
      onOffenChange={onOffenChange}
      titel="Beitrag löschen?"
      hauptaktion={{ text: 'Löschen', onClick: loeschen, ton: 'orange', laeuft }}
    >
      <p className="text-sm break-words text-muted-foreground">
        <span className="font-semibold text-foreground">{eintrag.titel}</span> verschwindet von deiner Hofseite und aus dieser
        Liste. Das lässt sich nicht rückgängig machen.
      </p>
      <DialogFehler text={fehler} />
    </BestellDialog>
  )
}
