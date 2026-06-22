import { Injectable, signal, inject } from '@angular/core';
import { ScheduleHistory, PlacedEmployeeData } from '../models/employee.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private authService = inject(AuthService);
  private readonly MAX_HISTORY = 50;
  private readonly EDIT_KEY = 'schedule_to_edit';

  history = signal<ScheduleHistory[]>([]);
  loading = signal(false);

  async loadFromDatabase(): Promise<void> {
    const branch = this.authService.selectedBranch();
    if (!branch) {
      this.history.set([]);
      return;
    }

    this.loading.set(true);
    try {
      const { data, error } = await this.authService.getSupabase()
        .from('historial_horarios')
        .select('*')
        .eq('sucursal_id', branch.id)
        .order('fecha', { ascending: false })
        .limit(this.MAX_HISTORY);

      if (error) {
        console.error('Error loading history from database:', error);
        this.history.set([]);
        return;
      }

      const historyItems: ScheduleHistory[] = (data || []).map((item: any) => ({
        id: item.id.toString(),
        date: this.formatDisplayDate(item.fecha),
        scheduleDate: item.fecha,
        branchId: item.sucursal_id,
        placedEmployees: typeof item.empleados === 'string' 
          ? JSON.parse(item.empleados) 
          : item.empleados || [],
        createdAt: new Date(item.creado)
      }));

      this.history.set(historyItems);
    } catch (error) {
      console.error('Error loading history:', error);
      this.history.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private formatDisplayDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName} ${day} de ${month} de ${year}`;
  }

  getByDate(date: string): ScheduleHistory | undefined {
    return this.history().find(h => h.date === date);
  }

  async deleteEntry(id: string): Promise<void> {
    await this.authService.getSupabase()
      .from('historial_horarios')
      .delete()
      .eq('id', parseInt(id));

    this.history.update(list => list.filter(h => h.id !== id));
  }

  async updateEntry(id: string, placedEmployees: PlacedEmployeeData[]): Promise<void> {
    await this.authService.getSupabase()
      .from('historial_horarios')
      .update({
        empleados: JSON.stringify(placedEmployees),
        creado: new Date().toISOString()
      })
      .eq('id', parseInt(id));

    this.history.update(list => list.map(h => 
      h.id === id 
        ? { ...h, placedEmployees, createdAt: new Date() }
        : h
    ));
  }

  setScheduleToEdit(schedule: ScheduleHistory): void {
    sessionStorage.setItem(this.EDIT_KEY, JSON.stringify(schedule));
  }

  getScheduleToEdit(): ScheduleHistory | null {
    const stored = sessionStorage.getItem(this.EDIT_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  clearScheduleToEdit(): void {
    sessionStorage.removeItem(this.EDIT_KEY);
  }

  clearHistory(): void {
    this.history.set([]);
  }
}
