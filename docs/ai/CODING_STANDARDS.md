# CODING_STANDARDS

Bei **jeder** Codeänderung lesen.

---

## 1. Namen

| Gegenstand | Konvention | Beispiel |
|---|---|---|
| Datei | `kebab-case.ts` | `order-totals.ts` |
| React-Komponente (Datei) | `kebab-case.tsx` | `cart-sheet.tsx` |
| React-Komponente (Name) | `PascalCase` | `CartSheet` |
| Hook | `use-*.ts` / `useX` | `use-cart.ts` |
| Funktion | `camelCase`, Verb zuerst | `pruefeWarenkorb` |
| Typ / Interface | `PascalCase`, kein `I`-Präfix | `WarenkorbPosition` |
| Konstante | `SCREAMING_SNAKE_CASE` | `RESERVIERUNG_TTL_MS` |
| Zod-Schema | `*Schema` | `checkoutSchema` |
| Test | `<thema>.test.ts` | `reservierung.test.ts` |

### Sprache in Bezeichnern
- **Fachbegriffe deutsch**, wenn die Domäne deutsch ist: `reservierung`, `warenkorb`, `hof`, `abholung`, `servicegebuehr`. Das ist die gewachsene Konvention der neueren Dateien — fortführen.
- **Technische Begriffe englisch**: `route`, `handler`, `schema`, `token`, `client`.
- **Prisma-Modelle und -Felder bleiben englisch** (`Order`, `stock`, `expiresAt`). Nicht umbenennen.
- **Nie mischen innerhalb eines Bezeichners**: `pruefeWarenkorb` ✅, `checkWarenkorb` ❌.
- Umlaute in Dateinamen und Bezeichnern ausschreiben: `servicegebuehr`, nicht `servicegebühr`.

---

## 2. Typisierung

- `any` ist **verboten**. Auch `as any`, `@ts-ignore`, `@ts-expect-error` ohne Begründungskommentar.
- Unbekanntes ist `unknown` + Zod-Parse, nie `any`.
- Rückgabetyp bei exportierten Funktionen **explizit** annotieren.
- Keine nicht-null-Assertion `!`, außer mit Kommentar, warum es sicher ist.
- Typen aus Prisma ableiten, nicht abschreiben: `Prisma.OrderGetPayload<…>`.
- Keine Typduplikate: Zod-Schema ist die Quelle → `type X = z.infer<typeof xSchema>`.

### Geld
- Prisma speichert Preise als `Decimal(10,2)`.
- **Nie** `Number(decimal)` für Rechnungen, die addiert oder multipliziert werden. Rundungsfehler landen auf der Rechnung des Hofs.
- Rechnen in den vorhandenen Helfern: `src/lib/order-totals.ts`, `src/lib/servicegebuehr.ts`.
- Anzeigen ausschließlich über `src/lib/format.ts` (`formatEuro`, `formatMenge`, `formatPosition`).
- Nie ein eigenes Preisformat erfinden. Nie `toFixed(2) + ' €'`.

### Serialisierung an Client-Komponenten
- `Decimal` und `Date` nicht roh übergeben.
- `Decimal` → in der Query in `string` oder bereits formatiert wandeln.
- `Date` → `toISOString()` oder fertig formatiert.

---

## 3. Validierung an Systemgrenzen

Systemgrenze = API-Route, Server Action, Webhook, URL-Parameter, `localStorage`, externe Antwort.

- **Jede** Systemgrenze validiert mit Zod. Ohne Ausnahme.
- Schemas liegen in `src/schemas/` und werden von Client **und** Server benutzt.
- Clientseitige Validierung ist Komfort, nie Schutz. Serverseitig immer erneut prüfen.
- In API-Routen `safeParse` (Antwort bauen), in Server Actions `parse` oder `safeParse` mit `{ error }`.
- `localStorage`-Inhalte (Warenkorb!) sind Fremddaten: parsen, validieren, bei Bruch verwerfen.

---

## 4. Fehlerbehandlung

### Server Action
```ts
export async function tuWas(input: unknown): Promise<{ ok: true } | { error: string }>
```
- Erwartbarer Fehler → `return { error: 'Verständlicher deutscher Satz.' }`
- Unerwarteter Fehler → werfen lassen, Sentry fängt ihn.
- **Nie** `catch {}` ohne Behandlung. **Nie** einen Fehler verschlucken und `{ ok: true }` zurückgeben.

### API-Route
```ts
// Fehler
NextResponse.json({ error: 'Deutscher Satz.', code: 'MASCHINENLESBAR' }, { status: 4xx })
// Erfolg
NextResponse.json({ ok: true, …daten })
```
- `code` setzen, wenn der Browser zwischen Fällen unterscheiden muss (Vorbild: `RESERVIERUNG_ABGELAUFEN`).
- Statuscodes: 400 Validierung, 401 nicht angemeldet, 403 kein Zugriff, 404 nicht gefunden, 409 Konflikt, 429 Rate-Limit, 500 unerwartet.
- **Nie** interne Details nach außen geben: kein Stacktrace, kein SQL, kein Prisma-Fehlertext, keine ID fremder Datensätze.

