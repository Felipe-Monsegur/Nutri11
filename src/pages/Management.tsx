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

  const moveCategory = async (index: number, dir: -1 | 1) => {
    const ordered = sortByDisplayOrder(categories);
    const next = index + dir;
    if (next < 0 || next >= ordered.length) return;
    const ids = ordered.map((c) => c.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    setReordering(true);
    try {
      await reorderMealCategories(ids);
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
        'Se van a completar las 5 categorías base (Desayuno, Media mañana, Almuerzo, Merienda, Cena) si faltan. No borra las tuyas.',
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
            Momentos
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('access')}
              className={`ui-label ui-label-md ui-tab inline-flex items-center gap-1.5 ${activeTab === 'access' ? 'ui-tab-active' : ''}`}
              style={{ ['--tab-accent' as string]: headerColor }}
            >
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

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar momento..."
                className="ui-input sm:max-w-xs"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSeedPack}
                  disabled={loadingPack}
                  className="ui-list-item-btn px-3 py-2 text-sm"
                >
                  {loadingPack ? 'Restaurando…' : 'Restaurar pack'}
                </button>
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium"
                  style={{ backgroundColor: headerColor }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nuevo
                </button>
              </div>
            </div>

            <div className="ui-panel p-3 sm:p-4 space-y-2">
              {filtered.length === 0 ? (
                <p className="text-center py-8 text-[var(--text-muted)]">
                  {searchTerm ? 'No se encontraron momentos' : 'No hay categorías'}
                </p>
              ) : (
                filtered.map((cat, index) => (
                  <div
                    key={cat.id}
                    className="ui-list-item flex items-center gap-3 p-3"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <div className="min-w-0 flex-1 font-medium text-[var(--text)]">{cat.name}</div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={reordering || Boolean(searchTerm) || index === 0}
                        onClick={() => void moveCategory(index, -1)}
                        className="ui-list-item-btn px-2 py-1 text-sm disabled:opacity-40"
                        title="Subir"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={reordering || Boolean(searchTerm) || index === filtered.length - 1}
                        onClick={() => void moveCategory(index, 1)}
                        className="ui-list-item-btn px-2 py-1 text-sm disabled:opacity-40"
                        title="Bajar"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(cat)}
                        className="ui-list-item-btn px-2.5 py-1.5 text-sm"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        className="ui-list-item-btn px-2.5 py-1.5 text-sm"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                ))
              )}
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
