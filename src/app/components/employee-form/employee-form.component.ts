import { Component, signal, output, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Employee, JobFunction, DayOfWeek, ShiftBlock, FUNCTION_LABELS, DAY_LABELS, DAYS_OF_WEEK } from '../../models/employee.model';

@Component({
  selector: 'app-employee-form',
  imports: [CommonModule, FormsModule],
  templateUrl: './employee-form.component.html',
  styleUrl: './employee-form.component.css',
})
export class EmployeeFormComponent {
  employee = input<Employee | null>(null);

  save = output<Employee>();
  cancel = output<void>();

  name = signal('');
  functions = signal<JobFunction[]>([]);
  defaultFunction = signal<JobFunction>('vendedor');
  weeklyHours = signal(40);
  dayOff = signal<DayOfWeek>('domingo');
  shifts = signal<ShiftBlock[]>([{ start: 9, end: 17 }]);

  allFunctions: JobFunction[] = ['cajero', 'vendedor', 'perfumera', 'salon', 'inventario', 'limpieza', 'nochero'];
  functionLabels = FUNCTION_LABELS;
  dayLabels = DAY_LABELS;
  daysOfWeek = DAYS_OF_WEEK;

  ngOnInit(): void {
    const emp = this.employee();
    if (emp) {
      this.name.set(emp.name);
      this.functions.set([...emp.functions]);
      this.defaultFunction.set(emp.defaultFunction);
      this.weeklyHours.set(emp.weeklyHours);
      this.dayOff.set(emp.dayOff);
      this.shifts.set(emp.shifts.map(s => ({ start: s.start, end: s.end })));
    }
  }

  toggleFunction(func: JobFunction): void {
    const current = this.functions();
    if (current.includes(func)) {
      if (current.length > 1) {
        this.functions.update(f => f.filter(f => f !== func));
        if (this.defaultFunction() === func) {
          this.defaultFunction.set(current[0] === func ? current[1] : current[0]);
        }
      }
    } else {
      this.functions.update(f => [...f, func]);
    }
  }

  isFunctionSelected(func: JobFunction): boolean {
    return this.functions().includes(func);
  }

  addShift(): void {
    this.shifts.update(s => [...s, { start: 9, end: 17 }]);
  }

  removeShift(index: number): void {
    if (this.shifts().length > 1) {
      this.shifts.update(s => s.filter((_, i) => i !== index));
    }
  }

  onSave(): void {
    const emp: Employee = {
      id: this.employee()?.id || 0,
      name: this.name(),
      functions: this.functions(),
      defaultFunction: this.defaultFunction(),
      weeklyHours: this.weeklyHours(),
      dayOff: this.dayOff(),
      shifts: this.shifts(),
    };
    this.save.emit(emp);
  }

  onCancel(): void {
    this.cancel.emit();
  }
}