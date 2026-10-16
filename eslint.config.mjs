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
// Tage und Wochen sind Wiener Tage und Wochen, nie Serverzeit (docs/ai/CODING_STANDARDS.md, „Tage und
// Wochen"): Vercel rechnet in UTC, um 0:30 Uhr stünde der Hof sonst im Gestern. Die Verbotsliste dort
// gilt für alles unter src/ — setHours(0 …), getHours(), startOfWeek, toLocaleDateString ohne timeZone.
// Wache und Gegenprobe: tests/datums-regeln.test.ts.
const DATUM_HINWEIS =
  'Tag und Woche sind die Wiener, nie die der Serverzeit — wienKalendertag, wienWochenMontag, wienerMitternacht, uhrzeitInWien (docs/ai/CODING_STANDARDS.md, „Tage und Wochen").'
const DATUM_SELEKTOREN = [
  { selector: "CallExpression[callee.property.name='setHours'][arguments.0.value=0]", message: DATUM_HINWEIS },
  { selector: "CallExpression[callee.property.name='getHours']", message: DATUM_HINWEIS },
  { selector: "CallExpression[callee.name='startOfWeek']", message: DATUM_HINWEIS },
  { selector: "CallExpression[callee.property.name='startOfWeek']", message: DATUM_HINWEIS },
  { selector: "ImportSpecifier[imported.name='startOfWeek']", message: DATUM_HINWEIS },
  { selector: "ImportDeclaration[source.value=/^date-fns\\/startOfWeek/]", message: DATUM_HINWEIS },
]
const DATUM_ORT_SELEKTOREN = [
  {
    selector: "CallExpression[callee.property.name='toLocaleDateString']:not(:has(Property[key.name='timeZone']))",
    message: `${DATUM_HINWEIS} toLocaleDateString braucht timeZone: 'Europe/Vienna'.`,
  },
]
// Bestand von toLocaleDateString ohne timeZone: Die Liste darf nur schrumpfen — wer die Datei auf
// timeZone: 'Europe/Vienna' umstellt, nimmt sie hier heraus (tests/datums-regeln.test.ts meldet eine
// Datei ohne Treffer als veraltet).
export const DATUM_ORT_BESTAND = [
  'src/app/(farmer)/orders/\\[orderId\\]/print/page.tsx',
  'src/lib/order-groups.ts',
  'src/lib/whatsapp.ts',
]
const FARBLITERAL_BESTAND = [
  'src/emails/**',
  // Eckige Klammern sind im Muster Zeichenklassen — für den Ordner [id] maskieren.
  'src/app/api/status-image/\\[id\\]/route.tsx',
  'src/app/layout.tsx',
  'src/app/manifest.ts',
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

// Eine Datei darf nicht in beiden Listen stehen: Sie fiele aus allen drei Blöcken unten heraus.
if (FARBLITERAL_BESTAND.some((datei) => DATUM_ORT_BESTAND.includes(datei))) {
  throw new Error('FARBLITERAL_BESTAND und DATUM_ORT_BESTAND überschneiden sich — die Datei bekäme keine Regel.')
}

const FARBLITERAL_SELEKTOREN = [
  { selector: `Literal[value=/${FARBLITERAL_HEX}/]`, message: KEINE_FARBLITERALE },
  { selector: `TemplateElement[value.raw=/${FARBLITERAL_HEX}/]`, message: KEINE_FARBLITERALE },
  { selector: `Literal[value=/${FARBLITERAL_FUNKTION}/]`, message: KEINE_FARBLITERALE },
  { selector: `TemplateElement[value.raw=/${FARBLITERAL_FUNKTION}/]`, message: KEINE_FARBLITERALE },
]
const regeln = (...selektoren) => ({ 'no-restricted-syntax': ['error', ...selektoren.flat()] })

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [...FARBLITERAL_BESTAND, ...DATUM_ORT_BESTAND],
    rules: regeln(FARBLITERAL_SELEKTOREN, DATUM_SELEKTOREN, DATUM_ORT_SELEKTOREN),
  },
  // Die Bestände sind von je EINER Regel ausgenommen, nicht von den anderen.
  { files: FARBLITERAL_BESTAND, rules: regeln(DATUM_SELEKTOREN, DATUM_ORT_SELEKTOREN) },
  { files: DATUM_ORT_BESTAND, rules: regeln(FARBLITERAL_SELEKTOREN, DATUM_SELEKTOREN) },
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
