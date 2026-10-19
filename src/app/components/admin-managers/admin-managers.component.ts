import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, Branch, Manager, UserRole } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-admin-managers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-6">
      <div class="max-w-4xl mx-auto">
        <div class="bg-white rounded-2xl shadow-2xl p-6">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold text-gray-800">Administración de Usuarios</h1>
              <p class="text-gray-500 text-sm mt-1">Gestiona roles y asignaciones de sucursales</p>
              <p class="text-xs text-amber-600 mt-1">
                Los usuarios nuevos aparecen como «Pendiente». Asignales un rol (y sucursal si es
                Encargado) para activarlos.
              </p>
            </div>
            <button
              (click)="goBack()"
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              ← Volver
            </button>
          </div>

          <div class="border border-gray-200 rounded-xl p-4 mb-6">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-semibold text-gray-800">Sucursales</h2>
              <button
                (click)="openNewBranch()"
                class="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
              >
                + Nueva sucursal
              </button>
            </div>

            @if (allBranches().length === 0) {
              <p class="text-sm text-gray-500">No hay sucursales todavía.</p>
            } @else {
              <div class="divide-y divide-gray-100">
                @for (branch of allBranches(); track branch.id) {
                  <div class="flex items-center justify-between py-2">
                    <div>
                      <p class="font-medium text-gray-900">
                        {{ branch.name }}
                        @if (branch.is24hs) {
                          <span
                            class="ml-2 px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs"
                            >24 hs</span
                          >
                        }
                      </p>
                      <p class="text-xs text-gray-500">{{ branch.address || 'Sin dirección' }}</p>
                      <p class="text-xs text-gray-400">
                        Encargado: {{ encargadoNames(branch.id) }}
                        @if (!hasEncargado(branch.id)) {
                          <span class="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700"
                            >Falta encargado</span
                          >
                        }
                      </p>
                    </div>
                    <div class="flex items-center gap-1">
                      <button
                        (click)="openEditBranch(branch)"
                        class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Editar"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        (click)="confirmDeleteBranch(branch)"
                        class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Eliminar"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <h2 class="text-lg font-semibold text-gray-800 mb-3">Usuarios</h2>

          @if (loading()) {
            <div class="text-center py-8">
              <p class="text-gray-500">Cargando...</p>
            </div>
          } @else {
            <div class="space-y-4">
              @for (manager of pendingFirst(); track manager.user_id) {
                <div class="border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                      <div
                        class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center"
                      >
                        <span class="text-indigo-600 font-bold text-lg">
                          {{ manager.name.charAt(0).toUpperCase() }}
                        </span>
                      </div>
                      <div>
                        <p class="font-semibold text-gray-900">
                          {{ manager.name }}
                          @if (manager.role === 'pendiente') {
                            <span
                              class="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700"
                              >Pendiente</span
                            >
                          }
                          @if (isManagerWithoutBranch(manager)) {
                            <span
                              class="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700"
                              >Sin sucursal</span
                            >
                          }
                        </p>
                        <p class="text-sm text-gray-500">{{ manager.email }}</p>
                        <select
                          [value]="linkedEmpleadoId(manager.user_id) ?? ''"
                          (change)="onEmpleadoLinkChange(manager, $event)"
                          class="mt-1 text-xs border border-gray-200 rounded px-2 py-1 text-gray-600 bg-white max-w-[260px]"
                          title="Vincular con una ficha de empleado"
                        >
                          <option value="">Sin vincular a empleado</option>
                          @for (emp of empleadoOptionsFor(manager.user_id); track emp.id) {
                            <option [value]="emp.id">{{ emp.nombre }} · {{ emp.sucursal }}</option>
                          }
                        </select>
                      </div>
                    </div>

                    <div class="flex items-center gap-3">
                      <select
                        [value]="manager.role"
                        (change)="onRoleChange(manager, $event)"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="encargado">Encargado</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="rrhh">Recursos Humanos</option>
                        <option value="admin">Admin</option>
                      </select>

                      @if (manager.role === 'encargado') {
                        <button
                          (click)="toggleBranchAssignment(manager)"
                          class="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                        >
                          Sucursales
                        </button>
                      }

                      @if (!isSelf(manager)) {
                        <button
                          (click)="confirmDeleteUser(manager)"
                          class="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar usuario"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      }
                    </div>
                  </div>

                  @if (expandedManagerId() === manager.id && manager.role === 'encargado') {
                    <div class="mt-4 pt-4 border-t border-gray-200">
                      <p class="text-sm font-medium text-gray-700 mb-3">Asignar a sucursales:</p>
                      <div class="flex flex-wrap gap-2">
                        @for (branch of allBranches(); track branch.id) {
                          <button
                            (click)="toggleManagerBranch(manager, branch)"
                            [class.bg-green-500]="isManagerAssignedToBranch(manager, branch.id)"
                            [class.text-white]="isManagerAssignedToBranch(manager, branch.id)"
                            [class.bg-gray-100]="!isManagerAssignedToBranch(manager, branch.id)"
                            [class.text-gray-700]="!isManagerAssignedToBranch(manager, branch.id)"
                            class="px-3 py-1.5 rounded-lg text-sm font-medium transition hover:opacity-80"
                          >
                            {{ branch.name }}
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
              }

              @if (managers().length === 0) {
                <p class="text-center text-gray-500 py-8">No hay usuarios registrados.</p>
              }

              @if (adminService.lastError()) {
                <div class="bg-red-50 text-red-600 p-3 rounded-lg text-sm break-words">
                  Error al listar usuarios: {{ adminService.lastError() }}
                </div>
              }
            </div>
          }
        </div>

        @if (showBranchModal()) {
          <div
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          >
            <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <h3 class="text-lg font-semibold text-gray-900 mb-4">
                {{ editingBranch() ? 'Editar sucursal' : 'Nueva sucursal' }}
              </h3>
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                  <input
                    type="text"
                    [(ngModel)]="branchForm.name"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Farmacia Centro"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input
                    type="text"
                    [(ngModel)]="branchForm.address"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Av. Siempre Viva 123"
                  />
                </div>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    [(ngModel)]="branchForm.is24hs"
                    class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span class="text-sm text-gray-700">Abierta 24 hs (tiene nochero)</span>
                </label>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Encargados</label>
                  @if (encargadoOptions().length === 0) {
                    <p class="text-xs text-gray-400">
                      No hay usuarios «Encargado» ni «Pendiente» todavía.
                    </p>
                  } @else {
                    <div
                      class="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto"
                    >
                      @for (user of encargadoOptions(); track user.user_id) {
                        <label
                          class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            [checked]="isEncargadoSelected(user.user_id)"
                            (change)="toggleEncargado(user.user_id)"
                            class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span class="text-sm text-gray-700"
                            >{{ user.name }} ({{ user.email }})</span
                          >
                          @if (user.role === 'pendiente') {
                            <span class="ml-auto text-xs text-amber-600">Pendiente</span>
                          }
                        </label>
                      }
                    </div>
                  }
                  <p class="text-xs text-gray-400 mt-1">
                    Obligatorio: elegí al menos un encargado. Los «Pendiente» pasan a Encargado.
                  </p>
                </div>
              </div>
              <div class="flex justify-end gap-3 mt-6">
                <button
                  (click)="closeBranchModal()"
                  class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  (click)="saveBranch()"
                  class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  {{ editingBranch() ? 'Guardar' : 'Crear' }}
                </button>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class AdminManagersComponent implements OnInit {
  private authService = inject(AuthService);
  adminService = inject(AdminService);
  private confirmService = inject(ConfirmService);
  private router = inject(Router);

  managers = this.adminService.managers;
  allBranches = this.adminService.branches;
  loading = signal(true);
  expandedManagerId = signal<number | null>(null);
  private managerBranchMap = signal<Map<number, number[]>>(new Map());

  showBranchModal = signal(false);
  editingBranch = signal<Branch | null>(null);
  branchForm: { name: string; address: string; is24hs: boolean; encargadoUserIds: string[] } = {
    name: '',
    address: '',
    is24hs: false,
    encargadoUserIds: [],
  };

  async ngOnInit() {
    if (this.authService.manager()?.role !== 'admin') {
      this.router.navigate(['/dashboard']);
      return;
    }

    await this.adminService.loadAllManagers();
    await this.adminService.loadAllBranches();
    await this.adminService.loadBranchEncargados();
    await this.adminService.loadEmpleados();
    await this.loadAllManagerBranches();
    this.loading.set(false);
  }

  private async loadAllManagerBranches() {
    const allManagers = this.managers();
    const map = new Map<number, number[]>();

    for (const manager of allManagers) {
      const branches = await this.adminService.getManagerBranches(manager.id);
      map.set(
        manager.id,
        branches.map((b) => b.id),
      );
    }

    this.managerBranchMap.set(map);
  }

  /** Encargado sin sucursal asignada: todavía no puede operar. */
  isManagerWithoutBranch(manager: Manager): boolean {
    if (manager.role !== 'encargado') return false;
    return (this.managerBranchMap().get(manager.id)?.length ?? 0) === 0;
  }

  /** Orden: pendientes primero, luego encargados sin sucursal. */
  private priority(manager: Manager): number {
    if (manager.role === 'pendiente') return 0;
    if (this.isManagerWithoutBranch(manager)) return 1;
    return 2;
  }

  pendingFirst(): Manager[] {
    return [...this.managers()].sort((a, b) => this.priority(a) - this.priority(b));
  }

  isManagerAssignedToBranch(manager: Manager, branchId: number): boolean {
    return this.managerBranchMap().get(manager.id)?.includes(branchId) || false;
  }

  /** No se puede eliminar el propio usuario. */
  isSelf(manager: Manager): boolean {
    return manager.user_id === this.authService.manager()?.user_id;
  }

  confirmDeleteUser(manager: Manager): void {
    this.confirmService.confirmDelete(`el usuario ${manager.name} (${manager.email})`, () =>
      this.deleteUser(manager),
    );
  }

  async deleteUser(manager: Manager): Promise<void> {
    await this.adminService.deleteUser(manager.user_id);
    await this.loadAllManagerBranches();
  }

  // ---- Vínculo usuario <-> empleado ----

  linkedEmpleadoId(userId: string): number | null {
    const emp = this.adminService.empleados().find((e) => e.userId === userId);
    return emp ? emp.id : null;
  }

  /** Empleados sin vincular + el que ya está vinculado a este usuario. */
  empleadoOptionsFor(userId: string) {
    return this.adminService.empleados().filter((e) => e.userId === null || e.userId === userId);
  }

  async onEmpleadoLinkChange(manager: Manager, event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value;
    const empleadoId = value ? Number(value) : null;
    const { error } = await this.adminService.vincularEmpleado(manager.user_id, empleadoId);
    if (error) this.adminService.lastError.set(error.message);
  }

  // ---- Sucursales ----

  /** Usuarios que pueden ser encargados: rol Encargado o Pendiente. */
  encargadoOptions(): Manager[] {
    return this.managers().filter((m) => m.role === 'encargado' || m.role === 'pendiente');
  }

  encargadoNames(branchId: number): string {
    const userIds = this.adminService.branchEncargados().get(branchId) ?? [];
    if (userIds.length === 0) return 'Sin asignar';
    return userIds
      .map((id) => this.managers().find((m) => m.user_id === id)?.name ?? '—')
      .join(', ');
  }

  isEncargadoSelected(userId: string): boolean {
    return this.branchForm.encargadoUserIds.includes(userId);
  }

  hasEncargado(branchId: number): boolean {
    return (this.adminService.branchEncargados().get(branchId)?.length ?? 0) > 0;
  }

  toggleEncargado(userId: string): void {
    const list = this.branchForm.encargadoUserIds;
    const idx = list.indexOf(userId);
    if (idx >= 0) list.splice(idx, 1);
    else list.push(userId);
  }

  openNewBranch(): void {
    this.editingBranch.set(null);
    this.branchForm = { name: '', address: '', is24hs: false, encargadoUserIds: [] };
    this.showBranchModal.set(true);
  }

  openEditBranch(branch: Branch): void {
    this.editingBranch.set(branch);
    this.branchForm = {
      name: branch.name,
      address: branch.address,
      is24hs: branch.is24hs,
      encargadoUserIds: [...(this.adminService.branchEncargados().get(branch.id) ?? [])],
    };
    this.showBranchModal.set(true);
  }

  closeBranchModal(): void {
    this.showBranchModal.set(false);
    this.editingBranch.set(null);
  }

  async saveBranch(): Promise<void> {
    const form = this.branchForm;
    if (!form.name.trim()) {
      this.adminService.lastError.set('El nombre de la sucursal es obligatorio');
      return;
    }

    if (form.encargadoUserIds.length === 0) {
      this.adminService.lastError.set('Asigná al menos un encargado a la sucursal');
      return;
    }

    let branchId: number | undefined = this.editingBranch()?.id;

    if (branchId != null) {
      const { error } = await this.adminService.updateBranch(
        branchId,
        form.name,
        form.address,
        form.is24hs,
      );
      if (error) {
        this.adminService.lastError.set(error.message);
        return;
      }
    } else {
      const { error, id } = await this.adminService.createBranch(
        form.name,
        form.address,
        form.is24hs,
      );
      if (error) {
        this.adminService.lastError.set(error.message);
        return;
      }
      branchId = id;
    }

    if (branchId != null) {
      const { error } = await this.adminService.setBranchEncargados(
        branchId,
        form.encargadoUserIds,
      );
      if (error) {
        this.adminService.lastError.set(error.message);
        return;
      }
    }

    // Un usuario «Pendiente» pudo pasar a «Encargado».
    await this.adminService.loadAllManagers();
    await this.loadAllManagerBranches();
    this.closeBranchModal();
  }

  confirmDeleteBranch(branch: Branch): void {
    this.confirmService.confirmDelete(`la sucursal ${branch.name}`, () =>
      this.deleteBranch(branch),
    );
  }

  async deleteBranch(branch: Branch): Promise<void> {
    const { error } = await this.adminService.deleteBranch(branch.id);
    if (error) {
      this.adminService.lastError.set(error.message);
      return;
    }
    await this.adminService.loadBranchEncargados();
    await this.loadAllManagerBranches();
  }

  async onRoleChange(manager: Manager, event: Event) {
    const select = event.target as HTMLSelectElement;
    const newRole = select.value as UserRole;

    await this.adminService.updateManagerRole(manager.user_id, newRole);
    await this.loadAllManagerBranches();
  }

  toggleBranchAssignment(manager: Manager) {
    if (this.expandedManagerId() === manager.id) {
      this.expandedManagerId.set(null);
    } else {
      this.expandedManagerId.set(manager.id);
    }
  }

  async toggleManagerBranch(manager: Manager, branch: any) {
    const isAssigned = this.isManagerAssignedToBranch(manager, branch.id);

    if (isAssigned) {
      const encargados = this.adminService.branchEncargados().get(branch.id) ?? [];
      if (encargados.length <= 1) {
        this.adminService.lastError.set('Una sucursal debe tener al menos un encargado');
        return;
      }
      await this.adminService.removeBranchFromManager(manager.id, branch.id);
    } else {
      await this.adminService.assignBranchToManager(manager.id, branch.id);
    }

    await this.adminService.loadBranchEncargados();
    await this.loadAllManagerBranches();
  }

  goBack() {
    this.router.navigate(['/branch-select']);
  }
}
