import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'
import { wienKalendertag } from '@/lib/kalender'
import {
  UEBERFAELLIG_EINZELN,
  type BrauchtDichEintrag,
  type NaechsteAbholung,
  type NaechstesFenster,
  type PacklistenZeile,
  type PacklistenZahlen,
  type Wochenvergleich,
  type WochenBalken,
  abholfensterHeute,
  abholtage,
  abholtagName,
  abspracheKontakt,
  abholWhere,
  brauchtDich,
  fensterMitBestellungen,
  karteNaechsteAbholung,
  heuteHofSichtbar,
  naechsteAbholungWhere,
  packliste,
  packlistenZahlen,
  ueberfaelligWhere,
  umsatzHeuteCent,
  wienerTag,
  stripeEinrichtenHinweis,
  onlinePausiertDaten,
  wochenBalken,
  wochenvergleich,
} from '@/lib/heute'
import { onlineZahlungPausiert, type HofPausiertStufe } from '@/lib/stripe-konto'
import { HOF_FUER_GEBUEHR_LAGE, ladeBarMoeglich, type HofFuerGebuehrLage } from '@/server/queries/plattform-einstellung'
import { auswerten, umsatzfenster } from '@/lib/umsatz'
import { umsatzBuchungen } from '@/server/queries/umsatz'
import { statusReminder } from '@/lib/dashboard-hints'
import { ersteSchritte, ersteSchritteDaten, zuTun, type ZuTun } from '@/lib/erste-schritte'
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
  /** Was die Karte „Nächste Abholung“ nennt: das Fenster nach dem heutigen, wenn heute schon in der Packliste steht (karteNaechsteAbholung). */
  naechsteAbholungKarte: { fenster: NaechstesFenster; anzahl: number } | null
  brauchtDich: BrauchtDichEintrag[]
  woche: Wochenvergleich
  wochenBalken: WochenBalken[]
  /** Die Tage dieser Woche (Kürzel der Balken), an denen ein selbst eingetragener Verkauf steckt (selbstEingetragenSatz). */
  selbstEingetrageneTage: string[]
  /**
   * „Zu tun" (Nr. 53): Erste Schritte und die Liste der Hofseite als EINE
   * Liste — ohne das, was der Stripe-Kasten oben schon sagt (zuTun).
   */
  zuTun: ZuTun
  wartetAufFreigabe: boolean
  /**
   * Der Hof will online kassieren, Stripe lässt es gerade nicht zu — dann der
   * Hinweis mit dem Weg zu Stripe; `barMoeglich` wählt den Satz.
   */
  onlinePausiert: { barMoeglich: boolean; stufe: HofPausiertStufe } | null
  /** Freigeschaltet ohne fertiges Stripe (Register Z1, stripeEinrichtenHinweis): Hinweis „Online-Zahlung einrichten". */
  stripeEinrichten: boolean
  /**
   * Steht oben der Stripe-Kasten („pausiert" oder „einrichten", nie beide)?
   * EINMAL hier berechnet: Dieselbe Antwort stellt den Kasten (heuteAufbau)
   * und nimmt die Online-Zahlung aus „Zu tun" (zuTun).
   */
  stripeImKasten: boolean
  /**
   * Was Teilen-Karte und Freischaltungs-Moment brauchen — sichtbar = öffentlich
   * UND nicht pausiert (heuteHofSichtbar); teilenMomenteAus = der Hof hat die
   * Teilen-Momente abgeschaltet (Nr. 30, freischaltMomentMoeglich).
   */
  hof: { sichtbar: boolean; approvedAt: Date | null; teilenMomenteAus: boolean }
  /** Bis zu drei Produkte im Shop mit Bestand, in der Reihenfolge des Hofs. */
  angebot: string[]
}

/**
 * Geht bar bei diesem Hof JETZT (Register N49, [BAR] im Stripe-Hinweis)?
 * Gefragt wird nur, wenn der Hinweis steht und der Hof sichtbar ist und bar
 * annimmt — sonst ist die Antwort ohnehin nein. Scheitert das Lesen: nein
 * (die vorsichtige Fassung des Satzes), gemeldet an Sentry ohne Daten.
 */
async function barJetztFuerHinweis(
  hof: HofFuerGebuehrLage & Parameters<typeof onlineZahlungPausiert>[0] & Parameters<typeof heuteHofSichtbar>[0] & { acceptsOnsite: boolean },
  jetzt: Date
): Promise<boolean> {
  if (!onlineZahlungPausiert(hof) || !heuteHofSichtbar(hof) || !hof.acceptsOnsite) return false
  try {
    return await ladeBarMoeglich(hof, jetzt)
  } catch (err) {
    // Nur die Art des Fehlers: Ein Datenbanktext kann Kennungen tragen.
    try {
      const meldung = new Error('Heute: ob bar geht, nicht geladen')
      meldung.name = err instanceof Error ? err.name : 'Unbekannt'
      Sentry.captureException(meldung, { level: 'warning', tags: { bereich: 'heute', teil: 'stripe-hinweis-bar' } })
    } catch {
      // Telemetrie scheitert leise.
    }
    return false
  }
}

