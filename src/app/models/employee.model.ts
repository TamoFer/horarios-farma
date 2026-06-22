export type JobFunction = 'cajero' | 'vendedor' | 'perfumera' | 'salon' | 'inventario' | 'limpieza' | 'atencion_bot' | 'encargado';

export type Area = 'mostrador' | 'caja' | 'perfumeria' | 'salon' | 'inventario' | 'limpieza' | 'bot';

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

export const AREAS: Area[] = ['mostrador', 'caja', 'perfumeria', 'salon', 'inventario', 'limpieza', 'bot'];

export const AREA_TO_FUNCTION: Record<Area, JobFunction> = {
  caja: 'cajero',
  mostrador: 'vendedor',
  perfumeria: 'perfumera',
  salon: 'salon',
  inventario: 'inventario',
  limpieza: 'limpieza',
  bot: 'atencion_bot'
};

export const FUNCTION_TO_AREA: Record<JobFunction, Area> = {
  cajero: 'caja',
  vendedor: 'mostrador',
  perfumera: 'perfumeria',
  salon: 'salon',
  inventario: 'inventario',
  limpieza: 'limpieza',
  atencion_bot: 'bot',
  encargado: 'mostrador'
};

export const AREA_LABELS: Record<Area, string> = {
  caja: 'Caja',
  mostrador: 'Mostrador',
  perfumeria: 'Perfumería',
  salon: 'Salón',
  inventario: 'Inventario',
  limpieza: 'Limpieza',
  bot: 'Bot',
};

export const FUNCTION_LABELS: Record<JobFunction, string> = {
  cajero: 'Cajero',
  vendedor: 'Vendedor',
  perfumera: 'Perfumera',
  salon: 'Salón',
  inventario: 'Inventario',
  limpieza: 'Limpieza',
  atencion_bot: 'Bot',
  encargado: 'Encargado',
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

