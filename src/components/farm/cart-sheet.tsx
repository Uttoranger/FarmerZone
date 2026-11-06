'use client'

/** Der Warenkorb der Hofseite als Blatt — am Handy von unten, ab 768 px von rechts (Boards s1-/w1-korb, Nr. 227). */

import { useRef, useState, type ComponentProps } from 'react'
import type { KaufSperreHinweis } from '@/components/hofseite/kauf-sperre-hinweis'
import { usePreisAnzeige } from '@/components/shared/preis-anzeige'
import { mitEndpreis } from '@/lib/plattformgebuehr'
import { Minus, Plus, Trash2, ShoppingBasket } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Sheet, SheetBlatt, SheetKopf } from '@/components/ui/sheet'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { BildPlatzhalter } from '@/components/ui/bild-platzhalter'
import { textlinkKlassen } from '@/components/ui/textlink'
import { cn } from '@/lib/utils'
import { centsAlsEuro, formatEuro, formatGrundpreis } from '@/lib/format'
import { korbBetraege } from '@/lib/hofseite-kunde'
import { RESERVIERUNG_MINUTEN } from '@/lib/kasse'
import { GrundpreisZeile } from '@/components/shared/grundpreis-zeile'
import { FutterVerantwortung } from '@/components/shared/futter-verantwortung'
import { KaufGrund } from '@/components/hofseite/kauf-grund'
import { useBestellstopp } from '@/components/notbremse-band'
import { KORB_LEER, type CartItem, type KorbErgebnis } from '@/lib/use-cart'
import { korbFehlerText } from '@/lib/hofseite-orientierung'
import { SpeicherFehler } from '@/components/shared/formular-meldungen'
import { EmptyState } from '@/components/ui/empty-state'
import { HinweiskarteStatus } from '@/components/checkout/kasse-teile'
import { HOEFE_ENTDECKEN } from '@/lib/fehlerseite'

// Der Titel der Hinweiskarte nach dem Abgleich (Board s1-/w1-korb, Bild 2) — darunter der Satz, was passiert ist.
// Nacharbeit: gehört zu KORB_LEER nach src/lib/use-cart.ts (Grenze von Nr. 227 ohne diese Datei).
export const KORB_GEAENDERT_TITEL = 'Dein Warenkorb hat sich geändert.'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CartItem[]
  total: number
  farmSlug: string
  /** Adresse von „Zur Kasse" — die Produktseite gibt `?kaeufer=betrieb` mit (Nr. 29); sonst die Kasse des Hofs. */
  kasseHref?: string
  /** Das Ergebnis zählt (Register N29): Scheitert die Menge, sagt es das Blatt — am Netz mit „Nochmal“. */
  onUpdateQuantity: (productId: string, qty: number) => Promise<KorbErgebnis>
  onRemoveItem: (productId: string) => void
  /** „zzgl. Servicegebühr" neben der Summe — null, wenn der Hof gerade gebührenfrei ist. */
  gebuehrKorb?: string | null
  /** Verantwortungs-Hinweis, wenn Futter im Korb liegt (futterVerantwortungImKorb, E10a) — nur Anzeige. */
  futterHinweis?: readonly string[]
  /**
   * Die Kaufsperre der Seite mit Hofname und Pausen-Nachricht (kaufSperre, Register N24): Mit Sperre steht
   * statt „Zur Kasse“ der Hinweis mit dem Grund, wie im Mini-Warenkorb. Pflicht, weil das Blatt unter
   * 1024 px der einzige Weg zur Kasse ist — der Mini-Warenkorb steht dort nicht.
   */
  kaufSperre: ComponentProps<typeof KaufSperreHinweis>
  /**
   * Der Satz nach dem Abgleich der Hofseite (Register N28: entfernt, gekürzt, neuer Preis) — oben im Blatt, bis
   * sich der Korb ändert. Die Produktseite gleicht nicht ab und gibt ihn nicht mit.
   */
  hinweis?: string | null
}

/** Der Satz im Blatt, wenn eine Menge scheitert — null, wenn sie stand. */
export type MengeFehler = { text: string; nochmal: boolean }

