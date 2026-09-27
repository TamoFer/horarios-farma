import { Component, signal, inject, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import { HistoryService } from '../../services/history.service';
import { AuthService } from '../../services/auth.service';
import { ScheduleHistory, JobFunction, Area, DayOfWeek, WORK_HOURS, AREA_LABELS, PlacedEmployeeData, NIGHT_SHIFT_NORMAL_END } from '../../models/employee.model';
import { Router } from '@angular/router';

@Component({
  selector: 'app-history',
  imports: [CommonModule, FormsModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css',
})
export class HistoryComponent implements OnInit {
  historyService = inject(HistoryService);
  private authService = inject(AuthService);
  private router = inject(Router);

  loadSchedule = output<ScheduleHistory>();

  searchDate = signal('');
  selectedSchedule = signal<ScheduleHistory | null>(null);
  showPreview = signal(false);
  editingSchedule = signal<ScheduleHistory | null>(null);

  get filteredHistory(): ScheduleHistory[] {
    const search = this.searchDate();
    if (!search) return this.historyService.history();
    return this.historyService.history().filter(h =>
      h.scheduleDate === search
    );
  }

  ngOnInit(): void {
    this.historyService.loadFromDatabase();
  }

  canEdit(entry: ScheduleHistory): boolean {
    const today = new Date();
    const scheduleDate = new Date(entry.scheduleDate + 'T00:00:00');
    today.setHours(0, 0, 0, 0);
    return scheduleDate >= today;
  }

  getDaysAgo(entry: ScheduleHistory): string {
    const today = new Date();
    const scheduleDate = new Date(entry.scheduleDate + 'T00:00:00');
    const diffTime = today.getTime() - scheduleDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    return `Hace ${Math.floor(diffDays / 30)} meses`;
  }

  openPreview(entry: ScheduleHistory): void {
    this.selectedSchedule.set(entry);
    this.showPreview.set(true);
  }

  closePreview(): void {
    this.showPreview.set(false);
    this.selectedSchedule.set(null);
  }

  editSchedule(entry: ScheduleHistory): void {
    if (!this.canEdit(entry)) return;
    this.historyService.setScheduleToEdit(entry);
    this.router.navigate(['/dashboard']);
  }

  downloadPDF(entry: ScheduleHistory): void {
    const pdf = this.generatePDF(entry);
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `horarios-${entry.scheduleDate}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  printPDF(entry: ScheduleHistory): void {
    const pdf = this.generatePDF(entry);
    pdf.autoPrint();
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  async deleteEntry(id: string): Promise<void> {
    await this.historyService.deleteEntry(id);
  }

  getAreaLabel(area: string): string {
    return AREA_LABELS[area as Area] || area;
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

  private generatePDF(entry: ScheduleHistory): jsPDF {
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const title = `Horarios Farmacia - ${entry.date}`;

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, pageWidth / 2, margin + 4, { align: 'center' });

    const branchEmployees = this.authService.branchEmployees().get(Number(entry.branchId)) ?? [];
    const days: DayOfWeek[] = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const entryDate = new Date(entry.scheduleDate + 'T00:00:00');
    const weekday = days[entryDate.getDay()];
    const placedIds = entry.placedEmployees.map((p) => p.employeeId);
    const francos = branchEmployees
      .filter((e) => e.dayOff === weekday && !placedIds.includes(e.id) && !e.functions.includes('encargado'))
      .map((e) => e.name.split(' ')[0])
      .join(', ');

    const areaLabelWidth = 35;
    const hourWidth = (pageWidth - margin * 2 - areaLabelWidth) / WORK_HOURS.length;
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

    const areas: Area[] = ['caja', 'mostrador', 'perfumeria', 'salon', 'inventario', 'limpieza', 'seguridad', 'bot', 'noche'];

    const areaTracks: Record<Area, { employee: string; function: JobFunction; shift: { start: number; end: number } }[][]> = {
      caja: [], mostrador: [], perfumeria: [], salon: [], inventario: [], limpieza: [], seguridad: [], bot: [], noche: []
    };

    entry.placedEmployees.forEach(p => {
      p.shifts.forEach(shift => {
        const areaKey = p.area as Area;
        let trackIndex = 0;
        for (let i = 0; i < 10; i++) {
          const track = areaTracks[areaKey][i] || [];
          const hasConflict = track.some(slot =>
            (shift.start >= slot.shift.start && shift.start < slot.shift.end) ||
            (shift.end > slot.shift.start && shift.end <= slot.shift.end) ||
            (shift.start <= slot.shift.start && shift.end >= slot.shift.end)
          );
          if (!hasConflict) {
            trackIndex = i;
            break;
          }
          trackIndex = i + 1;
        }
        if (!areaTracks[areaKey][trackIndex]) areaTracks[areaKey][trackIndex] = [];
        areaTracks[areaKey][trackIndex].push({ employee: p.employeeName, function: p.function, shift });
      });
    });

    const drawGridHeader = (): void => {
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, startY, pageWidth - margin * 2, headerHeight, 'F');

      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(75, 85, 99);
      pdf.text('Área', margin + 2, startY + 5);

      WORK_HOURS.forEach((hour, i) => {
        const x = margin + areaLabelWidth + i * hourWidth;
        pdf.text(`${hour}:00`, x + hourWidth / 2, startY + 5, { align: 'center' });
      });
    };

    drawGridHeader();

    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.3);

    let currentY = startY + headerHeight;

    areas.forEach(area => {
      const tracks = areaTracks[area] || [];
      const maxTracks = tracks.length;
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
      pdf.text(AREA_LABELS[area], margin + 2, currentY + areaRowHeight / 2 + 1);

      pdf.setDrawColor(229, 231, 235);
      pdf.rect(margin, currentY, areaLabelWidth, areaRowHeight);

      WORK_HOURS.forEach((_, i) => {
        const x = margin + areaLabelWidth + i * hourWidth;
        pdf.rect(x, currentY, hourWidth, areaRowHeight);
      });

      tracks.forEach((track, trackIndex) => {
        const trackY = currentY + trackIndex * rowHeight;

        track.forEach(schedule => {
          const isNight = area === 'noche';
          const shiftStart = schedule.shift.start;
          const shiftEnd = schedule.shift.end;
          const gridWidth = pageWidth - margin * 2 - areaLabelWidth;
          const leftX = margin + areaLabelWidth + (isNight ? 0 : ((shiftStart - 7) / 17) * gridWidth);
          const rightX = isNight
            ? margin + areaLabelWidth + gridWidth
            : margin + areaLabelWidth + ((shiftEnd - 7) / 17) * gridWidth;
          const color = funcColors[schedule.function];

          let name = schedule.employee.split(' ')[0];
          if (isNight && shiftEnd > NIGHT_SHIFT_NORMAL_END) {
            name = `${name} - hasta 12:00`;
          }
          this.drawShiftArrow(pdf, leftX, rightX, trackY, rowHeight, name, color);
        });
      });

      currentY += areaRowHeight;
    });

    const legendY = currentY + 7;
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(55, 65, 81);
    pdf.text('Francos:', margin, legendY);
    const francosLabelWidth = pdf.getTextWidth('Francos:');
    pdf.setFont('helvetica', 'normal');
    pdf.text(francos || '-', margin + francosLabelWidth + 1.5, legendY);

    return pdf;
  }

  private drawShiftArrow(
    pdf: jsPDF,
    leftX: number,
    rightX: number,
    trackY: number,
    rowHeight: number,
    name: string,
    color: [number, number, number]
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

    pdf.setFontSize(5.5);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(31, 41, 55);
    pdf.text(name, (leftX + rightX) / 2, arrowY - 1.2, { align: 'center' });
  }
}
