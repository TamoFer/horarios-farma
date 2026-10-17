import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  item: string;
  onConfirm: () => void | Promise<void>;
}

@Injectable({
  providedIn: 'root',
})
export class ConfirmService {
  private readonly _pending = signal<ConfirmRequest | null>(null);
  readonly pending = this._pending.asReadonly();

  confirmDelete(item: string, onConfirm: () => void | Promise<void>): void {
    this._pending.set({ item, onConfirm });
  }

  resolve(confirmed: boolean): void {
    const request = this._pending();
    this._pending.set(null);
    if (confirmed && request) void request.onConfirm();
  }
}
