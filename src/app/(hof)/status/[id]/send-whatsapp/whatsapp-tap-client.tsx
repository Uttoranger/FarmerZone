'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { setzeWhatsAppGetippt } from '@/server/actions/status-posts'
import { speichernOhneWurf } from '@/components/mein-hof/abschnitt-speichern'
import { whatsAppLink } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { EmptyState } from '@/components/ui/empty-state'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { BEITRAEGE_HREF } from '@/lib/bauern-navigation'
import { beitragLinkMitKanal } from '@/lib/teilen-fenster'
import {
  WHATSAPP_VERSAND_TEXT as TEXT,
  nachSeitenEreignis,
  versandStand,
  type Abonnentin,
  type Rueckkehr,
} from '@/lib/whatsapp-versand'
import { PRODUKTION_ADRESSE } from '@/lib/umgebung'

interface Props {
  postId: string
  title: string
  body: string
  farmSlug: string
  /** Steht der Beitrag auf der Hofseite? Nur dann führt der Link zu genau diesem Beitrag (Register T5). */
  showOnFarmPage: boolean
  abonnentinnen: Abonnentin[]
  /** Wer laut Datenbank schon geöffnet bekam (Abonnements-IDs). */
  getippt: string[]
}

const APP_URL = typeof window !== 'undefined' ? window.location.origin : PRODUKTION_ADRESSE

/**
 * Register W1: „Tippen" merkt sich die Person; als geöffnet gespeichert wird
 * sie erst, wenn die Seite danach verlassen wurde und wieder da ist
 * (nachSeitenEreignis) — nie per Zeitschaltung. Der Zustand kommt vom Server:
 * Jede Antwort der Action bringt die Liste, wie sie in der Datenbank steht.
 */
