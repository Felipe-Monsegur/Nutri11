import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { daysSinceLastMeal, todayMeals, weekMeals } from '../utils/mealStats';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const { meals, categories, loading } = useData();
  const { theme, headerColor } = useTheme();

  const thisWeek = useMemo(() => weekMeals(meals), [meals]);
  const today = useMemo(() => todayMeals(meals), [meals]);
  const daysSince = useMemo(() => daysSinceLastMeal(meals), [meals]);
  const last5 = useMemo(() => meals.slice(0, 5), [meals]);

  const getCategory = (categoryId: string) => categories.find((c) => c.id === categoryId);

  const formatDateLabel = (date: string) => {
    try {
      return format(parseISO(date), "EEE d MMM", { locale: es });
    } catch {
      return date;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg text-[var(--text-muted)] animate-pulse">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <h1 className={`text-xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
          Dashboard
        </h1>
        <Link
          to="/comidas/nueva"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: headerColor }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Anotar</span>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="ui-panel p-4">
          <div className="text-xs sm:text-sm text-[var(--text-muted)] mb-1">Hoy</div>
          <div className="text-2xl sm:text-3xl font-bold text-[var(--text)]">{today.length}</div>
          <div className="text-xs text-[var(--text-muted)]">
            {today.length === 1 ? 'comida' : 'comidas'}
          </div>
        </div>

        <div className="ui-panel p-4">
          <div className="text-xs sm:text-sm text-[var(--text-muted)] mb-1">Esta semana</div>
          <div className="text-2xl sm:text-3xl font-bold text-[var(--text)]">{thisWeek.length}</div>
          <div className="text-xs text-[var(--text-muted)]">registros</div>
        </div>

        <div className="ui-panel p-4">
          <div className="text-xs sm:text-sm text-[var(--text-muted)] mb-1">Último</div>
          <div className="text-2xl sm:text-3xl font-bold text-[var(--text)]">
            {daysSince === null ? '—' : daysSince === 0 ? 'Hoy' : daysSince}
          </div>
          <div className="text-xs text-[var(--text-muted)]">
            {daysSince === null
              ? 'sin registros'
              : daysSince === 0
                ? 'anotaste'
                : daysSince === 1
                  ? 'día atrás'
                  : 'días atrás'}
          </div>
        </div>

        <div className="ui-panel p-4">
          <div className="text-xs sm:text-sm text-[var(--text-muted)] mb-1">Total</div>
          <div className="text-2xl sm:text-3xl font-bold text-[var(--text)]">{meals.length}</div>
          <div className="text-xs text-[var(--text-muted)]">comidas</div>
        </div>
      </div>

      <div className="ui-panel p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="ui-label ui-label-lg">Hoy</h2>
        </div>

        {today.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-[var(--text-muted)] mb-4">Todavía no anotaste nada hoy</div>
            <Link
              to="/comidas/nueva"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: headerColor }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Anotar comida
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {today.map((meal) => {
              const cat = getCategory(meal.categoryId);
              return (
                <Link
                  key={meal.id}
                  to={`/comidas/${meal.id}`}
                  className="ui-list-item flex items-start gap-3 p-3 block hover:opacity-95 transition-opacity"
                >
                  <span
                    className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat?.color || '#6b7280' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text)]">
                        {cat?.name || 'Sin categoría'}
                      </span>
                      {meal.time && (
                        <span className="text-xs text-[var(--text-muted)]">{meal.time}</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5 line-clamp-2">
                      {meal.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="ui-panel p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="ui-label ui-label-lg">Últimas comidas</h2>
          {meals.length > 5 && (
            <Link
              to="/comidas"
              className="text-sm font-medium transition-colors hover:opacity-80"
              style={{ color: headerColor }}
            >
              Ver todas
            </Link>
          )}
        </div>

        {last5.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-[var(--text-muted)] mb-4">No tenés comidas registradas</div>
            {categories.length === 0 ? (
              <Link
                to="/gestion"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium"
                style={{ backgroundColor: headerColor }}
              >
                Ir a Gestión
              </Link>
            ) : (
              <Link
                to="/comidas/nueva"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: headerColor }}
              >
                Registrar primera comida
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {last5.map((meal) => {
              const cat = getCategory(meal.categoryId);
              return (
                <Link
                  key={meal.id}
                  to={`/comidas/${meal.id}`}
                  className="ui-list-item flex items-start gap-3 p-3 block hover:opacity-95 transition-opacity"
                >
                  <span
                    className="mt-1 w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat?.color || '#6b7280' }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text)]">
                        {cat?.name || 'Sin categoría'}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] capitalize">
                        {formatDateLabel(meal.date)}
                      </span>
                      {meal.time && (
                        <span className="text-xs text-[var(--text-muted)]">{meal.time}</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)] mt-0.5 line-clamp-2">
                      {meal.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
