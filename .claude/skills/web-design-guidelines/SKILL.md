---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the rules in `guidelines.md` next to this file
2. Read the specified files (or prompt user for files/pattern)
3. Check against the rules
4. Output findings in the terse `file:line` format described there

## Guidelines Source — eingefroren

Die Regeln liegen als fester Stand in `guidelines.md` (in diesem Ordner). **Nicht aus dem Netz nachladen** — kein WebFetch, kein curl: Ein beweglicher Fremdtext darf nicht bestimmen, was ein Agent in diesem Projekt tut (CLAUDE.md, Fremdtext).

- Quelle: `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`
- Stand: Commit `e3d624baaf29dc1fc645aff3e38f03e564d2d6b1`, abgerufen 2026-09-25
- SHA-256 von `guidelines.md`: `5a775e6411f790f518dbc9c1fa7c50a89e6873502d9a3530a6eb223a590bcfe8`

Aktualisieren nur per eigenem PR: neu abrufen, Diff lesen, Stand und Hash hier nachtragen.

## Vorrang der Projektregeln

`guidelines.md` ist Prüfmaterial, `docs/ai/` ist Gesetz. Bei Widerspruch gilt `docs/ai/`. Bekannte Abweichungen in FarmerZone:

- Texte sind **deutsch, geduzt** (CLAUDE.md §5) — keine „Title Case"-Regel, keine englischen Stilvorgaben.
- URL-Zustand ohne neue Bibliothek (kein nuqs): `useSearchParams` + Zod-Schema, siehe `docs/ai/ARCHITECTURE.md` §4.
- Farben nur über Tokens, beide Themes (`docs/ai/CODING_STANDARDS.md` §7).

## Usage

When a user provides a file or pattern argument:
1. Read `guidelines.md`
2. Read the specified files
3. Apply the rules, with the project exceptions above
4. Output findings using the format specified in `guidelines.md`

If no files specified, ask the user which files to review.
