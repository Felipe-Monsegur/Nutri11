import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { addMealEntry, updateMealEntry } from '../services/firebaseService';
import { getTodayDateString } from '../utils/date';
import DateInput from '../components/DateInput';

export default function MealForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { categories, meals, refresh, loading: dataLoading } = useData();
  const { theme, headerColor } = useTheme();
  const { showToast } = useToast();

  const [date, setDate] = useState(getTodayDateString());
  const [time, setTime] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit || dataLoading) return;
    const meal = meals.find((m) => m.id === id);
    if (!meal) {
      showToast('No se encontró esa comida', 'error');
      navigate('/comidas');
      return;
    }
    setDate(meal.date);
    setTime(meal.time || '');
    setCategoryId(meal.categoryId);
    setDescription(meal.description);
    setNotes(meal.notes || '');
    setReady(true);
  }, [id, isEdit, meals, dataLoading, navigate, showToast]);

  useEffect(() => {
    if (!isEdit && !categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId, isEdit]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!categoryId) {
      showToast('Elegí un momento del día', 'error');
      return;
    }
    if (!description.trim()) {
      showToast('Anotá qué comiste', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date,
        time: time.trim() || undefined,
        categoryId,
        description: description.trim(),
        notes: notes.trim() || undefined,
        userId: user.uid,
      };
      if (isEdit && id) {
        await updateMealEntry(id, payload);
        showToast('Comida actualizada', 'success');
      } else {
        await addMealEntry(payload);
        showToast('Comida anotada', 'success');
      }
      await refresh();
      navigate('/comidas');
    } catch (err) {
      console.error(err);
      showToast('No se pudo guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (dataLoading || !ready) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg text-[var(--text-muted)] animate-pulse">Cargando...</div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="ui-panel p-6 text-center space-y-4">
        <p className="text-[var(--text-muted)]">
          No hay categorías. Cargá el pack inicial desde Gestión.
        </p>
        <Link
          to="/gestion"
          className="inline-flex px-4 py-2 rounded-lg text-white font-medium"
          style={{ backgroundColor: headerColor }}
        >
          Ir a Gestión
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className={`text-xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
          {isEdit ? 'Editar comida' : 'Anotar comida'}
        </h1>
        <Link to="/comidas" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
          Cancelar
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        <div className="ui-panel p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="form-group">
            <label>Momento</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const active = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      active
                        ? 'text-white border-transparent'
                        : 'text-[var(--text)] border-[var(--border-strong)] bg-[var(--surface-2)]'
                    }`}
                    style={active ? { backgroundColor: cat.color } : undefined}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: active ? '#fff' : cat.color }}
                    />
                    {cat.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="meal-description">Qué comiste</label>
            <textarea
              id="meal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="ui-input min-h-[160px] sm:min-h-[200px] w-full"
              placeholder="Ej: café con leche, tostadas con palta..."
              required
              autoFocus={!isEdit}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="form-group">
              <label>Fecha</label>
              <DateInput value={date} onChange={setDate} required />
            </div>
            <div className="form-group">
              <label htmlFor="meal-time">Hora (opcional)</label>
              <input
                id="meal-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="ui-input w-full"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="meal-notes">Notas (opcional)</label>
            <input
              id="meal-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="ui-input w-full"
              placeholder="Algo más para recordar..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="ui-btn-submit w-full text-white py-3 sm:py-3.5 disabled:opacity-50"
          style={{ backgroundColor: headerColor }}
        >
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Anotar'}
        </button>
      </form>
    </div>
  );
}
