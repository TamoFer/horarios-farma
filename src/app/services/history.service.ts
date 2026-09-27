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
        .eq('branch_id', branch.id.toString())
        .order('schedule_date', { ascending: false })
        .limit(this.MAX_HISTORY);

      if (error) {
        console.error('Error loading history from database:', error);
        this.history.set([]);
        return;
      }

      const historyItems: ScheduleHistory[] = (data || []).map((item: any) => ({
        id: item.id,
        date: this.formatDisplayDate(item.schedule_date),
        scheduleDate: item.schedule_date,
        branchId: item.branch_id,
        placedEmployees: typeof item.placed_employees === 'string'
          ? JSON.parse(item.placed_employees)
          : item.placed_employees || [],
        createdAt: new Date(item.created_at),
        isFinal: item.is_final || false
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
    return this.history().find(h => h.scheduleDate === date);
  }

  async deleteEntry(id: string): Promise<boolean> {
    const { error } = await this.authService.getSupabase()
      .from('historial_horarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting entry:', error);
      return false;
    }

    this.history.update(list => list.filter(h => h.id !== id));
    return true;
  }

  async updateEntry(id: string, placedEmployees: PlacedEmployeeData[]): Promise<void> {
    await this.authService.getSupabase()
      .from('historial_horarios')
      .update({
        placed_employees: JSON.stringify(placedEmployees),
        created_at: new Date().toISOString()
      })
      .eq('id', id);

    this.history.update(list => list.map(h =>
      h.id === id
        ? { ...h, placedEmployees, createdAt: new Date() }
        : h
    ));
  }

  async finalizeEntry(id: string): Promise<boolean> {
    const { error } = await this.authService.getSupabase()
      .from('historial_horarios')
      .update({ is_final: true })
      .eq('id', id);

    if (error) {
      console.error('Error finalizing entry:', error);
      return false;
    }

    this.history.update(list => list.map(h =>
      h.id === id ? { ...h, isFinal: true } : h
    ));
    return true;
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

  async finalizeOldDrafts(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const draftsToFinalize = this.history().filter(h => !h.isFinal && h.scheduleDate < today);

    for (const draft of draftsToFinalize) {
      await this.finalizeEntry(draft.id);
    }
  }

  hasScheduleForDate(date: string): boolean {
    return this.history().some(h => h.scheduleDate === date);
  }

  getNextAvailableDate(fromDate: string): string {
    const history = this.history();
    let checkDate = new Date(fromDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    while (checkDate < today) {
      checkDate.setDate(checkDate.getDate() + 1);
    }

    while (history.some(h => h.scheduleDate === checkDate.toISOString().split('T')[0])) {
      checkDate.setDate(checkDate.getDate() + 1);
    }

    return checkDate.toISOString().split('T')[0];
  }
}