export async function getHeute(
  farmId: string,
  jetzt: Date = new Date(),
  freigabe: Promise<void> = Promise.resolve(),
  // Stichtag der Live-Schaltung (Register Z4): Testzahlungen davor sind kein Umsatz.
  stripeLiveAb: Date | null = STRIPE_LIVE_AB
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
              // N47 (Nr. 257): nur gelesen, um „Anrufen“ und „Mail schreiben“ zu füllen — abspracheKontakt unten gibt
              // sie nur für offene Bestellungen mit Absprache weiter, alle anderen Zeilen tragen keinen Kontakt.
              customerPhone: true,
              customerEmail: true,
              // Fehlende Artikel (E14) werden nicht gepackt — und brauchen keine Absprache.
              items: { where: { fehltSeit: null }, select: { productName: true, quantity: true, product: { select: { abholhinweise: true } } } },
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
        umsatzBuchungen(farmId, { von: wochenfenster.vergleich.von, bis: wochenfenster.aktuell.bis }, stripeLiveAb),
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
            // Der grobe Stand für den Stripe-Hinweis (Register N49).
            stripeKontoStand: true,
            acceptsOnline: true,
            acceptsOnsite: true,
            // Ob bar jetzt wirklich geht (ladeBarMoeglich) — dieselben Spalten wie Kasse und /api/checkout.
            ...HOF_FUER_GEBUEHR_LAGE,
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
    heutige.map(({ totalAmount, serviceFeeCents, customerPhone, customerEmail, items, ...b }) => ({
      ...b,
      items: items.map(({ productName, quantity }) => ({ productName, quantity })),
      // Der Betrag aus dem Snapshot der Bestellung (Ware + Gebühr), nie neu gerechnet.
      gesamtCents: bestellSummen({ totalAmount, serviceFeeCents }).gesamtCents,
      absprache: abspracheKontakt({ status: b.status, customerPhone, customerEmail, hinweiseJePosition: items.map((i) => i.product.abholhinweise) }),
    }))
  )
  const slots = hof?.pickupSlots ?? []
  // Leer nennt „Nächste Abholung“ das nächste Fenster MIT Bestellungen (Liste Lauf 32, heute Bild 3).
  const fensterMitZahl = fensterMitBestellungen(slots, jetzt, zeilen.length, naechsteAbholung)
  const auswertung = auswerten(buchungen, wochenfenster)
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
  // „pausiert" (Notbremse) oder „einrichten" (Register Z1) — nie beide; der eine
  // Kasten oben auf der Seite (heuteAufbau) und der Grund, die Online-Zahlung
  // nicht noch einmal in „Zu tun" zu nennen.
  const onlinePausiert = hof ? onlinePausiertDaten(hof, await barJetztFuerHinweis(hof, jetzt)) : null
  const stripeEinrichten = hof ? stripeEinrichtenHinweis(hof) : false
  const stripeImKasten = onlinePausiert !== null || stripeEinrichten

  return {
    abholungen: zeilen,
    zahlen: {
      ...packlistenZahlen(zeilen),
      umsatzHeuteCent: umsatzHeuteCent(buchungen, jetzt),
    },
    abholfensterHeute: abholfensterHeute(slots, jetzt),
    naechstesFenster: fensterMitZahl,
    naechsteAbholungKarte: karteNaechsteAbholung(slots, jetzt, zeilen.length, naechsteAbholung),
    brauchtDich: brauchtDich({
      ueberfaellig: { anzahl: ueberfaelligAnzahl, juengste: ueberfaelligJuengste },
      ausverkauft,
      ohneKategorie,
      statusErinnerung: statusReminder(letzterStatus?.publishedAt ?? null, jetzt),
    }),
    woche: wochenvergleich(auswertung.summeCent, auswertung.vergleichCent),
    wochenBalken: wochenBalken(auswertung.balken, jetzt),
    // Dieselbe Regel und dieselben Fenster, nur über die selbst eingetragenen Verkäufe (Board s1-heute Bild 2).
    selbstEingetrageneTage: auswerten(
      buchungen.filter((b) => b.quelle === 'verkauf'),
      wochenfenster
    )
      .balken.filter((b) => b.cent > 0)
      .map((b) => b.label),
    // Was der Kasten oben zeigt, steht nicht noch einmal in der Liste (F4, Vermerk 10.10.2026).
    zuTun: fortschritt
      ? zuTun(ersteSchritte(ersteSchritteDaten(hof, { produkte, aktiveAbholzeiten: slots.length })), fortschritt, { stripeImKasten })
      : { aufgaben: [], anzeigen: false },
    wartetAufFreigabe: hof?.approvedAt == null,
    // „nur bar bei Abholung" nur bei sichtbarem Hof, der bar annimmt (onlinePausiertDaten, Nr. 45 Runde 2).
    onlinePausiert,
    stripeEinrichten,
    stripeImKasten,
    hof: {
      sichtbar: hof ? heuteHofSichtbar(hof) : false,
      approvedAt: hof?.approvedAt ?? null,
      // Ohne Hof keine Momente — „aus" ist die sichere Seite.
      teilenMomenteAus: hof?.teilenMomenteAus ?? true,
    },
    angebot: angebot.map((p) => p.name),
  }
}
