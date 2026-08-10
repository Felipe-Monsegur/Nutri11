import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  getMealCategories,
  getMealEntries,
  ensureInitialPack,
  saveUserSettings,
  INITIAL_PACK_VERSION,
} from '../services/firebaseService';
import { INITIAL_MEAL_CATEGORIES } from '../data/initialPack';
import { MealCategory, MealEntry } from '../types';

interface DataContextType {
  categories: MealCategory[];
  meals: MealEntry[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataContextType>({
  categories: [],
  meals: [],
  loading: true,
  refresh: async () => {},
});

export const useData = () => useContext(DataContext);

const PACK_MIN = INITIAL_MEAL_CATEGORIES.length;

async function seedPackWithRetry(userId: string): Promise<MealCategory[]> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Siempre idempotente: completa lo que falte (cuenta nueva o pack actualizado).
      await ensureInitialPack(userId);
      const cats = await getMealCategories(userId);
      if (cats.length >= PACK_MIN) {
        await saveUserSettings(userId, { initialPackVersion: INITIAL_PACK_VERSION });
        return cats;
      }
      // Primera sesión: a veces las rules/auth aún no alcanzaron; reintentar.
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    } catch (err) {
      lastError = err;
      console.error('Error ensuring initial pack:', err);
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
  }

  if (lastError) {
    console.error('Pack seed failed after retries:', lastError);
  }

  try {
    return await getMealCategories(userId);
  } catch {
    return [];
  }
}

export const DataProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAllowed, checkingAccess, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<MealCategory[]>([]);
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    if (!user || !isAllowed) {
      setCategories([]);
      setMeals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [cats, entries] = await Promise.all([
        seedPackWithRetry(user.uid),
        getMealEntries(user.uid).catch((err) => {
          console.error('Error loading mealEntries:', err);
          return [] as MealEntry[];
        }),
      ]);

      setCategories(cats);
      setMeals(entries);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || checkingAccess) {
      setLoading(true);
      return;
    }
    void loadData();
  }, [user, isAllowed, authLoading, checkingAccess]);

  return (
    <DataContext.Provider
      value={{
        categories,
        meals,
        loading,
        refresh: loadData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
