import { Injectable, signal, inject } from '@angular/core';
import { AuthService, Branch, Manager } from './auth.service';
import { Employee } from '../models/employee.model';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private authService = inject(AuthService);
  private supabase = this.authService.getSupabase();

  branches = signal<Branch[]>([]);
  managers = signal<Manager[]>([]);
  loading = signal(false);

  async loadAllBranches(): Promise<void> {
    this.loading.set(true);
    const { data, error } = await this.supabase
      .from('branches')
      .select('*')
      .order('name');

    if (!error && data) {
      this.branches.set(data as Branch[]);
    }
    this.loading.set(false);
  }

  async loadAllManagers(): Promise<void> {
    this.loading.set(true);
    const { data, error } = await this.supabase
      .from('managers')
      .select('*')
      .order('name');

    if (!error && data) {
      this.managers.set(data as Manager[]);
    }
    this.loading.set(false);
  }

  async loadEmployeesByBranch(branchId: number): Promise<Employee[]> {
    const { data, error } = await this.supabase
      .from('employees')
      .select('*')
      .eq('branch_id', branchId)
      .eq('active', true)
      .order('name');

    if (error) return [];
    return (data || []).map((emp: any) => this.mapDbToEmployee(emp));
  }

  async createBranch(name: string, address: string): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('branches')
      .insert({ name, address });

    if (!error) {
      await this.loadAllBranches();
    }
    return { error };
  }

  async updateBranch(id: number, name: string, address: string): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('branches')
      .update({ name, address })
      .eq('id', id);

    if (!error) {
      await this.loadAllBranches();
    }
    return { error };
  }

  async deleteBranch(id: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('branches')
      .delete()
      .eq('id', id);

    if (!error) {
      await this.loadAllBranches();
    }
    return { error };
  }

  async createEmployee(
    branchId: number,
    name: string,
    functions: string[],
    defaultFunction: string,
    weeklyHours: number,
    dayOff: string,
    shifts: any[]
  ): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('employees')
      .insert({
        branch_id: branchId,
        name,
        functions,
        default_function: defaultFunction,
        weekly_hours: weeklyHours,
        day_off: dayOff,
        shifts: JSON.stringify(shifts)
      });

    return { error };
  }

  async updateEmployee(
    id: number,
    name: string,
    functions: string[],
    defaultFunction: string,
    weeklyHours: number,
    dayOff: string,
    shifts: any[]
  ): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('employees')
      .update({
        name,
        functions,
        default_function: defaultFunction,
        weekly_hours: weeklyHours,
        day_off: dayOff,
        shifts: JSON.stringify(shifts),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return { error };
  }

  async deleteEmployee(id: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('employees')
      .update({ active: false })
      .eq('id', id);

    return { error };
  }

  async createManager(userId: string, name: string, email: string, role: 'admin' | 'manager'): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('managers')
      .insert({ user_id: userId, name, email, role });

    if (!error) {
      await this.loadAllManagers();
    }
    return { error };
  }

  async updateManagerRole(id: number, role: 'admin' | 'manager'): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('managers')
      .update({ role })
      .eq('id', id);

    if (!error) {
      await this.loadAllManagers();
    }
    return { error };
  }

  async assignBranchToManager(managerId: number, branchId: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('manager_branches')
      .insert({ manager_id: managerId, branch_id: branchId });

    return { error };
  }

  async removeBranchFromManager(managerId: number, branchId: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('manager_branches')
      .delete()
      .eq('manager_id', managerId)
      .eq('branch_id', branchId);

    return { error };
  }

  async getManagerBranches(managerId: number): Promise<Branch[]> {
    const { data } = await this.supabase
      .from('manager_branches')
      .select('branch_id, branches(*)')
      .eq('manager_id', managerId);

    if (data) {
      return data.map((b: any) => b.branches) as Branch[];
    }
    return [];
  }

  async getAvailableManagersForBranch(branchId: number): Promise<Manager[]> {
    const { data: assigned } = await this.supabase
      .from('manager_branches')
      .select('manager_id')
      .eq('branch_id', branchId);

    const assignedIds = (assigned || []).map((a: any) => a.manager_id);

    const { data: managers } = await this.supabase
      .from('managers')
      .select('*')
      .order('name');

    if (managers) {
      return (managers as Manager[]).filter(m => !assignedIds.includes(m.id));
    }
    return [];
  }

  async transferEmployeeToBranch(employeeId: number, newBranchId: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('employees')
      .update({ branch_id: newBranchId, updated_at: new Date().toISOString() })
      .eq('id', employeeId);

    return { error };
  }

  private mapDbToEmployee(emp: any): Employee {
    return {
      id: emp.id,
      name: emp.name,
      functions: emp.functions || [],
      defaultFunction: emp.default_function,
      weeklyHours: parseFloat(emp.weekly_hours) || 40,
      dayOff: emp.day_off,
      shifts: typeof emp.shifts === 'string' ? JSON.parse(emp.shifts) : (emp.shifts || [])
    };
  }
}