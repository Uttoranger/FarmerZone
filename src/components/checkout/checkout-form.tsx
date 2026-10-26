'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, type FieldErrors } from 'react-hook-form'
import { Info, Loader2, ShoppingBasket } from 'lucide-react'
import { hoefeAdresse } from '@/lib/startseite'
import { KasseSkelett } from '@/components/checkout/kasse-skelett'
// Ohne Zod (Nr. 196): Die Kasse prüft mit reinen Funktionen, Zod bleibt auf dem Server.
import {
  CHECKOUT_FELD_REIHENFOLGE,
  kasseFormularResolver,
  leseZahlungsBetrag,
  type KasseFormularDaten as CheckoutFormData,
} from '@/lib/kasse-pruefung'
import { formatEuro } from '@/lib/format'
import { CODE_RESERVIERUNG_ABGELAUFEN } from '@/lib/reservierung'
import { ABHOLFENSTER_NICHT_VERFUEGBAR, CODE_ABHOLFENSTER_UNGUELTIG, CODE_ABHOLFENSTER_VOLL } from '@/lib/abholfenster'
import { BETRIEBSNACHWEIS_FEHLER, CODE_BETRIEBSNACHWEIS_FEHLT } from '@/lib/betriebsnachweis'
import type { PublicFarm } from '@/server/queries/farm'
import type { CartItem } from '@/lib/use-cart'
import type { KaufSperre } from '@/lib/bereiche-anzeige'
import {
  SITZUNG_SCHLUESSEL,
  WARENKORB_ANKER,
  WARENKORB_SCHLUESSEL,
  leereWarenkorb,
  leseWarenkorb,
  positionenFuer,
  schreibeWarenkorb,
} from '@/lib/warenkorb-speicher'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import {
  CODE_ZAHLART_NICHT_ANGEBOTEN,
  abholKacheln,
  abholSatz,
  angezeigteBetraege,
  barGuenstiger,
  bestellschlussHeute,
  gebuehrZeile,
  bestellungSenden,
  KASSE_DATENSCHUTZ_LINK,
  KASSE_NOCHMAL,
  KASSE_ZEITLIMIT_SATZ,
  weiterBeiEnter,
  kassenBetraege,
  kassenZahlarten,
  kassenZahlweg,
  kassenZurueck,
  kaufknopfZeile,
  reservierungsStand,
  zahlungsGebuehrText,
  ZAHLWEG_ONLINE,
  type ZahlungsBetrag,
} from '@/lib/kasse'
import { CODE_ZAHLUNG_NICHT_MOEGLICH, KONTAKT_UNTER_ANGABEN_ZUM_HOF } from '@/lib/stripe-konto'
import { EMAIL_MAX, NOTIZ_MAX, PERSONENNAME_MAX, TELEFON_MAX } from '@/lib/eingabegrenzen'
import { KASSE_AGB_SATZ } from '@/lib/rechtstexte/agb-einbindung'
import { cn } from '@/lib/utils'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FeldZaehler } from '@/components/shared/zeichen-zaehler'
import { AgbSatz } from '@/components/rechtstexte/agb-stuecke'
import { StripeZahlung } from './stripe-payment'
import { AngabenZumHof, hofAdresse, type AngabenHof } from './angaben-zum-hof'
import { KaufSperreHinweis } from '@/components/hofseite/kauf-sperre-hinweis'
import {
  AbholWahl,
  AktionsLeiste,
  FELD,
  FELD_LABEL,
  FeldFehler,
  HINWEIS,
  KARTE,
  KARTEN_TITEL,
  KNOPF_GRUEN,
  KassenRaster,
  TEXTLINK,
  KontaktHinweis,
  KorbKarte,
  ReservierungsHinweis,
  UebersichtKarte,
  ZahlartWahl,
} from './kasse-teile'

/*
 * Die Kasse /[farmSlug]/checkout im neuen Design (Nachtlauf Nr. 12, Gate 4).
 * Mockups: docs/mockups/web-k3-warenkorb-bezahlen.html,
 * web-k3-zahlung-abgelehnt.html, mobil-k3-warenkorb-bezahlen.html,
 * mobil-k3-zahlung-abgelehnt.html. Fokus-Shell ohne Unterleiste. Geglättet
 * seit Nr. 82 (Register N10, Mockups web-/mobil-k3-kasse-glatt,
 * system-k3-kasse-bezahlen-bar): vier flache Karten in Lesereihenfolge.
 *
 * Ein Oberflächen-Umbau: Was die Kasse an /api/checkout schickt und wie sie
 * dessen Antworten behandelt, ist der Bestand (Idempotenz-Schlüssel, Preise
 * und Namen aus der Datenbank, Reservierungsfrist, Abholfenster, signierter
 * Pfad der Bestätigung). Neu sind die Darstellung, E5 (keine Karte bei
 * Abholung), die sichtbare Frist und zwei Wege, die vorher in eine Sackgasse
 * führten (siehe `pruefeKorb` und die Weiche nach der Antwort).
 */

/**
 * Den Warenkorb auf den vom Server berichtigten Stand bringen: gekürzte Mengen
 * übernehmen, entfallene Positionen entfernen — und den Browser-Speicher
 * mitziehen, damit der nächste Seitenaufruf denselben Stand zeigt.
 */
function uebernehmeBerichtigung(
  vorher: CartItem[],
  berichtigt: Array<{ productId: string; quantity: number }>,
  hof: { farmId: string; farmSlug: string },
  setCart: (items: CartItem[]) => void
): CartItem[] {
  const mengen = new Map(berichtigt.map((b) => [b.productId, b.quantity]))
  const nachher = vorher
    .filter((i) => (mengen.get(i.productId) ?? 0) > 0)
    .map((i) => ({ ...i, quantity: mengen.get(i.productId) ?? i.quantity }))
  setCart(nachher)
  // Ohne Schreibzugriff (privates Fenster) stimmt die Anzeige trotzdem, und
  // der Checkout prüft serverseitig erneut — schreibeWarenkorb wirft nie.
  schreibeWarenkorb({ ...hof, items: nachher })
  return nachher
}

