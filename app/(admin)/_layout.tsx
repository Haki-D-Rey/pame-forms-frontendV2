// app/(admin)/_layout.tsx
import AdminShell from '@/components/layout/admin-shell'; // tu shell
import { useAuth } from '@/providers/auth';
import { Redirect, Slot, usePathname } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminLayout() {
  const { isLoading, isSignedIn } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" />
          <Text style={{ color: '#6b7280' }}>Inicializando…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isSignedIn) {
    // 🔒 Si no hay sesión, no pintes nada del admin
    return <Redirect href="/(auth)/auth/login" />;
  }

  // Si entras al root del grupo /(admin), manda a dashboard/home
  if (pathname === '/(admin)') {
    return <Redirect href="/(admin)/dashboard/home" />;
  }

  return (
    <AdminShell>
      <Slot />
    </AdminShell>
  );
}
