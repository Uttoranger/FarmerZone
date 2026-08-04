-- Row-Level-Security auf allen Tabellen im public-Schema aktivieren.
--
-- ANLASS
-- Der Supabase-Security-Advisor meldet 18 ERROR-Lints vom Typ
-- `rls_disabled_in_public`: Jede Tabelle im public-Schema ist über PostgREST
-- (Rollen `anon` und `authenticated`) erreichbar, ohne dass RLS aktiv ist.
-- Zusätzlich zwei `sensitive_columns_exposed`: "Account" enthält die Spalte
-- `password`, "Session" die Spalte `token` — beide bisher ohne RLS über die
-- Daten-API lesbar.
--
-- WARUM KEINE POLICIES
-- FarmerZone nutzt die Supabase-Daten-API nicht: kein supabase-js im Repo,
-- kein anon-Key, keine SUPABASE_-Variablen. Die App verbindet ausschließlich
-- über Prisma als Rolle `postgres`, die zugleich Eigentümerin aller Tabellen
-- ist. Policies für `anon`/`authenticated` wären toter Code — niemand nutzt
-- diese Rollen. RLS ohne Policies sperrt die API-Rollen vollständig aus,
-- und genau das ist hier das Ziel.
--
-- WARUM KEIN FORCE
-- In PostgreSQL umgeht der Tabelleneigentümer RLS, solange kein
-- `FORCE ROW LEVEL SECURITY` gesetzt ist. Dieser Eigentümer-Bypass ist
-- gewollt: Er trägt die gesamte App. `FORCE` würde die Eigentümerrolle
-- mitsperren und damit FarmerZone selbst aussperren.
--
-- ZURÜCKNEHMEN
-- Falls die App wider Erwarten keine Daten mehr liest: Vercel Instant
-- Rollback, danach eine Folge-Migration mit `DISABLE ROW LEVEL SECURITY`.
-- NICHT von Hand in der Datenbank ändern — sonst driftet der Migrationsstand.

ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Farm" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PickupSlot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ManualSale" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StockReservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."WebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CustomerFarmSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."StatusPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FarmValue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."FarmPhoto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
