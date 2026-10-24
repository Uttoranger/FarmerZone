/**
 * Hofliste nach dem Anlegen und nach einem Storno einer Bestellung erneuern,
 * wenn dadurch ein Abholfenster voll wird bzw. wieder frei (Register N19,
 * Ergänzungen 21.10.2026 und 24.10.2026). Warum über `nachDerAntwort`:
 * Kommentar an `erneuere`.
 */
import * as Sentry from '@sentry/nextjs'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { fehlerKlasse } from '@/lib/betrieb'
import { istFensterBestellbar, istVoll } from '@/lib/abholfenster'
import { wochentagVon } from '@/lib/kalender'
import { kalendertagInWien } from '@/lib/wiener-tag'
import { belegung, type HofFenster } from '@/server/abholfenster'

/** Was den Platz im Fenster geändert hat. */
export type FensterWechsel = 'bestellung' | 'storno'

/**
 * Die Entscheidung, rein (Register N19, Ergänzung 24.10.2026, Nr. 163): Hat
 * dieser Wechsel das Fenster voll gemacht bzw. ein volles wieder frei? Nur
 * dann ändern sich die vollen Tage (`ausgebuchtAm`) im Zwischenspeicher der
 * Hofliste. `belegtNachher` ist die Zählung NACH dem Wechsel (`belegung`, wie
 * in der Kasse); vorher war es ein Platz weniger (Bestellung) bzw. mehr
 * (Storno). „Voll“ heißt dieselbe Regel wie beim Anlegen (`istVoll`) — ohne
 * Höchstzahl nie. Ein Fenster, das schon vorher voll war (Höchstzahl
 * nachträglich gesenkt), erneuert nicht noch einmal.
 */
export function wechseltFensterStand(wechsel: FensterWechsel, belegtNachher: number, maxOrders: number | null): boolean {
  if (maxOrders === null) return false
  const vorher = wechsel === 'bestellung' ? belegtNachher - 1 : belegtNachher + 1
  return istVoll(vorher, maxOrders) !== istVoll(belegtNachher, maxOrders)
}

/**
 * Die Hofliste sofort erneuern, wenn eine Bestellung ein volles Abholfenster
 * füllen oder freigeben kann (Register N19, Ergänzung 21.10.2026, Nr. 131):
 * Im Zwischenspeicher der Hofliste (`ladeOeffentlicheHoefe`, Etikett
 * `HOEFE_CACHE_TAG`) stehen je Hof die vollen Tage (`ausgebuchtAm`). Am selben
 * Etikett hängen die Startseite und „Neu bei den Höfen“ — sie werden mit
 * erneuert, gewollt. Ohne Erneuern altert die Liste wie bisher höchstens
 * 300 s; verbindlich bleibt die Kasse (`imAbholfenster` mit `FOR UPDATE`).
 *
 * Erneuert wird seit Nr. 163 nur, wenn der Wechsel das Fenster voll macht oder
 * wieder frei (`wechseltFensterStand`) — sonst ändert sich an der Liste nichts,
 * und jede Bestellung ließe sonst den ganzen Eintrag (alle Höfe) neu bauen.
 *
 * WARUM `revalidateTag(…, { expire: 0 })` ÜBER `nachDerAntwort`, nicht
 * `updateTag`: Der Helfer läuft in Route (api/checkout, Stripe-Webhook), Cron,
 * Action (Storno des Hofs, Bar-Bestätigung) UND beim Rendern einer Seite —
 * `storniereUnbezahlteBestellung` läuft über `gibVerwaisteFreiOhneRisiko` auch
 * beim Laden von Hofseite, Kasse, Bestätigung, Bestellseite, Heute,
 * Bestellungen und Produkte. Beim Rendern wirft jede Cache-Entwertung
 * (node_modules/next/dist/server/web/spec-extension/revalidate.js, Stelle
 * `workUnitStore.phase === 'render'`, next 16.4.2); `updateTag` wirft
 * außerhalb einer Server Action, also auch in Route und beim Rendern. In
 * `after()` ist die Phase „after“, dort führt Next die Entwertung aus.
 * `{ expire: 0 }`: Die nächste Anfrage baut neu, ein alter Stand wird nicht
 * mehr ausgeliefert (node_modules/next/dist/docs/01-app/03-api-reference/
 * 04-functions/revalidateTag.md, Abschnitt „Revalidation Behavior“ und das
 * Beispiel für Route Handler: „Pass `{ expire: 0 }` to expire the data
 * immediately“).
 *
 * NIE IN EINER OFFENEN TRANSAKTION: Die Aufrufer rufen nach dem Commit. Ein
 * Fehler beim Erneuern bricht weder Bestellung noch Storno ab (CLAUDE.md §2):
 * Er geht als Meldung nach Sentry — fester Satz, `bereich: 'hofliste'` und die
 * Fehlerklasse, ohne Bestell- oder Personendaten. Wirkt das Erneuern nach dem
 * Rendern nicht, altert die Liste höchstens 300 s, ohne Meldung.
 */
