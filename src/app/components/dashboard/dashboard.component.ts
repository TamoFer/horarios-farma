import { Component, signal, input, output, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import {
  Employee,
  JobFunction,
  Area,
  DayOfWeek,
  ShiftBlock,
  Vacation,
  WORK_HOURS,
  AREAS,
  FUNCTION_TO_AREA,
  AREA_LABELS,
  FUNCTION_LABELS,
  DAY_LABELS,
  PlacedEmployeeData,
} from '../../models/employee.model';
import { EmployeeModalComponent } from '../employee-modal/employee-modal.component';

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

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, FormsModule, EmployeeModalComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  @ViewChild('scheduleGrid') scheduleGrid!: ElementRef;

  employees = input<Employee[]>([]);
  vacations = input<Vacation[]>([]);
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

  constructor() {
    this.initEmptySchedule();
  }

  private get allEmployees(): Employee[] {
    return this.employees();
  }

  private emitChange(): void {
    this.employeeChange.emit(this.allEmployees);
  }

  toggleSidebar(): void {
    this.sidebarVisible.update((v) => !v);
  }

  getCurrentDayOff(): DayOfWeek {
    const days: DayOfWeek[] = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const todayIndex = new Date().getDay();
    return days[todayIndex];
  }

  isEmployeeOnDayOff(employee: Employee): boolean {
    return employee.dayOff === this.getCurrentDayOff();
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

  getAvailableEmployees(): Employee[] {
    return this.allEmployees.filter((e) => !this.isEmployeePlaced(e.id) && !this.isEmployeeOnDayOff(e) && !this.isEmployeeOnVacation(e.id));
  }

  getEmployeesOnDayOff(): Employee[] {
    return this.allEmployees.filter((e) => !this.isEmployeePlaced(e.id) && this.isEmployeeOnDayOff(e) && !this.isEmployeeOnVacation(e.id));
  }

  getEmployeesOnVacation(): Employee[] {
    return this.allEmployees.filter((e) => !this.isEmployeePlaced(e.id) && this.isEmployeeOnVacation(e.id));
  }

  getVacationDates(employeeId: number): string {
    const vacation = this.vacations().find((v) => v.employeeId === employeeId);
    if (!vacation) return '';
    const start = new Date(vacation.startDate).toLocaleDateString('es-ES');
    const end = new Date(vacation.endDate).toLocaleDateString('es-ES');
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
      const areaPlacements = placed.filter((p) => p.area === area);

      const tracks: EmployeeShiftSchedule[][] = [];

      areaPlacements.forEach((placement) => {
        placement.shifts.forEach((shift) => {
          const duration = shift.end - shift.start;
          if (duration <= 0) return;

          let trackIndex = 0;

          for (let i = 0; i < 10; i++) {
            const track = tracks[i] || [];
            const hasConflict = track.some((slot) => {
              return (
                (shift.start >= slot.shift.start && shift.start < slot.shift.end) ||
                (shift.end > slot.shift.start && shift.end <= slot.shift.end) ||
                (shift.start <= slot.shift.start && shift.end >= slot.shift.end)
              );
            });

            if (!hasConflict) {
              trackIndex = i;
              break;
            }
            trackIndex = i + 1;
          }

          if (!tracks[trackIndex]) {
            tracks[trackIndex] = [];
          }
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

  removePlacedEmployee(placedId: number): void {
    this.placedEmployees.update((list) => list.filter((p) => p.id !== placedId));
    this.rebuildSchedules();
  }

  getBarStyle(shift: ShiftBlock): Record<string, string> {
    const leftPercent = ((shift.start - 7) / (24 - 7)) * 100;
    const widthPercent = ((shift.end - shift.start) / (24 - 7)) * 100;

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

  getEmployeeFunctions(employee: Employee): JobFunction[] {
    return employee.functions;
  }

  getEmployeeShifts(employee: Employee): string {
    return employee.shifts.map((s) => `${s.start}:00-${s.end}:00`).join(' / ');
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

  saveScheduleToHistory(): void {
    const currentDate = this.getCurrentDateFormatted();
    const placedData: PlacedEmployeeData[] = this.placedEmployees().map(p => ({
      employeeId: p.employee.id,
      employeeName: p.employee.name,
      area: p.area,
      function: p.function,
      shifts: p.shifts
    }));
    this.saveSchedule.emit({ date: currentDate, placedEmployees: placedData });
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
            const leftX = margin + areaLabelWidth + ((shiftStart - 7) / 17) * (pageWidth - margin * 2 - areaLabelWidth);
            const rightX = margin + areaLabelWidth + ((shiftEnd - 7) / 17) * (pageWidth - margin * 2 - areaLabelWidth);
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