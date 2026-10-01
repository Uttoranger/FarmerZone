import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import Link from 'next/link'
import {
  ChevronRight,
  Clock,
  Megaphone,
  PackageX,
  Printer,
  Tags,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getHeute } from '@/server/queries/heute'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { Card, CardContent } from '@/components/ui/card'
import { ErsteSchritteKarte } from '@/components/farmer/erste-schritte-karte'
import { ErsteSchritteSchalter } from '@/components/farmer/erste-schritte-schalter'
import { Schild } from '@/components/farmer/schild'
import type { SchildFarbe } from '@/lib/mein-hof'
import { ERSTE_SCHRITTE_AUS_COOKIE, ersteSchritteAnzeige, ersteSchritteAusgeblendet } from '@/lib/erste-schritte'
import {
  ABHOL_CHIP_TEXT,
  begruessung,
  datumLang,
  naechsteAbholungText,
  vergleichText,
  type AbholChip,
  type BrauchtDichEintrag,
} from '@/lib/heute'
import { formatEuro } from '@/lib/format'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { cn } from '@/lib/utils'

/*
 * Heute — der Startbildschirm des Hofs. Drei Fragen, in dieser Reihenfolge:
 * Wer kommt heute? Was braucht mich? Wie läuft die Woche?
 * Die Regeln stehen rein in src/lib/heute.ts, die Abfragen in
 * src/server/queries/heute.ts; hier wird nur angezeigt. Anlegen läuft über
 * das Plus der Navigation, deshalb gibt es keinen eigenen Knopf mehr.
 */

/** Welche Schildfarbe ein Abholchip trägt — die Klassen hält components/farmer/schild.tsx. */
const CHIP_FARBE: Record<AbholChip, SchildFarbe> = {
  bereit: 'gruen',
  vorbereiten: 'bernstein',
  wartet: 'grau',
}

const BRAUCHT_DICH_SYMBOL: Record<BrauchtDichEintrag['art'], LucideIcon> = {
  ueberfaellig: Clock,
  ausverkauft: PackageX,
  'ohne-kategorie': Tags,
  status: Megaphone,
}

function Abschnitt({
  titel,
  aktion,
  children,
}: {
  titel: string
  aktion?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mb-6" aria-label={titel}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-app-ink">{titel}</h2>
        {aktion}
      </div>
      {children}
    </section>
  )
}

const ZEILE = 'flex items-center gap-3 px-4 py-3 min-h-[56px] transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 outline-none'