function erneuere(wechseltStand: () => Promise<boolean>): void {
  nachDerAntwort(async () => {
    try {
      if (!(await wechseltStand())) return
      revalidateTag(HOEFE_CACHE_TAG, { expire: 0 })
    } catch (err) {
      const meldung = new Error('Hofliste nicht erneuert')
      meldung.name = fehlerKlasse(err)
      Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'hofliste' } })
    }
  })
}

/**
 * Nach dem Anlegen einer Bestellung (api/checkout, nach `imAbholfenster`): Die
 * Route übergibt Hof und Fenster samt Tag (`abholung.fenster`) — die Höchstzahl
 * steckt im Slot, ohne Höchstzahl kann das Fenster nicht voll werden, dann
 * auch keine Zählung. Gezählt wird erst im Nachlauf, nach dem Commit.
 */
export function erneuereHoflisteNachBestellung(farmId: string, fenster: HofFenster): void {
  const { maxOrders } = fenster.slot
  if (maxOrders === null) return
  erneuere(async () => wechseltFensterStand('bestellung', await belegung(prisma, farmId, fenster), maxOrders))
}

/**
 * Nach jedem Wechsel einer Bestellung auf CANCELLED (Storno des Hofs,
 * `storniereUnbezahlteBestellung`), nach dem Commit: Termin der Bestellung,
 * die aktive Abholzeit mit Höchstzahl dazu und die Zählung fragt erst der
 * Nachlauf — die Antwort an den Browser wartet nicht darauf. Ein Termin, den
 * man nicht mehr bestellen kann, steht in keiner Liste (dieselbe Regel wie die
 * Liste, `istFensterBestellbar`): kein Erneuern. Wache:
 * tests/hofliste-erneuern-wache.test.ts.
 */
export function erneuereHoflisteNachStorno(orderId: string): void {
  erneuere(async () => {
    const bestellung = await prisma.order.findUnique({
      where: { id: orderId },
      select: { farmId: true, pickupDate: true, pickupTimeStart: true, pickupTimeEnd: true },
    })
    if (!bestellung) return false
    const datum = kalendertagInWien(bestellung.pickupDate)
    if (!istFensterBestellbar(datum, bestellung.pickupTimeStart, new Date())) return false
    const slot = await prisma.pickupSlot.findFirst({
      where: {
        farmId: bestellung.farmId,
        isActive: true,
        maxOrders: { not: null },
        dayOfWeek: wochentagVon(datum),
        startTime: bestellung.pickupTimeStart,
        endTime: bestellung.pickupTimeEnd,
      },
      select: { maxOrders: true },
    })
    if (!slot) return false
    const wahl = { datum, start: bestellung.pickupTimeStart, ende: bestellung.pickupTimeEnd }
    return wechseltFensterStand('storno', await belegung(prisma, bestellung.farmId, wahl), slot.maxOrders)
  })
}
