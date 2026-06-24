import { Component, signal, output, ElementRef, ViewChild, inject, computed } from '@angular/core';
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
} from '../../models/employee.model';
import { AuthService } from '../../services/auth.service';
import { HistoryService } from '../../services/history.service';
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
  private toastService = inject(DynamicToastService);

  employees = computed(() => {
    const branch = this.authService.selectedBranch();
    if (!branch) return [];
    return this.authService.getEmployeesForBranch(branch.id);
  });

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

  showModal = signal(false);
  modalEmployee = signal<Employee | null>(null);
  modalArea = signal<Area | null>(null);
  modalDropHour = signal<number>(0);
  modalEditingId = signal<number | null>(null);
  modalEditingFunction = signal<JobFunction | null>(null);
  modalEditingShifts = signal<ShiftBlock[] | null>(null);

  draggedEmployee = signal<Employee | null>(null);
  sidebarVisible = signal(true);
  currentSection = signal<'horario' | 'empleados' | 'vacaciones' | 'historial'>('horario');

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

  availableFunctions: JobFunction[] = ['cajero', 'vendedor', 'perfumera', 'salon', 'inventario', 'limpieza', 'atencion_bot', 'encargado'];
  allDays: DayOfWeek[] = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

  employeeSearchText = signal('');
  employeeSortField = signal<'name' | 'functions' | 'defaultFunction' | 'dayOff' | 'nroVendedor'>('name');
  employeeSortDirection = signal<'asc' | 'desc'>('asc');
  employeeSortApplied = signal(false);

  vacationSearchText = signal('');

  scheduleDate = signal(new Date().toISOString().split('T')[0]);
  minScheduleDate = new Date().toISOString().split('T')[0];
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
    this.loadVacations();
    this.loadScheduleFromHistory();
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

  async signOut(): Promise<void> {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  setSection(section: 'horario' | 'empleados' | 'vacaciones' | 'historial'): void {
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

    const empData = {
      nombre: this.employeeForm.name,
      funciones: this.employeeForm.functions,
      puesto_contratado: this.employeeForm.defaultFunction,
      jornada_semanal: this.employeeForm.shifts.reduce((sum, s) => sum + (s.end - s.start), 0),
      franco: this.employeeForm.dayOff,
      carga_horaria: JSON.stringify(this.employeeForm.shifts),
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
    const margin = 10;
    const title = `Horario - ${entry.date}`;
    const branch = this.authService.selectedBranch();

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, pageWidth / 2, margin + 5, { align: 'center' });
    if (branch) {
      pdf.setFontSize(10);
      pdf.text(branch.name, pageWidth / 2, margin + 10, { align: 'center' });
    }

    const areaLabelWidth = 40;
    const hourWidth = (pageWidth - margin * 2 - areaLabelWidth) / this.workHours.length;
    const rowHeight = 10;
    const headerHeight = 12;
    const startY = margin + 18;

    const funcColors: Record<JobFunction, [number, number, number]> = {
      cajero: [59, 130, 246],
      vendedor: [16, 185, 129],
      perfumera: [236, 72, 153],
      salon: [147, 51, 234],
      inventario: [245, 158, 11],
      limpieza: [107, 114, 128],
      atencion_bot: [34, 211, 238],
      encargado: [220, 38, 38]
    };

    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, startY, pageWidth - margin * 2, headerHeight, 'F');

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(75, 85, 99);
    pdf.text('Área', margin + 2, startY + 8);

    this.workHours.forEach((hour) => {
      const x = margin + areaLabelWidth + (hour - 6) * hourWidth;
      pdf.text(`${hour}:00`, x + hourWidth / 2, startY + 8, { align: 'center' });
    });

    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.3);

    const areaSchedules = this.rebuildSchedulesFromHistory(entry.placedEmployees);

    let currentY = startY + headerHeight;

    areaSchedules.forEach((areaSchedule) => {
      if (areaSchedule.tracks.length === 0) return;

      const maxTracks = areaSchedule.tracks.length;
      const areaRowHeight = rowHeight * maxTracks;

      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, currentY, areaLabelWidth, areaRowHeight, 'F');

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55);
      pdf.text(this.areaLabels[areaSchedule.area], margin + 2, currentY + areaRowHeight / 2 + 3);

      pdf.setDrawColor(229, 231, 235);
      pdf.rect(margin, currentY, areaLabelWidth, areaRowHeight);

      this.workHours.forEach((_, i) => {
        const x = margin + areaLabelWidth + i * hourWidth;
        pdf.rect(x, currentY, hourWidth, areaRowHeight);
      });

      areaSchedule.tracks.forEach((track, trackIndex) => {
        const trackY = currentY + trackIndex * rowHeight;

        track.forEach((schedule) => {
          const shiftStart = schedule.shift.start;
          const shiftEnd = schedule.shift.end;
          const leftX = margin + areaLabelWidth + ((shiftStart - 6) / 18) * (pageWidth - margin * 2 - areaLabelWidth);
          const rightX = margin + areaLabelWidth + ((shiftEnd - 6) / 18) * (pageWidth - margin * 2 - areaLabelWidth);
          const barWidth = rightX - leftX;
          const color = funcColors[schedule.function];

          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.roundedRect(leftX, trackY + 1, barWidth, rowHeight - 2, 1, 1, 'F');

          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(255, 255, 255);
          const name = (schedule.employee as any).name?.length > 15 ? (schedule.employee as any).name.substring(0, 13) + '..' : (schedule.employee as any).name;
          pdf.text(name, leftX + barWidth / 2, trackY + rowHeight / 2 + 1, { align: 'center' });
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
      encargado: '#dc2626'
    };
    return colors[fn] || '#9ca3af';
  }

  isToday(): boolean {
    return this.scheduleDate() === new Date().toISOString().split('T')[0];
  }

  goToToday(): void {
    this.scheduleDate.set(new Date().toISOString().split('T')[0]);
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
      this.modalEmployee.set(employee);
      this.modalArea.set(area);
      this.modalDropHour.set(hour);
      this.showModal.set(true);
    } catch (e) {
      console.error('Failed to parse employee data', e);
    }
  }

  onEmployeeDragStart(event: DragEvent, employee: Employee): void {
    event.dataTransfer?.setData('text/plain', JSON.stringify(employee));
    event.dataTransfer!.effectAllowed = 'move';
  }

  onModalSave(data: { function: JobFunction; shifts: ShiftBlock[] }): void {
    const editingId = this.modalEditingId();

    if (editingId !== null) {
      this.placedEmployees.update((list) =>
        list.map((p) =>
          p.id === editingId
            ? { ...p, function: data.function, shifts: data.shifts, area: FUNCTION_TO_AREA[data.function] }
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
        shifts: data.shifts,
      };

      this.placedEmployees.update((list) => [...list, newPlaced]);
    }

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
    this.rebuildSchedules();
  }

  getBarStyle(shift: ShiftBlock): Record<string, string> {
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
      encargado: 'bg-red-600'
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
    if (this.hasPlacedEmployees()) {
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
    this.advanceToNextDay();
  }

  advanceToNextDay(): void {
    const current = new Date(this.scheduleDate() + 'T00:00:00');
    current.setDate(current.getDate() + 1);
    this.scheduleDate.set(current.toISOString().split('T')[0]);
  }

  openDatePicker(): void {
    const input = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (input) {
      input.min = this.minScheduleDate;
      input.showPicker();
    }
  }

  onDateSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selectedDate = input.value;

    if (selectedDate < this.minScheduleDate) {
      this.toastService.error('Fecha inválida', { description: 'No podés seleccionar una fecha anterior a hoy' });
      return;
    }

    if (this.hasPlacedEmployees()) {
      this.toastService.warning('Cambios sin guardar', {
        description: '¿Querésiscardar los cambios y cambiar de fecha?',
        button: {
          title: 'Descartar y cambiar',
          onClick: () => {
            this.clearGrid();
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
      encargado: 'bg-red-100 text-red-800'
    };
    return colors[func];
  }

  getEmployeeFunctions(employee: Employee): JobFunction[] {
    return employee.functions;
  }

  getEmployeeShifts(employee: Employee): string {
    return employee.shifts.map((s) => `${s.start}:00-${s.end}:00`).join(' / ');
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

    available.forEach((employee) => {
      const defaultFunc = employee.defaultFunction;
      const area = FUNCTION_TO_AREA[defaultFunc];

      const placedId = Date.now() + Math.random();
      newPlaced.push({
        id: placedId,
        employee,
        area,
        function: defaultFunc,
        shifts: employee.shifts,
      });
    });

    this.placedEmployees.update((list) => [...list, ...newPlaced]);
    this.rebuildSchedules();
  }

  async saveScheduleToHistory(): Promise<void> {
    const currentDate = this.getCurrentDateFormatted();
    const todayStr = new Date().toISOString().split('T')[0];
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
      .eq('schedule_date', todayStr)
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
        this.toastService.success('Horario actualizado', { description: 'El horario se guardó correctamente' });
        await this.historyService.loadFromDatabase();
      }
    } else {
      const { error: insertError } = await this.authService.getSupabase()
        .from('historial_horarios')
        .insert({
          branch_id: branch.id.toString(),
          schedule_date: todayStr,
          placed_employees: JSON.stringify(placedData)
        });

      if (insertError) {
        console.error('Error inserting schedule:', insertError);
        this.toastService.error('Error', { description: 'No se pudo guardar el horario' });
      } else {
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
      const margin = 10;
      const title = `Horarios Farmacia - ${this.getCurrentDateFormatted()}`;

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, pageWidth / 2, margin + 5, { align: 'center' });

      const areaLabelWidth = 35;
      const hourWidth = (pageWidth - margin * 2 - areaLabelWidth) / this.workHours.length;
      const rowHeight = 8;
      const headerHeight = 10;
      const startY = margin + 15;

      const funcColors: Record<JobFunction, [number, number, number]> = {
        cajero: [59, 130, 246],
        vendedor: [16, 185, 129],
        perfumera: [236, 72, 153],
        salon: [147, 51, 234],
        inventario: [245, 158, 11],
        limpieza: [107, 114, 128],
        atencion_bot: [34, 211, 238],
        encargado: [220, 38, 38]
      };

      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, startY, pageWidth - margin * 2, headerHeight, 'F');

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(75, 85, 99);
      pdf.text('Área', margin + 2, startY + 7);

      this.workHours.forEach((hour, i) => {
        const x = margin + areaLabelWidth + i * hourWidth;
        pdf.text(`${hour}:00`, x + hourWidth / 2, startY + 7, { align: 'center' });
      });

      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.3);

      let currentY = startY + headerHeight;

      this.areaSchedules().forEach((areaSchedule) => {
        const maxTracks = areaSchedule.tracks.length;
        const areaRowHeight = maxTracks > 0 ? rowHeight * maxTracks : rowHeight;

        pdf.setFillColor(249, 250, 251);
        pdf.rect(margin, currentY, areaLabelWidth, areaRowHeight, 'F');

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(31, 41, 55);
        pdf.text(this.areaLabels[areaSchedule.area], margin + 2, currentY + areaRowHeight / 2 + 2);

        pdf.setDrawColor(229, 231, 235);
        pdf.rect(margin, currentY, areaLabelWidth, areaRowHeight);

        this.workHours.forEach((_, i) => {
          const x = margin + areaLabelWidth + i * hourWidth;
          pdf.rect(x, currentY, hourWidth, areaRowHeight);
        });

        areaSchedule.tracks.forEach((track, trackIndex) => {
          const trackY = currentY + trackIndex * rowHeight;

          track.forEach((schedule) => {
            const shiftStart = schedule.shift.start;
            const shiftEnd = schedule.shift.end;
            const leftX = margin + areaLabelWidth + ((shiftStart - 6) / 18) * (pageWidth - margin * 2 - areaLabelWidth);
            const rightX = margin + areaLabelWidth + ((shiftEnd - 6) / 18) * (pageWidth - margin * 2 - areaLabelWidth);
            const barWidth = rightX - leftX;
            const color = funcColors[schedule.function];

            pdf.setFillColor(color[0], color[1], color[2]);
            pdf.roundedRect(leftX, trackY + 1, barWidth, rowHeight - 2, 1, 1, 'F');

            pdf.setFontSize(6);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(255, 255, 255);
            const name = schedule.employee.name.length > 12 ? schedule.employee.name.substring(0, 10) + '..' : schedule.employee.name;
            pdf.text(name, leftX + 2, trackY + 5.5);
          });
        });

        currentY += areaRowHeight;
      });

      const legendY = currentY + 10;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(75, 85, 99);
      pdf.text('Leyenda:', margin, legendY);

      const funcs = Object.keys(funcColors) as JobFunction[];
      funcs.forEach((func, i) => {
        const x = margin + 15 + i * 30;
        const color = funcColors[func];
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.rect(x, legendY - 3, 4, 4, 'F');
        pdf.setTextColor(75, 85, 99);
        pdf.text(this.functionLabels[func], x + 6, legendY);
      });

      pdf.autoPrint();
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error exporting PDF:', error);
    }
  }
}