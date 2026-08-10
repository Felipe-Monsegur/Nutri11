import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  setDoc,
  Timestamp,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { compareByDisplayOrder } from '../utils/displayOrder';
import { compareMealsByDateTime } from '../utils/mealStats';
import { db } from '../config/firebase';
import { User } from 'firebase/auth';
import { MealCategory, MealEntry, AccessRequest, AccessRequestStatus, AllowedUser } from '../types';
import { INITIAL_MEAL_CATEGORIES, INITIAL_PACK_VERSION } from '../data/initialPack';

export { INITIAL_PACK_VERSION };

const normalizePackName = (name: string) => name.trim().toLowerCase();

const packCategoryDocId = (userId: string, key: string) => `${userId}__cat__${key}`;

export type EnsureInitialPackResult = {
  categoriesAdded: number;
  categoriesRemoved: number;
};

const ensurePackInflight = new Map<string, Promise<EnsureInitialPackResult>>();

const commitBatches = async (ops: Array<(batch: ReturnType<typeof writeBatch>) => void>) => {
  const CHUNK = 400;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + CHUNK)) op(batch);
    await batch.commit();
  }
};

const mapAllowedUser = (id: string, data: Record<string, unknown>): AllowedUser => ({
  id,
  email: String(data.email || ''),
  userId: data.userId ? String(data.userId) : undefined,
  isAdmin: Boolean(data.isAdmin),
  addedAt: data.addedAt && typeof (data.addedAt as { toDate?: () => Date }).toDate === 'function'
    ? (data.addedAt as { toDate: () => Date }).toDate().toISOString()
    : undefined,
});

export const allowedUserEmailDocId = (email: string) => email.toLowerCase().trim();

const buildAllowedUserPayload = (
  email: string,
  userId: string,
  options?: { isAdmin?: boolean }
) => ({
  email: allowedUserEmailDocId(email),
  userId,
  addedAt: Timestamp.now(),
  ...(options?.isAdmin ? { isAdmin: true } : {}),
});

// ============ USUARIOS PERMITIDOS (LISTA BLANCA) ============
export const getAllowedUserRecord = async (
  userId: string,
  email: string
): Promise<AllowedUser | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'allowedUsers', userId));
    if (userDoc.exists()) {
      return mapAllowedUser(userDoc.id, userDoc.data() as Record<string, unknown>);
    }

    const emailLower = allowedUserEmailDocId(email || '');
    if (!emailLower) return null;

    const emailDoc = await getDoc(doc(db, 'allowedUsers', emailLower));
    if (emailDoc.exists()) {
      return mapAllowedUser(emailDoc.id, emailDoc.data() as Record<string, unknown>);
    }

    const emailQuery = query(collection(db, 'allowedUsers'), where('email', '==', emailLower));
    const emailSnapshot = await getDocs(emailQuery);
    if (!emailSnapshot.empty) {
      const d = emailSnapshot.docs[0];
      return mapAllowedUser(d.id, d.data() as Record<string, unknown>);
    }
    return null;
  } catch (error) {
    console.error('Error al verificar usuario permitido:', error);
    return null;
  }
};

export const ensureAllowedUserEmailIndex = async (
  userId: string,
  email: string,
  record: AllowedUser
): Promise<void> => {
  const emailId = allowedUserEmailDocId(email);
  if (!emailId) return;
  const emailDoc = await getDoc(doc(db, 'allowedUsers', emailId));
  if (emailDoc.exists()) return;
  await setDoc(doc(db, 'allowedUsers', emailId), buildAllowedUserPayload(email, userId, {
    isAdmin: record.isAdmin,
  }));
};

export const mirrorAllowedUserUidDoc = async (
  userId: string,
  email: string,
  record: AllowedUser
): Promise<void> => {
  const uidDoc = await getDoc(doc(db, 'allowedUsers', userId));
  if (uidDoc.exists()) return;
  await setDoc(doc(db, 'allowedUsers', userId), buildAllowedUserPayload(email, userId, {
    isAdmin: record.isAdmin,
  }));
};

