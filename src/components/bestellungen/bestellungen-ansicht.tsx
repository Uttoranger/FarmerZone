import Link from 'next/link'
import type { BestellEintrag } from '@/lib/bestellungen-finden'
import { BESTELLUNGEN_PFAD } from '@/lib/bestellungen-finden'
import { cn } from '@/lib/utils'
import { beendeBestellAnsicht } from '@/server/actions/bestellungen-finden'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { ETIKETT, KARTE, KNOPF_BREIT_GRUEN, KNOPF_BREIT_RAHMEN } from '@/components/bestaetigung/bestaetigung-stil'
import { BestellungenFindenBlock } from '@/components/bestellungen/bestellungen-finden-formular'

/*
 * Die Bausteine der Seite „Meine Bestellungen" (/bestellungen, Nr. 14). Mockups:
 * web-k4-meine-bestellungen-konto (nur der Bestellungen-Teil), mobil-k4-meine-
 * bestellungen. Nicht gebaut (E8): „Dein Konto", Abholerinnerung, „Neuigkeiten
 * deiner Höfe", „Konto löschen", „Meine Höfe", „Nochmal bestellen" (S11 offen).
 * Was eine Zeile zeigt, entscheidet src/lib/bestellungen-finden.ts — hier nur
 * die Gestalt. Jede Bestellung führt nur über ihren signierten Link weiter.
 */

/** Die Spalte: 520 px wie im Board w1-meine-bestellungen (eine Spalte, auch im Browser), am Handy 16 px Rand. */
const SEITE = 'mx-auto flex w-full max-w-[552px] flex-col gap-4 px-4 pt-6 pb-12 md:pt-8'
const TITEL = 'font-heading text-[26px] leading-tight font-semibold md:text-[28px]'
/** Knopf mit Rand in Inhaltsbreite (Board s1-/w1-meine-bestellungen: 44 px, Radius 12 px, Feldrand). */
const KNOPF_KLEIN_RAHMEN = cn(
  'inline-flex min-h-11 shrink-0 items-center justify-center rounded-[12px] border border-input bg-card px-3.5 text-[14px] font-bold text-foreground hover:bg-muted',
  FOKUS_RAHMEN
)

/** Ohne bewiesene Adresse: Einleitung und das Formular E-Mail → Code; abgelaufen die orange Karte darüber (Board Bild 6). */
export function BestellungenFinden({ abgelaufen }: { abgelaufen: boolean }): React.JSX.Element {
  return (
    <div className={SEITE}>
      <h1 className={TITEL}>Meine Bestellungen</h1>
      {abgelaufen && (
        // Farben aus dem Paar „tun“ (≥ 4,5:1 in beiden Themes), wie die Hinweiskarte für Fehler — hier ein Zustand, kein Fehler.
        <section
          aria-labelledby="abgelaufen-titel"
          className="flex flex-col gap-1 rounded-[16px] border border-zustand-tun/30 bg-zustand-tun-grund px-3.5 py-3 text-zustand-tun"
        >
          <h2 id="abgelaufen-titel" className="text-[15px] font-bold">
            Deine Ansicht ist abgelaufen
          </h2>
          <p className="text-[14px] leading-normal">Sie gilt nur für einen Besuch. Hol dir einfach einen neuen Code.</p>
        </section>
      )}
      {/* Einleitung, Karte und Hinweis: Die Sätze stehen nur im ersten Schritt — den Schritt kennt nur der Browser. */}
      <BestellungenFindenBlock ohneSaetze={abgelaufen} />
    </div>
  )
}

/**
 * Für welche Adresse die Liste gilt, und „Ansicht beenden“ (V26, Board s1-/w1-meine-bestellungen): eine
 * flache Karte oben, im Browser in einer Zeile, am Handy die Adresse unter dem Wort. Die Ansicht gilt
 * `BESTELLUNGEN_ANSICHT_SEKUNDEN` lang auf diesem Gerät (Cookie) — der Knopf beendet sie sofort.
 */
