import { prisma } from '@/lib/prisma'
import { kostenSummeImMonat, utcDatumAlsMonat } from '@/lib/finanzen'
import { monatsschluesselInWien } from '@/lib/servicegebuehr'
import { ohneTestzahlungenWhere } from '@/lib/testzahlung'
import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'
import { servicegebuehrDerWoche, type WochenlageZahlen } from '@/lib/wochenlage'
import type { Prisma } from '@prisma/client'

/** Decimal → Cent über die Decimal-Methode, nie über `Number(x) * 100` (CODING_STANDARDS, Geld). */
function centsAusDecimal(betrag: Prisma.Decimal): number {
  return Math.round(betrag.mul(100).toNumber())
}

const WOCHE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Lädt die Zahlen der letzten 7 Tage frisch. Die Bestellungen kommen nur mit
 * den Feldern, die die Geld-Regel liest (kein Name, keine Adresse). Testhöfe
 * zählen nicht (N21), Testzahlungen nicht (Z4), stornierte Bestellungen nicht.
 * „Überfällig" sind die Meldungen, die länger als 14 Tage offen liegen
 * (`liegenGeblieben`, dieselbe Zählung wie im Wochenlauf).
 */
export async function ladeWochenlage(jetzt: Date, offen: number, ueberfaellig: number): Promise<WochenlageZahlen> {
  const von = new Date(jetzt.getTime() - WOCHE_MS)
  const ohneStorno: Prisma.OrderWhereInput = {
    createdAt: { gte: von, lt: jetzt },
    farm: { istTesthof: false },
    status: { not: 'CANCELLED' },
    ...ohneTestzahlungenWhere(STRIPE_LIVE_AB),
  }
  const [summe, zeilen, neueHoefe, fehler, posten] = await Promise.all([
    prisma.order.aggregate({ where: ohneStorno, _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.order.findMany({
      where: { createdAt: { gte: von, lt: jetzt }, farm: { istTesthof: false } },
      select: { createdAt: true, status: true, paymentMethod: true, paymentStatus: true, serviceFeeCents: true, serviceFeeRefundedAt: true },
    }),
    prisma.farm.count({ where: { createdAt: { gte: von, lt: jetzt }, istTesthof: false } }),
    prisma.meldung.count({ where: { art: 'FEHLER', createdAt: { gte: von, lt: jetzt } } }),
    prisma.kostenposten.findMany({ select: { betrag: true, rhythmus: true, ab: true, bis: true } }),
  ])
  const gebuehr = servicegebuehrDerWoche(
    zeilen.map((b) => ({ ...b, provisionCents: 0 })),
    STRIPE_LIVE_AB
  )
  const monat = monatsschluesselInWien(jetzt)
  const kosten = kostenSummeImMonat(
    posten.map((p) => ({ betragCents: centsAusDecimal(p.betrag), rhythmus: p.rhythmus, ab: utcDatumAlsMonat(p.ab), bis: p.bis === null ? null : utcDatumAlsMonat(p.bis) })),
    monat
  )
  return {
    bestellungen: summe._count._all,
    umsatzCents: summe._sum.totalAmount === null ? 0 : centsAusDecimal(summe._sum.totalAmount),
    servicegebuehrCents: gebuehr.gezaehltCents,
    servicegebuehrErwartetCents: gebuehr.erwartetCents,
    neueHoefe,
    offen,
    ueberfaellig,
    fehler,
    kostenMonatCents: kosten.cents,
  }
}
