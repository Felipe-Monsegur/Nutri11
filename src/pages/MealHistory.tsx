import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { deleteMealEntry } from '../services/firebaseService';
import ConfirmModal from '../components/ConfirmModal';
import DateInput from '../components/DateInput';

export default function MealHistory() {
  const { meals, categories, loading, refresh } = useData();
  const { theme, headerColor } = useTheme();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [confirm, setConfirm] = useState<{ id: string; label: string } | null>(null);

  const getCategory = (categoryId: string) => categories.find((c) => c.id === categoryId);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meals.filter((m) => {
      if (categoryFilter && m.categoryId !== categoryFilter) return false;
      if (fromDate && m.date < fromDate) return false;
      if (toDate && m.date > toDate) return false;
      if (!q) return true;
      const catName = getCategory(m.categoryId)?.name || '';
      return (
        m.description.toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q)
      );
    });
  }, [meals, categories, search, categoryFilter, fromDate, toDate]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const meal of filtered) {
      const list = map.get(meal.date) || [];
      list.push(meal);
      map.set(meal.date, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const formatDay = (date: string) => {
    try {
      return format(parseISO(date), "EEEE d 'de' MMMM", { locale: es });
    } catch {
      return date;
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await deleteMealEntry(confirm.id);
      showToast('Comida eliminada', 'success');
      await refresh();
    } catch (err) {
      console.error(err);
      showToast('No se pudo eliminar', 'error');
    } finally {
      setConfirm(null);
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
      <ConfirmModal
        isOpen={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={() => void handleDelete()}
        title="Eliminar comida"
        message={confirm ? `¿Eliminar “${confirm.label}”?` : ''}
        type="danger"
      />

      <div className="flex items-center justify-between">
        <h1 className={`text-xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
          Historial
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

      <div className="ui-panel p-3 sm:p-4 space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por comida o categoría..."
          className="ui-input"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="min-w-0">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="ui-input"
            >
              <option value="">Todos los momentos</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <DateInput
              value={fromDate}
              onChange={setFromDate}
              className="ui-input text-sm"
              allowClear
            />
          </div>
          <div className="min-w-0">
            <DateInput
              value={toDate}
              onChange={setToDate}
              className="ui-input text-sm"
              allowClear
            />
          </div>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="ui-panel p-8 text-center text-[var(--text-muted)]">
          {meals.length === 0 ? 'Todavía no hay comidas anotadas.' : 'No hay resultados con esos filtros.'}
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([date, dayMeals]) => (
            <section key={date} className="space-y-2">
              <h2 className="ui-label ui-label-md capitalize text-[var(--text-muted)]">
                {formatDay(date)}
              </h2>
              <div className="space-y-2">
                {dayMeals.map((meal) => {
                  const cat = getCategory(meal.categoryId);
                  return (
                    <div
                      key={meal.id}
                      className="ui-list-item flex items-start gap-3 p-3"
                    >
                      <span
                        className="mt-1.5 w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat?.color || '#6b7280' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-[var(--text)]">
                            {cat?.name || 'Sin categoría'}
                          </span>
                          {meal.time && (
                            <span className="text-xs text-[var(--text-muted)]">{meal.time}</span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-muted)] mt-0.5">{meal.description}</p>
                        {meal.notes && (
                          <p className="text-xs text-[var(--text-muted)] mt-1 opacity-80">{meal.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Link
                          to={`/comidas/${meal.id}`}
                          className="ui-list-item-btn px-2.5 py-1.5 text-sm"
                          title="Editar"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          className="ui-list-item-btn px-2.5 py-1.5 text-sm"
                          title="Eliminar"
                          onClick={() =>
                            setConfirm({
                              id: meal.id,
                              label: meal.description.slice(0, 40),
                            })
                          }
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
