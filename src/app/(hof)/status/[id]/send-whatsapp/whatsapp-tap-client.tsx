'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { Check, MessageSquare } from 'lucide-react'
import { setzeWhatsAppGetippt } from '@/server/actions/status-posts'
import { toWaPhone } from '@/lib/whatsapp'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { teilenLink } from '@/lib/teilen-kanal'
import {
  WHATSAPP_VERSAND_TEXT as TEXT,
  nachSeitenEreignis,
  versandStand,
  type Abonnentin,
  type Rueckkehr,
} from '@/lib/whatsapp-versand'

interface Props {
  postId: string
  title: string
  body: string
  farmSlug: string
  abonnentinnen: Abonnentin[]
  /** Wer laut Datenbank schon geöffnet bekam (Abonnements-IDs). */
  getippt: string[]
}

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://farmerzone.at'

/**
 * Register W1: „Tippen" merkt sich die Person; als geöffnet gespeichert wird
 * sie erst, wenn die Seite danach verlassen wurde und wieder da ist
 * (nachSeitenEreignis) — nie per Zeitschaltung. Der Zustand kommt vom Server:
 * Jede Antwort der Action bringt die Liste, wie sie in der Datenbank steht.
 */
export function WhatsAppTapClient({ postId, title, body, farmSlug, abonnentinnen, getippt: anfangs }: Props) {
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
        const antwort = await setzeWhatsAppGetippt(postId, id, geoeffnet)
        laufend.current -= 1
        if ('error' in antwort) {
          setGetippt((vorher) => (geoeffnet ? ohne(vorher) : [...ohne(vorher), id]))
          setFehler(antwort.error)
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

  function buildWaUrl(person: Abonnentin): string {
    const phone = toWaPhone(person.phone)
    const firstName = person.name.split(' ')[0]
    // Mit ?k=wa: Besuche aus dieser Nachricht zählen für WhatsApp (Gate 7, T1; ohne Kennung der Person).
    const farmUrl = teilenLink(APP_URL, farmSlug, 'wa')
    const message = `Hallo ${firstName}!\n\n*${title}*\n\n${body}\n\nMehr auf: ${farmUrl}`
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
  }

  if (stand.gesamt === 0) {
    return (
      <div className="text-center py-16">
        {/* h1 auch in den Randzuständen — sonst hätte die Seite keine Überschrift. */}
        <h1 className="font-medium text-foreground mb-1">Keine WhatsApp-Abonnenten</h1>
        <p className="text-sm text-muted-foreground">Es gibt noch keine Kunden mit WhatsApp-Opt-in.</p>
      </div>
    )
  }

  return (
    <div>
      {stand.fertig ? (
        // Abschluss nur mit dem ehrlichen Satz; die Liste bleibt darunter, damit sich jede Person zurücksetzen lässt.
        <div className="text-center pt-6 pb-8">
          <div className="size-16 rounded-full bg-accent/18 flex items-center justify-center mx-auto mb-4">
            <Check className="size-8 text-status-fertig" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-xl font-semibold text-foreground">{TEXT.abschluss(stand.gesamt)}</h1>
        </div>
      ) : (
        <>
          <div className="mb-5">
            <h1 className="font-heading text-2xl font-semibold text-foreground">WhatsApp versenden</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{TEXT.hinweis}</p>
          </div>

          {/* Preview */}
          <div className="bg-muted rounded-xl p-4 mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Dein Status</p>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{body}</p>
          </div>

          {/* Progress */}
          <div className="mb-5">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-medium text-foreground">{TEXT.stand(stand.geoeffnet, stand.gesamt)}</span>
              <span className="text-muted-foreground">{TEXT.offen(stand.gesamt - stand.geoeffnet)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${(stand.geoeffnet / stand.gesamt) * 100}%` }}
              />
            </div>
          </div>
        </>
      )}

      {fehler && (
        <p role="alert" className="mb-3 text-[13px] font-medium text-status-offen">
          {fehler}
        </p>
      )}

      {/* Subscriber list */}
      <ul className="flex flex-col gap-2">
        {stand.personen.map((person) => (
          <li
            key={person.id}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border border-border transition-colors',
              person.geoeffnet ? 'bg-muted/40' : 'bg-card'
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                'size-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                person.geoeffnet ? 'bg-accent/18 text-status-fertig' : 'bg-muted text-muted-foreground'
              )}
            >
              {person.geoeffnet ? <Check className="size-4" aria-hidden="true" /> : person.name.charAt(0).toUpperCase()}
            </div>

            {/* Name + phone */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate" title={person.name}>
                {person.name}
              </p>
              <p className="text-xs text-muted-foreground">{person.phone}</p>
              {person.geoeffnet && (
                <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                  {TEXT.zuruecksetzenFrage}
                  <button
                    type="button"
                    onClick={() => speichere(person.id, false)}
                    className={cn(
                      'min-h-11 -my-2 px-1 font-semibold text-foreground underline underline-offset-2 rounded-md',
                      FOKUS_RAHMEN
                    )}
                  >
                    {TEXT.zuruecksetzen}
                    <span className="sr-only">: {person.name}</span>
                  </button>
                </p>
              )}
            </div>

            {/* Action */}
            {person.geoeffnet ? (
              <span className="text-xs text-status-fertig font-medium shrink-0">{TEXT.geoeffnet}</span>
            ) : (
              <a
                href={buildWaUrl(person)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  rueckkehr.current = { id: person.id, verlassen: false }
                }}
                className={cn(
                  'flex items-center gap-1.5 min-h-11 px-4 rounded-full bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors shrink-0',
                  FOKUS_RAHMEN
                )}
              >
                <MessageSquare className="size-3.5" aria-hidden="true" />
                Tippen
                <span className="sr-only">: Nachricht an {person.name} in WhatsApp öffnen</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
