import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService, Branch } from '../../services/auth.service';

@Component({
  selector: 'app-branch-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-gray-800">Selecciona una Sucursal</h1>
          <p class="text-gray-500 mt-2">Elige la farmacia donde trabajarás hoy</p>
        </div>

        <div class="space-y-4">
          @for (branch of authService.managerBranches(); track branch.id) {
            <button
              (click)="selectBranch(branch)"
              class="w-full p-6 bg-gray-50 hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-500 rounded-xl transition-all duration-200 text-left group"
            >
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-xl font-semibold text-gray-800 group-hover:text-blue-700">
                    {{ branch.name }}
                  </h3>
                  @if (branch.address) {
                    <p class="text-gray-500 text-sm mt-1">{{ branch.address }}</p>
                  }
                </div>
                <svg class="w-6 h-6 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          }
        </div>

        @if (authService.managerBranches().length === 0) {
          <div class="text-center py-8">
            <p class="text-gray-500">No tienes sucursales asignadas.</p>
            <p class="text-gray-400 text-sm mt-2">Contacta al administrador del sistema.</p>
          </div>
        }

        @if (authService.isAdmin()) {
          <div class="mt-4">
            <button
              (click)="goToAdminPanel()"
              class="w-full p-4 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 rounded-xl transition-all duration-200 text-left"
            >
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="text-lg font-semibold text-indigo-700">Panel de Administración</h3>
                  <p class="text-indigo-500 text-sm mt-1">Gestionar usuarios y roles</p>
                </div>
                <svg class="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </button>
          </div>
        }

        <div class="mt-8 pt-6 border-t border-gray-200">
          <button
            (click)="signOut()"
            class="w-full text-gray-500 hover:text-gray-700 py-2 transition"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  `
})
export class BranchSelectComponent {
  constructor(
    public authService: AuthService,
    private router: Router
  ) {
    effect(() => {
      if (!authService.isAuthenticated()) {
        this.router.navigate(['/login']);
      }
    });
  }

  selectBranch(branch: Branch): void {
    this.authService.selectBranch(branch);
    this.router.navigate(['/dashboard']);
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
    this.router.navigate(['/login']);
  }

  goToAdminPanel(): void {
    this.router.navigate(['/admin/managers']);
  }
}