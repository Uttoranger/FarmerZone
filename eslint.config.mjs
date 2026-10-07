import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Schritt 1 des Redesigns (docs/umsetzungsprompt.md): Keine Farbliterale im
// Quelltext — Farben kommen aus den Tokens in docs/ai/DESIGN_SYSTEM.md
// (CLAUDE.md, „Design und UI"). Die Regel gilt für alles Neue unter src/;
// der Bestand mit seinen begründeten Inline-Farben (Overlays auf Fotos,
// Kartenkacheln, Metafarben) steht in FARBLITERAL_BESTAND und verlässt die
// Liste, wenn die Datei umzieht — die Liste darf nur schrumpfen. E-Mails
// bleiben dauerhaft draußen: Mailprogramme kennen keine CSS-Variablen.
// Einzelne Ausnahmen in geprüften Dateien nur als Ausnahmezeile direkt
// darüber, mit Begründung nach dem Doppelstrich:
// `eslint-disable-next-line no-restricted-syntax -- <warum kein Token passt>`.
const FARBLITERAL_HEX = '#[0-9a-fA-F]{3,8}\\b'
const FARBLITERAL_FUNKTION = '\\b(rgba?|hsla?|oklch|oklab)\\('
const KEINE_FARBLITERALE =
  'Keine Farbwerte im Quelltext — Utilities der Tokens aus docs/ai/DESIGN_SYSTEM.md (bg-background, text-foreground, text-status-offen …).'
const FARBLITERAL_BESTAND = [
  'src/emails/**',
  'src/app/(auth)/forgot-password/page.tsx',
  'src/app/(auth)/reset-password/page.tsx',
  'src/app/(hof)/settings/appearance/appearance-client.tsx',
  'src/app/admin/finanzen/finanzen-diagramm.tsx',
  // Eckige Klammern sind im Muster Zeichenklassen — für den Ordner [id] maskieren.
  'src/app/api/status-image/\\[id\\]/route.tsx',
  'src/app/layout.tsx',
  'src/app/manifest.ts',
  'src/components/cookie-banner.tsx',
  'src/components/farm/farm-page-view.tsx',
  'src/components/farm/product-grid.tsx',
  'src/components/farmer/farm-identity-card.tsx',
  'src/components/farmer/segment-control.tsx',
  'src/components/hoefe/hoefe-karte.tsx',
  'src/components/orders/order-status.ts',
  'src/components/shared/kunden-kopf.tsx',
  'src/components/shared/wortmarke.tsx',
  'src/lib/bestellstatus.ts',
  'src/lib/hoefe-anzeige.ts',
  'src/lib/mein-hof.ts',
  'src/lib/meldung.ts',
]

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: FARBLITERAL_BESTAND,
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${FARBLITERAL_HEX}/]`, message: KEINE_FARBLITERALE },
        { selector: `TemplateElement[value.raw=/${FARBLITERAL_HEX}/]`, message: KEINE_FARBLITERALE },
        { selector: `Literal[value=/${FARBLITERAL_FUNKTION}/]`, message: KEINE_FARBLITERALE },
        { selector: `TemplateElement[value.raw=/${FARBLITERAL_FUNKTION}/]`, message: KEINE_FARBLITERALE },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
