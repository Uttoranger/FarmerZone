'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronRight, CopyPlus, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { deleteStatusPost, expireStatusPost } from '@/server/actions/status-posts'
import type { BeitragEintrag } from '@/lib/mein-hof-beitraege'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { MEIN_HOF_ZEILE_TITEL, MEIN_HOF_ZEILE_WERT } from '@/components/mein-hof/zeilen-stil'
import { BestellDialog, DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { BeitragTeilenKnopf } from '@/components/teilen/beitrag-teilen'
import { KNOPF_RAHMEN, TEXT_ORANGE } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'

/*
 * Ein Beitrag im Reiter „Beiträge" (Nachtlauf Nr. 22e): Titel, Marke, wann und
 * wohin er ging, darunter die Handlungen, die früher auf /status standen —
 * seit Nr. 67 zuerst „Teilen" (Teilen-Fenster im Beitrag-Modus, T5) in der
 * Reihenfolge des Mockups mobil-h4-beitraege-teilen-je-beitrag.
 * Welche angeboten werden, entscheidet beitraegeUebersicht
 * (src/lib/mein-hof-beitraege.ts) — hier nur die Gestalt.
 *
 * Deaktivieren geht ohne Rückfrage (wie bisher: der Beitrag bleibt als
 * „Vergangen" und taugt als Vorlage), Löschen fragt nach (Dialog bzw. Blatt
 * wie die Rückfragen der Bestellungen, zerstörend als Orange-Umriss). Fehler
 * stehen inline orange (Register O1), Erfolg als Toast wie im Bestand.
 *
 * Seit Nr. 274 (Board s1-/w1-mein-hof Bild 5) ist der Beitrag eine Zeile mit „›“:
 * Titel, Zeile, Marke darunter. Ein Tipp klappt die Handlungen in der Zeile auf.
 */

const KLEIN = 'min-h-11 px-4 text-[13.5px]'

export function BeitragZeile({ eintrag }: { eintrag: BeitragEintrag }): React.JSX.Element {
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  const [loeschenOffen, setLoeschenOffen] = useState(false)
  const [auf, setAuf] = useState(false)
  const handlungenId = `beitrag-handlungen-${eintrag.id}`

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
    <li className={cn('border-t border-border first:border-t-0', laeuft && 'opacity-60')} aria-busy={laeuft || undefined}>
      <button
        type="button"
        onClick={() => setAuf((a) => !a)}
        aria-expanded={auf}
        aria-controls={handlungenId}
        title={eintrag.titel}
        className={cn('flex min-h-14 w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-muted/60', FOKUS_RAHMEN_INNEN)}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('truncate', MEIN_HOF_ZEILE_TITEL)}>{eintrag.titel}</span>
          {/* Zwei Zeilen statt abgeschnitten: Seit „N per E-Mail" darin steht (F6, 22e),
              fiele am Handy sonst das Ende („und WhatsApp") weg. */}
          <span className={cn('line-clamp-2 break-words', MEIN_HOF_ZEILE_WERT)}>{eintrag.zeile}</span>
          <StatusBadge status={eintrag.marke.ton} className="self-start">
            {eintrag.marke.text}
          </StatusBadge>
        </span>
        <ChevronRight className={cn('size-[18px] shrink-0 text-muted-foreground transition-transform', auf && 'rotate-90')} strokeWidth={2} aria-hidden="true" />
      </button>

      <div id={handlungenId} hidden={!auf} className="px-3 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          {eintrag.aktionen.teilen && (
            <BeitragTeilenKnopf beitragId={eintrag.id} titel={eintrag.titel} onFehler={setFehler} className={cn(KNOPF_RAHMEN, KLEIN)} />
          )}
          {eintrag.aktionen.whatsapp && (
            <Link href={eintrag.aktionen.whatsapp.href} className={cn(KNOPF_RAHMEN, KLEIN)}>
              <MessageSquare className="size-4" strokeWidth={1.7} aria-hidden="true" />
              {eintrag.aktionen.whatsapp.text}
              <span className="sr-only">: {eintrag.titel}</span>
            </Link>
          )}
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
      </div>

      {fehler && (
        <p role="alert" className="px-3 pb-3 text-[13px] font-medium text-status-offen">
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
