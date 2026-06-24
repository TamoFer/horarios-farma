import { Component, signal, output, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Employee, Vacation } from '../../models/employee.model';

@Component({
  selector: 'app-vacation-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './vacation-modal.component.html',
  styleUrl: './vacation-modal.component.css',
})
export class VacationModalComponent {
  employees = input<Employee[]>([]);
  editingVacation = input<Vacation | null>(null);

  save = output<Vacation>();
  cancel = output<void>();

  selectedEmployeeId = signal<number | null>(null);
  startDate = signal<string>('');
  endDate = signal<string>('');

  constructor() {
    effect(() => {
      const editing = this.editingVacation();
      const employees = this.employees();

      if (editing) {
        this.selectedEmployeeId.set(editing.employeeId);
        this.startDate.set(editing.startDate);
        this.endDate.set(editing.endDate);
      } else {
        if (employees.length > 0 && this.selectedEmployeeId() === null) {
          this.selectedEmployeeId.set(employees[0].id);
        }
        const today = new Date().toISOString().split('T')[0];
        this.startDate.set(today);
        this.endDate.set(today);
      }
    });
  }

  getAvailableEmployees(): Employee[] {
    return this.employees();
  }

  onSave(): void {
    const employeeId = this.selectedEmployeeId();
    const start = this.startDate();
    const end = this.endDate();

    if (!employeeId || !start || !end) return;

    const vacation: Vacation = {
      id: this.editingVacation()?.id || Date.now(),
      employeeId,
      startDate: start,
      endDate: end,
      estado: 'temporal',
    };

    this.save.emit(vacation);
  }

  onCancel(): void {
    this.cancel.emit();
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES');
  }
}