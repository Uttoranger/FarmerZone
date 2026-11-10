import type { Metadata } from 'next'
import Link from 'next/link'
import { ABO_TEXT } from '@/lib/abo-bestaetigung'
import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { aboTokenSchema } from '@/schemas/abo'
import { ladeAboBestaetigung } from '@/server/abo-anmeldung'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
import { AboBestaetigenKarte } from '@/components/abo-bestaetigung/bestaetigen-karte'
import { ZU_HOF_LINK } from '@/components/abo-bestaetigung/stil'
import { MARKE } from '@/lib/marke'
import { KNOPF_UMRISS, TEXTLINK } from '@/components/anmelden/stil'

export const metadata: Metadata = {
  title: `${ABO_TEXT.seitenTitel} — ${MARKE}`,
  // Der Link trägt einen gültigen Token (next.config.ts setzt dazu no-referrer).
  robots: { index: false, follow: false },
}

// Liest den Stand des Abos bei jedem Aufruf — nie zwischenspeichern.
export const dynamic = 'force-dynamic'

const TITEL = 'font-heading text-[24px] leading-tight font-semibold'
const SATZ = 'text-[15px] leading-normal break-words text-muted-foreground [overflow-wrap:anywhere]'

/** Die erste Zeile des Fehlerkastens je Fall; darunter steht der Ausweg (Board s2-neuigkeiten, Bild 4: „Er gilt 7 Tage.“). */
function fehlerZeile(grund: 'ungueltig' | 'abgelaufen' | 'ueberholt' | 'abo_weg'): string {
  if (grund === 'abgelaufen') return ABO_TEXT.gueltigkeit
  return ABO_TEXT[grund]
}

/**
 * „Anmeldung bestätigen" — Double-Opt-in für Neuigkeiten eines Hofes
 * (Register S11, Nachtlauf Nr. 38). Kein Mockup — gebaut nach DESIGN_SYSTEM.md
 * in der Fokus-Shell wie /verify. Der Aufruf (GET) liest nur; bestätigt wird
 * mit dem Knopf (Server Action, POST), weil Link-Scanner der Mailprogramme
 * Links ungefragt öffnen. Fälle: offen (Knopf), schon bestätigt, abgelaufen,
 * ungültig, überholt (ausgeschaltet, abgemeldet, neuerer Link), Abo gelöscht —
 * alle außer den ersten beiden mit Ausweg. Texte aus ABO_TEXT.
 */
export default async function NeuigkeitenBestaetigenPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<React.JSX.Element> {
  const { token: roh } = await searchParams
  const token = aboTokenSchema.safeParse(roh)
  const stand = token.success ? await ladeAboBestaetigung(token.data, new Date()) : ({ zustand: 'ungueltig' } as const)

  let inhalt: React.ReactNode
  if (stand.zustand === 'offen') {
    // „offen" gibt es nur mit gültigem Token — token.success ist hier immer wahr.
    inhalt = <AboBestaetigenKarte token={token.success ? token.data : ''} hofName={stand.hofName} hofSlug={stand.hofSlug} />
  } else if (stand.zustand === 'bestaetigt') {
    inhalt = (
      <section aria-labelledby="abo-titel" className="flex flex-col gap-3">
        <h2 id="abo-titel" className={TITEL}>
          {ABO_TEXT.schonTitel}
        </h2>
        <p className={SATZ}>
          {ABO_TEXT.schonSatz[0]} <strong className="font-semibold text-foreground">{stand.hofName}</strong> {ABO_TEXT.schonSatz[1]}
        </p>
        {/* „Zu <Hof>“ als Textlink, nicht als Knopf (Wortliste N42 c, Board s2-neuigkeiten Bild 3; Abnahme Lauf 32, Nr. 279). */}
        <Link href={`/${stand.hofSlug}`} className={ZU_HOF_LINK}>
          Zu {stand.hofName}
        </Link>
      </section>
    )
  } else {
    // Board s2-neuigkeiten, Bild 4: Überschrift frei auf der Seite, darunter der Fehlerkasten mit der Zeile zum Fall
    // und dem Ausweg, dann „Mein Konto“ als Umriss und „Höfe entdecken“ als Textlink.
    const grund = stand.zustand
    inhalt = (
      <section aria-labelledby="abo-titel" className="flex flex-col gap-3">
        <h2 id="abo-titel" className={TITEL}>
          {grund === 'abgelaufen' ? ABO_TEXT.abgelaufenTitel : ABO_TEXT.fehlerTitel}
        </h2>
        <HinweiskarteFehler titel={fehlerZeile(grund)}>{grund === 'abo_weg' ? undefined : ABO_TEXT.ausweg}</HinweiskarteFehler>
        <Link href="/account/profile" className={KNOPF_UMRISS}>
          Mein Konto
        </Link>
        <Link href="/hoefe" className={TEXTLINK}>
          Höfe entdecken
        </Link>
      </section>
    )
  }

  return (
    <KundeFokusShell titel={ABO_TEXT.seitenTitel} zurueck={{ href: '/', label: 'Zur Startseite' }}>
      {/* Ohne Karte direkt auf der Seite, Inhalt höchstens 520 px; im Web 16 px unter dem Kopf (Board s2-/w2-neuigkeiten;
          Liste Lauf 32, neuigkeiten „Spalte schmaler, Überschrift tiefer“, Nr. 254). */}
      <div className="mx-auto w-full max-w-[552px] px-4 pt-5 pb-12 md:pt-4">{inhalt}</div>
    </KundeFokusShell>
  )
}
