/*
 * FarmerZone Service Worker — AUSSCHLIESSLICH das Teilen-Ziel (Web Share
 * Target). Mehr nicht, und das ist eine bewusste Grenze:
 *
 * Dieser Service Worker cached NIEMALS App-Assets oder Seiten und fängt
 * keine Navigation ab. Die Stale-Client-Falle — Nutzer hängen nach einem
 * Deployment auf einem alten Stand fest — ist dokumentierte Projektgeschichte
 * und darf hier nicht wieder eingebaut werden. Behandelt wird ein einziges
 * Ereignis: der POST auf /teilen, den Android absetzt, wenn ein Foto an die
 * installierte App geteilt wird. Die Dateien wandern in die Cache-Ablage,
 * dann geht es per 303 auf die /teilen-Seite. JEDES andere fetch-Ereignis
 * läuft ohne respondWith am Service Worker vorbei, als gäbe es ihn nicht.
 * Caching, Offline oder Push wären jeweils ein eigener, bewusst zu
 * entscheidender Sprint.
 *
 * Cache-Name, Schlüsselschema und Namens-Kopfzeile spiegeln
 * src/lib/teilen-ablage.ts — diese Datei liegt ungebündelt in public/ und
 * kann nichts importieren. Änderungen NUR im Doppel;
 * tests/teilen-ablage.test.ts fährt diesen Quelltext gegen die Lese-Seite.
 */

const TEILEN_CACHE = 'geteilte-fotos'
const FOTO_NAME_HEADER = 'x-foto-name'

self.addEventListener('install', () => {
  // Sofort übernehmen: Dieser Service Worker hält keinen Zustand, auf den
  // ein alter Stand warten müsste.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'POST' || url.pathname !== '/teilen') {
    // Kein respondWith: Anfrage läuft unangefasst zum Netz.
    return
  }

  event.respondWith(
    (async () => {
      const formular = await event.request.formData()
      // 'foto' ist der Feldname aus dem Manifest (share_target.params.files)
      const dateien = formular.getAll('foto').filter((eintrag) => typeof eintrag !== 'string')

      // Reste einer früheren Teilen-Aktion zuerst weg — sonst stünden hinter
      // einem einzelnen neuen Foto noch alte unter höheren Schlüsseln.
      await caches.delete(TEILEN_CACHE)
      const ablage = await caches.open(TEILEN_CACHE)
      await Promise.all(
        dateien.map((datei, i) =>
          ablage.put(
            `/geteilte-fotos/${i}`,
            new Response(datei, {
              headers: {
                'content-type': datei.type || 'application/octet-stream',
                // Kopfzeilen sind Latin-1 — Umlaute im Namen deshalb kodiert
                [FOTO_NAME_HEADER]: encodeURIComponent(datei.name || ''),
              },
            })
          )
        )
      )

      // Kein Response.redirect(): Das verlangt eine absolute URL und damit
      // Wissen über die Umgebung — der nackte 303 mit Location tut dasselbe.
      return new Response(null, { status: 303, headers: { location: '/teilen' } })
    })()
  )
})
