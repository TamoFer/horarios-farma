import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { DynamicToastViewportComponent } from 'ngx-dynamic-toast';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, DynamicToastViewportComponent],
  template: `
    <router-outlet />
    <dt-viewport theme="system" position="top-right" [offset]="{ top: '16px', right: '16px' }"></dt-viewport>
  `,
})
export class App {
  private authService = inject(AuthService);

  constructor() {
    this.authService.initialize();
  }
}
