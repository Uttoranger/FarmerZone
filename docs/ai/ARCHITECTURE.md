# ARCHITECTURE

---

## 1. Schichten

```
UI            src/app/**/page.tsx, src/components/**
                 ↓ ruft auf, kennt keine DB
DOMAIN        src/lib/<fachregel>.ts        ← rein, ohne I/O, direkt testbar
SERVERGRENZE  src/server/actions/**  src/server/queries/**  src/app/api/**
                 ↓ einzige Schicht mit DB-Zugriff
DATEN         Prisma über @/lib/prisma
```

**Die eine Regel, aus der alle anderen folgen:** Fachliche Entscheidungen gehören in eine reine Funktion in `src/lib/`, die ohne Datenbank testbar ist. Die Servergrenze beschafft Daten, ruft die Entscheidung auf, schreibt das Ergebnis.

Vorbild: `src/lib/reservierung.ts` entscheidet (rein, 174 Tests ohne DB), `src/server/warenkorb.ts` wendet an, `src/app/api/checkout/route.ts` schreibt.

### Verboten
- **Keine** Prisma-Aufrufe in `src/components/**`.
- **Keine** Prisma-Aufrufe in `src/lib/<fachregel>.ts` (Ausnahmen: `prisma.ts`, `auth.ts` selbst).
- **Keine** Geschäftsentscheidung in einer React-Komponente (Rabatt, Frist, Verfügbarkeit, Preis).
- **Keine** Geschäftsentscheidung in einem API-Route-Handler. Handler = Eingang, Validierung, Aufruf, Antwort.
- **Kein** direkter Aufruf einer Server Action aus einer anderen Server Action, wenn die gemeinsame Logik in `lib/` gehört.

---

## 2. Ordner — was gehört wohin

| Ordner | Inhalt | Nie hier |
|---|---|---|
| `src/app/(public)/` | Öffentliche Seiten: Hofseiten, Hofübersicht, Checkout, Rechtstexte | Auth-pflichtige Seiten |
| `src/app/(farmer)/` | Bauern-Bereich, auth-pflichtig | Öffentliches |
| `src/app/(auth)/` | Login, Registrierung, Passwort | Anderes |
| `src/app/admin/` | Betreiber-Ansicht, Rolle ADMIN | Bauern-Funktionen |
| `src/app/api/` | Nur wo eine Server Action nicht reicht (s. Abschnitt 3) | Alles, was Action sein kann |
| `src/components/<bereich>/` | Bereichsspezifische Komponenten | Fachregeln, DB |
| `src/components/ui/` | Generische Bausteine (shadcn-Stil) | Domänenwissen, Texte wie "Hof" |
| `src/lib/` | Reine Fachregeln **und** Infrastrukturkapseln | Prisma-Aufrufe in Fachregeln |
| `src/server/queries/` | Lesen aus der DB | Schreiben |
| `src/server/actions/` | Schreiben, `'use server'` | Reine Fachlogik |
| `src/schemas/` | Zod-Schemas, geteilt Client/Server | Serverseitige Importe (läuft auch im Browser) |
| `src/emails/` | React-Email-Templates | Versandlogik (→ `lib/email.ts`) |
| `tests/` | Alle Tests, flach | — |

### `src/lib/` ist voll — Regel beim Hinzufügen
57 Dateien, gemischter Zweck. Bevor eine neue entsteht:
1. Passt es in eine bestehende Datei? Dann dorthin.
2. Ist es eine **Fachregel**? → eigene Datei, rein, ohne Import von `prisma`/`auth`/`stripe`.
3. Ist es eine **Infrastrukturkapsel** (externer Dienst)? → `server-only` importieren.
4. Ist es ein **React-Hook**? → Präfix `use-` (`use-cart.ts`).

---

## 3. Server Action oder API-Route?

**Standard ist die Server Action.** API-Route nur bei einem dieser Gründe:

| Grund | Beispiel |
|---|---|
| Externer Aufrufer | Stripe-Webhook, Vercel Cron |
| Aufruf per Link (GET) | Bestätigungslink aus E-Mail |
| Aufruf aus `fetch()` im Browser mit eigener Fehlerbehandlung | `/api/reserve`, `/api/checkout` |
| Nicht-JSON-Antwort | Export, Datei |

Sonst: Server Action. **Keine** API-Route bauen, nur weil das Muster vertraut ist.

### Pflichten jeder API-Route
1. Rate-Limit (`enforceRateLimit`) bei allem, was schreibt oder Bestand hält.
2. Zod-Validierung des Bodys **und** der URL-Parameter.
3. Auth- bzw. Token-Prüfung, **fail-closed**: fehlt das Geheimnis, wird gesperrt, nicht geöffnet.
4. Antwortform nach `CODING_STANDARDS.md`.
5. Langsames über `nachDerAntwort()`.

### Pflichten jeder Server Action
1. `'use server'` als erste Zeile.
2. Auth prüfen — **nie** der Eingabe vertrauen, wer der Aufrufer ist.
3. **Besitz prüfen:** Gehört der Datensatz zum Hof des eingeloggten Nutzers? Jedes Mal.
4. Zod-Validierung des Arguments.
5. `revalidatePath()` für jede betroffene Route.

---

## 4. Datenfluss

