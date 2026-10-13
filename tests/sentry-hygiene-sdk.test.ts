/**
 * Nr. 64: ohneAnfrage mit einem echten SDK-Client — bis Lauf 9 nur an einem
 * Ersatz-Ereignis geprüft. Der Client ist gebaut wie in src/instrumentation.ts
 * (sendDefaultPii aus, beforeSend und beforeSendTransaction bereinigeEreignis)
 * und nimmt die Anfrage wie im Betrieb aus dem Isolation-Scope:
 * requestDataIntegration liest dort normalizedRequest und ipAddress. Gemeldet
 * wird wie in meldeFehleranzeige (src/server/oeffentlich-lesen.ts) — mit
 * ohneAnfrage als Event-Prozessor im captureContext.
 *
 * Kein Netz: Der Transport zeichnet die Umschläge nur auf, der DSN ist
 * erfunden. Geprüft wird, was hinausginge — der ganze Umschlag als Text.
 */
import { describe, it, expect } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { bereinigeEreignis, ohneAnfrage } from '@/lib/sentry-hygiene'

const SUCHTEXT = 'Musterhof-Bio-Eier'
const SUCHE_IM_REFERER = 'Kundin-Vorname'
const IP = '203.0.113.7'
const MELDUNG = 'Öffentliche Hofliste: Fehleranzeige ausgeliefert'

/** Meldet über einen echten NodeClient und gibt alle aufgezeichneten Umschläge als Text zurück. */
async function meldeUeberClient(mitOhneAnfrage: boolean): Promise<string> {
  const umschlaege: string[] = []
  const client = new Sentry.NodeClient({
    dsn: 'https://oeffentlich@sentry.example/1',
    integrations: [Sentry.requestDataIntegration()],
    stackParser: Sentry.defaultStackParser,
    transport: (optionen) =>
      Sentry.createTransport(optionen, async (anfrage) => {
        umschlaege.push(typeof anfrage.body === 'string' ? anfrage.body : new TextDecoder().decode(anfrage.body))
        return { statusCode: 200 }
      }),
    sendDefaultPii: false,
    beforeSend: bereinigeEreignis,
    beforeSendTransaction: bereinigeEreignis,
  })
  client.init()
  Sentry.withIsolationScope((isolationScope) => {
    isolationScope.setSDKProcessingMetadata({
      normalizedRequest: {
        method: 'GET',
        url: `https://agrilo.at/hoefe?q=${SUCHTEXT}`,
        query_string: `q=${SUCHTEXT}`,
        headers: {
          host: 'agrilo.at',
          referer: `https://agrilo.at/hoefe?q=${SUCHE_IM_REFERER}`,
          'x-forwarded-for': IP,
          'user-agent': 'Vitest',
        },
      },
      ipAddress: IP,
    })
    Sentry.withScope((scope) => {
      scope.setClient(client)
      Sentry.captureMessage(MELDUNG, (kontext) => {
        kontext.setLevel('warning').setTags({ bereich: 'hofliste', sichtbar: 'ja' })
        return mitOhneAnfrage ? kontext.addEventProcessor(ohneAnfrage) : kontext
      })
    })
  })
  await client.close(2_000)
  return umschlaege.join('\n')
}

describe('Nr. 64 — ohneAnfrage am echten SDK-Client (Fehleranzeige auf /hoefe)', () => {
  it('Gegenprobe: ohne ohneAnfrage hängt der Client Adresse und Referer an, und der Suchtext bleibt nach bereinigeEreignis stehen', async () => {
    const umschlag = await meldeUeberClient(false)
    expect(umschlag).toContain(MELDUNG)
    expect(umschlag).toContain(SUCHTEXT)
    expect(umschlag).toContain(SUCHE_IM_REFERER)
  })

  it('mit ohneAnfrage geht die Meldung hinaus — ohne Suchtext, ohne Referer, ohne IP-Adresse und ohne Anfrage', async () => {
    const umschlag = await meldeUeberClient(true)
    expect(umschlag).toContain(MELDUNG)
    expect(umschlag).toContain('"sichtbar":"ja"')
    for (const heikel of [SUCHTEXT, SUCHE_IM_REFERER, IP, '"request"', 'referer', 'x-forwarded-for']) {
      expect(umschlag, heikel).not.toContain(heikel)
    }
  })
})
