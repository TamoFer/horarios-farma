import { Component, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  template: `
    <router-outlet />
  `,
})
export class App {
  private authService = inject(AuthService);

  constructor() {
    this.authService.initialize();
  }
}
