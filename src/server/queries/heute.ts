import { prisma } from '@/lib/prisma'
import { wienKalendertag } from '@/lib/kalender'
import {
  UEBERFAELLIG_EINZELN,
  type BrauchtDichEintrag,
  type NaechsteAbholung,
  type NaechstesFenster,
  type PacklistenZeile,
  type PacklistenZahlen,
  type StripeHinweisOrt,
  type Wochenvergleich,
  type WochenBalken,
  abholfensterHeute,
  abholtage,
  abholtagName,
  abholWhere,
  brauchtDich,
  fensterAnzahl,
  heuteHofSichtbar,
  naechsteAbholungWhere,
  naechstesAbholfenster,
  packliste,
  packlistenZahlen,
  ueberfaelligWhere,
  umsatzHeuteCent,
  wienerTag,
  stripeEinrichtenHinweis,
  stripeHinweisOrt,
  wochenBalken,
  wochenvergleich,
} from '@/lib/heute'
import { hofBalkenArt } from '@/lib/mein-hof'
import { auswerten, umsatzfenster } from '@/lib/umsatz'
import { umsatzBuchungen } from '@/server/queries/umsatz'
import { statusReminder } from '@/lib/dashboard-hints'
import { ersteSchritte, ersteSchritteDaten, type ErsteSchritteErgebnis } from '@/lib/erste-schritte'
import { onlineZahlungPausiert } from '@/lib/stripe-konto'
import { bestellSummen } from '@/lib/servicegebuehr'
import { hofseiteFortschritt, hofseiteStand } from '@/lib/hofseite-fortschritt'
import { DEFAULT_SECTIONS, type SectionConfig } from '@/server/queries/appearance'

/** So viele Produkte nennt die Teilen-Karte („Eier, Erdäpfel, Heu"). */
const TEILEN_ANGEBOT = 3

/**
 * Alles für den Heute-Bildschirm (/dashboard) in einem Zug. Die Regeln stehen
 * rein in src/lib/heute.ts, der Umsatz kommt aus der gemeinsamen Regel
 * (src/lib/umsatz.ts, src/server/queries/umsatz.ts).
 *
 * `freigabe` ist die laufende Freigabe verwaister Bestellungen, die die Seite
 * angestoßen hat (Frist gilt beim Lesen, ARCHITECTURE §5) — dieses Modul
 * schreibt nicht selbst. Was sie ändern kann, wartet auf sie: offene
 * Bestellungen (Packliste, nächster Abholtag, überfällig) und der Vorrat
 * (ausverkauft, Angebot der Teilen-Karte). Was sie nie berührt — Umsatz (nur
 * PICKED_UP), Hof und Abholzeiten, Produktzahl, Produkte ohne Kategorie, der
 * letzte Beitrag —, läuft schon daneben (Nachtlauf Nr. 31). Die Freigabe
 * selbst wirft nie (gibVerwaisteFreiOhneRisiko).
 */

export type Heute = {
  /** Die Packliste für heute (offen zuerst, packliste in src/lib/heute.ts). */
  abholungen: PacklistenZeile[]
  zahlen: PacklistenZahlen & { umsatzHeuteCent: number }
  /** Die Zeiten, wenn heute (Wien) ein Abholtag ist; sonst null. */
  abholfensterHeute: string | null
  /** Das nächste Abholfenster laut Abholzeiten und wie viele Bestellungen dafür offen sind. */
  naechstesFenster: { fenster: NaechstesFenster; anzahl: number } | null
  /** Der nächste Abholtag nach heute mit offenen Bestellungen; null = keiner in Sicht (die Zeile entfällt). */
  naechsteAbholung: NaechsteAbholung | null
  brauchtDich: BrauchtDichEintrag[]
  woche: Wochenvergleich
  wochenBalken: WochenBalken[]
  ersteSchritte: ErsteSchritteErgebnis
  wartetAufFreigabe: boolean
  /**
   * Der Hof will online kassieren, Stripe lässt es gerade nicht zu — dann der
   * Hinweis mit dem Weg zu Stripe; `barMoeglich` wählt den Satz.
   */
  onlinePausiert: { barMoeglich: boolean } | null
  /** Freigeschaltet ohne fertiges Stripe (Register Z1, stripeEinrichtenHinweis): Hinweis „Online-Zahlung einrichten". */
  stripeEinrichten: boolean
  /**
   * Wo einer der beiden Stripe-Hinweise steht (stripeHinweisOrt): oben als
   * einziger Kasten, als Zeile in „Braucht dich", wenn die Shell oben schon
   * ihren Balken zeigt, oder gar nicht.
   */
  stripeOrt: StripeHinweisOrt
  /**
   * Was Teilen-Karte und Freischaltungs-Moment brauchen — sichtbar = öffentlich
   * UND nicht pausiert (heuteHofSichtbar); teilenMomenteAus = der Hof hat die
   * Teilen-Momente abgeschaltet (Nr. 30, freischaltMomentMoeglich).
   */
  hof: { sichtbar: boolean; approvedAt: Date | null; teilenMomenteAus: boolean }
  /** Bis zu drei Produkte im Shop mit Bestand, in der Reihenfolge des Hofs. */
  angebot: string[]
  /** „Deine Hofseite": dieselbe Rechnung wie die Checkliste in Mein Hof. */
  hofseite: { prozent: number; satz: string; fertig: boolean }
}

