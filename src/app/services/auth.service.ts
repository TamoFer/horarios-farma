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
      .from('roles_usuarios')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (manager) {
      this._manager.set(manager as Manager);
      await this.loadManagerBranches(manager.id);
    }
  }

  private async loadManagerBranches(managerId: number) {
    const manager = this._manager();
    let branchList: Branch[] = [];

    if (manager?.role === 'admin') {
      const { data: allBranches } = await this.supabase
        .from('sucursales')
        .select('*')
        .order('nombre_suc');

      if (allBranches) {
        branchList = allBranches.map((b: any) => ({
          id: b.id,
          name: b.nombre_suc,
          address: b.direccion || ''
        })) as Branch[];
      }
    } else {
      const { data: branches } = await this.supabase
        .from('encargados_sucursales')
        .select('branch_id, sucursales(*)')
        .eq('manager_id', managerId);

      if (branches) {
        branchList = branches.map((b: any) => ({
          id: b.sucursales.id,
          name: b.sucursales.nombre_suc,
          address: b.sucursales.direccion || ''
        })) as Branch[];
      }
    }

    this._managerBranches.set(branchList);
    await this.loadAllEmployeesForBranches(branchList);
  }

  private async loadAllEmployeesForBranches(branches: Branch[]) {
    const branchIds = branches.map(b => b.id);
    const { data: employees } = await this.supabase
      .from('empleados')
      .select('*')
      .in('branch_id', branchIds)
      .eq('trabajando', true);

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
    let shifts = [{ start: 9, end: 18 }];
    if (emp.carga_horaria) {
      if (typeof emp.carga_horaria === 'string') {
        try {
          shifts = JSON.parse(emp.carga_horaria);
        } catch {
          shifts = [{ start: 9, end: 18 }];
        }
      } else if (Array.isArray(emp.carga_horaria)) {
        shifts = emp.carga_horaria;
      }
    }

    return {
      id: emp.id,
      name: emp.nombre,
      functions: emp.funciones || [],
      defaultFunction: emp.puesto_contratado || 'vendedor',
      weeklyHours: parseFloat(emp.jornada_semanal) || 40,
      dayOff: emp.franco,
      shifts,
      nro_vendedor: emp.nro_vendedor
    } as Employee & { nro_vendedor: number | null };
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

  clearSelectedBranch(): void {
    this._selectedBranch.set(null);
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

  async refreshEmployeesForCurrentBranch(): Promise<void> {
    const branch = this._selectedBranch();
    const manager = this._manager();
    if (!branch || !manager) return;

    const { data: employees } = await this.supabase
      .from('empleados')
      .select('*')
      .eq('branch_id', branch.id)
      .eq('trabajando', true);

    if (employees) {
      const mapped = employees.map((emp: any) => this.mapDbToEmployee(emp));
      this._branchEmployees.update(map => {
        const newMap = new Map(map);
        newMap.set(branch.id, mapped);
        return newMap;
      });
    }
  }
}
