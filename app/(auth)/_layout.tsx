// app/(auth)/_layout.tsx
import { useAuth } from '@/providers/auth';
import { Redirect, Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AuthLayout() {
  const { isLoading, isSignedIn } = useAuth();

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ActivityIndicator size="large" />
          <Text style={{ color: '#6b7280' }}>Inicializando…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isSignedIn) {
    // 🔁 No muestres login si ya está autenticado
    return <Redirect href="/(admin)/dashboard/home" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />
    </Stack>
  );
}
