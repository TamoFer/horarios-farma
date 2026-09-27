import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import {
  DayOfWeek,
  EmployeeException,
  EmployeeExceptionDraft,
  ExceptionType,
  JobFunction,
  ShiftBlock,
  normalizeShiftBlocks,
} from '../models/employee.model';

interface ExceptionRow {
  id: number;
  empleado_id: number;
  tipo: string;
  dia: string | null;
  desde: string | null;
  hasta: string | null;
  funcion: string;
  horario: string | { start: number; end: number }[] | null;
  cubre_a: number | null;
}

@Injectable({
  providedIn: 'root',
})
export class ExceptionService {
  private authService = inject(AuthService);
  private _exceptions = signal<EmployeeException[]>([]);
  exceptions = this._exceptions.asReadonly();

  private mapRow(row: ExceptionRow): EmployeeException {
    let shifts: ShiftBlock[] = [];
    if (row.horario) {
      if (typeof row.horario === 'string') {
        try {
          shifts = JSON.parse(row.horario);
        } catch {
          shifts = [];
        }
      } else if (Array.isArray(row.horario)) {
        shifts = row.horario;
      }
    }
    return {
      id: row.id,
      employeeId: row.empleado_id,
      type: (row.tipo === 'espontanea' ? 'espontanea' : 'fija') as ExceptionType,
      dayOfWeek: (row.dia as DayOfWeek | null) ?? null,
      startDate: row.desde ? row.desde.split('T')[0] : null,
      endDate: row.hasta ? row.hasta.split('T')[0] : null,
      function: row.funcion as JobFunction,
      shifts: normalizeShiftBlocks(shifts),
      coveredEmployeeId: row.cubre_a ?? null,
    };
  }

  async loadForEmployees(employeeIds: number[]): Promise<void> {
    if (employeeIds.length === 0) {
      this._exceptions.set([]);
      return;
    }
    const { data, error } = await this.authService
      .getSupabase()
      .from('excepciones')
      .select('*')
      .in('empleado_id', employeeIds)
      .order('id');
    if (error) {
      this._exceptions.set([]);
      return;
    }
    this._exceptions.set((data ?? []).map((row: ExceptionRow) => this.mapRow(row)));
  }

  async loadForEmployee(employeeId: number): Promise<void> {
    await this.loadForEmployees(this.employeeIds().includes(employeeId)
      ? this.employeeIds()
      : [...this.employeeIds(), employeeId]);
  }

  private employeeIds(): number[] {
    const branch = this.authService.selectedBranch();
    if (!branch) return [];
    return this.authService.getEmployeesForBranch(branch.id).map((e) => e.id);
  }

  private rowFromDraft(draft: EmployeeExceptionDraft & { employeeId: number }) {
    return {
      empleado_id: draft.employeeId,
      tipo: draft.type,
      dia: draft.dayOfWeek,
      desde: draft.startDate,
      hasta: draft.endDate,
      funcion: draft.function,
      horario: JSON.stringify(draft.shifts),
      cubre_a: draft.coveredEmployeeId,
    };
  }

  async create(draft: EmployeeExceptionDraft & { employeeId: number }): Promise<boolean> {
    const { error } = await this.authService.getSupabase().from('excepciones').insert(this.rowFromDraft(draft));
    if (error) return false;
    await this.loadForEmployees(this.employeeIds());
    return true;
  }

  async update(id: number, draft: EmployeeExceptionDraft & { employeeId: number }): Promise<boolean> {
    const { error } = await this.authService
      .getSupabase()
      .from('excepciones')
      .update(this.rowFromDraft(draft))
      .eq('id', id);
    if (error) return false;
    await this.loadForEmployees(this.employeeIds());
    return true;
  }

  async remove(id: number): Promise<boolean> {
    const { error } = await this.authService.getSupabase().from('excepciones').delete().eq('id', id);
    if (error) return false;
    await this.loadForEmployees(this.employeeIds());
    return true;
  }

  async replaceAllForEmployee(employeeId: number, drafts: EmployeeExceptionDraft[]): Promise<boolean> {
    const { error } = await this.authService
      .getSupabase()
      .from('excepciones')
      .delete()
      .eq('empleado_id', employeeId);
    if (error) return false;
    if (drafts.length === 0) {
      await this.loadForEmployees(this.employeeIds());
      return true;
    }
    const rows = drafts.map((draft) => ({
      empleado_id: employeeId,
      tipo: draft.type,
      dia: draft.dayOfWeek,
      desde: draft.startDate,
      hasta: draft.endDate,
      funcion: draft.function,
      horario: JSON.stringify(draft.shifts),
      cubre_a: draft.coveredEmployeeId,
    }));
    const { error: insertError } = await this.authService.getSupabase().from('excepciones').insert(rows);
    if (insertError) return false;
    await this.loadForEmployees(this.employeeIds());
    return true;
  }
}