/**
 * Die gültigen Preise, die der Server bei einer Abweichung mitschickt, in den
 * Warenkorb übernehmen — dann zeigt die Kasse die neue Summe, und die Kundin
 * schickt bewusst noch einmal ab. Ohne das bliebe der alte Preis im Speicher,
 * und jeder weitere Versuch liefe wieder in dieselbe Ablehnung.
 */
function uebernehmePreise(
  vorher: CartItem[],
  preise: Array<{ productId: string; price: number }>,
  hof: { farmId: string; farmSlug: string },
  setCart: (items: CartItem[]) => void
): CartItem[] {
  const neu = new Map(preise.map((p) => [p.productId, p.price]))
  const nachher = vorher.map((i) => (neu.has(i.productId) ? { ...i, price: neu.get(i.productId) ?? i.price } : i))
  setCart(nachher)
  schreibeWarenkorb({ ...hof, items: nachher })
  return nachher
}

/** Der Zahlungsschritt, sobald /api/checkout Bestellung und Zahlungsvorgang angelegt hat. */
type Zahlung = {
  clientSecret: string
  bestaetigung: string
  reserviertBis: string | null
  /** Der Betrag, den der Server an Stripe gab — ab jetzt der einzige, den die Kasse zeigt. */
  betrag: ZahlungsBetrag
  /** Was beim Anlegen feststand — der Zahlungsschritt zeigt es nur noch an. */
  gebuehrText: string
  abholung: string
  name: string
  email: string
}

