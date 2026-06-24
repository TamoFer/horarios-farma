import { Component, signal, inject, OnInit, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import { HistoryService } from '../../services/history.service';
import { AuthService } from '../../services/auth.service';
import { ScheduleHistory, JobFunction, Area, WORK_HOURS, AREA_LABELS, FUNCTION_LABELS, PlacedEmployeeData } from '../../models/employee.model';
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
      encargado: 'bg-red-600'
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
    const margin = 10;
    const title = `Horarios Farmacia - ${entry.date}`;

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, pageWidth / 2, margin + 5, { align: 'center' });

    const areaLabelWidth = 35;
    const hourWidth = (pageWidth - margin * 2 - areaLabelWidth) / WORK_HOURS.length;
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

    const areas: Area[] = ['caja', 'mostrador', 'perfumeria', 'salon', 'inventario', 'limpieza', 'bot'];

    const areaTracks: Record<Area, { employee: string; function: JobFunction; shift: { start: number; end: number } }[][]> = {
      caja: [], mostrador: [], perfumeria: [], salon: [], inventario: [], limpieza: [], bot: []
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

    pdf.setFillColor(249, 250, 251);
    pdf.rect(margin, startY, pageWidth - margin * 2, headerHeight, 'F');

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(75, 85, 99);
    pdf.text('Área', margin + 2, startY + 7);

    WORK_HOURS.forEach((hour, i) => {
      const x = margin + areaLabelWidth + i * hourWidth;
      pdf.text(`${hour}:00`, x + hourWidth / 2, startY + 7, { align: 'center' });
    });

    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.3);

    let currentY = startY + headerHeight;

    areas.forEach(area => {
      const tracks = areaTracks[area] || [];
      const maxTracks = tracks.length;
      const areaRowHeight = maxTracks > 0 ? rowHeight * maxTracks : rowHeight;

      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, currentY, areaLabelWidth, areaRowHeight, 'F');

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(31, 41, 55);
      pdf.text(AREA_LABELS[area], margin + 2, currentY + areaRowHeight / 2 + 2);

      pdf.setDrawColor(229, 231, 235);
      pdf.rect(margin, currentY, areaLabelWidth, areaRowHeight);

      WORK_HOURS.forEach((_, i) => {
        const x = margin + areaLabelWidth + i * hourWidth;
        pdf.rect(x, currentY, hourWidth, areaRowHeight);
      });

      tracks.forEach((track, trackIndex) => {
        const trackY = currentY + trackIndex * rowHeight;

        track.forEach(schedule => {
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
          const name = schedule.employee.length > 12 ? schedule.employee.substring(0, 10) + '..' : schedule.employee;
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
      pdf.text(FUNCTION_LABELS[func], x + 6, legendY);
    });

    return pdf;
  }
}
