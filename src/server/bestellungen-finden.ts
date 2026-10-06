import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { genauesIlikeMuster } from '@/lib/ilike-muster'
import { bestellSummen } from '@/lib/servicegebuehr'
import { bestaetigungsPfad } from '@/lib/bestell-link'
import {
  BESTELLCODE_GUELTIG_SEKUNDEN,
  BESTELLUNGEN_HOECHSTENS,
  bestellCodeKennung,
  codeWert,
  entscheideCodeVersuch,
  type BestellCodeFehler,
  type ListenBestellung,
} from '@/lib/bestellungen-finden'
import { bestellCodePasst, erzeugeBestellCode, hashBestellCode } from '@/lib/bestellungen-zugang'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'

/*
 * „Bestellungen finden" gegen die Datenbank (Nr. 14). Was ein Code-Versuch
 * bedeutet und wie die Liste aussieht, entscheidet src/lib/bestellungen-finden.ts;
 * hier wird gelesen, gesperrt und geschrieben. Bewusst OHNE Better Auth: Kein
 * Aufruf hier legt einen User oder eine Session an (Beleg:
 * tests/integration/bestellungen-finden.int.test.ts).
 */

/**
 * Legt einen neuen Code für diese Adresse an und gibt ihn zurück (für die
 * Mail). Ein älterer Code derselben Adresse fällt weg — neuer Code, neue 5
 * Versuche, wie `resendStrategy: 'rotate'` bei der Anmeldung. Für jede Adresse
 * dasselbe, ob es Bestellungen gibt oder nicht, ob ein Hof oder eine Kundin
 * dahintersteht: Die Antwort verrät nichts (keine Enumeration).
 */
export async function legeBestellCodeAn(email: string, jetzt: Date = new Date()): Promise<string> {
  const code = erzeugeBestellCode()
  const identifier = bestellCodeKennung(email)
  await prisma.$transaction([
    prisma.verification.deleteMany({ where: { identifier } }),
    prisma.verification.create({
      data: {
        id: randomUUID(),
        identifier,
        value: codeWert(hashBestellCode(email, code), 0),
        expiresAt: new Date(jetzt.getTime() + BESTELLCODE_GUELTIG_SEKUNDEN * 1000),
      },
    }),
  ])
  return code
}

/**
 * Prüft einen Code. Die Zeile wird für die Dauer der Prüfung gesperrt
 * (`SELECT … FOR UPDATE`): Zwei gleichzeitige Versuche laufen nacheinander,
 * jeder Fehlversuch zählt — sonst brächten parallele Anfragen mehr als 5
 * Versuche durch (Lesen, dann blind Schreiben, wie `checkVerificationOTP` des
 * Plugins). Der Zähler steht in der Zeile, also über alle Instanzen (S4).
 */
export async function pruefeBestellCode(
  email: string,
  code: string,
  jetzt: Date = new Date()
): Promise<{ ok: true } | { ok: false; fehler: BestellCodeFehler }> {
  const identifier = bestellCodeKennung(email)
  return prisma.$transaction(async (tx) => {
    const zeilen = await tx.$queryRaw<Array<{ id: string; value: string; expiresAt: Date }>>`
      SELECT id, value, "expiresAt" FROM "Verification"
      WHERE identifier = ${identifier}
      ORDER BY "createdAt" DESC
      LIMIT 1
      FOR UPDATE`
    const zeile = zeilen[0] ?? null
    const entscheidung = entscheideCodeVersuch(
      zeile ? { wert: zeile.value, expiresAt: zeile.expiresAt } : null,
      (hash) => bestellCodePasst(email, code, hash),
      jetzt
    )
    const { schreiben } = entscheidung
    if (zeile && typeof schreiben === 'object') {
      const gespeichert = zeile.value.slice(0, zeile.value.lastIndexOf(':'))
      await tx.verification.update({ where: { id: zeile.id }, data: { value: codeWert(gespeichert, schreiben.versuche) } })
    } else if (schreiben === 'verbrauchen' || schreiben === 'loeschen') {
      await tx.verification.deleteMany({ where: { identifier } })
    }
    return entscheidung.ergebnis === 'ok' ? { ok: true as const } : { ok: false as const, fehler: entscheidung.ergebnis }
  })
}

/**
 * Die Bestellungen der bewiesenen Adresse — nach `customerEmail`, ohne
 * Rücksicht auf Groß-/Kleinschreibung, aber sonst genau (ILIKE ohne
 * Platzhalter, genauesIlikeMuster). NICHT nach `customerId`: Das ist das
 * ruhende Konto aus dem Checkout bis Nr. 17a (Befund Nr. 12; seither bleibt
 * `customerId` null) und sagt nichts darüber, wer
 * die Mails zu einer Bestellung bekommt. Bewiesen ist nur die Adresse.
 *
 * Frist beim Lesen (ARCHITECTURE §5): Offene Bestellungen dieser Adresse
 * werden vorher freigegeben — je Hof über gibVerwaisteFreiOhneRisiko, das
 * Fehler meldet, nie weiterreicht. Verfallene stehen dann als storniert da,
 * nicht als „Bestätigung offen".
 */
export async function ladeBestellungenZurAdresse(email: string, jetzt: Date = new Date()): Promise<ListenBestellung[]> {
  const derAdresse = { customerEmail: { equals: genauesIlikeMuster(email), mode: 'insensitive' as const } }

  const offeneHoefe = await prisma.order.findMany({
    where: { ...derAdresse, status: 'PENDING_CONFIRMATION' },
    select: { farmId: true },
    distinct: ['farmId'],
  })
  for (const { farmId } of offeneHoefe) await gibVerwaisteFreiOhneRisiko(farmId, jetzt)

  const bestellungen = await prisma.order.findMany({
    where: derAdresse,
    orderBy: { createdAt: 'desc' },
    take: BESTELLUNGEN_HOECHSTENS,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      pickupDate: true,
      pickupTimeStart: true,
      pickupTimeEnd: true,
      createdAt: true,
      totalAmount: true,
      serviceFeeCents: true,
      farm: { select: { name: true, slug: true } },
      _count: { select: { items: true } },
    },
  })

  return bestellungen.map((b) => ({
    id: b.id,
    link: bestaetigungsPfad(b.farm.slug, b.id),
    hofName: b.farm.name,
    bestellnummer: b.orderNumber,
    status: b.status,
    paymentMethod: b.paymentMethod,
    paymentStatus: b.paymentStatus,
    pickupDate: b.pickupDate,
    pickupTimeStart: b.pickupTimeStart,
    pickupTimeEnd: b.pickupTimeEnd,
    createdAt: b.createdAt,
    // Eine Quelle für „Warenpreis + Gebühr" (schneidet eine Gebühr unter 0 ab).
    gesamtCents: bestellSummen(b).gesamtCents,
    artikel: b._count.items,
  }))
}
