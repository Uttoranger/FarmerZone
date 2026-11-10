import Link from 'next/link'
import { FARM_ARCHIVED_OWNER_BANNER } from '@/lib/farm-archive'
import { freischaltungsMailto, warteBalkenText, type WarteStand } from '@/lib/farm-approval'
import { DE_VORBEREITUNG_HINWEIS, alsLand } from '@/lib/laender'
import { SUPPORT_EMAIL } from '@/lib/support'
import type { Hofbereich } from '@/server/hofbereich'
import { HINWEISKASTEN_LINK, Hinweiskasten } from '@/components/ui/hinweiskasten'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * Die Balken der HofShell (stillgelegt, wartet auf Freigabe) — seit Nr. 245 als Hinweiskasten (G3), oben
 * über der Seite oder unter dem Werkzeug-Kopf.
 */

/**
 * Wo der Balken steht: `oben` über der Seite (Layout der HofShell, für Seiten
 * ohne Werkzeug-Kopf), `unter-kopf` in der Inhaltsspalte unter dem
 * Werkzeug-Kopf (G3) — das Layout reicht ihn dafür an `UnterDemWerkzeugKopf`.
 */
export type HofBalkenLage = 'oben' | 'unter-kopf'

/*
 * Oben blendet sich der Balken aus, sobald die Seite einen Werkzeug-Kopf trägt
 * (data-werkzeug-kopf in <main> der HofShell) — dort steht er unter dem Kopf.
 * So gibt es ihn nie zweimal, und jede Seite wechselt mit ihrer Nummer
 * (Route für Route), ohne das Layout anzufassen.
 */
const LAGE: Record<HofBalkenLage, string> = {
  oben: 'px-4 pt-4 md:px-8 print:hidden [main:has([data-werkzeug-kopf])_&]:hidden',
  'unter-kopf': 'print:hidden',
}

/**
 * Die Balken der HofShell — dieselben Zustände und Wortlaute wie im
 * Bestandslayout (ArchivedFarmBanner, PendingApprovalBanner), seit Nr. 245 als
 * Hinweiskasten (G3): braun getönt, Titel in `status-offen`, ohne Uhr, ohne
 * Zeile „Deine Hof-ID“ und ohne Nachsatz — die Hof-ID steckt nur noch im
 * vorausgefüllten Link „Frage zur Freischaltung stellen“. Nicht schließbar,
 * weil es der Zustand des Hofs ist, kein Tipp. Welcher Balken gilt, entscheidet
 * der Lader (stillgelegt sticht „wartet“).
 *
 * Seit Lauf 30 (N42 e) hängt der Titel von „wartet" am Stand der Schritte
 * (`warteStand`, src/lib/einrichten.ts); seit Nr. 233 bringt der Lader des
 * Layouts den Stand im Balken mit (`ladeHofbereich`), so steht auf JEDER Seite
 * der HofShell derselbe Titel wie auf „Hof einrichten“.
 */
export function HofBalken({ balken, lage = 'oben' }: { balken: Hofbereich['balken']; lage?: HofBalkenLage }): React.JSX.Element | null {
  if (!balken) return null

  if (balken.art === 'stillgelegt') {
    return (
      <div className={LAGE[lage]}>
        <Hinweiskasten
          titel={FARM_ARCHIVED_OWNER_BANNER}
          aktion={
            <Link
              href="/settings/account"
              className={cn(
                'mt-1 inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90',
                FOKUS_RAHMEN
              )}
            >
              Hof reaktivieren
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className={LAGE[lage]}>
      <WarteBalken farmId={balken.farmId} farmName={balken.farmName} country={balken.country} stand={balken.stand} />
    </div>
  )
}

/**
 * Der Kasten „wartet auf Freigabe" ohne den Rand der Seite — für Seiten, die
 * den Balken selbst in ihren Kopf setzen (Einrichten, Board w2-registrieren:
 * unter dem Titel). Titel und Satz je Stand aus `warteBalkenText`; die Hof-ID
 * nur im Mail-Link (G3).
 */
export function WarteBalken({
  farmId,
  farmName,
  country,
  stand,
}: {
  farmId: string
  farmName: string
  country: string
  stand: WarteStand | null
}): React.JSX.Element {
  const text = warteBalkenText(stand)
  return (
    <Hinweiskasten
      titel={text.titel}
      aktion={
        <a href={freischaltungsMailto(SUPPORT_EMAIL, farmName, farmId)} className={HINWEISKASTEN_LINK}>
          Frage zur Freischaltung stellen
        </a>
      }
    >
      <p>{text.hinweis}</p>
      {alsLand(country) === 'DE' && <p className="mt-1">{DE_VORBEREITUNG_HINWEIS}</p>}
    </Hinweiskasten>
  )
}