/**
 * Was das Blatt nach „−“ bzw. „+“ sagt (Register N29, Lücke aus Nr. 235): nichts, wenn die Menge stand; sonst der Satz
 * wie an der Zeile der Hofseite (`korbFehlerText`, nie der rohe Text des Servers) — am Netz der N29-Satz mit „Nochmal“.
 * Die Menge im Blatt bleibt dann, wie sie war (useCart setzt sie erst nach der Zusage des Servers).
 */
export function mengeFehlerNach(ergebnis: KorbErgebnis): MengeFehler | null {
  if (ergebnis.ok) return null
  return { text: korbFehlerText(ergebnis, 'menge'), nochmal: ergebnis.nochmal === true }
}

/**
 * Welche Antwort auf „−“/„+“ noch zählt (Befund pruefer, UI-Runde 3; Register N29 je Position): Tippt man schnell zweimal
 * auf DIESELBE Position, kommen die Antworten des Servers in beliebiger Reihenfolge zurück — die Karte darf nur sagen,
 * was der LETZTE Aufruf dieser Position ergab, sonst stünde „Keine Verbindung“ unter einer Menge, die längst gespeichert
 * ist. Der Zähler läuft je `productId`: Ein Tipp auf B darf die Fehlerkarte von A nicht verschlucken. Entfernen verwirft
 * nur die entfernte Position, Schließen alles, was noch unterwegs ist. Kein Zustand, nur ein Zähler: Ref statt State.
 */
export function neueMengenFolge(): {
  beginnen: (productId: string) => () => boolean
  verwerfen: (productId: string) => void
  alleVerwerfen: () => void
} {
  const zaehler = new Map<string, number>()
  const weiter = (productId: string) => {
    const neu = (zaehler.get(productId) ?? 0) + 1
    zaehler.set(productId, neu)
    return neu
  }
  return {
    // Gibt zurück, ob dieser Aufruf bei seiner Antwort für seine Position noch der letzte ist.
    beginnen(productId) {
      const eigener = weiter(productId)
      return () => zaehler.get(productId) === eigener
    },
    verwerfen(productId) {
      weiter(productId)
    },
    // Alles Unterwegs wird ungültig: Zähler weiterzählen statt löschen, sonst begänne eine Position wieder bei 1.
    alleVerwerfen() {
      for (const id of [...zaehler.keys()]) weiter(id)
    },
  }
}

/**
 * Der Startfokus des Blatts (Board w1-korb, Bild 1–3): auf „Schließen“ im Kopf — dem ersten Bedienelement, auch wenn
 * davor der Hinweis nach dem Abgleich steht. Nach einem Tipp (`touch`) bleibt es bei Base UI: dann bekommt das Blatt
 * selbst den Fokus, ohne sichtbaren Rahmen. Findet sich der Knopf nicht, gilt die Vorgabe (`true`: erstes Element).
 */
export function korbStartfokus(blatt: HTMLElement | null, art: string): HTMLElement | true | null {
  if (art === 'touch') return blatt
  return blatt?.querySelector<HTMLElement>('[data-slot="sheet-close"]') ?? true
}

/** Ein Mengen-Knopf in der Pille: 44 × 44 px, das Zeichen in der Mitte (Board s1-/w1-korb). */
const MENGEN_KNOPF = cn(
  'flex size-11 items-center justify-center rounded-full text-status-fertig transition-colors hover:bg-muted',
  FOKUS_RAHMEN
)

/** Hauptweg und Ausweg über die volle Breite: Radius 14 px, 52 px hoch (DESIGN_SYSTEM „Typografie und Form“). */
const VOLLE_BREITE = cn('flex h-[52px] w-full items-center justify-center rounded-[14px] text-base font-semibold', FOKUS_RAHMEN)