export function CheckoutForm({
  farm,
  nurBetriebeIds,
  vorbelegung,
  ausgebuchteAbholfenster,
  sperre,
  testbetrieb = false,
}: {
  farm: PublicFarm
  /** Fenster mit erreichter Höchstzahl (abholSchluessel) — vom Server gezählt. */
  ausgebuchteAbholfenster: string[]
  /**
   * Die Kaufsperre (Register N24), einmal auf dem Server aus derselben Zählung gerechnet
   * (checkout/page.tsx) — nie aus der Uhr des Browsers. Mit Sperre steht die Hinweiskarte oben
   * und der Kaufknopf ruht; prüfen tut weiter /api/checkout. Pause kommt hier nicht an (404).
   */
  sperre: KaufSperre
  /** Produkte dieses Hofs mit abgabe = NUR_BETRIEBE — aus der DB, nicht aus dem Korb. */
  nurBetriebeIds: string[]
  /** Ist der Besteller selbst ein Hof: Käuferart Betrieb und seine Nummer (Konzept 6.4). */
  vorbelegung: { kaeuferArt: 'BETRIEB'; betriebsnummer: string } | null
  /** Register Z2: Die Produktion läuft mit Test-Schlüssel — nur der Wahrheitswert, nie der Schlüssel. */
  testbetrieb?: boolean
}) {
  const [cart, setCart] = useState<CartItem[]>([])
  // Verlangt der Server den Nachweis, obwohl der Browser nichts davon wusste
  // (veraltete Seite), erscheint der Abschnitt trotzdem.
  const [nachweisVomServer, setNachweisVomServer] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [isHydrated, setIsHydrated] = useState(false)
  // useTransition statt eigenem Flag: React setzt isPending zurück, auch wenn
  // der Vorgang mit einem Fehler endet (Befund 4).
  const [isPending, startTransition] = useTransition()
  // Ab hier gibt es eine Bestellung — auch wenn „Zurück" im Zahlungsschritt
  // wieder die Angaben zeigt. Dann führt kein Weg mehr aus der Kasse hinaus
  // (kassenZurueck), und die Angaben stehen fest.
  const [bestellungAngelegt, setBestellungAngelegt] = useState(false)
  const [zahlung, setZahlung] = useState<Zahlung | null>(null)
  const [schritt, setSchritt] = useState<'formular' | 'zahlung'>('formular')
  // Frist der Halte dieser Sitzung (StockReservation.expiresAt) — von
  // /api/warenkorb/pruefen beim Öffnen erneuert und mitgeteilt.
  const [reserviertBis, setReserviertBis] = useState<string | null>(null)
  const [prueftKorb, setPrueftKorb] = useState(false)
  // Hinweise inline statt Toast (DESIGN_SYSTEM, „Zustände"): am Korb, was sich
  // geändert hat; an der Übersicht, was beim Abschicken schiefging.
  const [korbHinweis, setKorbHinweis] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  // Keine Antwort in 15 s oder kein Netz: Ob die Bestellung steht, ist offen — „Nochmal versuchen" schickt denselben Schlüssel.
  const [ohneAntwort, setOhneAntwort] = useState(false)
  // Register Z2: Stripe kennt den Zahlungszugang des Hofs nicht (Antwort `onlineAus`).
  // Bis zum Neuladen bietet die Kasse dann nur bar an; danach sagt es der
  // Server selbst, denn der Hof ist als nicht bereit vermerkt.
  const [onlineAus, setOnlineAus] = useState(false)
  // Die Uhr der Frist. Nur im Browser gelesen (Effekt) — die Kasse rendert auf
  // dem Server ohnehin nur das Skelett, der Korb liegt im localStorage.
  const [jetzt, setJetzt] = useState(() => new Date())

  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  /**
   * Idempotenz-Schlüssel (Befund 4): EINMAL beim Öffnen der Kasse erzeugt und
   * über alle Versuche hinweg mitgeschickt. Ein zweiter Request mit demselben
   * Schlüssel liefert die bestehende Bestellung, statt eine zweite anzulegen.
   */
  const idempotencyKeyRef = useRef<string>('')
  if (!idempotencyKeyRef.current && typeof crypto !== 'undefined') {
    idempotencyKeyRef.current = crypto.randomUUID()
  }

  useEffect(() => {
    const uhr = window.setInterval(() => setJetzt(new Date()), 15_000)
    return () => window.clearInterval(uhr)
  }, [])

  /**
   * Den Korb gegen Frist und Bestand prüfen und die Halte der Sitzung
   * erneuern — dieselbe Prüfung wie beim Öffnen der Kasse (Befund 3). Gerufen
   * beim Öffnen, über „Verfügbarkeit neu prüfen" nach Ablauf der Frist und
   * nach einer Ablehnung wegen abgelaufener Reservierung: /api/checkout selbst
   * erneuert nichts, ohne diesen Schritt liefe jeder weitere Versuch wieder in
   * dieselbe Ablehnung.
   */
  const pruefeKorb = useCallback(
    async (positionen: CartItem[], sid: string): Promise<void> => {
      if (!sid || positionen.length === 0) return
      setPrueftKorb(true)
      try {
        const res = await fetch('/api/warenkorb/pruefen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sid,
            items: positionen.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          }),
        })
        if (!res.ok) return
        const befund = await res.json()
        setReserviertBis(typeof befund.reserviertBis === 'string' ? befund.reserviertBis : null)
        setJetzt(new Date())
        if (!befund.meldung) return
        uebernehmeBerichtigung(positionen, befund.items ?? [], { farmId: farm.id, farmSlug: farm.slug }, setCart)
        setKorbHinweis(befund.meldung)
      } catch {
        // Kein Netz oder Serverfehler: Der Warenkorb bleibt, wie er ist.
        // Der Checkout prüft ohnehin noch einmal verbindlich.
      } finally {
        setPrueftKorb(false)
      }
    },
    [farm.id, farm.slug]
  )

  useEffect(() => {
    const sid = localStorage.getItem(SITZUNG_SCHLUESSEL) ?? ''
    setSessionId(sid)
    // Beschädigter oder fremder Korb ergibt einen leeren — kein Fehler, den
    // die Kundin sehen müsste (leseWarenkorb prüft mit Zod).
    const geladen: CartItem[] = positionenFuer(leseWarenkorb(localStorage.getItem(WARENKORB_SCHLUESSEL)), farm.id)
    setCart(geladen)
    setIsHydrated(true)
    void pruefeKorb(geladen, sid)
  }, [farm.id, pruefeKorb])

  // Dieselben Fenster, die der Handler annimmt (src/lib/abholfenster.ts).
  const kacheln = abholKacheln(farm.pickupSlots, jetzt, ausgebuchteAbholfenster)
  const bestellschluss = bestellschlussHeute(kacheln)
  // E5: nur online (mit fertigem Stripe-Zugang) und bar bei Abholung; Z2:
  // im Testbetrieb mit Satz an „Online bezahlen", nach `onlineAus` nur bar.
  // B1: Solange bar keine Servicegebühr kostet, online aber schon, nennt
  // „Bar bei Abholung" den Vorteil an der Option selbst (N10).
  const zahlarten = kassenZahlarten(farm, barGuenstiger(farm, jetzt), { testbetrieb, onlineAus })
  const defaultPayment = zahlarten[0]?.wert ?? 'ONSITE_CASH'

  const form = useForm<CheckoutFormData>({
    resolver: kasseFormularResolver,
    defaultValues: {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      customerNote: '',
      pickupSlotKey: '',
      paymentMethod: defaultPayment,
      kaeuferArt: vorbelegung?.kaeuferArt ?? 'PRIVAT',
      betriebsnummer: vorbelegung?.betriebsnummer ?? '',
      nurBetriebeImKorb: false,
    },
  })
  const fehlerAm = form.formState.errors

  // Abschnitt „Betrieb" nur, wenn eine NUR_BETRIEBE-Position im Korb liegt.
  const betriebAbschnitt = nachweisVomServer || cart.some((i) => nurBetriebeIds.includes(i.productId))
  // Der Wert fließt in die Komfortprüfung des Formulars (pruefeKasseFormular);
  // verbindlich prüft der Checkout-Handler mit seinen eigenen Daten.
  useEffect(() => {
    form.setValue('nurBetriebeImKorb', betriebAbschnitt)
  }, [betriebAbschnitt, form])
  const kaeuferArt = form.watch('kaeuferArt')
  const paymentMethod = form.watch('paymentMethod')
  const pickupSlotKey = form.watch('pickupSlotKey')
  const gewaehlt = kacheln.find((k) => k.key === pickupSlotKey)

  // Beträge in Cent auf demselben Weg wie /api/checkout (kassenBetraege:
  // calcTotalAmount → decimalZuCents → berechneServicegebuehr). Verbindlich
  // rechnet der Server mit den Preisen der Datenbank. Steht die Bestellung,
  // gilt nur noch ihr Betrag bei Stripe (angezeigteBetraege) — die Uhr läuft
  // weiter, die Gebühr der Bestellung nicht. Mit der gewählten Zahlart (B1):
  // Der Wechsel auf bar rechnet sofort neu, zurück auf online ebenso.
  const betraege = angezeigteBetraege(kassenBetraege(cart, farm, jetzt, paymentMethod), zahlung?.betrag ?? null)
  // Die Gebührenzeile (N10) nur in Worten; steht die Bestellung, bleibt der
  // beim Anlegen festgehaltene Titel samt Erklärsatz (zahlungsGebuehrText).
  // „entfällt" und „bar am Hof" nur bei angebotener Barzahlung (N10, kassenZahlweg).
  const zahlweg = kassenZahlweg(zahlarten, paymentMethod)
  const gebuehr = gebuehrZeile(farm, jetzt, zahlweg)
  const gesamt = formatEuro(centsAlsEuro(betraege.gesamtCents))
  const hof = { farmId: farm.id, farmSlug: farm.slug }

  /** Nach einer fehlgeschlagenen Prüfung zum ERSTEN Fehlerfeld springen (Befund 6). */
  function onInvalid(errors: FieldErrors<CheckoutFormData>) {
    const erstes = CHECKOUT_FELD_REIHENFOLGE.find((feld) => errors[feld])
    if (!erstes) return
    const el =
      formRef.current?.querySelector<HTMLElement>(`[name="${erstes}"]:not([disabled])`) ??
      formRef.current?.querySelector<HTMLElement>(`#${erstes}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // focus() nach dem Scrollen, sonst springt der Browser noch einmal.
    window.setTimeout(() => el.focus({ preventScroll: true }), 120)
  }

  /** Nach einem Schrittwechsel oben anfangen und den Fokus an den Anfang des Inhalts setzen. */
  function zeigeSchritt(neu: 'formular' | 'zahlung') {
    setSchritt(neu)
    window.setTimeout(() => {
      window.scrollTo({ top: 0 })
      document.getElementById('inhalt')?.focus({ preventScroll: true })
    }, 0)
  }

  async function onSubmit(data: CheckoutFormData) {
    setFehler(null)
    setOhneAntwort(false)
    if (cart.length === 0) {
      setFehler('Dein Warenkorb ist leer.')
      return
    }

    const [pickupDate, pickupTimeStart, pickupTimeEnd] = data.pickupSlotKey.split('|')

    try {
      const senden = await bestellungSenden({
        farmId: farm.id,
        farmSlug: farm.slug,
        sessionId,
        idempotencyKey: idempotencyKeyRef.current || undefined,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerNote: data.customerNote ?? '',
        pickupDate,
        pickupTimeStart,
        pickupTimeEnd,
        paymentMethod: data.paymentMethod,
        // Ohne sichtbaren Abschnitt ist jede Bestellung privat — eine
        // Vorbelegung als Betrieb darf nicht unbemerkt mitlaufen.
        kaeuferArt: betriebAbschnitt ? data.kaeuferArt : 'PRIVAT',
        betriebsnummer: betriebAbschnitt && data.kaeuferArt === 'BETRIEB' ? data.betriebsnummer : undefined,
        items: cart.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.price,
        })),
      })

      // Keine Antwort: kein Fehlertext über die Bestellung, sondern der Ausweg. Der Schlüssel bleibt derselbe.
      if (!senden.ok) {
        if (senden.art === 'server') setFehler('Wir konnten die Bestellung nicht senden. Lade die Seite neu und versuch es noch einmal.')
        else setOhneAntwort(true)
        return
      }
      const res = senden.daten

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // Abgelaufene Reservierung oder geänderter Bestand: Der Warenkorb wird
        // auf den geprüften Stand gebracht und bleibt SICHTBAR (Befund 3).
        if (err.code === CODE_RESERVIERUNG_ABGELAUFEN || err.code === 'WARENKORB_GEAENDERT') {
          let stand = cart
          if (Array.isArray(err.items)) stand = uebernehmeBerichtigung(stand, err.items, hof, setCart)
          // Preis geändert: den gültigen Preis übernehmen, damit die neue
          // Summe sichtbar ist, bevor erneut abgeschickt wird.
          if (Array.isArray(err.preise)) stand = uebernehmePreise(stand, err.preise, hof, setCart)
          setKorbHinweis(err.error ?? 'Dein Warenkorb hat sich geändert.')
          // Die Halte neu setzen (wie beim Öffnen der Kasse) — sonst lehnte
          // der Server jeden weiteren Versuch wieder als abgelaufen ab.
          if (err.code === CODE_RESERVIERUNG_ABGELAUFEN) await pruefeKorb(stand, sessionId)
          document.getElementById('kasse-korb')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return
        }
        // Das Fenster gibt es nicht mehr oder es ist voll: Wahl zurücksetzen,
        // Fenster und Belegung neu laden und zum Feld springen.
        if (err.code === CODE_ABHOLFENSTER_UNGUELTIG || err.code === CODE_ABHOLFENSTER_VOLL) {
          form.setValue('pickupSlotKey', '')
          form.setError('pickupSlotKey', { type: 'server', message: err.error ?? ABHOLFENSTER_NICHT_VERFUEGBAR })
          router.refresh()
          window.setTimeout(() => onInvalid(form.formState.errors), 50)
          return
        }
        // Online-Zahlung konnte nicht starten — die Bestellung ist storniert,
        // die Ware wieder frei. Ein NEUER Schlüssel, damit der nächste Versuch
        // (etwa mit Barzahlung) eine neue Bestellung wird statt der alten.
        if (err.code === CODE_ZAHLUNG_NICHT_MOEGLICH) {
          idempotencyKeyRef.current = crypto.randomUUID()
          // Stripe kennt den Zahlungszugang des Hofs nicht (Register Z2): Online gibt
          // es hier vorerst nicht. Bar ist gleich ausgewählt — die Halte der
          // Sitzung stehen noch, die Kundin muss nichts neu reservieren.
          if (err.onlineAus === true) {
            setOnlineAus(true)
            if (farm.acceptsOnsite) form.setValue('paymentMethod', 'ONSITE_CASH')
          }
          setFehler(err.error ?? 'Online-Zahlung ist gerade nicht möglich.')
          return
        }
        // Betriebsnachweis fehlt (Sprint Bereiche 1): Fehler am Feld.
        if (err.code === CODE_BETRIEBSNACHWEIS_FEHLT) {
          setNachweisVomServer(true)
          const feld = err.feld === 'betriebsnummer' ? 'betriebsnummer' : 'kaeuferArt'
          form.setError(feld, { type: 'server', message: err.error ?? BETRIEBSNACHWEIS_FEHLER })
          window.setTimeout(() => onInvalid(form.formState.errors), 50)
          return
        }
        // E5: Ein alter Stand der Seite bot noch eine Zahlart an, die es nicht mehr gibt.
        if (err.code === CODE_ZAHLART_NICHT_ANGEBOTEN) {
          form.setError('paymentMethod', { type: 'server', message: err.error })
          router.refresh()
          return
        }
        setFehler(err.error ?? 'Wir konnten die Bestellung nicht speichern. Versuch es noch einmal.')
        return
      }

      const result = await res.json()
      // Der signierte Pfad der Bestätigungsseite kommt vom Server — das
      // Geheimnis der Signatur gehört nie in den Browser.
      const bestaetigung: string = typeof result.bestaetigung === 'string' ? result.bestaetigung : `/${farm.slug}`

      // Die Weiche folgt der ANTWORT, nicht der Auswahl im Formular: Kommt zu
      // einem bekannten Schlüssel die bestehende Online-Bestellung zurück
      // (Idempotenz), geht es in deren Zahlung — nie mit einer unbezahlten
      // Online-Bestellung auf die Bestätigung, als wäre sie bar bestellt.
      if (typeof result.clientSecret === 'string') {
        // Ohne den Betrag des Servers keinen Zahlungsschritt: Eine eigene
        // Rechnung könnte von dem abweichen, was Stripe abbucht.
        const betrag = leseZahlungsBetrag(result)
        if (!betrag) {
          setFehler('Wir konnten die Zahlung nicht starten. Lade die Seite neu und versuch es noch einmal.')
          return
        }
        setBestellungAngelegt(true)
        setZahlung({
          clientSecret: result.clientSecret,
          bestaetigung,
          reserviertBis: typeof result.reserviertBis === 'string' ? result.reserviertBis : null,
          betrag,
          gebuehrText: zahlungsGebuehrText(farm, new Date(), betrag),
          abholung: gewaehlt ? abholSatz(gewaehlt) : '',
          name: data.customerName,
          email: data.customerEmail,
        })
        zeigeSchritt('zahlung')
      } else if (result.requiresConfirmation) {
        leereWarenkorb()
        router.push(bestaetigung)
      } else {
        setFehler('Wir konnten die Zahlung nicht starten. Lade die Seite neu und versuch es noch einmal.')
      }
    } catch {
      setFehler('Wir konnten die Bestellung nicht senden. Prüf deine Verbindung und versuch es noch einmal.')
    }
  }

  const fokusShell = (titel: string, inhalt: React.ReactNode) => {
    const zurueck = kassenZurueck({ farmSlug: farm.slug, schritt, bestellungAngelegt })
    return (
      <KundeFokusShell
        titel={titel}
        rechts={<span title={farm.name}>{farm.name}</span>}
        zurueck={
          zurueck.art === 'link'
            ? { href: zurueck.href, label: zurueck.label }
            : { label: zurueck.label, onClick: () => zeigeSchritt(zurueck.ziel) }
        }
      >
        {inhalt}
      </KundeFokusShell>
    )
  }

  // Warten auf den Warenkorb aus dem localStorage — dieselben Karten wie im
  // loading.tsx dieser Route, damit zwischen den beiden Wartezeiten nichts springt.
  if (!isHydrated) return fokusShell('Bestellen', <KasseSkelett />)

  // Leerer Korb — mit Ausweg und, wenn die Prüfung alles herausgenommen hat, mit dem Grund (Register N28).
  if (cart.length === 0) return fokusShell('Bestellen', <KasseLeer hof={farm} hinweis={korbHinweis} />)

  const korbPositionen = cart.map((i) => ({
    productId: i.productId,
    name: i.name,
    imageUrl: i.imageUrl,
    quantity: i.quantity,
    unit: i.unit,
    unitSize: i.unitSize,
    price: i.price,
  }))

  // Zahlungsschritt: Bestellung und Zahlungsvorgang stehen (Stripe).
  if (schritt === 'zahlung' && zahlung) {
    return fokusShell(
      'Bezahlen',
      <StripeZahlung
        clientSecret={zahlung.clientSecret}
        bestaetigung={zahlung.bestaetigung}
        farmSlug={farm.slug}
        reserviertBis={zahlung.reserviertBis}
        stand={reservierungsStand(zahlung.reserviertBis, jetzt)}
        betrag={zahlung.betrag}
        gebuehrText={zahlung.gebuehrText}
        korb={<KorbKarte hofName={farm.name} positionen={korbPositionen} zeilenCents={betraege.zeilenCents} />}
        angaben={<FesteAngaben zahlung={zahlung} adresse={hofAdresse(farm)} />}
        fussnote={`${zahlung.abholung ? `Abholung ${zahlung.abholung} · ` : ''}${ZAHLWEG_ONLINE}`}
      />
    )
  }

  const stand = reservierungsStand(reserviertBis, jetzt)
  // Online gewählt oder die Bestellung steht schon — dann geht es weiter zur Zahlung.
  const online = bestellungAngelegt || paymentMethod === 'ONLINE'

  return fokusShell(
    'Bestellen',
    <form
      ref={formRef}
      onSubmit={
        bestellungAngelegt
          ? (e) => {
              // Die Bestellung steht schon: nur zurück in ihre Zahlung.
              e.preventDefault()
              zeigeSchritt('zahlung')
            }
          : form.handleSubmit((daten) => startTransition(async () => { await onSubmit(daten) }), onInvalid)
      }
      // „Weiter" auf der Tastatur bestellt nie (weiterBeiEnter) — bestellt wird mit dem Kaufknopf.
      onKeyDown={weiterBeiEnter}
      noValidate
    >
      <KassenRaster
        uebersichtZuletzt
        korb={
          <div className="flex flex-col gap-3">
            {/* Oben dieselbe Karte wie auf Hof- und Produktseite (N24). */}
            <KaufSperreHinweis sperre={sperre} hofName={farm.name} pauseMessage={farm.pauseMessage} />
            <KorbKarte
              hofName={farm.name}
              positionen={korbPositionen}
              zeilenCents={betraege.zeilenCents}
              aendernHref={bestellungAngelegt ? undefined : `/${farm.slug}#${WARENKORB_ANKER}`}
            />
            {korbHinweis && (
              <div role="status">
                <Hinweiskarte ton="orange" symbol={Info}>
                  {korbHinweis}
                </Hinweiskarte>
              </div>
            )}
          </div>
        }
        uebersicht={
          <KassenAbschluss
            hof={farm}
            uebersicht={
              <UebersichtKarte
                betraege={betraege}
                gebuehrText={zahlung?.gebuehrText ?? gebuehr.titel}
                gebuehrErklaerung={zahlung ? undefined : gebuehr.erklaerung}
                gebuehrEntfaellt={gebuehr.entfaellt}
                reservierung={
                  bestellungAngelegt ? null : (
                    <ReservierungsHinweis
                      stand={stand}
                      schritt="formular"
                      onNeuPruefen={() => void pruefeKorb(cart, sessionId)}
                      prueftGerade={prueftKorb}
                    />
                  )
                }
                fehler={
                  ohneAntwort ? (
                    <KasseNetzFehler onNochmal={() => formRef.current?.requestSubmit()} wirdGesendet={isPending} />
                  ) : (
                    fehler && (
                      <div role="alert">
                        <Hinweiskarte ton="orange">{fehler}</Hinweiskarte>
                      </div>
                    )
                  )
                }
              />
            }
            online={online}
            wirdGesendet={isPending}
            gesperrt={isPending || kacheln.length === 0 || zahlarten.length === 0 || sperre !== null}
            gesamt={gesamt}
            fussnote={kaufknopfZeile({ termin: gewaehlt ? abholSatz(gewaehlt) : null, online, bar: zahlweg === 'ONSITE_CASH', gesperrt: sperre !== null })}
          />
        }
      >
        {bestellungAngelegt && (
          <Hinweiskarte ton="gruen" symbol={Info} titel="Deine Bestellung ist angelegt">
            Abholung und Angaben stehen fest. Mit „Weiter zur Zahlung“ bezahlst du sie.
          </Hinweiskarte>
        )}

        {/* Nach dem Anlegen stehen die Angaben fest: Ein neuer Versuch bekäme
            über den Idempotenz-Schlüssel ohnehin dieselbe Bestellung zurück. */}
        <fieldset disabled={bestellungAngelegt} className="flex min-w-0 flex-col gap-4">
          {/* N10: Korb → Abholung → Deine Daten → (Betrieb) → Bezahlen, jede Karte in voller Breite. */}
          <section aria-labelledby="kasse-abholung" className={cn(KARTE, 'flex min-w-0 flex-col gap-3')}>
            {/* Die Adresse rechts im Kopf, am Handy unter dem Titel. */}
            <div className="flex flex-col gap-0.5 md:flex-row md:items-baseline md:justify-between md:gap-4">
              <h2 id="kasse-abholung" className={KARTEN_TITEL}>
                Abholung wählen
              </h2>
              <p className={cn(HINWEIS, 'min-w-0 text-[13px] break-words md:text-right')}>{hofAdresse(farm)}</p>
            </div>
            {/* Mit Kaufsperre nennt die Karte oben den Grund schon — hier nur noch der Weg zum Hof
                (DESIGN_SYSTEM: Ein Zustand hat eine Fassung, auf der ganzen Seite). */}
            {kacheln.length === 0 ? (
              <p className="text-[13.5px] text-muted-foreground">
                {sperre === null ? `Gerade gibt es keine Abholzeiten. ${KONTAKT_UNTER_ANGABEN_ZUM_HOF}` : KONTAKT_UNTER_ANGABEN_ZUM_HOF}
              </p>
            ) : (
              <AbholWahl kacheln={kacheln} feld={form.register('pickupSlotKey')} fehler={fehlerAm.pickupSlotKey?.message} />
            )}
            {bestellschluss && <p className={HINWEIS}>Bestellschluss für heute: {bestellschluss} Uhr</p>}
          </section>

          <section aria-labelledby="kasse-daten" className={cn(KARTE, 'flex min-w-0 flex-col gap-3')}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="kasse-daten" className={KARTEN_TITEL}>
                Deine Daten
              </h2>
              {/* Die Kasse hat keinen Seitenfuß: Der Weg zur Datenschutzerklärung steht dort, wo Daten eingegeben werden.
                  Neuer Tab, damit die Eingaben stehen bleiben. */}
              <Link href="/datenschutz" target="_blank" rel="noopener noreferrer" className={cn(TEXTLINK, 'shrink-0')}>
                {KASSE_DATENSCHUTZ_LINK}
                <span className="sr-only"> (öffnet in neuem Tab)</span>
              </Link>
            </div>
            {/* Ab 768 px zwei Spalten in Lesereihenfolge: E-Mail · Name / Telefon · Notiz. */}
            <div className="grid gap-3.5 md:grid-cols-2 md:items-start md:gap-x-5">
              <Feld id="customerEmail" label="E-Mail" fehler={fehlerAm.customerEmail?.message}>
                <input
                  id="customerEmail"
                  type="email"
                  {...form.register('customerEmail')}
                  required
                  autoComplete="email"
                  inputMode="email"
                  enterKeyHint="next"
                  aria-invalid={fehlerAm.customerEmail ? true : undefined}
                  aria-describedby={fehlerAm.customerEmail ? 'customerEmail-fehler' : 'customerEmail-hinweis'}
                  placeholder="du@beispiel.at"
                  className={FELD}
                />
                <FeldZaehler control={form.control} name="customerEmail" max={EMAIL_MAX} />
                <div id="customerEmail-hinweis">
                  <KontaktHinweis />
                </div>
              </Feld>
              <Feld id="customerName" label="Name" fehler={fehlerAm.customerName?.message}>
                <input
                  id="customerName"
                  {...form.register('customerName')}
                  required
                  autoComplete="name"
                  enterKeyHint="next"
                  aria-invalid={fehlerAm.customerName ? true : undefined}
                  aria-describedby={fehlerAm.customerName ? 'customerName-fehler' : undefined}
                  placeholder="Vor- und Nachname"
                  className={FELD}
                />
                <FeldZaehler control={form.control} name="customerName" max={PERSONENNAME_MAX} />
              </Feld>
              <Feld id="customerPhone" label="Telefon" fehler={fehlerAm.customerPhone?.message}>
                <input
                  id="customerPhone"
                  type="tel"
                  {...form.register('customerPhone')}
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  enterKeyHint="next"
                  aria-invalid={fehlerAm.customerPhone ? true : undefined}
                  aria-describedby={fehlerAm.customerPhone ? 'customerPhone-fehler' : 'customerPhone-hinweis'}
                  placeholder="+43 …"
                  className={FELD}
                />
                <FeldZaehler control={form.control} name="customerPhone" max={TELEFON_MAX} />
                <p id="customerPhone-hinweis" className={cn(HINWEIS, 'mt-1.5')}>
                  Nur für den Hof, falls bei der Abholung etwas ist.
                </p>
              </Feld>
              <Feld id="customerNote" label="Notiz an den Hof (freiwillig)" fehler={fehlerAm.customerNote?.message}>
                {/* Eine Zeile wie die Felder daneben; wächst mit dem Text (field-sizing),
                    wo der Browser das nicht kann, lässt sie sich größer ziehen. */}
                <textarea
                  id="customerNote"
                  {...form.register('customerNote')}
                  rows={1}
                  aria-invalid={fehlerAm.customerNote ? true : undefined}
                  aria-describedby={fehlerAm.customerNote ? 'customerNote-fehler' : undefined}
                  placeholder="z. B. Ich komme erst gegen 17:30"
                  className={cn(FELD, 'field-sizing-content h-auto max-h-40 min-h-[46px] resize-y py-2.5 supports-[field-sizing:content]:resize-none')}
                />
                <FeldZaehler control={form.control} name="customerNote" max={NOTIZ_MAX} />
              </Feld>
            </div>
          </section>

          {/* Betrieb (Sprint Bereiche 1, Konzept 6.4) — nur, wenn ein Futtermittel
              im Korb liegt, das der Hof nur an landwirtschaftliche Betriebe abgibt. */}
          {betriebAbschnitt && (
            <section aria-labelledby="kasse-betrieb" className={cn(KARTE, 'flex flex-col gap-3')}>
              <div>
                <h2 id="kasse-betrieb" className={KARTEN_TITEL}>
                  Betrieb
                </h2>
                <p className={cn(HINWEIS, 'mt-1')}>
                  Ein Futtermittel in deinem Korb gibt der Hof nur an landwirtschaftliche Betriebe ab.
                </p>
              </div>
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  name="kaeuferArt"
                  checked={kaeuferArt === 'BETRIEB'}
                  onChange={(e) => {
                    form.setValue('kaeuferArt', e.target.checked ? 'BETRIEB' : 'PRIVAT', { shouldDirty: true })
                    form.clearErrors('kaeuferArt')
                  }}
                  aria-invalid={fehlerAm.kaeuferArt ? true : undefined}
                  aria-describedby={fehlerAm.kaeuferArt ? 'kaeuferArt-fehler' : undefined}
                  className={cn('mt-0.5 size-5 shrink-0 accent-accent', FOKUS_RAHMEN)}
                />
                <span className="text-[14px]">Ich bestelle als landwirtschaftlicher Betrieb</span>
              </label>
              {fehlerAm.kaeuferArt?.message && <FeldFehler id="kaeuferArt-fehler">{fehlerAm.kaeuferArt.message}</FeldFehler>}
              <Feld id="betriebsnummer" label="Betriebsnummer" fehler={fehlerAm.betriebsnummer?.message}>
                <input
                  id="betriebsnummer"
                  {...form.register('betriebsnummer')}
                  autoComplete="off"
                  enterKeyHint="done"
                  aria-invalid={fehlerAm.betriebsnummer ? true : undefined}
                  aria-describedby={fehlerAm.betriebsnummer ? 'betriebsnummer-fehler' : 'betriebsnummer-hilfe'}
                  placeholder="z. B. LFBIS-Nummer"
                  className={FELD}
                />
                {!fehlerAm.betriebsnummer && (
                  <p id="betriebsnummer-hilfe" className={cn(HINWEIS, 'mt-1.5')}>
                    {vorbelegung?.betriebsnummer
                      ? 'Aus deinen Hof-Einstellungen übernommen — du kannst sie hier ändern.'
                      : 'Deine LFBIS-, BAES- bzw. BVL-Nummer.'}
                  </p>
                )}
              </Feld>
            </section>
          )}

          <section aria-labelledby="kasse-bezahlen" className={cn(KARTE, 'flex flex-col gap-3')}>
            <h2 id="kasse-bezahlen" className={KARTEN_TITEL}>
              Bezahlen
            </h2>
            {zahlarten.length === 0 ? (
              <p className="text-[13.5px] text-muted-foreground">
                Bei diesem Hof kannst du gerade nicht bestellen. {KONTAKT_UNTER_ANGABEN_ZUM_HOF}
              </p>
            ) : (
              <ZahlartWahl zahlarten={zahlarten} feld={form.register('paymentMethod')} fehler={fehlerAm.paymentMethod?.message} />
            )}
            {/* Bar hat keinen nächsten Schritt — der Satz zu Stripe steht nur bei Online. */}
            {paymentMethod === 'ONLINE' && (
              <p className={HINWEIS}>
                Im nächsten Schritt bezahlst du sicher über Stripe. Apple Pay bzw. Google Pay erscheint nur, wenn dein Gerät es unterstützt.
              </p>
            )}
          </section>
        </fieldset>
      </KassenRaster>
    </form>
  )
}

