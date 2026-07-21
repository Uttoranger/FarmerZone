// Gemeinsamer Ladezustand der (farmer)-Gruppe (Tempo-Pass 1): schlichtes
// Skeleton im Warm-Harvest-Stil. Nav/Sidebar stehen durch das Layout —
// beim Tab-Wechsel zeigt nur der Inhalt den Ladezustand.
export default function FarmerLoading() {
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto animate-pulse" aria-busy="true">
      {/* PageHeader-Balken */}
      <div className="h-7 w-44 rounded-lg mb-2" style={{ background: '#E9E4D8' }} />
      <div className="h-4 w-60 rounded mb-6" style={{ background: '#F0EDE5' }} />

      {/* Karten-Platzhalter */}
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-border bg-white p-4 mb-3">
          <div className="h-4 w-36 rounded mb-3" style={{ background: '#F0EDE5' }} />
          <div className="h-3 w-full rounded mb-2" style={{ background: '#F4EFE3' }} />
          <div className="h-3 w-2/3 rounded" style={{ background: '#F4EFE3' }} />
        </div>
      ))}
    </div>
  )
}
