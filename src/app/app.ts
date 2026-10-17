import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';
import { DynamicToastViewportComponent } from 'ngx-dynamic-toast';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, DynamicToastViewportComponent, ConfirmDialogComponent],
  template: `
    <router-outlet />
    <dt-viewport theme="system" position="top-center"></dt-viewport>
    <app-confirm-dialog />
  `,
})
export class App {
  private authService = inject(AuthService);

  constructor() {
    this.authService.initialize();
  }
}
