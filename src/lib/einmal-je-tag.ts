/**
 * „Einmal je Tag“ über alle Instanzen (Nr. 213.3, herausgezogen aus
 * `erstmalsHeute` in src/lib/umgebung-server.ts und dem Stripe-Webhook,
 * Verhalten gleich): EINE Anweisung auf BetriebMessung legt die Zeile des
 * UTC-Tages für den Schlüssel an (ON CONFLICT DO NOTHING) — nur wer sie
 * anlegt, bekommt true und meldet. Der Schlüssel ist frei; die Aufrufer
 * bauen ihn (`sentry:<zustand>:<deploy>`, `sentry:stripe-schema:<typ>`).
 *
 * Nur die Entscheidung, keine Meldung: Wer true bekommt, meldet selbst.
 * Scheitert die Datenbank, kommt false — lieber eine Meldung zu wenig als
 * ein Wurf in einem Nachlauf. Prisma kommt dynamisch: umgebung-server.ts
 * laden auch Seed und E-Mail-Tests, die keine Datenbank wollen.
 */

/** Der UTC-Tag als JJJJ-MM-TT — wie BetriebMessung zählt. */
export function utcTagVon(jetzt: Date): string {
  return jetzt.toISOString().slice(0, 10)
}

/** true genau für die Anfrage, die heute (UTC) die Zeile für `art` anlegt; sonst und bei jedem Fehler false. */
export async function einmalJeTag(art: string, jetzt: Date): Promise<boolean> {
  try {
    const { prisma } = await import('@/lib/prisma')
    const angelegt = await prisma.$queryRaw<Array<{ art: string }>>`
      INSERT INTO "BetriebMessung" ("tag", "art", "wert", "gemessenAm")
      VALUES (${utcTagVon(jetzt)}::date, ${art}, 1, ${jetzt}::timestamp(3))
      ON CONFLICT ("tag", "art") DO NOTHING
      RETURNING "art"`
    return angelegt.length > 0
  } catch {
    return false
  }
}
