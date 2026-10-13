## VORSCHLAG Lauf 12 (Canvas, 12.10.2026)

| Datei | Bildschirm | Route im Code | Arbeit | Größe |
|---|---|---|---|---|
| `web-k3-kasse-glatt.html` | K3 · Kasse geglättet: vier flache Karten (Korb → Abholung → Deine Daten → Bezahlen), Online bleibt vorbelegt, Erklärung je Option, Gebühr „entfällt“ bei Bar | `/[farmSlug]/checkout` | Umbau (Kasse glätten) | 1440×1000 |
| `mobil-k3-kasse-glatt.html` | K3 · Kasse geglättet am Handy, feste Leiste mit Kaufknopf | `/[farmSlug]/checkout` | Umbau (Kasse glätten) | 390×1820 |
| `system-k3-kasse-bezahlen-bar.html` | Komponente – Zustand „Bar gewählt“: Gebühr „entfällt“, Knopf „Zahlungspflichtig bestellen“, kein Stripe-Satz | `/[farmSlug]/checkout` | Umbau (Kasse glätten) | 1000×420 |

Ersetzt in der Kasse die Anordnung aus `web-k3-kasse-angaben-zum-hof.html` / `mobil-k3-kasse-angaben-zum-hof.html` (Angaben zum Hof bleiben unverändert über dem Kaufknopf).
