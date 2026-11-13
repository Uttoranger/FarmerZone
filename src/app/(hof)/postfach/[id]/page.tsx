import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmForUser } from '@/server/queries/dashboard'
import { ladeFadenHof } from '@/server/queries/postfach'
import { ANTWORT_NICHT_MOEGLICH, POSTFACH_TEXT, fadenEintraege, istNeuFuer, neuesteDerAnderenSeite, rundschreibenVomText } from '@/lib/postfach'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { Textlink } from '@/components/ui/textlink'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'
import { MARKE } from '@/lib/marke'
import { FADEN_ENDE_ID } from '@/lib/postfach-rollen'
import { FadenVerlauf, POSTFACH_RAHMEN, TeamZeichen } from '../teile'
import { AntwortFormular } from './antwort-formular'
import { FadenNachladen } from './faden-nachladen'

export const metadata: Metadata = { title: `${POSTFACH_TEXT.titel} — ${MARKE}`, robots: { index: false } }

export const dynamic = 'force-dynamic'

/*
 * Ein Faden im Postfach des Hofs (Register N12, Nachtlauf Nr. 87; Mockup
 * mobil-h6-unterhaltung): die Nachricht vom Team, die Antworten, darunter das
 * Feld „Antwort an das Team …". Nur ein Faden dieses Hofs — eine fremde
 * Kennung ist 404, wie eine unbekannte (ladeFadenHof mit farmId).
 *
 * Abweichend vom Mockup steht der Rückweg im Unterseiten-Kopf (Register N1,
 * „‹ Postfach") und darunter der Titel des Rundschreibens als h1 mit Absender
 * und Datum — der Kopf des Mockups (Zeichen, Absender, Datum) braucht eine h1.
 *
 * Öffnen setzt den Lesestand (FadenNachladen, nach dem Rendern über die
 * Action); der offene Faden lädt alle 60 s nach (router.refresh, kein
 * Polling-Endpunkt).
 *
 * „Antwort möglich" aus (Register N14, Nr. 95; Mockups web-/mobil-h6-
 * unterhaltung, Zustand ohne Antwortfeld): statt des Felds der Hinweis mit
 * „Problem melden" als Link — antworteAlsHof lehnt dann ohnehin ab. Ein Faden
 * ohne Rundschreiben (Gründungs-Nachricht) bleibt beantwortbar.
 */
export default async function FadenPage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()
  const farm = await getFarmForUser(userId)
  if (!farm) redirect('/onboarding')

  // URL-Parameter mit Zod (CODING_STANDARDS §3): keine cuid, kein Faden — wie ?faden= im Admin.
  const id = z.cuid().safeParse((await params).id)
  if (!id.success) notFound()
  const faden = await ladeFadenHof(farm.id, id.data)
  if (!faden) notFound()

  const jetzt = new Date()
  const eintraege = fadenEintraege(faden.nachrichten, 'HOF', faden.gelesenBisAndere, jetzt)
  const neueste = neuesteDerAnderenSeite(faden.nachrichten, 'HOF')
  const fuss = faden.rundschreiben
    ? [faden.rundschreiben.wichtig ? POSTFACH_TEXT.wichtig : null, faden.rundschreiben.perMail ? POSTFACH_TEXT.auchPerMail : null]
        .filter((teil) => teil !== null)
        .join(' · ') || null
    : null

  return (
    <div className={POSTFACH_RAHMEN}>
      {/* Werkzeug-Kopf (G1, Board s2-/w2-postfach Bild 2): „Nachricht“ mit „Postfach“ darunter; im Web „‹ Postfach“. */}
      <WerkzeugKopf titel="Nachricht" unterzeile={<p className="text-[13px] text-muted-foreground md:hidden">{POSTFACH_TEXT.titel}</p>} />
      <header className="mb-5 flex items-start gap-3">
        <TeamZeichen />
        <div className="min-w-0">
          <h2 className="font-heading text-[22px] leading-tight font-semibold break-words text-foreground md:text-[28px]">
            {faden.titel ?? POSTFACH_TEXT.ohneTitel}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {POSTFACH_TEXT.absender}
            {faden.rundschreiben && ` · ${rundschreibenVomText(faden.rundschreiben.gesendetAm, jetzt)}`}
          </p>
        </div>
      </header>

      <FadenVerlauf eintraege={eintraege} seite="HOF" fussErste={fuss} nameAndereSeite={POSTFACH_TEXT.absender} />
      {/* Ziel des Rollens nach dem Senden (Nr. 308): Der Rand ist so hoch wie Antwortfeld plus Unterleiste (am Computer nur das Feld), damit die neue Nachricht darüber endet. */}
      <div id={FADEN_ENDE_ID} aria-hidden="true" className="scroll-mb-[calc(280px+env(safe-area-inset-bottom))] md:scroll-mb-[220px]" />

      {faden.rundschreiben && !faden.rundschreiben.antwortMoeglich ? (
        // Grau gefüllt, Link unterstrichen ohne Anführungszeichen (Liste Lauf 32 postfach).
        <p className={cn('mt-5 bg-muted px-4 py-3.5 text-[14px] leading-relaxed text-foreground', RUNDUNG.hinweis)}>
          {ANTWORT_NICHT_MOEGLICH.satz}{' '}
          <Textlink href={ANTWORT_NICHT_MOEGLICH.href} form="im-satz">
            {ANTWORT_NICHT_MOEGLICH.link}
          </Textlink>
          .
        </p>
      ) : (
        <AntwortFormular unterhaltungId={faden.id} />
      )}
      <FadenNachladen
        unterhaltungId={faden.id}
        nachrichtId={neueste?.id ?? null}
        ungelesen={neueste !== null && istNeuFuer('HOF', neueste, faden.gelesenBisEigene)}
      />
    </div>
  )
}
