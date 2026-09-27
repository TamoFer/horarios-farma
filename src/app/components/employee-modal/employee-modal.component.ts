import { Component, signal, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Employee, JobFunction, ShiftBlock, FUNCTION_LABELS, NIGHT_SHIFT_START, NIGHT_SHIFT_NORMAL_END, NIGHT_SHIFT_EXTENDED_END } from '../../models/employee.model';

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
  nightEnd: number = NIGHT_SHIFT_NORMAL_END;
  nightEndNormal = NIGHT_SHIFT_NORMAL_END;
  nightEndExtended = NIGHT_SHIFT_EXTENDED_END;

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

    this.nightEnd = this.shifts.some(s => s.end >= NIGHT_SHIFT_EXTENDED_END)
      ? NIGHT_SHIFT_EXTENDED_END
      : NIGHT_SHIFT_NORMAL_END;
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
    if (this.selectedFunction === 'nochero') {
      this.save.emit({
        function: 'nochero',
        shifts: [{ start: NIGHT_SHIFT_START, end: this.nightEnd }],
      });
      return;
    }
    this.save.emit({
      function: this.selectedFunction,
      shifts: [...this.shifts],
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }
}