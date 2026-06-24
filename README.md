# HorariosFarma

Pharmacy scheduling application (Angular 21 + Supabase) for managing branch schedules, employees, and vacations.

## Tech Stack
- **Frontend**: Angular 21, TailwindCSS, Angular Signals
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Notifications**: ngx-dynamic-toast + motion

## Setup

```bash
npm install
ng serve
```

## Supabase

**Project URL**: `https://gkqacjcqeljjyhzdtpgv.supabase.co`

**Tables**: `sucursales`, `empleados`, `vacaciones`, `roles_usuarios`, `encargados_sucursales`

**Key columns**:
- `empleados.funciones` - JSONB array of job functions
- `empleados.puesto_contratado` - contracted position
- `empleados.carga_horaria` - JSONB shift schedule
- `empleados.nro_vendedor` - employee number

## ngx-dynamic-toast

```typescript
// app.config.ts
import { provideDynamicToast } from 'ngx-dynamic-toast';

providers: [
  provideDynamicToast({ theme: 'system', position: 'top-right', offset: { top: '16px', right: '16px' } })
]

// app.ts
import { DynamicToastViewportComponent } from 'ngx-dynamic-toast';
// Add <dt-viewport theme="system" position="top-right" ...></dt-viewport> to template

// Component usage
import { DynamicToastService } from 'ngx-dynamic-toast';

constructor(private toast = inject(DynamicToastService)) {}

this.toast.success('Title', { description: 'Message', duration: 4000 });
this.toast.error('Title', { description: 'Message' });
this.toast.info('Title', { duration: 3000 });
```

## Key Features
- Admin sees all branches; manager sees assigned branches only
- Employees with role "encargado" excluded from scheduling grid
- Bot employees (atencion_bot) displayed in cyan
- Split shifts shown on same employee row