/**
 * Der Abschluss der Kasse (Nr. 60, Mockups web/mobil-k3-kasse-angaben-zum-hof):
 * Übersicht, Angaben zum Hof, Kaufknopf — in dieser Reihenfolge, online wie
 * bar. So stehen Name, Anschrift, Telefon und E-Mail des Verkäufers vor dem
 * Knopf, mit dem die Kundin bestellt (§ 4 Abs. 1 Z 2 und 3 FAGG). Am Handy
 * ist der Knopf die feste Leiste unten; im Quelltext steht er nach den
 * Angaben, ab 768 px auch sichtbar darunter. Die Knopftexte sind die von Nr. 12.
 */
/**
 * Der leere Zustand der Kasse, mit Ausweg zum Hof. Hat die Prüfung beim Öffnen
 * alles aus dem Korb genommen, steht der Grund wie im vollen Zweig als orange
 * Karte darüber (Register N28, Fund aus Bericht 165) — nicht im Satz des
 * leeren Zustands, der bleibt für jeden leeren Korb derselbe.
 */
export function KasseLeer({ hof, hinweis }: { hof: Pick<PublicFarm, 'name' | 'slug'>; hinweis: string | null }): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-12">
      {hinweis && (
        <div role="status">
          <Hinweiskarte ton="orange" symbol={Info}>
            {hinweis}
          </Hinweiskarte>
        </div>
      )}
      <EmptyState
        symbol={ShoppingBasket}
        titel="Dein Warenkorb ist leer"
        satz={`Leg bei ${hof.name} etwas in den Warenkorb, dann kannst du hier bestellen.`}
        ausweg={
          <Link href={`/${hof.slug}`} className={cn(KNOPF_GRUEN, 'w-auto')}>
            Zurück zum Hof
          </Link>
        }
      />
    </div>
  )
}

