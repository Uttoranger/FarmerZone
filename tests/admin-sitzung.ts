import { vi } from 'vitest'

/*
 * Attrappen für Tests, die Admin-Aktionen durch die ECHTE Admin-Wache
 * schicken (src/server/admin-wache.ts) und dafür auth und prisma mocken.
 * Seit Nr. 115 (Register N20) liest die Wache nach dem Recht auch die
 * Anmeldezeit der Sitzung (12 Stunden), die letzte Bestätigung mit Passkey
 * (frische Bestätigung, 5 Minuten) und die Pflicht „erst Passkey". Wer nur
 * die Aktion selbst prüft, braucht einen Admin, der all das erfüllt — hier an
 * EINER Stelle, damit nicht jede Datei die Wache nachbaut. Die Regeln selbst
 * prüfen tests/admin-anmeldung.test.ts, tests/admin-wache.test.ts und
 * tests/integration/admin-passkey.int.test.ts.
 */

/**
 * Eine Sitzung, frisch angemeldet und frisch mit Passkey bestätigt — „jetzt"
 * als Getter, damit es auch unter einer gestellten Uhr (vi.setSystemTime nach
 * dem Anlegen) jetzt bleibt.
 */
export function adminSitzung(userId: string, user: Record<string, unknown> = {}): unknown {
  return {
    user: { id: userId, ...user },
    session: {
      id: `sitzung-${userId}`,
      get createdAt(): Date {
        return new Date()
      },
      get passkeyAm(): Date {
        return new Date()
      },
    },
  }
}

/** Was die Wache für die Pflicht liest: ein Passkey, kein Ersatzcode benutzt — in die prisma-Attrappe spreizen. */
export function passkeyAttrappen(): {
  passkey: { aggregate: ReturnType<typeof vi.fn> }
  adminErsatzcode: { aggregate: ReturnType<typeof vi.fn> }
} {
  return {
    passkey: { aggregate: vi.fn(async () => ({ _count: { _all: 1 }, _max: { createdAt: new Date(0) } })) },
    adminErsatzcode: { aggregate: vi.fn(async () => ({ _max: { benutztAm: null } })) },
  }
}