/*
 * Der Warenkorb der Hofseite (Register N41 d, Boards s1-korb, w1-korb; seit Nr. 227): am Handy ein Blatt
 * von unten mit Griff, ab 768 px ein Blatt von rechts über die volle Höhe, höchstens 448 px (`SheetBlatt
 * seite="rechts"`). Oben „Warenkorb · <Hof>“ und genau ein „Schließen“ (`SheetKopf`). Zeilen mit
 * Grundpreis, Menge −/+ in einer Pille, Betrag und Entfernen; unten Gesamt, „Inkl. Plattformgebühr ·
 * Reservierung gilt … Minuten.“ und die eine Hauptaktion „Zur Kasse“ (grün). Mit Kaufsperre oder
 * Notbremse steht dort der Grund (KaufGrund).
 */
export function CartSheet({ open, onOpenChange, items, total, farmSlug, kasseHref, onUpdateQuantity, onRemoveItem, gebuehrKorb = null, futterHinweis = [], kaufSperre, hinweis = null }: Props) {
  // Notbremse (Register N34, Nr. 189): wie eine Kaufsperre — Mengen ruhen, statt
  // „Zur Kasse“ steht der Satz. Die Sperre des Hofs geht vor.
  const stopp = useBestellstopp()
  const ruht = kaufSperre.sperre !== null || stopp !== null
  // Zeilensummen in ganzen Cent auf dem Weg des Checkouts (korbBetraege, wie im Mini-Warenkorb),
  // nie price × Menge in Fließkomma — verbindlich rechnet der Checkout mit den Preisen aus der Datenbank.
  // Im Hofpreis-Modell (N38) Endpreise je Stück — die Summe ist dann genau das Gesamt der Kasse.
  const anzeige = usePreisAnzeige()
  const angezeigt = items.map((i) => mitEndpreis(i, anzeige))
  const { zeilenCents, summeCents } = korbBetraege(angezeigt)
  // Ohne Hofpreis-Modell bleibt die Summe aus dem Korb wie bisher.
  const gesamt = anzeige ? centsAlsEuro(summeCents) : total
  const leer = items.length === 0
  // Die letzte gescheiterte Menge samt Wiederholung (N29) — der nächste Tipp auf „−“/„+“ räumt sie weg, ebenso
  // Entfernen und Schließen (die Karte gehörte zu einer Zeile bzw. einem Blatt, das es so nicht mehr gibt).
  const [mengeFehler, setMengeFehler] = useState<(MengeFehler & { productId: string; wiederholen: () => void }) | null>(null)
  const folge = useRef(neueMengenFolge())
  const blattRef = useRef<HTMLDivElement>(null)
  function mengeSetzen(productId: string, menge: number) {
    // Nur die Karte DIESER Position räumt der Tipp weg; die einer anderen bleibt stehen.
    setMengeFehler((alt) => (alt?.productId === productId ? null : alt))
    const nochLetzter = folge.current.beginnen(productId)
    void onUpdateQuantity(productId, menge).then((ergebnis) => {
      if (!nochLetzter()) return
      const fehler = mengeFehlerNach(ergebnis)
      if (fehler) setMengeFehler({ ...fehler, productId, wiederholen: () => mengeSetzen(productId, menge) })
    })
  }
  function entfernen(productId: string) {
    folge.current.verwerfen(productId)
    setMengeFehler((alt) => (alt?.productId === productId ? null : alt))
    onRemoveItem(productId)
  }
  function offenAendern(offen: boolean) {
    if (!offen) {
      folge.current.alleVerwerfen()
      setMengeFehler(null)
    }
    onOpenChange(offen)
  }
  return (
    <Sheet open={open} onOpenChange={offenAendern}>
      <SheetBlatt seite="rechts" ref={blattRef} initialFocus={(art) => korbStartfokus(blattRef.current, art)}>
        {/* Board s1-/w1-korb (Lauf 31): unter dem Kopf keine eigene Linie — die Zeilen tragen ihre Linie oben,
            so trennt sie auch Hinweis und erste Position; leer steht gar keine. */}
        <SheetKopf
          titel={
            // Leer ohne Hofnamen (Board Bild 3): Ein Korb ohne Ware gehört noch zu keinem Hof.
            leer ? (
              'Warenkorb'
            ) : (
              <span className="break-words">
                Warenkorb · <span title={kaufSperre.hofName}>{kaufSperre.hofName}</span>
              </span>
            )
          }
        />

        {/* Wie korbHinweis in der Kasse, als Status vorgelesen, kein Toast. Board s1-/w1-korb Bild 2 (Lauf 31): Titel und
            Satz in der Schrift des Bedeutungs-Paars „tun“ auf seiner Fläche (≥ 4,5 : 1 in beiden Themes), Radius 16 px. */}
        {hinweis && (
          <HinweiskarteStatus titel={KORB_GEAENDERT_TITEL}>
            <p className="text-[14px] leading-normal">{hinweis}</p>
          </HinweiskarteStatus>
        )}

        {leer ? (
          // Leer mit Weg weiter (Register N9, Nr. 175): zurück zum Angebot schließt das Blatt, sonst zu den Höfen.
          <div className="flex flex-col gap-2">
            <EmptyState
              symbol={ShoppingBasket}
              titel={KORB_LEER.titel}
              satz={KORB_LEER.satz}
              // Board s1-/w1-korb Bild 3 (Runde 2): ein schmaler Kasten, links bündig — Titel fett in der Grundschrift, darunter
              // der Satz —, „Zum Angebot“ über die volle Breite UNTER dem Kasten. Den Kasten zeichnet ::before über die ersten
              // zwei Zeilen des Rasters, der Ausweg steht in der dritten außerhalb. Das Symbol bleibt (Register N9: Symbol,
              // Satz, Aktion), klein links im Kasten. `self-stretch` am Kasten (UI-Runde 3): Das Raster zentriert seine
              // Kinder (`items-center`) — ohne Inhalt fiel der Kasten sonst auf 0 px zusammen und lag als Linie quer durch
              // Symbol und Text.
              className={cn(
                'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0 rounded-none border-0 bg-transparent p-0 text-left',
                "before:col-span-2 before:col-start-1 before:row-span-2 before:row-start-1 before:self-stretch before:rounded-[16px] before:border before:border-border before:bg-card before:content-['']",
                '[&>span]:col-start-1 [&>span]:row-span-2 [&>span]:row-start-1 [&>span]:ml-3.5 [&>span]:size-9 [&>span>svg]:size-5',
                '[&>p:first-of-type]:col-start-2 [&>p:first-of-type]:row-start-1 [&>p:first-of-type]:self-end [&>p:first-of-type]:pt-3 [&>p:first-of-type]:pr-3.5 [&>p:first-of-type]:font-sans [&>p:first-of-type]:text-[15px] [&>p:first-of-type]:font-bold',
                '[&>p:nth-of-type(2)]:col-start-2 [&>p:nth-of-type(2)]:row-start-2 [&>p:nth-of-type(2)]:max-w-none [&>p:nth-of-type(2)]:self-start [&>p:nth-of-type(2)]:pr-3.5 [&>p:nth-of-type(2)]:pb-3 [&>p:nth-of-type(2)]:text-[13.5px]',
                '[&>div]:col-span-2 [&>div]:row-start-3 [&>div]:mt-2.5'
              )}
              ausweg={
                <Link
                  href={`/${farmSlug}`}
                  onClick={() => offenAendern(false)}
                  className={cn(VOLLE_BREITE, 'border-[1.5px] border-foreground bg-card px-4 text-foreground hover:bg-muted')}
                >
                  {KORB_LEER.zumHof}
                </Link>
              }
            />
            <Link href="/hoefe" className={cn(textlinkKlassen({ ton: 'leise' }), 'justify-center self-center px-3 text-foreground')}>
              {HOEFE_ENTDECKEN}
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border border-t border-border">
            {angezeigt.map((item) => (
              <li key={item.productId} className="flex gap-3 py-3.5">
                {/* 48 px: der Browser holt eine kleine Fassung, nicht das Original (bis 2.400 px). Ohne Foto die ruhige Fläche (V15).
                    Radius 12 px fest (Board): `rounded-xl` wären im neuen Design 22 px — bei 48 px fast ein Kreis. */}
                <div className="relative size-12 shrink-0 overflow-hidden rounded-[12px]">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                  ) : (
                    <BildPlatzhalter className="size-12 rounded-[12px]" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[15px] font-semibold break-words text-foreground" title={item.name}>
                    {item.name}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">{formatGrundpreis(item.price, item.unit, item.unitSize)}</p>
                  <GrundpreisZeile price={item.price} unit={item.unit} unitSize={item.unitSize} className="text-[12px] text-muted-foreground" />
                  {/* Mit Kaufsperre lehnt /api/reserve jede neue Menge ab (Nr. 145): Dann steht die Menge nur als
                      Zahl da, Entfernen bleibt — sonst brächte jeder Tipp auf „+“ oder „−“ eine Ablehnung. */}
                  {ruht ? (
                    <p className="mt-1.5 flex h-11 items-center text-[15px] font-semibold tabular-nums" aria-label={`Menge: ${item.quantity}`}>
                      {item.quantity}
                    </p>
                  ) : (
                    // Menge in EINER Pille mit grünem Rand (Board): − Zahl +, jeder Knopf 44 px.
                    <div className="mt-1.5 inline-flex items-center rounded-full border-[1.5px] border-accent bg-card">
                      <button
                        type="button"
                        onClick={() => mengeSetzen(item.productId, item.quantity - 1)}
                        aria-label={`${item.name}: eins weniger`}
                        className={MENGEN_KNOPF}
                      >
                        <Minus className="size-4" strokeWidth={1.7} aria-hidden="true" />
                      </button>
                      <span className="w-8 text-center text-[15px] font-semibold tabular-nums" aria-label={`Menge: ${item.quantity}`}>
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => mengeSetzen(item.productId, item.quantity + 1)}
                        aria-label={`${item.name}: eins mehr`}
                        className={MENGEN_KNOPF}
                      >
                        <Plus className="size-4" strokeWidth={1.7} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Betrag oben, Entfernen darunter auf der Höhe der Menge. */}
                <div className="flex shrink-0 flex-col items-end justify-between">
                  <span className="text-[15px] font-semibold text-foreground tabular-nums">
                    {formatEuro(centsAlsEuro(zeilenCents.get(item.productId) ?? 0))}
                  </span>
                  <button
                    type="button"
                    onClick={() => entfernen(item.productId)}
                    aria-label={`${item.name} aus dem Warenkorb nehmen`}
                    className={cn('-mr-3 flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted', FOKUS_RAHMEN)}
                  >
                    <Trash2 className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Am Ort der Aktion, kein Toast (DESIGN_SYSTEM „Zustände“): die orange Karte mit dem Satz, am Netz „Nochmal“. */}
        {!leer && mengeFehler && (
          <SpeicherFehler text={mengeFehler.text} nochmal={mengeFehler.nochmal} onNochmal={mengeFehler.wiederholen} />
        )}

        {!leer && (
          <div className="flex flex-col gap-3 border-t border-border pt-3.5">
            <div className="flex items-baseline justify-between gap-3 text-foreground">
              <span className="text-base font-semibold">Gesamt</span>
              <span className="text-[22px] font-bold tabular-nums">{formatEuro(gesamt)}</span>
            </div>
            <p className="-mt-2 text-[13px] text-muted-foreground">
              {gebuehrKorb ? `${gebuehrKorb[0].toUpperCase()}${gebuehrKorb.slice(1)} · ` : ''}Reservierung gilt {RESERVIERUNG_MINUTEN} Minuten.
            </p>
            <FutterVerantwortung saetze={futterHinweis} />
            {/* Mit Kaufsperre nimmt die Kasse nichts an — der Grund steht hier, nicht erst dort. */}
            {ruht ? (
              <KaufGrund {...kaufSperre} stopp={stopp} />
            ) : (
              <Link
                href={kasseHref ?? `/${farmSlug}/checkout`}
                onClick={() => offenAendern(false)}
                className={cn(VOLLE_BREITE, 'bg-accent text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90')}
              >
                Zur Kasse
              </Link>
            )}
          </div>
        )}
      </SheetBlatt>
    </Sheet>
  )
}