export default async function HeutePage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  // Frist gilt beim Lesen: Verwaiste Bestellungen geben ihre Ware frei, bevor
  // die Seite Bestand und Bestellungen zeigt (src/lib/fristen.ts). Fehler nur gemeldet.
  await gibVerwaisteFreiOhneRisiko(farm.id)

  // Ein Zeitpunkt für die ganze Seite: Gruß, Datum, Tag und Woche passen zusammen.
  const jetzt = new Date()
  const { abholungen, naechsteAbholung, brauchtDich, woche, ersteSchritte, wartetAufFreigabe } = await getHeute(
    farm.id,
    jetzt
  )

  // Der Cookie entscheidet auf dem Server, ob die Karte oder die Zeile
  // „Erste Schritte einblenden" kommt — so blitzt nichts auf und nichts rutscht nach.
  const cookieJar = await cookies()
  const ersteSchritteZeigen = ersteSchritteAnzeige(
    ersteSchritte,
    ersteSchritteAusgeblendet(cookieJar.get(ERSTE_SCHRITTE_AUS_COOKIE)?.value, farm.id)
  )

  const vorname = session.user.name?.trim().split(/\s+/)[0] ?? ''
  const Trend = woche.prozent !== null && woche.prozent < 0 ? TrendingDown : TrendingUp

  return (
    <div className="px-4 py-8 max-w-2xl mx-auto">
      {/* Kopf: Gruß und Datum in Wiener Zeit */}
      <div className="mb-6">
        <p className="text-sm text-app-ink-faint">
          {vorname ? `${begruessung(jetzt)}, ${vorname}` : begruessung(jetzt)}
        </p>
        <h1 className="font-heading text-[27px] font-semibold text-app-ink mt-0.5">Heute</h1>
        <p className="text-app-ink-soft text-sm mt-0.5">{datumLang(jetzt)}</p>
      </div>

      {/* Für einen frisch registrierten Hof das Wichtigste — sie rendert sich
          selbst weg, sobald alles erledigt ist; weggeklickt kommt sie über die
          Zeile ganz unten zurück. */}
      {ersteSchritteZeigen === 'karte' && (
        <ErsteSchritteKarte ergebnis={ersteSchritte} wartetAufFreigabe={wartetAufFreigabe} />
      )}

      {/* ── Heute abholen ─────────────────────────────────────────────── */}
      <Abschnitt
        titel="Heute abholen"
        aktion={
          <Link href="/orders" className="shrink-0 text-sm font-semibold hover:underline underline-offset-2" style={{ color: 'var(--brand-text)' }}>
            Alle →
          </Link>
        }
      >
        <Card className="py-0 gap-0 overflow-hidden">
          {abholungen.length === 0 ? (
            <p className="px-4 py-4 text-sm text-app-ink-soft">Heute holt niemand etwas ab.</p>
          ) : (
            <ul className="divide-y divide-border">
              {abholungen.map((a) => (
                <li key={a.id}>
                  <Link href={`/orders/${a.id}`} className={ZEILE}>
                    <div className="min-w-0 flex-1">
                      {/* Eine Zeile wie die Positionen darunter — ein langer
                          Name (bis 80 Zeichen) bricht sonst über mehrere
                          Zeilen; der volle Name steht im title. */}
                      <p className="truncate text-sm text-app-ink" title={a.kunde}>
                        <span className="font-semibold tabular-nums">{a.uhrzeit}</span>
                        <span className="text-app-ink-soft"> · </span>
                        <span className="font-medium">{a.kunde}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-app-ink-soft">
                        {a.positionen} · {a.zahlart}
                      </p>
                    </div>
                    <Schild farbe={CHIP_FARBE[a.chip]} className="shrink-0">
                      {ABHOL_CHIP_TEXT[a.chip]}
                    </Schild>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {abholungen.length > 0 && (
            <Link
              href="/orders/today/print"
              className={cn(ZEILE, 'border-t border-border text-sm font-medium text-app-ink print:hidden')}
            >
              <Printer className="size-4 shrink-0 text-app-ink-soft" strokeWidth={1.7} aria-hidden="true" />
              <span className="flex-1">Packliste drucken</span>
              <ChevronRight className="size-4 shrink-0 text-app-ink-soft" aria-hidden="true" />
            </Link>
          )}
          {/* Der nächste Abholtag mit offenen Bestellungen — „Morgen", „Mittwoch"
              oder „Mittwoch, 14. Oktober"; ohne einen solchen Tag entfällt die Zeile. */}
          {naechsteAbholung && (
            <Link
              href="/orders"
              className="flex items-center gap-3 border-t border-border bg-muted/30 px-4 py-2.5 text-[13px] text-app-ink-soft transition-colors hover:bg-muted/60 outline-none focus-visible:bg-muted/60"
            >
              <span className="flex-1">{naechsteAbholungText(naechsteAbholung)} →</span>
            </Link>
          )}
        </Card>
      </Abschnitt>

      {/* ── Braucht dich ──────────────────────────────────────────────── */}
      <Abschnitt titel="Braucht dich">
        <Card className="py-0 gap-0 overflow-hidden">
          {brauchtDich.length === 0 ? (
            <p className="px-4 py-4 text-sm text-app-ink-soft">Alles erledigt.</p>
          ) : (
            <ul className="divide-y divide-border">
              {brauchtDich.map((eintrag) => {
                const Symbol = BRAUCHT_DICH_SYMBOL[eintrag.art]
                return (
                  <li key={`${eintrag.art}-${eintrag.href}-${eintrag.text}`}>
                    <Link href={eintrag.href} className={ZEILE}>
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-[10px]"
                        style={{ background: 'var(--notice)', color: 'var(--notice-ink)' }}
                      >
                        <Symbol className="size-4" strokeWidth={1.7} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm text-app-ink">{eintrag.text}</span>
                      <ChevronRight className="size-4 shrink-0 text-app-ink-soft" aria-hidden="true" />
                    </Link>
                    {eintrag.unterpunkte && eintrag.unterpunkte.length > 0 && (
                      <ul className="pb-2 pl-16 pr-4">
                        {eintrag.unterpunkte.map((u) => (
                          <li key={`${u.href}-${u.text}`}>
                            <Link
                              href={u.href}
                              className="flex min-h-[40px] items-center gap-2 rounded-lg px-2 text-[13px] text-app-ink-soft transition-colors hover:bg-muted/50 hover:text-app-ink outline-none focus-visible:bg-muted/50"
                            >
                              <span className="flex-1">{u.text}</span>
                              <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </Abschnitt>

      {/* ── Diese Woche ───────────────────────────────────────────────── */}
      <Abschnitt
        titel="Diese Woche"
        aktion={
          <Link href="/analytics" className="shrink-0 text-sm font-semibold hover:underline underline-offset-2" style={{ color: 'var(--brand-text)' }}>
            Auswertung →
          </Link>
        }
      >
        <Card>
          <CardContent className="py-1">
            <p className="text-[13px] text-app-ink-soft">Umsatz seit Montag</p>
            <p className="font-heading text-[32px] font-bold tabular-nums text-app-ink mt-1 leading-tight">
              {formatEuro(centsAlsEuro(woche.dieseWocheCent))}
            </p>
            <p
              className={cn(
                'mt-1 flex items-center gap-1.5 text-[13px] font-medium',
                woche.prozent === null || woche.prozent === 0
                  ? 'text-app-ink-soft'
                  : woche.prozent > 0
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-destructive'
              )}
            >
              {woche.prozent !== null && woche.prozent !== 0 && (
                <Trend className="size-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              )}
              {vergleichText(woche.prozent, jetzt)}
            </p>
          </CardContent>
        </Card>
      </Abschnitt>

      {ersteSchritteZeigen === 'zeile' && (
        <p className="mt-2 text-center">
          <ErsteSchritteSchalter richtung="ein" className="px-3" />
        </p>
      )}
    </div>
  )
}
