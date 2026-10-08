'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Loader2, ShoppingBasket } from 'lucide-react'
import { KasseSkelett } from '@/components/checkout/kasse-skelett'
import {
  checkoutFormSchema,
  checkoutZahlungsBetragSchema,
  CHECKOUT_FELD_REIHENFOLGE,
  type CheckoutFormData,
} from '@/schemas/checkout'
import { formatEuro } from '@/lib/format'
import { CODE_RESERVIERUNG_ABGELAUFEN } from '@/lib/reservierung'
import { ABHOLFENSTER_NICHT_VERFUEGBAR, CODE_ABHOLFENSTER_UNGUELTIG, CODE_ABHOLFENSTER_VOLL } from '@/lib/abholfenster'
import { BETRIEBSNACHWEIS_FEHLER, CODE_BETRIEBSNACHWEIS_FEHLT } from '@/lib/betriebsnachweis'
import type { PublicFarm } from '@/server/queries/farm'
import type { CartItem } from '@/lib/use-cart'
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
  barHinweis,
  bestellschlussHeute,
  gebuehrBezeichnung,
  kassenBetraege,
  kassenZahlarten,
  kassenZurueck,
  reservierungsStand,
  zahlungsGebuehrText,
  type ZahlungsBetrag,
} from '@/lib/kasse'
import { CODE_ZAHLUNG_NICHT_MOEGLICH } from '@/lib/stripe-konto'
import { EMAIL_MAX, NOTIZ_MAX, PERSONENNAME_MAX, TELEFON_MAX } from '@/lib/eingabegrenzen'
import { cn } from '@/lib/utils'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FeldZaehler } from '@/components/shared/zeichen-zaehler'
import { StripeZahlung } from './stripe-payment'
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
 * mobil-k3-zahlung-abgelehnt.html. Fokus-Shell ohne Unterleiste.
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
}: {
  farm: PublicFarm
  /** Fenster mit erreichter Höchstzahl (abholSchluessel) — vom Server gezählt. */
  ausgebuchteAbholfenster: string[]
  /** Produkte dieses Hofs mit abgabe = NUR_BETRIEBE — aus der DB, nicht aus dem Korb. */
  nurBetriebeIds: string[]
  /** Ist der Besteller selbst ein Hof: Käuferart Betrieb und seine Nummer (Konzept 6.4). */
  vorbelegung: { kaeuferArt: 'BETRIEB'; betriebsnummer: string } | null
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
  // B1: Solange bar keine Servicegebühr kostet, online aber schon, sagt die
  // Kasse das unter den Zahlarten — und verspricht nicht „gleicher Betrag".
  const hinweisBar = barHinweis(farm, jetzt)
  // E5: nur online (mit fertigem Stripe-Zugang) und bar bei Abholung.
  const zahlarten = kassenZahlarten(farm, hinweisBar !== null)
  const defaultPayment = zahlarten[0]?.wert ?? 'ONSITE_CASH'

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutFormSchema) as Resolver<CheckoutFormData>,
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
  // Der Wert fließt in die Komfortprüfung des Formulars (checkoutFormSchema);
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
  const gebuehrText = zahlung?.gebuehrText ?? gebuehrBezeichnung(farm, jetzt)
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
    if (cart.length === 0) {
      setFehler('Dein Warenkorb ist leer.')
      return
    }

    const [pickupDate, pickupTimeStart, pickupTimeEnd] = data.pickupSlotKey.split('|')

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      })

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
        const betrag = checkoutZahlungsBetragSchema.safeParse(result)
        if (!betrag.success) {
          setFehler('Wir konnten die Zahlung nicht starten. Lade die Seite neu und versuch es noch einmal.')
          return
        }
        setBestellungAngelegt(true)
        setZahlung({
          clientSecret: result.clientSecret,
          bestaetigung,
          reserviertBis: typeof result.reserviertBis === 'string' ? result.reserviertBis : null,
          betrag: betrag.data,
          gebuehrText: zahlungsGebuehrText(farm, new Date(), betrag.data),
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

  // Leerer Korb — mit Ausweg.
  if (cart.length === 0) {
    return fokusShell(
      'Bestellen',
      <div className="mx-auto max-w-lg px-4 py-12">
        <EmptyState
          symbol={ShoppingBasket}
          titel="Dein Korb ist leer"
          satz={`Leg bei ${farm.name} etwas in den Korb, dann kannst du hier bestellen.`}
          aktion={
            <Link href={`/${farm.slug}`} className={cn(KNOPF_GRUEN, 'w-auto')}>
              Zurück zum Hof
            </Link>
          }
        />
      </div>
    )
  }

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
        fussnote={`${zahlung.abholung ? `Abholung ${zahlung.abholung} · ` : ''}Bezahlung sicher über Stripe`}
      />
    )
  }

  const stand = reservierungsStand(reserviertBis, jetzt)
  const fussnote = [
    gewaehlt ? `Abholung ${abholSatz(gewaehlt)}` : 'Wähl noch, wann du abholst',
    paymentMethod === 'ONLINE' ? 'Bezahlung sicher über Stripe' : 'Du zahlst bar beim Abholen',
  ].join(' · ')

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
      noValidate
    >
      <KassenRaster
        korb={
          <div className="flex flex-col gap-3">
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
          <UebersichtKarte
            betraege={betraege}
            gebuehrText={gebuehrText}
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
              fehler && (
                <div role="alert">
                  <Hinweiskarte ton="orange">{fehler}</Hinweiskarte>
                </div>
              )
            }
          >
            <AktionsLeiste>
              <button
                type="submit"
                disabled={isPending || kacheln.length === 0 || zahlarten.length === 0}
                aria-busy={isPending}
                className={KNOPF_GRUEN}
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                    Wird gesendet …
                  </>
                ) : bestellungAngelegt || paymentMethod === 'ONLINE' ? (
                  `Weiter zur Zahlung · ${gesamt}`
                ) : (
                  // Vor Ort ist dieser Knopf der verbindliche Abschluss: die
                  // Zahlungspflicht steht deshalb auf dem Knopf selbst.
                  `Zahlungspflichtig bestellen · ${gesamt}`
                )}
              </button>
              <p className={HINWEIS}>{fussnote}</p>
            </AktionsLeiste>
          </UebersichtKarte>
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
          <div className="grid gap-4 md:grid-cols-2">
            <section aria-labelledby="kasse-abholung" className={cn(KARTE, 'flex min-w-0 flex-col gap-3')}>
              <div>
                <h2 id="kasse-abholung" className={KARTEN_TITEL}>
                  Abholung wählen
                </h2>
                <p className={cn(HINWEIS, 'mt-1 text-[13px]')}>{hofAdresse(farm)}</p>
              </div>
              {kacheln.length === 0 ? (
                <p className="text-[13.5px] text-muted-foreground">
                  Gerade gibt es keine Abholtermine. Frag am besten direkt beim Hof nach.
                </p>
              ) : (
                <AbholWahl kacheln={kacheln} feld={form.register('pickupSlotKey')} fehler={fehlerAm.pickupSlotKey?.message} />
              )}
              {bestellschluss && <p className={HINWEIS}>Bestellschluss für heute: {bestellschluss} Uhr</p>}
            </section>

            <section aria-labelledby="kasse-daten" className={cn(KARTE, 'flex min-w-0 flex-col gap-3')}>
              <h2 id="kasse-daten" className={KARTEN_TITEL}>
                Deine Daten
              </h2>
              <Feld id="customerEmail" label="E-Mail" fehler={fehlerAm.customerEmail?.message}>
                <input
                  id="customerEmail"
                  type="email"
                  {...form.register('customerEmail')}
                  required
                  autoComplete="email"
                  inputMode="email"
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
                <textarea
                  id="customerNote"
                  {...form.register('customerNote')}
                  rows={2}
                  aria-invalid={fehlerAm.customerNote ? true : undefined}
                  aria-describedby={fehlerAm.customerNote ? 'customerNote-fehler' : undefined}
                  placeholder="z. B. Ich komme erst gegen 17:30"
                  className={cn(FELD, 'h-auto min-h-[46px] py-2.5')}
                />
                <FeldZaehler control={form.control} name="customerNote" max={NOTIZ_MAX} />
              </Feld>
            </section>
          </div>

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

          <section aria-labelledby="kasse-bezahlen" className={cn(KARTE, 'flex flex-col gap-2')}>
            <h2 id="kasse-bezahlen" className={KARTEN_TITEL}>
              Bezahlen
            </h2>
            {zahlarten.length === 0 ? (
              <p className="text-[13.5px] text-muted-foreground">
                Bei diesem Hof kannst du gerade nicht bestellen. Frag am besten direkt beim Hof nach.
              </p>
            ) : (
              <ZahlartWahl zahlarten={zahlarten} feld={form.register('paymentMethod')} fehler={fehlerAm.paymentMethod?.message} />
            )}
            {hinweisBar && zahlarten.some((z) => z.wert === 'ONSITE_CASH') && <p className={HINWEIS}>{hinweisBar}</p>}
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

/** „Feldweg 1, 4910 Ried" — die Abholadresse des Hofs. */
function hofAdresse(farm: Pick<PublicFarm, 'address' | 'postalCode' | 'city'>): string {
  return [farm.address, [farm.postalCode, farm.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
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
