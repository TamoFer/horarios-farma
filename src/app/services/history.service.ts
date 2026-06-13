import { Injectable, signal } from '@angular/core';
import { ScheduleHistory, PlacedEmployeeData } from '../models/employee.model';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private readonly STORAGE_KEY = 'schedule_history';
  private readonly MAX_HISTORY = 15;

  history = signal<ScheduleHistory[]>([]);

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.history.set(parsed.map((h: any) => ({
          ...h,
          createdAt: new Date(h.createdAt)
        })));
      }
    } catch (error) {
      console.error('Error loading history:', error);
      this.history.set([]);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.history()));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  }

  addEntry(date: string, placedEmployees: PlacedEmployeeData[]): void {
    const newEntry: ScheduleHistory = {
      id: Date.now().toString(),
      date,
      placedEmployees,
      createdAt: new Date()
    };

    this.history.update(list => {
      const filtered = list.filter(h => h.date !== date);
      const updated = [newEntry, ...filtered].slice(0, this.MAX_HISTORY);
      return updated;
    });

    this.saveToStorage();
  }

  getByDate(date: string): ScheduleHistory | undefined {
    return this.history().find(h => h.date === date);
  }

  deleteEntry(id: string): void {
    this.history.update(list => list.filter(h => h.id !== id));
    this.saveToStorage();
  }

  clearHistory(): void {
    this.history.set([]);
    localStorage.removeItem(this.STORAGE_KEY);
  }
}