import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Employee,
  JobFunction,
  DayOfWeek,
  ShiftBlock,
  Vacation,
  FUNCTION_LABELS,
  DAY_LABELS,
  SAMPLE_EMPLOYEES,
} from './models/employee.model';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { EmployeeFormComponent } from './components/employee-form/employee-form.component';
import { VacationModalComponent } from './components/vacation-modal/vacation-modal.component';

type Section = 'empleados' | 'horario' | 'vacaciones';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, DashboardComponent, EmployeeFormComponent, VacationModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  currentSection = signal<Section>('horario');
  allEmployees = signal<Employee[]>(SAMPLE_EMPLOYEES);
  vacations = signal<Vacation[]>([]);

  editingEmployee = signal<Employee | null>(null);
  showModal = signal(false);
  showVacationModal = signal(false);
  editingVacation = signal<Vacation | null>(null);

  notifications = signal<Toast[]>([]);

  setSection(section: Section): void {
    this.currentSection.set(section);
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

  deleteEmployee(id: number): void {
    const employee = this.allEmployees().find((e) => e.id === id);
    this.allEmployees.update((list) => list.filter((e) => e.id !== id));
    this.vacations.update((list) => list.filter((v) => v.employeeId !== id));
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

  onSaveEmployee(employee: Employee): void {
    const editing = this.editingEmployee();

    if (editing) {
      this.allEmployees.update((list) =>
        list.map((e) =>
          e.id === editing.id ? employee : e
        )
      );
      this.showNotification(`Empleado "${employee.name}" actualizado`, 'success');
    } else {
      const newId = Math.max(...this.allEmployees().map((e) => e.id)) + 1;
      this.allEmployees.update((list) => [
        ...list,
        { ...employee, id: newId },
      ]);
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

  deleteVacation(id: number): void {
    const vacation = this.vacations().find((v) => v.id === id);
    const employeeName = vacation ? this.getEmployeeName(vacation.employeeId) : '';
    this.vacations.update((list) => list.filter((v) => v.id !== id));
    this.showNotification(`Vacaciones de "${employeeName}" eliminadas`, 'success');
  }

  onSaveVacation(vacation: Vacation): void {
    const editing = this.editingVacation();
    const employeeName = this.getEmployeeName(vacation.employeeId);

    if (editing) {
      this.vacations.update((list) =>
        list.map((v) =>
          v.id === editing.id ? vacation : v
        )
      );
      this.showNotification(`Vacaciones de "${employeeName}" actualizadas`, 'success');
    } else {
      this.vacations.update((list) => [...list, vacation]);
      this.showNotification(`Vacaciones de "${employeeName}" creadas`, 'success');
    }

    this.closeVacationModal();
  }

  getEmployeeName(employeeId: number): string {
    const emp = this.allEmployees().find((e) => e.id === employeeId);
    return emp ? emp.name : 'Desconocido';
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