# AGENTS.md

## Project Overview
Angular 21 standalone-component SPA for pharmacy employee scheduling, backed by Supabase (PostgreSQL + Auth + RLS). UI/domain strings are in Spanish; code identifiers in English. Single package — no monorepo.

## Commands
- `npm start` / `ng serve` — dev server at http://localhost:4200
- `npm run build` — production build to `dist/` (browser-only; see SSR gotcha)
- `npm run watch` — dev build with watch
- `npm run test` — Vitest via `@angular/build:unit-test`; no `*.spec.ts` files currently exist
- No ESLint, no CI, no format script. `ng build` is the main verification step (strict TS + `strictTemplates` catch most issues). Prettier is installed: `npx prettier --write .` when formatting matters.
- Use npm only (no yarn/pnpm).

## SSR gotcha
SSR scaffolding exists (`src/server.ts`, `src/main.server.ts`, `app.config.server.ts`, the `serve:ssr:horarios-farma` script), but `angular.json`'s build target has no `server` option, so `ng build` emits browser output only and `npm run serve:ssr:horarios-farma` fails (`dist/horarios-farma/server/` stays empty). Don't assume SSR works.

## Supabase
- Client is created once in `services/auth.service.ts` from `src/environments/environment.ts` (URL + publishable anon key, committed to repo).
- `environment.prod.ts` exists but is never referenced (no `fileReplacements` in the build) — edit `environment.ts`.
- No migration tooling. `supabase/schema.sql` / `seed.sql` are reference only and partially stale (e.g. `carga_horaria` declared DECIMAL there, but the app stores a JSON string in that column) — trust the mapping code or the live DB.
- DB column ↔ model mapping (services + dashboard): `funciones` → `functions`, `puesto_contratado` → `defaultFunction`, `carga_horaria` → `shifts` (JSON-stringified `ShiftBlock[]`: `JSON.stringify` on write, `JSON.parse` on read; reads must handle both string and array). Branch name column is `nombre_suc`.

## Architecture
- Standalone components, no NgModules; routes use `loadComponent` in `app.routes.ts`: login → branch-select → dashboard, plus `admin/managers`.
- State is Angular signals; services expose readonly signals + `computed` (pattern in `auth.service.ts`).
- `AuthService` is the central data layer (session, manager profile, branch list, per-branch employee cache); `AdminService` handles admin CRUD; `HistoryService` the schedule history.
- `components/dashboard/dashboard.component.ts` (~1400 lines) is the scheduling grid monolith — most business rules and the jsPDF export live here; `history/` also exports PDFs via jsPDF.
- Domain types and lookup maps live in `models/employee.model.ts` (`JobFunction`, `Area`, Spanish `DayOfWeek`, `AREA_TO_FUNCTION`, `WORK_HOURS` = 6–23).
- Role rules: admins see all `sucursales`; managers only branches joined in `encargados_sucursales`; only employees with `trabajando = true` are loaded; `encargado` employees are excluded from the grid (shown in their own section); `atencion_bot` renders as the cyan Bot area.

## Style
- Tailwind CSS v4 via `.postcssrc.json` (`@tailwindcss/postcss`); `@import 'tailwindcss'` in `src/styles.css`; no `tailwind.config.js`.
- Prettier: 100-char width, single quotes, `angular` parser for `.html`.
- Angular component prefix: `app`.
- TypeScript: strict, `noImplicitReturns`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`, `strictTemplates`.
