import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold text-gray-800">Horarios Farmacia</h1>
          <p class="text-gray-500 mt-2">Inicia sesión para continuar</p>
        </div>

        @if (isSignUp()) {
          <form (ngSubmit)="handleSignUp()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
              <input
                type="text"
                [(ngModel)]="name"
                name="name"
                required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Tu nombre"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                required
                minlength="6"
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="••••••••"
              />
            </div>

            @if (error()) {
              <div class="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {{ error() }}
              </div>
            }

            <button
              type="submit"
              [disabled]="loading()"
              class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {{ loading() ? 'Creando cuenta...' : 'Crear Cuenta' }}
            </button>

            <p class="text-center text-sm text-gray-500">
              ¿Ya tienes cuenta?
              <button type="button" (click)="isSignUp.set(false)" class="text-blue-600 hover:underline">
                Inicia sesión
              </button>
            </p>
          </form>
        } @else {
          <form (ngSubmit)="handleSignIn()" class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                required
                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="••••••••"
              />
            </div>

            @if (error()) {
              <div class="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {{ error() }}
              </div>
            }

            <button
              type="submit"
              [disabled]="loading()"
              class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {{ loading() ? 'Iniciando sesión...' : 'Iniciar Sesión' }}
            </button>

            <p class="text-center text-sm text-gray-500">
              ¿No tienes cuenta?
              <button type="button" (click)="isSignUp.set(true)" class="text-blue-600 hover:underline">
                Regístrate
              </button>
            </p>
          </form>
        }
      </div>
    </div>
  `
})
export class LoginComponent {
  email = '';
  password = '';
  name = '';

  loading = signal(false);
  error = signal('');
  isSignUp = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async handleSignIn() {
    this.loading.set(true);
    this.error.set('');

    const { error } = await this.authService.signIn(this.email, this.password);

    if (error) {
      this.error.set(error.message || 'Error al iniciar sesión');
    } else {
      this.router.navigate(['/branch-select']);
    }

    this.loading.set(false);
  }

  async handleSignUp() {
    this.loading.set(true);
    this.error.set('');

    const { error } = await this.authService.signUp(this.email, this.password, this.name);

    if (error) {
      this.error.set(error.message || 'Error al crear cuenta');
    } else {
      this.error.set('Cuenta creada. Revisa tu email para confirmar tu cuenta.');
    }

    this.loading.set(false);
  }
}