export function WhatsAppTapClient({ postId, title, body, farmSlug, showOnFarmPage, abonnentinnen, getippt: anfangs }: Props) {
  const [getippt, setGetippt] = useState<string[]>(anfangs)
  const [fehler, setFehler] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const rueckkehr = useRef<Rueckkehr>(null)
  const laufend = useRef(0)

  const stand = versandStand(abonnentinnen, getippt)

  const speichere = useCallback(
    (id: string, geoeffnet: boolean) => {
      const ohne = (liste: string[]) => liste.filter((x) => x !== id)
      // Sofort zeigen; das letzte Wort hat die Liste aus der Datenbank.
      setGetippt((vorher) => (geoeffnet ? [...ohne(vorher), id] : ohne(vorher)))
      setFehler(null)
      laufend.current += 1
      startTransition(async () => {
        // Ein Wurf (Netz weg) ginge sonst an die Fehlergrenze, und die Liste wäre
        // weg (Nr. 75): speichernOhneWurf fängt und meldet ihn. Seinen Satz
        // nehmen wir nicht — die Liste hat ihren eigenen (WHATSAPP_VERSAND_TEXT).
        const ergebnis: { antwort?: Awaited<ReturnType<typeof setzeWhatsAppGetippt>> } = {}
        await speichernOhneWurf(async () => {
          ergebnis.antwort = await setzeWhatsAppGetippt(postId, id, geoeffnet)
          return {}
        })
        laufend.current -= 1
        const { antwort } = ergebnis
        if (!antwort || 'error' in antwort) {
          // Nicht gespeichert: Die Person steht wieder, wie sie vor dem Tipp stand.
          setGetippt((vorher) => (geoeffnet ? ohne(vorher) : [...ohne(vorher), id]))
          if (antwort) setFehler(antwort.error)
          else toast.error(TEXT.nichtGespeichert)
        } else if (laufend.current === 0) {
          // Erst wenn nichts mehr unterwegs ist — sonst flackerte ein späterer Tipp kurz zurück.
          setGetippt(antwort.getippt)
        }
      })
    },
    [postId]
  )

  useEffect(() => {
    function melde(ereignis: 'verlassen' | 'zurueck') {
      const naechster = nachSeitenEreignis(rueckkehr.current, ereignis)
      rueckkehr.current = naechster.stand
      if (naechster.speichern) speichere(naechster.speichern, true)
    }
    const sichtbarkeit = () => melde(document.visibilityState === 'visible' ? 'zurueck' : 'verlassen')
    const weg = () => melde('verlassen')
    const da = () => melde('zurueck')
    document.addEventListener('visibilitychange', sichtbarkeit)
    window.addEventListener('blur', weg)
    window.addEventListener('focus', da)
    return () => {
      document.removeEventListener('visibilitychange', sichtbarkeit)
      window.removeEventListener('blur', weg)
      window.removeEventListener('focus', da)
    }
  }, [speichere])

  /** Der wa.me-Link für eine Person — null, wenn sich ihre Nummer nicht eindeutig lesen lässt (dann kein Link, Nr. 75 und 85). */
  function buildWaUrl(person: Abonnentin): string | null {
    const firstName = person.name.split(' ')[0]
    // Mit ?k=wa: Besuche aus dieser Nachricht zählen für WhatsApp (Gate 7, T1; ohne Kennung der Person).
    // Dazu genau dieser Beitrag (T5), wenn er auf der Hofseite steht — dieselbe Regel wie in der Mail.
    const farmUrl = beitragLinkMitKanal(`${APP_URL}/${farmSlug}`, { id: postId, showOnFarmPage }, 'wa')
    const message = `Hallo ${firstName}!\n\n*${title}*\n\n${body}\n\nMehr auf: ${farmUrl}`
    return whatsAppLink(person.phone, message)
  }

  if (stand.gesamt === 0) {
    // Die h1 „WhatsApp versenden“ trägt der Werkzeug-Kopf der Seite (G1); hier Beitrag und Leerzustand (G4).
    return (
      <div className="max-w-[670px]">
        <p className="mb-4 text-[15px] font-semibold text-foreground">{title}</p>
        <EmptyState
          titel={TEXT.leer.titel}
          satz={TEXT.leer.satz}
          ausweg={
            <Link href={BEITRAEGE_HREF} className={KNOPF_RAHMEN}>
              {TEXT.leer.aktion}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    // Linksbündig an der Seitenleiste, höchstens 670 px (Liste Lauf 32, whatsapp-plakat „Inhalt mittig“).
    <div className="max-w-[670px]">
      {/* Statt der Karte „DEIN BEITRAG“ mit Balken nur der Titel und der Stand (Board s2-/w2-whatsapp-plakat Bild 1). */}
      <div className="mb-4 flex flex-col gap-1">
        <p className="text-[16px] font-semibold text-foreground">{title}</p>
        {stand.fertig ? (
          <p role="status" className="text-[15px] font-bold text-status-fertig">
            {TEXT.abschluss(stand.gesamt)}
          </p>
        ) : (
          <p className="text-[14px] text-muted-foreground">
            <strong className="font-bold text-foreground">{TEXT.stand(stand.geoeffnet, stand.gesamt)}</strong>
            {' · '}
            <strong className="font-bold text-status-fertig">{TEXT.offen(stand.gesamt - stand.geoeffnet)}</strong>
          </p>
        )}
      </div>

      {fehler && (
        <p role="alert" className="mb-3 text-[14px] font-semibold text-status-offen">
          {fehler}
        </p>
      )}

      {/* Eine Karte mit Linien zwischen den Personen, ohne Telefonnummer (Board). */}
      <ul className={cn('overflow-hidden border border-border bg-card', RUNDUNG.karte)}>
        {stand.personen.map((person, index) => {
          const link = person.geoeffnet ? null : buildWaUrl(person)
          // Board s2/w2-whatsapp-plakat (V51): nur die nächste offene Person trägt den orangen Hauptknopf, die übrigen sind Umrisse.
          const naechste = stand.personen.find((p) => !p.geoeffnet)?.id === person.id
          return (
            <li key={person.id} className={cn('flex items-center gap-3 px-3.5 py-3', index > 0 && 'border-t border-border')}>
              {/* Initialen in jedem Zustand (Board); „Geöffnet“ steht als Wort rechts. */}
              <div
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-bold text-muted-foreground"
              >
                {initialen(person.name)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-foreground" title={person.name}>
                  {person.name}
                </p>
                {person.geoeffnet && (
                  // Ein Link „Doch nicht gesendet?“ statt Frage und Knopf (Board).
                  <button
                    type="button"
                    onClick={() => speichere(person.id, false)}
                    className={cn('-my-2 min-h-11 text-[14px] font-semibold text-foreground underline underline-offset-2', RUNDUNG.feld, FOKUS_RAHMEN)}
                  >
                    {TEXT.zuruecksetzenFrage}
                    <span className="sr-only"> {TEXT.zuruecksetzen}: {person.name}</span>
                  </button>
                )}
              </div>

              {person.geoeffnet ? (
                <span className="shrink-0 self-start text-[14px] font-bold text-status-fertig">
                  <span aria-hidden="true">✓ </span>
                  <span>{TEXT.geoeffnet}</span>
                </span>
              ) : (
                link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      rueckkehr.current = { id: person.id, verlassen: false }
                    }}
                    className={cn(
                      'flex min-h-11 shrink-0 items-center rounded-[14px] px-4 text-[15px] font-bold transition-colors',
                      naechste
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'border-[1.5px] border-foreground bg-card text-foreground hover:bg-muted',
                      FOKUS_RAHMEN
                    )}
                  >
                    Öffnen
                    <span className="sr-only"> – Nachricht an {person.name} in WhatsApp</span>
                  </a>
                )
              )}
            </li>
          )
        })}
      </ul>

      {/* Der Hinweis unter der Liste statt unter der h1 (Liste Lauf 32, whatsapp-plakat). */}
      <p className="mt-4 text-[14px] leading-normal text-muted-foreground">{TEXT.hinweis}</p>
    </div>
  )
}

/** Zwei Buchstaben aus Vor- und Nachname (Board „MH“, „ES“); ein Name allein gibt einen. */
function initialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean)
  const erste = teile[0]?.charAt(0) ?? ''
  const letzte = teile.length > 1 ? (teile[teile.length - 1]?.charAt(0) ?? '') : ''
  return (erste + letzte).toUpperCase()
}
