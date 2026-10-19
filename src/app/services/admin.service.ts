import { Injectable, signal, inject } from '@angular/core';
import { AuthService, Branch, Manager, UserRole } from './auth.service';
import { Employee } from '../models/employee.model';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private authService = inject(AuthService);
  private supabase = this.authService.getSupabase();

  branches = signal<Branch[]>([]);
  managers = signal<Manager[]>([]);
  loading = signal(false);
  lastError = signal<string | null>(null);
  /** Sucursal -> user_ids de sus encargados (puede haber más de uno). */
  branchEncargados = signal<Map<number, string[]>>(new Map());
  /** Empleados (plantel) para vincular con cuentas de la plataforma. */
  empleados = signal<{ id: number; nombre: string; sucursal: string; userId: string | null }[]>([]);

  async loadAllBranches(): Promise<void> {
    this.loading.set(true);
    const { data, error } = await this.supabase.from('sucursales').select('*').order('nombre_suc');

    if (!error && data) {
      this.branches.set(
        data.map((b: any) => ({
          id: b.id,
          name: b.nombre_suc,
          address: b.direccion || '',
          is24hs: !!b.es_24hs,
        })) as Branch[],
      );
    }
    this.loading.set(false);
  }

  async loadAllManagers(): Promise<void> {
    this.loading.set(true);
    this.lastError.set(null);
    // RPC: devuelve TODOS los usuarios de auth (existan o no en roles_usuarios),
    // con rol 'pendiente' si todavía no se les asignó uno.
    const { data, error } = await this.supabase.rpc('listar_usuarios');

    if (error) {
      this.lastError.set(error.message);
      this.managers.set([]);
    } else if (data) {
      this.managers.set(
        (data as any[]).map((u) => ({
          id: u.roles_id ?? 0,
          user_id: u.user_id,
          name: u.nombre,
          email: u.email,
          role: u.rol as UserRole,
        })),
      );
    }
    this.loading.set(false);
  }

  async loadEmployeesByBranch(branchId: number): Promise<Employee[]> {
    const { data, error } = await this.supabase
      .from('empleados')
      .select('*')
      .eq('branch_id', branchId)
      .eq('trabajando', true)
      .order('nombre');

    if (error) return [];
    return (data || []).map((emp: any) => this.mapDbToEmployee(emp));
  }

  async createBranch(
    name: string,
    address: string,
    is24hs: boolean,
  ): Promise<{ error: any; id?: number }> {
    const { data, error } = await this.supabase
      .from('sucursales')
      .insert({ nombre_suc: name, direccion: address, es_24hs: is24hs })
      .select('id')
      .single();

    if (!error) {
      await this.loadAllBranches();
    }
    return { error, id: data?.id };
  }

  async updateBranch(
    id: number,
    name: string,
    address: string,
    is24hs: boolean,
  ): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('sucursales')
      .update({ nombre_suc: name, direccion: address, es_24hs: is24hs })
      .eq('id', id);

    if (!error) {
      await this.loadAllBranches();
    }
    return { error };
  }

  async deleteBranch(id: number): Promise<{ error: any }> {
    const { error } = await this.supabase.from('sucursales').delete().eq('id', id);

    if (!error) {
      await this.loadAllBranches();
    }
    return { error };
  }

  async loadBranchEncargados(): Promise<void> {
    const { data, error } = await this.supabase.rpc('listar_encargados');
    if (!error && data) {
      const map = new Map<number, string[]>();
      (data as any[]).forEach((row) => {
        const list = map.get(row.branch_id) ?? [];
        list.push(row.user_id);
        map.set(row.branch_id, list);
      });
      this.branchEncargados.set(map);
    }
  }

  async setBranchEncargados(branchId: number, userIds: string[]): Promise<{ error: any }> {
    const { error } = await this.supabase.rpc('set_encargados_sucursal', {
      p_branch_id: branchId,
      p_user_ids: userIds,
    });

    if (!error) {
      await this.loadBranchEncargados();
    }
    return { error };
  }

  async loadEmpleados(): Promise<void> {
    const { data, error } = await this.supabase.rpc('listar_empleados');
    if (!error && data) {
      this.empleados.set(
        (data as any[]).map((e) => ({
          id: e.id,
          nombre: e.nombre,
          sucursal: e.sucursal,
          userId: e.user_id ?? null,
        })),
      );
    }
  }

  async vincularEmpleado(userId: string, empleadoId: number | null): Promise<{ error: any }> {
    const { error } = await this.supabase.rpc('vincular_empleado', {
      p_user_id: userId,
      p_empleado_id: empleadoId,
    });

    if (!error) {
      await this.loadEmpleados();
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
    shifts: any[],
  ): Promise<{ error: any }> {
    const { error } = await this.supabase.from('empleados').insert({
      branch_id: branchId,
      nombre: name,
      funciones: functions,
      puesto_contratado: defaultFunction,
      jornada_semanal: weeklyHours,
      franco: dayOff,
      carga_horaria: JSON.stringify(shifts),
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
    shifts: any[],
  ): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('empleados')
      .update({
        nombre: name,
        funciones: functions,
        puesto_contratado: defaultFunction,
        jornada_semanal: weeklyHours,
        franco: dayOff,
        carga_horaria: JSON.stringify(shifts),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return { error };
  }

  async deleteEmployee(id: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('empleados')
      .update({ trabajando: false })
      .eq('id', id);

    return { error };
  }

  async updateManagerRole(userId: string, role: UserRole): Promise<{ error: any }> {
    const { error } = await this.supabase.rpc('asignar_rol_usuario', {
      p_user_id: userId,
      p_rol: role,
    });

    if (!error) {
      await this.loadAllManagers();
    }
    return { error };
  }

  async assignBranchToManager(managerId: number, branchId: number): Promise<{ error: any }> {
    const { error } = await this.supabase.rpc('asignar_sucursal_usuario', {
      p_manager_id: managerId,
      p_branch_id: branchId,
    });

    return { error };
  }

  async removeBranchFromManager(managerId: number, branchId: number): Promise<{ error: any }> {
    const { error } = await this.supabase.rpc('quitar_sucursal_usuario', {
      p_manager_id: managerId,
      p_branch_id: branchId,
    });

    return { error };
  }

  async deleteUser(userId: string): Promise<{ error: any }> {
    const { error } = await this.supabase.rpc('eliminar_usuario', { p_user_id: userId });

    if (error) {
      this.lastError.set(error.message);
      return { error };
    }

    await this.loadAllManagers();
    return { error: null };
  }

  async getManagerBranches(managerId: number): Promise<Branch[]> {
    const { data } = await this.supabase
      .from('encargados_sucursales')
      .select('branch_id, sucursales(*)')
      .eq('manager_id', managerId);

    if (data) {
      return data.map((b: any) => ({
        id: b.sucursales.id,
        name: b.sucursales.nombre_suc,
        address: b.sucursales.direccion || '',
      })) as Branch[];
    }
    return [];
  }

  async getAvailableManagersForBranch(branchId: number): Promise<Manager[]> {
    const { data: assigned } = await this.supabase
      .from('encargados_sucursales')
      .select('manager_id')
      .eq('branch_id', branchId);

    const assignedIds = (assigned || []).map((a: any) => a.manager_id);

    const { data: managers } = await this.supabase.from('roles_usuarios').select('*').order('name');

    if (managers) {
      return (managers as Manager[]).filter((m) => !assignedIds.includes(m.id));
    }
    return [];
  }

  async transferEmployeeToBranch(employeeId: number, newBranchId: number): Promise<{ error: any }> {
    const { error } = await this.supabase
      .from('empleados')
      .update({ branch_id: newBranchId, updated_at: new Date().toISOString() })
      .eq('id', employeeId);

    return { error };
  }

  private mapDbToEmployee(emp: any): Employee {
    return {
      id: emp.id,
      name: emp.nombre,
      functions: emp.funciones || [],
      defaultFunction: emp.puesto_contratado || 'vendedor',
      weeklyHours: parseFloat(emp.jornada_semanal) || 40,
      dayOff: emp.franco,
      shifts:
        typeof emp.carga_horaria === 'string'
          ? JSON.parse(emp.carga_horaria)
          : emp.carga_horaria
            ? [{ start: 9, end: 18 }]
            : [],
    };
  }
}
