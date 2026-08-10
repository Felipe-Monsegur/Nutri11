/** Subir este número cuando cambie el pack para reaplicar categorías faltantes a usuarios existentes. */
export const INITIAL_PACK_VERSION = 2;

export interface InitialMealCategory {
  key: string;
  name: string;
  color: string;
  sortOrder: number;
}

export const INITIAL_MEAL_CATEGORIES: InitialMealCategory[] = [
  { key: 'desayuno', name: 'Desayuno', color: '#F59E0B', sortOrder: 0 },
  { key: 'media-manana', name: 'Media mañana', color: '#F97316', sortOrder: 1 },
  { key: 'almuerzo', name: 'Almuerzo', color: '#EF4444', sortOrder: 2 },
  { key: 'merienda', name: 'Merienda', color: '#8B5CF6', sortOrder: 3 },
  { key: 'cena', name: 'Cena', color: '#3B82F6', sortOrder: 4 },
  { key: 'snack', name: 'Snack', color: '#10B981', sortOrder: 5 },
];
