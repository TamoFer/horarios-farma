export type JobFunction = 'cajero' | 'vendedor' | 'perfumera' | 'salon' | 'inventario' | 'limpieza';

export type Area = 'mostrador' | 'caja' | 'perfumeria' | 'salon' | 'inventario' | 'limpieza';

export type DayOfWeek = 'lunes' | 'martes' | 'miércoles' | 'jueves' | 'viernes' | 'sábado' | 'domingo';

export interface ShiftBlock {
  start: number;
  end: number;
}

export interface Employee {
  id: number;
  name: string;
  functions: JobFunction[];
  defaultFunction: JobFunction;
  weeklyHours: number;
  dayOff: DayOfWeek;
  shifts: ShiftBlock[];
}

export interface Vacation {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string;
}

export interface ScheduleHistory {
  id: string;
  date: string;
  placedEmployees: PlacedEmployeeData[];
  createdAt: Date;
}

export interface PlacedEmployeeData {
  employeeId: number;
  employeeName: string;
  area: Area;
  function: JobFunction;
  shifts: ShiftBlock[];
}

export const WORK_HOURS = Array.from({ length: 17 }, (_, i) => i + 7);

export const AREAS: Area[] = ['mostrador', 'caja', 'perfumeria', 'salon', 'inventario', 'limpieza'];

export const AREA_TO_FUNCTION: Record<Area, JobFunction> = {
  caja: 'cajero',
  mostrador: 'vendedor',
  perfumeria: 'perfumera',
  salon: 'salon',
  inventario: 'inventario',
  limpieza: 'limpieza',
};

export const FUNCTION_TO_AREA: Record<JobFunction, Area> = {
  cajero: 'caja',
  vendedor: 'mostrador',
  perfumera: 'perfumeria',
  salon: 'salon',
  inventario: 'inventario',
  limpieza: 'limpieza',
};

export const AREA_LABELS: Record<Area, string> = {
  caja: 'Caja',
  mostrador: 'Mostrador',
  perfumeria: 'Perfumería',
  salon: 'Salón',
  inventario: 'Inventario',
  limpieza: 'Limpieza',
};

export const FUNCTION_LABELS: Record<JobFunction, string> = {
  cajero: 'Cajero',
  vendedor: 'Vendedor',
  perfumera: 'Perfumera',
  salon: 'Salón',
  inventario: 'Inventario',
  limpieza: 'Limpieza',
};

export const DAYS_OF_WEEK: DayOfWeek[] = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miércoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sábado: 'Sábado',
  domingo: 'Domingo',
};

export const SAMPLE_EMPLOYEES: Employee[] = [
  { id: 1, name: 'María García', functions: ['cajero'], defaultFunction: 'cajero', weeklyHours: 40, dayOff: 'domingo', shifts: [{ start: 7, end: 15 }] },
  { id: 2, name: 'Carlos López', functions: ['vendedor', 'cajero'], defaultFunction: 'vendedor', weeklyHours: 45, dayOff: 'lunes', shifts: [{ start: 8, end: 13 }, { start: 18, end: 22 }] },
  { id: 3, name: 'Ana Martínez', functions: ['perfumera', 'limpieza'], defaultFunction: 'perfumera', weeklyHours: 45, dayOff: 'martes', shifts: [{ start: 9, end: 18 }] },
  { id: 4, name: 'Pedro Sánchez', functions: ['salon', 'vendedor'], defaultFunction: 'salon', weeklyHours: 45, dayOff: 'miércoles', shifts: [{ start: 10, end: 19 }] },
  { id: 5, name: 'Laura Rodríguez', functions: ['inventario', 'limpieza'], defaultFunction: 'inventario', weeklyHours: 45, dayOff: 'jueves', shifts: [{ start: 7, end: 16 }] },
  { id: 6, name: 'Juan Pérez', functions: ['limpieza', 'perfumera', 'cajero'], defaultFunction: 'limpieza', weeklyHours: 40, dayOff: 'viernes', shifts: [{ start: 7, end: 15 }] },
  { id: 7, name: 'Sofia Hernández', functions: ['cajero', 'vendedor'], defaultFunction: 'cajero', weeklyHours: 40, dayOff: 'sábado', shifts: [{ start: 14, end: 22 }] },
  { id: 8, name: 'Diego Fernández', functions: ['vendedor', 'salon', 'perfumera'], defaultFunction: 'vendedor', weeklyHours: 45, dayOff: 'viernes', shifts: [{ start: 9, end: 14 }, { start: 16, end: 20 }] },
];