export async function getHeute(
  farmId: string,
  jetzt: Date = new Date(),
  freigabe: Promise<void> = Promise.resolve()
): Promise<Heute> {
  const { heute } = abholtage(jetzt)
  // Dieselbe Regel wie Verkauf und Auswertung: src/lib/umsatz.ts.
  const wochenfenster = umsatzfenster('woche', jetzt)

  const [[heutige, naechste, ueberfaelligAnzahl, ueberfaelligJuengste, ausverkauft, angebot], [ohneKategorie, letzterStatus, buchungen, hof, produkte]] =
    await Promise.all([
      // Erst nach der Freigabe: offene Bestellungen und Vorrat.
      freigabe.then(() =>
        Promise.all([
          prisma.order.findMany({
            where: abholWhere(farmId, heute),
            select: {
              id: true,
              customerName: true,
              pickupTimeStart: true,
              pickupTimeEnd: true,
              paymentMethod: true,
              status: true,
              totalAmount: true,
              serviceFeeCents: true,
              // Fehlende Artikel (E14) werden nicht gepackt.
              items: { where: { fehltSeit: null }, select: { productName: true, quantity: true } },
            },
          }),
          prisma.order.findFirst({
            where: naechsteAbholungWhere(farmId, jetzt),
            orderBy: { pickupDate: 'asc' },
            select: { pickupDate: true },
          }),
          prisma.order.count({ where: ueberfaelligWhere(farmId, jetzt) }),
          prisma.order.findMany({
            where: ueberfaelligWhere(farmId, jetzt),
            select: { id: true, customerName: true, pickupDate: true },
            orderBy: { pickupDate: 'desc' },
            take: UEBERFAELLIG_EINZELN,
          }),
          // Dieselbe Regel wie produktZustand (produkt-sichtbarkeit.ts): im Shop, Bestand 0.
          prisma.product.findMany({
            where: { farmId, isAvailable: true, stock: { lte: 0 } },
            select: { id: true, name: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          }),
          // Was die Teilen-Karte nennt: im Shop und vorrätig (wie produktZustand).
          prisma.product.findMany({
            where: { farmId, isAvailable: true, stock: { gt: 0 } },
            select: { name: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            take: TEILEN_ANGEBOT,
          }),
        ])
      ),
      // Daneben: was die Freigabe nie ändert.
      Promise.all([
        // Nur Produkte im Shop: Ein ausgeblendetes ohne Kategorie stört keine Kundin.
        prisma.product.findMany({
          where: { farmId, isAvailable: true, category: null },
          select: { id: true, name: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        }),
        prisma.statusPost.findFirst({
          where: { farmId, publishedAt: { not: null } },
          orderBy: { publishedAt: 'desc' },
          select: { publishedAt: true },
        }),
        // Die Buchungen von Montag der Vorwoche bis jetzt: daraus Woche, Vorwoche
        // bis zum selben Zeitpunkt, die Tagesbalken und „Umsatz heute" — alles
        // nach derselben Regel wie Verkauf und Auswertung (auswerten, summeCent).
        umsatzBuchungen(farmId, { von: wochenfenster.vergleich.von, bis: wochenfenster.aktuell.bis }),
        // Einstiegs-Checkliste, Hofseiten-Stand, Zustand und Abholzeiten in einem Zugriff.
        prisma.farm.findUnique({
          where: { id: farmId },
          select: {
            name: true,
            description: true,
            aboutText: true,
            address: true,
            postalCode: true,
            city: true,
            phone: true,
            email: true,
            latitude: true,
            longitude: true,
            logoUrl: true,
            bannerType: true,
            bannerUrl: true,
            sectionsConfig: true,
            stripeAccountReady: true,
            stripeAccountId: true,
            acceptsOnline: true,
            acceptsOnsite: true,
            approvedAt: true,
            archivedAt: true,
            isActive: true,
            isPaused: true,
            teilenMomenteAus: true,
            farmPhotos: { select: { id: true } },
            pickupSlots: {
              where: { isActive: true },
              orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
              select: { dayOfWeek: true, startTime: true, endTime: true },
            },
          },
        }),
        prisma.product.count({ where: { farmId } }),
      ]),
    ])

  // Erst der Tag, dann seine Bestellungen — über dieselbe Bedingung wie
  // „Heute abholen", damit Zeile und Bestellliste dieselben Bestellungen zählen.
  let naechsteAbholung: NaechsteAbholung | null = null
  if (naechste) {
    const tag = wienKalendertag(naechste.pickupDate)
    const anzahl = await prisma.order.count({ where: abholWhere(farmId, wienerTag(tag)) })
    naechsteAbholung = { tag, name: abholtagName(wienKalendertag(jetzt), tag), anzahl }
  }

  const zeilen = packliste(
    heutige.map(({ totalAmount, serviceFeeCents, ...b }) => ({
      ...b,
      // Der Betrag aus dem Snapshot der Bestellung (Ware + Gebühr), nie neu gerechnet.
      gesamtCents: bestellSummen({ totalAmount, serviceFeeCents }).gesamtCents,
    }))
  )
  const slots = hof?.pickupSlots ?? []
  const fenster = naechstesAbholfenster(slots, jetzt)
  const fensterZahl = fensterAnzahl(fenster, wienKalendertag(jetzt), zeilen, naechsteAbholung)
  const auswertung = auswerten(buchungen, wochenfenster)
  const onlinePausiert = hof !== null && onlineZahlungPausiert(hof)
  const stripeEinrichten = hof !== null && stripeEinrichtenHinweis(hof)
  // Oben höchstens EIN Kasten (freigabe.md §12 Nr. 45): Steht dort schon der
  // Balken der Shell, rückt der Stripe-Hinweis in „Braucht dich".
  const stripeOrt = stripeHinweisOrt({
    hinweis: onlinePausiert || stripeEinrichten,
    hofBalken: hof !== null && hofBalkenArt(hof) !== null,
  })
  const sektionen = hof?.sectionsConfig
  const fortschritt = hof
    ? hofseiteFortschritt(
        hofseiteStand(
          {
            ...hof,
            sectionsConfig:
              Array.isArray(sektionen) && sektionen.length > 0 ? (sektionen as SectionConfig[]) : DEFAULT_SECTIONS,
          },
          hof
        )
      )
    : null

  return {
    abholungen: zeilen,
    zahlen: {
      ...packlistenZahlen(zeilen),
      umsatzHeuteCent: umsatzHeuteCent(buchungen, jetzt),
    },
    abholfensterHeute: abholfensterHeute(slots, jetzt),
    naechstesFenster: fenster ? { fenster, anzahl: fensterZahl } : null,
    naechsteAbholung,
    brauchtDich: brauchtDich({
      ueberfaellig: { anzahl: ueberfaelligAnzahl, juengste: ueberfaelligJuengste },
      ausverkauft,
      ohneKategorie,
      statusErinnerung: statusReminder(letzterStatus?.publishedAt ?? null, jetzt),
      stripe: stripeOrt === 'braucht-dich',
    }),
    woche: wochenvergleich(auswertung.summeCent, auswertung.vergleichCent),
    wochenBalken: wochenBalken(auswertung.balken, jetzt),
    ersteSchritte: ersteSchritte(ersteSchritteDaten(hof, { produkte, aktiveAbholzeiten: slots.length })),
    wartetAufFreigabe: hof?.approvedAt == null,
    onlinePausiert: hof && onlinePausiert ? { barMoeglich: hof.acceptsOnsite } : null,
    stripeEinrichten,
    stripeOrt,
    hof: {
      sichtbar: hof ? heuteHofSichtbar(hof) : false,
      approvedAt: hof?.approvedAt ?? null,
      // Ohne Hof keine Momente — „aus" ist die sichere Seite.
      teilenMomenteAus: hof?.teilenMomenteAus ?? true,
    },
    angebot: angebot.map((p) => p.name),
    hofseite: fortschritt
      ? { prozent: fortschritt.prozent, satz: fortschritt.satz, fertig: fortschritt.fehlend.length === 0 }
      : { prozent: 0, satz: '', fertig: false },
  }
}
