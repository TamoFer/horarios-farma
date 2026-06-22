import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { Toast, ToastModule } from 'ngx-dynamic-toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ToastModule],
  template: `
    <router-outlet />
    <Toast [toast]="toast" />
  `,
})
export class App {
  private authService = inject(AuthService);
  toast = new Toast();

  constructor() {
    this.authService.initialize();
  }
}
