import { ThemedText } from '@/components/themed-text';
import UserForm from '@/components/users/user-form';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

export default function NewUserScreen() {
  const router = useRouter();

  return (
    <ScrollView
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 12 }}   // ← sin gap
    >
      <View
        collapsable={false} // ← estabiliza el nodo raíz del contenido
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <ThemedText type="title">Nuevo usuario</ThemedText>
        <Pressable
          onPress={() => router.back()}
          style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f3f4f6' }}
        >
          <MaterialCommunityIcons name="arrow-left" size={18} color="#374151" />
        </Pressable>
      </View>

      {/* separador en lugar de gap */}
      <View style={{ height: 12 }} />

      <UserForm
        mode="create"
        onSuccess={() => {
          Alert.alert('Éxito', 'Usuario creado', [
            { text: 'OK', onPress: () => router.replace('/(admin)/security/users') },
          ]);
        }}
      />
    </ScrollView>
  );
}
