import { Component, signal, inject, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import {
  Employee,
  JobFunction,
  DayOfWeek,
  ShiftBlock,
  Vacation,
  FUNCTION_LABELS,
  DAY_LABELS,
  PlacedEmployeeData,
} from './models/employee.model';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { EmployeeFormComponent } from './components/employee-form/employee-form.component';
import { VacationModalComponent } from './components/vacation-modal/vacation-modal.component';
import { HistoryComponent } from './components/history/history.component';
import { AuthService } from './services/auth.service';
import { HistoryService } from './services/history.service';

type Section = 'empleados' | 'horario' | 'vacaciones' | 'historial';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  currentSection = signal<Section>('horario');
  editingEmployee = signal<Employee | null>(null);
  showModal = signal(false);
  showVacationModal = signal(false);
  editingVacation = signal<Vacation | null>(null);

  notifications = signal<Toast[]>([]);

  private authService = inject(AuthService);
  private historyService = inject(HistoryService);
  private router = inject(Router);

  constructor() {
    this.authService.initialize();

    effect(() => {
      if (!this.authService.isAuthenticated()) {
        this.router.navigate(['/login']);
      }
    });

    effect(() => {
      const branch = this.authService.selectedBranch();
      if (branch) {
        this.loadVacationsForBranch(branch.id);
      }
    });
  }

  allEmployees = computed(() => {
    const branch = this.authService.selectedBranch();
    if (!branch) return [];
    return this.authService.getEmployeesForBranch(branch.id);
  });

  vacations = signal<Vacation[]>([]);

  private async loadVacationsForBranch(branchId: number) {
    const { data } = await this.authService.getSupabase()
      .from('vacations')
      .select('*, employees(branch_id)')
      .eq('employees.branch_id', branchId);

    if (data) {
      this.vacations.set(data as Vacation[]);
    }
  }

  setSection(section: Section): void {
    this.currentSection.set(section);
  }

  onSaveSchedule(data: { date: string; placedEmployees: PlacedEmployeeData[] }): void {
    this.historyService.addEntry(data.date, data.placedEmployees);
    this.showNotification('Horario guardado en historial', 'success');
  }

  getEmployees(): Employee[] {
    return this.allEmployees();
  }

  openNewEmployeeModal(): void {
    this.editingEmployee.set(null);
    this.showModal.set(true);
  }

  openEditEmployeeModal(employee: Employee): void {
    this.editingEmployee.set(employee);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingEmployee.set(null);
  }

  async deleteEmployee(id: number): Promise<void> {
    const employee = this.allEmployees().find((e) => e.id === id);
    await this.authService.getSupabase()
      .from('employees')
      .update({ active: false })
      .eq('id', id);

    this.showNotification(`Empleado "${employee?.name}" eliminado`, 'success');
  }

  getEmployeeFunctions(employee: Employee): JobFunction[] {
    return employee.functions;
  }

  getEmployeeShifts(employee: Employee): string {
    return employee.shifts.map((s) => `${s.start}:00-${s.end}:00`).join(' / ');
  }

  getFunctionBadgeColor(func: JobFunction): string {
    const colors: Record<JobFunction, string> = {
      cajero: 'bg-blue-100 text-blue-800',
      vendedor: 'bg-green-100 text-green-800',
      perfumera: 'bg-pink-100 text-pink-800',
      salon: 'bg-purple-100 text-purple-800',
      inventario: 'bg-yellow-100 text-yellow-800',
      limpieza: 'bg-gray-100 text-gray-800',
    };
    return colors[func];
  }

  functionLabels = FUNCTION_LABELS;
  dayLabels = DAY_LABELS;

  async onSaveEmployee(employee: Employee): Promise<void> {
    const editing = this.editingEmployee();
    const branch = this.authService.selectedBranch();

    if (!branch) return;

    if (editing) {
      await this.authService.getSupabase()
        .from('employees')
        .update({
          name: employee.name,
          functions: employee.functions,
          default_function: employee.defaultFunction,
          weekly_hours: employee.weeklyHours,
          day_off: employee.dayOff,
          shifts: JSON.stringify(employee.shifts)
        })
        .eq('id', editing.id);

      await this.authService.refreshManagerData();
      this.showNotification(`Empleado "${employee.name}" actualizado`, 'success');
    } else {
      await this.authService.getSupabase()
        .from('employees')
        .insert({
          branch_id: branch.id,
          name: employee.name,
          functions: employee.functions,
          default_function: employee.defaultFunction,
          weekly_hours: employee.weeklyHours,
          day_off: employee.dayOff,
          shifts: JSON.stringify(employee.shifts)
        });

      await this.authService.refreshManagerData();
      this.showNotification(`Empleado "${employee.name}" creado`, 'success');
    }

    this.closeModal();
  }

  openNewVacationModal(): void {
    this.editingVacation.set(null);
    this.showVacationModal.set(true);
  }

  openEditVacationModal(vacation: Vacation): void {
    this.editingVacation.set(vacation);
    this.showVacationModal.set(true);
  }

  closeVacationModal(): void {
    this.showVacationModal.set(false);
    this.editingVacation.set(null);
  }

  async deleteVacation(id: number): Promise<void> {
    const vacation = this.vacations().find((v) => v.id === id);
    const employeeName = vacation ? this.getEmployeeName(vacation.employeeId) : '';

    await this.authService.getSupabase()
      .from('vacations')
      .delete()
      .eq('id', id);

    const branch = this.authService.selectedBranch();
    if (branch) {
      await this.loadVacationsForBranch(branch.id);
    }

    this.showNotification(`Vacaciones de "${employeeName}" eliminadas`, 'success');
  }

  async onSaveVacation(vacation: Vacation): Promise<void> {
    const editing = this.editingVacation();
    const employeeName = this.getEmployeeName(vacation.employeeId);

    if (editing) {
      await this.authService.getSupabase()
        .from('vacations')
        .update({
          start_date: vacation.startDate,
          end_date: vacation.endDate
        })
        .eq('id', editing.id);

      const branch = this.authService.selectedBranch();
      if (branch) {
        await this.loadVacationsForBranch(branch.id);
      }

      this.showNotification(`Vacaciones de "${employeeName}" actualizadas`, 'success');
    } else {
      await this.authService.getSupabase()
        .from('vacations')
        .insert({
          employee_id: vacation.employeeId,
          start_date: vacation.startDate,
          end_date: vacation.endDate
        });

      const branch = this.authService.selectedBranch();
      if (branch) {
        await this.loadVacationsForBranch(branch.id);
      }

      this.showNotification(`Vacaciones de "${employeeName}" creadas`, 'success');
    }

    this.closeVacationModal();
  }

  getEmployeeName(employeeId: number): string {
    const emp = this.allEmployees().find((e) => e.id === employeeId);
    return emp?.name || 'Desconocido';
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES');
  }

  isEmployeeOnVacation(employeeId: number): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.vacations().some((v) => {
      const start = new Date(v.startDate);
      const end = new Date(v.endDate);
      return v.employeeId === employeeId && today >= start && today <= end;
    });
  }

  getEmployeesOnVacation(): Employee[] {
    return this.allEmployees().filter((e) => this.isEmployeeOnVacation(e.id));
  }

  getVacationsForEmployee(employeeId: number): Vacation[] {
    return this.vacations().filter((v) => v.employeeId === employeeId);
  }

  showNotification(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    const id = Date.now();
    this.notifications.update((n) => [...n, { id, message, type }]);
    setTimeout(() => this.removeNotification(id), 4000);
  }

  removeNotification(id: number): void {
    this.notifications.update((n) => n.filter((t) => t.id !== id));
  }

  getToastClass(type: 'success' | 'error' | 'info'): string {
    const classes = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      info: 'bg-blue-500',
    };
    return classes[type];
  }
}