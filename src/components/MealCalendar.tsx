import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { MealCategory, MealEntry } from '../types';
import { getTodayDateString, getTodayMonthString } from '../utils/date';
import { compareMealsByDateTime } from '../utils/mealStats';

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const FALLBACK_COLOR = '#6b7280';

type MealCalendarProps = {
  meals: MealEntry[];
  categories: MealCategory[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
  headerColor: string;
};

function toDateKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export default function MealCalendar({
  meals,
  categories,
  selectedDate,
  onSelectDate,
  headerColor,
}: MealCalendarProps) {
  const today = getTodayDateString();
  const [viewMonth, setViewMonth] = useState(() => getTodayMonthString());

  const colorByCategory = useMemo(() => {
    const map = new Map<string, string>();
    for (const cat of categories) map.set(cat.id, cat.color || FALLBACK_COLOR);
    return map;
  }, [categories]);

  const dotsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    const sorted = [...meals].sort(compareMealsByDateTime);
    for (const meal of sorted) {
      const color = colorByCategory.get(meal.categoryId) || FALLBACK_COLOR;
      const list = map.get(meal.date);
      if (list) list.push(color);
      else map.set(meal.date, [color]);
    }
    return map;
  }, [meals, colorByCategory]);

  const monthDate = useMemo(() => parseISO(`${viewMonth}-01`), [viewMonth]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [monthDate]);

  const monthLabel = format(monthDate, 'MMMM yyyy', { locale: es });

  const shiftMonth = (delta: number) => {
    setViewMonth(format(addMonths(monthDate, delta), 'yyyy-MM'));
  };

  return (
    <div className="ui-panel p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="ui-label ui-label-lg capitalize">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-colors"
            aria-label="Mes anterior"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-3)] transition-colors"
            aria-label="Mes siguiente"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] sm:text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide py-1"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = isSameMonth(day, monthDate);
          const dots = dotsByDate.get(key) || [];
          const isToday = key === today;
          const isSelected = key === selectedDate;

          return (
            <button
              key={key}
              type="button"
              disabled={!inMonth}
              onClick={() => onSelectDate(key)}
              className={`relative flex flex-col items-center min-h-[3.25rem] sm:min-h-[3.75rem] rounded-lg px-0.5 pt-1.5 pb-1 transition-colors border ${
                !inMonth
                  ? 'opacity-0 pointer-events-none border-transparent'
                  : isSelected
                    ? 'bg-[var(--surface-3)] border-[var(--border-strong)]'
                    : 'border-[var(--border)] hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)]'
              }`}
              style={
                isSelected && inMonth
                  ? { borderColor: `color-mix(in srgb, ${headerColor} 55%, transparent)` }
                  : undefined
              }
              aria-label={format(day, "d 'de' MMMM", { locale: es })}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSelected}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 text-sm ${
                  isToday
                    ? 'rounded-full text-white font-semibold'
                    : 'text-[var(--text)]'
                }`}
                style={isToday ? { backgroundColor: headerColor } : undefined}
              >
                {format(day, 'd')}
              </span>
              <div className="flex items-center justify-center gap-0.5 mt-0.5 min-h-[0.5rem] flex-wrap max-w-full px-0.5">
                {dots.map((color, i) => (
                  <span
                    key={`${key}-${i}`}
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