### Lesen
```
Server Component → src/server/queries/*  → Prisma → Props → Komponente
```
- Standard ist die Server Component.
- `'use client'` nur bei Interaktivität (State, Event-Handler, Browser-API).
- `'use client'` so tief wie möglich im Baum — nie ein ganzes Layout zur Client-Komponente machen.
- Serialisierbarkeit beachten: `Decimal` und `Date` nicht roh in Client-Komponenten reichen (→ `CODING_STANDARDS.md`).

### Schreiben
```
Client-Komponente → Server Action → Zod → Fachregel (lib) → Prisma → revalidatePath
```

### State-Regeln
| Art | Wo | Nicht |
|---|---|---|
| Server-Daten | Server Component, per Props | Nicht in Client-State spiegeln |
| Formular | `react-hook-form` | Kein `useState` je Feld |
| UI-lokal (offen/zu) | `useState` | Nicht global |
| Warenkorb | `use-cart.ts` (localStorage) + serverseitige Reservierung | Warenkorb ist **nie** die Wahrheit über Verfügbarkeit |
| Filter/Suche in URL | `useSearchParams` + `router.replace` | Nicht nur im State — Ergebnisse müssen teilbar sein |
| Theme | `next-themes`, `ThemeProvider` in `src/app/layout.tsx` (`attribute="class"`, `defaultTheme="system"`) | Kein eigener Provider, keine Spalte in der Datenbank — die Wahl gehört dem Gerät |

**Kein globaler Store.** Wenn etwas global wirkt, gehört es meist in die URL oder auf den Server.

---

## 5. Domänen-Invarianten

Diese Regeln sind fachlich, nicht technisch. Verletzung kostet Geld oder Vertrauen.

- **Reservierung bucht keinen Bestand ab.** `Product.stock` sinkt erst beim Kauf. `StockReservation` ist ein weicher Halt, der die Menge nur vor **anderen** Sitzungen verbirgt. Verfällt er, gibt es nichts zurückzubuchen.
- **Die 15-Minuten-Frist gilt beim Lesen.** Jede Abfrage fremder Halte filtert auf `expiresAt > jetzt`. Nie einem Cron vertrauen.
- **Bestandsabzug ist bedingt.** `updateMany` mit `stock >= Menge`; bei Teilfehlschlag die bereits gebuchten Positionen gutschreiben.
- **Checkout ist idempotent.** `Order.idempotencyKey` ist unique. Zweiter Request mit gleichem Schlüssel gibt die bestehende Bestellung zurück.
- **Eine Bestellung überlebt einen gescheiterten Mailversand.** Immer.
- **Jede Abfrage im Bauern-Bereich ist auf den eigenen Hof begrenzt.** Es gibt keine hofübergreifende Sicht außer im Admin.
- **Archivierte, pausierte und nicht freigegebene Höfe** sind öffentlich unsichtbar. Bei jeder neuen öffentlichen Abfrage mitprüfen.

### Taxonomie (Kategorien, Unterkategorien, Siegel)

`src/lib/taxonomie.ts` ist die **einzige** Quelle für Werte und Labels. Kein zweites Label-Verzeichnis, kein Hof-Sonderfall anderswo. Anzeige nur über `formatKategorie` in `format.ts`.

- **Jede Unterkategorie (L2) gehört zu genau einer Kategorie (L1).** `gehoertZu(l1, l2)` entscheidet; das Zod-Schema lehnt jede andere Kombination ab. Fisch, Brot, Getränke, Brennholz, Sonstiges haben keine L2. Keine dritte Ebene, keine Freitext-Kategorien.
- **Eine fehlende L2 ist kein Fehler.** Bestandsprodukte dürfen ohne bleiben; das Formular zeigt nur einen Hinweis. Einzige Ausnahme: Futtermittel.
- **Siegel sind orthogonal zur Kategorie.** `labels` ist eine Menge (BIO, GENTECHNIKFREI, AMA_GUETESIEGEL), mehrere je Produkt, keines Pflicht, keines doppelt. `isOrganic` ist Altlast: wird nur noch gelesen, nie mehr geschrieben; Bio ist `labels` enthält BIO.
- **Futter-Kennzeichnung nur bei FUTTERMITTEL.** Dort Pflicht (Unterkategorie, Tierarten, Zusammensetzung, analytische Bestandteile, Bestätigung), bei jeder anderen Kategorie verboten. Ein Kategoriewechsel weg von Futtermittel löscht sie in derselben Transaktion wie das Produkt-Update.

---

## 6. Bekannte Altlasten

Nicht nachahmen. Beim Anfassen der Datei mit aufräumen, nicht als eigener Sprint.

| Altlast | Regel für neuen Code |
|---|---|
| `src/lib/format.ts` **und** `src/lib/preis-format.ts` existieren parallel | `format.ts` ist kanonisch. Neue Formatierung nur dort. Wer `preis-format.ts` anfasst, migriert den Aufrufer. |
| Server Actions mischen `throw new Error()` und `return { error }` | Neuer Code: `return { error }` (→ `CODING_STANDARDS.md`) |
| Keine Header-Komponente; Unterseiten ohne Rückweg | Neue öffentliche Seite bekommt Header und Footer |
| Geld teils `Decimal`, teils `Int` in Cent | Neue Geldfelder: `Decimal(10,2)`. Bestehende `*Cents` nicht umbauen. |
