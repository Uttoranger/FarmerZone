# scripts/ — Diagnose- und Reparatur-Skripte

Alle Skripte laufen gegen die in `.env.local` konfigurierte Datenbank bzw. den
Stripe-Account. Ausführen mit:

```bash
pnpm dotenv -e .env.local -- tsx scripts/<name>.ts
```

## Diagnose (wiederverwendbar, nur lesend)

| Skript | Zweck | Wann ausführen |
|---|---|---|
| `check-emails.ts` | Listet die letzten 10 Bestellungen mit Status, Zahlart und Kunden-E-Mail | Wenn unklar ist, an welche Adressen Bestell-Mails gegangen sein müssten |
| `check-orders.ts` | Listet Bestellungen mit Zahlungsstatus und Stripe-PaymentIntent-ID | Beim Abgleich DB-Status ↔ Stripe (z. B. Webhook-Problemen auf der Spur) |
| `check-stripe.ts` | Fragt einen PaymentIntent direkt bei Stripe ab (PI-ID im Skript anpassen!) | Wenn eine konkrete Zahlung untersucht werden soll; enthält eine hartkodierte Test-PI-ID |

## Einmalige Reparaturen (schreibend — vor Ausführung Zweck prüfen!)

| Skript | Zweck | Wann ausführen |
|---|---|---|
| `fix-pending-online-orders.ts` | Setzt ONLINE-Bestellungen, die in `PENDING_CONFIRMATION` feststecken, auf `PAID` — aber nur, wenn der PaymentIntent bei Stripe wirklich `succeeded` ist | Historische Reparatur (Webhook erreichte localhost nicht). Nur erneut ausführen, wenn genau dieses Symptom wieder auftritt |
| `fix-test-emails.ts` | Überschreibt alle Kunden-E-Mails in Bestellungen mit einer Test-Adresse | **NUR lokale Entwicklung** (Resend-Testmodus mit `onboarding@resend.dev`). Niemals gegen die Produktions-DB |