/**
 * Keine Antwort in 15 s oder kein Netz (Nr. 176): Ob die Bestellung schon steht, ist offen — der Satz sagt, dass
 * nichts doppelt bestellt wird (derselbe Idempotenz-Schlüssel), „Nochmal versuchen" schickt sie noch einmal ab.
 */
export function KasseNetzFehler({ onNochmal, wirdGesendet }: { onNochmal: () => void; wirdGesendet: boolean }): React.JSX.Element {
  return (
    <div role="alert">
      <Hinweiskarte
        ton="orange"
        aktion={
          <button
            type="button"
            onClick={onNochmal}
            disabled={wirdGesendet}
            className={cn('inline-flex min-h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted disabled:opacity-60', FOKUS_RAHMEN)}
          >
            {KASSE_NOCHMAL}
          </button>
        }
      >
        {KASSE_ZEITLIMIT_SATZ}
      </Hinweiskarte>
    </div>
  )
}

/**
 * Die Kasse eines Hofs, der gerade pausiert (Nr. 176; vorher `notFound()` — „Diesen Hof gibt es hier nicht (mehr)"):
 * die Pausen-Karte mit dem Text des Hofs und zwei Wegen. Ein wirklich unbekannter Hof bleibt ein 404 (die Seite).
 */
export function KassePausiert({ farm }: { farm: Pick<PublicFarm, 'name' | 'slug' | 'pauseMessage'> }): React.JSX.Element {
  return (
    <KundeFokusShell titel="Bestellen" rechts={<span title={farm.name}>{farm.name}</span>} zurueck={{ href: `/${farm.slug}`, label: 'Zurück zum Hof' }}>
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-12">
        <KaufSperreHinweis sperre="pause" hofName={farm.name} pauseMessage={farm.pauseMessage} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={`/${farm.slug}`} className={cn(KNOPF_GRUEN, 'sm:w-auto')}>
            Zurück zum Hof
          </Link>
          <Link
            href={hoefeAdresse()}
            className={cn('inline-flex h-[50px] items-center justify-center rounded-full border border-border px-[18px] text-[15px] font-semibold hover:bg-muted', FOKUS_RAHMEN)}
          >
            Höfe entdecken
          </Link>
        </div>
      </div>
    </KundeFokusShell>
  )
}

