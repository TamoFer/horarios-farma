import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'branch-select',
    loadComponent: () => import('./components/branch-select/branch-select.component').then(m => m.BranchSelectComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./app').then(m => m.App)
  },
  {
    path: 'admin/managers',
    loadComponent: () => import('./components/admin-managers/admin-managers.component').then(m => m.AdminManagersComponent)
  },
  { path: '**', redirectTo: '/login' }
];