export const isUserAllowed = async (userId: string, email: string): Promise<boolean> => {
  const record = await getAllowedUserRecord(userId, email);
  return record !== null;
};

export const addAllowedUser = async (
  email: string,
  userId: string,
  options?: { isAdmin?: boolean }
): Promise<void> => {
  const payload = buildAllowedUserPayload(email, userId, options);
  await setDoc(doc(db, 'allowedUsers', userId), payload);
  await setDoc(doc(db, 'allowedUsers', allowedUserEmailDocId(email)), payload);
};

export const getAllowedUsers = async (): Promise<AllowedUser[]> => {
  const snapshot = await getDocs(collection(db, 'allowedUsers'));
  const all = snapshot.docs.map((d) => mapAllowedUser(d.id, d.data() as Record<string, unknown>));

  const isEmailDocId = (id: string) => id.includes('@');
  const docPriority = (row: AllowedUser) => {
    if (row.userId && row.id === row.userId) return 3;
    if (!isEmailDocId(row.id)) return 2;
    return 1;
  };

  const bestByUser = new Map<string, AllowedUser>();
  for (const row of all) {
    const userId = row.userId || (isEmailDocId(row.id) ? undefined : row.id);
    const key = userId || allowedUserEmailDocId(row.email || row.id);
    if (!key) continue;

    const candidate: AllowedUser = {
      ...row,
      id: userId || row.id,
      userId: userId || row.id,
      email: row.email || row.id,
    };

    const existing = bestByUser.get(key);
    if (!existing || docPriority(row) > docPriority(existing)) {
      bestByUser.set(key, candidate);
    }
  }

  return Array.from(bestByUser.values()).sort((a, b) => a.email.localeCompare(b.email, 'es'));
};

export const removeAllowedUser = async (userIdOrEmail: string): Promise<void> => {
  const byId = doc(db, 'allowedUsers', userIdOrEmail);
  const snap = await getDoc(byId);
  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>;
    const uid = data.userId ? String(data.userId) : userIdOrEmail;
    const email = data.email ? String(data.email) : '';
    await deleteDoc(byId);
    if (email) {
      await deleteDoc(doc(db, 'allowedUsers', allowedUserEmailDocId(email)));
    }
    if (uid !== byId.id) {
      await deleteDoc(doc(db, 'allowedUsers', uid));
    }
    return;
  }
  const emailQuery = query(
    collection(db, 'allowedUsers'),
    where('email', '==', allowedUserEmailDocId(userIdOrEmail))
  );
  const snapshot = await getDocs(emailQuery);
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
};

