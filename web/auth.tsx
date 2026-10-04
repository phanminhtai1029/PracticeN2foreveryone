import { createContext, useContext } from 'react';
import type { User } from './api';

export const AuthContext = createContext<{ user: User; logout: () => void } | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthContext');
  return ctx;
}
