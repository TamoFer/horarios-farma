import { Component, signal, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Employee, JobFunction, ShiftBlock, FUNCTION_LABELS } from '../../models/employee.model';

@Component({
  selector: 'app-employee-modal',
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-modal.component.html',
  styleUrl: './employee-modal.component.css',
})
export class EmployeeModalComponent {
  employee = input.required<Employee>();
  areaName = input.required<string>();
  dropHour = input.required<number>();
  editingFunction = input<JobFunction | null>(null);
  editingShifts = input<ShiftBlock[] | null>(null);

  save = output<{ function: JobFunction; shifts: ShiftBlock[] }>();
  cancel = output<void>();

  selectedFunction: JobFunction = 'vendedor';
  shifts: ShiftBlock[] = [];

  ngOnInit(): void {
    const emp = this.employee();
    const editFunc = this.editingFunction();
    const editShifts = this.editingShifts();

    if (editFunc !== null && editShifts !== null) {
      this.selectedFunction = editFunc;
      this.shifts = editShifts.map(s => ({ start: s.start, end: s.end }));
    } else {
      this.selectedFunction = emp.defaultFunction;
      this.shifts = emp.shifts.map(s => ({ start: s.start, end: s.end }));
    }
  }

  getFunctions(): JobFunction[] {
    return this.employee().functions;
  }

  getFunctionLabel(func: JobFunction): string {
    return FUNCTION_LABELS[func];
  }

  addShift(): void {
    this.shifts.push({ start: 9, end: 17 });
  }

  removeShift(index: number): void {
    if (this.shifts.length > 1) {
      this.shifts.splice(index, 1);
    }
  }

  onSave(): void {
    this.save.emit({
      function: this.selectedFunction,
      shifts: [...this.shifts],
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}