// ============ PEDIDOS DE ACCESO ============
const mapAccessRequest = (id: string, data: Record<string, unknown>): AccessRequest => {
  const toIso = (v: unknown) =>
    v && typeof (v as { toDate?: () => Date }).toDate === 'function'
      ? (v as { toDate: () => Date }).toDate().toISOString()
      : typeof v === 'string'
        ? v
        : '';
  return {
    id,
    email: String(data.email || ''),
    displayName: String(data.displayName || ''),
    photoURL: String(data.photoURL || ''),
    status: (data.status as AccessRequestStatus) || 'pending',
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
};

export const getMyAccessRequest = async (uid: string): Promise<AccessRequest | null> => {
  const snap = await getDoc(doc(db, 'accessRequests', uid));
  if (!snap.exists()) return null;
  return mapAccessRequest(snap.id, snap.data() as Record<string, unknown>);
};

export const requestAccess = async (user: User): Promise<AccessRequest> => {
  const ref = doc(db, 'accessRequests', user.uid);
  const existing = await getDoc(ref);
  const now = Timestamp.now();
  const payload = {
    email: (user.email || '').toLowerCase(),
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    status: 'pending' as const,
    updatedAt: now,
  };
  if (existing.exists()) {
    await updateDoc(ref, payload);
  } else {
    await setDoc(ref, { ...payload, createdAt: now });
  }
  const snap = await getDoc(ref);
  return mapAccessRequest(snap.id, snap.data() as Record<string, unknown>);
};

export const listAccessRequests = async (): Promise<AccessRequest[]> => {
  const snapshot = await getDocs(collection(db, 'accessRequests'));
  return snapshot.docs
    .map((d) => mapAccessRequest(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
};

export const approveAccessRequest = async (request: AccessRequest): Promise<void> => {
  await addAllowedUser(request.email, request.id);
  await updateDoc(doc(db, 'accessRequests', request.id), {
    status: 'approved',
    updatedAt: Timestamp.now(),
  });
};

export const denyAccessRequest = async (requestId: string): Promise<void> => {
  await updateDoc(doc(db, 'accessRequests', requestId), {
    status: 'denied',
    updatedAt: Timestamp.now(),
  });
};

// ============ CATEGORÍAS DE COMIDA ============
export const getMealCategories = async (userId: string): Promise<MealCategory[]> => {
  const q = query(collection(db, 'mealCategories'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt?.toDate?.().toISOString() || docSnap.data().createdAt,
  })) as MealCategory[];
  list.sort(compareByDisplayOrder);
  return list;
};

export const addMealCategory = async (
  category: Omit<MealCategory, 'id' | 'createdAt'>
): Promise<string> => {
  const docRef = await addDoc(collection(db, 'mealCategories'), {
    ...category,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

export const updateMealCategory = async (id: string, updates: Partial<MealCategory>): Promise<void> => {
  await updateDoc(doc(db, 'mealCategories', id), updates);
};

export const deleteMealCategory = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'mealCategories', id));
};

export const reorderMealCategories = async (orderedIds: string[]): Promise<void> => {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, 'mealCategories', id), { sortOrder: index });
  });
  await batch.commit();
};

/**
 * Completa el pack de 5 momentos del día; evita carreras con ids fijos + mutex.
 */
export const ensureInitialPack = async (userId: string): Promise<EnsureInitialPackResult> => {
  const inflight = ensurePackInflight.get(userId);
  if (inflight) return inflight;

  const promise = ensureInitialPackInner(userId).finally(() => {
    ensurePackInflight.delete(userId);
  });
  ensurePackInflight.set(userId, promise);
  return promise;
};

const ensureInitialPackInner = async (userId: string): Promise<EnsureInitialPackResult> => {
  let existing = await getMealCategories(userId);
  let categoriesRemoved = 0;
  const dedupeOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  const byName = new Map<string, MealCategory[]>();
  for (const c of existing) {
    const key = normalizePackName(c.name);
    const list = byName.get(key) || [];
    list.push(c);
    byName.set(key, list);
  }

  for (const list of byName.values()) {
    if (list.length <= 1) continue;
    list.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    for (const dup of list.slice(1)) {
      dedupeOps.push((batch) => batch.delete(doc(db, 'mealCategories', dup.id)));
      categoriesRemoved++;
    }
  }

  if (dedupeOps.length > 0) {
    await commitBatches(dedupeOps);
    existing = await getMealCategories(userId);
  }

  const nameSet = new Map(existing.map((c) => [normalizePackName(c.name), c] as const));
  const now = Timestamp.now();
  let categoriesAdded = 0;
  const seedOps: Array<(batch: ReturnType<typeof writeBatch>) => void> = [];

  for (const cat of INITIAL_MEAL_CATEGORIES) {
    if (nameSet.has(normalizePackName(cat.name))) continue;
    const id = packCategoryDocId(userId, cat.key);
    seedOps.push((batch) =>
      batch.set(doc(db, 'mealCategories', id), {
        name: cat.name,
        color: cat.color,
        userId,
        sortOrder: cat.sortOrder,
        createdAt: now,
      })
    );
    categoriesAdded++;
  }

  if (seedOps.length > 0) {
    await commitBatches(seedOps);
  }

  return { categoriesAdded, categoriesRemoved };
};

