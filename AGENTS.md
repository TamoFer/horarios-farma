# AGENTS.md

## Project Overview
Angular 21 SPA for managing pharmacy employee schedules. Single-package app with SSR support.

## Dev Commands
- `ng serve` / `npm start` — dev server at http://localhost:4200
- `ng test` — Vitest unit tests
- `ng build` — production build to `dist/`
- `ng build --watch --configuration development` — dev build with watch

## Key Dependencies
- Angular 21 + Angular CDK
- Tailwind CSS v4 (configured via `@tailwindcss/postcss`, no `tailwind.config.js`)
- Vitest for testing
- jspdf + html2canvas for PDF export
- Express + Angular SSR

## Code Style
- Prettier: 100 char line width, single quotes, Angular HTML parser for `.html` files
- TypeScript: strict mode, `noImplicitReturns`, `strictTemplates`
- Angular: `experimentalDecorators`, `strictInjectionParameters`

## App Structure
```
src/app/
  components/   # UI components (dashboard/, employee-form/, etc.)
  models/       # TypeScript interfaces
  services/     # Business logic services
```

## Testing
Tests run via Vitest with `ng test`. Test files match `*.spec.ts` pattern.