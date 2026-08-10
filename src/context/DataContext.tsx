import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  getMealCategories,
  getMealEntries,
  ensureInitialPack,
  getUserSettings,
  saveUserSettings,
  INITIAL_PACK_VERSION,
} from '../services/firebaseService';
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
      try {
        const settings = await getUserSettings(user.uid).catch(() => null);
        const packVersion = settings?.initialPackVersion ?? 0;
        if (packVersion < INITIAL_PACK_VERSION) {
          await ensureInitialPack(user.uid);
          await saveUserSettings(user.uid, { initialPackVersion: INITIAL_PACK_VERSION });
        } else {
          const current = await getMealCategories(user.uid);
          if (current.length === 0) {
            await ensureInitialPack(user.uid);
          }
        }
      } catch (err) {
        console.error('Error ensuring initial pack:', err);
      }

      const [cats, entries] = await Promise.all([
        getMealCategories(user.uid).catch((err) => {
          console.error('Error loading mealCategories:', err);
          return [] as MealCategory[];
        }),
        getMealEntries(user.uid).catch((err) => {
          console.error('Error loading mealEntries:', err);
          return [] as MealEntry[];
        }),
      ]);

      if (cats.length === 0) {
        try {
          await ensureInitialPack(user.uid);
          await saveUserSettings(user.uid, { initialPackVersion: INITIAL_PACK_VERSION });
          const retryCats = await getMealCategories(user.uid);
          setCategories(retryCats);
          setMeals(entries);
          return;
        } catch (err) {
          console.error('Error retrying initial pack:', err);
        }
      }

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
