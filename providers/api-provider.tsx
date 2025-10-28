// src/providers/ApiProvider.tsx
import { api, attachAuthInterceptors } from '@/lib/api';
import { useAuth } from '@/providers/auth';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';

export default function ApiProvider({ children }: { children: React.ReactNode }) {

  const router = useRouter();
  const { getAccessToken, signOut } = useAuth();

  const loggingOutRef = useRef(false);
  const handleUnauthorized = async () => {
    console.log("entro en el handleUnauthorized");
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    try {
      await signOut();
      router.replace('/(auth)/auth/login');
    } finally {
      setTimeout(() => { loggingOutRef.current = false; }, 0);
    }
  };

  useEffect(() => {
    const detach = attachAuthInterceptors(api, {
      getAccessToken,
      // refreshAccessToken: undefined, // opcional, basta con disableRefresh
      disableRefresh: true,            // ← clave: NO intentar refresh
      onUnauthorized: handleUnauthorized,
    });
    return () => detach();
  }, [getAccessToken]);

  return <>{children}</>;
}
