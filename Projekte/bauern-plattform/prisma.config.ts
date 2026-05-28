import { defineConfig } from 'prisma/config'

// DIRECT_URL für Migrationen (Supabase: direkter Port 5432, kein pgBouncer)
// DATABASE_URL für den Runtime-Client (Supabase: pgBouncer Port 6543)
// Env-Variablen werden via dotenv-cli aus .env.local geladen (siehe package.json Scripts)
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'] ?? '',
  },
})
