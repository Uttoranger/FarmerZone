import type { Metadata } from 'next'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { PenLine } from 'lucide-react'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ladeErstattungAufgaben, zaehleOffenImEingang, zaehleRundschreibenImMonat } from '@/server/queries/postfach'
import {
  ADMIN_POSTFACH_TEXT,
  EINGANG_TEXT,
  adminPostfachAdresse,
  alteReiterAdresse,
  offenGesamt,
  postfachKennzahlen,
  postfachUnterreiter,
  type AdminPostfachReiter,
  type EingangZahlen,
} from '@/lib/postfach'
import type { KennzahlDaten } from '@/lib/admin-seiten'
import { adminPostfachReiterAus, eingangAuswahlAus, eingangFilterAus, fadenKennungAus } from '@/schemas/postfach'
import { meldungenAnsichtAus } from '@/schemas/meldung'
import { cn } from '@/lib/utils'
import { MARKE } from '@/lib/marke'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { ADMIN_RAHMEN, AdminFehler } from '@/components/admin/admin-teile'
import { Seitenkopf } from '@/components/admin/seitenkopf'
import { Unterreiter } from '@/components/admin/unterreiter'
import { LadeInhalt, LadeRahmen } from '@/components/ui/lade-punkt'
import { EingangReiter, ladeEingangReiter, type EingangDaten } from './eingang-reiter'
import { MeldungenReiter, ladeMeldungenReiter, type MeldungenDaten } from './meldungen-reiter'
import { RundschreibenReiter, ladeRundschreibenReiter, type RundschreibenDaten } from './rundschreiben-reiter'
import { ZustellungReiter, ladeZustellungDaten, type ZustellungDaten } from './zustellung-reiter'

export const metadata: Metadata = { title: `${ADMIN_POSTFACH_TEXT.titel} — Admin — ${MARKE}` }
export const dynamic = 'force-dynamic'

type Suche = {
  reiter?: string | string[]
  art?: string | string[]
  id?: string | string[]
  meldung?: string | string[]
  faden?: string | string[]
  // Reiter „Meldungen" (Nr. 101) — gelesen von meldungenAnsichtAus (Zod mit Standard).
  ansicht?: string | string[]
  von?: string | string[]
  auf?: string | string[]
  teil?: string | string[]
  aeltere?: string | string[]
  buendel?: string | string[]
  stand?: string | string[]
}

/** Next liefert einen doppelten Parameter als Liste — dann zählt der erste. */
function einzeln(wert: string | string[] | undefined): string | undefined {
  return Array.isArray(wert) ? wert[0] : wert
}

type ReiterDaten =
  | { reiter: 'eingang'; daten: EingangDaten }
  | { reiter: 'meldungen'; daten: MeldungenDaten }
  | { reiter: 'rundschreiben'; daten: RundschreibenDaten }
  | { reiter: 'zustellung'; daten: ZustellungDaten }

/** Lädt nur den offenen Reiter; ein Datenbankfehler wirft. */
async function ladeReiter(reiter: AdminPostfachReiter, roh: Suche, jetzt: Date): Promise<ReiterDaten> {
  if (reiter === 'eingang') return { reiter, daten: await ladeEingangReiter(eingangFilterAus(roh.art), eingangAuswahlAus(roh.id, roh.meldung), jetzt) }
  if (reiter === 'meldungen') return { reiter, daten: await ladeMeldungenReiter(meldungenAnsichtAus(roh)) }
  if (reiter === 'rundschreiben') return { reiter, daten: await ladeRundschreibenReiter() }
  return { reiter, daten: await ladeZustellungDaten(jetzt) }
}

