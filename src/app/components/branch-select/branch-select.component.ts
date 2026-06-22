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
      <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl">
        <div class="text-center mb-8">
          <h1 class="text-2xl font-bold text-gray-800">Selecciona una Sucursal</h1>
          <p class="text-gray-500 mt-2">Elige la farmacia donde trabajarás hoy</p>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-3 gap-6 justify-items-center">
          @for (branch of authService.managerBranches(); track branch.id) {
            <button
              (click)="selectBranch(branch)"
              class="flex flex-col items-center justify-center p-6 bg-gray-50 hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-500 rounded-xl transition-all duration-200 w-full aspect-square group"
            >
              <img 
                src="https://images.icon-icons.com/973/PNG/512/Pharmacy_icon-icons.com_74919.png" 
                alt="Farmacia" 
                class="w-16 h-16 mb-2 object-contain"
              >
              <span class="text-lg font-semibold text-gray-800 group-hover:text-blue-700 text-center">{{ branch.name }}</span>
            </button>
          }

          @if (authService.isAdmin()) {
            <button
              (click)="goToAdminPanel()"
              class="flex flex-col items-center justify-center p-6 bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-200 hover:border-indigo-500 rounded-xl transition-all duration-200 w-full aspect-square"
            >
              <img 
                src="https://images.icon-icons.com/2853/PNG/512/settings_setting_options_icon_181547.png" 
                alt="Administración" 
                class="w-16 h-16 mb-2 object-contain"
              >
              <span class="text-lg font-semibold text-indigo-700 text-center">Administración</span>
            </button>
          }
        </div>

        @if (authService.managerBranches().length === 0 && !authService.isAdmin()) {
          <div class="text-center py-8">
            <p class="text-gray-500">No tienes sucursales asignadas.</p>
            <p class="text-gray-400 text-sm mt-2">Contacta al administrador del sistema.</p>
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