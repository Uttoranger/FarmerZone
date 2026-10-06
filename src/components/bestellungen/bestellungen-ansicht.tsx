import Link from 'next/link'
import { ChevronRight, Clock, ReceiptText, TriangleAlert } from 'lucide-react'
import type { BestellEintrag } from '@/lib/bestellungen-finden'
import { BESTELLUNGEN_ANSICHT_SEKUNDEN, BESTELLUNGEN_PFAD } from '@/lib/bestellungen-finden'
import { cn } from '@/lib/utils'
import { beendeBestellAnsicht } from '@/server/actions/bestellungen-finden'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { StatusBadge } from '@/components/ui/status-badge'
import { KARTE, KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/bestaetigung/bestaetigung-teile'
import { BestellungenFindenFormular } from '@/components/bestellungen/bestellungen-finden-formular'

/*
 * Die Bausteine der Seite „Meine Bestellungen" (/bestellungen, Nr. 14). Mockups:
 * web-k4-meine-bestellungen-konto (nur der Bestellungen-Teil), mobil-k4-meine-
 * bestellungen. Nicht gebaut (E8): „Dein Konto", Abholerinnerung, „Neuigkeiten
 * deiner Höfe", „Konto löschen", „Meine Höfe", „Nochmal bestellen" (S11 offen).
 * Was eine Zeile zeigt, entscheidet src/lib/bestellungen-finden.ts — hier nur
 * die Gestalt. Jede Bestellung führt nur über ihren signierten Link weiter.
 */

const MINUTEN = BESTELLUNGEN_ANSICHT_SEKUNDEN / 60

/** Die Spalte: 1200 px wie die Kopfzeile, am Handy 16 px Rand. */
const SEITE = 'mx-auto w-full max-w-[1200px] px-4 pt-6 pb-12 md:px-6 md:pt-7'
const ETIKETT = 'text-[11px] font-semibold tracking-[1.1px] text-muted-foreground uppercase'
const TITEL = 'font-heading text-[26px] leading-tight font-semibold md:text-[30px]'

/** Ohne bewiesene Adresse: Einleitung und das Formular E-Mail → Code. */
export function BestellungenFinden({ abgelaufen }: { abgelaufen: boolean }): React.JSX.Element {
  return (
    <div className={cn(SEITE, 'flex max-w-[480px] flex-col gap-4 md:max-w-[520px] md:pt-10')}>
      <div className="flex flex-col gap-1.5">
        <h1 className={TITEL}>Meine Bestellungen</h1>
        <p className="text-[13.5px] leading-normal text-muted-foreground">
          Hier findest du alle Bestellungen zu deiner E-Mail-Adresse – ohne Konto, nur für diesen Besuch.
        </p>
      </div>
      {abgelaufen && (
        <Hinweiskarte ton="orange" symbol={Clock} titel="Deine Ansicht ist abgelaufen">
          Zu deiner Sicherheit bleibt die Liste nur {MINUTEN} Minuten offen. Lass dir einfach einen neuen Code schicken.
        </Hinweiskarte>
      )}
      <section aria-label="Bestellungen finden" className={KARTE}>
        <BestellungenFindenFormular />
      </section>
      <p className="text-[12.5px] leading-normal text-muted-foreground">
        Jede Bestellung erreichst du auch über den Link in deiner Bestätigungsmail.
      </p>
    </div>
  )
}

/** Die Karte rechts (Web) bzw. unten (Handy): für welche Adresse, wie lange, und Abmelden. */
function AnsichtKarte({ email }: { email: string }): React.JSX.Element {
  return (
    <section aria-labelledby="ansicht-titel" className={cn(KARTE, 'flex flex-col gap-3')}>
      <h2 id="ansicht-titel" className="font-heading text-lg font-semibold">
        Deine Adresse
      </h2>
      <p className="text-[13.5px] font-medium break-words [overflow-wrap:anywhere]">{email}</p>
      <p className="text-[12.5px] leading-normal text-muted-foreground">
        Bestätigt mit dem Code aus deiner E-Mail. Die Liste bleibt {MINUTEN} Minuten auf diesem Gerät offen – ein Konto
        legen wir dafür nicht an.
      </p>
      <form action={beendeBestellAnsicht}>
        <button type="submit" className={KNOPF_RAHMEN}>
          Abmelden
        </button>
      </form>
    </section>
  )
}

function LaufendeKarte({ eintrag }: { eintrag: BestellEintrag }): React.JSX.Element {
  return (
    <li className={cn(KARTE, 'flex flex-col gap-3', eintrag.ton === 'fertig' && 'border-accent')}>
      <div className="flex min-w-0 items-center gap-2.5">
        <StatusBadge status={eintrag.ton}>{eintrag.marke}</StatusBadge>
        <span className="min-w-0 truncate text-[13px] text-muted-foreground" title={`${eintrag.bestellnummer} · ${eintrag.hofName}`}>
          {eintrag.bestellnummer} · {eintrag.hofName}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[16px] font-semibold md:text-[17px]">{eintrag.wann}</p>
        <p className="text-[12.5px] leading-normal text-muted-foreground md:text-[13px]">
          {eintrag.artikel} · {eintrag.betrag} · {eintrag.zahlung}
        </p>
      </div>
      <div>
        <Link href={eintrag.link} className={KNOPF_RAHMEN}>
          Bestellung ansehen
          <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
          <span className="sr-only">
            {' '}
            bei {eintrag.hofName}, {eintrag.wann}
          </span>
        </Link>
      </div>
    </li>
  )
}

/** Mit bewiesener Adresse: laufende oben, frühere darunter — oder der Leerzustand. */
export function BestellungenListe({
  email,
  laufend,
  frueher,
}: {
  email: string
  laufend: readonly BestellEintrag[]
  frueher: readonly BestellEintrag[]
}): React.JSX.Element {
  const leer = laufend.length === 0 && frueher.length === 0
  return (
    <div className={cn(SEITE, 'flex flex-col gap-7 lg:flex-row lg:items-start')}>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <h1 className={TITEL}>Meine Bestellungen</h1>

        {leer && (
          <EmptyState
            symbol={ReceiptText}
            titel="Keine Bestellungen gefunden"
            satz="Unter dieser Adresse haben wir keine Bestellung gefunden. Vielleicht hast du mit einer anderen E-Mail-Adresse bestellt?"
            aktion={
              <>
                <Link href="/hoefe" className={KNOPF_GRUEN}>
                  Höfe entdecken
                </Link>
                <form action={beendeBestellAnsicht}>
                  <button type="submit" className={KNOPF_RAHMEN}>
                    Andere E-Mail-Adresse
                  </button>
                </form>
              </>
            }
          />
        )}

        {laufend.length > 0 && (
          <section aria-labelledby="aktuell-titel" className="flex flex-col gap-3">
            <h2 id="aktuell-titel" className={ETIKETT}>
              Aktuell
            </h2>
            <ul className="flex flex-col gap-3">
              {laufend.map((eintrag) => (
                <LaufendeKarte key={eintrag.id} eintrag={eintrag} />
              ))}
            </ul>
          </section>
        )}

        {frueher.length > 0 && (
          <section aria-labelledby="frueher-titel" className="flex flex-col gap-3">
            <h2 id="frueher-titel" className={ETIKETT}>
              Früher
            </h2>
            <ListGruppe>
              {frueher.map((eintrag) => (
                <ListRow
                  key={eintrag.id}
                  href={eintrag.link}
                  titel={eintrag.hofName}
                  untertitel={`${eintrag.marke} · ${eintrag.wann} · ${eintrag.bestellnummer}`}
                  ende={<span className="shrink-0 text-[14px] font-semibold">{eintrag.betrag}</span>}
                />
              ))}
            </ListGruppe>
          </section>
        )}
      </div>

      <div className="w-full shrink-0 lg:mt-[58px] lg:w-[360px]">
        <AnsichtKarte email={email} />
      </div>
    </div>
  )
}

/** Die Liste ließ sich nicht laden — inline, mit Ausweg (DESIGN_SYSTEM, „Zustände"). */
export function BestellungenFehler(): React.JSX.Element {
  return (
    <div className={cn(SEITE, 'flex max-w-[640px] flex-col gap-4')}>
      <h1 className={TITEL}>Meine Bestellungen</h1>
      <Hinweiskarte
        ton="orange"
        symbol={TriangleAlert}
        titel="Wir konnten deine Bestellungen gerade nicht laden"
        aktion={
          <Link href={BESTELLUNGEN_PFAD} className={KNOPF_RAHMEN}>
            Noch einmal versuchen
          </Link>
        }
      >
        Probier es in einem Moment noch einmal. Jede Bestellung erreichst du auch über den Link in deiner Bestätigungsmail.
      </Hinweiskarte>
    </div>
  )
}
