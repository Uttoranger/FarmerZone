import { prisma } from '@/lib/prisma'

/*
 * Lässt das Anlegen von Mail-Aufträgen in der Test-Datenbank scheitern
 * (Nr. 168): eine Trigger-Funktion mit festem Namen auf INSERT in
 * "MailAuftrag". NUR im Test angelegt und mit DROP … IF EXISTS wieder
 * entfernt (beforeAll und finally) — nie in einer Migration. Die Sperre der
 * Integrationsschicht (setup/sicherheitssperre.ts) lässt nur eine lokale
 * Test-Datenbank zu.
 *
 *  - 'immer': jedes INSERT scheitert — in der Transaktion UND beim Nachholen.
 *  - 'einmal': nur das erste INSERT nach dem Setzen scheitert (Zähler über
 *    eine Sequenz, die ein ROLLBACK nicht zurücksetzt) — das Nachholen nach
 *    dem Commit gelingt.
 */

const FUNKTION = 'fz_test_mail_auftrag_sperre'
const TRIGGER = 'fz_test_mail_auftrag_sperre_trg'
const ZAEHLER = 'fz_test_mail_auftrag_sperre_zaehler'

export async function sperreMailAuftraege(modus: 'immer' | 'einmal'): Promise<void> {
  await gibMailAuftraegeFrei()
  await prisma.$executeRawUnsafe(`CREATE SEQUENCE ${ZAEHLER}`)
  const bedingung = modus === 'immer' ? 'TRUE' : `nextval('${ZAEHLER}') = 1`
  await prisma.$executeRawUnsafe(`
    CREATE FUNCTION ${FUNKTION}() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF ${bedingung} THEN
        RAISE EXCEPTION 'Testsperre: kein Mail-Auftrag';
      END IF;
      RETURN NEW;
    END
    $$`)
  await prisma.$executeRawUnsafe(`CREATE TRIGGER ${TRIGGER} BEFORE INSERT ON "MailAuftrag" FOR EACH ROW EXECUTE FUNCTION ${FUNKTION}()`)
}

export async function gibMailAuftraegeFrei(): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${TRIGGER} ON "MailAuftrag"`)
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${FUNKTION}()`)
  await prisma.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS ${ZAEHLER}`)
}
