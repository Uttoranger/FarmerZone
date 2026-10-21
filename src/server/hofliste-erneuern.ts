import * as Sentry from '@sentry/nextjs'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'
import { fehlerKlasse } from '@/lib/betrieb'

/**
 * Die Hofliste sofort erneuern, wenn eine Bestellung ein volles Abholfenster
 * füllen oder freigeben kann (Register N19, Ergänzung 21.10.2026, Nr. 131):
 * Im Zwischenspeicher der Hofliste (`ladeOeffentlicheHoefe`, Etikett
 * `HOEFE_CACHE_TAG`) stehen je Hof die vollen Tage (`ausgebuchtAm`). Am selben
 * Etikett hängen die Startseite und „Neu bei den Höfen“ — sie werden mit
 * erneuert, gewollt. Ohne Erneuern altert die Liste wie bisher höchstens
 * 300 s; verbindlich bleibt die Kasse (`imAbholfenster` mit `FOR UPDATE`).
 *
 * Erneuert wird nur, wenn der Hof eine aktive Abholzeit mit Höchstzahl hat —
 * nur dann kann eine Bestellung ein Fenster füllen oder freigeben.
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
function erneuere(hatHoechstzahl: () => Promise<boolean>): void {
  nachDerAntwort(async () => {
    try {
      if (!(await hatHoechstzahl())) return
      revalidateTag(HOEFE_CACHE_TAG, { expire: 0 })
    } catch (err) {
      const meldung = new Error('Hofliste nach einer Bestellung nicht erneuert')
      meldung.name = fehlerKlasse(err)
      Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'hofliste' } })
    }
  })
}

/**
 * Nach dem Anlegen einer Bestellung (api/checkout, nach `imAbholfenster`): Die
 * Route kennt die Höchstzahl ihres Fensters schon (`abholung.fenster.slot.maxOrders`)
 * — keine Zusatzabfrage. Ohne Höchstzahl kann das Fenster nicht voll werden.
 */
export function erneuereHoflisteNachBestellung(maxOrders: number | null): void {
  if (maxOrders === null) return
  erneuere(async () => true)
}

/**
 * Nach jedem Wechsel einer Bestellung auf CANCELLED (Storno des Hofs,
 * `storniereUnbezahlteBestellung`), nach dem Commit: Ob der Hof der Bestellung
 * eine aktive Abholzeit mit Höchstzahl hat, fragt erst der Nachlauf — die
 * Antwort an den Browser wartet nicht darauf. Wache:
 * tests/hofliste-erneuern-wache.test.ts.
 */
export function erneuereHoflisteNachStorno(orderId: string): void {
  erneuere(async () => {
    const begrenzt = await prisma.pickupSlot.findFirst({
      where: { isActive: true, maxOrders: { not: null }, farm: { orders: { some: { id: orderId } } } },
      select: { farmId: true },
    })
    return begrenzt !== null
  })
}
