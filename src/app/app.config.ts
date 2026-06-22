import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideToast } from 'ngx-dynamic-toast';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideToast({
      position: 'top-right',
      duration: 4000,
      closeable: true,
      theme: 'bootstrap'
    })
  ]
};