export function KassenAbschluss({
  hof,
  uebersicht,
  online,
  wirdGesendet,
  gesperrt,
  gesamt,
  fussnote,
}: {
  hof: AngabenHof
  /** Die Übersicht mit Frist, Beträgen und einem Fehler der Anfrage. */
  uebersicht: React.ReactNode
  /** Online gewählt oder die Bestellung steht schon — dann geht es weiter zur Zahlung. */
  online: boolean
  wirdGesendet: boolean
  gesperrt: boolean
  /** Der Gesamtbetrag, fertig formatiert. */
  gesamt: string
  fussnote: string
}): React.JSX.Element {
  return (
    // max-md:mb-8: Mit dem AGB-Satz ist die feste Leiste am Handy rund 190 px hoch (vorher 125);
    // der Platz unten im Raster (pb-44) war dafür bemessen und ließ die Unterkante der letzten Karte darunter.
    <div className="flex flex-col gap-3.5 max-md:mb-8">
      {uebersicht}
      <AngabenZumHof hof={hof} />
      <AktionsLeiste>
        <button type="submit" disabled={gesperrt} aria-busy={wirdGesendet} className={KNOPF_GRUEN}>
          {wirdGesendet ? (
            <>
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              Wird gesendet …
            </>
          ) : online ? (
            `Weiter zur Zahlung · ${gesamt}`
          ) : (
            // Vor Ort ist dieser Knopf der verbindliche Abschluss: die
            // Zahlungspflicht steht deshalb auf dem Knopf selbst.
            `Zahlungspflichtig bestellen · ${gesamt}`
          )}
        </button>
        {fussnote && <p className={cn(HINWEIS, 'text-center md:text-left')}>{fussnote}</p>}
        {/* Register O4: Die AGB gelten, der Hof ist Vertragspartner, und mit dem Tippen auf den
            Knopf fällt die Zustimmung zur sofortigen Ausführung — ohne Haken. Der Link öffnet
            in einem neuen Tab, damit Kasse und Reservierung stehen bleiben. */}
        <AgbSatz stuecke={KASSE_AGB_SATZ} neuerTab className={cn(HINWEIS, 'text-center md:text-left')} />
      </AktionsLeiste>
    </div>
  )
}

