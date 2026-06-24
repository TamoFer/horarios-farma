import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, Manager } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';

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
            </div>
            <button
              (click)="goBack()"
              class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              ← Volver
            </button>
          </div>

          @if (loading()) {
            <div class="text-center py-8">
              <p class="text-gray-500">Cargando...</p>
            </div>
          } @else {
            <div class="space-y-4">
              @for (manager of managers(); track manager.id) {
                <div class="border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-4">
                      <div class="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span class="text-indigo-600 font-bold text-lg">
                          {{ manager.name.charAt(0).toUpperCase() }}
                        </span>
                      </div>
                      <div>
                        <p class="font-semibold text-gray-900">{{ manager.name }}</p>
                        <p class="text-sm text-gray-500">{{ manager.email }}</p>
                      </div>
                    </div>

                    <div class="flex items-center gap-3">
                      <select
                        [value]="manager.role"
                        (change)="onRoleChange(manager, $event)"
                        class="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>

                      <button
                        (click)="toggleBranchAssignment(manager)"
                        class="px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                      >
                        Sucursales
                      </button>
                    </div>
                  </div>

                  @if (expandedManagerId() === manager.id) {
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
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class AdminManagersComponent implements OnInit {
  private authService = inject(AuthService);
  private adminService = inject(AdminService);
  private router = inject(Router);

  managers = this.adminService.managers;
  allBranches = this.adminService.branches;
  loading = signal(true);
  expandedManagerId = signal<number | null>(null);
  private managerBranchMap = signal<Map<number, number[]>>(new Map());

  async ngOnInit() {
    if (this.authService.manager()?.role !== 'admin') {
      this.router.navigate(['/dashboard']);
      return;
    }

    await this.adminService.loadAllManagers();
    await this.adminService.loadAllBranches();
    await this.loadAllManagerBranches();
    this.loading.set(false);
  }

  private async loadAllManagerBranches() {
    const allManagers = this.managers();
    const map = new Map<number, number[]>();

    for (const manager of allManagers) {
      const branches = await this.adminService.getManagerBranches(manager.id);
      map.set(manager.id, branches.map(b => b.id));
    }

    this.managerBranchMap.set(map);
  }

  isManagerAssignedToBranch(manager: Manager, branchId: number): boolean {
    return this.managerBranchMap().get(manager.id)?.includes(branchId) || false;
  }

  async onRoleChange(manager: Manager, event: Event) {
    const select = event.target as HTMLSelectElement;
    const newRole = select.value as 'admin' | 'manager';

    await this.adminService.updateManagerRole(manager.id, newRole);
    await this.adminService.loadAllManagers();
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
      await this.adminService.removeBranchFromManager(manager.id, branch.id);
    } else {
      await this.adminService.assignBranchToManager(manager.id, branch.id);
    }

    await this.loadAllManagerBranches();
  }

  goBack() {
    this.router.navigate(['/branch-select']);
  }
}
