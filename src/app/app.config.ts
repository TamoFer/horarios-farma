import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideDynamicToast } from 'ngx-dynamic-toast';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideDynamicToast({
      theme: 'system',
      position: 'top-center',
      offset: { top: '16px', left: '50%' }
    })
  ]
};