### Nutzertexte
- Deutsch, geduzt, ohne Fachjargon, mit Ausweg.
- ✅ "Deine Reservierung ist abgelaufen. Wir haben die Verfügbarkeit neu geprüft."
- ❌ "Reservation expired", "Fehler 500", "Constraint violation".

### Konsistenz bei Teilfehlschlag
- Mehrere Schreibvorgänge, die zusammengehören → `prisma.$transaction`.
- Geht das nicht (externer Dienst dazwischen): Kompensation schreiben, wie beim Bestandsabzug.
- Nichts Langsames im Antwortpfad → `nachDerAntwort()`.

---

## 5. Kommentare

- Deutsch. Erklären **warum**, nie was.
- Pflicht bei: nicht offensichtlicher Fachregel, bewusster Abweichung, bekannter Einschränkung, Sicherheitsentscheidung.
- Verboten: auskommentierter Code, `TODO` ohne Namen und Datum, Kommentare, die den Code wiederholen.

---

## 6. Bad vs. Good

### Beispiel 1 — Geld und Formatierung

```ts
// ❌ BAD
const gesamt = Number(order.totalAmount) * 1.049          // Rundungsfehler, Gebühr hart verdrahtet
return <span>{gesamt.toFixed(2)} €</span>                 // eigenes Format, falsche Reihenfolge
```

```ts
// ✅ GOOD
import { berechneServicegebuehr } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'

const { gesamtCents } = berechneServicegebuehr({
  warenpreis: order.totalAmount,
  prozent: farm.serviceFeePercent,
  minCents: farm.serviceFeeMinCents,
})
return <span>{formatEuro(gesamtCents / 100)}</span>       // € 10,49
```

### Beispiel 2 — Server Action ohne Besitzprüfung

```ts
// ❌ BAD
'use server'
export async function updateStock(productId: string, stock: number) {
  await prisma.product.update({ where: { id: productId }, data: { stock } })
}
// Nicht eingeloggt? Egal. Fremdes Produkt? Egal. Eingabe ungeprüft. Kein revalidate.
```

```ts
// ✅ GOOD
'use server'
export async function updateStock(
  input: unknown
): Promise<{ ok: true } | { error: string }> {
  const v = updateStockSchema.safeParse(input)
  if (!v.success) return { error: 'Ungültige Eingabe.' }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }

  const farm = await getFarmForUser(session.user.id)
  if (!farm) return { error: 'Kein Hof gefunden.' }

  // Besitz in der WHERE-Klausel, nicht in einem vorherigen if — sonst
  // besteht zwischen Prüfung und Schreiben eine Lücke.
  const { count } = await prisma.product.updateMany({
    where: { id: v.data.productId, farmId: farm.id },
    data: { stock: v.data.stock },
  })
  if (count === 0) return { error: 'Produkt nicht gefunden.' }

  revalidatePath('/products')
  revalidatePath(`/${farm.slug}`)
  return { ok: true }
}
```

### Beispiel 3 — Fachregel in der Komponente

```tsx
// ❌ BAD — Frist lebt im JSX, nicht testbar, nur im Browser wirksam
{Date.now() - new Date(res.createdAt).getTime() < 900_000 && (
  <span>Reserviert</span>
)}
```

```ts
// ✅ GOOD — Entscheidung in src/lib/reservierung.ts, rein und testbar
export function istGueltig(reservierung: EigeneReservierung, jetzt: Date): boolean {
  return reservierung.expiresAt.getTime() > jetzt.getTime()
}
```
```tsx
// Komponente zeigt nur an, was der Server entschieden hat
{position.zustand === 'ok' && <span>Reserviert</span>}
```

---

## 7. Checkliste vor dem Bericht

- [ ] Kein `any`, kein `@ts-ignore`, keine unbegründete `!`-Assertion
- [ ] Zod an jeder neuen Systemgrenze
- [ ] Auth **und** Besitzprüfung in jeder schreibenden Server Action
- [ ] Besitz in der `WHERE`-Klausel, nicht in einem vorgelagerten `if`
- [ ] Geld über die Helfer, Anzeige über `format.ts`
- [ ] Fehlermeldungen deutsch, geduzt, mit Ausweg
- [ ] `revalidatePath` für jede betroffene Route
- [ ] Nichts Langsames im Antwortpfad
- [ ] `Decimal`/`Date` nicht roh an Client-Komponenten
- [ ] `pnpm typecheck && pnpm lint && pnpm test` grün
