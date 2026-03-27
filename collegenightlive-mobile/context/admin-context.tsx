import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ADMIN_SECRET_STORAGE_KEY = 'admin_bar_secret_local';

interface AdminContextValue {
  adminMode: boolean;
  setAdminMode: (value: boolean | ((prev: boolean) => boolean)) => void;
  toggleAdminMode: () => void;
  adminSecret: string;
  setAdminSecret: (value: string) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [adminMode, setAdminMode] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [secretLoaded, setSecretLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await AsyncStorage.getItem(ADMIN_SECRET_STORAGE_KEY);
      if (!cancelled && saved) setAdminSecret(saved);
      if (!cancelled) setSecretLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!secretLoaded) return;
    if (adminSecret) {
      void AsyncStorage.setItem(ADMIN_SECRET_STORAGE_KEY, adminSecret);
    }
  }, [adminSecret, secretLoaded]);

  const toggleAdminMode = useCallback(() => {
    setAdminMode((m) => !m);
  }, []);

  const value = useMemo(
    () => ({
      adminMode,
      setAdminMode,
      toggleAdminMode,
      adminSecret,
      setAdminSecret,
    }),
    [adminMode, toggleAdminMode, adminSecret],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return ctx;
}