/** Ein beschriftetes Feld mit Fehler darunter. */
function Feld({
  id,
  label,
  fehler,
  children,
}: {
  id: string
  label: string
  fehler?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <label htmlFor={id} className={FELD_LABEL}>
        {label}
      </label>
      {children}
      {fehler && <FeldFehler id={`${id}-fehler`}>{fehler}</FeldFehler>}
    </div>
  )
}

/** Im Zahlungsschritt: Abholung und Kontakt, wie sie beim Anlegen feststanden. */
function FesteAngaben({ zahlung, adresse }: { zahlung: Zahlung; adresse: string }): React.JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section aria-labelledby="kasse-abholung-fest" className={cn(KARTE, 'min-w-0')}>
        <h2 id="kasse-abholung-fest" className={KARTEN_TITEL}>
          Abholung
        </h2>
        <p className="mt-2 text-[14px] font-semibold">{zahlung.abholung}</p>
        <p className={cn(HINWEIS, 'mt-1 text-[13px]')}>{adresse}</p>
      </section>
      <section aria-labelledby="kasse-daten-fest" className={cn(KARTE, 'min-w-0')}>
        <h2 id="kasse-daten-fest" className={KARTEN_TITEL}>
          Deine Daten
        </h2>
        <p className="mt-2 truncate text-[14px] font-semibold" title={zahlung.name}>
          {zahlung.name}
        </p>
        <p className="truncate text-[13.5px]" title={zahlung.email}>
          {zahlung.email}
        </p>
        <KontaktHinweis />
      </section>
    </div>
  )
}
