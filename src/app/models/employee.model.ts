export type JobFunction = 'cajero' | 'vendedor' | 'perfumera' | 'salon' | 'inventario' | 'limpieza' | 'atencion_bot' | 'encargado' | 'nochero' | 'seguridad';

export type Area = 'mostrador' | 'caja' | 'perfumeria' | 'salon' | 'inventario' | 'limpieza' | 'bot' | 'noche' | 'seguridad';

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
  employeeName?: string;
  startDate: string;
  endDate: string;
  estado: 'temporal' | 'confirmada';
}

export interface ScheduleHistory {
  id: string;
  date: string;
  scheduleDate: string;
  branchId: string;
  placedEmployees: PlacedEmployeeData[];
  createdAt: Date;
  isFinal?: boolean;
}

export interface PlacedEmployeeData {
  employeeId: number;
  employeeName: string;
  area: Area;
  function: JobFunction;
  shifts: ShiftBlock[];
}

export const WORK_HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

export const NIGHT_SHIFT_START = 22;
export const NIGHT_SHIFT_NORMAL_END = 24 + 7;
export const NIGHT_SHIFT_EXTENDED_END = 24 + 12;

export function normalizeShiftBlocks(shifts: ShiftBlock[] | null | undefined): ShiftBlock[] {
  return (shifts || [])
    .filter((s) => s && Number.isFinite(s.start) && Number.isFinite(s.end))
    .map((s) => (s.end < s.start ? { start: s.start, end: s.end + 24 } : { start: s.start, end: s.end }))
    .filter((s) => s.end > s.start);
}

export const AREAS: Area[] = ['mostrador', 'caja', 'perfumeria', 'salon', 'inventario', 'limpieza', 'seguridad', 'bot', 'noche'];

export const AREA_TO_FUNCTION: Record<Area, JobFunction> = {
  caja: 'cajero',
  mostrador: 'vendedor',
  perfumeria: 'perfumera',
  salon: 'salon',
  inventario: 'inventario',
  limpieza: 'limpieza',
  bot: 'atencion_bot',
  noche: 'nochero',
  seguridad: 'seguridad'
};

export const FUNCTION_TO_AREA: Record<JobFunction, Area> = {
  cajero: 'caja',
  vendedor: 'mostrador',
  perfumera: 'perfumeria',
  salon: 'salon',
  inventario: 'inventario',
  limpieza: 'limpieza',
  atencion_bot: 'bot',
  encargado: 'mostrador',
  nochero: 'noche',
  seguridad: 'seguridad'
};

export const AREA_LABELS: Record<Area, string> = {
  caja: 'Caja',
  mostrador: 'Mostrador',
  perfumeria: 'Perfumería',
  salon: 'Salón',
  inventario: 'Inventario',
  limpieza: 'Limpieza',
  bot: 'Bot',
  noche: 'Noche',
  seguridad: 'Seguridad',
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
  nochero: 'Nochero',
  seguridad: 'Seguridad',
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

export type ExceptionType = 'fija' | 'espontanea';

export interface EmployeeException {
  id: number;
  employeeId: number;
  type: ExceptionType;
  dayOfWeek: DayOfWeek | null;
  startDate: string | null;
  endDate: string | null;
  function: JobFunction;
  shifts: ShiftBlock[];
  coveredEmployeeId: number | null;
}

export type EmployeeExceptionDraft = Omit<EmployeeException, 'id' | 'employeeId'>;

export function exceptionAppliesOn(
  exception: Pick<EmployeeException, 'type' | 'dayOfWeek' | 'startDate' | 'endDate'>,
  dateStr: string
): boolean {
  if (exception.type === 'fija') {
    const days: DayOfWeek[] = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const date = new Date(dateStr + 'T00:00:00');
    return exception.dayOfWeek === days[date.getDay()];
  }
  const start = (exception.startDate || '').split('T')[0];
  const end = (exception.endDate || '').split('T')[0];
  return !!start && !!end && dateStr >= start && dateStr <= end;
}

