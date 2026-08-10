import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import {
  addMealCategory,
  updateMealCategory,
  deleteMealCategory,
  reorderMealCategories,
  ensureInitialPack,
  saveUserSettings,
  INITIAL_PACK_VERSION,
  listAccessRequests,
  approveAccessRequest,
  denyAccessRequest,
  getAllowedUsers,
  removeAllowedUser,
} from '../services/firebaseService';
import { sortByDisplayOrder } from '../utils/displayOrder';
import { MealCategory, AccessRequest, AllowedUser } from '../types';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

const DEFAULT_COLOR = '#3b82f6';

type TabType = 'categories' | 'access';

export default function Management() {
  const { categories, meals, refresh } = useData();
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();
  const { theme, headerColor } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('categories');
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [allowedUsersList, setAllowedUsersList] = useState<AllowedUser[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<MealCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ name: '', color: DEFAULT_COLOR });
  const [reordering, setReordering] = useState(false);
  const [loadingPack, setLoadingPack] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const loadAccessData = useCallback(async () => {
    if (!isAdmin) return;
    setAccessLoading(true);
    try {
      const [reqs, allowed] = await Promise.all([listAccessRequests(), getAllowedUsers()]);
      setAccessRequests(reqs);
      setAllowedUsersList(allowed);
    } catch (error) {
      console.error(error);
      showToast('No se pudieron cargar los pedidos de acceso', 'error');
    } finally {
      setAccessLoading(false);
    }
  }, [isAdmin, showToast]);

  useEffect(() => {
    if (activeTab === 'access' && isAdmin) {
      void loadAccessData();
    }
  }, [activeTab, isAdmin, loadAccessData]);

  useEffect(() => {
    if (!isAdmin && activeTab === 'access') {
      setActiveTab('categories');
    }
  }, [isAdmin, activeTab]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = sortByDisplayOrder(categories);
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, searchTerm]);

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: '', color: DEFAULT_COLOR });
    setShowForm(true);
  };

  const openEdit = (cat: MealCategory) => {
    setEditing(cat);
    setFormData({ name: cat.name, color: cat.color || DEFAULT_COLOR });
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !formData.name.trim()) return;
    try {
      if (editing) {
        await updateMealCategory(editing.id, {
          name: formData.name.trim(),
          color: formData.color,
        });
        showToast('Categoría actualizada', 'success');
      } else {
        await addMealCategory({
          name: formData.name.trim(),
          color: formData.color,
          userId: user.uid,
          sortOrder: categories.length,
        });
        showToast('Categoría creada', 'success');
      }
      setShowForm(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      console.error(err);
      showToast('No se pudo guardar', 'error');
    }
  };

  const handleDelete = (cat: MealCategory) => {
    const used = meals.some((m) => m.categoryId === cat.id);
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar categoría',
      message: used
        ? `“${cat.name}” tiene comidas asociadas. Si la borrás, esas comidas quedarán sin categoría visible. ¿Continuar?`
        : `¿Eliminar “${cat.name}”?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await deleteMealCategory(cat.id);
          showToast('Categoría eliminada', 'success');
          await refresh();
        } catch (err) {
          console.error(err);
          showToast('No se pudo eliminar', 'error');
        } finally {
          setConfirmModal((c) => ({ ...c, isOpen: false }));
        }
      },
    });
  };

  const moveCategory = async (id: string, direction: 'up' | 'down') => {
    if (reordering || searchTerm.trim()) return;
    const ordered = sortByDisplayOrder(categories);
    const index = ordered.findIndex((c) => c.id === id);
    if (index < 0) return;
    const next = direction === 'up' ? index - 1 : index + 1;
    if (next < 0 || next >= ordered.length) return;
    const swapped = [...ordered];
    [swapped[index], swapped[next]] = [swapped[next], swapped[index]];
    setReordering(true);
    try {
      await reorderMealCategories(swapped.map((c) => c.id));
      await refresh();
    } catch (err) {
      console.error(err);
      showToast('No se pudo reordenar', 'error');
    } finally {
      setReordering(false);
    }
  };

  const handleSeedPack = () => {
    if (!user) return;
    setConfirmModal({
      isOpen: true,
      title: 'Restaurar pack inicial',
      message:
        'Se van a completar las 6 categorías base (Desayuno, Media mañana, Almuerzo, Merienda, Cena, Snack) si faltan. No borra las tuyas.',
      type: 'info',
      onConfirm: async () => {
        if (!user) return;
        setLoadingPack(true);
        try {
          const result = await ensureInitialPack(user.uid);
          await saveUserSettings(user.uid, { initialPackVersion: INITIAL_PACK_VERSION });
          await refresh();
          showToast(
            result.categoriesAdded > 0
              ? `Pack listo: +${result.categoriesAdded} categorías`
              : 'El pack ya estaba completo',
            'success'
          );
        } catch (err) {
          console.error(err);
          showToast('No se pudo restaurar el pack', 'error');
        } finally {
          setLoadingPack(false);
          setConfirmModal((c) => ({ ...c, isOpen: false }));
        }
      },
    });
  };

  const handleApproveRequest = async (req: AccessRequest) => {
    try {
      await approveAccessRequest(req);
      showToast('Acceso aprobado', 'success');
      await loadAccessData();
    } catch (err) {
      console.error(err);
      showToast('No se pudo aprobar', 'error');
    }
  };

  const handleDenyRequest = async (req: AccessRequest) => {
    try {
      await denyAccessRequest(req.id);
      showToast('Pedido rechazado', 'success');
      await loadAccessData();
    } catch (err) {
      console.error(err);
      showToast('No se pudo rechazar', 'error');
    }
  };

  const handleRevokeUser = (allowed: AllowedUser) => {
    setConfirmModal({
      isOpen: true,
      title: 'Revocar acceso',
      message: `¿Revocar acceso a ${allowed.email}?`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await removeAllowedUser(allowed.userId || allowed.id);
          showToast('Acceso revocado', 'success');
          await loadAccessData();
        } catch (err) {
          console.error(err);
          showToast('No se pudo revocar', 'error');
        } finally {
          setConfirmModal((c) => ({ ...c, isOpen: false }));
        }
      },
    });
  };

  return (
    <>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal((c) => ({ ...c, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type || 'danger'}
      />

      <div className="space-y-4 sm:space-y-6">
        <h1 className={`text-xl sm:text-3xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
          Gestión
        </h1>

        <div className="ui-tabs">
          <button
            onClick={() => setActiveTab('categories')}
            className={`ui-label ui-label-md ui-tab inline-flex items-center gap-1.5 ${activeTab === 'categories' ? 'ui-tab-active' : ''}`}
            style={{ ['--tab-accent' as string]: headerColor }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Momentos
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('access')}
              className={`ui-label ui-label-md ui-tab inline-flex items-center gap-1.5 ${activeTab === 'access' ? 'ui-tab-active' : ''}`}
              style={{ ['--tab-accent' as string]: headerColor }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24" aria-hidden>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path strokeLinecap="round" d="M8 11V8a4 4 0 018 0v3" />
              </svg>
              Acceso
            </button>
          )}
        </div>

        {activeTab === 'categories' && (
          <>
            <Modal
              isOpen={showForm}
              onClose={() => {
                setShowForm(false);
                setEditing(null);
              }}
              title={editing ? 'Editar momento' : 'Nuevo momento'}
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-group">
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Desayuno, Snack..."
                    className="ui-input"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Color</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value.toUpperCase() })
                      }
                      className="w-16 h-12 rounded border-2 border-gray-600 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => {
                        const hex = e.target.value.replace(/[^0-9A-Fa-f#]/g, '').toUpperCase();
                        setFormData({
                          ...formData,
                          color: hex.startsWith('#') ? hex : `#${hex}`,
                        });
                      }}
                      placeholder="#3b82f6"
                      className="ui-input flex-1 font-mono"
                      maxLength={7}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="ui-btn-submit flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700"
                  >
                    Guardar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditing(null);
                    }}
                    className="px-4 py-2.5 rounded-lg border border-[var(--border-strong)] text-[var(--text)]"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </Modal>

            <div className="ui-panel p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3 sm:mb-4">
                <h2 className="ui-label ui-label-lg">Momentos</h2>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleSeedPack}
                    disabled={loadingPack}
                    className={`px-3 h-10 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                      theme === 'dark'
                        ? 'bg-white/10 text-[var(--text)] hover:bg-white/15'
                        : 'bg-black/5 text-[var(--text)] hover:bg-black/10'
                    }`}
                    title="Completa las categorías del pack que falten"
                  >
                    {loadingPack ? 'Cargando…' : 'Restaurar pack'}
                  </button>
                  <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    title="Nuevo momento"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar momento..."
                  className="ui-input text-sm"
                />
                {!searchTerm.trim() && filtered.length > 1 && (
                  <p className="text-xs mt-2 text-[var(--text-muted)]">
                    ↑ ↓ define el orden en formularios y listas.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                {filtered.map((cat, idx) => (
                  <div key={cat.id} className="ui-list-item flex items-center justify-between p-3">
                    {!searchTerm.trim() && filtered.length > 1 && (
                      <div className="flex flex-col gap-0.5 mr-2 pr-2 border-r shrink-0 border-[var(--border-strong)]">
                        <button
                          type="button"
                          disabled={reordering || idx === 0}
                          onClick={() => void moveCategory(cat.id, 'up')}
                          className="ui-list-item-btn px-1.5 py-0.5 text-sm leading-none disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={reordering || idx === filtered.length - 1}
                          onClick={() => void moveCategory(cat.id, 'down')}
                          className="ui-list-item-btn px-1.5 py-0.5 text-sm leading-none disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-4 h-4 rounded flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-base text-[var(--text)] truncate">{cat.name}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(cat)}
                        className={`p-2 rounded transition-colors ${
                          theme === 'dark'
                            ? 'text-blue-400 hover:bg-blue-500/20'
                            : 'text-blue-600 hover:bg-blue-100'
                        }`}
                        title="Editar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        className={`p-2 rounded transition-colors ${
                          theme === 'dark'
                            ? 'text-red-400 hover:bg-red-500/20'
                            : 'text-red-600 hover:bg-red-100'
                        }`}
                        title="Eliminar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center py-8 text-[var(--text-muted)]">
                    {searchTerm ? 'No se encontraron momentos' : 'No hay categorías'}
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {isAdmin && activeTab === 'access' && (
          <div className="ui-panel p-3 sm:p-6 space-y-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="ui-label ui-label-lg">Pedidos de acceso</h2>
              <button
                type="button"
                onClick={() => void loadAccessData()}
                disabled={accessLoading}
                className="ui-list-item-btn px-3 py-1.5 text-sm"
              >
                {accessLoading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>

            {accessLoading && accessRequests.length === 0 ? (
              <p className="text-[var(--text-muted)]">Cargando...</p>
            ) : (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[var(--text-muted)]">Pendientes</h3>
                  {accessRequests.filter((r) => r.status === 'pending').length === 0 && (
                    <p className="text-sm text-[var(--text-muted)]">No hay pedidos pendientes.</p>
                  )}
                  {accessRequests
                    .filter((r) => r.status === 'pending')
                    .map((req) => (
                      <div
                        key={req.id}
                        className="ui-list-item flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {req.photoURL ? (
                            <img src={req.photoURL} alt="" className="w-9 h-9 rounded-full" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gray-500 flex items-center justify-center text-white text-sm">
                              {(req.displayName || req.email || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate text-[var(--text)]">
                              {req.displayName || 'Sin nombre'}
                            </div>
                            <div className="text-sm truncate text-[var(--text-muted)]">{req.email}</div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleApproveRequest(req)}
                            className="px-3 py-1.5 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700"
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDenyRequest(req)}
                            className="px-3 py-1.5 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700"
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[var(--text-muted)]">Usuarios con acceso</h3>
                  {allowedUsersList.length === 0 && (
                    <p className="text-sm text-[var(--text-muted)]">No hay usuarios en la lista.</p>
                  )}
                  {allowedUsersList.map((allowed) => (
                    <div
                      key={allowed.userId || allowed.id}
                      className="ui-list-item flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate text-[var(--text)]">
                          {allowed.email}
                          {allowed.isAdmin && (
                            <span className="ml-2 text-xs font-semibold text-amber-500">admin</span>
                          )}
                        </div>
                      </div>
                      {!allowed.isAdmin && allowed.id !== user?.uid && (
                        <button
                          type="button"
                          onClick={() => handleRevokeUser(allowed)}
                          className="ui-list-item-btn px-3 py-1.5 text-sm"
                        >
                          Revocar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
