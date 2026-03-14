import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signOut as fbSignOut,
  User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { callCallableWithToken } from '@/lib/callableWithToken';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authError: boolean;
  retrySignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  authError: false,
  retrySignIn: async () => {},
  signOut: async () => {},
  deleteAccount: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  const attemptAnonymousSignIn = useCallback(async () => {
    try {
      setAuthError(false);
      await signInAnonymously(auth);
    } catch (e) {
      console.error('Anonymous sign-in failed:', e);
      setAuthError(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setAuthError(false);
        setLoading(false);
      } else {
        await attemptAnonymousSignIn();
      }
    });
    return unsub;
  }, [attemptAnonymousSignIn]);

  const retrySignIn = useCallback(async () => {
    setLoading(true);
    setAuthError(false);
    await attemptAnonymousSignIn();
  }, [attemptAnonymousSignIn]);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    await signInAnonymously(auth);
  }, []);

  const deleteAccount = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const token = await currentUser.getIdToken(true);
    await callCallableWithToken('deleteUserData', token, { _idToken: token });
    await signInAnonymously(auth);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, authError, retrySignIn, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