/*
 * /admin/postfach — der eine Ort, an dem beim Admin alles ankommt (Register
 * N12 mit der Änderung vom 15.10., N14, N15; Nachtlauf Nr. 95; Mockups
 * admin-postfach*, admin-rundschreiben). Seit Nr. 105 (N14-Ergänzung, Mockup
 * admin-postfach-ruhig) steht auf allen vier Reitern dasselbe oben: der
 * Seitenkopf mit EINEM Satz und „Rundschreiben schreiben", sofort darunter die
 * Unterreiter Eingang · Meldungen · Rundschreiben · Zustellung (?reiter=, Zod
 * mit Standard) — sie bewegen sich beim Wechsel nicht. Erst dann der Inhalt
 * des Reiters; die Kennzahlen gehören zum Eingang und stehen dort oben.
 * Kein Ladebild beim Wechsel: Es gibt keine loading.tsx in diesem Segment
 * (sie hing an den Suchparametern und zeigte bei jedem Klick das Skelett des
 * Eingangs); der bisherige Inhalt bleibt stehen, der gewählte Reiter bzw.
 * Filter zeigt den kleinen Kreis, der Inhalt trägt aria-busy (LadeRahmen).
 * Betreten aus einem anderen Admin-Reiter trägt /admin/loading.tsx.
 * Der Reiter „Unterhaltungen" von Stufe 1 leitet dauerhaft in den Eingang
 * (Filter Antwort). Erste Anweisung ist die Admin-Prüfung. Lassen sich die
 * Zahlen nicht laden, geht es ohne Zahl und Kennzahlen weiter; lässt sich der
 * Reiter nicht laden, steht AdminFehler da — mit EINER h1 („Postfach").
 */
export default async function AdminPostfachPage({ searchParams }: { searchParams: Promise<Suche> }): Promise<React.JSX.Element> {
  await verlangeAdminSeite()

  const roh = await searchParams
  const alt = alteReiterAdresse(einzeln(roh.reiter), fadenKennungAus(roh.faden))
  if (alt) permanentRedirect(alt)
  const reiter = adminPostfachReiterAus(roh.reiter)
  const jetzt = new Date()

  // Die Zahl am Unterreiter „Eingang" braucht jeder Reiter, die Kennzahlen nur der Eingang.
  let zahlen: EingangZahlen | null = null
  let kennzahlen: KennzahlDaten[] | null = null
  try {
    if (reiter === 'eingang') {
      const [offen, erstattungen, rundschreibenImMonat] = await Promise.all([zaehleOffenImEingang(), ladeErstattungAufgaben(), zaehleRundschreibenImMonat(jetzt)])
      zahlen = offen
      kennzahlen = postfachKennzahlen({ zahlen: offen, erstattungen, rundschreibenImMonat })
    } else {
      zahlen = await zaehleOffenImEingang()
    }
  } catch (err) {
    // Ohne Zahlen geht es weiter — der Reiter lädt seinen Inhalt selbst.
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: 'postfach' } })
  }

  let geladen: ReiterDaten | null = null
  try {
    geladen = await ladeReiter(reiter, roh, jetzt)
  } catch (err) {
    // Nur Bereich und Reiter — nie ein Nachrichten- oder Meldungstext.
    Sentry.captureException(err, { tags: { bereich: 'admin', seite: `postfach-${reiter}` } })
  }
  if (!geladen) {
    return (
      <div className={ADMIN_RAHMEN}>
        <AdminFehler titel={ADMIN_POSTFACH_TEXT.titel} satz={ADMIN_POSTFACH_TEXT.ladeFehler[reiter]} nochmal={adminPostfachAdresse(reiter)} />
      </div>
    )
  }

  return (
    <div className={cn(ADMIN_RAHMEN, 'flex flex-col gap-4 md:gap-5')}>
      <LadeRahmen>
        <Seitenkopf
          titel={ADMIN_POSTFACH_TEXT.titel}
          satz={ADMIN_POSTFACH_TEXT.satz}
          rechts={
            <Link
              href={adminPostfachAdresse('rundschreiben')}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-[18px] text-sm font-semibold whitespace-nowrap text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
                FOKUS_RAHMEN
              )}
            >
              <PenLine className="size-4" strokeWidth={2} aria-hidden="true" />
              {EINGANG_TEXT.hauptaktion}
            </Link>
          }
        />
        <Unterreiter beschriftung={EINGANG_TEXT.unterreiterBeschriftung} eintraege={postfachUnterreiter(zahlen ? offenGesamt(zahlen) : null)} aktiv={reiter} ladePunkt />
        <LadeInhalt>
          {geladen.reiter === 'eingang' && <EingangReiter daten={geladen.daten} kennzahlen={kennzahlen} jetzt={jetzt} />}
          {geladen.reiter === 'meldungen' && <MeldungenReiter daten={geladen.daten} jetzt={jetzt} />}
          {geladen.reiter === 'rundschreiben' && <RundschreibenReiter daten={geladen.daten} jetzt={jetzt} />}
          {geladen.reiter === 'zustellung' && <ZustellungReiter daten={geladen.daten} />}
        </LadeInhalt>
      </LadeRahmen>
    </div>
  )
}
