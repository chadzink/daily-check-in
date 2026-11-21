import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { useQueryClient } from '@tanstack/react-query';
import { auth } from '../firebase';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
      if (!firebaseUser) {
        queryClient.clear();
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    setUser(credential.user);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        login,
        logout,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const fallbackAuthContext: AuthContextValue = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => {},
  logout: async () => {},
  getIdToken: async () => null,
};

/**
 * Returns the active authentication context, falling back safely when
 * rendered outside an AuthProvider (e.g. in isolated component unit tests).
 */
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  return ctx ?? fallbackAuthContext;
};
