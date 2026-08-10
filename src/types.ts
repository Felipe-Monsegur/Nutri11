export interface MealCategory {
  id: string;
  name: string;
  color: string;
  userId: string;
  createdAt: string;
  sortOrder?: number;
}

export interface MealEntry {
  id: string;
  date: string; // YYYY-MM-DD
  /** Hora opcional HH:mm */
  time?: string;
  categoryId: string;
  /** Qué comiste */
  description: string;
  notes?: string;
  userId: string;
  createdAt: string;
}

export type AccessRequestStatus = 'pending' | 'approved' | 'denied';

export interface AccessRequest {
  id: string;
  email: string;
  displayName: string;
  photoURL: string;
  status: AccessRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AllowedUser {
  id: string;
  email: string;
  userId?: string;
  isAdmin?: boolean;
  addedAt?: string;
}

export interface NutriData {
  categories: MealCategory[];
  meals: MealEntry[];
}
