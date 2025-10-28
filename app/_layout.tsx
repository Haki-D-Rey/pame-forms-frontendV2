// app/_layout.tsx
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import BannerOffline from '@/components/banner-offline';
import { GlobalAlertProvider } from '@/components/global-alert-component';
import ApiProvider from '@/providers/api-provider';
import { AuthProvider } from '@/providers/auth';
import SessionExpiryProvider from '@/providers/session-expiry-provider';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {

  return (
    <GlobalAlertProvider logoDefault={require('@/assets/images/pame-logo-t.png')}>
      <AuthProvider>
        <ApiProvider>
          <SessionExpiryProvider
            thresholdSec={30}
            logo={require('@/assets/images/pame-logo-t.png')}
          >
            <SafeAreaProvider>
              <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
                <BannerOffline />
                {/* Renderiza el árbol actual; los grupos se encargan de redirigir */}
                <Slot />
                <StatusBar style="auto" />
              </SafeAreaView>
            </SafeAreaProvider>
          </SessionExpiryProvider>
        </ApiProvider>
      </AuthProvider>
    </GlobalAlertProvider>
  );
}
