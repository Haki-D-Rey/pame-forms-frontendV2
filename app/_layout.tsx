// app/_layout.tsx
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native'; // ⬅️ añade esto

import BannerOffline from '@/components/banner-offline';
import { GlobalAlertProvider } from '@/components/global-alert-component';
import ApiProvider from '@/providers/api-provider';
import { AuthProvider } from '@/providers/auth';
import SessionExpiryProvider from '@/providers/session-expiry-provider';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GlobalAlertProvider logoDefault={require('@/assets/images/pame-logo-t.png')}>
      <AuthProvider>
        <ApiProvider>
          <SessionExpiryProvider
            thresholdSec={30}
            logo={require('@/assets/images/pame-logo-t.png')}
          >
            <SafeAreaProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
                  <BannerOffline />
                  <Slot />
                  {/* Texto oscuro sobre fondo claro */}
                  <StatusBar style="dark" backgroundColor="#FFFFFF" />
                </SafeAreaView>
              </ThemeProvider>
            </SafeAreaProvider>
          </SessionExpiryProvider>
        </ApiProvider>
      </AuthProvider>
    </GlobalAlertProvider>
  );
}
