// app/(admin)/security/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SecurityLayout() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {__DEV__ && <View pointerEvents="none" style={styles.debugBorder} />}

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#fff' }
        }}
      >
        <Stack.Screen name="users/index" />
        <Stack.Screen name="users/new" />
        <Stack.Screen name="users/[id]" />
        <Stack.Screen name="roles/index" />
        <Stack.Screen name="roles/new" />
        <Stack.Screen name="roles/[id]" />
        <Stack.Screen name="permissions/index" />
        <Stack.Screen name="permissions/new" />
        <Stack.Screen name="permissions/[id]" />
      </Stack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  debugBorder: {
    ...StyleSheet.absoluteFillObject,
    borderColor: '#16a34a',
    borderWidth: 2,
    borderStyle: 'solid',
    zIndex: 9999,
    elevation: 9999,
  },
});
