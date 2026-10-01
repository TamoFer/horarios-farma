import { Component, signal, output, ElementRef, ViewChild, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import jsPDF from 'jspdf';
import {
  Employee,
  JobFunction,
  Area,
  DayOfWeek,
  ShiftBlock,
  Vacation,
  ScheduleHistory,
  WORK_HOURS,
  AREAS,
  FUNCTION_TO_AREA,
  AREA_LABELS,
  FUNCTION_LABELS,
  DAY_LABELS,
  PlacedEmployeeData,
  NIGHT_SHIFT_START,
  NIGHT_SHIFT_NORMAL_END,
  NIGHT_SHIFT_EXTENDED_END,
  EmployeeException,
  EmployeeExceptionDraft,
  ExceptionType,
  exceptionAppliesOn,
  normalizeShiftBlocks,
} from '../../models/employee.model';
import { AuthService } from '../../services/auth.service';
import { HistoryService } from '../../services/history.service';
import { ExceptionService } from '../../services/exception.service';
import { EmployeeModalComponent } from '../employee-modal/employee-modal.component';
import { VacationModalComponent } from '../vacation-modal/vacation-modal.component';
import { DynamicToastService } from 'ngx-dynamic-toast';

interface PlacedEmployee {
  id: number;
  employee: Employee;
  area: Area;
  function: JobFunction;
  shifts: ShiftBlock[];
}

interface EmployeeShiftSchedule {
  placedId: number;
  employee: Employee;
  function: JobFunction;
  shift: ShiftBlock;
  trackIndex: number;
}

interface AreaSchedule {
  area: Area;
  tracks: EmployeeShiftSchedule[][];
}

interface MinimalEmployee {
  id: number;
  name: string;
}

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, EmployeeModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  @ViewChild('scheduleGrid') scheduleGrid!: ElementRef;

  private router = inject(Router);
  authService = inject(AuthService);
  private historyService = inject(HistoryService);
  exceptionService = inject(ExceptionService);
  private toastService = inject(DynamicToastService);

  employees = computed(() => {
    const branch = this.authService.selectedBranch();
    if (!branch) return [];
    return [...this.authService.getEmployeesForBranch(branch.id)].sort((a, b) =>
      this.surnameOf(a.name).localeCompare(this.surnameOf(b.name), 'es')
    );
  });

  private surnameOf(name: string): string {
    const parts = name.trim().split(/\s+/);
    return parts[parts.length - 1] ?? name;
  }

  vacations = signal<Vacation[]>([]);

  employeeChange = output<Employee[]>();
  saveSchedule = output<{ date: string; placedEmployees: PlacedEmployeeData[] }>();

  areas = AREAS;
  workHours = WORK_HOURS;
  areaLabels = AREA_LABELS;
  functionLabels = FUNCTION_LABELS;
  dayLabels = DAY_LABELS;

  placedEmployees = signal<PlacedEmployee[]>([]);
  areaSchedules = signal<AreaSchedule[]>([]);
  scheduleSaved = signal(true);

  showModal = signal(false);
  modalEmployee = signal<Employee | null>(null);
  modalArea = signal<Area | null>(null);
  modalDropHour = signal<number>(0);
  modalEditingId = signal<number | null>(null);
  modalEditingFunction = signal<JobFunction | null>(null);
  modalEditingShifts = signal<ShiftBlock[] | null>(null);

  draggedEmployee = signal<Employee | null>(null);
  sidebarVisible = signal(true);
  currentSection = signal<'horario' | 'empleados' | 'vacaciones' | 'historial' | 'cambios'>('horario');

  showEmployeeModal = signal(false);
  editingEmployee = signal<Employee | null>(null);
  employeeForm = {
    name: '',
    functions: ['vendedor'] as JobFunction[],
    defaultFunction: 'vendedor' as JobFunction,
    nroVendedor: null as number | null,
    dayOff: 'domingo' as DayOfWeek,
    shifts: [{ start: 9, end: 18 } as ShiftBlock]
  };

  showDeleteConfirm = signal(false);
  employeeToDelete = signal<Employee | null>(null);

  showStatusModal = signal(false);
  statusEmployee = signal<Employee | null>(null);
  statusAction = signal<'renuncia' | 'despedido' | 'cambio_sucursal' | null>(null);
  newBranchId: number | null = null;

  showSignOutConfirm = signal(false);

  showVacationModal = signal(false);
  vacationForm = {
    employeeId: '',
    startDate: '',
    endDate: ''
  };

  showHistoryPreviewModal = signal(false);
  historyPreviewEntry = signal<ScheduleHistory | null>(null);
  showHistoryDeleteConfirm = signal(false);
  historyToDelete = signal<ScheduleHistory | null>(null);

  showNightShiftModal = signal(false);
  nightShiftEmployee = signal<Employee | null>(null);

  showExceptionModal = signal(false);
  exceptionEditing = signal<EmployeeException | null>(null);
  exceptionLockedEmployeeId = signal<number | null>(null);
  exceptionForm = {
    employeeId: null as number | null,
    type: 'fija' as ExceptionType,
    dayOfWeek: 'lunes' as DayOfWeek,
    startDate: '',
    endDate: '',
    function: 'vendedor' as JobFunction,
    coveredEmployeeId: null as number | null,
    partIndex: 0,
    shifts: [{ start: 9, end: 18 }] as ShiftBlock[]
  };

  availableFunctions: JobFunction[] = ['cajero', 'vendedor', 'perfumera', 'salon', 'inventario', 'limpieza', 'atencion_bot', 'encargado', 'nochero', 'seguridad'];
  allDays: DayOfWeek[] = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

  employeeSearchText = signal('');
  employeeSortField = signal<'name' | 'functions' | 'defaultFunction' | 'dayOff' | 'nroVendedor'>('name');
  employeeSortDirection = signal<'asc' | 'desc'>('asc');
  employeeSortApplied = signal(false);

  vacationSearchText = signal('');
  historySearchText = signal('');
  historySearchDate = signal('');

  scheduleDate = signal(new Date().toISOString().split('T')[0]);
  minScheduleDate = signal(new Date().toISOString().split('T')[0]);
  lastSavedScheduleDate = signal<string | null>(null);
  showDatePicker = signal(false);

  filteredEmployees = computed(() => {
    let result = [...this.allEmployees];

    if (this.employeeSearchText().trim()) {
      const search = this.employeeSearchText().toLowerCase();
      result = result.filter(emp =>
        emp.name.toLowerCase().includes(search) ||
        emp.functions.some(f => f.toLowerCase().includes(search)) ||
        this.functionLabels[emp.defaultFunction].toLowerCase().includes(search) ||
        this.dayLabels[emp.dayOff].toLowerCase().includes(search)
      );
    }

    if (this.employeeSortApplied()) {
      const field = this.employeeSortField();
      const direction = this.employeeSortDirection();

      result.sort((a, b) => {
        let aVal: any;
        let bVal: any;

        if (field === 'name') {
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
        } else if (field === 'functions') {
          aVal = a.functions.join(',').toLowerCase();
          bVal = b.functions.join(',').toLowerCase();
        } else if (field === 'defaultFunction') {
          aVal = this.functionLabels[a.defaultFunction].toLowerCase();
          bVal = this.functionLabels[b.defaultFunction].toLowerCase();
        } else if (field === 'dayOff') {
          aVal = this.dayLabels[a.dayOff].toLowerCase();
          bVal = this.dayLabels[b.dayOff].toLowerCase();
        } else if (field === 'nroVendedor') {
          aVal = (a as any).nro_vendedor || 0;
          bVal = (b as any).nro_vendedor || 0;
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  });

  onEmployeeSearchChange(): void {
  }

  onEmployeeSearch(): void {
  }

  clearEmployeeSearch(): void {
    this.employeeSearchText.set('');
  }

  filteredVacations = computed(() => {
    const search = this.vacationSearchText().toLowerCase().trim();
    if (!search) return this.vacations();
    return this.vacations().filter(v =>
      (v.employeeName || '').toLowerCase().includes(search) ||
      v.startDate.includes(search) ||
      v.endDate.includes(search) ||
      v.estado.toLowerCase().includes(search)
    );
  });

  clearVacationSearch(): void {
    this.vacationSearchText.set('');
  }

  filteredHistory = computed(() => {
    let result = [...this.history()];

    const searchText = this.historySearchText().toLowerCase().trim();
    const searchDate = this.historySearchDate();

    if (searchText) {
      result = result.filter(entry =>
        entry.date.toLowerCase().includes(searchText) ||
        entry.scheduleDate.includes(searchText) ||
        entry.branchId.toLowerCase().includes(searchText) ||
        entry.placedEmployees.some(p => p.employeeName.toLowerCase().includes(searchText))
      );
    }

    if (searchDate) {
      result = result.filter(entry => entry.scheduleDate === searchDate);
    }

    return result;
  });

  clearHistorySearch(): void {
    this.historySearchText.set('');
    this.historySearchDate.set('');
  }

  sortEmployees(field: 'name' | 'functions' | 'defaultFunction' | 'dayOff' | 'nroVendedor'): void {
    if (this.employeeSortField() === field) {
      if (this.employeeSortDirection() === 'asc') {
        this.employeeSortDirection.set('desc');
      } else {
        this.employeeSortField.set('name');
        this.employeeSortDirection.set('asc');
        this.employeeSortApplied.set(false);
      }
    } else {
      this.employeeSortField.set(field);
      this.employeeSortDirection.set('asc');
      this.employeeSortApplied.set(true);
    }
  }

  constructor() {
    this.initEmptySchedule();
    this.loadMinScheduleDate();
    this.loadVacations();
    this.loadScheduleFromHistory();
    effect(() => {
      const ids = this.employees().map((e) => e.id);
      if (ids.length > 0) {
        this.exceptionService.loadForEmployees(ids);
      } else {
        this.exceptionService.loadForEmployees([]);
      }
    });
  }

  private async loadMinScheduleDate(): Promise<void> {
    await this.historyService.loadFromDatabase();

    await this.historyService.finalizeOldDrafts();

    const today = new Date().toISOString().split('T')[0];
    const nextAvailable = this.historyService.getNextAvailableDate(today);

    this.minScheduleDate.set(nextAvailable);
    this.scheduleDate.set(nextAvailable);
    this.lastSavedScheduleDate.set(nextAvailable);
  }

  private loadScheduleFromHistory(): void {
    const scheduleToEdit = this.historyService.getScheduleToEdit();
    if (scheduleToEdit) {
      this.historyService.clearScheduleToEdit();
      const placed: PlacedEmployee[] = scheduleToEdit.placedEmployees.map((p, index) => ({
        id: Date.now() + index,
        employee: {
          id: p.employeeId,
          name: p.employeeName,
          functions: [p.function],
          defaultFunction: p.function,
          weeklyHours: 40,
          dayOff: 'domingo' as DayOfWeek,
          shifts: p.shifts
        },
        area: p.area,
        function: p.function,
        shifts: p.shifts
      }));
      this.placedEmployees.set(placed);
      this.rebuildSchedules();
    }
  }

  private async loadVacations() {
    const branch = this.authService.selectedBranch();
    if (!branch) return;

    const { data: empleados } = await this.authService.getSupabase()
      .from('empleados')
      .select('id, nombre')
      .eq('branch_id', branch.id);

    const employeeMap = new Map<number, string>();
    empleados?.forEach(e => employeeMap.set(e.id, e.nombre));

    const employeeIds = Array.from(employeeMap.keys());
    if (employeeIds.length === 0) {
      this.vacations.set([]);
      return;
    }

    const { data } = await this.authService.getSupabase()
      .from('vacaciones')
      .select('*')
      .in('empleado_id', employeeIds);

    if (data) {
      const vacationsWithNames: Vacation[] = data.map((v: any) => ({
        id: v.id,
        employeeId: v.empleado_id,
        startDate: v.comienza,
        endDate: v.finaliza,
        employeeName: employeeMap.get(v.empleado_id) || 'Desconocido',
        estado: v.estado || 'temporal'
      }));
      this.vacations.set(vacationsWithNames);
    }
  }

  public get allEmployees(): Employee[] {
    return this.employees();
  }

  private emitChange(): void {
    this.employeeChange.emit(this.allEmployees);
  }

  toggleSidebar(): void {
    this.sidebarVisible.update((v) => !v);
  }

  goToBranchSelect(): void {
    this.authService.clearSelectedBranch();
    this.router.navigate(['/branch-select']);
  }

  openSignOutDialog(): void {
    this.showSignOutConfirm.set(true);
  }

  cancelSignOut(): void {
    this.showSignOutConfirm.set(false);
  }

  async confirmSignOut(): Promise<void> {
    this.showSignOutConfirm.set(false);
    await this.authService.signOut();
    this.toastService.success('Sesión cerrada', { description: 'Hasta luego. La sesión se cerró correctamente.' });
    this.router.navigate(['/login']);
  }

  setSection(section: 'horario' | 'empleados' | 'vacaciones' | 'historial' | 'cambios'): void {
    this.currentSection.set(section);
  }

  async deleteEmployee(id: number): Promise<void> {
    const employee = this.allEmployees.find(e => e.id === id);
    await this.authService.getSupabase()
      .from('empleados')
      .update({ trabajando: false })
      .eq('id', id);
    await this.authService.refreshEmployeesForCurrentBranch();
  }

  async saveEmployee(employee: Employee): Promise<void> {
    const editing = this.editingEmployee();
    const branch = this.authService.selectedBranch();
    if (!branch) return;

    if (editing) {
      await this.authService.getSupabase()
        .from('empleados')
        .update({
          nombre: employee.name,
          funciones: employee.functions,
          puesto_contratado: employee.defaultFunction,
          jornada_semanal: employee.weeklyHours,
          franco: employee.dayOff,
          carga_horaria: JSON.stringify(employee.shifts)
        })
        .eq('id', editing.id);
    } else {
      await this.authService.getSupabase()
        .from('empleados')
        .insert({
          branch_id: branch.id,
          nombre: employee.name,
          funciones: employee.functions,
          puesto_contratado: employee.defaultFunction,
          jornada_semanal: employee.weeklyHours,
          franco: employee.dayOff,
          carga_horaria: JSON.stringify(employee.shifts)
        });
    }
    await this.authService.refreshManagerData();
    this.closeEmployeeModal();
  }

  async deleteVacation(id: number): Promise<void> {
    await this.authService.getSupabase()
      .from('vacaciones')
      .delete()
      .eq('id', id);
    await this.loadVacations();
    this.toastService.success('Vacación eliminada', { description: 'La vacación ha sido eliminada correctamente' });
  }

  async confirmVacation(id: number): Promise<void> {
    await this.authService.getSupabase()
      .from('vacaciones')
      .update({ estado: 'confirmada' })
      .eq('id', id);
    await this.loadVacations();
    this.toastService.success('Vacación confirmada', { description: 'La vacación ha sido confirmada correctamente' });
  }


  editingVacation = signal<Vacation | null>(null);

  openNewEmployeeModal(): void {
    this.employeeForm = {
      name: '',
      functions: ['vendedor'],
      defaultFunction: 'vendedor',
      nroVendedor: null,
      dayOff: 'domingo',
      shifts: [{ start: 9, end: 18 }]
    };
    this.editingEmployee.set(null);
    this.showEmployeeModal.set(true);
  }

  openEditEmployeeModal(employee: Employee): void {
    this.employeeForm = {
      name: employee.name,
      functions: [...employee.functions],
      defaultFunction: employee.defaultFunction,
      nroVendedor: (employee as any).nro_vendedor || null,
      dayOff: employee.dayOff,
      shifts: employee.shifts.map(s => ({ ...s }))
    };
    this.editingEmployee.set(employee);
    this.showEmployeeModal.set(true);
  }

  closeEmployeeModal(): void {
    this.showEmployeeModal.set(false);
    this.editingEmployee.set(null);
  }

  toggleEmployeeFunction(func: JobFunction): void {
    const idx = this.employeeForm.functions.indexOf(func);
    if (idx >= 0) {
      this.employeeForm.functions.splice(idx, 1);
    } else {
      this.employeeForm.functions.push(func);
    }
    if (!this.employeeForm.functions.includes(this.employeeForm.defaultFunction)) {
      this.employeeForm.defaultFunction = this.employeeForm.functions[0] || 'vendedor';
    }
  }

  addShift(): void {
    this.employeeForm.shifts.push({ start: 9, end: 18 });
  }

  removeShift(index: number): void {
    this.employeeForm.shifts.splice(index, 1);
  }

  async submitEmployeeForm(): Promise<void> {
    if (!this.employeeForm.name.trim() || this.employeeForm.functions.length === 0) return;

    const branch = this.authService.selectedBranch();
    if (!branch) return;

    const shifts = normalizeShiftBlocks(this.employeeForm.shifts);
    const empData = {
      nombre: this.employeeForm.name,
      funciones: this.employeeForm.functions,
      puesto_contratado: this.employeeForm.defaultFunction,
      jornada_semanal: shifts.reduce((sum, s) => sum + (s.end - s.start), 0),
      franco: this.employeeForm.dayOff,
      carga_horaria: JSON.stringify(shifts),
      nro_vendedor: this.employeeForm.nroVendedor,
      trabajando: true
    };

    if (this.editingEmployee()) {
      const { error } = await this.authService.getSupabase()
        .from('empleados')
        .update(empData)
        .eq('id', this.editingEmployee()!.id);

      if (error) {
        this.toastService.error('Error', { description: 'No se pudo actualizar el empleado' });
      } else {
        this.toastService.success('Empleado actualizado', { description: 'Los cambios han sido guardados correctamente' });
      }
    } else {
      const { error } = await this.authService.getSupabase()
        .from('empleados')
        .insert({ ...empData, branch_id: branch.id });

      if (error) {
        this.toastService.error('Error', { description: 'No se pudo crear el empleado' });
      } else {
        this.toastService.success('Empleado creado', { description: `${this.employeeForm.name} ha sido agregado a la sucursal` });
      }
    }

    await this.authService.refreshEmployeesForCurrentBranch();
    this.closeEmployeeModal();
  }

  getExceptionShiftsText(exc: EmployeeException): string {
    const fmt = (h: number) => `${h >= 24 ? h - 24 : h}:00`;
    return exc.shifts.map((s) => `${fmt(s.start)}-${fmt(s.end)}`).join(' / ');
  }

  getFijas(): EmployeeException[] {
    return this.exceptionService.exceptions().filter((e) => e.type === 'fija');
  }

  getEspontaneas(): EmployeeException[] {
    return this.exceptionService.exceptions().filter((e) => e.type === 'espontanea');
  }

  getEmployeeExceptions(employeeId: number): EmployeeException[] {
    return this.exceptionService.exceptions().filter((x) => x.employeeId === employeeId);
  }

  getExceptionEmployees(): Employee[] {
    return this.allEmployees.filter((e) => !e.functions.includes('encargado'));
  }

  getExceptionFunctionOptions(): JobFunction[] {
    const emp = this.allEmployees.find((e) => e.id === this.exceptionForm.employeeId);
    return emp ? emp.functions : [];
  }

  openNewExceptionModal(type: ExceptionType, employee?: Employee): void {
    this.exceptionEditing.set(null);
    this.exceptionLockedEmployeeId.set(employee?.id ?? null);
    this.exceptionForm = {
      employeeId: employee?.id ?? null,
      type,
      dayOfWeek: 'lunes',
      startDate: this.scheduleDate(),
      endDate: this.scheduleDate(),
      function: employee?.defaultFunction ?? 'vendedor',
      coveredEmployeeId: null,
      partIndex: 0,
      shifts: employee ? employee.shifts.map((s) => ({ ...s })) : [{ start: 9, end: 18 }]
    };
    this.showExceptionModal.set(true);
  }

  openEditExceptionModal(exc: EmployeeException): void {
    this.exceptionEditing.set(exc);
    this.exceptionLockedEmployeeId.set(null);
    this.exceptionForm = {
      employeeId: exc.employeeId,
      type: exc.type,
      dayOfWeek: exc.dayOfWeek ?? 'lunes',
      startDate: exc.startDate ?? this.scheduleDate(),
      endDate: exc.endDate ?? this.scheduleDate(),
      function: exc.function,
      coveredEmployeeId: exc.coveredEmployeeId,
      partIndex: 0,
      shifts: exc.shifts.length > 0 ? exc.shifts.map((s) => ({ ...s })) : [{ start: 9, end: 18 }]
    };
    this.showExceptionModal.set(true);
  }

  getExceptionReferenceShifts(): ShiftBlock[] {
    const refId = this.exceptionForm.coveredEmployeeId ?? this.exceptionForm.employeeId;
    const ref = this.allEmployees.find((e) => e.id === refId);
    return ref ? ref.shifts : [];
  }

  onExceptionPartChange(): void {
    const refShifts = this.getExceptionReferenceShifts();
    if (refShifts.length === 0) return;
    this.exceptionForm.shifts =
      this.exceptionForm.partIndex === 0
        ? refShifts.map((s) => ({ ...s }))
        : [{ ...refShifts[this.exceptionForm.partIndex - 1] }];
  }

  onExceptionEmployeeChange(): void {
    const emp = this.allEmployees.find((e) => e.id === this.exceptionForm.employeeId);
    if (!emp) return;
    if (!emp.functions.includes(this.exceptionForm.function)) {
      this.exceptionForm.function = emp.defaultFunction;
    }
    this.exceptionForm.partIndex = 0;
    this.exceptionForm.shifts = emp.shifts.map((s) => ({ ...s }));
  }

  onExceptionCoveredChange(): void {
    const covered = this.allEmployees.find((e) => e.id === this.exceptionForm.coveredEmployeeId);
    if (!covered) return;
    this.exceptionForm.function = covered.defaultFunction;
    this.exceptionForm.partIndex = 0;
    this.exceptionForm.shifts = covered.shifts.map((s) => ({ ...s }));
  }

  addExceptionShift(): void {
    this.exceptionForm.shifts.push({ start: 9, end: 18 });
  }

  removeExceptionShift(index: number): void {
    if (this.exceptionForm.shifts.length > 1) {
      this.exceptionForm.shifts.splice(index, 1);
    }
  }

  closeExceptionModal(): void {
    this.showExceptionModal.set(false);
    this.exceptionEditing.set(null);
    this.exceptionLockedEmployeeId.set(null);
  }

  async submitExceptionForm(): Promise<void> {
    const form = this.exceptionForm;
    if (form.employeeId === null) {
      this.toastService.error('Faltan datos', { description: 'Elegí el empleado que cubre' });
      return;
    }
    const emp = this.allEmployees.find((e) => e.id === form.employeeId);
    if (!emp || !emp.functions.includes(form.function)) {
      this.toastService.error('Rol inválido', { description: 'El empleado no tiene esa función cargada' });
      return;
    }
    if (form.type === 'espontanea' && (!form.startDate || !form.endDate || form.endDate < form.startDate)) {
      this.toastService.error('Fechas inválidas', { description: 'Rango de fechas de la excepción incompleto' });
      return;
    }
    const shifts = normalizeShiftBlocks(form.shifts);
    if (shifts.length === 0) {
      this.toastService.error('Horario inválido', { description: 'Agregá al menos un horario válido' });
      return;
    }

    const draft: EmployeeExceptionDraft = {
      type: form.type,
      dayOfWeek: form.type === 'fija' ? form.dayOfWeek : null,
      startDate: form.type === 'espontanea' ? form.startDate : null,
      endDate: form.type === 'espontanea' ? form.endDate : null,
      function: form.function,
      shifts,
      coveredEmployeeId: form.coveredEmployeeId
    };

    const editing = this.exceptionEditing();
    const ok = editing
      ? await this.exceptionService.update(editing.id, { ...draft, employeeId: form.employeeId })
      : await this.exceptionService.create({ ...draft, employeeId: form.employeeId });

    if (ok) {
      this.toastService.success(editing ? 'Excepción actualizada' : 'Excepción creada', {
        description: 'La excepción se guardó correctamente'
      });
      this.closeExceptionModal();
    } else {
      this.toastService.error('Error', { description: 'No se pudo guardar la excepción' });
    }
  }

  async deleteException(id: number): Promise<void> {
    const ok = await this.exceptionService.remove(id);
    if (ok) {
      this.toastService.success('Excepción eliminada', { description: 'La excepción se eliminó correctamente' });
    } else {
      this.toastService.error('Error', { description: 'No se pudo eliminar la excepción' });
    }
  }

  openNewVacationModal(): void {
    this.vacationForm = { employeeId: '', startDate: '', endDate: '' };
    this.showVacationModal.set(true);
  }

  openEditVacationModal(vacation: Vacation): void {
    this.vacationForm = {
      employeeId: vacation.employeeId.toString(),
      startDate: vacation.startDate,
      endDate: vacation.endDate
    };
    this.editingVacation.set(vacation);
    this.showVacationModal.set(true);
  }

  closeVacationModal(): void {
    this.showVacationModal.set(false);
    this.editingVacation.set(null);
  }

  async submitVacationForm(): Promise<void> {
    if (!this.vacationForm.employeeId || !this.vacationForm.startDate || !this.vacationForm.endDate) return;

    const editing = this.editingVacation();
    if (editing) {
      const { error } = await this.authService.getSupabase()
        .from('vacaciones')
        .update({
          empleado_id: parseInt(this.vacationForm.employeeId),
          comienza: this.vacationForm.startDate,
          finaliza: this.vacationForm.endDate
        })
        .eq('id', editing.id);

      if (error) {
        this.toastService.error('Error al actualizar', { description: 'No se pudo actualizar la vacación' });
      } else {
        this.toastService.success('Vacación actualizada', { description: 'Los cambios han sido guardados correctamente' });
      }
    } else {
      const { error } = await this.authService.getSupabase()
        .from('vacaciones')
        .insert({
          empleado_id: parseInt(this.vacationForm.employeeId),
          comienza: this.vacationForm.startDate,
          finaliza: this.vacationForm.endDate,
          estado: 'temporal'
        });

      if (error) {
        this.toastService.error('Error al crear', { description: 'No se pudo crear la vacación' });
      } else {
        this.toastService.success('Vacación creada', { description: 'La nueva vacación ha sido agregada' });
      }
    }

    await this.loadVacations();
    this.closeVacationModal();
  }

  requestDeleteEmployee(employee: Employee): void {
    this.employeeToDelete.set(employee);
    this.showDeleteConfirm.set(true);
  }

  cancelDelete(): void {
    this.showDeleteConfirm.set(false);
    this.employeeToDelete.set(null);
  }

  openStatusModal(employee: Employee, action: 'renuncia' | 'despedido' | 'cambio_sucursal'): void {
    this.statusEmployee.set(employee);
    this.statusAction.set(action);
    this.newBranchId = null;
    this.showStatusModal.set(true);
  }

  closeStatusModal(): void {
    this.showStatusModal.set(false);
    this.statusEmployee.set(null);
    this.statusAction.set(null);
    this.newBranchId = null;
  }

  async confirmStatusChange(): Promise<void> {
    const employee = this.statusEmployee();
    const action = this.statusAction();
    if (!employee || !action) return;

    const branch = this.authService.selectedBranch();
    if (!branch) return;

    if (action === 'cambio_sucursal') {
      if (!this.newBranchId) return;

      const { error: error1 } = await this.authService.getSupabase()
        .from('ex_empleados')
        .insert({
          nombre: employee.name,
          funciones: employee.functions,
          puesto_contratado: employee.defaultFunction,
          jornada_semanal: employee.weeklyHours,
          franco: employee.dayOff,
          carga_horaria: JSON.stringify(employee.shifts),
          nro_vendedor: (employee as any).nro_vendedor || null,
          branch_id: this.newBranchId,
          sucursal_origen: branch.id,
          fecha_salida: new Date().toISOString().split('T')[0],
          motivo_salida: 'cambio_sucursal',
          sucursal_destino: this.newBranchId
        });

      const { error: error2 } = await this.authService.getSupabase()
        .from('empleados')
        .update({ branch_id: this.newBranchId })
        .eq('id', employee.id);

      if (error1 || error2) {
        this.toastService.error('Error', { description: 'No se pudo realizar el cambio de sucursal' });
      } else {
        this.toastService.success('Cambio de sucursal', { description: `${employee.name} ha sido asignado a otra sucursal` });
      }

    } else if (action === 'renuncia') {
      const { error: error1 } = await this.authService.getSupabase()
        .from('ex_empleados')
        .insert({
          nombre: employee.name,
          funciones: employee.functions,
          puesto_contratado: employee.defaultFunction,
          jornada_semanal: employee.weeklyHours,
          franco: employee.dayOff,
          carga_horaria: JSON.stringify(employee.shifts),
          nro_vendedor: (employee as any).nro_vendedor || null,
          branch_id: branch.id,
          sucursal_origen: branch.id,
          fecha_salida: new Date().toISOString().split('T')[0],
          motivo_salida: 'renuncia'
        });

      const { error: error2 } = await this.authService.getSupabase()
        .from('empleados')
        .update({ trabajando: false })
        .eq('id', employee.id);

      if (error1 || error2) {
        this.toastService.error('Error', { description: 'No se pudo registrar la renuncia' });
      } else {
        this.toastService.success('Renuncia registrada', { description: `${employee.name} ha sido dado de baja por renuncia` });
      }

    } else {
      const { error: error1 } = await this.authService.getSupabase()
        .from('ex_empleados')
        .insert({
          nombre: employee.name,
          funciones: employee.functions,
          puesto_contratado: employee.defaultFunction,
          jornada_semanal: employee.weeklyHours,
          franco: employee.dayOff,
          carga_horaria: JSON.stringify(employee.shifts),
          nro_vendedor: (employee as any).nro_vendedor || null,
          branch_id: branch.id,
          sucursal_origen: branch.id,
          fecha_salida: new Date().toISOString().split('T')[0],
          motivo_salida: 'despedido'
        });

      const { error: error2 } = await this.authService.getSupabase()
        .from('empleados')
        .update({ trabajando: false })
        .eq('id', employee.id);

      if (error1 || error2) {
        this.toastService.error('Error', { description: 'No se pudo registrar el despido' });
      } else {
        this.toastService.success('Despido registrado', { description: `${employee.name} ha sido dado de baja` });
      }
    }

    await this.authService.refreshEmployeesForCurrentBranch();
    this.closeStatusModal();
  }

  async confirmDelete(): Promise<void> {
    const emp = this.employeeToDelete();
    if (!emp) return;

    const { error } = await this.authService.getSupabase()
      .from('empleados')
      .update({ trabajando: false })
      .eq('id', emp.id);

    if (error) {
      this.toastService.error('Error', { description: 'No se pudo eliminar el empleado' });
    } else {
      this.toastService.success('Empleado eliminado', { description: `${emp.name} ha sido dado de baja` });
    }

    await this.authService.refreshEmployeesForCurrentBranch();
    this.showDeleteConfirm.set(false);
    this.employeeToDelete.set(null);
  }

  getEmployeeName(employeeId: number): string {
    const emp = this.allEmployees.find(e => e.id === employeeId);
    return emp?.name || 'Desconocido';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-ES');
  }

  history = this.historyService.history;

  openHistoryPreview(entry: ScheduleHistory): void {
    this.historyPreviewEntry.set(entry);
    this.showHistoryPreviewModal.set(true);
  }

  closeHistoryPreview(): void {
    this.historyPreviewEntry.set(null);
    this.showHistoryPreviewModal.set(false);
  }

  confirmDeleteHistory(entry: ScheduleHistory): void {
    this.historyToDelete.set(entry);
    this.showHistoryDeleteConfirm.set(true);
  }

  cancelDeleteHistory(): void {
    this.historyToDelete.set(null);
    this.showHistoryDeleteConfirm.set(false);
  }

  async finalizeHistoryEntry(entry: ScheduleHistory): Promise<void> {
    const success = await this.historyService.finalizeEntry(entry.id);
    if (success) {
      this.toastService.success('Horario finalizado', { description: 'El horario ha sido marcado como finalizado' });
      await this.historyService.loadFromDatabase();
    } else {
      this.toastService.error('Error', { description: 'No se pudo finalizar el horario' });
    }
  }

  async deleteHistoryEntry(): Promise<void> {
    const entry = this.historyToDelete();
    if (!entry) return;

    const success = await this.historyService.deleteEntry(entry.id);
    if (success) {
      this.toastService.success('Eliminado', { description: 'El horario ha sido eliminado correctamente' });
    } else {
      this.toastService.error('Error', { description: 'No se pudo eliminar el horario' });
    }
    this.cancelDeleteHistory();
  }

  async downloadHistoryPDF(): Promise<void> {
    const entry = this.historyPreviewEntry();
    if (!entry) return;

    this.generatePDFForEntry(entry);
    this.toastService.success('Descarga', { description: 'El PDF se ha descargado correctamente' });
  }

  async downloadHistoryPDFDirect(entry: ScheduleHistory): Promise<void> {
    this.generatePDFForEntry(entry);
    this.toastService.success('Descarga', { description: 'El PDF se ha descargado correctamente' });
  }

  private generatePDFForEntry(entry: ScheduleHistory): void {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const title = `Horario - ${entry.date}`;
    const branch = this.authService.selectedBranch();

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, pageWidth / 2, margin + 4, { align: 'center' });
    if (branch) {
      pdf.setFontSize(9);
      pdf.text(branch.name, pageWidth / 2, margin + 8, { align: 'center' });
    }

    const francolLabelWidth = 50;
    const francolX = pageWidth - margin - francolLabelWidth;
    const francolY = margin + 5;
    const days: DayOfWeek[] = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const date = new Date(entry.scheduleDate + 'T00:00:00');
    const dayOfWeek = days[date.getDay()];

    const employees = this.employees();
    const francolEmployees = employees.filter(emp => emp.dayOff === dayOfWeek);

    const hasFranco = francolEmployees.length > 0;
    const francolHeight = hasFranco ? 8 + francolEmployees.length * 4 : 0;

    const areaLabelWidth = 40;
    const hourWidth = (pageWidth - margin * 2 - areaLabelWidth) / this.workHours.length;
    const rowHeight = 10;
    const headerHeight = 12;
    const startY = hasFranco ? margin + 18 + francolHeight : margin + 18;

    if (hasFranco) {
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text('FRANCO:', francolX, francolY);

      let yOffset = francolY + 5;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      francolEmployees.forEach(emp => {
        pdf.text(emp.name, francolX, yOffset);
        yOffset += 4;
      });
    }

    const funcColors: Record<JobFunction, [number, number, number]> = {
      cajero: [59, 130, 246],
      vendedor: [16, 185, 129],
      perfumera: [236, 72, 153],
      salon: [147, 51, 234],
      inventario: [245, 158, 11],
      limpieza: [107, 114, 128],
      atencion_bot: [34, 211, 238],
      encargado: [220, 38, 38],
      nochero: [30, 41, 59],
      seguridad: [20, 184, 166]
    };

    const drawGridHeader = (): void => {
    pdf.setFillColor(243, 244, 246);
      pdf.rect(margin, startY, pageWidth - margin * 2, headerHeight, 'F');

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(75, 85, 99);
      pdf.text('Área', margin + 2, startY + 5);

      this.workHours.forEach((hour) => {
        const x = margin + areaLabelWidth + (hour - 6) * hourWidth;
        pdf.text(`${hour}:00`, x + hourWidth / 2, startY + 5, { align: 'center' });
      });
    };

    drawGridHeader();

    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.3);

    const areaSchedules = this.rebuildSchedulesFromHistory(entry.placedEmployees);

    let currentY = startY + headerHeight;

    areaSchedules.forEach((areaSchedule) => {
      const hasAnyEmployee = areaSchedule.tracks.some(track => track.length > 0);
      if (!hasAnyEmployee) return;

      const maxTracks = areaSchedule.tracks.length;
      const areaRowHeight = rowHeight * maxTracks;

      if (currentY + areaRowHeight > pageHeight - margin - 9) {
        pdf.addPage();
        currentY = startY;
        drawGridHeader();
      }

      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, currentY, areaLabelWidth, areaRowHeight, 'F');

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55);
      pdf.text(this.areaLabels[areaSchedule.area], margin + 2, currentY + areaRowHeight / 2 + 1);

      pdf.setDrawColor(229, 231, 235);
      pdf.rect(margin, currentY, areaLabelWidth, areaRowHeight);

      this.workHours.forEach((_, i) => {
        const x = margin + areaLabelWidth + i * hourWidth;
        pdf.rect(x, currentY, hourWidth, areaRowHeight);
      });

      areaSchedule.tracks.forEach((track, trackIndex) => {
        const trackY = currentY + trackIndex * rowHeight;

        track.forEach((schedule) => {
          const isNight = areaSchedule.area === 'noche';
          const shiftStart = schedule.shift.start;
          const shiftEnd = schedule.shift.end;
          const gridWidth = pageWidth - margin * 2 - areaLabelWidth;
          const leftX = margin + areaLabelWidth + (isNight ? 0 : ((shiftStart - 6) / 18) * gridWidth);
          const rightX = margin + areaLabelWidth + (isNight ? gridWidth : ((shiftEnd - 6) / 18) * gridWidth);
          const color = funcColors[schedule.function];

          let name = ((schedule.employee as any).name || '').split(' ')[0];
          if (isNight && shiftEnd > NIGHT_SHIFT_NORMAL_END) {
            name = `${name} - hasta 12:00`;
          }
          this.drawShiftArrow(pdf, leftX, rightX, trackY, rowHeight, name, color, 6);
        });
      });

      currentY += areaRowHeight;
    });

    const branchName = branch?.name || 'Sucursal';
    pdf.save(`horario_${branchName}_${entry.scheduleDate}.pdf`);
  }

  getCurrentDayOff(): DayOfWeek {
    const days: DayOfWeek[] = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const date = new Date(this.scheduleDate() + 'T00:00:00');
    const dayIndex = date.getDay();
    return days[dayIndex];
  }

  isEmployeeOnDayOff(employee: Employee): boolean {
    const dateStr = this.scheduleDate();
    if (this.isEmployeeWorkingViaException(employee.id, dateStr)) return false;
    if (this.isEmployeeRestingViaException(employee.id, dateStr)) return true;
    return employee.dayOff === this.getCurrentDayOff();
  }

  getPreviewEntriesForArea(entry: ScheduleHistory, area: Area): PlacedEmployeeData[] {
    return entry.placedEmployees.filter(p => p.area === area);
  }

  getPreviewCellEntries(entry: ScheduleHistory, area: Area, hour: number): PlacedEmployeeData[] {
    return entry.placedEmployees.filter(p =>
      p.area === area && p.shifts.some(s => hour >= s.start && hour < s.end)
    );
  }

  getPreviewAreaSchedules(entry: ScheduleHistory): AreaSchedule[] {
    return this.rebuildSchedulesFromHistory(entry.placedEmployees);
  }

  getFunctionColor(fn: JobFunction): string {
    const colors: Record<JobFunction, string> = {
      cajero: '#3b82f6',
      vendedor: '#10b981',
      perfumera: '#ec4899',
      salon: '#9333ea',
      inventario: '#f59e0b',
      limpieza: '#6b7280',
      atencion_bot: '#22d3ee',
      encargado: '#dc2626',
      nochero: '#1e293b',
      seguridad: '#14b8a6'
    };
    return colors[fn] || '#9ca3af';
  }

  isToday(): boolean {
    return this.scheduleDate() === new Date().toISOString().split('T')[0];
  }

  isDateInHistory(date: string): boolean {
    return this.historyService.history().some(h => h.scheduleDate === date);
  }

  private isDateInPast(date: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return date < today;
  }

  goToToday(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.isDateInPast(today)) {
      this.toastService.error('Fecha no disponible', { description: 'No podés editar horarios de días que ya pasaron.' });
      return;
    }
    this.scheduleDate.set(today);
  }

  goToPreviousDay(): void {
    const current = new Date(this.scheduleDate() + 'T00:00:00');
    current.setDate(current.getDate() - 1);
    const prevDate = current.toISOString().split('T')[0];

    if (this.isDateInPast(prevDate)) {
      this.toastService.error('Fecha no disponible', { description: 'No podés editar horarios de días que ya pasaron.' });
      return;
    }

    this.placedEmployees.set([]);
    this.scheduleSaved.set(true);
    this.scheduleDate.set(prevDate);
    this.initEmptySchedule();
  }

  toggleDatePicker(): void {
    this.showDatePicker.update(v => !v);
  }

  isEmployeeOnVacation(employeeId: number): boolean {
    const dateStr = this.scheduleDate();
    return this.vacations().some((v) => {
      const startStr = v.startDate.split('T')[0];
      const endStr = v.endDate.split('T')[0];
      return v.employeeId === employeeId && dateStr >= startStr && dateStr <= endStr;
    });
  }

  getActiveExceptionsFor(employeeId: number, dateStr: string): EmployeeException[] {
    return this.exceptionService
      .exceptions()
      .filter((x) => x.employeeId === employeeId && exceptionAppliesOn(x, dateStr));
  }

  isEmployeeWorkingViaException(employeeId: number, dateStr: string): boolean {
    return this.getActiveExceptionsFor(employeeId, dateStr).length > 0;
  }

  isEmployeeRestingViaException(employeeId: number, dateStr: string): boolean {
    return this.exceptionService
      .exceptions()
      .some((x) => x.type === 'espontanea' && x.coveredEmployeeId === employeeId && exceptionAppliesOn(x, dateStr));
  }

  getExceptionBadge(employee: Employee): string | null {
    const excs = this.getActiveExceptionsFor(employee.id, this.scheduleDate());
    if (excs.length === 0) return null;
    return excs
      .map((exc) => {
        const covered = exc.coveredEmployeeId ? this.allEmployees.find((e) => e.id === exc.coveredEmployeeId) : null;
        const fn = this.functionLabels[exc.function];
        return covered ? `${fn} · cubre a ${covered.name.split(' ')[0]}` : fn;
      })
      .join(' · ');
  }

  getEmployeeNameById(employeeId: number | null): string {
    if (employeeId === null) return '-';
    return this.allEmployees.find((e) => e.id === employeeId)?.name ?? 'Desconocido';
  }

  getDayOffNamesForDate(dateStr: string, placedEmployeeIds: number[]): string {
    const days: DayOfWeek[] = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const date = new Date(dateStr + 'T00:00:00');
    const weekday = days[date.getDay()];
    return this.allEmployees
      .filter(
        (e) =>
          e.dayOff === weekday &&
          !e.functions.includes('encargado') &&
          !placedEmployeeIds.includes(e.id) &&
          !this.vacations().some((v) => {
            const startStr = v.startDate.split('T')[0];
            const endStr = v.endDate.split('T')[0];
            return v.employeeId === e.id && dateStr >= startStr && dateStr <= endStr;
          })
      )
      .map((e) => e.name.split(' ')[0])
      .join(', ');
  }

  private drawFrancosLine(pdf: jsPDF, francos: string, x: number, y: number): void {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(55, 65, 81);
    pdf.text('Francos:', x, y);
    const labelWidth = pdf.getTextWidth('Francos:');
    pdf.setFont('helvetica', 'normal');
    pdf.text(francos || '-', x + labelWidth + 1.5, y);
  }

  private drawShiftArrow(
    pdf: jsPDF,
    leftX: number,
    rightX: number,
    trackY: number,
    rowHeight: number,
    name: string,
    color: [number, number, number],
    fontSize: number
  ): void {
    const arrowY = trackY + rowHeight - 2.5;
    const headLength = 1.3;
    const headHalf = 0.8;

    pdf.setDrawColor(color[0], color[1], color[2]);
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.setLineWidth(0.4);
    pdf.line(leftX, arrowY, rightX, arrowY);
    pdf.triangle(leftX, arrowY, leftX + headLength, arrowY - headHalf, leftX + headLength, arrowY + headHalf, 'F');
    pdf.triangle(rightX, arrowY, rightX - headLength, arrowY - headHalf, rightX - headLength, arrowY + headHalf, 'F');

    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55);
    pdf.text(name, (leftX + rightX) / 2, arrowY - 1.2, { align: 'center' });
  }

  getAvailableEmployees(): Employee[] {
    return this.allEmployees.filter((e) =>
      !this.isEmployeePlaced(e.id) &&
      !this.isEmployeeOnDayOff(e) &&
      !this.isEmployeeOnVacation(e.id) &&
      !e.functions.includes('encargado')
    );
  }

  getEmployeesOnDayOff(): Employee[] {
    return this.allEmployees.filter((e) =>
      !this.isEmployeePlaced(e.id) &&
      this.isEmployeeOnDayOff(e) &&
      !this.isEmployeeOnVacation(e.id) &&
      !e.functions.includes('encargado')
    );
  }

  getEmployeesOnVacation(): Employee[] {
    return this.allEmployees.filter((e) =>
      !this.isEmployeePlaced(e.id) &&
      this.isEmployeeOnVacation(e.id) &&
      !e.functions.includes('encargado')
    );
  }

  getEncargados(): Employee[] {
    return this.allEmployees.filter((e) => e.functions.includes('encargado'));
  }

  getVacationDates(employeeId: number): string {
    const vacation = this.vacations().find((v) => v.employeeId === employeeId);
    if (!vacation) return '';
    const start = new Date(vacation.startDate + 'T00:00:00').toLocaleDateString('es-ES');
    const end = new Date(vacation.endDate + 'T00:00:00').toLocaleDateString('es-ES');
    return `${start} - ${end}`;
  }

  initEmptySchedule(): void {
    this.areaSchedules.set(
      this.areas.map((area) => ({
        area,
        tracks: [],
      }))
    );
  }

  clearGrid(): void {
    this.placedEmployees.set([]);
    this.scheduleSaved.set(false);
    this.initEmptySchedule();
  }

  onDragStarted(employee: Employee): void {
    this.draggedEmployee.set(employee);
  }

  onDragEnded(event: DragEvent): void {
    this.draggedEmployee.set(null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDropOnCell(event: DragEvent, area: Area, hour: number): void {
    event.preventDefault();
    const employeeJson = event.dataTransfer?.getData('text/plain');
    if (!employeeJson) return;

    try {
      const employee = JSON.parse(employeeJson) as Employee;
      if (area === 'noche' && employee.functions.includes('nochero')) {
        this.nightShiftEmployee.set(employee);
        this.showNightShiftModal.set(true);
        return;
      }
      this.modalEmployee.set(employee);
      this.modalArea.set(area);
      this.modalDropHour.set(hour);
      this.showModal.set(true);
    } catch (e) {
      console.error('Failed to parse employee data', e);
    }
  }

  placeNightEmployee(extended: boolean): void {
    const employee = this.nightShiftEmployee();
    if (!employee) return;

    const newPlaced: PlacedEmployee = {
      id: Date.now(),
      employee,
      area: 'noche',
      function: 'nochero',
      shifts: [
        {
          start: NIGHT_SHIFT_START,
          end: extended ? NIGHT_SHIFT_EXTENDED_END : NIGHT_SHIFT_NORMAL_END,
        },
      ],
    };

    this.placedEmployees.update((list) => [...list, newPlaced]);
    this.scheduleSaved.set(false);
    this.rebuildSchedules();
    this.closeNightShiftModal();
  }

  closeNightShiftModal(): void {
    this.showNightShiftModal.set(false);
    this.nightShiftEmployee.set(null);
  }

  isNightShiftExtended(shift: ShiftBlock): boolean {
    return shift.end > NIGHT_SHIFT_NORMAL_END;
  }

  onEmployeeDragStart(event: DragEvent, employee: Employee): void {
    event.dataTransfer?.setData('text/plain', JSON.stringify(employee));
    event.dataTransfer!.effectAllowed = 'move';
  }

  onModalSave(data: { function: JobFunction; shifts: ShiftBlock[] }): void {
    const editingId = this.modalEditingId();
    const shifts = normalizeShiftBlocks(data.shifts);
    if (shifts.length === 0) return;

    if (editingId !== null) {
      this.placedEmployees.update((list) =>
        list.map((p) =>
          p.id === editingId
            ? { ...p, function: data.function, shifts, area: FUNCTION_TO_AREA[data.function] }
            : p
        )
      );
    } else {
      const employee = this.modalEmployee();
      if (!employee) return;

      const area = FUNCTION_TO_AREA[data.function];
      const placedId = Date.now();
      const newPlaced: PlacedEmployee = {
        id: placedId,
        employee,
        area,
        function: data.function,
        shifts,
      };

      this.placedEmployees.update((list) => [...list, newPlaced]);
    }

    this.scheduleSaved.set(false);
    this.rebuildSchedules();
    this.closeModal();
  }

  openEditModal(placedId: number): void {
    const placed = this.placedEmployees().find((p) => p.id === placedId);
    if (!placed) return;

    this.modalEmployee.set(placed.employee);
    this.modalArea.set(placed.area);
    this.modalDropHour.set(placed.shifts[0]?.start || 7);
    this.modalEditingId.set(placedId);
    this.modalEditingFunction.set(placed.function);
    this.modalEditingShifts.set(placed.shifts);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.modalEmployee.set(null);
    this.modalArea.set(null);
    this.modalDropHour.set(0);
    this.modalEditingId.set(null);
    this.modalEditingFunction.set(null);
    this.modalEditingShifts.set(null);
  }

  rebuildSchedules(): void {
    const placed = this.placedEmployees();

    const newSchedules = this.areas.map((area) => {
      let areaPlacements = placed.filter((p) => p.area === area);

      if (area === 'mostrador') {
        areaPlacements.sort((a, b) => {
          const aStart = Math.min(...a.shifts.map(s => s.start));
          const bStart = Math.min(...b.shifts.map(s => s.start));
          if (a.function === 'vendedor' && b.function !== 'vendedor') return -1;
          if (a.function !== 'vendedor' && b.function === 'vendedor') return 1;
          return aStart - bStart;
        });
      }

      const tracks: EmployeeShiftSchedule[][] = [];

      areaPlacements.forEach((placement) => {
        const trackIndex = tracks.length;
        tracks[trackIndex] = [];

        placement.shifts.forEach((shift) => {
          const duration = shift.end - shift.start;
          if (duration <= 0) return;

          tracks[trackIndex].push({
            placedId: placement.id,
            employee: placement.employee,
            function: placement.function,
            shift,
            trackIndex,
          });
        });
      });

      return { area, tracks };
    });

    this.areaSchedules.set(newSchedules);
  }

  rebuildSchedulesFromHistory(placedData: PlacedEmployeeData[]): AreaSchedule[] {
    const newSchedules = this.areas.map((area) => {
      let areaPlacements = placedData.filter((p) => p.area === area);

      if (area === 'mostrador') {
        areaPlacements.sort((a, b) => {
          const aStart = Math.min(...a.shifts.map(s => s.start));
          const bStart = Math.min(...b.shifts.map(s => s.start));
          if (a.function === 'vendedor' && b.function !== 'vendedor') return -1;
          if (a.function !== 'vendedor' && b.function === 'vendedor') return 1;
          return aStart - bStart;
        });
      }

      const tracks: EmployeeShiftSchedule[][] = [];

      areaPlacements.forEach((placement, idx) => {
        const trackIndex = tracks.length;
        tracks[trackIndex] = [];

        const minimalEmployee: MinimalEmployee = {
          id: placement.employeeId,
          name: placement.employeeName
        };

        placement.shifts.forEach((shift) => {
          const duration = shift.end - shift.start;
          if (duration <= 0) return;

          tracks[trackIndex].push({
            placedId: idx,
            employee: minimalEmployee as any,
            function: placement.function,
            shift,
            trackIndex,
          });
        });
      });

      return { area, tracks };
    });

    return newSchedules;
  }

  removePlacedEmployee(placedId: number): void {
    this.placedEmployees.update((list) => list.filter((p) => p.id !== placedId));
    this.scheduleSaved.set(false);
    this.rebuildSchedules();
  }

  getBarStyle(shift: ShiftBlock): Record<string, string> {
    if (shift.end > 24) {
      return { left: '0%', width: '100%' };
    }
    const leftPercent = ((shift.start - 6) / 18) * 100;
    const widthPercent = ((shift.end - shift.start) / 18) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    };
  }

  getBarColor(func: JobFunction): string {
    const colors: Record<JobFunction, string> = {
      cajero: 'bg-blue-500',
      vendedor: 'bg-emerald-500',
      perfumera: 'bg-pink-500',
      salon: 'bg-purple-500',
      inventario: 'bg-amber-500',
      limpieza: 'bg-gray-500',
      atencion_bot: 'bg-cyan-500',
      encargado: 'bg-red-600',
      nochero: 'bg-slate-800',
      seguridad: 'bg-teal-500'
    };
    return colors[func];
  }

  formatHour(hour: number): string {
    if (hour === 0) return '00:00';
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  getCurrentDateFormatted(): string {
    const now = new Date();
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    return `${dayName} ${day} de ${month} de ${year}`;
  }

  getScheduleDateFormatted(): string {
    const date = new Date(this.scheduleDate() + 'T00:00:00');
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName} ${day} de ${month} de ${year}`;
  }

  hasPlacedEmployees(): boolean {
    return this.placedEmployees().length > 0;
  }

  goToNextDay(): void {
    if (this.hasPlacedEmployees() && !this.scheduleSaved()) {
      this.toastService.warning('Cambios sin guardar', {
        description: 'Tienes empleados en la grilla sin guardar. ¿Querés descartar los cambios y avanzar?',
        button: {
          title: 'Descartar y avanzar',
          onClick: () => this.confirmNextDay()
        }
      });
    } else {
      this.advanceToNextDay();
    }
  }

  confirmNextDay(): void {
    this.clearGrid();
    this.scheduleSaved.set(false);
    this.advanceToNextDay();
  }

  advanceToNextDay(): void {
    const current = new Date(this.scheduleDate() + 'T00:00:00');
    current.setDate(current.getDate() + 1);
    this.scheduleDate.set(current.toISOString().split('T')[0]);
    this.placedEmployees.set([]);
    this.scheduleSaved.set(true);
    this.initEmptySchedule();
  }

  openDatePicker(): void {
    const input = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (input) {
      input.min = new Date().toISOString().split('T')[0];
      input.showPicker();
    }
  }

  onDateSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedDate = input.value;

    if (this.isDateInPast(selectedDate)) {
      this.toastService.error('Fecha no disponible', { description: 'No podés seleccionar días que ya pasaron.' });
      return;
    }

    if (this.hasPlacedEmployees() && !this.scheduleSaved()) {
      this.toastService.warning('Cambios sin guardar', {
        description: '¿Querés descartar los cambios y cambiar de fecha?',
        button: {
          title: 'Descartar y cambiar',
          onClick: () => {
            this.clearGrid();
            this.scheduleSaved.set(false);
            this.scheduleDate.set(selectedDate);
          }
        }
      });
    } else {
      this.scheduleDate.set(selectedDate);
    }
  }

  getFunctionBadgeColor(func: JobFunction): string {
    const colors: Record<JobFunction, string> = {
      cajero: 'bg-blue-100 text-blue-800',
      vendedor: 'bg-green-100 text-green-800',
      perfumera: 'bg-pink-100 text-pink-800',
      salon: 'bg-purple-100 text-purple-800',
      inventario: 'bg-yellow-100 text-yellow-800',
      limpieza: 'bg-gray-100 text-gray-800',
      atencion_bot: 'bg-cyan-100 text-cyan-800',
      encargado: 'bg-red-100 text-red-800',
      nochero: 'bg-slate-100 text-slate-800',
      seguridad: 'bg-teal-100 text-teal-800'
    };
    return colors[func];
  }

  getEmployeeFunctions(employee: Employee): JobFunction[] {
    return employee.functions;
  }

  getEmployeeShifts(employee: Employee): string {
    const fmt = (h: number) => `${h >= 24 ? h - 24 : h}:00`;
    return employee.shifts.map((s) => `${fmt(s.start)}-${fmt(s.end)}`).join(' / ');
  }

  getEmployeeNroVendedor(employee: Employee): string {
    return (employee as any).nro_vendedor || '-';
  }

  getEmployeeTotalHours(employee: Employee): number {
    return employee.shifts.reduce((sum, s) => sum + (s.end - s.start), 0);
  }

  isSplitShift(employee: Employee): boolean {
    return employee.shifts.length > 1;
  }

  isEmployeePlaced(employeeId: number): boolean {
    return this.placedEmployees().some((p) => p.employee.id === employeeId);
  }

  // getAvailableEmployees(): Employee[] {
  //   return this.allEmployees().filter((e) => !this.isEmployeePlaced(e.id));
  // }

  autoAssignEmployees(): void {
    const available = this.getAvailableEmployees();
    const newPlaced: PlacedEmployee[] = [];
    const dateStr = this.scheduleDate();

    available.forEach((employee) => {
      const exceptions = this.getActiveExceptionsFor(employee.id, dateStr);

      if (exceptions.length > 0) {
        const excShifts = exceptions.flatMap((exc) => exc.shifts);

        exceptions.forEach((exc, idx) => {
          newPlaced.push({
            id: Date.now() + idx + Math.random(),
            employee,
            area: FUNCTION_TO_AREA[exc.function],
            function: exc.function,
            shifts: exc.shifts.length > 0 ? exc.shifts : employee.shifts,
          });
        });

        const isSplitJornada = employee.shifts.length > 1;
        const overlapsOwnJornada = excShifts.some((used) =>
          employee.shifts.some((own) => used.start < own.end && own.start < used.end)
        );
        if (isSplitJornada && overlapsOwnJornada) {
          const remaining = this.subtractShiftBlocks(employee.shifts, excShifts);
          if (remaining.length > 0) {
            newPlaced.push({
              id: Date.now() + 100 + Math.random(),
              employee,
              area: FUNCTION_TO_AREA[employee.defaultFunction],
              function: employee.defaultFunction,
              shifts: remaining,
            });
          }
        }
        return;
      }

      const effFunction = employee.defaultFunction;
      const area = FUNCTION_TO_AREA[effFunction];
      const shifts =
        effFunction === 'nochero'
          ? [{ start: NIGHT_SHIFT_START, end: NIGHT_SHIFT_NORMAL_END }]
          : employee.shifts;

      newPlaced.push({
        id: Date.now() + Math.random(),
        employee,
        area,
        function: effFunction,
        shifts,
      });
    });

    this.placedEmployees.update((list) => [...list, ...newPlaced]);
    this.scheduleSaved.set(false);
    this.rebuildSchedules();
  }

  private subtractShiftBlocks(from: ShiftBlock[], covered: ShiftBlock[]): ShiftBlock[] {
    const result: ShiftBlock[] = [];
    from.forEach((block) => {
      let pieces: ShiftBlock[] = [{ start: block.start, end: block.end }];
      covered.forEach((cover) => {
        const next: ShiftBlock[] = [];
        pieces.forEach((piece) => {
          if (cover.start >= piece.end || cover.end <= piece.start) {
            next.push(piece);
          } else {
            if (piece.start < cover.start) {
              next.push({ start: piece.start, end: cover.start });
            }
            if (cover.end < piece.end) {
              next.push({ start: cover.end, end: piece.end });
            }
          }
        });
        pieces = next;
      });
      result.push(...pieces.filter((p) => p.end > p.start));
    });
    return result;
  }

  async saveScheduleToHistory(): Promise<void> {
    const currentDate = this.getCurrentDateFormatted();
    const scheduleDateStr = this.scheduleDate();
    const branch = this.authService.selectedBranch();
    if (!branch) return;

    const placedData: PlacedEmployeeData[] = this.placedEmployees().map(p => ({
      employeeId: p.employee.id,
      employeeName: p.employee.name,
      area: p.area,
      function: p.function,
      shifts: p.shifts
    }));

    const { data: existing, error: selectError } = await this.authService.getSupabase()
      .from('historial_horarios')
      .select('id')
      .eq('branch_id', branch.id.toString())
      .eq('schedule_date', scheduleDateStr)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Error checking existing schedule:', selectError);
      this.toastService.error('Error', { description: 'No se pudo verificar el horario existente' });
      return;
    }

    if (existing) {
      const { error: updateError } = await this.authService.getSupabase()
        .from('historial_horarios')
        .update({
          placed_employees: JSON.stringify(placedData),
          created_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('Error updating schedule:', updateError);
        this.toastService.error('Error', { description: 'No se pudo actualizar el horario' });
      } else {
        this.scheduleSaved.set(true);
        if (!this.lastSavedScheduleDate() || scheduleDateStr > this.lastSavedScheduleDate()!) {
          this.lastSavedScheduleDate.set(scheduleDateStr);
          const nextDay = new Date(scheduleDateStr + 'T00:00:00');
          nextDay.setDate(nextDay.getDate() + 1);
          this.minScheduleDate.set(nextDay.toISOString().split('T')[0]);
        }
        this.toastService.success('Horario actualizado', { description: 'El horario se guardó correctamente' });
        await this.historyService.loadFromDatabase();
      }
    } else {
      const { error: insertError } = await this.authService.getSupabase()
        .from('historial_horarios')
        .insert({
          branch_id: branch.id.toString(),
          schedule_date: scheduleDateStr,
          placed_employees: JSON.stringify(placedData)
        });

      if (insertError) {
        console.error('Error inserting schedule:', insertError);
        this.toastService.error('Error', { description: 'No se pudo guardar el horario' });
      } else {
        this.scheduleSaved.set(true);
        if (!this.lastSavedScheduleDate() || scheduleDateStr > this.lastSavedScheduleDate()!) {
          this.lastSavedScheduleDate.set(scheduleDateStr);
          const nextDay = new Date(scheduleDateStr + 'T00:00:00');
          nextDay.setDate(nextDay.getDate() + 1);
          this.minScheduleDate.set(nextDay.toISOString().split('T')[0]);
        }
        this.toastService.success('Horario guardado', { description: 'El horario se guardó correctamente' });
        await this.historyService.loadFromDatabase();
      }
    }
  }

  async exportToPDF(): Promise<void> {
    try {
      const currentDate = this.getCurrentDateFormatted();
      const placedData: PlacedEmployeeData[] = this.placedEmployees().map(p => ({
        employeeId: p.employee.id,
        employeeName: p.employee.name,
        area: p.area,
        function: p.function,
        shifts: p.shifts
      }));
      this.saveSchedule.emit({ date: currentDate, placedEmployees: placedData });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const title = `Horarios Farmacia - ${this.getCurrentDateFormatted()}`;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, pageWidth / 2, margin + 4, { align: 'center' });

      const francos = this.getDayOffNamesForDate(
        this.scheduleDate(),
        this.placedEmployees().map((p) => p.employee.id)
      );

      const areaLabelWidth = 35;
      const hourWidth = (pageWidth - margin * 2 - areaLabelWidth) / this.workHours.length;
      const rowHeight = 6;
      const headerHeight = 7;
      const startY = margin + 9;

      const funcColors: Record<JobFunction, [number, number, number]> = {
        cajero: [59, 130, 246],
        vendedor: [16, 185, 129],
        perfumera: [236, 72, 153],
        salon: [147, 51, 234],
        inventario: [245, 158, 11],
        limpieza: [107, 114, 128],
        atencion_bot: [34, 211, 238],
        encargado: [220, 38, 38],
        nochero: [30, 41, 59],
        seguridad: [20, 184, 166]
      };

      const drawGridHeader = (): void => {
        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, startY, pageWidth - margin * 2, headerHeight, 'F');

        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(75, 85, 99);
        pdf.text('Área', margin + 2, startY + 5);

        this.workHours.forEach((hour, i) => {
          const x = margin + areaLabelWidth + i * hourWidth;
          pdf.text(`${hour}:00`, x + hourWidth / 2, startY + 5, { align: 'center' });
        });
      };

      drawGridHeader();

      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.3);

      let currentY = startY + headerHeight;

      this.areaSchedules().forEach((areaSchedule) => {
        const maxTracks = areaSchedule.tracks.length;
        const areaRowHeight = maxTracks > 0 ? rowHeight * maxTracks : rowHeight;

        if (currentY + areaRowHeight > pageHeight - margin - 9) {
          pdf.addPage();
          currentY = startY;
          drawGridHeader();
        }

        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, currentY, areaLabelWidth, areaRowHeight, 'F');

        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(31, 41, 55);
        pdf.text(this.areaLabels[areaSchedule.area], margin + 2, currentY + areaRowHeight / 2 + 1);

        pdf.setDrawColor(229, 231, 235);
        pdf.rect(margin, currentY, areaLabelWidth, areaRowHeight);

        this.workHours.forEach((_, i) => {
          const x = margin + areaLabelWidth + i * hourWidth;
          pdf.rect(x, currentY, hourWidth, areaRowHeight);
        });

        areaSchedule.tracks.forEach((track, trackIndex) => {
          const trackY = currentY + trackIndex * rowHeight;

          track.forEach((schedule) => {
            const isNight = areaSchedule.area === 'noche';
            const shiftStart = schedule.shift.start;
            const shiftEnd = schedule.shift.end;
            const gridWidth = pageWidth - margin * 2 - areaLabelWidth;
            const leftX = margin + areaLabelWidth + (isNight ? 0 : ((shiftStart - 6) / 18) * gridWidth);
            const rightX = margin + areaLabelWidth + (isNight ? gridWidth : ((shiftEnd - 6) / 18) * gridWidth);
            const color = funcColors[schedule.function];

            let name = schedule.employee.name.split(' ')[0];
            if (isNight && shiftEnd > NIGHT_SHIFT_NORMAL_END) {
              name = `${name} - hasta 12:00`;
            }
            this.drawShiftArrow(pdf, leftX, rightX, trackY, rowHeight, name, color, 5.5);
          });
        });

        currentY += areaRowHeight;
      });

      this.drawFrancosLine(pdf, francos, margin, currentY + 7);

      pdf.autoPrint();
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  }
}