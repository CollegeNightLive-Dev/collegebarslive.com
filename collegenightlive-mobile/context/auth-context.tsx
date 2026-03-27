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
import { syncExpoPushTokenIfPermitted } from '@/lib/push-notifications';

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
        void syncExpoPushTokenIfPermitted(firebaseUser.uid);
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
    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

    const callDeleteUserData = async (): Promise<'ok' | 'no-user'> => {
      const activeUser = auth.currentUser;
      if (!activeUser) return 'no-user';
      const token = await activeUser.getIdToken(true);
      await callCallableWithToken('deleteUserData', token, { _idToken: token });
      return 'ok';
    };

    const isTokenExpiredError = (err: unknown): boolean => {
      const message = err instanceof Error ? err.message : String(err);
      return message.toLowerCase().includes('auth/user-token-expired');
    };

    try {
      const first = await callDeleteUserData();
      if (first === 'no-user') {
        await wait(350);
        const second = await callDeleteUserData();
        if (second === 'no-user') {
          // Auth state is in transition; treat as already-deleted flow and continue.
        }
      }
    } catch (err: unknown) {
      if (!isTokenExpiredError(err)) {
        throw err;
      }

      // One retry: token may have expired right as delete started.
      try {
        await auth.currentUser?.reload();
      } catch {
        // Ignore reload failures; retry attempt below will determine outcome.
      }

      try {
        await callDeleteUserData();
      } catch (retryErr: unknown) {
        if (!isTokenExpiredError(retryErr)) {
          throw retryErr;
        }
        // If token is still expired on retry, backend likely already deleted user.
      }
    }

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
