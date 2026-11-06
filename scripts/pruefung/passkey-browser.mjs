#!/usr/bin/env node
/**
 * Virtueller Authenticator für den Prüf-Browser (freigabe.md §36,
 * „Virtueller Authenticator“). Node mit eingebautem WebSocket, kein Paket.
 *
 *   node scripts/pruefung/passkey-browser.mjs --port <devtools-port> [--passkey .nachtlauf/admin-passkey.json] [--url-teil localhost:3000] [--zaehler <n>]
 *
 * `--zaehler`: Startwert des Signaturzählers. Nach einer Anmeldung steht der
 * Zähler in der DB höher; ein neuer Authenticator mit 0 würde als Kopie
 * abgewiesen (Zähler darf nicht sinken). Für eine zweite Browser-Sitzung
 * deshalb einen Wert über allen bisherigen Anmeldungen angeben.
 *
 * Verbindet sich mit dem DevTools-Port der Prüf-Instanz (nur 127.0.0.1), hängt
 * sich an die Seite, deren Adresse `--url-teil` enthält (keine solche Seite:
 * Abbruch), und ruft
 * WebAuthn.enable, WebAuthn.addVirtualAuthenticator (ctap2, internal,
 * residentKey, Nutzerprüfung) und WebAuthn.addCredential mit dem Schlüssel aus
 * dem Prüf-Seed. Bleibt verbunden, bis es beendet wird — der Authenticator
 * lebt nur so lange wie die DevTools-Sitzung. Danach meldet man sich ganz
 * normal auf /login/admin mit „Mit Passkey anmelden“ an.
 *
 * Sperre zuerst: sperre-cli.ts --db mit der Umgebung des Aufrufs (dieselbe
 * Prüf-DB wie der dev-Fotograf). Gibt keine Schlüssel aus.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const RP_IDS = ['localhost', '127.0.0.1']

function abbruch(grund) {
  console.error(`passkey-browser: ${grund}`)
  process.exit(1)
}

const args = process.argv.slice(2)
const wert = (name, vorgabe) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : vorgabe
}
const port = wert('--port', '')
const passkeyDatei = wert('--passkey', join(WT, '.nachtlauf', 'admin-passkey.json'))
const urlTeil = wert('--url-teil', 'localhost:3000')
const zaehler = wert('--zaehler', '0')

// 1. Sperre — vor allem anderen.
const sperre = spawnSync(join(WT, 'node_modules', '.bin', 'tsx'), [join(WT, 'scripts', 'pruefung', 'sperre-cli.ts'), '--db', '--ordner', WT], {
  stdio: 'inherit',
  env: process.env,
})
if (sperre.status !== 0) abbruch('Sperre hat abgebrochen.')
if (!/^\d+$/.test(port)) abbruch('--port <devtools-port> fehlt.')
if (!/^\d+$/.test(zaehler)) abbruch('--zaehler <zahl>.')

const geheim = JSON.parse(readFileSync(passkeyDatei, 'utf8'))
if (!RP_IDS.includes(geheim.rpId)) abbruch('rpId nur localhost oder 127.0.0.1.')

// 2. Die Seite finden — nur über 127.0.0.1.
const ziele = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
// Nur die Seite mit `--url-teil` — nie irgendeine: Ein Authenticator an einer
// fremden Seite gäbe den Prüf-Schlüssel einer anderen Herkunft.
const seite = ziele.find((z) => z.type === 'page' && String(z.url).includes(urlTeil))
if (!seite) abbruch(`keine Seite mit „${urlTeil}“ im Prüf-Browser — erst /login/admin öffnen.`)
const wsUrl = new URL(seite.webSocketDebuggerUrl)
if (wsUrl.hostname !== '127.0.0.1' && wsUrl.hostname !== 'localhost') abbruch('DevTools nur auf 127.0.0.1.')

// 3. Verbinden und den Authenticator anlegen.
const ws = new WebSocket(wsUrl)
let naechste = 1
const offen = new Map()
function sende(method, params = {}) {
  const id = naechste++
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((ok, fehler) => offen.set(id, { ok, fehler, method }))
}
ws.addEventListener('message', (ereignis) => {
  const nachricht = JSON.parse(String(ereignis.data))
  const warten = nachricht.id ? offen.get(nachricht.id) : undefined
  if (!warten) return
  offen.delete(nachricht.id)
  if (nachricht.error) warten.fehler(new Error(`${warten.method}: ${nachricht.error.message}`))
  else warten.ok(nachricht.result)
})
ws.addEventListener('close', () => {
  console.log('passkey-browser: DevTools-Verbindung beendet.')
  process.exit(0)
})
await new Promise((ok, fehler) => {
  ws.addEventListener('open', ok, { once: true })
  ws.addEventListener('error', () => fehler(new Error('DevTools nicht erreichbar')), { once: true })
})

try {
  await sende('WebAuthn.enable', { enableUI: false })
  const { authenticatorId } = await sende('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
  await sende('WebAuthn.addCredential', {
    authenticatorId,
    credential: {
      // CDP erwartet Binärfelder als Standard-base64.
      credentialId: Buffer.from(geheim.credentialId, 'base64url').toString('base64'),
      isResidentCredential: true,
      rpId: geheim.rpId,
      userHandle: geheim.userHandle,
      privateKey: geheim.privateKey,
      signCount: Math.max(geheim.signCount, Number(zaehler)),
    },
  })
  console.log(`passkey-browser: Authenticator bereit (Seite ${new URL(seite.url).host}). Beenden mit Strg+C.`)
} catch (fehler) {
  abbruch(fehler instanceof Error ? fehler.message : 'unbekannter Fehler')
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    ws.close()
    process.exit(0)
  })
}