function AnsichtKarte({ email }: { email: string }): React.JSX.Element {
  return (
    <section aria-label="Deine Adresse" className={cn(KARTE, 'flex items-center gap-3 py-2.5')}>
      <p className="min-w-0 flex-1 text-[14px] leading-snug">
        Deine Adresse:
        <span className="max-md:block md:ml-1 font-bold break-words [overflow-wrap:anywhere]">{email}</span>
      </p>
      <form action={beendeBestellAnsicht}>
        <button type="submit" className={KNOPF_KLEIN_RAHMEN}>
          Ansicht beenden
        </button>
      </form>
    </section>
  )
}

function LaufendeKarte({ eintrag }: { eintrag: BestellEintrag }): React.JSX.Element {
  const zeile = `${eintrag.marke} · ${eintrag.wann} · ${eintrag.bestellnummer}`
  return (
    <li className={cn(KARTE, 'flex items-center gap-3 py-3')}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold" title={eintrag.hofName}>
          {eintrag.hofName}
        </p>
        <p className="text-[13px] leading-snug break-words text-muted-foreground" title={zeile}>
          {zeile}
        </p>
      </div>
      <Link href={eintrag.link} className={KNOPF_KLEIN_RAHMEN}>
        Bestellung ansehen
        <span className="sr-only">
          {' '}
          bei {eintrag.hofName}, {eintrag.wann}
        </span>
      </Link>
    </li>
  )
}

/** Mit bewiesener Adresse: laufende oben („Aktuell“), frühere darunter („Früher“) — oder der Leerzustand. */
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
    <div className={SEITE}>
      <h1 className={TITEL}>Meine Bestellungen</h1>
      <AnsichtKarte email={email} />

      {leer && (
        <EmptyState
          titel="Keine Bestellungen gefunden"
          satz="Zu dieser Adresse gibt es bei uns keine Bestellung. Vielleicht hast du mit einer anderen bestellt?"
          // Board Bild 4: die Wege über die volle Breite der Karte; das Symbol bleibt mittig (Register N9).
          className="items-stretch rounded-[16px] border-solid py-6 [&>span]:self-center"
          ausweg={
            <div className="flex w-full flex-col gap-1">
              <Link href="/hoefe" className={KNOPF_BREIT_GRUEN}>
                Höfe entdecken
              </Link>
              <form action={beendeBestellAnsicht}>
                <button
                  type="submit"
                  className={cn('inline-flex min-h-11 w-full items-center justify-center rounded-full px-3 text-[15px] font-semibold text-foreground hover:bg-muted', FOKUS_RAHMEN)}
                >
                  Andere E-Mail-Adresse
                </button>
              </form>
            </div>
          }
        />
      )}

      {laufend.length > 0 && (
        <section aria-labelledby="aktuell-titel" className="flex flex-col gap-2">
          <h2 id="aktuell-titel" className={ETIKETT}>
            Aktuell
          </h2>
          <ul className="flex flex-col gap-2.5">
            {laufend.map((eintrag) => (
              <LaufendeKarte key={eintrag.id} eintrag={eintrag} />
            ))}
          </ul>
        </section>
      )}

      {frueher.length > 0 && (
        <section aria-labelledby="frueher-titel" className="flex flex-col gap-2">
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
              />
            ))}
          </ListGruppe>
        </section>
      )}
    </div>
  )
}

/**
 * Die Liste ließ sich nicht laden — inline an der Karte, mit Ausweg (DESIGN_SYSTEM, „Zustände“; Board Bild 5:
 * eine Karte mit kräftigem Rand, Satz und „Noch einmal versuchen“). Mit Adresse steht „Ansicht beenden“ darüber.
 */
export function BestellungenFehler({ email }: { email?: string }): React.JSX.Element {
  return (
    <div className={SEITE}>
      <h1 className={TITEL}>Meine Bestellungen</h1>
      {email && <AnsichtKarte email={email} />}
      <section role="alert" aria-labelledby="fehler-titel" className="flex flex-col gap-1.5 rounded-[16px] border-[1.5px] border-input bg-card px-4 py-4">
        <h2 id="fehler-titel" className="text-[16px] font-bold">
          Wir konnten deine Bestellungen gerade nicht laden
        </h2>
        <p className="text-[14px] leading-normal text-muted-foreground">Prüf den Empfang und versuch es noch einmal.</p>
        <Link href={BESTELLUNGEN_PFAD} className={cn(KNOPF_BREIT_RAHMEN, 'mt-1')}>
          Noch einmal versuchen
        </Link>
      </section>
    </div>
  )
}