// ============ REGISTROS DE COMIDA ============
export const getMealEntries = async (userId: string): Promise<MealEntry[]> => {
  const q = query(collection(db, 'mealEntries'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      date: data.date?.toDate?.().toISOString().split('T')[0] || data.date,
      createdAt: data.createdAt?.toDate?.().toISOString() || data.createdAt,
    };
  }) as MealEntry[];
  list.sort(compareMealsByDateTime);
  return list;
};

export const addMealEntry = async (meal: Omit<MealEntry, 'id' | 'createdAt'>): Promise<string> => {
  const payload: Record<string, unknown> = {
    date: meal.date,
    categoryId: meal.categoryId,
    description: meal.description.trim(),
    userId: meal.userId,
    createdAt: Timestamp.now(),
  };
  if (meal.time?.trim()) payload.time = meal.time.trim();
  if (meal.notes?.trim()) payload.notes = meal.notes.trim();
  const docRef = await addDoc(collection(db, 'mealEntries'), payload);
  return docRef.id;
};

export const updateMealEntry = async (id: string, updates: Partial<MealEntry>): Promise<void> => {
  const updateData: Record<string, unknown> = {};
  if (updates.date !== undefined) updateData.date = updates.date;
  if (updates.categoryId !== undefined) updateData.categoryId = updates.categoryId;
  if (updates.description !== undefined) updateData.description = updates.description.trim();
  if (updates.time !== undefined) {
    updateData.time = updates.time?.trim() ? updates.time.trim() : deleteField();
  }
  if (updates.notes !== undefined) {
    updateData.notes = updates.notes.trim() ? updates.notes.trim() : deleteField();
  }
  await updateDoc(doc(db, 'mealEntries', id), updateData);
};

export const deleteMealEntry = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'mealEntries', id));
};

// ============ CONFIGURACIÓN DE USUARIO ============
export interface UserSettings {
  theme?: 'dark' | 'light';
  headerColorDark?: string;
  headerColorLight?: string;
  headerTitle?: string;
  initialPackVersion?: number;
}

export const getUserTheme = async (userId: string): Promise<'dark' | 'light' | null> => {
  try {
    const userSettingsRef = doc(db, 'userSettings', userId);
    const userSettingsSnap = await getDoc(userSettingsRef);
    if (userSettingsSnap.exists()) {
      return userSettingsSnap.data().theme || null;
    }
    return null;
  } catch (error) {
    console.error('Error al obtener tema del usuario:', error);
    return null;
  }
};

export const saveUserTheme = async (userId: string, theme: 'dark' | 'light'): Promise<void> => {
  try {
    const userSettingsRef = doc(db, 'userSettings', userId);
    await setDoc(
      userSettingsRef,
      {
        userId,
        theme,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error al guardar tema del usuario:', error);
    throw error;
  }
};

export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  try {
    const userSettingsRef = doc(db, 'userSettings', userId);
    const userSettingsSnap = await getDoc(userSettingsRef);
    if (userSettingsSnap.exists()) {
      const data = userSettingsSnap.data();
      return {
        theme: data.theme || null,
        headerColorDark: data.headerColorDark || null,
        headerColorLight: data.headerColorLight || null,
        headerTitle: data.headerTitle || null,
        initialPackVersion:
          typeof data.initialPackVersion === 'number' ? data.initialPackVersion : undefined,
      };
    }
    return null;
  } catch (error) {
    console.error('Error al obtener configuraciones del usuario:', error);
    return null;
  }
};

export const saveUserSettings = async (
  userId: string,
  settings: Partial<UserSettings>
): Promise<void> => {
  try {
    const userSettingsRef = doc(db, 'userSettings', userId);
    await setDoc(
      userSettingsRef,
      {
        userId,
        ...settings,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error al guardar configuraciones del usuario:', error);
    throw error;
  }
};
