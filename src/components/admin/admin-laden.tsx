/*
 * Ladeansichten des Betreiber-Bereichs (/admin und Unterseiten) — Nachtlauf
 * Nr. 31. Die Admin-Seiten haben kein gemeinsames Layout und bringen ihr
 * `<main>` selbst mit; die Ladeansicht ersetzt die Seite und trägt es deshalb
 * auch. Gleiche Maße wie die fertigen Seiten (px-4 py-8, max-w-4xl bzw. 3xl);
 * nur, was sicher kommt. Farbstaffelung: bg-border für Überschriften,
 * bg-muted für Zweitzeilen und Flächen.
 *
 * Gezeigt wird sie erst, NACHDEM src/app/admin/layout.tsx das Recht geprüft
 * hat — wer keines hat, bekommt die 404 bzw. die Anmeldung wie bisher und nie
 * dieses Skelett.
 */

type Ansicht = 'hoefe' | 'finanzen' | 'meldungen' | 'meldung'

function Rahmen({ breit, children }: { breit: boolean; children: React.ReactNode }): React.JSX.Element {
  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className={`mx-auto animate-pulse ${breit ? 'max-w-4xl' : 'max-w-3xl'}`} aria-busy="true">
        {children}
      </div>
    </main>
  )
}

/** „← Admin" bzw. „← Meldungen": ein kurzer Textlink. */
function Zurueck(): React.JSX.Element {
  return <div className="h-5 w-20 rounded bg-muted" />
}

function Karte({ zeilen = 2 }: { zeilen?: number }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="h-4 w-40 rounded bg-border" />
      {Array.from({ length: zeilen }, (_, i) => (
        <div key={i} className={`mt-2 h-3 rounded bg-muted ${i === zeilen - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  )
}

export function AdminLaden({ ansicht }: { ansicht: Ansicht }): React.JSX.Element {
  if (ansicht === 'hoefe') {
    return (
      <Rahmen breit>
        {/* Briefkasten und Finanzen: zwei Zeilen-Links */}
        <div className="mb-5 h-11 rounded-xl border border-border bg-card" />
        <div className="mb-5 h-11 rounded-xl border border-border bg-card" />
        <div className="mb-1 h-7 w-20 rounded bg-border" />
        <div className="mb-1 h-4 w-64 max-w-full rounded bg-muted" />
        <div className="mb-5 h-4 w-52 rounded bg-muted" />
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="h-5 w-44 rounded bg-border" />
                  <div className="mt-1.5 h-3 w-28 rounded bg-muted" />
                </div>
                <div className="h-6 w-24 rounded-full bg-muted" />
              </div>
              {/* Kennung, Inhaber, Bestätigung, Registrierung */}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="h-3.5 w-3/4 rounded bg-muted" />
                ))}
              </div>
              <div className="mt-4 h-3 w-56 rounded bg-muted" />
              {/* Servicegebühr des Hofs */}
              <div className="mt-3 h-[84px] rounded-xl bg-muted" />
              <div className="mt-3 h-7 w-32 rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </Rahmen>
    )
  }

  if (ansicht === 'finanzen') {
    return (
      <Rahmen breit>
        <Zurueck />
        <div className="mt-3 mb-4 h-7 w-28 rounded bg-border" />
        {/* Monatswahl */}
        <div className="mb-5 h-[54px] rounded-xl border border-border bg-card" />
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card px-3 py-3">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="mt-2 h-6 w-24 rounded bg-border" />
              <div className="mt-2 h-3 w-16 rounded bg-muted" />
            </div>
          ))}
        </div>
        {/* „Wann trägt sich die Plattform?" und der Verlauf je Monat */}
        <div className="mb-5 h-44 rounded-2xl bg-muted" />
        <div className="mb-5 h-[280px] rounded-xl border border-border bg-card" />
        <Karte zeilen={3} />
      </Rahmen>
    )
  }

  if (ansicht === 'meldungen') {
    return (
      <Rahmen breit>
        <Zurueck />
        <div className="mt-2 h-7 w-32 rounded bg-border" />
        <div className="mt-1 mb-4 h-4 w-72 max-w-full rounded bg-muted" />
        {/* Reiter Meldungen | Wünsche */}
        <div className="mb-4 flex gap-2 border-b border-border">
          {[0, 1].map((i) => (
            <div key={i} className="flex min-h-10 items-center px-3">
              <div className="h-4 w-20 rounded bg-muted" />
            </div>
          ))}
        </div>
        {/* Filter nach Status und Art — stehen im Reiter Meldungen immer da */}
        <div className="mb-2 flex flex-wrap gap-1.5">
          {[26, 16, 12, 17, 32, 18, 18, 22, 20, 12].map((breite, i) => (
            <div key={i} className="h-9 rounded-full bg-muted" style={{ width: `${breite * 4}px` }} />
          ))}
        </div>
        <div className="mb-5 flex flex-wrap gap-1.5">
          {[20, 16, 18, 16].map((breite, i) => (
            <div key={i} className="h-9 rounded-full bg-muted" style={{ width: `${breite * 4}px` }} />
          ))}
        </div>
        <div className="mb-3 h-3 w-64 max-w-full rounded bg-muted" />
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Karte key={i} />
          ))}
        </div>
      </Rahmen>
    )
  }

  return (
    <Rahmen breit={false}>
      <Zurueck />
      <div className="mt-2 flex items-center gap-2">
        <div className="h-7 w-24 rounded bg-border" />
        <div className="h-4 w-14 rounded bg-muted" />
        <div className="h-6 w-20 rounded-full bg-muted" />
      </div>
      <div className="mt-1 h-3 w-48 rounded bg-muted" />
      {/* Meldung, Kontext, Triage-Formular */}
      <div className="mt-5">
        <Karte zeilen={1} />
      </div>
      <div className="mt-4">
        <Karte zeilen={4} />
      </div>
      <div className="mt-4 h-[500px] rounded-xl border border-border bg-card" />
    </Rahmen>
  )
}
