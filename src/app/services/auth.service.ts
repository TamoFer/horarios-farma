import { Injectable, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient, AuthSession } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Employee } from '../models/employee.model';

export interface Manager {
  id: number;
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager';
}

export interface Branch {
  id: number;
  name: string;
  address: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient;
  private _session = signal<AuthSession | null>(null);
  private _manager = signal<Manager | null>(null);
  private _managerBranches = signal<Branch[]>([]);
  private _branchEmployees = signal<Map<number, Employee[]>>(new Map());
  private _loading = signal(true);
  private _selectedBranch = signal<Branch | null>(null);
  private platformId: any;

  session = this._session.asReadonly();
  manager = this._manager.asReadonly();
  managerBranches = this._managerBranches.asReadonly();
  loading = this._loading.asReadonly();
  selectedBranch = this._selectedBranch.asReadonly();
  branchEmployees = this._branchEmployees.asReadonly();
  isAuthenticated = computed(() => !!this._session());
  isAdmin = computed(() => this._manager()?.role === 'admin');

  constructor(@Inject(PLATFORM_ID) platformId: any) {
    this.platformId = platformId;
    this.supabase = createClient(
      environment.supabase.url,
      environment.supabase.anonKey
    );
  }

  initialize(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this._loading.set(false);
      return;
    }

    this.initAuth();
  }

  private async initAuth() {
    if (!isPlatformBrowser(this.platformId)) {
      this._loading.set(false);
      return;
    }

    this.supabase.auth.onAuthStateChange((_, session) => {
      this._session.set(session);
    });

    const { data: { session } } = await this.supabase.auth.getSession();
    this._session.set(session);

    if (session) {
      await this.loadManagerData(session.user.id);
    }

    this._loading.set(false);
  }

  private async loadManagerData(userId: string) {
    const { data: manager } = await this.supabase
      .from('managers')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (manager) {
      this._manager.set(manager as Manager);
      await this.loadManagerBranches(manager.id);
    }
  }

  private async loadManagerBranches(managerId: number) {
    const { data: branches } = await this.supabase
      .from('manager_branches')
      .select('branch_id, branches(*)')
      .eq('manager_id', managerId);

    if (branches) {
      const branchList = branches.map((b: any) => b.branches) as Branch[];
      this._managerBranches.set(branchList);
      await this.loadAllEmployeesForBranches(branchList);
    }
  }

  private async loadAllEmployeesForBranches(branches: Branch[]) {
    const branchIds = branches.map(b => b.id);
    const { data: employees } = await this.supabase
      .from('employees')
      .select('*')
      .in('branch_id', branchIds)
      .eq('active', true);

    if (employees) {
      const employeesMap = new Map<number, Employee[]>();
      branches.forEach(branch => {
        employeesMap.set(branch.id, []);
      });
      employees.forEach((emp: any) => {
        const list = employeesMap.get(emp.branch_id) || [];
        list.push(this.mapDbToEmployee(emp));
        employeesMap.set(emp.branch_id, list);
      });
      this._branchEmployees.set(employeesMap);
    }
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

  async signIn(email: string, password: string): Promise<{ error: any }> {
    const { error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!error) {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        await this.loadManagerData(session.user.id);
      }
    }

    return { error };
  }

  async signUp(email: string, password: string, name: string): Promise<{ error: any }> {
    const { error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });
    return { error };
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this._manager.set(null);
    this._managerBranches.set([]);
    this._branchEmployees.set(new Map());
    this._selectedBranch.set(null);
  }

  selectBranch(branch: Branch): void {
    this._selectedBranch.set(branch);
  }

  getEmployeesForBranch(branchId: number): Employee[] {
    return this._branchEmployees().get(branchId) || [];
  }

  getSupabase(): SupabaseClient {
    return this.supabase;
  }

  async refreshManagerData(): Promise<void> {
    const session = this._session();
    if (session) {
      await this.loadManagerData(session.user.id);
    }
  }
}