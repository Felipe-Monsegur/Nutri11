import { MealEntry } from '../types';
import { getTodayDateString } from './date';

/** Lunes de la semana actual (YYYY-MM-DD) en zona Argentina. */
export function getWeekStartDateString(): string {
  const today = getTodayDateString();
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0 = domingo
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function weekMeals(meals: MealEntry[]): MealEntry[] {
  const start = getWeekStartDateString();
  const today = getTodayDateString();
  return meals.filter((m) => m.date >= start && m.date <= today);
}

export function todayMeals(meals: MealEntry[]): MealEntry[] {
  const today = getTodayDateString();
  return meals.filter((m) => m.date === today);
}

export function daysSinceLastMeal(meals: MealEntry[]): number | null {
  if (meals.length === 0) return null;
  const last = meals[0]?.date;
  if (!last) return null;
  const today = getTodayDateString();
  const [ty, tm, td] = today.split('-').map(Number);
  const [ly, lm, ld] = last.split('-').map(Number);
  const t = Date.UTC(ty, tm - 1, td);
  const l = Date.UTC(ly, lm - 1, ld);
  return Math.round((t - l) / (24 * 60 * 60 * 1000));
}

/** Ordena por fecha desc, luego hora (sin hora al final del día). */
export function compareMealsByDateTime(a: MealEntry, b: MealEntry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const at = a.time || '99:99';
  const bt = b.time || '99:99';
  if (at !== bt) return at < bt ? -1 : 1;
  return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
}
