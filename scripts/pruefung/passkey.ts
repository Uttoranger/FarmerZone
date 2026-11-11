import { generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto'

/**
 * Der Prüf-Passkey für admin@example.com (freigabe.md §36, „Passkey“).
 *
 * Erlaubt nur in einer lokalen Wegwerf-DB (Register N46, Ergänzung N20); der
 * App-Code bleibt unverändert, die Anmeldung läuft ganz normal über
 * /login/admin mit einem virtuellen Authenticator im Prüf-Browser
 * (passkey-browser.mjs). Diese Datei schreibt nichts — sie baut nur Zeile und
 * Schlüssel; den privaten Schlüssel legt pruef-seed.ts unter .nachtlauf/ ab.
 */

/** Nur diese rpIds: die Herkunft des dev-Fotografen ist http://localhost:3000. */
export const PRUEF_RP_IDS = ['localhost', '127.0.0.1'] as const

type Cbor = number | Uint8Array | Map<number, Cbor>

function cborKopf(art: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(art << 5) | n])
  if (n < 256) return Buffer.from([(art << 5) | 24, n])
  const b = Buffer.alloc(3)
  b[0] = (art << 5) | 25
  b.writeUInt16BE(n, 1)
  return b
}

function cbor(wert: Cbor): Buffer {
  if (typeof wert === 'number') return wert >= 0 ? cborKopf(0, wert) : cborKopf(1, -1 - wert)
  if (wert instanceof Uint8Array) return Buffer.concat([cborKopf(2, wert.length), Buffer.from(wert)])
  const teile = [cborKopf(5, wert.size)]
  for (const [k, v] of wert) teile.push(cbor(k), cbor(v))
  return Buffer.concat(teile)
}

/** COSE_Key EC2 P-256 / ES256 — so, wie @simplewebauthn ihn aus der Registrierung liest. */
export function coseSchluessel(x: Buffer, y: Buffer): Buffer {
  return cbor(
    new Map<number, Cbor>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, x],
      [-3, y],
    ])
  )
}

export type PruefPasskey = {
  /** Die Zeile für model Passkey — Felder wie @better-auth/passkey 1.7.7 sie speichert (seit 1.6.23 unverändert). */
  zeile: {
    id: string
    name: string
    publicKey: string
    userId: string
    credentialID: string
    counter: number
    deviceType: string
    backedUp: boolean
    transports: string
    createdAt: Date
  }
  /** Was der virtuelle Authenticator braucht. Nur nach .nachtlauf/admin-passkey.json. */
  geheim: {
    credentialId: string
    rpId: (typeof PRUEF_RP_IDS)[number]
    userHandle: string
    privateKey: string
    signCount: number
  }
}

export function erzeugePruefPasskey(userId: string, erstelltAm: Date): PruefPasskey {
  const paar = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const jwk = paar.publicKey.export({ format: 'jwk' })
  const x = Buffer.from(String(jwk.x), 'base64url')
  const y = Buffer.from(String(jwk.y), 'base64url')
  const kennung = randomBytes(16).toString('base64url')
  return {
    zeile: {
      id: randomUUID(),
      name: 'Prüf-Passkey',
      // Das Plugin speichert base64 der COSE-Daten und liest sie mit base64.decode.
      publicKey: coseSchluessel(x, y).toString('base64'),
      userId,
      credentialID: kennung,
      counter: 0,
      deviceType: 'singleDevice',
      backedUp: false,
      transports: 'internal',
      createdAt: erstelltAm,
    },
    geheim: {
      credentialId: kennung,
      rpId: 'localhost',
      userHandle: Buffer.from(userId, 'utf8').toString('base64'),
      privateKey: (paar.privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer).toString('base64'),
      signCount: 0,
    },
  }
}
